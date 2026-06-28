import { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  PlugZap,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";

type NativeIntegrationCategory =
  | "portal_divulgacao"
  | "financeiro"
  | "assinaturas_eletronicas";

// Seções (categorias) exibidas na área de Integrações, na ordem desejada.
const INTEGRATION_SECTIONS: {
  category: NativeIntegrationCategory;
  title: string;
  emptyLabel: string;
}[] = [
  {
    category: "portal_divulgacao",
    title: "Portais de Divulgação",
    emptyLabel: "Nenhuma integração de portal disponível ainda.",
  },
  {
    category: "financeiro",
    title: "Financeiro",
    emptyLabel: "Nenhuma integração financeira disponível ainda.",
  },
  {
    category: "assinaturas_eletronicas",
    title: "Assinaturas Eletrônicas",
    emptyLabel: "Nenhuma integração de assinatura disponível ainda.",
  },
];

export default function Integracoes() {
  const { user, loading } = useAuth();

  // Estado das seções "pai" (expandir/minimizar). Assinaturas começa aberta.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    assinaturas_eletronicas: true,
  });
  // Estado dos cards "filho" (minimizados). Por padrão ficam expandidos.
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>(
    {}
  );

  const nativeQuery = trpc.integracoes.native.useQuery(undefined, {
    enabled: user?.role === "administrativo",
  });

  const toggleSection = (category: string) =>
    setOpenSections(current => ({ ...current, [category]: !current[category] }));
  const toggleCard = (key: string) =>
    setCollapsedCards(current => ({ ...current, [key]: !current[key] }));

  const nativeByCategory = (category: NativeIntegrationCategory) =>
    (nativeQuery.data ?? []).filter(item => item.category === category);

  const renderIntegrationCard = (
    integration: NonNullable<typeof nativeQuery.data>[number]
  ) => {
    const configured = integration.status === "configurada";
    const collapsed = collapsedCards[integration.key] ?? false;
    return (
      <Card
        key={integration.key}
        className="w-full rounded-3xl border-emerald-100 bg-white/95 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)]"
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-slate-950">
              <PlugZap className="h-4 w-4 text-emerald-600" />
              {integration.name}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <Sparkles className="h-3 w-3" /> Nativa do sistema
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <span
                className={
                  configured
                    ? "w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                    : "w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
                }
              >
                {configured ? "Configurada" : "Não configurada"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-slate-500"
                onClick={() => toggleCard(integration.key)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Expandir card" : "Minimizar card"}
                title={collapsed ? "Expandir" : "Minimizar"}
              >
                {collapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {collapsed ? null : (
          <CardContent className="space-y-3 pt-0">
            <p className="text-sm text-slate-600">{integration.description}</p>

            {integration.capabilities.length > 0 ? (
              <ul className="space-y-1">
                {integration.capabilities.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-xs text-slate-600"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Requisitos (configurados no servidor / .env)
              </p>
              <div className="flex flex-col gap-1.5">
                {integration.requirements.map(req => (
                  <div
                    key={req.envVar}
                    className="flex items-center gap-2 text-xs text-slate-600"
                  >
                    {req.present ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle
                        className={`h-3.5 w-3.5 shrink-0 ${
                          req.required ? "text-red-500" : "text-slate-400"
                        }`}
                      />
                    )}
                    <span className="font-medium">{req.label}</span>
                    {!req.required ? (
                      <span className="text-[10px] text-slate-400">
                        (opcional)
                      </span>
                    ) : null}
                    <code className="ml-auto text-[10px] text-slate-400">
                      {req.envVar}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500">{integration.statusDetail}</p>

            {integration.docsUrl ? (
              <a
                href={integration.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Documentação oficial
              </a>
            ) : null}
          </CardContent>
        )}
      </Card>
    );
  };

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
          <p className="mb-6 text-muted-foreground">
            Esta área é exclusiva para administradores.
          </p>
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
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                Integrações
              </CardTitle>
              <CardDescription className="text-slate-600">
                Visualize as integrações nativas do sistema e o status de cada
                uma. As credenciais são configuradas com segurança no servidor
                (.env).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {INTEGRATION_SECTIONS.map(section => {
                  const items = nativeByCategory(section.category);
                  const isOpen = openSections[section.category] ?? false;
                  return (
                    <section
                      key={section.category}
                      className="rounded-3xl border border-white/70 bg-white/80"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                        onClick={() => toggleSection(section.category)}
                        aria-expanded={isOpen}
                      >
                        <div className="flex items-center gap-3">
                          <h2 className="text-lg font-semibold text-slate-950">
                            {section.title}
                          </h2>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            {items.length}
                          </span>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                        )}
                      </button>

                      {isOpen ? (
                        <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-4">
                          {nativeQuery.isLoading ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                              Carregando integrações...
                            </div>
                          ) : null}
                          {items.map(renderIntegrationCard)}
                          {!nativeQuery.isLoading && items.length === 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                              {section.emptyLabel}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
