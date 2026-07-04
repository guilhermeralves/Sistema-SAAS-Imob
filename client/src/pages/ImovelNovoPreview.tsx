import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import ProtectedPropertyImage from "@/components/ProtectedPropertyImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { getPropertyImageFileNameFromUrl } from "@/lib/property-image";
import { parseMoneyCentsInput, formatMoneyFromCentsValue } from "@/lib/money";
import {
  clearNewPropertyDraft,
  loadNewPropertyDraft,
  loadNewPropertyDraftPhotos,
  saveNewPropertyDraftPhotos,
  type NewPropertyDraftData,
} from "@/lib/property-draft";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  MapPin,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const OWNER_EMAIL_CONFLICT_PREFIX = "OWNER_EMAIL_CONFLICT::";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Nao foi possivel ler o arquivo selecionado."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () =>
      reject(new Error("Nao foi possivel ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

export default function ImovelNovoPreview() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [draft, setDraft] = useState<NewPropertyDraftData | null>(() =>
    loadNewPropertyDraft()
  );
  const [photoUrls, setPhotoUrls] = useState<string[]>(() =>
    loadNewPropertyDraftPhotos()
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  const uploadPhotoMutation = trpc.properties.uploadPhoto.useMutation();
  const deleteUploadedPhotoMutation =
    trpc.properties.deleteUploadedPhoto.useMutation();
  const createPropertyMutation = trpc.properties.create.useMutation();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLocation("/login");
      return;
    }

    if (user.role !== "corretor" && user.role !== "administrativo") {
      setLocation("/imoveis");
      return;
    }
  }, [isAuthenticated, setLocation, user]);

  useEffect(() => {
    saveNewPropertyDraftPhotos(photoUrls);
  }, [photoUrls]);

  const hasPhotos = photoUrls.length > 0;
  const mainPhoto = hasPhotos ? photoUrls[currentImageIndex] : null;

  const displayPrice = useMemo(
    () =>
      formatMoneyFromCentsValue(parseMoneyCentsInput(draft?.valor ?? "") ?? 0),
    [draft?.valor]
  );

  const handleUploadPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;

    const validFiles = files.filter(file => file.type.startsWith("image/"));
    if (!validFiles.length) {
      toast.error("Selecione ao menos uma imagem valida.");
      return;
    }

    setUploading(true);
    try {
      for (const file of validFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        const uploaded = await uploadPhotoMutation.mutateAsync({
          fileName: file.name,
          dataUrl,
        });

        const reduction =
          uploaded.originalBytes > 0
            ? Math.max(
                0,
                100 -
                  Math.round(
                    (uploaded.optimizedBytes / uploaded.originalBytes) * 100
                  )
              )
            : 0;

        setPhotoUrls(current => [...current, uploaded.url]);
        toast.success(`Foto processada em WebP (${reduction}% menor).`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar a imagem."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const currentUrl = photoUrls[index];
    setPhotoUrls(current =>
      current.filter((_, currentIndex) => currentIndex !== index)
    );
    setCurrentImageIndex(current =>
      current === 0 ? 0 : Math.max(0, current - 1)
    );

    if (currentUrl && getPropertyImageFileNameFromUrl(currentUrl)) {
      try {
        await deleteUploadedPhotoMutation.mutateAsync({ url: currentUrl });
      } catch {
        // Mantemos silencioso para nao bloquear a edicao em caso de falha local.
      }
    }
  };

  const handleSaveProperty = async (confirmedOwnerEmailConflict = false) => {
    if (!draft) {
      toast.error("Rascunho nao encontrado.");
      return;
    }

    if (!photoUrls.length) {
      toast.warning("Adicione ao menos uma foto antes de salvar o imovel.");
      return;
    }

    if (user?.role === "administrativo" && !draft.idCorretor) {
      toast.error("Selecione o corretor responsavel antes de salvar.");
      return;
    }

    const isCondominiumProperty = draft.emCondominio === "sim";
    if (
      isCondominiumProperty &&
      (!draft.tipoCondominio || !draft.idCondominio)
    ) {
      toast.error("Selecione o tipo e o condominio antes de salvar.");
      return;
    }

    try {
      const isPartnership = draft.parceria === "sim";
      const owners = draft.owners?.length
        ? draft.owners
        : [
            {
              name: draft.ownerName,
              email: draft.ownerEmail,
              cpf: draft.ownerCpf,
              phone: draft.ownerPhone,
            },
          ];
      const [primaryOwner] = owners;
      const created = await createPropertyMutation.mutateAsync({
        titulo: draft.titulo,
        descricao: draft.descricao || null,
        tipo: draft.tipo,
        finalidade: draft.finalidade,
        valor: parseMoneyCentsInput(draft.valor) ?? 0,
        area: draft.area ? parseInt(draft.area, 10) : null,
        quartos: draft.quartos ? parseInt(draft.quartos, 10) : null,
        banheiros: draft.banheiros ? parseInt(draft.banheiros, 10) : null,
        vagas: draft.vagas ? parseInt(draft.vagas, 10) : null,
        endereco: draft.endereco,
        numero: draft.numero || null,
        bairro: draft.bairro || null,
        cidade: draft.cidade,
        estado: draft.estado,
        cep: draft.cep || null,
        fotos: JSON.stringify(photoUrls),
        idCorretor: draft.idCorretor ? Number(draft.idCorretor) : undefined,
        emCondominio: isCondominiumProperty,
        tipoCondominio: isCondominiumProperty
          ? (draft.tipoCondominio as "casa" | "apartamento")
          : null,
        idCondominio: isCondominiumProperty ? Number(draft.idCondominio) : null,
        parceria: isPartnership,
        parceriaNome: isPartnership ? draft.parceriaNome : null,
        parceriaTelefone: isPartnership ? draft.parceriaTelefone : null,
        parceriaReferencia: isPartnership
          ? draft.parceriaReferencia || null
          : null,
        confirmedOwnerEmailConflict,
        owner: isPartnership
          ? undefined
          : {
              name: primaryOwner.name,
              email: primaryOwner.email.trim().toLowerCase() || undefined,
              cpf: primaryOwner.cpf || undefined,
              phone: primaryOwner.phone,
            },
        owners: isPartnership
          ? undefined
          : owners.map(owner => ({
              name: owner.name,
              email: owner.email.trim().toLowerCase() || undefined,
              cpf: owner.cpf || undefined,
              phone: owner.phone,
            })),
      });

      clearNewPropertyDraft();
      setDraft(null);
      toast.success("Imovel cadastrado com sucesso.");
      setLocation(created?.id ? `/imoveis/${created.id}` : "/imoveis");
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message ?? "")
          : "";

      if (message.startsWith(OWNER_EMAIL_CONFLICT_PREFIX)) {
        const warningMessage = message.replace(OWNER_EMAIL_CONFLICT_PREFIX, "");
        if (window.confirm(warningMessage)) {
          await handleSaveProperty(true);
        }
        return;
      }

      toast.error(message || "Nao foi possivel salvar o imovel.");
    }
  };

  if (!draft) {
    return (
      <Layout>
        <div className="container py-16">
          <Card className="rounded-[32px] border-white/70 bg-white/90 p-10 text-center shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
            <Building2 className="mx-auto mb-4 h-14 w-14 text-slate-400" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Nenhum rascunho de imóvel encontrado
            </h1>
            <p className="mt-2 text-slate-600">
              Volte em &quot;Novo Imóvel&quot;, preencha os dados e avance para
              adicionar fotos.
            </p>
            <div className="mt-6">
              <Button
                asChild
                className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
              >
                <Link href="/imoveis">Voltar para Imóveis</Link>
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-20">
        <div className="container py-8 md:py-10">
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 rounded-full border border-white/70 bg-white/80 text-slate-700 shadow-sm hover:bg-white"
              onClick={() => setLocation("/imoveis")}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para imóveis
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
            <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <Card className="overflow-hidden rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
                {hasPhotos && mainPhoto ? (
                  <div className="relative">
                    <div className="relative h-[420px] bg-slate-100 lg:h-[340px] xl:h-[390px]">
                      <ProtectedPropertyImage
                        src={mainPhoto}
                        alt={`${draft.titulo} - Foto ${currentImageIndex + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {photoUrls.length > 1 ? (
                        <>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute left-4 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-white/30 bg-white/85 text-slate-800 shadow-lg hover:bg-white"
                            onClick={() =>
                              setCurrentImageIndex(
                                prev =>
                                  (prev - 1 + photoUrls.length) %
                                  photoUrls.length
                              )
                            }
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute right-4 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-white/30 bg-white/85 text-slate-800 shadow-lg hover:bg-white"
                            onClick={() =>
                              setCurrentImageIndex(
                                prev => (prev + 1) % photoUrls.length
                              )
                            }
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                    {photoUrls.length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto p-4 md:p-5">
                        {photoUrls.map((url, index) => (
                          <div key={url} className="relative">
                            <button
                              type="button"
                              onClick={() => setCurrentImageIndex(index)}
                              className={`h-20 w-20 overflow-hidden rounded-2xl border-2 bg-white transition-all ${
                                index === currentImageIndex
                                  ? "border-emerald-600 shadow-md"
                                  : "border-transparent hover:border-slate-300"
                              }`}
                            >
                              <ProtectedPropertyImage
                                src={url}
                                variant="thumb"
                                alt={`Miniatura ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </button>
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="absolute -right-2 -top-2 h-6 w-6 rounded-full border border-white bg-white text-rose-600 hover:bg-rose-50"
                              onClick={() => handleRemovePhoto(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-[420px] items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,243,0.88))] lg:h-[340px] xl:h-[390px]">
                    <div className="text-center">
                      <ImagePlus className="mx-auto h-16 w-16 text-slate-400" />
                      <p className="mt-3 text-sm text-slate-500">
                        Nenhuma foto adicionada
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
                <CardContent className="space-y-6">
                  <div>
                    <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-950">
                      {draft.titulo}
                    </h1>
                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
                      <span>
                        {draft.endereco}
                        {draft.numero ? `, ${draft.numero}` : ""}
                        {draft.bairro ? `, ${draft.bairro}` : ""},{" "}
                        {draft.cidade}/{draft.estado}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-emerald-100/70 bg-[linear-gradient(180deg,rgba(245,250,247,0.95),rgba(255,255,255,0.92))] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-800">
                      Valor do imóvel
                    </p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-800">
                      {displayPrice}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 capitalize">
                      Tipo: {draft.tipo} • Finalidade: {draft.finalidade}
                    </p>
                    {draft.emCondominio === "sim" ? (
                      <p className="mt-1 text-sm text-slate-600 capitalize">
                        Em condominio • Tipo: {draft.tipoCondominio} •
                        Condominio #{draft.idCondominio}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white/80 p-4">
                    <Label
                      htmlFor="property-photo-upload"
                      className="text-sm font-medium text-slate-800"
                    >
                      Adicionar fotos (otimizadas automaticamente em WebP)
                    </Label>
                    <Input
                      id="property-photo-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadPhotos}
                      disabled={uploading || uploadPhotoMutation.isPending}
                    />
                    <p className="text-xs text-slate-500">
                      Imagens maiores sao redimensionadas para melhorar
                      velocidade de carregamento.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                      onClick={() => handleSaveProperty(false)}
                      disabled={createPropertyMutation.isPending}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {createPropertyMutation.isPending
                        ? "Salvando..."
                        : "Salvar Imóvel"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-slate-200"
                      onClick={() => setLocation("/imoveis")}
                    >
                      Continuar depois
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
