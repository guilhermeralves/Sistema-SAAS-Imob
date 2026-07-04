import { useState } from "react";
import { Link, useRoute } from "wouter";
import Layout from "@/components/Layout";
import SelfieCapture from "@/components/SelfieCapture";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function ValidarVistoria() {
  const [, params] = useRoute("/validar-vistoria/:token");
  const token = params?.token ?? "";
  const utils = trpc.useUtils();
  const [selfie, setSelfie] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { data, isLoading } = trpc.rentalProposals.inspectionValidationByToken.useQuery(
    { token },
    { enabled: token.length > 0 }
  );

  const submitMutation =
    trpc.rentalProposals.submitInspectionValidation.useMutation({
      onSuccess: async () => {
        setDone(true);
        await utils.rentalProposals.inspectionValidationByToken.invalidate({
          token,
        });
      },
      onError: error =>
        toast.error(error.message || "Não foi possível concluir a validação."),
    });

  const content = () => {
    if (isLoading) {
      return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
    }
    if (!data || !data.found) {
      return (
        <p className="text-sm text-slate-600">
          Link de validação inválido ou expirado. Solicite um novo link à
          imobiliária.
        </p>
      );
    }
    if (done || data.alreadyValidated) {
      return (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
          <p className="text-lg font-semibold text-slate-900">
            Validação concluída!
          </p>
          <p className="text-sm text-slate-600">
            Obrigado. Sua confirmação do estado do imóvel foi registrada.
          </p>
          <Button asChild className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800">
            <Link href="/area-cliente">
              <a>Ir para a Área do Cliente</a>
            </Link>
          </Button>
        </div>
      );
    }
    if (!data.canValidate) {
      return (
        <p className="text-sm text-slate-600">
          A validação ainda não está disponível
          {data.laudoAvailable
            ? " para esta etapa."
            : ": o laudo da vistoria ainda não foi anexado."}{" "}
          Tente novamente mais tarde.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Você está validando como <strong>{data.partyLabel}</strong> o estado do
          imóvel <strong>{data.propertyLabel}</strong>
          {data.referenceCode ? ` (${data.referenceCode})` : ""}. Tire uma foto do
          seu rosto para concluir.
        </div>

        <SelfieCapture onCapture={setSelfie} />

        <Button
          type="button"
          className="w-full gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
          disabled={!selfie || submitMutation.isPending}
          onClick={() => {
            if (!selfie) return;
            submitMutation.mutate({ token, selfie });
          }}
        >
          <ShieldCheck className="h-4 w-4" />
          {submitMutation.isPending ? "Validando..." : "Confirmar validação"}
        </Button>
      </div>
    );
  };

  return (
    <Layout>
      <div className="container max-w-xl py-8 md:py-12">
        <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              Validação de vistoria
            </CardTitle>
            <CardDescription>
              Confirme o estado do imóvel com uma foto do seu rosto (selfie).
            </CardDescription>
          </CardHeader>
          <CardContent>{content()}</CardContent>
        </Card>
      </div>
    </Layout>
  );
}
