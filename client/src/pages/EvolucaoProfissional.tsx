import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowLeft, BookOpenCheck, BriefcaseBusiness, ChartNoAxesColumnIncreasing, Shield, Users } from "lucide-react";

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";

const developmentAreas = [
  "Comercial",
  "Captação de imóveis",
  "Locações",
  "Vendas",
  "Atendimento e CRM",
  "Administrativo",
  "Financeiro",
  "Gestão de equipe",
];

const journeySteps = [
  "Conhecimentos essenciais da área",
  "Rotinas e responsabilidades esperadas",
  "Indicadores de evolução",
  "Treinamentos e materiais recomendados",
  "Critérios de avanço e reconhecimento",
  "Próximos desafios profissionais",
];

export default function EvolucaoProfissional() {
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

  if (!user || (user.role !== "administrativo" && user.role !== "corretor")) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Negado</h1>
          <p className="mb-6 text-muted-foreground">Esta área é exclusiva para equipe e parceiros autorizados.</p>
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
              <BookOpenCheck className="h-8 w-8 text-slate-700" />
              Evolução Profissional
            </h1>
            <p className="max-w-3xl text-slate-600">
              Estruture caminhos de aprendizado, prática e evolução profissional para parceiros e colaboradores da AFG.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.42)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-slate-950">
                  <Users className="h-5 w-5 text-emerald-700" />
                  Pessoas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Espaço para orientar parceiros e colaboradores sobre evolução, capacitação e responsabilidades.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.42)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-slate-950">
                  <BriefcaseBusiness className="h-5 w-5 text-emerald-700" />
                  Áreas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Organize trilhas por área, função, rotina, nível de autonomia e competências esperadas.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.42)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-slate-950">
                  <ChartNoAxesColumnIncreasing className="h-5 w-5 text-emerald-700" />
                  Evolução
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Defina critérios claros para aprendizado, esforço, desempenho e crescimento profissional.
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="areas" className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start rounded-[24px] border border-slate-200 bg-white/90 p-1">
              <TabsTrigger value="areas" className="rounded-2xl">Áreas</TabsTrigger>
              <TabsTrigger value="jornada" className="rounded-2xl">Jornada</TabsTrigger>
              <TabsTrigger value="planejamento" className="rounded-2xl">Planejamento</TabsTrigger>
            </TabsList>

            <TabsContent value="areas">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Áreas de desenvolvimento</CardTitle>
                  <CardDescription className="text-slate-600">
                    Base inicial para organizar as trilhas que serão detalhadas depois.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {developmentAreas.map(area => (
                    <div key={area} className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm font-medium text-slate-700">
                      {area}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jornada">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Jornada de evolução</CardTitle>
                  <CardDescription className="text-slate-600">
                    Um modelo simples para transformar cada área em uma trilha clara.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {journeySteps.map(step => (
                    <div key={step} className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700">
                      {step}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="planejamento">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Planejamento AFG</CardTitle>
                  <CardDescription className="text-slate-600">
                    Área reservada para inserir o planejamento oficial das trilhas de desenvolvimento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-slate-600">
                  Em breve: níveis, critérios, treinamentos, metas, indicadores e orientações específicas para cada perfil.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
