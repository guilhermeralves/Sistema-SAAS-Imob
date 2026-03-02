export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  return /^\d{11}$/.test(normalizeCpf(value));
}

export function formatCpf(value: string | null | undefined) {
  if (!value) return "";
  const digits = normalizeCpf(value).slice(0, 11);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
