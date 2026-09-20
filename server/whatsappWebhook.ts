import type { Express, Request, Response } from "express";

/**
 * Webhooks públicos que recebem eventos do BotConversa.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 1) POST /api/webhooks/botconversa — LEAD NOVO                            │
 * │                                                                          │
 * │  Configuração no BotConversa: crie um fluxo que dispara "ao receber       │
 * │  mensagem" e adicione um nó "Webhook" chamando:                          │
 * │                                                                          │
 * │    POST https://SEU_DOMINIO/api/webhooks/botconversa                     │
 * │    Header:  X-Webhook-Secret: <valor do BOTCONVERSA_WEBHOOK_SECRET>      │
 * │    Body:    JSON com pelo menos { phone, full_name?, message?,          │
 * │             subscriber_id? }                                             │
 * │                                                                          │
 * │  Cria/atualiza o lead, guarda o subscriber_id e aciona a roleta.         │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ 2) POST /api/webhooks/botconversa/attended — CORRETOR ATENDEU            │
 * │                                                                          │
 * │  Configuração no BotConversa: crie um fluxo que dispara "quando gerente  │
 * │  envia mensagem" e adicione um nó "Webhook" chamando:                    │
 * │                                                                          │
 * │    POST https://SEU_DOMINIO/api/webhooks/botconversa/attended            │
 * │    Header:  X-Webhook-Secret: <valor do BOTCONVERSA_WEBHOOK_SECRET>      │
 * │    Body:    JSON com pelo menos { subscriber_id }                        │
 * │                                                                          │
 * │  Marca o lead como atendido (attendedAt = agora, status = atendimento),  │
 * │  parando a fiscalização do SLA.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeTelefone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function validateSecret(req: Request, res: Response): boolean {
  const expected = (process.env.BOTCONVERSA_WEBHOOK_SECRET ?? "").trim();
  if (!expected) return true;
  const provided = String(
    req.headers["x-webhook-secret"] ??
      req.headers["X-Webhook-Secret"] ??
      req.query.secret ??
      ""
  ).trim();
  if (provided !== expected) {
    res.status(401).json({ ok: false, message: "invalid secret" });
    return false;
  }
  return true;
}

async function handleNewLead(req: Request, res: Response) {
  if (!validateSecret(req, res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;

  const phoneRaw =
    pickString(body, ["phone", "telefone", "whatsapp", "wa_number"]) ??
    pickString(body, ["contact_phone", "subscriber_phone"]);
  const telefone = phoneRaw ? normalizeTelefone(phoneRaw) : null;

  if (!telefone) {
    res
      .status(400)
      .json({ ok: false, message: "campo phone/telefone ausente ou inválido" });
    return;
  }

  const nome =
    pickString(body, ["full_name", "name", "nome", "first_name"]) ??
    pickString(body, ["last_name"]) ??
    `Contato ${telefone}`;

  const mensagem =
    pickString(body, ["message", "mensagem", "last_message", "text"]) ?? "";

  const subscriberId = pickString(body, ["id", "subscriber_id", "contact_id"]);

  try {
    const {
      getLeadByTelefone,
      createLead,
      updateLead,
      createLeadInteraction,
    } = await import("./db");
    const { distributeLeadToRoleta } = await import("./_core/roleta");

    let leadId: number;
    const existing = await getLeadByTelefone(telefone);

    if (existing) {
      leadId = existing.id;
      const nextObs = mensagem
        ? [existing.observacao ?? "", `[BotConversa] ${mensagem}`]
            .filter(Boolean)
            .join("\n")
        : existing.observacao;
      await updateLead(existing.id, {
        nome: existing.nome && existing.nome !== `Contato ${telefone}`
          ? existing.nome
          : nome,
        origem: existing.origem ?? "whatsapp",
        observacao: nextObs,
        // Só grava/atualiza se o valor veio no payload.
        ...(subscriberId ? { botconversaSubscriberId: subscriberId } : {}),
      });
      await createLeadInteraction({
        idLead: existing.id,
        idUsuario: null,
        eventType: "botconversa_message",
        message: mensagem
          ? `Nova mensagem via BotConversa: ${mensagem.slice(0, 500)}`
          : `Ping via BotConversa (subscriber ${subscriberId ?? "?"}).`,
      });
    } else {
      const [created] = await createLead({
        nome,
        telefone,
        origem: "whatsapp",
        status: "novo",
        botconversaSubscriberId: subscriberId ?? null,
        observacao: mensagem
          ? `[BotConversa] ${mensagem}`
          : null,
      });
      leadId = created.id;
      await createLeadInteraction({
        idLead: leadId,
        idUsuario: null,
        eventType: "lead_created_botconversa",
        message: `Lead criado a partir de mensagem no BotConversa.`,
      });
    }

    const assignedTo = await distributeLeadToRoleta({
      id: leadId,
      nome,
    });

    res.status(200).json({
      ok: true,
      leadId,
      assignedTo,
      created: !existing,
    });
  } catch (err) {
    console.error("[botconversa-webhook] erro:", err);
    res
      .status(500)
      .json({ ok: false, message: err instanceof Error ? err.message : "erro" });
  }
}

async function handleAttended(req: Request, res: Response) {
  if (!validateSecret(req, res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;

  const subscriberId = pickString(body, [
    "subscriber_id",
    "id",
    "contact_id",
  ]);
  if (!subscriberId) {
    res
      .status(400)
      .json({ ok: false, message: "campo subscriber_id ausente" });
    return;
  }

  // Opcional: identidade de quem atendeu, apenas para o histórico.
  const managerName = pickString(body, ["manager_name", "agent_name"]);
  const managerId = pickString(body, ["manager_id", "agent_id"]);

  try {
    const {
      getLeadByBotconversaSubscriberId,
      updateLead,
      createLeadInteraction,
    } = await import("./db");

    const lead = await getLeadByBotconversaSubscriberId(subscriberId);
    if (!lead) {
      res
        .status(404)
        .json({ ok: false, message: "lead com esse subscriber_id não encontrado" });
      return;
    }

    if (lead.attendedAt) {
      // Idempotência: se já foi atendido antes, só confirma. Evita
      // resetar o histórico se o BotConversa reenviar o evento.
      res.status(200).json({ ok: true, leadId: lead.id, alreadyAttended: true });
      return;
    }

    const now = new Date();
    await updateLead(lead.id, {
      attendedAt: now,
      status: "atendimento",
    });

    const who = managerName || managerId || "corretor";
    await createLeadInteraction({
      idLead: lead.id,
      idUsuario: null,
      eventType: "botconversa_attended",
      message: `Lead atendido no BotConversa por ${who}. Fiscalização do SLA encerrada.`,
    });

    res.status(200).json({ ok: true, leadId: lead.id, attendedAt: now.toISOString() });
  } catch (err) {
    console.error("[botconversa-webhook-attended] erro:", err);
    res
      .status(500)
      .json({ ok: false, message: err instanceof Error ? err.message : "erro" });
  }
}

export function registerBotConversaWebhook(app: Express) {
  app.post("/api/webhooks/botconversa", (req, res) => {
    void handleNewLead(req, res);
  });
  app.post("/api/webhooks/botconversa/attended", (req, res) => {
    void handleAttended(req, res);
  });
}
