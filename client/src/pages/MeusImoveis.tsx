import { useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { Building2, Plus, Edit, Trash2, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

/**
 * Página Meus Imóveis
 * 
 * Gestão de imóveis para corretores.
 */

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export default function MeusImoveis() {
  const { user, loading, isAuthenticated } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingImovel, setEditingImovel] = useState<any>(null);

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "apartamento",
    finalidade: "venda",
    valor: "",
    valorLocacao: "",
    area: "",
    quartos: "",
    banheiros: "",
    vagas: "",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    destaque: "0",
  });

  const { data: imoveis, isLoading, refetch } = trpc.properties.myProperties.useQuery(
    undefined,
    { enabled: isAuthenticated && (user?.role === "corretor" || user?.role === "administrativo") }
  );

  const createProperty = trpc.properties.create.useMutation({
    onSuccess: () => {
      toast.success("Imóvel cadastrado com sucesso!");
      refetch();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar imóvel");
      console.error(error);
    },
  });

  const updateProperty = trpc.properties.update.useMutation({
    onSuccess: () => {
      toast.success("Imóvel atualizado com sucesso!");
      refetch();
      setDialogOpen(false);
      setEditingImovel(null);
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao atualizar imóvel");
    },
  });

  const deleteProperty = trpc.properties.delete.useMutation({
    onSuccess: () => {
      toast.success("Imóvel removido com sucesso!");
      refetch();
    },
    onError: (error) => {
      if (error instanceof TRPCClientError && error.data?.code === "FORBIDDEN") {
        toast.error("Corretores não podem excluir imóveis.");
        return;
      }
      toast.error("Erro ao remover imóvel");
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: "",
      descricao: "",
      tipo: "apartamento",
      finalidade: "venda",
      valor: "",
      valorLocacao: "",
      area: "",
      quartos: "",
      banheiros: "",
      vagas: "",
      endereco: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
      destaque: "0",
    });
  };

  const handleEdit = (imovel: any) => {
    setEditingImovel(imovel);
    setFormData({
      titulo: imovel.titulo,
      descricao: imovel.descricao || "",
      tipo: imovel.tipo,
      finalidade: imovel.finalidade,
      valor: (imovel.valor / 100).toString(),
      valorLocacao: imovel.valorLocacao ? (imovel.valorLocacao / 100).toString() : "",
      area: imovel.area?.toString() || "",
      quartos: imovel.quartos?.toString() || "",
      banheiros: imovel.banheiros?.toString() || "",
      vagas: imovel.vagas?.toString() || "",
      endereco: imovel.endereco,
      bairro: imovel.bairro || "",
      cidade: imovel.cidade,
      estado: imovel.estado,
      cep: imovel.cep || "",
      destaque: imovel.destaque.toString(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.titulo || !formData.valor || !formData.endereco || !formData.cidade || !formData.estado) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const data = {
      titulo: formData.titulo,
      descricao: formData.descricao,
      tipo: formData.tipo,
      finalidade: formData.finalidade,
      valor: Math.round(parseFloat(formData.valor) * 100),
      valorLocacao: formData.valorLocacao ? Math.round(parseFloat(formData.valorLocacao) * 100) : null,
      area: formData.area ? parseInt(formData.area) : null,
      quartos: formData.quartos ? parseInt(formData.quartos) : null,
      banheiros: formData.banheiros ? parseInt(formData.banheiros) : null,
      vagas: formData.vagas ? parseInt(formData.vagas) : null,
      endereco: formData.endereco,
      bairro: formData.bairro,
      cidade: formData.cidade,
      estado: formData.estado,
      cep: formData.cep,
      destaque: parseInt(formData.destaque),
      fotos: "[]", // TODO: Implementar upload de fotos
    };

    if (editingImovel) {
      updateProperty.mutate({ id: editingImovel.id, ...data });
    } else {
      createProperty.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este imóvel?")) {
      deleteProperty.mutate({ id });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground mb-6">
            Você precisa estar autenticado para acessar esta página.
          </p>
          <Button asChild>
            <a href={getLoginUrl()}>Fazer Login</a>
          </Button>
        </div>
      </Layout>
    );
  }

  if (user?.role !== "corretor" && user?.role !== "administrativo") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
            Esta área é exclusiva para corretores e administradores.
          </p>
          <Button asChild>
            <a href="/">Voltar para Home</a>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Meus Imóveis</h1>
            <p className="text-muted-foreground">
              Gerencie seus imóveis cadastrados
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingImovel(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Imóvel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingImovel ? "Editar Imóvel" : "Cadastrar Novo Imóvel"}</DialogTitle>
                <DialogDescription>
                  Preencha as informações do imóvel
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="titulo">Título *</Label>
                  <Input
                    id="titulo"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ex: Apartamento 3 quartos no Centro"
                  />
                </div>

                <div>
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casa">Casa</SelectItem>
                      <SelectItem value="apartamento">Apartamento</SelectItem>
                      <SelectItem value="terreno">Terreno</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="finalidade">Finalidade *</Label>
                  <Select value={formData.finalidade} onValueChange={(value) => setFormData({ ...formData, finalidade: value })}>
                    <SelectTrigger id="finalidade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venda">Venda</SelectItem>
                      <SelectItem value="locacao">Locação</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="valor">Valor (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    placeholder="500000"
                  />
                </div>

                <div>
                  <Label htmlFor="valorLocacao">Valor Locação (R$)</Label>
                  <Input
                    id="valorLocacao"
                    type="number"
                    value={formData.valorLocacao}
                    onChange={(e) => setFormData({ ...formData, valorLocacao: e.target.value })}
                    placeholder="2000"
                  />
                </div>

                <div>
                  <Label htmlFor="area">Área (m²)</Label>
                  <Input
                    id="area"
                    type="number"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="quartos">Quartos</Label>
                  <Input
                    id="quartos"
                    type="number"
                    value={formData.quartos}
                    onChange={(e) => setFormData({ ...formData, quartos: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="banheiros">Banheiros</Label>
                  <Input
                    id="banheiros"
                    type="number"
                    value={formData.banheiros}
                    onChange={(e) => setFormData({ ...formData, banheiros: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="vagas">Vagas</Label>
                  <Input
                    id="vagas"
                    type="number"
                    value={formData.vagas}
                    onChange={(e) => setFormData({ ...formData, vagas: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="endereco">Endereço *</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado (UF) *</Label>
                  <Input
                    id="estado"
                    maxLength={2}
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                    placeholder="SP"
                  />
                </div>

                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="destaque">Destaque na Home?</Label>
                  <Select value={formData.destaque} onValueChange={(value) => setFormData({ ...formData, destaque: value })}>
                    <SelectTrigger id="destaque">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Não</SelectItem>
                      <SelectItem value="1">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Button
                    onClick={handleSubmit}
                    className="w-full"
                    disabled={createProperty.isPending || updateProperty.isPending}
                  >
                    {createProperty.isPending || updateProperty.isPending
                      ? "Salvando..."
                      : editingImovel
                      ? "Atualizar Imóvel"
                      : "Cadastrar Imóvel"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
        ) : imoveis && imoveis.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {imoveis.map((imovel) => (
              <Card key={imovel.id} className="overflow-hidden">
                <div className="h-48 bg-muted flex items-center justify-center">
                  <Building2 className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2 line-clamp-1">{imovel.titulo}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-4 w-4" />
                    <span className="line-clamp-1">{imovel.cidade}, {imovel.estado}</span>
                  </div>
                  <div className="text-2xl font-bold text-primary mb-4">
                    {formatCurrency(imovel.valor)}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(imovel)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(imovel.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum imóvel cadastrado</h3>
            <p className="text-muted-foreground mb-4">
              Comece cadastrando seu primeiro imóvel
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Imóvel
            </Button>
          </Card>
        )}
      </div>
    </Layout>
  );
}
