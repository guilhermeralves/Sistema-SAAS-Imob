import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, PlugZap, Settings, Shield } from "lucide-react";
import { toast } from "sonner";

type IntegrationCategory = "portal_divulgacao" | "financeiro" | "assinaturas_eletronicas";
type IntegrationConnectionType = "api" | "webhook" | "arquivo" | "manual";
type IntegrationStatus = "rascunho" | "ativo" | "inativo";

type IntegrationFormState = {
  name: string;
  category: IntegrationCategory;
  provider: string;
  connectionType: IntegrationConnectionType;
  status: IntegrationStatus;
  endpoint: string;
  apiKey: string;
  configJson: string;
  notes: string;
};

const INITIAL_INTEGRATION_FORM: IntegrationFormState = {
  name: "",
  category: "portal_divulgacao",
  provider: "",
  connectionType: "api",
  status: "rascunho",
  endpoint: "",
  apiKey: "",
  configJson: "",
  notes: "",
};

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  portal_divulgacao: "Portal de Divulgação",
  financeiro: "Financeiro",
  assinaturas_eletronicas: "Assinaturas Eletrônicas",
};

const CONNECTION_TYPE_LABELS: Record<IntegrationConnectionType, string> = {
  api: "API",
  webhook: "Webhook",
  arquivo: "Arquivo/Planilha",
  manual: "Manual",
};

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  rascunho: "Rascunho",
  ativo: "Ativa",
  inativo: "Inativa",
};

function toNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fromNullableText(value: string | null | undefined) {
  return value ?? "";
}

export default function Integracoes() {
  const { user, loading } = useAuth();
  const [isPortalsSectionOpen, setIsPortalsSectionOpen] = useState(false);
  const [isFinancialSectionOpen, setIsFinancialSectionOpen] = useState(false);
  const [isSignatureSectionOpen, setIsSignatureSectionOpen] = useState(false);
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false);
  const [editingIntegrationId, setEditingIntegrationId] = useState<number | null>(null);
  const [integrationForm, setIntegrationForm] = useState<IntegrationFormState>(INITIAL_INTEGRATION_FORM);
  const utils = trpc.useUtils();

  const integrationsQuery = trpc.integracoes.list.useQuery(undefined, {
    enabled: user?.role === "administrativo",
  });

  const createIntegration = trpc.integracoes.create.useMutation({
    onSuccess: async () => {
      await utils.integracoes.list.invalidate();
      toast.success("Integração cadastrada com sucesso.");
      setIntegrationForm(INITIAL_INTEGRATION_FORM);
      setIntegrationModalOpen(false);
    },
    onError: error => {
      toast.error(error.message || "Não foi possível cadastrar a integração.");
    },
  });

  const updateIntegration = trpc.integracoes.update.useMutation({
    onSuccess: async () => {
      await utils.integracoes.list.invalidate();
      toast.success("Configuração da integração atualizada.");
      setIntegrationForm(INITIAL_INTEGRATION_FORM);
      setEditingIntegrationId(null);
      setIntegrationModalOpen(false);
    },
    onError: error => {
      toast.error(error.message || "Não foi possível atualizar a configuração da integração.");
    },
  });

  const updateIntegrationStatus = trpc.integracoes.updateStatus.useMutation({
    onSuccess: async (_updated, variables) => {
      await utils.integracoes.list.invalidate();
      setIntegrationForm(current =>
        editingIntegrationId === variables.id
          ? {
              ...current,
              status: variables.status,
            }
          : current
      );
      toast.success("Status da integração atualizado.");
    },
    onError: error => {
      toast.error(error.message || "Não foi possível atualizar a integração.");
    },
  });

  const portalIntegrations = useMemo(
    () => (integrationsQuery.data ?? []).filter(item => item.category === "portal_divulgacao"),
    [integrationsQuery.data]
  );
  const financialIntegrations = useMemo(
    () => (integrationsQuery.data ?? []).filter(item => item.category === "financeiro"),
    [integrationsQuery.data]
  );
  const signatureIntegrations = useMemo(
    () => (integrationsQuery.data ?? []).filter(item => item.category === "assinaturas_eletronicas"),
    [integrationsQuery.data]
  );

  const handleIntegrationModalOpenChange = (open: boolean) => {
    setIntegrationModalOpen(open);

    if (!open) {
      setEditingIntegrationId(null);
      setIntegrationForm(INITIAL_INTEGRATION_FORM);
    }
  };

  const handleNewIntegration = () => {
    setEditingIntegrationId(null);
    setIntegrationForm(INITIAL_INTEGRATION_FORM);
  };

  const handleConfigureIntegration = (integration: NonNullable<typeof integrationsQuery.data>[number]) => {
    setEditingIntegrationId(integration.id);
    setIntegrationForm({
      name: integration.name,
      category: integration.category as IntegrationCategory,
      provider: integration.provider,
      connectionType: integration.connectionType as IntegrationConnectionType,
      status: integration.status as IntegrationStatus,
      endpoint: fromNullableText(integration.endpoint),
      apiKey: fromNullableText(integration.apiKey),
      configJson: fromNullableText(integration.configJson),
      notes: fromNullableText(integration.notes),
    });
    setIntegrationModalOpen(true);
  };

  const getIntegrationPayload = () => ({
    name: integrationForm.name.trim(),
    category: integrationForm.category,
    provider: integrationForm.provider.trim(),
    connectionType: integrationForm.connectionType,
    status: integrationForm.status,
    endpoint: toNullableText(integrationForm.endpoint),
    apiKey: toNullableText(integrationForm.apiKey),
    configJson: toNullableText(integrationForm.configJson),
    notes: toNullableText(integrationForm.notes),
  });

  const handleSaveIntegration = () => {
    if (editingIntegrationId) {
      updateIntegration.mutate({
        id: editingIntegrationId,
        ...getIntegrationPayload(),
      });
      return;
    }

    createIntegration.mutate(getIntegrationPayload());
  };

  const handleToggleIntegrationStatus = () => {
    if (!editingIntegrationId) return;

    updateIntegrationStatus.mutate({
      id: editingIntegrationId,
      status: integrationForm.status === "ativo" ? "inativo" : "ativo",
    });
  };

  const renderIntegrationCard = (integration: NonNullable<typeof integrationsQuery.data>[number]) => (
    <Card
      key={integration.id}
      className="w-full rounded-3xl border-white/70 bg-white/95 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)]"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start sm:gap-6">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
            <PlugZap className="h-4 w-4 text-slate-500" />
            {integration.name}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-fit shrink-0 rounded-full border-slate-200"
              onClick={() => handleConfigureIntegration(integration)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="text-sm text-slate-600">
          Status da integração:{" "}
          <span
            className={
              integration.status === "ativo"
                ? "font-medium text-emerald-700"
                : integration.status === "inativo"
                  ? "font-medium text-slate-500"
                  : "font-medium text-amber-700"
            }
          >
            {STATUS_LABELS[integration.status as IntegrationStatus]}
          </span>
        </p>
        <p className="text-xs text-slate-500">
          {CATEGORY_LABELS[integration.category as IntegrationCategory]} •{" "}
          {CONNECTION_TYPE_LABELS[integration.connectionType as IntegrationConnectionType]} •{" "}
          {integration.provider}
        </p>
        {integration.endpoint ? (
          <p className="truncate text-xs text-slate-500">Endpoint: {integration.endpoint}</p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="space-y-4">
            <div className="h-8 w-72 animate-pulse rounded bg-muted" />
            <div className="h-64 animate-pulse rounded bg-muted" />
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
            <Link href="/dashboard">
              <a>Voltar para Dashboard</a>
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
        <div className="container space-y-6 py-8 md:py-10">
          <Button variant="outline" asChild className="rounded-full">
            <Link href="/dashboard">
              <a className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </a>
            </Link>
          </Button>

          <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                    Integrações
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Gerencie integrações externas de publicação e distribuição de imóveis.
                  </CardDescription>
                </div>

                <Dialog open={integrationModalOpen} onOpenChange={handleIntegrationModalOpenChange}>
                  <DialogTrigger asChild>
                    <Button
                      className="w-fit rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                      onClick={handleNewIntegration}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Integração
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border-white/80 bg-[#f7f6f2] sm:max-w-[680px] lg:max-w-[680px]">
                    <DialogHeader>
                      <DialogTitle>
                        {editingIntegrationId ? "Configurar Integração" : "Nova Integração"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingIntegrationId
                          ? "Revise e atualize as informações configuradas para esta integração."
                          : "Cadastre a configuração base para uma integração externa."}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="integration-name">Nome *</Label>
                        <Input
                          id="integration-name"
                          value={integrationForm.name}
                          onChange={event =>
                            setIntegrationForm(current => ({ ...current, name: event.target.value }))
                          }
                          placeholder="Ex: OLX - Conta principal"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="integration-provider">Provedor *</Label>
                        <Input
                          id="integration-provider"
                          value={integrationForm.provider}
                          onChange={event =>
                            setIntegrationForm(current => ({ ...current, provider: event.target.value }))
                          }
                          placeholder="Ex: OLX, Asaas, Banco Inter"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Categoria *</Label>
                        <Select
                          value={integrationForm.category}
                          onValueChange={value =>
                            setIntegrationForm(current => ({
                              ...current,
                              category: value as IntegrationCategory,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portal_divulgacao">Portal de Divulgação</SelectItem>
                            <SelectItem value="financeiro">Financeiro</SelectItem>
                            <SelectItem value="assinaturas_eletronicas">Assinaturas Eletrônicas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo de conexão *</Label>
                        <Select
                          value={integrationForm.connectionType}
                          onValueChange={value =>
                            setIntegrationForm(current => ({
                              ...current,
                              connectionType: value as IntegrationConnectionType,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                            <SelectItem value="arquivo">Arquivo/Planilha</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Status *</Label>
                        <Select
                          value={integrationForm.status}
                          onValueChange={value =>
                            setIntegrationForm(current => ({
                              ...current,
                              status: value as IntegrationStatus,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rascunho">Rascunho</SelectItem>
                            <SelectItem value="ativo">Ativa</SelectItem>
                            <SelectItem value="inativo">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="integration-endpoint">URL/Endpoint</Label>
                        <Input
                          id="integration-endpoint"
                          value={integrationForm.endpoint}
                          onChange={event =>
                            setIntegrationForm(current => ({ ...current, endpoint: event.target.value }))
                          }
                          placeholder="https://api.exemplo.com"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="integration-api-key">Token/Chave de API</Label>
                        <Input
                          id="integration-api-key"
                          type="password"
                          value={integrationForm.apiKey}
                          onChange={event =>
                            setIntegrationForm(current => ({ ...current, apiKey: event.target.value }))
                          }
                          placeholder="Cole aqui a chave fornecida pelo serviço"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="integration-config">Configurações JSON</Label>
                        <textarea
                          id="integration-config"
                          value={integrationForm.configJson}
                          onChange={event =>
                            setIntegrationForm(current => ({ ...current, configJson: event.target.value }))
                          }
                          className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm"
                          placeholder='{"accountId":"123","syncMode":"manual"}'
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="integration-notes">Observações</Label>
                        <textarea
                          id="integration-notes"
                          value={integrationForm.notes}
                          onChange={event =>
                            setIntegrationForm(current => ({ ...current, notes: event.target.value }))
                          }
                          className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm"
                          placeholder="Responsável, pendências, regras do provedor, etc."
                        />
                      </div>
                    </div>

                    <div
                      className={`flex flex-col gap-3 sm:flex-row sm:items-center ${
                        editingIntegrationId ? "sm:justify-between" : "sm:justify-end"
                      }`}
                    >
                      {editingIntegrationId ? (
                        <Button
                          variant="outline"
                          className="w-fit rounded-full border-slate-200"
                          onClick={handleToggleIntegrationStatus}
                          disabled={updateIntegrationStatus.isPending || updateIntegration.isPending}
                        >
                          {integrationForm.status === "ativo" ? "Inativar integração" : "Ativar integração"}
                        </Button>
                      ) : null}

                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          variant="outline"
                          className="rounded-full border-slate-200"
                          onClick={() => handleIntegrationModalOpenChange(false)}
                          disabled={
                            createIntegration.isPending ||
                            updateIntegration.isPending ||
                            updateIntegrationStatus.isPending
                          }
                        >
                          Cancelar
                        </Button>
                        <Button
                          className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                          onClick={handleSaveIntegration}
                          disabled={
                            createIntegration.isPending ||
                            updateIntegration.isPending ||
                            updateIntegrationStatus.isPending
                          }
                        >
                          {editingIntegrationId ? "Salvar Configuração" : "Cadastrar Integração"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <section className="rounded-3xl border border-white/70 bg-white/80">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setIsPortalsSectionOpen(current => !current)}
                    aria-expanded={isPortalsSectionOpen}
                  >
                    <h2 className="text-lg font-semibold text-slate-950">Portais de Divulgação</h2>
                    {isPortalsSectionOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                    )}
                  </button>

                  {isPortalsSectionOpen ? (
                    <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-4">
                      {integrationsQuery.isLoading ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                          Carregando integrações...
                        </div>
                      ) : null}
                      {portalIntegrations.map(renderIntegrationCard)}
                      {!integrationsQuery.isLoading && portalIntegrations.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                          Nenhuma integração de portal configurada.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-3xl border border-white/70 bg-white/80">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setIsFinancialSectionOpen(current => !current)}
                    aria-expanded={isFinancialSectionOpen}
                  >
                    <h2 className="text-lg font-semibold text-slate-950">Financeiro</h2>
                    {isFinancialSectionOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                    )}
                  </button>

                  {isFinancialSectionOpen ? (
                    <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-4">
                      {integrationsQuery.isLoading ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                          Carregando integrações...
                        </div>
                      ) : null}
                      {financialIntegrations.map(renderIntegrationCard)}
                      {!integrationsQuery.isLoading && financialIntegrations.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                          Nenhuma integração financeira configurada.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-3xl border border-white/70 bg-white/80">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setIsSignatureSectionOpen(current => !current)}
                    aria-expanded={isSignatureSectionOpen}
                  >
                    <h2 className="text-lg font-semibold text-slate-950">Assinaturas Eletrônicas</h2>
                    {isSignatureSectionOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                    )}
                  </button>

                  {isSignatureSectionOpen ? (
                    <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-4">
                      {integrationsQuery.isLoading ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                          Carregando integrações...
                        </div>
                      ) : null}
                      {signatureIntegrations.map(renderIntegrationCard)}
                      {!integrationsQuery.isLoading && signatureIntegrations.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                          Nenhuma integração de assinatura eletrônica configurada.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
