import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowLeft, Award, Building2, Gift, HandCoins, Shield, Users } from "lucide-react";

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";

const bonusTypes = [
  {
    title: "Gestão de equipe",
    description: "Bonificações para liderança, acompanhamento de metas, distribuição de demandas e desempenho do time.",
    icon: Users,
  },
  {
    title: "Captação de imóveis",
    description: "Bonificações para captação qualificada de imóveis, documentação inicial e entrada de novas oportunidades.",
    icon: Building2,
  },
  {
    title: "Intermediação",
    description: "Bonificações vinculadas a negociações, apoio comercial e participação em processos de venda ou locação.",
    icon: HandCoins,
  },
  {
    title: "Performance",
    description: "Bonificações por metas internas, produtividade, qualidade operacional e entregas estratégicas.",
    icon: Award,
  },
];

const teamManagementRules = [
  "Acompanhamento de metas individuais e coletivas.",
  "Apoio na distribuição e priorização de demandas.",
  "Participação na evolução de processos internos.",
  "Indicadores de qualidade, produtividade e atendimento.",
];

const propertyAcquisitionRules = [
  "Captação de imóveis com dados completos e documentação inicial.",
  "Validação de proprietário, finalidade e informações comerciais.",
  "Qualidade das fotos, descrição, localização e precificação inicial.",
  "Acompanhamento da captação até publicação ou início da negociação.",
];

export default function Bonificacoes() {
  const { user, loading } = useAuth();

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

          <div className="mb-2">
            <h1 className="mb-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              <Gift className="h-8 w-8 text-slate-700" />
              Bonificações
            </h1>
            <p className="max-w-3xl text-slate-600">
              Organize os tipos de bonificações da imobiliária e as regras de reconhecimento por gestão de equipe e captação de imóveis.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bonusTypes.map(item => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.42)]">
                  <CardHeader className="space-y-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="text-base text-slate-950">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-slate-600">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Tabs defaultValue="gestao-equipe" className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start rounded-[24px] border border-slate-200 bg-white/90 p-1">
              <TabsTrigger value="gestao-equipe" className="gap-2 rounded-2xl">
                <Users className="h-4 w-4" />
                Gestão de equipe
              </TabsTrigger>
              <TabsTrigger value="captacao-imoveis" className="gap-2 rounded-2xl">
                <Building2 className="h-4 w-4" />
                Captação de imóveis
              </TabsTrigger>
              <TabsTrigger value="tipos" className="gap-2 rounded-2xl">
                <Gift className="h-4 w-4" />
                Tipos de bonificação
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gestao-equipe">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Bonificações por gestão de equipe</CardTitle>
                  <CardDescription className="text-slate-600">
                    Use esta área para explicar critérios de reconhecimento ligados à condução e melhoria do time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {teamManagementRules.map(rule => (
                    <div key={rule} className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700">
                      {rule}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="captacao-imoveis">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Bonificações por captação de imóveis</CardTitle>
                  <CardDescription className="text-slate-600">
                    Critérios sugeridos para bonificar captações qualificadas e úteis para venda ou locação.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {propertyAcquisitionRules.map(rule => (
                    <div key={rule} className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700">
                      {rule}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tipos">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Tipos de bonificação</CardTitle>
                  <CardDescription className="text-slate-600">
                    Estrutura inicial para listar as bonificações existentes na imobiliária.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  Em breve: cadastro de regras, responsáveis, valores, critérios, aprovações e histórico de bonificações.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
