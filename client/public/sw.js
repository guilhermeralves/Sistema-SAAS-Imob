/* Service Worker da AFG Imobiliária — responsável por receber e exibir
   notificações Web Push e abrir a tela certa ao clicar. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

/* Fetch handler mínimo (sem cache): o Chrome exige um listener de fetch
   registrado para considerar o site instalável como PWA no Android. Não
   interceptamos as respostas — deixamos o navegador seguir o fluxo padrão. */
self.addEventListener("fetch", () => {});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { title: "AFG Imobiliária", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "AFG Imobiliária";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    // Por padrão reavisa quando há tag; a roleta pode pedir silent/renotify
    // explícitos para atualizar a posição sem incomodar a cada mudança.
    renotify:
      typeof data.renotify === "boolean" ? data.renotify : Boolean(data.tag),
    silent: Boolean(data.silent),
    // Mantém a notificação fixa na bandeja (ex.: posição na roleta) até o
    // usuário interagir. Suporte varia por plataforma (melhor no Android).
    requireInteraction: Boolean(data.requireInteraction),
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* Permite que a página peça para fechar notificações já visualizadas.
   Ex.: ao abrir a tela de Tarefas e Eventos, fechamos as notificações
   pendentes de tarefas/eventos (tag "task-...") da bandeja do dispositivo. */
self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type !== "clear-notifications") return;

  event.waitUntil(
    self.registration.getNotifications().then(notifications => {
      for (const notification of notifications) {
        const tag = notification.tag || "";
        const matches = data.tag
          ? tag === data.tag
          : data.tagPrefix
            ? tag.startsWith(data.tagPrefix)
            : true;
        if (matches) notification.close();
      }
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
