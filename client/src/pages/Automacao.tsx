import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowLeft, Bot, MessageSquareWarning, ReceiptText, Shield, SlidersHorizontal } from "lucide-react";

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";

const mensagensAvisosTipos = [
  "Saída do Locatário",
  "Carta de Venda de Imóvel Alugado",
  "Ativação do contrato de Aluguel",
  "Pré-vencimento de aluguel",
  "Renovação de contrato próxima",
  "Lembrete de vistoria agendada",
  "Notificação de reajuste contratual",
  "Confirmação de recebimento de proposta",
];

const cobrancasTipos = [
  "Aluguel Atrasado",
  "Condomínio em atraso",
  "IPTU pendente",
  "Seguro fiança pendente",
  "Multa contratual pendente",
  "Parcela de comissão em atraso",
  "Reenvio de boleto",
  "Confirmação de baixa de pagamento",
];

export default function Automacao() {
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
              <Bot className="h-8 w-8 text-slate-700" />
              Automação
            </h1>
            <p className="text-slate-600">
              Gerencie fluxos automatizados de comunicação, cobranças e regras operacionais.
            </p>
          </div>

          <Tabs defaultValue="mensagens-avisos" className="space-y-6">
            <TabsList className="rounded-full border border-slate-200 bg-white/90">
              <TabsTrigger value="mensagens-avisos" className="gap-2">
                <MessageSquareWarning className="h-4 w-4" />
                Mensagens/Avisos
              </TabsTrigger>
              <TabsTrigger value="cobrancas" className="gap-2">
                <ReceiptText className="h-4 w-4" />
                Cobranças
              </TabsTrigger>
              <TabsTrigger value="regras" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Regras
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mensagens-avisos">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Mensagens/Avisos</CardTitle>
                  <CardDescription className="text-slate-600">
                    Defina notificações automáticas para equipe e clientes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                  <p className="text-slate-700">Tipos de automação sugeridos:</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {mensagensAvisosTipos.map(tipo => (
                      <div
                        key={tipo}
                        className="rounded-2xl border border-slate-200 bg-white/85 px-3 py-2 text-sm text-slate-700"
                      >
                        {tipo}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cobrancas">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Cobranças</CardTitle>
                  <CardDescription className="text-slate-600">
                    Configure fluxos automáticos de cobrança e confirmação de pagamento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                  <p className="text-slate-700">Tipos de cobrança sugeridos:</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {cobrancasTipos.map(tipo => (
                      <div
                        key={tipo}
                        className="rounded-2xl border border-slate-200 bg-white/85 px-3 py-2 text-sm text-slate-700"
                      >
                        {tipo}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="regras">
              <Card className={SURFACE_CARD_CLASS}>
                <CardHeader>
                  <CardTitle className="text-slate-950">Regras</CardTitle>
                  <CardDescription className="text-slate-600">
                    Organize regras de automação e políticas internas de execução.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  Em breve: regras condicionais, prioridade, horários e controle de exceções.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
