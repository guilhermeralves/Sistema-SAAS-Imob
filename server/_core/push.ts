import webpush from "web-push";
import { ENV } from "./env";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!ENV.vapidPublicKey || !ENV.vapidPrivateKey) return false;
  webpush.setVapidDetails(
    ENV.vapidSubject || "mailto:contato@new.com",
    ENV.vapidPublicKey,
    ENV.vapidPrivateKey
  );
  configured = true;
  return true;
}

/** Indica se as chaves VAPID estão configuradas (push habilitado no servidor). */
export function isPushConfigured(): boolean {
  return Boolean(ENV.vapidPublicKey && ENV.vapidPrivateKey);
}

/** Chave pública VAPID que o front usa para inscrever o navegador. */
export function getVapidPublicKey(): string {
  return ENV.vapidPublicKey;
}

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Atualiza silenciosamente (sem som/vibração) — usado no push de posição da roleta. */
  silent?: boolean;
  /** Reavisa (som/vibração) mesmo reutilizando a mesma tag. */
  renotify?: boolean;
  /** Mantém a notificação fixa até o usuário interagir (sticky). */
  requireInteraction?: boolean;
};

/**
 * Envia uma notificação push para todos os dispositivos inscritos de um usuário.
 * Remove automaticamente inscrições expiradas (404/410). Nunca lança — retorna
 * a contagem de envios para o chamador decidir um fallback (ex: e-mail).
 */
export async function sendPushToUser(
  userId: number,
  message: PushMessage
): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };

  const { getPushSubscriptionsByUser, deletePushSubscriptionByEndpoint } =
    await import("../db");

  const subscriptions = await getPushSubscriptionsByUser(userId);
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const payload = JSON.stringify(message);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async subscription => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscriptionByEndpoint(subscription.endpoint).catch(
            () => {}
          );
        } else {
          console.warn(
            "[push] Falha ao enviar notificação:",
            statusCode,
            (error as { body?: string; message?: string })?.body ||
              (error as Error)?.message
          );
        }
      }
    })
  );

  return { sent, failed };
}
