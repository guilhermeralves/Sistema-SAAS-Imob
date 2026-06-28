/* Helpers de Web Push no navegador: checagem de suporte, inscrição e cancelamento. */

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** True quando o navegador suporta service worker + push + Notification API. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Estado atual da permissão de notificações ("default" | "granted" | "denied"). */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof Notification === "undefined") return null;
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return await navigator.serviceWorker.ready;
}

/** Retorna a inscrição existente (se houver) sem pedir permissão. */
export async function getExistingSubscription(): Promise<PushSubscriptionPayload | null> {
  if (!isPushSupported()) return null;
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? (subscription.toJSON() as PushSubscriptionPayload) : null;
}

/**
 * Pede permissão (se necessário) e cria/recupera a inscrição de push.
 * Lança erro se a permissão for negada.
 */
export async function subscribeToPush(
  vapidPublicKey: string
): Promise<PushSubscriptionPayload> {
  if (!isPushSupported()) {
    throw new Error("Este dispositivo não suporta notificações push.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificações negada.");
  }

  const registration = await getRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  return subscription.toJSON() as PushSubscriptionPayload;
}

/** Cancela a inscrição no navegador e retorna o endpoint removido (se havia). */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription.toJSON() as PushSubscriptionPayload;
  await subscription.unsubscribe();
  return endpoint ?? null;
}
