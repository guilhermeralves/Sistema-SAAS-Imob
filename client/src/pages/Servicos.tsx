import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Search,
  FileText,
  Users,
  CheckCircle2,
  ArrowRight,
  Shield,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";

/**
 * Página de Serviços
 * 
 * Apresenta os serviços oferecidos pela imobiliária.
 * 
 * EDIÇÃO:
 * - Para modificar os serviços: edite o array SERVICOS abaixo
 * - Para alterar os diferenciais: edite DIFERENCIAIS
 * - Para modificar o processo digital: edite PROCESSO_DIGITAL
 */

// ========== ÁREA DE EDIÇÃO - SERVIÇOS ==========
const SERVICOS = [
  {
    icon: Search,
    title: "Compra e Venda de Imóveis",
    description: "Facilitamos todo o processo de compra e venda do seu imóvel, desde a avaliação até a assinatura do contrato.",
    features: [
      "Avaliação profissional do imóvel",
      "Marketing digital e tradicional",
      "Visitas agendadas com potenciais compradores",
      "Negociação e fechamento do negócio",
      "Assessoria jurídica completa",
    ],
  },
  {
    icon: FileText,
    title: "Locação de Imóveis",
    description: "Alugue seu imóvel com segurança e praticidade. Cuidamos de toda a burocracia para você.",
    features: [
      "Análise de crédito dos locatários",
      "Elaboração de contratos",
      "Vistoria de entrada e saída",
      "Gestão de pagamentos",
      "Suporte jurídico em caso de inadimplência",
    ],
  },
  {
    icon: Building2,
    title: "Administração de Imóveis",
    description: "Administramos seu imóvel com transparência e eficiência, garantindo rentabilidade e tranquilidade.",
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
    title: "Consultoria Imobiliária",
    description: "Orientação especializada para suas decisões imobiliárias, seja para investimento ou uso próprio.",
    features: [
      "Análise de mercado",
      "Avaliação de potencial de valorização",
      "Planejamento financeiro",
      "Estratégias de investimento",
      "Acompanhamento personalizado",
    ],
  },
];
// ========== FIM DA ÁREA DE EDIÇÃO ==========

// ========== ÁREA DE EDIÇÃO - DIFERENCIAIS ==========
const DIFERENCIAIS = [
  {
    icon: Shield,
    title: "Segurança e Confiança",
    description: "Processos transparentes e assessoria jurídica completa.",
  },
  {
    icon: Clock,
    title: "Agilidade",
    description: "Tecnologia e processos otimizados para resultados rápidos.",
  },
  {
    icon: TrendingUp,
    title: "Resultados",
    description: "Equipe experiente focada no melhor negócio para você.",
  },
];
// ========== FIM DA ÁREA DE EDIÇÃO ==========

// ========== ÁREA DE EDIÇÃO - PROCESSO DIGITAL ==========
const PROCESSO_DIGITAL = {
  title: "Processo 100% Digital",
  description: "Na AFG Imobiliária, utilizamos tecnologia de ponta para tornar sua experiência mais ágil e segura.",
  etapas: [
    {
      numero: "01",
      titulo: "Cadastro Online",
      descricao: "Cadastre seu imóvel ou interesse através do nosso site ou WhatsApp.",
    },
    {
      numero: "02",
      titulo: "Avaliação Digital",
      descricao: "Nossa equipe avalia e publica seu imóvel em múltiplos canais.",
    },
    {
      numero: "03",
      titulo: "Visitas Agendadas",
      descricao: "Organizamos visitas com interessados qualificados.",
    },
    {
      numero: "04",
      titulo: "Documentação Digital",
      descricao: "Toda a documentação pode ser enviada e assinada digitalmente.",
    },
  ],
};
// ========== FIM DA ÁREA DE EDIÇÃO ==========

export default function Servicos() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-24">
        <div className="container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Nossos Serviços</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Soluções completas para todas as suas necessidades imobiliárias
          </p>
        </div>
      </section>

      {/* Serviços Detalhados */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {SERVICOS.map((servico, index) => (
              <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <servico.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{servico.title}</CardTitle>
                  <CardDescription className="text-base">{servico.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {servico.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Por Que Escolher a AFG?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Nossos diferenciais fazem toda a diferença na sua experiência
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {DIFERENCIAIS.map((diferencial, index) => (
              <Card key={index} className="text-center border-2">
                <CardContent className="pt-8 pb-6">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <diferencial.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{diferencial.title}</h3>
                  <p className="text-muted-foreground">{diferencial.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Processo Digital */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{PROCESSO_DIGITAL.title}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {PROCESSO_DIGITAL.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESSO_DIGITAL.etapas.map((etapa, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 text-8xl font-bold text-primary/5">
                  {etapa.numero}
                </div>
                <CardContent className="pt-6 relative">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 text-lg font-bold">
                    {etapa.numero}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{etapa.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{etapa.descricao}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para Começar?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Entre em contato conosco e descubra como podemos ajudá-lo
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contato">
              <Button size="lg" className="gap-2">
                Fale Conosco
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/imoveis">
              <Button size="lg" variant="outline">
                Ver Imóveis
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
