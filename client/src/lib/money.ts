export function normalizeMoneyCentsInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

export function formatMoneyFromCentsInput(value: string) {
  const normalized = normalizeMoneyCentsInput(value);
  if (!normalized) return "";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(normalized) / 100);
}

export function parseMoneyCentsInput(value: string) {
  const normalized = normalizeMoneyCentsInput(value);
  if (!normalized) return null;
  return Number(normalized);
}

export function formatMoneyFromCentsValue(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}
