import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, CheckCheck, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";

function formatRelative(date: Date | string) {
  try {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR,
    });
  } catch {
    return "";
  }
}

export default function NotificationBell() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data } = trpc.notifications.history.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.history.invalidate(),
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unreadCount > 0) {
      markAllRead.mutate();
    }
  };

  const handleItemClick = (url: string | null) => {
    setOpen(false);
    if (url) setLocation(url);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full border-0 bg-transparent p-0 text-slate-600 shadow-none outline-none ring-0 hover:bg-emerald-50/60 hover:text-emerald-900 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-slate-200 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200"
          aria-label="Abrir notificações"
          title="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-semibold text-white">
              {Math.min(unreadCount, 99)}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(22rem,70vw)] overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg dark:border-white/15"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Notificações
          </p>
          <div className="flex items-center gap-3">
            {items.length > 0 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline dark:text-emerald-300"
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar lidas
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="Fechar notificações"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[min(22rem,50vh)] overflow-y-auto overflow-x-hidden overscroll-contain">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação por aqui ainda.
            </p>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.url)}
                className={`flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left transition hover:bg-emerald-50/60 dark:hover:bg-emerald-500/10 ${
                  item.isRead === 0 ? "bg-emerald-50/40 dark:bg-emerald-500/5" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.isRead === 0 ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                  ) : null}
                  <span className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.title}
                  </span>
                </div>
                <span className="break-words text-sm leading-snug text-slate-600 dark:text-slate-300">
                  {item.body}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(item.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
