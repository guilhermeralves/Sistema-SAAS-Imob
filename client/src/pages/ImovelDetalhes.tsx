import { useState } from "react";
import { Link, useRoute } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
} from "lucide-react";

const WHATSAPP_NUMBER = "5511999999999";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export default function ImovelDetalhes() {
  const [, params] = useRoute("/imoveis/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: imovel, isLoading } = trpc.properties.getById.useQuery({ id });

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-96 rounded-lg bg-muted" />
            <div className="h-8 w-2/3 rounded bg-muted" />
            <div className="h-4 w-1/3 rounded bg-muted" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!imovel) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Building2 className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Imóvel não encontrado</h1>
          <p className="mb-6 text-muted-foreground">
            O imóvel que você procura não existe ou foi removido.
          </p>
          <Link href="/imoveis">
            <Button>Ver Todos os Imóveis</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const fotos = imovel.fotos ? JSON.parse(imovel.fotos) : [];
  const temFotos = fotos.length > 0;
  const whatsappMessage = `Olá! Tenho interesse no imóvel: ${imovel.titulo}`;

  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % fotos.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + fotos.length) % fotos.length);
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-6">
          <Link href="/imoveis">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Imóveis
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="overflow-hidden">
              {temFotos ? (
                <div className="relative">
                  <div className="relative h-96 bg-muted">
                    <img
                      src={fotos[currentImageIndex]}
                      alt={`${imovel.titulo} - Foto ${currentImageIndex + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {fotos.length > 1 ? (
                      <>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute top-1/2 left-4 -translate-y-1/2"
                          onClick={prevImage}
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute top-1/2 right-4 -translate-y-1/2"
                          onClick={nextImage}
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                          {currentImageIndex + 1} / {fotos.length}
                        </div>
                      </>
                    ) : null}
                  </div>
                  {fotos.length > 1 ? (
                    <div className="flex gap-2 overflow-x-auto p-4">
                      {fotos.map((foto: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                            index === currentImageIndex
                              ? "border-primary"
                              : "border-transparent hover:border-muted-foreground"
                          }`}
                        >
                          <img
                            src={foto}
                            alt={`Miniatura ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-96 items-center justify-center bg-muted">
                  <Building2 className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </Card>

            <Card>
              <CardContent className="space-y-6 p-6">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                      {imovel.finalidade === "venda"
                        ? "Venda"
                        : imovel.finalidade === "locacao"
                          ? "Locação"
                          : "Venda/Locação"}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 font-medium capitalize">
                      {imovel.tipo}
                    </span>
                  </div>
                  <h1 className="mb-2 text-2xl font-bold md:text-[1.75rem]">{imovel.titulo}</h1>
                  <div className="text-muted-foreground">
                    {imovel.endereco}
                    {imovel.numero ? `, ${imovel.numero}` : ""}
                    {imovel.bairro ? `, ${imovel.bairro}` : ""}, {imovel.cidade}/{imovel.estado}
                  </div>
                </div>

                <div className="grid gap-4 border-y py-4 sm:grid-cols-2 lg:grid-cols-4">
                  {imovel.area ? (
                    <div>
                      <p className="text-2xl font-bold">{imovel.area}</p>
                      <p className="text-xs text-muted-foreground">m²</p>
                    </div>
                  ) : null}
                  {imovel.quartos ? (
                    <div>
                      <p className="text-2xl font-bold">{imovel.quartos}</p>
                      <p className="text-xs text-muted-foreground">Quartos</p>
                    </div>
                  ) : null}
                  {imovel.banheiros ? (
                    <div>
                      <p className="text-2xl font-bold">{imovel.banheiros}</p>
                      <p className="text-xs text-muted-foreground">Banheiros</p>
                    </div>
                  ) : null}
                  {imovel.vagas ? (
                    <div>
                      <p className="text-2xl font-bold">{imovel.vagas}</p>
                      <p className="text-xs text-muted-foreground">Vagas</p>
                    </div>
                  ) : null}
                </div>

                {imovel.descricao ? (
                  <div>
                    <h2 className="mb-3 text-xl font-bold">Descrição</h2>
                    <p className="whitespace-pre-line text-muted-foreground">{imovel.descricao}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-4">
              <CardContent className="space-y-4 p-6">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Valor</p>
                  <p className="text-3xl font-bold text-primary">{formatCurrency(imovel.valor)}</p>
                  {imovel.valorLocacao && imovel.finalidade !== "venda" ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Locação: {formatCurrency(imovel.valorLocacao)}/mês
                    </p>
                  ) : null}
                </div>

                <Button className="w-full gap-2" size="lg" asChild>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Falar com Corretor
                  </a>
                </Button>

                <Link href="/contato">
                  <Button variant="outline" className="w-full" size="lg">
                    Enviar Mensagem
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {imovel.latitude && imovel.longitude ? (
              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <MapPin className="h-5 w-5 text-primary" />
                    Localização
                  </h3>
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Mapa em breve</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}
