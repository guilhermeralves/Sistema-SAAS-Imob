import { createLeadInteraction, getLeadsForSlaProcessing, updateLead } from "../db";

const BUSINESS_TIMEZONE = "America/Sao_Paulo";
const ASSIGNMENT_TIMEOUT_MINUTES = 15;
const ATTENDANCE_TIMEOUT_MINUTES = 40;
const SCHEDULER_INTERVAL_MS = 60 * 1000;

type Weekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

let processing = false;

function getSaoPauloWeekdayAndTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find(part => part.type === "weekday")?.value as Weekday | undefined;
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? "0");

  return {
    weekday: weekday ?? "Sun",
    hour,
    minute,
  };
}

function isBusinessTime(date: Date) {
  const { weekday, hour, minute } = getSaoPauloWeekdayAndTime(date);
  const totalMinutes = hour * 60 + minute;

  if (weekday === "Mon" || weekday === "Tue" || weekday === "Wed" || weekday === "Thu" || weekday === "Fri") {
    return totalMinutes >= 9 * 60 && totalMinutes < 18 * 60;
  }

  if (weekday === "Sat") {
    return totalMinutes >= 9 * 60 && totalMinutes < 13 * 60;
  }

  return false;
}

function findNextBusinessMinute(fromDate: Date) {
  const cursor = new Date(fromDate.getTime());
  for (let i = 0; i < 60 * 24 * 10; i += 1) {
    if (isBusinessTime(cursor)) {
      return cursor;
    }
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }

  return cursor;
}

function addBusinessMinutes(startDate: Date, minutes: number) {
  const cursor = isBusinessTime(startDate)
    ? new Date(startDate.getTime())
    : findNextBusinessMinute(startDate);

  let remaining = Math.max(0, minutes);
  while (remaining > 0) {
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
    if (isBusinessTime(cursor)) {
      remaining -= 1;
    }
  }

  return cursor;
}

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
