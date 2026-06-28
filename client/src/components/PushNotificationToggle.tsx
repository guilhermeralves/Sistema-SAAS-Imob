import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import {
  getExistingSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

export default function PushNotificationToggle() {
  const supported = isPushSupported();
  const { data: config } = trpc.notifications.config.useQuery(undefined, {
    enabled: supported,
  });

  const subscribeMutation = trpc.notifications.subscribe.useMutation();
  const unsubscribeMutation = trpc.notifications.unsubscribe.useMutation();
  const sendTestMutation = trpc.notifications.sendTest.useMutation();

  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    getExistingSubscription()
      .then(sub => {
        setSubscribed(Boolean(sub));
        // Reenvia a inscrição existente ao servidor (idempotente). Cobre o caso
        // de o navegador ter a inscrição mas o servidor tê-la perdido.
        if (sub?.endpoint && sub.keys?.p256dh && sub.keys?.auth) {
          subscribeMutation.mutate({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            userAgent: navigator.userAgent.slice(0, 255),
          });
        }
      })
      .catch(() => setSubscribed(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  if (!supported || !config?.enabled || !config.publicKey) {
    return null;
  }

  const permissionDenied = getNotificationPermission() === "denied";

  const handleEnable = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const subscription = await subscribeToPush(config.publicKey);
      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent: navigator.userAgent.slice(0, 255),
      });
      setSubscribed(true);
      toast.success("Notificações ativadas neste dispositivo.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar as notificações."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) {
        await unsubscribeMutation.mutateAsync({ endpoint });
      }
      setSubscribed(false);
      toast.success("Notificações desativadas neste dispositivo.");
    } catch {
      toast.error("Não foi possível desativar as notificações.");
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async (event: Event) => {
    event.preventDefault();
    try {
      const result = await sendTestMutation.mutateAsync();
      if (result.sent > 0) {
        toast.success("Notificação de teste enviada!");
      } else {
        toast.error(
          "Nenhum dispositivo recebeu. Reative as notificações e tente de novo."
        );
      }
    } catch {
      toast.error("Falha ao enviar a notificação de teste.");
    }
  };

  const handleBlockedInfo = (event: Event) => {
    event.preventDefault();
    toast.info(
      "As notificações estão bloqueadas. Abra as configurações do site no navegador (ou Ajustes → Notificações → AFG no iPhone) e mude para Permitir.",
      { duration: 8000 }
    );
  };

  if (permissionDenied && !subscribed) {
    return (
      <DropdownMenuItem onSelect={handleBlockedInfo} className="cursor-pointer gap-2">
        <BellOff className="h-4 w-4" />
        Notificações bloqueadas — toque para ajuda
      </DropdownMenuItem>
    );
  }

  return (
    <>
      {subscribed ? (
        <>
          <DropdownMenuItem onSelect={handleDisable} className="cursor-pointer gap-2">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4 text-emerald-600" />
            )}
            Notificações ativas
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleTest} className="cursor-pointer gap-2">
            <Send className="h-4 w-4" />
            Enviar notificação de teste
          </DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem onSelect={handleEnable} className="cursor-pointer gap-2">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Ativar notificações
        </DropdownMenuItem>
      )}
    </>
  );
}
