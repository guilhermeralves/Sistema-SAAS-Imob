import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Building2, MapPin, Bed, Bath, Car, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";

/**
 * Página de Listagem de Imóveis
 * 
 * Lista todos os imóveis disponíveis com sistema de filtros.
 * 
 * EDIÇÃO:
 * - Para adicionar novos filtros: adicione campos no estado filters
 * - Para modificar opções de filtro: edite os arrays TIPOS, FINALIDADES, etc.
 */

// ========== ÁREA DE EDIÇÃO - OPÇÕES DE FILTRO ==========
const TIPOS = [
  { value: "todos", label: "Todos os Tipos" },
  { value: "casa", label: "Casa" },
  { value: "apartamento", label: "Apartamento" },
  { value: "terreno", label: "Terreno" },
  { value: "comercial", label: "Comercial" },
];

const FINALIDADES = [
  { value: "todos", label: "Todas" },
  { value: "venda", label: "Venda" },
  { value: "locacao", label: "Locação" },
];
// ========== FIM DA ÁREA DE EDIÇÃO ==========

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export default function Imoveis() {
  const { data: imoveis, isLoading } = trpc.properties.list.useQuery();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    tipo: "todos",
    finalidade: "todos",
    cidade: "",
    bairro: "",
    valorMin: "",
    valorMax: "",
  });

  // Aplicar filtros
  const imoveisFiltrados = imoveis?.filter((imovel) => {
    if (filters.tipo !== "todos" && imovel.tipo !== filters.tipo) return false;
    if (filters.finalidade !== "todos" && imovel.finalidade !== filters.finalidade) return false;
    if (filters.cidade && !imovel.cidade.toLowerCase().includes(filters.cidade.toLowerCase())) return false;
    if (filters.bairro && !imovel.bairro?.toLowerCase().includes(filters.bairro.toLowerCase())) return false;
    if (filters.valorMin && imovel.valor < parseInt(filters.valorMin) * 100) return false;
    if (filters.valorMax && imovel.valor > parseInt(filters.valorMax) * 100) return false;
    return true;
  });

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Imóveis Disponíveis</h1>
          <p className="text-muted-foreground">
            Encontre o imóvel perfeito para você
          </p>
        </div>

        {/* Filtros */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" />
                Filtros
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden"
              >
                {showFilters ? "Ocultar" : "Mostrar"}
              </Button>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 ${showFilters ? "" : "hidden md:grid"}`}>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={filters.tipo} onValueChange={(value) => setFilters({ ...filters, tipo: value })}>
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="finalidade">Finalidade</Label>
                <Select value={filters.finalidade} onValueChange={(value) => setFilters({ ...filters, finalidade: value })}>
                  <SelectTrigger id="finalidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINALIDADES.map((finalidade) => (
                      <SelectItem key={finalidade.value} value={finalidade.value}>
                        {finalidade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  placeholder="Ex: São Paulo"
                  value={filters.cidade}
                  onChange={(e) => setFilters({ ...filters, cidade: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  placeholder="Ex: Centro"
                  value={filters.bairro}
                  onChange={(e) => setFilters({ ...filters, bairro: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valorMin">Valor Mínimo</Label>
                <Input
                  id="valorMin"
                  type="number"
                  maxLength={12}
                  value={filters.valorMin}
                  onChange={(e) => setFilters({ ...filters, valorMin: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valorMax">Valor Máximo</Label>
                <Input
                  id="valorMax"
                  type="number"
                  maxLength={12}
                  value={filters.valorMax}
                  onChange={(e) => setFilters({ ...filters, valorMax: e.target.value })}
                />
              </div>
            </div>

            {(filters.tipo !== "todos" || filters.finalidade !== "todos" || filters.cidade || filters.bairro || filters.valorMin || filters.valorMax) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({
                  tipo: "todos",
                  finalidade: "todos",
                  cidade: "",
                  bairro: "",
                  valorMin: "",
                  valorMax: "",
                })}
                className="mt-4"
              >
                Limpar Filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="mb-4 text-sm text-muted-foreground">
          {imoveisFiltrados?.length || 0} imóve{imoveisFiltrados?.length === 1 ? "l encontrado" : "is encontrados"}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="h-48 bg-muted animate-pulse" />
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : imoveisFiltrados && imoveisFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {imoveisFiltrados.map((imovel) => {
              const fotos = imovel.fotos ? JSON.parse(imovel.fotos) : [];
              const primeiraFoto = fotos[0] || "/placeholder-property.jpg";

              return (
                <Link key={imovel.id} href={`/imoveis/${imovel.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={primeiraFoto}
                        alt={imovel.titulo}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                        {imovel.finalidade === "venda" ? "Venda" : imovel.finalidade === "locacao" ? "Locação" : "Venda/Locação"}
                      </div>
                      {imovel.destaque === 1 && (
                        <div className="absolute top-3 left-3 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          Destaque
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-lg mb-2 line-clamp-1">{imovel.titulo}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {imovel.bairro ? `${imovel.bairro}, ` : ""}{imovel.cidade}, {imovel.estado}
                        </span>
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
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum imóvel encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Tente ajustar os filtros para encontrar mais resultados
            </p>
            <Button
              variant="outline"
              onClick={() => setFilters({
                tipo: "todos",
                finalidade: "todos",
                cidade: "",
                bairro: "",
                valorMin: "",
                valorMax: "",
              })}
            >
              Limpar Filtros
            </Button>
          </Card>
        )}
      </div>
    </Layout>
  );
}
