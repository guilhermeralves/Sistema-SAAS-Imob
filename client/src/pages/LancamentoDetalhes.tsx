import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import Layout from "@/components/Layout";
import AddressFields, { type AddressValue } from "@/components/AddressFields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { isStaffRole } from "@shared/auth";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function LancamentoDetalhes() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const canEdit = isStaffRole(user?.role);
  const id = Number(params.id);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.launches.getById.useQuery(
    { id },
    { enabled: Number.isFinite(id) }
  );

  const [nome, setNome] = useState("");
  const [addr, setAddr] = useState<AddressValue>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setNome(data.nome ?? "");
    setAddr({
      cep: data.cep,
      endereco: data.endereco,
      numero: data.numero,
      complemento: null,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
    });
  }, [data]);

  const update = trpc.launches.update.useMutation({
    onSuccess: () => {
      toast.success("Lançamento atualizado.");
      utils.launches.getById.invalidate({ id });
      utils.launches.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const uploadPhoto = trpc.launches.uploadPhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto enviada.");
      utils.launches.getById.invalidate({ id });
      utils.launches.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const removePhoto = trpc.launches.removePhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto removida.");
      utils.launches.getById.invalidate({ id });
      utils.launches.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const handleFilePick = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadPhoto.mutateAsync({ id, dataUrl });
    } catch {
      toast.error("Falha ao ler o arquivo.");
    }
  };

  const handleSave = () => {
    if (!nome.trim() || nome.trim().length < 2) {
      toast.error("Informe o nome do lançamento.");
      return;
    }
    if (!addr.cidade || !addr.estado || !addr.endereco) {
      toast.error("Preencha endereço, cidade e UF.");
      return;
    }
    update.mutate({
      id,
      nome: nome.trim(),
      cep: addr.cep ?? null,
      endereco: addr.endereco,
      numero: addr.numero ?? null,
      bairro: addr.bairro ?? null,
      cidade: addr.cidade,
      estado: (addr.estado ?? "").toUpperCase(),
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl p-6">
          <p className="text-sm text-muted-foreground">
            Lançamento não encontrado.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/lancamentos")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <div>
          <Link href="/lancamentos">
            <a className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar aos lançamentos
            </a>
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{data.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {[data.endereco, data.cidade, data.estado]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* Foto do empreendimento */}
        <Card>
          <CardHeader>
            <CardTitle>Foto do empreendimento</CardTitle>
            <CardDescription>
              Essa é a imagem que aparece no card da listagem de Lançamentos.
              Formato recomendado: 16:9 (paisagem), até 20 MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.fotos ? (
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={data.fotos}
                  alt={data.nome}
                  className="max-h-96 w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="h-8 w-8" />
                  <p className="text-sm">Sem foto cadastrada</p>
                </div>
              </div>
            )}

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void handleFilePick(f);
                  }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadPhoto.isPending}
                >
                  {uploadPhoto.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {data.fotos ? "Trocar foto" : "Enviar foto"}
                </Button>
                {data.fotos ? (
                  <Button
                    variant="outline"
                    onClick={() => removePhoto.mutate({ id })}
                    disabled={removePhoto.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Dados básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do lançamento</CardTitle>
            <CardDescription>
              Nome e endereço. Os demais campos comerciais (valores, área,
              quartos etc.) permanecem no formulário atual de cadastro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome do lançamento</Label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Endereço</p>
              <AddressFields
                value={addr}
                onChange={setAddr}
                required
              />
            </div>

            {canEdit ? (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={update.isPending}>
                  {update.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
