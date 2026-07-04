/**
 * Regras de horário comercial (America/Sao_Paulo) compartilhadas pelo SLA de
 * leads e pela Roleta de Atendimentos. Extraído de `leadSla.ts` para evitar
 * duplicação e import circular entre o SLA e o serviço da roleta.
 *
 * Janela comercial: seg–sex 09:00–18:00 e sáb 09:00–13:00.
 */
export const BUSINESS_TIMEZONE = "America/Sao_Paulo";

type Weekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

function getSaoPauloWeekdayAndTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find(part => part.type === "weekday")?.value as
    | Weekday
    | undefined;
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find(part => part.type === "minute")?.value ?? "0"
  );

  return {
    weekday: weekday ?? "Sun",
    hour,
    minute,
  };
}

export function isBusinessTime(date: Date) {
  const { weekday, hour, minute } = getSaoPauloWeekdayAndTime(date);
  const totalMinutes = hour * 60 + minute;

  if (
    weekday === "Mon" ||
    weekday === "Tue" ||
    weekday === "Wed" ||
    weekday === "Thu" ||
    weekday === "Fri"
  ) {
    return totalMinutes >= 9 * 60 && totalMinutes < 18 * 60;
  }

  if (weekday === "Sat") {
    return totalMinutes >= 9 * 60 && totalMinutes < 13 * 60;
  }

  return false;
}

export function findNextBusinessMinute(fromDate: Date) {
  const cursor = new Date(fromDate.getTime());
  for (let i = 0; i < 60 * 24 * 10; i += 1) {
    if (isBusinessTime(cursor)) {
      return cursor;
    }
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }

  return cursor;
}

export function addBusinessMinutes(startDate: Date, minutes: number) {
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
