// Geracao do cronograma de boletos de uma proposta de locacao.
// Mantido em shared para que backend (geracao/validacao) e frontend (preview)
// usem exatamente a mesma regra de competencia, vencimento e total.

export type RentalBoletoScheduleInput = {
  /** Data de inicio da locacao (Date ou string ISO YYYY-MM-DD). */
  startDate: Date | string;
  /** Dia do vencimento informado na proposta (1-31). */
  dueDay: number;
  /** Tempo de vigencia do contrato em meses. */
  leaseTermMonths: number;
  /** Valor do aluguel em centavos. */
  rentAmount: number;
  /** Valor do condominio em centavos, quando houver. */
  condominiumAmount?: number | null;
};

export type RentalBoletoScheduleItem = {
  installmentNumber: number;
  /** Primeiro dia do mes de competencia (YYYY-MM-DD). */
  referenceMonth: string;
  /** Data de vencimento do boleto (YYYY-MM-DD). */
  dueDate: string;
  rentAmount: number;
  condominiumAmount: number | null;
  extraAmount: number;
  totalAmount: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// Extrai ano/mes/dia tanto de Date (date mode do drizzle, meia-noite UTC) quanto
// de string ISO, sem sofrer com fuso horario.
function extractYearMonthDay(value: Date | string): {
  year: number;
  monthIndex: number;
  day: number;
} {
  if (typeof value === "string") {
    const [datePart] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    return { year, monthIndex: (month ?? 1) - 1, day: day ?? 1 };
  }
  return {
    year: value.getUTCFullYear(),
    monthIndex: value.getUTCMonth(),
    day: value.getUTCDate(),
  };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Calcula o vencimento de uma competencia respeitando o dia informado, fazendo
 * "clamp" quando o mes nao tem aquele dia (ex.: dia 31 em fevereiro).
 */
export function buildBoletoDueDate(
  year: number,
  monthIndex: number,
  dueDay: number
): string {
  const clampedDay = Math.min(Math.max(dueDay, 1), daysInMonth(year, monthIndex));
  return `${year}-${pad2(monthIndex + 1)}-${pad2(clampedDay)}`;
}

export function calculateBoletoTotal(input: {
  rentAmount: number;
  condominiumAmount?: number | null;
  extraAmount?: number | null;
}): number {
  return (
    Math.max(0, Math.round(input.rentAmount || 0)) +
    Math.max(0, Math.round(input.condominiumAmount || 0)) +
    Math.max(0, Math.round(input.extraAmount || 0))
  );
}

/**
 * Monta o cronograma completo de boletos de todo o periodo de vigencia.
 * A parcela N tem competencia no mes (mes de inicio + N-1) e vence no dia
 * informado daquele mes. O valor inicial replica aluguel + condominio da
 * proposta; reajustes futuros (IGP-M etc.) sao aplicados depois via edicao em
 * lote, ja que o indice do periodo ainda nao e conhecido na geracao.
 */
export function buildRentalBoletoSchedule(
  input: RentalBoletoScheduleInput
): RentalBoletoScheduleItem[] {
  const months = Math.max(0, Math.floor(input.leaseTermMonths || 0));
  if (months === 0) return [];

  const { year: startYear, monthIndex: startMonthIndex } = extractYearMonthDay(
    input.startDate
  );
  const rentAmount = Math.max(0, Math.round(input.rentAmount || 0));
  const condominiumAmount =
    input.condominiumAmount && input.condominiumAmount > 0
      ? Math.round(input.condominiumAmount)
      : null;

  const items: RentalBoletoScheduleItem[] = [];
  for (let i = 0; i < months; i += 1) {
    const totalMonthIndex = startMonthIndex + i;
    const year = startYear + Math.floor(totalMonthIndex / 12);
    const monthIndex = ((totalMonthIndex % 12) + 12) % 12;
    const totalAmount = calculateBoletoTotal({ rentAmount, condominiumAmount });

    items.push({
      installmentNumber: i + 1,
      referenceMonth: `${year}-${pad2(monthIndex + 1)}-01`,
      dueDate: buildBoletoDueDate(year, monthIndex, input.dueDay),
      rentAmount,
      condominiumAmount,
      extraAmount: 0,
      totalAmount,
    });
  }

  return items;
}

// Situacao temporal/pagamento de um boleto, derivada das datas e da baixa de
// pagamento (paidAt, futuramente preenchida por integracao bancaria).
export type RentalBoletoTemporalStatus =
  | "pago"
  | "em_aberto"
  | "atrasado"
  | "vencido";

// Limite (em dias corridos apos o vencimento) em que o boleto ainda e
// considerado "atrasado" (prazo de pagamento com multa) antes de virar
// "vencido".
export const BOLETO_LATE_GRACE_DAYS = 2;

function toDayNumber(value: Date | string): number {
  const { year, monthIndex, day } = extractYearMonthDay(value);
  return Math.floor(Date.UTC(year, monthIndex, day) / 86_400_000);
}

export function getBoletoTemporalStatus(
  boleto: { dueDate: Date | string; paidAt?: Date | string | null },
  today: Date | string = new Date()
): RentalBoletoTemporalStatus {
  if (boleto.paidAt) return "pago";

  const daysOverdue = toDayNumber(today) - toDayNumber(boleto.dueDate);
  if (daysOverdue <= 0) return "em_aberto";
  if (daysOverdue <= BOLETO_LATE_GRACE_DAYS) return "atrasado";
  return "vencido";
}

/**
 * Escolhe o "boleto atual" de um conjunto: o boleto em aberto mais antigo que ja
 * venceu (cobranca pendente mais critica); na ausencia de vencidos, o proximo a
 * vencer; se todos estiverem pagos, a ultima parcela.
 */
export function pickCurrentBoleto<
  T extends { dueDate: Date | string; paidAt?: Date | string | null; installmentNumber: number },
>(boletos: T[], today: Date | string = new Date()): T | null {
  if (boletos.length === 0) return null;

  const sorted = [...boletos].sort(
    (a, b) => a.installmentNumber - b.installmentNumber
  );
  const unpaid = sorted.filter(boleto => !boleto.paidAt);
  if (unpaid.length === 0) return sorted[sorted.length - 1];

  const todayDay = toDayNumber(today);
  const overdue = unpaid.filter(
    boleto => toDayNumber(boleto.dueDate) < todayDay
  );
  if (overdue.length > 0) return overdue[0];

  return unpaid[0];
}

export function getBoletoSetStatus(
  boletos: { dueDate: Date | string; paidAt?: Date | string | null; installmentNumber: number }[],
  today: Date | string = new Date()
): RentalBoletoTemporalStatus | null {
  const current = pickCurrentBoleto(boletos, today);
  return current ? getBoletoTemporalStatus(current, today) : null;
}

export const RENTAL_BOLETO_TEMPORAL_STATUS_LABELS: Record<
  RentalBoletoTemporalStatus,
  string
> = {
  pago: "Pago",
  em_aberto: "Em aberto",
  atrasado: "Atrasado",
  vencido: "Vencido",
};
