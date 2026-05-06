import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatStoredDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Building2, Shield } from "lucide-react";
import { toast } from "sonner";

const FIELD_CLASS = "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

type LegalFormState = {
  inscricaoImobiliaria: string;
  matriculaRegistro: string;
  cartorioRegistro: string;
  registroMunicipal: string;
  informacoesLegais: string;
  observacoesJuridicas: string;
};

const EMPTY_FORM: LegalFormState = {
  inscricaoImobiliaria: "",
  matriculaRegistro: "",
  cartorioRegistro: "",
  registroMunicipal: "",
  informacoesLegais: "",
  observacoesJuridicas: "",
};

export default function AdminPropertyDetails() {
  const { user, loading } = useAuth();
  const [, params] = useRoute("/admin/imoveis/:id");
  const propertyId = useMemo(() => {
    if (!params?.id) return 0;
    const parsed = Number(params.id);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [params?.id]);

  const [form, setForm] = useState<LegalFormState>(EMPTY_FORM);
  const utils = trpc.useUtils();

  const propertyQuery = trpc.properties.getByIdAdmin.useQuery(
    { id: propertyId },
    {
      enabled: propertyId > 0,
    }
  );

  const updateLegalDetails = trpc.properties.updateLegalDetails.useMutation({
    onSuccess: async () => {
      toast.success("Ficha do imóvel atualizada com sucesso.");
      await utils.properties.getByIdAdmin.invalidate({ id: propertyId });
      await utils.properties.list.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel salvar a ficha do imovel.");
    },
  });

  useEffect(() => {
    const property = propertyQuery.data;
    if (!property) return;

    setForm({
      inscricaoImobiliaria: property.inscricaoImobiliaria ?? "",
      matriculaRegistro: property.matriculaRegistro ?? "",
      cartorioRegistro: property.cartorioRegistro ?? "",
      registroMunicipal: property.registroMunicipal ?? "",
      informacoesLegais: property.informacoesLegais ?? "",
      observacoesJuridicas: property.observacoesJuridicas ?? "",
    });
  }, [propertyQuery.data]);

  if (loading) {
    return (
      <Layout>
        <div className="container py-10">
          <div className="space-y-4">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="h-80 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user || user.role !== "administrativo") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Negado</h1>
          <p className="mb-6 text-muted-foreground">Esta área é exclusiva para administradores.</p>
          <Button asChild>
            <Link href="/admin">
              <a>Voltar para Administrativo</a>
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const property = propertyQuery.data;

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
        <div className="container space-y-6 py-8 md:py-10">
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild className="rounded-full bg-white/90 shadow-sm hover:bg-white">
              <Link href="/admin">
                <a className="inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </a>
              </Link>
            </Button>
          </div>

          {propertyQuery.isLoading ? (
            <div className="space-y-4">
              <div className="h-8 w-64 animate-pulse rounded bg-muted" />
              <div className="h-80 animate-pulse rounded bg-muted" />
            </div>
          ) : property ? (
            <>
              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                    Ficha do Imóvel
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Cadastro jurídico e legal do imóvel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{property.titulo}</p>
                  <p>
                    <span className="font-medium">Tipo:</span> {property.tipo} |{" "}
                    <span className="font-medium">Finalidade:</span> {property.finalidade}
                  </p>
                  <p>
                    <span className="font-medium">Endereço:</span> {property.endereco}, {property.numero || "s/n"} -{" "}
                    {property.bairro || "Sem bairro"}, {property.cidade}/{property.estado}
                  </p>
                  <p>
                    <span className="font-medium">Cadastro:</span> {formatStoredDate(property.createdAt)} |{" "}
                    <span className="font-medium">Status:</span> {property.status} |{" "}
                    <span className="font-medium">Lixeira:</span> {property.lixeira === 1 ? "Sim" : "Nao"}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">Dados legais e jurídicos</CardTitle>
                  <CardDescription className="text-slate-600">
                    Preencha as informações oficiais e registros do imóvel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="inscricaoImobiliaria">Inscrição imobiliária</Label>
                      <Input
                        id="inscricaoImobiliaria"
                        className={FIELD_CLASS}
                        value={form.inscricaoImobiliaria}
                        onChange={event => setForm(current => ({ ...current, inscricaoImobiliaria: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="matriculaRegistro">Matrícula do registro</Label>
                      <Input
                        id="matriculaRegistro"
                        className={FIELD_CLASS}
                        value={form.matriculaRegistro}
                        onChange={event => setForm(current => ({ ...current, matriculaRegistro: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cartorioRegistro">Cartório de registro</Label>
                      <Input
                        id="cartorioRegistro"
                        className={FIELD_CLASS}
                        value={form.cartorioRegistro}
                        onChange={event => setForm(current => ({ ...current, cartorioRegistro: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registroMunicipal">Registro municipal</Label>
                      <Input
                        id="registroMunicipal"
                        className={FIELD_CLASS}
                        value={form.registroMunicipal}
                        onChange={event => setForm(current => ({ ...current, registroMunicipal: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="informacoesLegais">Informações legais</Label>
                    <Textarea
                      id="informacoesLegais"
                      className="min-h-[120px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                      value={form.informacoesLegais}
                      onChange={event => setForm(current => ({ ...current, informacoesLegais: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoesJuridicas">Observações jurídicas</Label>
                    <Textarea
                      id="observacoesJuridicas"
                      className="min-h-[120px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                      value={form.observacoesJuridicas}
                      onChange={event => setForm(current => ({ ...current, observacoesJuridicas: event.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                      disabled={updateLegalDetails.isPending}
                      onClick={() =>
                        updateLegalDetails.mutate({
                          id: property.id,
                          inscricaoImobiliaria: form.inscricaoImobiliaria || null,
                          matriculaRegistro: form.matriculaRegistro || null,
                          cartorioRegistro: form.cartorioRegistro || null,
                          registroMunicipal: form.registroMunicipal || null,
                          informacoesLegais: form.informacoesLegais || null,
                          observacoesJuridicas: form.observacoesJuridicas || null,
                        })
                      }
                    >
                      {updateLegalDetails.isPending ? "Salvando..." : "Salvar ficha"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
              <CardContent className="py-12 text-center">
                <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <p className="text-slate-600">Imóvel não encontrado.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
