const BR_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export function normalizeCreci(value: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digits = cleaned.replace(/\D/g, "").slice(0, 7);
  const letters = cleaned.replace(/\d/g, "").slice(0, 2);

  if (!digits) return "";
  if (!letters) return digits;

  return `${digits}/${letters}`;
}

export function formatCreci(value: string) {
  return normalizeCreci(value);
}

export function isValidCreci(value: string) {
  const normalized = normalizeCreci(value);
  const match = normalized.match(/^(\d{2,7})\/([A-Z]{2})$/);

  if (!match) return false;

  return BR_UFS.includes(match[2] as (typeof BR_UFS)[number]);
}
