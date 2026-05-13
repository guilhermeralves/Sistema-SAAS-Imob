import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type UnsavedChangesGuardOptions = {
  isDirty: boolean;
  shouldAllowPath?: (path: string) => boolean;
};

export function useUnsavedChangesNavigationGuard({
  isDirty,
  shouldAllowPath,
}: UnsavedChangesGuardOptions) {
  const [, setLocation] = useLocation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) return;
      if (shouldAllowPath?.(nextPath)) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingPath(nextPath);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [isDirty, shouldAllowPath]);

  const requestNavigation = (path: string, options?: { allow?: boolean }) => {
    if (isDirty && !options?.allow && !shouldAllowPath?.(path)) {
      setPendingPath(path);
      return;
    }

    setLocation(path);
  };

  const UnsavedChangesDialog = (
    <Dialog open={pendingPath !== null} onOpenChange={open => !open && setPendingPath(null)}>
      <DialogContent className="!w-[420px] !max-w-[calc(100%-2rem)] rounded-[24px] border-white/80 bg-[#f7f6f2] p-4 sm:!max-w-[420px] sm:p-5">
        <DialogHeader>
          <DialogTitle>Alterações não salvas</DialogTitle>
          <DialogDescription>
            Você alterou informações nesta página. Se sair agora, as alterações não salvas serão perdidas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-white"
            onClick={() => setPendingPath(null)}
          >
            Continuar editando
          </Button>
          <Button
            type="button"
            className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
            onClick={() => {
              const nextPath = pendingPath;
              setPendingPath(null);
              if (nextPath) setLocation(nextPath);
            }}
          >
            Sair sem salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return {
    requestNavigation,
    UnsavedChangesDialog,
  };
}
