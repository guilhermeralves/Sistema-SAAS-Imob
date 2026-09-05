import { useEffect, useMemo, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/_core/hooks/useAuth";
import { isStaffRole } from "@shared/auth";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Lista canônica de áreas comuns oferecidas por lançamentos.
 * Mantida em ordem intencional (áreas de lazer primeiro, serviços depois).
 */
const AREAS_COMUNS_CATALOG = [
  "Piscina adulto",
  "Piscina infantil",
  "Piscina aquecida",
  "Academia",
  "Playground",
  "Brinquedoteca",
  "Salão de festas",
  "Salão de jogos",
  "Salão gourmet",
  "Churrasqueira",
  "Espaço gourmet",
  "Sauna",
  "Spa",
  "Quadra poliesportiva",
  "Quadra de tênis",
  "Beach tênis",
  "Espaço fitness ao ar livre",
  "Cinema",
  "Coworking",
  "Espaço pet",
  "Bicicletário",
  "Portaria 24h",
  "Câmeras de segurança",
  "Gerador",
  "Área verde/jardim",
  "Espaço zen",
];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parseAreas(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatFullAddress(data: {
  endereco: string;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string;
  estado?: string;
  cep?: string | null;
}) {
  const parts: string[] = [];
  let street = data.endereco;
  if (data.numero) street += `, ${data.numero}`;
  parts.push(street);
  if (data.bairro) parts.push(data.bairro);
  const cityUf = [data.cidade, data.estado].filter(Boolean).join("/");
  if (cityUf) parts.push(cityUf);
  if (data.cep) parts.push(`CEP ${data.cep}`);
  return parts.join(" · ");
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
  const { data: files } = trpc.launches.listFiles.useQuery(
    { launchId: id },
    { enabled: Number.isFinite(id) }
  );

  const [editMode, setEditMode] = useState(false);
  const [nome, setNome] = useState("");
  const [numeroTorres, setNumeroTorres] = useState<string>("");
  const [addr, setAddr] = useState<AddressValue>({});
  const [areasComuns, setAreasComuns] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setNome(data.nome ?? "");
    setNumeroTorres(
      data.numeroTorres != null ? String(data.numeroTorres) : ""
    );
    setAddr({
      cep: data.cep,
      endereco: data.endereco,
      numero: data.numero,
      complemento: null,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
    });
    setAreasComuns(parseAreas(data.areasComuns));
  }, [data]);

  const invalidateAll = () => {
    utils.launches.getById.invalidate({ id });
    utils.launches.list.invalidate();
    utils.launches.listFiles.invalidate({ launchId: id });
  };

  const update = trpc.launches.update.useMutation({
    onSuccess: () => {
      toast.success("Lançamento atualizado.");
      setEditMode(false);
      invalidateAll();
    },
    onError: e => toast.error(e.message),
  });

  const uploadPhoto = trpc.launches.uploadPhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto atualizada.");
      invalidateAll();
    },
    onError: e => toast.error(e.message),
  });

  const removePhoto = trpc.launches.removePhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto removida.");
      invalidateAll();
    },
    onError: e => toast.error(e.message),
  });

  const removeLaunch = trpc.launches.remove.useMutation({
    onSuccess: () => {
      toast.success("Lançamento removido.");
      utils.launches.list.invalidate();
      setLocation("/lancamentos");
    },
    onError: e => toast.error(e.message),
  });

  const uploadFile = trpc.launches.uploadFile.useMutation({
    onSuccess: () => {
      toast.success("Arquivo enviado.");
      invalidateAll();
    },
    onError: e => toast.error(e.message),
  });

  const deleteFile = trpc.launches.deleteFile.useMutation({
    onSuccess: () => {
      toast.success("Arquivo removido.");
      invalidateAll();
    },
    onError: e => toast.error(e.message),
  });

  const handlePhotoPick = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) {
      if (file) toast.error("Selecione uma imagem.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadPhoto.mutateAsync({ id, dataUrl });
    } catch {
      toast.error("Falha ao ler o arquivo.");
    }
  };

  const handleFilesPick = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      try {
        const dataUrl = await fileToDataUrl(file);
        await uploadFile.mutateAsync({
          launchId: id,
          dataUrl,
          originalName: file.name,
        });
      } catch (err) {
        toast.error(
          `${file.name}: ${err instanceof Error ? err.message : "falha"}`
        );
      }
    }
  };

  const toggleArea = (area: string) => {
    setAreasComuns(current =>
      current.includes(area)
        ? current.filter(x => x !== area)
        : [...current, area]
    );
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
      numeroTorres:
        numeroTorres.trim() === "" ? null : parseInt(numeroTorres, 10),
      areasComuns: areasComuns.length ? JSON.stringify(areasComuns) : null,
    });
  };

  const savedAreas = useMemo(
    () => parseAreas(data?.areasComuns),
    [data?.areasComuns]
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-5xl p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="mx-auto max-w-5xl p-6">
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
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <Link href="/lancamentos">
          <a className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar aos lançamentos
          </a>
        </Link>

        {/* ── HERO ── nome à esquerda, foto miniatura à direita */}
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-700" />
              <h1 className="truncate text-2xl font-bold">{data.nome}</h1>
            </div>
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="line-clamp-2">{formatFullAddress(data)}</span>
            </p>
            {data.construtora ? (
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {data.construtora}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {canEdit ? (
                <Button
                  size="sm"
                  variant={editMode ? "outline" : "default"}
                  onClick={() => setEditMode(v => !v)}
                >
                  {editMode ? (
                    <>
                      <X className="mr-2 h-4 w-4" /> Cancelar edição
                    </>
                  ) : (
                    <>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </>
                  )}
                </Button>
              ) : null}
              {editMode ? (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={update.isPending}
                >
                  {update.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar alterações
                </Button>
              ) : null}
              {canEdit && !editMode ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remover
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        Remover "{data.nome}"?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        O lançamento sai da listagem imediatamente. O registro
                        fica preservado no banco (soft-delete).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeLaunch.mutate({ id })}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </div>

          {/* Foto miniatura à direita */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-32 w-48 shrink-0 overflow-hidden rounded-lg border bg-muted md:h-36 md:w-56">
              {data.fotos ? (
                <img
                  src={data.fotos}
                  alt={data.nome}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>
            {canEdit ? (
              <div className="flex gap-1">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void handlePhotoPick(f);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadPhoto.isPending}
                >
                  {uploadPhoto.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  <span className="ml-1 text-xs">
                    {data.fotos ? "Trocar" : "Enviar"}
                  </span>
                </Button>
                {data.fotos ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removePhoto.mutate({ id })}
                    disabled={removePhoto.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── INFORMAÇÕES DO EMPREENDIMENTO ── */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do empreendimento</CardTitle>
            <CardDescription>
              Dados cadastrais e características. Use o botão "Editar" no topo
              para alterar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nome / Torres */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label>Nome do lançamento</Label>
                {editMode ? (
                  <Input
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                  />
                ) : (
                  <p className="text-sm">{data.nome}</p>
                )}
              </div>
              <div>
                <Label>Número de torres</Label>
                {editMode ? (
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={numeroTorres}
                    onChange={e => setNumeroTorres(e.target.value)}
                    placeholder="ex: 3"
                  />
                ) : (
                  <p className="text-sm">
                    {data.numeroTorres != null ? data.numeroTorres : "—"}
                  </p>
                )}
              </div>
            </div>

            {/* Endereço */}
            <div>
              <p className="mb-2 text-sm font-medium">Endereço</p>
              {editMode ? (
                <AddressFields value={addr} onChange={setAddr} required />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formatFullAddress(data)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── ÁREAS COMUNS ── */}
        <Card>
          <CardHeader>
            <CardTitle>Áreas comuns</CardTitle>
            <CardDescription>
              {editMode
                ? "Marque as áreas disponíveis no empreendimento."
                : (savedAreas.length
                    ? "Comodidades oferecidas."
                    : "Nenhuma área comum cadastrada.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {AREAS_COMUNS_CATALOG.map(area => {
                  const checked = areasComuns.includes(area);
                  return (
                    <label
                      key={area}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleArea(area)}
                      />
                      <span className="text-sm">{area}</span>
                    </label>
                  );
                })}
              </div>
            ) : savedAreas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {savedAreas.map(area => (
                  <span
                    key={area}
                    className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  >
                    {area}
                  </span>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* ── ARQUIVOS ── */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Arquivos do empreendimento</CardTitle>
                <CardDescription>
                  PDFs, plantas, book, imagens e outros documentos. Aceita
                  PDF/Word/Excel/PowerPoint/imagens até 20MB cada.
                </CardDescription>
              </div>
              {canEdit ? (
                <>
                  <input
                    ref={filesInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv"
                    className="hidden"
                    onChange={e => {
                      const list = e.target.files;
                      e.target.value = "";
                      void handleFilesPick(list);
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => filesInputRef.current?.click()}
                    disabled={uploadFile.isPending}
                  >
                    {uploadFile.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Enviar arquivos
                  </Button>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {(files ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum arquivo enviado ainda.
              </div>
            ) : (
              <ul className="divide-y">
                {(files ?? []).map(f => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-3 hover:text-emerald-700"
                    >
                      {f.mimeType.startsWith("image/") ? (
                        <ImageIcon className="h-5 w-5 flex-shrink-0" />
                      ) : f.mimeType === "application/pdf" ? (
                        <FileText className="h-5 w-5 flex-shrink-0 text-red-600" />
                      ) : (
                        <Paperclip className="h-5 w-5 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {f.originalName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(f.sizeBytes)} · {f.mimeType}
                        </p>
                      </div>
                    </a>
                    {canEdit ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                            title="Remover arquivo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remover "{f.originalName}"?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              O arquivo será apagado do servidor e deixará de
                              ficar disponível para download.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteFile.mutate({ id: f.id })}
                              className="bg-red-600 text-white hover:bg-red-700"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
