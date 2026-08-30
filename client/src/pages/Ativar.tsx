import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Tela de ativação da instalação. Consome um código emitido pelo NOXILON
 * Central, valida via API pública e persiste o token JWT localmente.
 */
export default function Ativar() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [code, setCode] = useState("");

  const { data: status } = trpc.license.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const activate = trpc.license.activate.useMutation({
    onSuccess: async () => {
      await utils.license.status.invalidate();
      toast.success("Instalação ativada com sucesso!");
      setTimeout(() => setLocation("/"), 500);
    },
    onError: e => toast.error(e.message),
  });

  // Se já está ativado, manda embora
  useEffect(() => {
    if (status?.activated) {
      setLocation("/");
    }
  }, [status?.activated, setLocation]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-900 dark:to-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#101070] text-white">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Ativar instalação</CardTitle>
          <CardDescription>
            Informe o código de licença fornecido pela NOXILON para liberar
            o acesso ao sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              if (!code.trim()) return;
              activate.mutate({ code: code.trim() });
            }}
          >
            <div>
              <Label>Código de ativação</Label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="NX-XXXX-XXXX-XXXX"
                autoFocus
                className="font-mono uppercase tracking-wider"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Formato: NX seguido de 3 blocos de 4 caracteres.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#101070] hover:bg-[#080848]"
              disabled={activate.isPending || !code.trim()}
            >
              {activate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando com NOXILON…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Ativar
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Não recebeu um código? Entre em contato com o suporte NOXILON.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
