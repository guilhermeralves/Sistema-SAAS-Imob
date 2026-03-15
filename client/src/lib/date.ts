type DateValue = Date | string | null | undefined;

function parseStoredDate(value: DateValue) {
  if (!value) return null;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getStoredDateParts(value: DateValue) {
  const parsedDate = parseStoredDate(value);
  if (!parsedDate) return null;

  return {
    day: pad(parsedDate.getUTCDate()),
    month: pad(parsedDate.getUTCMonth() + 1),
    year: parsedDate.getUTCFullYear(),
    hours: pad(parsedDate.getUTCHours()),
    minutes: pad(parsedDate.getUTCMinutes()),
  };
}

export function formatStoredDate(value: DateValue, fallback = "-") {
  const parts = getStoredDateParts(value);
  if (!parts) return fallback;

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatStoredDateTime(value: DateValue, fallback = "Data invalida") {
  const parts = getStoredDateParts(value);
  if (!parts) return fallback;

  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hours}:${parts.minutes}`;
}

export function normalizeDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isoDateToDisplay(value: Date | string | null | undefined) {
  if (!value) return "";

  if (value instanceof Date) {
    return formatStoredDate(value, "");
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function displayDateToIso(value: string | null | undefined) {
  if (!value) return null;

  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}
