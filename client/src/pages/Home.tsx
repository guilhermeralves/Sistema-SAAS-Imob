import Layout from "@/components/Layout";
import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Building2, Search, FileText, Users, ArrowRight, MapPin, Bed, Bath, Car } from "lucide-react";
import { Link } from "wouter";

/**
 * Página Home
 * 
 * Página principal do site com banner, destaques e chamadas para ação.
 * 
 * EDIÇÃO:
 * - Para alterar o banner: edite a seção BANNER_CONFIG abaixo
 * - Para modificar os serviços em destaque: edite SERVICES
 * - Para alterar a chamada de captação: edite CAPTACAO_CONFIG
 */

// ========== ÁREA DE EDIÇÃO - BANNER ==========
const SLIDES = [
  {
  desktop:"/banner/desktop.webp",
  mobile:"/banner/mobile.webp",
  title: "Encontre o Imóvel dos Seus Sonhos.",
  subtitle: "Facilitamos a compra, venda e locação de imóveis com tecnologia e atendimento personalizado.",
  ctaText: "Ver Imóveis",
  ctaLink: "/imoveis",
  },
  {
  desktop:"/banner_2/desktop.webp",
  mobile:"/banner_2/mobile.webp",
  title: "Controle a Locaçao de seus Imóveis.",
  subtitle: "Não se preocupe com a gestão e administração de seus imóveis locados, Faremos por voce!",
  ctaText: "Locações",
  ctaLink: "/locacao",
  },
  {
  desktop:"/banner_3/desktop.webp",
  mobile:"/banner_3/mobile.webp",
  title: "Melhor Consultoria de Investimentos do Setor Imobiliário.",
  subtitle: "Facilitamos a compra, venda e locação de imóveis com tecnologia e atendimento personalizado.",
  ctaText: "Investimentos",
  ctaLink: "/investimentos",
},];


// ========== FIM DA ÁREA DE EDIÇÃO ==========

// ========== ÁREA DE EDIÇÃO - SERVIÇOS ==========
const SERVICES = [
  {
    icon: Search,
    title: "Compra e Venda",
    description: "Encontre o imóvel perfeito ou venda o seu com nossa assessoria completa.",
  },
  {
    icon: FileText,
    title: "Locação",
    description: "Alugue seu imóvel com segurança e praticidade. Cuidamos de toda a burocracia.",
  },
  {
    icon: Building2,
    title: "Administração",
    description: "Administramos seu imóvel com transparência e eficiência.",
  },
  {
    icon: Users,
    title: "Consultoria",
    description: "Orientação especializada para suas decisões imobiliárias.",
  },
];
// ========== FIM DA ÁREA DE EDIÇÃO ==========

// ========== ÁREA DE EDIÇÃO - CAPTAÇÃO ==========
const CAPTACAO_CONFIG = {
  title: "Quer Vender ou Alugar seu Imóvel?",
  description: "Cadastre seu imóvel conosco e tenha acesso a milhares de potenciais compradores e locatários.",
  ctaText: "Anunciar Meu Imóvel",
  whatsapp: "5511999999999", // Formato: código do país + DDD + número
};
// ========== FIM DA ÁREA DE EDIÇÃO ==========

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const { data: destaques, isLoading } = trpc.properties.getDestacados.useQuery();
  const announceHref = isAuthenticated
    ? `https://wa.me/${CAPTACAO_CONFIG.whatsapp}?text=${encodeURIComponent(
        "Olá tudo bem? Gostaria de Anunciar meu Imóvel na AFG!"
      )}`
    : getLoginUrl();
  const announceTarget = isAuthenticated ? "_blank" : undefined;
  const announceRel = isAuthenticated ? "noopener noreferrer" : undefined;

  return (
    <Layout>
      {/* Banner Hero */}
      <section className="relative z-0 overflow-hidden min-h-[85vh] md:min-h-[720px] py-20 md:py-32">

        {/* Banner visual (fundo)  */}
        <Banner
          desktop={SLIDES[index].desktop}
          mobile={SLIDES[index].mobile}
          alt={SLIDES[index].title}
        />

        {/* Overlay opcional */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Conteúdo*/}
        <div className="relative z-20 container ">
          <div className="max-w-3xl -translate-y-6 mt-4">
            <h1 className="text-3xl md:text-6xl font-bold mb-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              {SLIDES[index].title}
            </h1>

            <p className="text-base md:text-xl text-muted-foreground mb-8 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              {SLIDES[index].subtitle}
            </p>

            <Link href={SLIDES[index].ctaLink}>
              <Button size="lg" className="gap-2">
                {SLIDES[index].ctaText}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>


      {/* Serviços */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Serviços</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Oferecemos soluções completas para todas as suas necessidades imobiliárias
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((service, index) => (
              <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <service.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{service.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Imóveis em Destaque */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Imóveis em Destaque</h2>
              <p className="text-muted-foreground">Confira nossas melhores oportunidades</p>
            </div>
            <Link href="/imoveis">
              <Button variant="outline" className="gap-2">
                Ver Todos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-48 bg-muted animate-pulse" />
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : destaques && destaques.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {destaques.map((imovel) => {
                const fotos = imovel.fotos ? JSON.parse(imovel.fotos) : [];
                const primeiraFoto = fotos[0] || "/placeholder-property.jpg";

                return (
                  <Link key={imovel.id} href={`/imoveis/${imovel.id}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={primeiraFoto}
                          alt={imovel.titulo}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                          {imovel.finalidade === "venda" ? "Venda" : imovel.finalidade === "locacao" ? "Locação" : "Venda/Locação"}
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-bold text-lg mb-2 line-clamp-1">{imovel.titulo}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                          <MapPin className="h-4 w-4" />
                          <span className="line-clamp-1">{imovel.cidade}, {imovel.estado}</span>
                        </div>
                        <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
                          {imovel.quartos && (
                            <div className="flex items-center gap-1">
                              <Bed className="h-4 w-4" />
                              {imovel.quartos}
                            </div>
                          )}
                          {imovel.banheiros && (
                            <div className="flex items-center gap-1">
                              <Bath className="h-4 w-4" />
                              {imovel.banheiros}
                            </div>
                          )}
                          {imovel.vagas && (
                            <div className="flex items-center gap-1">
                              <Car className="h-4 w-4" />
                              {imovel.vagas}
                            </div>
                          )}
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(imovel.valor)}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum imóvel em destaque no momento</p>
            </Card>
          )}
        </div>
      </section>

      {/* Captação de Imóveis */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container">
          <Card className="border-2 border-primary/20">
            <CardContent className="p-8 md:p-12 text-center">
              <Building2 className="h-16 w-16 mx-auto mb-6 text-primary" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{CAPTACAO_CONFIG.title}</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                {CAPTACAO_CONFIG.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  asChild
                  className="gap-2"
                >
                  <a href={announceHref} target={announceTarget} rel={announceRel}>
                    {CAPTACAO_CONFIG.ctaText}
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Button>
                <Link href="/contato#contato-topo">
                  <Button size="lg" variant="outline">
                    Fale Conosco
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
