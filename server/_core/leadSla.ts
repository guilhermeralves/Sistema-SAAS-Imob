import { createLeadInteraction, getLeadsForSlaProcessing, updateLead } from "../db";
import { addBusinessMinutes } from "./businessHours";
import { distributeLeadToRoleta } from "./roleta";

const ASSIGNMENT_TIMEOUT_MINUTES = 15;
const ATTENDANCE_TIMEOUT_MINUTES = 40;
const SCHEDULER_INTERVAL_MS = 60 * 1000;

let processing = false;

async function processLeadAssignmentWindow(now: Date, lead: Awaited<ReturnType<typeof getLeadsForSlaProcessing>>[number]) {
  const cycleStart = lead.assignmentCycleStartedAt ?? lead.createdAt;
  const assignmentDeadline = addBusinessMinutes(cycleStart, ASSIGNMENT_TIMEOUT_MINUTES);

  if (now < assignmentDeadline) {
    return;
  }

  if (lead.assignmentSlaNotifiedAt) {
    return;
  }

  await updateLead(lead.id, { assignmentSlaNotifiedAt: now });
  await createLeadInteraction({
    idLead: lead.id,
    idUsuario: null,
    eventType: "sla_assignment_timeout",
    message: "Lead sem direcionamento por mais de 15 minutos.",
  });
}

async function processLeadAttendanceWindow(now: Date, lead: Awaited<ReturnType<typeof getLeadsForSlaProcessing>>[number]) {
  if (!lead.assignedAt) {
    return;
  }

  const attendanceDeadline = addBusinessMinutes(lead.assignedAt, ATTENDANCE_TIMEOUT_MINUTES);
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

  await createLeadInteraction({
    idLead: lead.id,
    idUsuario: null,
    eventType: "sla_attendance_timeout_auto_unassign",
    message:
      "Lead não atendido em 40 minutos úteis após direcionamento. Responsável removido automaticamente para redirecionamento.",
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
    const leads = await getLeadsForSlaProcessing();

    for (const lead of leads) {
      if (lead.status !== "novo" && lead.status !== "atendimento") {
        continue;
      }

      if (!lead.idResponsavel) {
        // Tenta distribuir pela roleta a cada passada; se conseguir, o lead
        // ganha responsável e o SLA de direcionamento não precisa disparar.
        const assignedTo = await distributeLeadToRoleta({
          id: lead.id,
          nome: lead.nome,
        });
        if (assignedTo) {
          continue;
        }
        await processLeadAssignmentWindow(now, lead);
        continue;
      }

      if (lead.status === "atendimento" || lead.attendedAt) {
        continue;
      }

      await processLeadAttendanceWindow(now, lead);
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
