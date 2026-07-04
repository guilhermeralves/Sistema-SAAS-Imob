import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "wouter";

const SERVICOS = [
  {
    icon: Search,
    eyebrow: "Compra e venda",
    title: "Compra e venda de imóveis",
    description:
      "Facilitamos todo o processo de compra e venda, desde a avaliação até o fechamento com segurança.",
    features: [
      "Avaliação profissional do imóvel",
      "Marketing digital e tradicional",
      "Visitas com compradores qualificados",
      "Negociação e apoio no fechamento",
      "Assessoria jurídica",
    ],
  },
  {
    icon: FileText,
    eyebrow: "Locação",
    title: "Locação de imóveis",
    description:
      "Alugue seu imóvel com mais segurança e menos burocracia, com acompanhamento operacional da equipe.",
    features: [
      "Análise de crédito dos locatários",
      "Elaboração de contratos",
      "Vistoria de entrada e saída",
      "Gestão de pagamentos",
      "Suporte em caso de inadimplência",
    ],
  },
  {
    icon: Building2,
    eyebrow: "Administração",
    title: "Administração imobiliária",
    description:
      "Gestão transparente para proprietários que precisam de rotina organizada e acompanhamento constante.",
    features: [
      "Cobrança de aluguéis e encargos",
      "Manutenção preventiva e corretiva",
      "Relatórios mensais detalhados",
      "Atendimento aos locatários",
      "Renovação de contratos",
    ],
  },
  {
    icon: Users,
    eyebrow: "Consultoria",
    title: "Consultoria imobiliária",
    description:
      "Orientação especializada para decisões imobiliárias mais seguras, seja para investir, comprar ou vender.",
    features: [
      "Análise de mercado",
      "Avaliação do potencial de valorização",
      "Planejamento financeiro",
      "Estratégias de investimento",
      "Acompanhamento personalizado",
    ],
  },
];

const DIFERENCIAIS = [
  {
    icon: Shield,
    title: "Segurança e confiança",
    description: "Processos claros, orientação jurídica e condução responsável em cada etapa.",
  },
  {
    icon: Clock,
    title: "Agilidade",
    description: "Tecnologia e organização para acelerar o atendimento sem perder cuidado.",
  },
  {
    icon: TrendingUp,
    title: "Resultados",
    description: "Atuação focada em valor, posicionamento e negociação com visão de mercado.",
  },
];

const PROCESSO_DIGITAL = [
  {
    numero: "01",
    titulo: "Cadastro online",
    descricao: "Recebemos o imóvel ou a necessidade do cliente por site, atendimento direto ou WhatsApp.",
  },
  {
    numero: "02",
    titulo: "Análise e preparação",
    descricao: "Organizamos informações, avaliamos contexto e posicionamos o imóvel da forma correta.",
  },
  {
    numero: "03",
    titulo: "Processo comercial",
    descricao: "Cuidamos das visitas, negociações e comunicação com mais controle de processo.",
  },
  {
    numero: "04",
    titulo: "Documentação",
    descricao: "Centralizamos as etapas documentais para tornar a jornada mais segura e fluida.",
  },
];

export default function Servicos() {
  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-20">
        <section className="pt-10 md:pt-12">
          <div className="container">
            <div className="mb-10 max-w-3xl">
              <p className="mb-4 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                Nossos serviços
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                Soluções imobiliárias com operação mais clara, segura e organizada.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Reunimos atendimento comercial, gestão operacional e apoio documental para
                acompanhar compra, venda, locação e administração de imóveis com mais consistência.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/contato">
                  <Button className="h-12 rounded-full bg-emerald-700 px-6 text-white shadow-[0_18px_40px_-24px_rgba(4,120,87,0.85)] hover:bg-emerald-800">
                    Fale Conosco
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {DIFERENCIAIS.map(item => (
                <Card
                  key={item.title}
                  className="rounded-[28px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,243,0.88))] shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]"
                >
                  <CardContent>
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-4 rounded-[28px] border-transparent bg-[linear-gradient(135deg,#4e7b66,#628b78_55%,#7aa18b)] text-white shadow-[0_25px_60px_-35px_rgba(15,23,42,0.6)]">
                <CardContent>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                    Processo digital
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight">
                    Atendimento com fluxo mais simples do início ao fechamento.
                  </p>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">
                    Organização comercial, documentação e apoio contínuo para diminuir ruído e
                    dar mais previsibilidade ao processo.
                  </p>
                </CardContent>
              </Card>
          </div>
        </section>

        <section className="pt-14 md:pt-18">
          <div className="container">
            <div className="mb-8 max-w-2xl">
              <p className="mb-3 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                Atuação AFG
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Áreas em que atuamos dentro da operação imobiliária.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Cada serviço foi organizado para apoiar uma etapa importante da jornada do cliente e do proprietário.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {SERVICOS.map(servico => (
                <Card
                  key={servico.title}
                  className="rounded-[30px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-42px_rgba(15,23,42,0.5)]"
                >
                  <CardContent>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                      <servico.icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      {servico.eyebrow}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      {servico.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{servico.description}</p>

                    <div className="mt-6 grid gap-3">
                      {servico.features.map(feature => (
                        <div
                          key={feature}
                          className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                        >
                          <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-emerald-700" />
                          <span className="text-sm leading-6 text-slate-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="pt-14 md:pt-18">
          <div className="container">
            <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <CardContent>
                <div className="mb-8 max-w-2xl">
                  <p className="mb-3 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                    Fluxo digital
                  </p>
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                    Como conduzimos o processo de forma mais organizada.
                  </h2>
                  <p className="mt-3 text-base leading-7 text-slate-600">
                    Usamos uma estrutura simples para centralizar atendimento, análise comercial e documentação.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {PROCESSO_DIGITAL.map(etapa => (
                    <Card
                      key={etapa.numero}
                      className="rounded-[28px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,245,242,0.88))] shadow-[0_18px_40px_-30px_rgba(15,23,42,0.32)]"
                    >
                      <CardContent>
                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                          {etapa.numero}
                        </div>
                        <h3 className="text-lg font-semibold text-slate-950">{etapa.titulo}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{etapa.descricao}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </Layout>
  );
}
