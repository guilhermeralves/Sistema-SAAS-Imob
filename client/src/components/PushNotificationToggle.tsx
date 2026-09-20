import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import {
  getExistingSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

type Variant = "menu" | "button";

type PushNotificationToggleProps = {
  /** "menu" (padrão) renderiza como DropdownMenuItem — só use dentro de
   *  um <DropdownMenu>. "button" renderiza como Button avulso. */
  variant?: Variant;
};

export default function PushNotificationToggle({
  variant = "menu",
}: PushNotificationToggleProps) {
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

  // Explica o motivo em vez de sumir do menu — ajuda quem tá tentando
  // ativar sem saber por que não aparece.
  const unavailableReason = (() => {
    if (!supported) return "Este navegador não suporta notificações push.";
    if (!config?.enabled) return "Push desativado no servidor (VAPID).";
    if (!config?.publicKey) return "Chave pública VAPID ausente.";
    return null;
  })();

  if (unavailableReason) {
    if (variant === "button") {
      return (
        <p className="text-xs text-muted-foreground">
          <BellOff className="mr-1 inline h-3 w-3" /> {unavailableReason}
        </p>
      );
    }
    return (
      <DropdownMenuItem
        disabled
        className="cursor-not-allowed gap-2 text-muted-foreground"
      >
        <BellOff className="h-4 w-4" />
        {unavailableReason}
      </DropdownMenuItem>
    );
  }

  const permissionDenied = getNotificationPermission() === "denied";

  const handleEnable = async () => {
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

  const handleDisable = async () => {
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

  const handleTest = async () => {
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

  const handleBlockedInfo = () => {
    toast.info(
      "As notificações estão bloqueadas. Abra as configurações do site no navegador (ou Ajustes → Notificações → New no iPhone) e mude para Permitir.",
      { duration: 8000 }
    );
  };

  // ── Variante BUTTON (uso standalone, fora de DropdownMenu) ─────────
  if (variant === "button") {
    if (permissionDenied && !subscribed) {
      return (
        <Button
          type="button"
          variant="outline"
          onClick={handleBlockedInfo}
          className="gap-2"
        >
          <BellOff className="h-4 w-4" />
          Notificações bloqueadas — toque para ajuda
        </Button>
      );
    }
    if (subscribed) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDisable}
            disabled={busy}
            className="gap-2"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4 text-emerald-600" />
            )}
            Notificações ativas
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleTest}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Testar
          </Button>
        </div>
      );
    }
    return (
      <Button
        type="button"
        onClick={handleEnable}
        disabled={busy}
        className="gap-2"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        Ativar notificações
      </Button>
    );
  }

  // ── Variante MENU (padrão — dentro de DropdownMenu) ────────────────
  const preventDefault = (fn: () => void) => (event: Event) => {
    event.preventDefault();
    void fn();
  };

  if (permissionDenied && !subscribed) {
    return (
      <DropdownMenuItem
        onSelect={preventDefault(handleBlockedInfo)}
        className="cursor-pointer gap-2"
      >
        <BellOff className="h-4 w-4" />
        Notificações bloqueadas — toque para ajuda
      </DropdownMenuItem>
    );
  }

  return (
    <>
      {subscribed ? (
        <>
          <DropdownMenuItem
            onSelect={preventDefault(handleDisable)}
            className="cursor-pointer gap-2"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4 text-emerald-600" />
            )}
            Notificações ativas
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={preventDefault(handleTest)}
            className="cursor-pointer gap-2"
          >
            <Send className="h-4 w-4" />
            Enviar notificação de teste
          </DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem
          onSelect={preventDefault(handleEnable)}
          className="cursor-pointer gap-2"
        >
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
