import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Coins, Loader2, Package, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ProductForm = {
  id?: number;
  nome: string;
  descricao: string;
  categoria: "produto" | "viagem" | "servico";
  fotos: string[];
  tokenPrice: string;
  brlPriceCents: string;
  estoque: string;
  isActive: boolean;
};

const emptyForm = (): ProductForm => ({
  nome: "",
  descricao: "",
  categoria: "produto",
  fotos: [],
  tokenPrice: "",
  brlPriceCents: "",
  estoque: "",
  isActive: true,
});

function parseFotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AdminLoja() {
  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.store.admin.listProducts.useQuery();

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; nome: string } | null>(null);

  const createProduct = trpc.store.admin.createProduct.useMutation({
    onSuccess: async () => {
      toast.success("Produto criado.");
      close();
      await utils.store.admin.listProducts.invalidate();
    },
    onError: e => toast.error(e.message || "Falha ao criar."),
  });
  const updateProduct = trpc.store.admin.updateProduct.useMutation({
    onSuccess: async () => {
      toast.success("Produto atualizado.");
      close();
      await utils.store.admin.listProducts.invalidate();
    },
    onError: e => toast.error(e.message || "Falha ao atualizar."),
  });
  const deleteProduct = trpc.store.admin.deleteProduct.useMutation({
    onSuccess: async () => {
      toast.success("Produto removido.");
      setConfirmDelete(null);
      await utils.store.admin.listProducts.invalidate();
    },
    onError: e => toast.error(e.message || "Falha ao remover."),
  });
  const uploadImage = trpc.store.admin.uploadProductImage.useMutation();

  function close() {
    setOpenForm(false);
    setForm(emptyForm());
  }

  function openNew() {
    setForm(emptyForm());
    setOpenForm(true);
  }

  function openEdit(id: number) {
    const p = products?.find(x => x.id === id);
    if (!p) return;
    setForm({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao ?? "",
      categoria: (p.categoria as ProductForm["categoria"]) || "produto",
      fotos: parseFotos(p.fotos),
      tokenPrice: String(p.tokenPrice ?? 0),
      brlPriceCents: String(p.brlPriceCents ?? 0),
      estoque: p.estoque == null ? "" : String(p.estoque),
      isActive: p.isActive === 1,
    });
    setOpenForm(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await uploadImage.mutateAsync({ dataUrl });
      setForm(cur => ({ ...cur, fotos: [...cur.fotos, res.url] }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setForm(cur => ({ ...cur, fotos: cur.fotos.filter(u => u !== url) }));
  }

  function submit() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    const tokenPrice = Number(form.tokenPrice || "0");
    if (!Number.isInteger(tokenPrice) || tokenPrice < 0) {
      toast.error("Preço em tokens inválido.");
      return;
    }
    const brlPriceCents = Number(form.brlPriceCents || "0");
    if (!Number.isInteger(brlPriceCents) || brlPriceCents < 0) {
      toast.error("Preço adicional em centavos inválido.");
      return;
    }
    const estoque = form.estoque.trim() === "" ? null : Number(form.estoque);
    if (estoque !== null && (!Number.isInteger(estoque) || estoque < 0)) {
      toast.error("Estoque inválido.");
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria,
      fotos: form.fotos,
      tokenPrice,
      brlPriceCents,
      estoque,
      isActive: form.isActive ? 1 : 0,
    };

    if (form.id) {
      updateProduct.mutate({ id: form.id, ...payload });
    } else {
      createProduct.mutate(payload);
    }
  }

  const isPending = createProduct.isPending || updateProduct.isPending;

  const productsWithFotos = useMemo(() => {
    return (products ?? []).map(p => ({ ...p, fotosList: parseFotos(p.fotos) }));
  }, [products]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gerenciar Loja</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre produtos, viagens e serviços que os corretores podem
              trocar pelos tokens acumulados.
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Produtos cadastrados</CardTitle>
            <CardDescription>
              {productsWithFotos.length} item(ns) — clique em um para editar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : productsWithFotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum produto cadastrado ainda. Clique em "Novo produto"
                  para começar a montar sua vitrine.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {productsWithFotos.map(p => (
                  <div
                    key={p.id}
                    className="flex flex-col overflow-hidden rounded-md border border-border bg-card"
                  >
                    <div className="aspect-video bg-muted">
                      {p.fotosList[0] ? (
                        <img
                          src={p.fotosList[0]}
                          alt={p.nome}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 font-medium">{p.nome}</p>
                        {p.isActive !== 1 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Inativo
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {p.descricao || "—"}
                      </p>
                      <div className="mt-auto flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 font-semibold text-emerald-700">
                          <Coins className="h-4 w-4" /> {p.tokenPrice}
                        </div>
                        {p.brlPriceCents > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            + {formatBRL(p.brlPriceCents)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openEdit(p.id)}
                        >
                          <Pencil className="mr-1 h-4 w-4" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setConfirmDelete({ id: p.id, nome: p.nome })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={openForm} onOpenChange={o => !o && close()}>
        <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>
              Preencha os dados. Fotos são opcionais mas melhoram muito a vitrine.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-nome">Nome</Label>
              <Input
                id="p-nome"
                value={form.nome}
                onChange={e => setForm(c => ({ ...c, nome: e.target.value }))}
                placeholder="Ex: Vale-viagem Gramado 3 diárias"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-descricao">Descrição</Label>
              <Textarea
                id="p-descricao"
                value={form.descricao}
                onChange={e => setForm(c => ({ ...c, descricao: e.target.value }))}
                placeholder="Detalhes do prêmio: o que inclui, regras, validade..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={v =>
                    setForm(c => ({ ...c, categoria: v as ProductForm["categoria"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produto">Produto</SelectItem>
                    <SelectItem value="viagem">Viagem</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.isActive ? "1" : "0"}
                  onValueChange={v => setForm(c => ({ ...c, isActive: v === "1" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Ativo (visível na vitrine)</SelectItem>
                    <SelectItem value="0">Inativo (oculto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="p-token">Preço em tokens</Label>
                <Input
                  id="p-token"
                  inputMode="numeric"
                  value={form.tokenPrice}
                  onChange={e => setForm(c => ({ ...c, tokenPrice: e.target.value.replace(/\D/g, "") }))}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-brl">PIX adicional (centavos)</Label>
                <Input
                  id="p-brl"
                  inputMode="numeric"
                  value={form.brlPriceCents}
                  onChange={e => setForm(c => ({ ...c, brlPriceCents: e.target.value.replace(/\D/g, "") }))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Se o item não é 100% em tokens, informe o complemento em PIX.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-estoque">Estoque</Label>
                <Input
                  id="p-estoque"
                  inputMode="numeric"
                  value={form.estoque}
                  onChange={e => setForm(c => ({ ...c, estoque: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Deixe vazio se ilimitado"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fotos</Label>
              <div className="flex flex-wrap gap-2">
                {form.fotos.map(url => (
                  <div key={url} className="relative h-24 w-24 overflow-hidden rounded-md border border-border">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      aria-label="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-emerald-600 hover:text-emerald-700">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span className="text-[10px]">Adicionar</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <Button className="w-full" onClick={submit} disabled={isPending || uploading}>
              {isPending ? "Salvando..." : form.id ? "Salvar alterações" : "Criar produto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir produto?</DialogTitle>
            <DialogDescription>
              "{confirmDelete?.nome}" será removido da vitrine e da lista. Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteProduct.mutate({ id: confirmDelete.id })}
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
