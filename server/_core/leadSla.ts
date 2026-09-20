import { createLeadInteraction, getDefaultAttendanceQueue, getLeadsForSlaProcessing, updateLead } from "../db";
import { addBusinessMinutes } from "./businessHours";
import { distributeLeadToRoleta } from "./roleta";

// Defaults quando não há fila padrão configurada. Os minutos reais vêm da
// fila (assignmentTimeoutMinutes / attendanceTimeoutMinutes) e são lidos
// a cada tick para refletir alterações feitas pelo admin.
const DEFAULT_ASSIGNMENT_TIMEOUT_MINUTES = 15;
const DEFAULT_ATTENDANCE_TIMEOUT_MINUTES = 40;
const SCHEDULER_INTERVAL_MS = 60 * 1000;

type SlaConfig = {
  assignmentTimeoutMinutes: number;
  attendanceTimeoutMinutes: number;
  businessHoursOnly: boolean;
};

let processing = false;

async function processLeadAssignmentWindow(
  now: Date,
  lead: Awaited<ReturnType<typeof getLeadsForSlaProcessing>>[number],
  config: SlaConfig
) {
  const cycleStart = lead.assignmentCycleStartedAt ?? lead.createdAt;
  const assignmentDeadline = config.businessHoursOnly
    ? addBusinessMinutes(cycleStart, config.assignmentTimeoutMinutes)
    : new Date(cycleStart.getTime() + config.assignmentTimeoutMinutes * 60000);

  if (now < assignmentDeadline) {
    return;
  }

  if (lead.assignmentSlaNotifiedAt) {
    return;
  }

  const unit = config.businessHoursOnly ? "minutos úteis" : "minutos";
  await updateLead(lead.id, { assignmentSlaNotifiedAt: now });
  await createLeadInteraction({
    idLead: lead.id,
    idUsuario: null,
    eventType: "sla_assignment_timeout",
    message: `Lead sem direcionamento por mais de ${config.assignmentTimeoutMinutes} ${unit}.`,
  });
}

async function processLeadAttendanceWindow(
  now: Date,
  lead: Awaited<ReturnType<typeof getLeadsForSlaProcessing>>[number],
  config: SlaConfig
) {
  if (!lead.assignedAt) {
    return;
  }

  const attendanceDeadline = config.businessHoursOnly
    ? addBusinessMinutes(lead.assignedAt, config.attendanceTimeoutMinutes)
    : new Date(lead.assignedAt.getTime() + config.attendanceTimeoutMinutes * 60000);
  if (now < attendanceDeadline) {
    return;
  }

  await updateLead(lead.id, {
    idResponsavel: null,
    status: "novo",
    assignedAt: null,
    attendedAt: null,
    assignmentCycleStartedAt: now,
    assignmentSlaNotifiedAt: null,
  });

  const unit = config.businessHoursOnly ? "minutos úteis" : "minutos";
  await createLeadInteraction({
    idLead: lead.id,
    idUsuario: null,
    eventType: "sla_attendance_timeout_auto_unassign",
    message: `Lead não atendido em ${config.attendanceTimeoutMinutes} ${unit} após direcionamento. Responsável removido automaticamente para redirecionamento.`,
  });

  // Redireciona imediatamente ao próximo corretor da roleta (round-robin).
  // Se não houver fila/participante, o lead volta a "novo" e o ciclo de SLA
  // segue como fallback na próxima passada.
  await distributeLeadToRoleta({ id: lead.id, nome: lead.nome });
}

export async function processLeadSlaTick() {
  if (processing) return;
  processing = true;

  try {
    const now = new Date();

    // Lê os timeouts configurados na fila padrão. Se não houver fila padrão,
    // cai nos defaults para não travar o pipeline.
    const queue = await getDefaultAttendanceQueue();
    const config: SlaConfig = {
      assignmentTimeoutMinutes:
        queue?.assignmentTimeoutMinutes ?? DEFAULT_ASSIGNMENT_TIMEOUT_MINUTES,
      attendanceTimeoutMinutes:
        queue?.attendanceTimeoutMinutes ?? DEFAULT_ATTENDANCE_TIMEOUT_MINUTES,
      businessHoursOnly: queue ? queue.businessHoursOnly === 1 : true,
    };

    const leads = await getLeadsForSlaProcessing();

    for (const lead of leads) {
      if (lead.status !== "novo" && lead.status !== "atendimento") {
        continue;
      }

      if (!lead.idResponsavel) {
        // Se o lead tem distribuição agendada no futuro, respeita o delay.
        // Só distribui após esse instante ter passado.
        if (lead.distributeAfter && lead.distributeAfter.getTime() > now.getTime()) {
          continue;
        }

        // Tenta distribuir pela roleta a cada passada; se conseguir, o lead
        // ganha responsável e o SLA de direcionamento não precisa disparar.
        const assignedTo = await distributeLeadToRoleta({
          id: lead.id,
          nome: lead.nome,
        });
        if (assignedTo) {
          continue;
        }
        await processLeadAssignmentWindow(now, lead, config);
        continue;
      }

      if (lead.status === "atendimento" || lead.attendedAt) {
        continue;
      }

      await processLeadAttendanceWindow(now, lead, config);
    }
  } catch (error) {
    console.error("[lead-sla] Falha ao processar regras de SLA de leads:", error);
  } finally {
    processing = false;
  }
}

export function startLeadSlaScheduler() {
  void processLeadSlaTick();
  return setInterval(() => {
    void processLeadSlaTick();
  }, SCHEDULER_INTERVAL_MS);
}
