import { useState } from "react";
import { useRoute } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  MapPin,
  Bed,
  Bath,
  Car,
  Maximize,
  MessageCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

/**
 * Página de Detalhes do Imóvel
 * 
 * Exibe informações completas sobre um imóvel específico.
 * 
 * EDIÇÃO:
 * - Para modificar o número do WhatsApp: edite WHATSAPP_NUMBER
 */

// ========== ÁREA DE EDIÇÃO ==========
const WHATSAPP_NUMBER = "5511999999999";
// ========== FIM DA ÁREA DE EDIÇÃO ==========

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export default function ImovelDetalhes() {
  const [, params] = useRoute("/imoveis/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: imovel, isLoading } = trpc.properties.getById.useQuery({ id });

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-96 bg-muted rounded-lg" />
            <div className="h-8 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/3" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!imovel) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Imóvel não encontrado</h1>
          <p className="text-muted-foreground mb-6">
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

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % fotos.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + fotos.length) % fotos.length);
  };

  const whatsappMessage = `Olá! Tenho interesse no imóvel: ${imovel.titulo}`;

  return (
    <Layout>
      <div className="container py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/imoveis">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Imóveis
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Galeria de Fotos */}
            <Card className="overflow-hidden">
              {temFotos ? (
                <div className="relative">
                  <div className="relative h-96 bg-muted">
                    <img
                      src={fotos[currentImageIndex]}
                      alt={`${imovel.titulo} - Foto ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {fotos.length > 1 && (
                      <>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute left-4 top-1/2 -translate-y-1/2"
                          onClick={prevImage}
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          onClick={nextImage}
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                          {currentImageIndex + 1} / {fotos.length}
                        </div>
                      </>
                    )}
                  </div>
                  {fotos.length > 1 && (
                    <div className="p-4 flex gap-2 overflow-x-auto">
                      {fotos.map((foto: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden border-2 transition-colors ${
                            index === currentImageIndex
                              ? "border-primary"
                              : "border-transparent hover:border-muted-foreground"
                          }`}
                        >
                          <img
                            src={foto}
                            alt={`Miniatura ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-96 bg-muted flex items-center justify-center">
                  <Building2 className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </Card>

            {/* Informações */}
            <Card>
              <CardContent className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
                      {imovel.finalidade === "venda"
                        ? "Venda"
                        : imovel.finalidade === "locacao"
                        ? "Locação"
                        : "Venda/Locação"}
                    </span>
                    <span className="px-3 py-1 bg-muted rounded-full font-medium capitalize">
                      {imovel.tipo}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold mb-2">{imovel.titulo}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-5 w-5" />
                    <span>
                      {imovel.endereco}
                      {imovel.bairro && `, ${imovel.bairro}`}, {imovel.cidade}/{imovel.estado}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 py-4 border-y">
                  {imovel.area && (
                    <div className="flex items-center gap-2">
                      <Maximize className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{imovel.area}</p>
                        <p className="text-xs text-muted-foreground">m²</p>
                      </div>
                    </div>
                  )}
                  {imovel.quartos && (
                    <div className="flex items-center gap-2">
                      <Bed className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{imovel.quartos}</p>
                        <p className="text-xs text-muted-foreground">Quartos</p>
                      </div>
                    </div>
                  )}
                  {imovel.banheiros && (
                    <div className="flex items-center gap-2">
                      <Bath className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{imovel.banheiros}</p>
                        <p className="text-xs text-muted-foreground">Banheiros</p>
                      </div>
                    </div>
                  )}
                  {imovel.vagas && (
                    <div className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{imovel.vagas}</p>
                        <p className="text-xs text-muted-foreground">Vagas</p>
                      </div>
                    </div>
                  )}
                </div>

                {imovel.descricao && (
                  <div>
                    <h2 className="text-xl font-bold mb-3">Descrição</h2>
                    <p className="text-muted-foreground whitespace-pre-line">{imovel.descricao}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Preço e Contato */}
            <Card className="sticky top-4">
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor</p>
                  <p className="text-3xl font-bold text-primary">{formatCurrency(imovel.valor)}</p>
                  {imovel.valorLocacao && imovel.finalidade !== "venda" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Locação: {formatCurrency(imovel.valorLocacao)}/mês
                    </p>
                  )}
                </div>

                <Button
                  className="w-full gap-2"
                  size="lg"
                  asChild
                >
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

            {/* Localização */}
            {imovel.latitude && imovel.longitude && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Localização
                  </h3>
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Mapa em breve</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
