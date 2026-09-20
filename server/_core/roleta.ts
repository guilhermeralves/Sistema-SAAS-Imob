/**
 * Serviço da Roleta de Atendimentos.
 *
 * Concentra as notificações push da roleta e a distribuição automática de leads
 * em rodízio (round-robin). Fica fora de `routers.ts` para poder ser reutilizado
 * também pelo scheduler de SLA (`leadSla.ts`) sem import circular.
 */
import { isBusinessTime } from "./businessHours";

/**
 * Notifica o corretor de que um novo lead foi direcionado a ele (push + sino).
 * Best-effort: nunca lança, pois não pode quebrar o fluxo do lead.
 */
export async function notifyBrokerLeadAssigned(
  brokerUserId: number,
  leadName: string | null | undefined,
  leadId: number
) {
  const title = "Novo Lead";
  const body = leadName
    ? `O Lead ${leadName} foi direcionado para o seu Atendimento`
    : "Um novo Lead foi direcionado para o seu Atendimento";
  const url = "/crm";

  try {
    const { createUserNotification } = await import("../db");
    await createUserNotification({ userId: brokerUserId, title, body, url });
  } catch (error) {
    console.warn("[notify] Falha ao salvar histórico de notificação:", error);
  }

  try {
    const { sendPushToUser } = await import("./push");
    await sendPushToUser(brokerUserId, {
      title,
      body,
      url,
      tag: `lead-${leadId}`,
    });
  } catch (error) {
    console.warn("[push] Falha ao notificar corretor do lead:", error);
  }
}

/**
 * Atualiza o push "fixo" de posição de todos os participantes ativos de uma
 * fila. Reutiliza a mesma `tag` por fila para substituir (atualizar) a
 * notificação na bandeja a cada mudança de posição. Silencioso e sticky.
 */
export async function notifyQueuePositions(queueId: number) {
  try {
    const { getAttendanceQueueById, getAttendanceQueueParticipants } =
      await import("../db");
    const queue = await getAttendanceQueueById(queueId);
    if (!queue) return;

    const participants = await getAttendanceQueueParticipants(queueId);
    const { sendPushToUser } = await import("./push");
    const tag = `roleta-fila-${queueId}`;

    await Promise.all(
      participants.map(async (participant, index) => {
        const position = index + 1;
        const isNext = position === 1;
        await sendPushToUser(participant.userId, {
          title: isNext ? "Agora é sua vez!" : queue.name,
          body: isNext
            ? "Você receberá o próximo atendimento!"
            : `Você está participando da Roleta • Sua posição na fila: ${position}`,
          url: "/roleta-atendimentos",
          tag,
          renotify: true,
          requireInteraction: true,
        });
      })
    );
  } catch (error) {
    console.warn("[roleta] Falha ao atualizar posições da fila:", error);
  }
}

/**
 * Substitui o push fixo do corretor que saiu por uma notificação dispensável,
 * para que a "posição fixa" não fique presa na bandeja. Best-effort.
 */
export async function notifyQueueLeft(queueId: number, userId: number) {
  try {
    const { getAttendanceQueueById } = await import("../db");
    const queue = await getAttendanceQueueById(queueId);
    const { sendPushToUser } = await import("./push");
    await sendPushToUser(userId, {
      title: queue?.name ?? "Roleta de Atendimentos",
      body: "Você saiu da roleta de atendimentos.",
      url: "/roleta-atendimentos",
      tag: `roleta-fila-${queueId}`,
      requireInteraction: false,
    });
  } catch (error) {
    console.warn("[roleta] Falha ao notificar saída da fila:", error);
  }
}

type DistributableLead = {
  id: number;
  nome: string | null;
};

/**
 * Direciona um lead ao próximo corretor da fila padrão (round-robin) e o
 * reposiciona para o fim da fila. Notifica o corretor (novo lead) e atualiza a
 * posição de todos. Retorna o ID do corretor escolhido, ou `null` quando não é
 * possível distribuir (sem fila padrão, fora do horário comercial ou fila
 * vazia) — nesse caso o SLA existente cuida do lead como fallback.
 */
export async function distributeLeadToRoleta(
  lead: DistributableLead
): Promise<number | null> {
  try {
    const {
      getDefaultAttendanceQueue,
      getAttendanceQueueParticipants,
      rotateAttendanceQueueParticipantToBack,
      updateLead,
      createLeadInteraction,
    } = await import("../db");

    const queue = await getDefaultAttendanceQueue();
    if (!queue) return null;

    if (queue.businessHoursOnly === 1 && !isBusinessTime(new Date())) {
      return null;
    }

    const participants = await getAttendanceQueueParticipants(queue.id);
    if (participants.length === 0) return null;

    const next = participants[0];

    await updateLead(lead.id, {
      idResponsavel: next.userId,
      status: "novo",
      assignedAt: new Date(),
      attendedAt: null,
      assignmentSlaNotifiedAt: null,
      // Distribuição efetivada; limpa o agendamento futuro.
      distributeAfter: null,
    });

    await rotateAttendanceQueueParticipantToBack(queue.id, next.userId);

    await createLeadInteraction({
      idLead: lead.id,
      idUsuario: null,
      eventType: "lead_assigned_roleta",
      message: `Lead direcionado automaticamente pela roleta "${queue.name}" ao responsável ID ${next.userId}.`,
    });

    await notifyBrokerLeadAssigned(next.userId, lead.nome, lead.id);
    await notifyQueuePositions(queue.id);

    // Transfere a conversa no painel do BotConversa (se aplicável). Só faz
    // sentido quando o lead veio do BotConversa (tem subscriber_id) E o
    // corretor está mapeado a um manager BotConversa. Falhas viram evento
    // no timeline mas não bloqueiam a distribuição.
    await maybeTransferConversationInBotConversa(lead.id, next.userId);

    return next.userId;
  } catch (error) {
    console.warn("[roleta] Falha ao distribuir lead pela roleta:", error);
    return null;
  }
}

async function maybeTransferConversationInBotConversa(
  leadId: number,
  brokerUserId: number
) {
  try {
    const { getLeadById, getUserById, createLeadInteraction } = await import(
      "../db"
    );

    const [freshLead, broker] = await Promise.all([
      getLeadById(leadId),
      getUserById(brokerUserId),
    ]);

    const subscriberId = freshLead?.botconversaSubscriberId?.trim();
    const managerId = broker?.botconversaManagerId?.trim();

    if (!subscriberId || !managerId) return;

    const { changeConversationStatus } = await import("./botconversaClient");
    const result = await changeConversationStatus({
      subscriberId,
      managerId,
      status: "open",
    });

    await createLeadInteraction({
      idLead: leadId,
      idUsuario: null,
      eventType: result.ok ? "botconversa_transferred" : "botconversa_transfer_failed",
      message: result.ok
        ? `Conversa transferida no BotConversa ao manager ${managerId} (${broker?.name ?? "corretor"}).`
        : `Falha ao transferir conversa no BotConversa: ${result.status} ${result.message}`,
    });
  } catch (error) {
    console.warn("[roleta] Erro ao integrar com BotConversa:", error);
  }
}
