import Layout from "@/components/Layout";
import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Banner } from "@/components/Banner";
import ProtectedPropertyImage from "@/components/ProtectedPropertyImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Bath,
  Bed,
  Building2,
  Car,
  FileText,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { Link } from "wouter";

const SLIDES = [
  {
    desktop: "/banner/desktop.webp",
    mobile: "/banner/mobile.webp",
    title: "Encontre o imóvel dos seus Sonhos",
    subtitle:
      "Compra e venda com uma experiência mais clara, segura e confiavel.",
    ctaText: "Ver Imóveis",
    ctaLink: "/imoveis",
  },
  {
    desktop: "/banner_2/desktop.webp",
    mobile: "/banner_2/mobile.webp",
    title: "Locação de Imóveis",
    subtitle:
    "Acompanhamos a administração dos seus imóveis locados com gestão operacional e visão de longo prazo.",
    ctaText: "Ver Locações",
    ctaLink: "/imoveis",
  },
  {
    desktop: "/banner_3/desktop.webp",
    mobile: "/banner_3/mobile.webp",
    title: "Consultoria imobiliária com leitura de mercado",
    subtitle:
      "Auxiliamos investidores de forma estratégica de acordo com seus intereses.",
    ctaText: "Solicitar Atendimento",
    ctaLink: "/contato",
  },
];

const SERVICES = [
  {
    icon: Search,
    eyebrow: "Compra e venda",
    title: "Encontre ou apresente seu imóvel da forma ideal.",
    description:
      "Buscamos aderência entre necessidade, localização, momento de mercado e negociação.",
  },
  {
    icon: FileText,
    eyebrow: "Locação",
    title: "Processo mais organizado para quem quer alugar com segurança.",
    description:
      "Cuidamos da jornada de locação com acompanhamento documental e operacional.",
  },
  {
    icon: Building2,
    eyebrow: "Administração",
    title: "Gestão para imóveis que pedem acompanhamento contínuo.",
    description:
      "Controle, transparência e rotina mais previsível para proprietários e equipes.",
  },
  {
    icon: Users,
    eyebrow: "Consultoria",
    title: "Apoio estratégico para decisões imobiliárias mais maduras.",
    description:
      "Orientação para compra, venda, locação e leitura de oportunidade com contexto real.",
  },
];

const CAPTACAO_CONFIG = {
  title: "Quer vender ou alugar seu imóvel?",
  description:
    "Anuncie com a AFG e coloque seu imóvel dentro da operação que une gestão, segurança e acompanhamento comercial.",
  ctaText: "Anunciar meu imóvel",
  whatsapp: "5511999999999",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function getFirstPhoto(value?: string | null) {
  if (!value) return "/placeholder-property.jpg";

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
      return parsed[0];
    }
  } catch {
    return "/placeholder-property.jpg";
  }

  return "/placeholder-property.jpg";
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const [index, setIndex] = React.useState(0);
  const isAdmin = user?.role === "administrativo";

  React.useEffect(() => {
    if (isAdmin && typeof window !== "undefined") {
      window.location.replace("/dashboard");
    }
  }, [isAdmin]);

  React.useEffect(() => {
    const id = setInterval(() => {
      setIndex(current => (current + 1) % SLIDES.length);
    }, 10000);

    return () => clearInterval(id);
  }, []);

  const { data: destaques, isLoading } = trpc.properties.getDestacados.useQuery();

  const announceHref = isAuthenticated
    ? `https://wa.me/${CAPTACAO_CONFIG.whatsapp}?text=${encodeURIComponent(
        "Olá, tudo bem? Gostaria de anunciar meu imóvel na AFG."
      )}`
    : getLoginUrl();
  const announceTarget = isAuthenticated ? "_blank" : undefined;
  const announceRel = isAuthenticated ? "noopener noreferrer" : undefined;
  const shouldShowOwnerLeadCard =
    !user || (user.role !== "administrativo" && user.role !== "corretor");

  if (isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-20">
        <section className="relative z-0 min-h-[85vh] overflow-hidden py-20 md:min-h-[720px] md:py-32">
          <Banner
            desktop={SLIDES[index].desktop}
            mobile={SLIDES[index].mobile}
            alt={SLIDES[index].title}
          />

          <div className="absolute inset-0 bg-black/30" />

          <div className="relative z-20 container">
            <div className="mt-4 max-w-3xl -translate-y-6">
              <h1 className="mb-4 text-3xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] md:text-6xl">
                {SLIDES[index].title}
              </h1>

              <p className="mb-8 text-base text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] md:text-xl">
                {SLIDES[index].subtitle}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={SLIDES[index].ctaLink}>
                  <Button className="h-12 rounded-full bg-emerald-700 px-6 text-white shadow-[0_18px_40px_-24px_rgba(4,120,87,0.85)] hover:bg-emerald-800">
                    {SLIDES[index].ctaText}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="pt-14 md:pt-18">
          <div className="container">
            <div className="mb-8 max-w-2xl">
              <p className="mb-3 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                Operação AFG
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Vantagens dos serviços prestados pela nossa equipe.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Nosso objetivo é oferecer uma experiência mais clara e segura de todo o processo de compra e venda de imóveis.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {SERVICES.map(service => (
                <Card
                  key={service.title}
                  className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-42px_rgba(15,23,42,0.5)]"
                >
                  <CardContent className="p-6">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                      <service.icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      {service.eyebrow}
                    </p>
                    <h3 className="mt-3 text-xl font-semibold leading-8 text-slate-950">
                      {service.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="pt-14 md:pt-18">
          <div className="container">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                  Imóveis em destaque
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                  Oportunidades disponíveis em nosso catálogo.
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Selecione um imóvel para explorar detalhes, localização e contexto do anúncio.
                </p>
              </div>

              <Link href="/imoveis">
                <Button
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
                >
                  Ver todos
                  <ArrowRight />
                </Button>
              </Link>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card
                    key={i}
                    className="overflow-hidden rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)]"
                  >
                    <div className="h-56 animate-pulse bg-muted" />
                    <CardContent className="p-5">
                      <div className="mb-3 h-4 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : destaques && destaques.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {destaques.map(imovel => (
                  <Link key={imovel.id} href={`/imoveis/${imovel.id}`}>
                    <Card className="h-full cursor-pointer overflow-hidden rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-42px_rgba(15,23,42,0.52)]">
                      <div className="relative h-56 overflow-hidden">
                        <ProtectedPropertyImage
                          src={getFirstPhoto(imovel.fotos)}
                          alt={imovel.titulo}
                          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/38 to-transparent" />
                        <div className="absolute left-4 top-4 inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-800 shadow-sm">
                          {imovel.finalidade === "venda"
                            ? "Venda"
                            : imovel.finalidade === "locacao"
                              ? "Locação"
                              : "Venda/Locação"}
                        </div>
                      </div>

                      <CardContent className="p-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold leading-7 text-slate-950 line-clamp-2">
                              {imovel.titulo}
                            </h3>
                            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                              <MapPin className="h-4 w-4" />
                              <span className="line-clamp-1">
                                {imovel.cidade}, {imovel.estado}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-2 text-sm text-slate-600">
                          {imovel.quartos ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                              <Bed className="h-4 w-4" />
                              {imovel.quartos} quartos
                            </span>
                          ) : null}
                          {imovel.banheiros ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                              <Bath className="h-4 w-4" />
                              {imovel.banheiros} banheiros
                            </span>
                          ) : null}
                          {imovel.vagas ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                              <Car className="h-4 w-4" />
                              {imovel.vagas} vagas
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Valor</p>
                            <p className="mt-1 text-2xl font-semibold text-emerald-800">
                              {formatCurrency(imovel.valor)}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            Ver detalhes
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="rounded-[32px] border-white/70 bg-white/90 p-12 text-center shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
                <Search className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <h3 className="mb-2 text-lg font-semibold text-slate-950">Nenhum imóvel encontrado</h3>
                <p className="text-slate-500">Nenhum imóvel em destaque no momento.</p>
              </Card>
            )}
          </div>
        </section>

        {shouldShowOwnerLeadCard ? (
          <section className="pt-14 md:pt-18">
            <div className="container">
              <Card className="overflow-hidden rounded-[34px] border-emerald-100/70 bg-[linear-gradient(135deg,rgba(239,248,243,0.98),rgba(255,255,255,0.95))] shadow-[0_26px_80px_-42px_rgba(15,23,42,0.46)]">
                <CardContent className="grid gap-8 p-7 md:grid-cols-[1.1fr_0.9fr] md:p-10">
                  <div>
                    <p className="mb-3 inline-flex rounded-full border border-emerald-100 bg-white/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                      Captação de imóveis
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                      {CAPTACAO_CONFIG.title}
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                      {CAPTACAO_CONFIG.description}
                    </p>
                  </div>

                  <div className="flex flex-col justify-between gap-5 rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.25)]">
                    <div>
                      <p className="text-sm leading-7 text-slate-600">
                        Se o seu imóvel precisa de mais visibilidade, atendimento qualificado e uma apresentação mais forte, a nossa equipe está pronta para ajudar.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row md:flex-col xl:flex-row">
                      <Button
                        size="lg"
                        asChild
                        className="h-12 rounded-full bg-emerald-700 px-5 text-white shadow-[0_18px_40px_-24px_rgba(4,120,87,0.85)] hover:bg-emerald-800"
                      >
                        <a href={announceHref} target={announceTarget} rel={announceRel}>
                          {CAPTACAO_CONFIG.ctaText}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        ) : null}
      </div>
    </Layout>
  );
}
