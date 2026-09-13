import type { Express, Request, Response } from "express";

/**
 * Webhook público que recebe eventos do BotConversa. Configuração no
 * BotConversa: crie um fluxo que dispara "ao receber mensagem" e
 * adicione um nó "Webhook" chamando:
 *
 *   POST https://SEU_DOMINIO/api/webhooks/botconversa
 *   Header:  X-Webhook-Secret: <valor do BOTCONVERSA_WEBHOOK_SECRET no .env>
 *   Body:    JSON com pelo menos { phone, full_name?, message? }
 *
 * O handler:
 *   1. Valida o secret (rejeita 401 se não bater);
 *   2. Extrai telefone/nome/mensagem (aceita várias chaves comuns);
 *   3. Reusa lead existente por telefone ou cria um novo;
 *   4. Chama distributeLeadToRoleta — assumido corretor, notifica push,
 *      registra interação. Se não há fila padrão configurada, o lead
 *      fica sem responsável e o SLA existente cuida como fallback.
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

async function handle(req: Request, res: Response) {
  const expected = (process.env.BOTCONVERSA_WEBHOOK_SECRET ?? "").trim();
  if (expected) {
    const provided = String(
      req.headers["x-webhook-secret"] ??
        req.headers["X-Webhook-Secret"] ??
        req.query.secret ??
        ""
    ).trim();
    if (provided !== expected) {
      res.status(401).json({ ok: false, message: "invalid secret" });
      return;
    }
  }

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
      // Só atualiza observação/nome se veio algo novo.
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
        observacao: mensagem
          ? `[BotConversa] ${mensagem}${subscriberId ? `\n(subscriber_id: ${subscriberId})` : ""}`
          : subscriberId
            ? `subscriber_id BotConversa: ${subscriberId}`
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

    // Aciona a roleta — assigna ao próximo, notifica push, atualiza fila.
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

export function registerBotConversaWebhook(app: Express) {
  app.post("/api/webhooks/botconversa", (req, res) => {
    void handle(req, res);
  });
}
