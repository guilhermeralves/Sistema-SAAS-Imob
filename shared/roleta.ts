/**
 * Contratos compartilhados da Roleta de Atendimentos.
 *
 * A roleta distribui leads entre corretores em uma fila (round-robin): quem está
 * na frente recebe o próximo atendimento e vai para o fim da fila. Uma "fila"
 * (attendanceQueue) carrega as regras de ordem/tempo; corretores com permissão
 * podem entrar e sair da fila. Regras e permissões são configuradas pelo admin.
 *
 * Mantém apenas tipos/constantes puros (sem DOM, Node, Express ou banco), pois é
 * consumido tanto pelo backend quanto pelo frontend.
 */

/** Estratégias de ordenação da fila. Hoje só round-robin; espaço para evoluir. */
export const ATTENDANCE_QUEUE_ORDER_STRATEGIES = ["round_robin", "manual"] as const;
export type AttendanceQueueOrderStrategy =
  (typeof ATTENDANCE_QUEUE_ORDER_STRATEGIES)[number];

export const ATTENDANCE_QUEUE_ORDER_STRATEGY_LABELS: Record<
  AttendanceQueueOrderStrategy,
  string
> = {
  round_robin: "Rodízio (round-robin)",
  manual: "Manual",
};

/** Limites de validação usados nos schemas do backend e nos formulários. */
export const ATTENDANCE_QUEUE_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  descriptionMax: 500,
  timeoutMinutesMin: 1,
  timeoutMinutesMax: 24 * 60,
} as const;

/**
 * Regras padrão de uma nova fila. Espelham o SLA já vigente em `leadSla.ts`
 * (15 min para direcionar, 40 min para atender) para manter comportamento
 * consistente com o que o sistema já faz hoje.
 */
export const DEFAULT_ATTENDANCE_QUEUE_RULES = {
  orderStrategy: "round_robin" as AttendanceQueueOrderStrategy,
  assignmentTimeoutMinutes: 15,
  attendanceTimeoutMinutes: 40,
  businessHoursOnly: true,
} as const;

export function isAttendanceQueueOrderStrategy(
  value: unknown
): value is AttendanceQueueOrderStrategy {
  return (
    typeof value === "string" &&
    (ATTENDANCE_QUEUE_ORDER_STRATEGIES as readonly string[]).includes(value)
  );
}
