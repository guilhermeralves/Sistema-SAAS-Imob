import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useLocation, useRoute } from "wouter";
import Layout from "@/components/Layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import MoneyInput from "@/components/MoneyInput";
import ProtectedPropertyImage from "@/components/ProtectedPropertyImage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatStoredDate, formatStoredDateTime } from "@/lib/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { lookupCep } from "@/lib/cep";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { parseMoneyCentsInput } from "@/lib/money";
import { formatPhoneNumber } from "@/lib/phone";
import { trpc } from "@/lib/trpc";
import { useUnsavedChangesNavigationGuard } from "@/hooks/useUnsavedChangesNavigationGuard";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  ImagePlus,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const WHATSAPP_NUMBER = "5511999999999";
const CONTACT_INTEREST_PROPERTY_STORAGE_KEY = "afg:contact-interest-property";
const LEGAL_FIELD_CLASS = "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

type PropertyEditFormState = {
  titulo: string;
  descricao: string;
  tipo: string;
  finalidade: string;
  idCorretor: string;
  valor: string;
  valorLocacao: string;
  area: string;
  quartos: string;
  banheiros: string;
  vagas: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  destaque: string;
  ownerName: string;
  ownerEmail: string;
  ownerCpf: string;
  ownerPhone: string;
};

type LegalFormState = {
  inscricaoImobiliaria: string;
  matriculaRegistro: string;
  cartorioRegistro: string;
  registroMunicipal: string;
  informacoesLegais: string;
  observacoesJuridicas: string;
};

const EMPTY_LEGAL_FORM: LegalFormState = {
  inscricaoImobiliaria: "",
  matriculaRegistro: "",
  cartorioRegistro: "",
  registroMunicipal: "",
  informacoesLegais: "",
  observacoesJuridicas: "",
};

function createEmptyEditForm(): PropertyEditFormState {
  return {
    titulo: "",
    descricao: "",
    tipo: "apartamento",
    finalidade: "venda",
    idCorretor: "",
    valor: "",
    valorLocacao: "",
    area: "",
    quartos: "",
    banheiros: "",
    vagas: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    destaque: "0",
    ownerName: "",
    ownerEmail: "",
    ownerCpf: "",
    ownerPhone: "",
  };
}

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

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
    reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

function parsePropertyPhotos(value: string | null | undefined) {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildPropertyEditForm(property: {
  titulo?: string | null;
  descricao?: string | null;
  tipo?: string | null;
  finalidade?: string | null;
  idCorretor?: number | null;
  valor?: number | null;
  valorLocacao?: number | null;
  area?: number | null;
  quartos?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  destaque?: number | null;
  proprietario?: {
    name?: string | null;
    email?: string | null;
    cpf?: string | null;
    phone?: string | null;
  } | null;
}): PropertyEditFormState {
  return {
    titulo: property.titulo || "",
    descricao: property.descricao || "",
    tipo: property.tipo || "apartamento",
    finalidade: property.finalidade || "venda",
    idCorretor: property.idCorretor ? String(property.idCorretor) : "",
    valor: property.valor ? String(property.valor) : "",
    valorLocacao: property.valorLocacao ? String(property.valorLocacao) : "",
    area: property.area?.toString() || "",
    quartos: property.quartos?.toString() || "",
    banheiros: property.banheiros?.toString() || "",
    vagas: property.vagas?.toString() || "",
    endereco: property.endereco || "",
    numero: property.numero || "",
    bairro: property.bairro || "",
    cidade: property.cidade || "",
    estado: property.estado || "",
    cep: property.cep || "",
    destaque: String(property.destaque ?? 0),
    ownerName: property.proprietario?.name || "",
    ownerEmail: property.proprietario?.email || "",
    ownerCpf: property.proprietario?.cpf || "",
    ownerPhone: property.proprietario?.phone || "",
  };
}

function buildLegalForm(property: {
  inscricaoImobiliaria?: string | null;
  matriculaRegistro?: string | null;
  cartorioRegistro?: string | null;
  registroMunicipal?: string | null;
  informacoesLegais?: string | null;
  observacoesJuridicas?: string | null;
}): LegalFormState {
  return {
    inscricaoImobiliaria: property.inscricaoImobiliaria ?? "",
    matriculaRegistro: property.matriculaRegistro ?? "",
    cartorioRegistro: property.cartorioRegistro ?? "",
    registroMunicipal: property.registroMunicipal ?? "",
    informacoesLegais: property.informacoesLegais ?? "",
    observacoesJuridicas: property.observacoesJuridicas ?? "",
  };
}

function createPropertyEditSnapshot(
  editForm: PropertyEditFormState,
  legalForm: LegalFormState,
  photos: string[]
) {
  return JSON.stringify({
    editForm,
    legalForm,
    photos,
  });
}

function getPropertyStatusPresentation(status: string | null | undefined) {
  switch (status) {
    case "ativo":
      return {
        label: "Disponivel",
        className: "bg-emerald-100 text-emerald-700",
      };
    case "negociacao":
    case "em_negociacao":
    case "em negociacao":
    case "em negociação":
      return {
        label: "Em Negociacao",
        className: "bg-orange-100 text-orange-700",
      };
    case "inativo":
    case "vendido":
    case "alugado":
      return {
        label: "Indisponivel",
        className: "bg-red-100 text-red-700",
      };
    default:
      return {
        label: "Status",
        className: "bg-slate-100 text-slate-700",
      };
  }
}

export default function ImovelDetalhes() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/imoveis/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const fromRentalProposalId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("fromRentalProposal")
      : null;
  const shouldStartEditing =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("editar") === "1"
      : false;
  const backHref = fromRentalProposalId
    ? `/admin/modulos/locacoes/propostas/${fromRentalProposalId}`
    : "/imoveis";
  const backLabel = fromRentalProposalId ? "Voltar para proposta" : "Voltar para Imóveis";
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [locationChoiceOpen, setLocationChoiceOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [isEditingProperty, setIsEditingProperty] = useState(false);
  const [editForm, setEditForm] = useState<PropertyEditFormState>(createEmptyEditForm);
  const [editingPhotoUrls, setEditingPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const cepLookupTimeoutRef = useRef<number | null>(null);
  const [legalForm, setLegalForm] = useState<LegalFormState>(EMPTY_LEGAL_FORM);
  const [initialPropertyEditSnapshot, setInitialPropertyEditSnapshot] = useState("");
  const [documentPendingDelete, setDocumentPendingDelete] = useState<number | null>(null);
  const [documentPendingRename, setDocumentPendingRename] = useState<{ id: number; nomeArquivo: string } | null>(null);

  const { data: imovel, isLoading } = trpc.properties.getById.useQuery({ id });
  const { data: adminUsers } = trpc.admin.users.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "administrativo",
  });

  const activeResponsibleUsers = useMemo(
    () =>
      adminUsers?.filter(
        candidate =>
          (candidate.role === "corretor" || candidate.role === "administrativo") &&
          candidate.isActive === 1 &&
          !(candidate.role === "administrativo" && candidate.registrationSource === "bootstrap")
      ) || [],
    [adminUsers]
  );

  const canManageProperty =
    isAuthenticated &&
    user &&
    imovel &&
    (user.role === "administrativo" ||
      (user.role === "corretor" && (user.id === imovel.idCorretor || user.id === imovel.createdByUserId)));
  const isAdminViewer = user?.role === "administrativo";

  const propertyDocuments = trpc.properties.documents.useQuery(
    { idImovel: id },
    {
      enabled: Boolean((documentsOpen || (isEditingProperty && canManageProperty)) && canManageProperty && id),
      refetchOnWindowFocus: false,
    }
  );

  const addPropertyDocument = trpc.properties.addDocument.useMutation({
    onSuccess: async () => {
      toast.success("Documento anexado com sucesso!");
      setUploadingDocument(false);
      await propertyDocuments.refetch();
    },
    onError: error => {
      toast.error(error.message || "Erro ao anexar documento");
      setUploadingDocument(false);
    },
  });

  const deletePropertyDocument = trpc.properties.deleteDocument.useMutation({
    onSuccess: async () => {
      toast.success("Documento removido com sucesso!");
      setDocumentPendingDelete(null);
      await propertyDocuments.refetch();
    },
    onError: error => {
      toast.error(error.message || "Erro ao remover documento");
    },
  });

  const renamePropertyDocument = trpc.properties.renameDocument.useMutation({
    onSuccess: async () => {
      toast.success("Documento renomeado com sucesso!");
      setDocumentPendingRename(null);
      await propertyDocuments.refetch();
    },
    onError: error => {
      toast.error(error.message || "Erro ao renomear documento");
    },
  });

  const updateProperty = trpc.properties.update.useMutation({
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar o imovel.");
    },
  });

  const uploadPhotoMutation = trpc.properties.uploadPhoto.useMutation();
  const deleteUploadedPhotoMutation = trpc.properties.deleteUploadedPhoto.useMutation();
  const updateLegalDetails = trpc.properties.updateLegalDetails.useMutation({
    onError: error => {
      toast.error(error.message || "Nao foi possivel salvar os dados legais do imovel.");
    },
  });

  useEffect(() => {
    if (!imovel || isEditingProperty) return;

    setLegalForm(buildLegalForm(imovel));
  }, [imovel, isEditingProperty]);

  useEffect(() => {
    if (!shouldStartEditing || !imovel || !canManageProperty || isEditingProperty) return;

    const nextEditForm = buildPropertyEditForm(imovel);
    const nextLegalForm = buildLegalForm(imovel);
    const nextPhotos = parsePropertyPhotos(imovel.fotos);

    setEditForm(nextEditForm);
    setLegalForm(nextLegalForm);
    setEditingPhotoUrls(nextPhotos);
    setInitialPropertyEditSnapshot(createPropertyEditSnapshot(nextEditForm, nextLegalForm, nextPhotos));
    setIsEditingProperty(true);
  }, [canManageProperty, imovel, isEditingProperty, shouldStartEditing]);

  const propertyStatus = useMemo(
    () => getPropertyStatusPresentation(imovel?.status),
    [imovel?.status]
  );
  const shouldShowContactActions = !user || user.role === "cliente";
  const isBrokerViewer = user?.role === "corretor";
  const propertyOwners = imovel?.proprietarios?.length
    ? imovel.proprietarios
    : imovel?.proprietario
      ? [imovel.proprietario]
      : [];
  const shouldShowOwnerInVinculos = Boolean(
    isAdminViewer || (isBrokerViewer && propertyOwners.length > 0)
  );
  const shouldShowVinculosCard = Boolean(
    (isAdminViewer || isBrokerViewer) &&
      (imovel?.corretorResponsavel || (shouldShowOwnerInVinculos && propertyOwners.length > 0))
  );
  const currentPropertyEditSnapshot = useMemo(
    () => createPropertyEditSnapshot(editForm, legalForm, editingPhotoUrls),
    [editForm, editingPhotoUrls, legalForm]
  );
  const hasUnsavedPropertyChanges = Boolean(
    isEditingProperty &&
      initialPropertyEditSnapshot &&
      currentPropertyEditSnapshot !== initialPropertyEditSnapshot
  );
  const { requestNavigation, UnsavedChangesDialog } = useUnsavedChangesNavigationGuard({
    isDirty: hasUnsavedPropertyChanges,
    shouldAllowPath: path => path.startsWith(`/imoveis/${id}`),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-12">
          <div className="container py-10 md:py-12">
            <div className="animate-pulse space-y-5">
              <div className="h-10 w-40 rounded-full bg-white/80" />
              <div className="h-[420px] rounded-[32px] bg-white/80" />
              <div className="h-10 w-2/3 rounded bg-white/80" />
              <div className="h-5 w-1/2 rounded bg-white/70" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!imovel) {
    return (
      <Layout>
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-12">
          <div className="container py-16">
            <Card className="rounded-[32px] border-white/70 bg-white/90 p-12 text-center shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <Building2 className="mx-auto mb-4 h-16 w-16 text-slate-400" />
              <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-950">Imovel nao encontrado</h1>
              <p className="mb-6 text-slate-600">
                O imovel que voce procura nao existe ou foi removido.
              </p>
              <Link href="/imoveis">
                <Button className="rounded-full bg-slate-950 text-white hover:bg-slate-800">
                  Ver todos os imoveis
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  const fotos = imovel.fotos ? JSON.parse(imovel.fotos) : [];
  const temFotos = fotos.length > 0;
  const whatsappMessage = `Ola! Tenho interesse no imovel: ${imovel.titulo}`;
  const propertyAddressText = `${imovel.endereco}${imovel.numero ? `, ${imovel.numero}` : ""}${imovel.bairro ? `, ${imovel.bairro}` : ""}, ${imovel.cidade}/${imovel.estado}`;
  const encodedPropertyAddress = encodeURIComponent(propertyAddressText);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedPropertyAddress}`;
  const androidMapsAppUrl = `geo:0,0?q=${encodedPropertyAddress}`;
  const iosMapsAppUrl = `https://maps.apple.com/?q=${encodedPropertyAddress}`;

  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % fotos.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + fotos.length) % fotos.length);
  };

  const handleDocumentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF sao permitidos.");
      return;
    }

    setUploadingDocument(true);

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      addPropertyDocument.mutate({
        idImovel: imovel.id,
        nomeArquivo: file.name,
        urlArquivo: result,
        tipoArquivo: file.type,
      });
    };
    reader.onerror = () => {
      setUploadingDocument(false);
      toast.error("Nao foi possivel ler o arquivo selecionado.");
    };

    reader.readAsDataURL(file);
  };

  const resolveDocumentUrl = async (url: string) => {
    if (!url.startsWith("data:")) {
      return { href: url, revoke: () => {} };
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    return {
      href: blobUrl,
      revoke: () => URL.revokeObjectURL(blobUrl),
    };
  };

  const handleOpenDocument = async (url: string) => {
    // No Safari mobile, abrir a aba de forma assincrona costuma ser bloqueado.
    // Abrimos uma unica aba no gesto do clique e depois navegamos nela.
    const previewWindow = window.open("about:blank", "_blank");

    if (!previewWindow) {
      toast.error("Nao foi possivel abrir o documento em uma nova aba.");
      return;
    }

    try {
      const resolved = await resolveDocumentUrl(url);
      previewWindow.opener = null;
      previewWindow.location.replace(resolved.href);

      setTimeout(() => resolved.revoke(), 60_000);
    } catch (error) {
      if (!previewWindow.closed) {
        previewWindow.close();
      }
      console.error("[PropertyDocument] Erro ao abrir documento", error);
      toast.error("Nao foi possivel visualizar o documento.");
    }
  };

  const handleDownloadDocument = async (url: string, fileName: string) => {
    const resolved = await resolveDocumentUrl(url);
    const link = document.createElement("a");
    link.href = resolved.href;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => resolved.revoke(), 5_000);
  };

  const handleConfirmRenameDocument = () => {
    if (!documentPendingRename) return;

    const normalizedName = documentPendingRename.nomeArquivo.trim();
    if (!normalizedName) {
      toast.error("Informe um nome valido para o documento.");
      return;
    }

    renamePropertyDocument.mutate({
      id: documentPendingRename.id,
      nomeArquivo: normalizedName,
    });
  };

  const handleGoToPropertyDetails = () => {
    const targetPath =
      user?.role === "administrativo"
        ? `/admin/modulos/imoveis?highlightProperty=${imovel.id}`
        : `/meus-imoveis?highlightProperty=${imovel.id}`;

    requestNavigation(targetPath);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const handleEditProperty = () => {
    const nextEditForm = buildPropertyEditForm(imovel);
    const nextLegalForm = buildLegalForm(imovel);
    const nextPhotos = Array.isArray(fotos) ? fotos : [];

    setEditForm(nextEditForm);
    setLegalForm(nextLegalForm);
    setEditingPhotoUrls(nextPhotos);
    setInitialPropertyEditSnapshot(createPropertyEditSnapshot(nextEditForm, nextLegalForm, nextPhotos));
    setIsEditingProperty(true);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  const handleZipCodeChange = (value: string) => {
    const formattedValue = formatZipCode(value);
    setEditForm(current => ({ ...current, cep: formattedValue }));
    setCepError("");

    if (cepLookupTimeoutRef.current !== null) {
      window.clearTimeout(cepLookupTimeoutRef.current);
    }

    if (formattedValue.replace(/\D/g, "").length < 8) {
      setCepLoading(false);
      return;
    }

    setCepLoading(true);
    cepLookupTimeoutRef.current = window.setTimeout(async () => {
      const result = await lookupCep(formattedValue);

      if (result.status !== "success") {
        setCepError(
          result.status === "not_found"
            ? "CEP nao encontrado"
            : "Servico de CEP indisponivel no momento"
        );
        setCepLoading(false);
        return;
      }

      setEditForm(current => ({
        ...current,
        cep: formattedValue,
        endereco: result.data.endereco,
        bairro: result.data.bairro,
        cidade: result.data.cidade,
        estado: result.data.estado,
      }));
      setCepError("");
      setCepLoading(false);
    }, 500);
  };

  const handleUploadEditPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const validFiles = files.filter(file => file.type.startsWith("image/"));
    if (!validFiles.length) {
      toast.error("Selecione ao menos uma imagem valida.");
      return;
    }

    setUploadingPhoto(true);
    try {
      for (const file of validFiles) {
        const uploaded = await uploadPhotoMutation.mutateAsync({
          fileName: file.name,
          dataUrl: await readFileAsDataUrl(file),
        });
        setEditingPhotoUrls(current => [...current, uploaded.url]);
      }
      toast.success("Foto adicionada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemoveEditPhoto = async (index: number) => {
    const currentUrl = editingPhotoUrls[index];
    setEditingPhotoUrls(current => current.filter((_, currentIndex) => currentIndex !== index));

    try {
      if (currentUrl) {
        await deleteUploadedPhotoMutation.mutateAsync({ url: currentUrl });
      }
    } catch {
      // A imagem pode ser antiga/remota; remover a referencia no salvamento basta.
    }
  };

  const handlePhotoDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handlePhotoDrop = (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer.getData("text/plain"));

    if (!Number.isInteger(sourceIndex) || sourceIndex === targetIndex) return;

    setEditingPhotoUrls(current => {
      if (sourceIndex < 0 || sourceIndex >= current.length || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [movedPhoto] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedPhoto);
      return next;
    });
  };

  const submitPropertyEdit = async () => {
    const isRentalOnly = editForm.finalidade === "locacao";
    const mainValue = isRentalOnly ? editForm.valorLocacao : editForm.valor;

    if (!editForm.titulo || !mainValue || !editForm.endereco || !editForm.cidade || !editForm.estado) {
      toast.error("Preencha todos os campos obrigatorios.");
      return;
    }
    if (user?.role === "administrativo" && !editForm.idCorretor) {
      toast.error("Selecione o responsavel pelo imovel.");
      return;
    }
    if (!editForm.ownerName || !editForm.ownerPhone) {
      toast.error("Preencha nome e telefone do proprietario.");
      return;
    }
    if (editForm.ownerCpf && !isValidCpf(editForm.ownerCpf)) {
      toast.error("CPF do proprietario invalido.");
      return;
    }

    const editedOwner = {
      name: editForm.ownerName,
      email: editForm.ownerEmail.trim().toLowerCase() || undefined,
      cpf: editForm.ownerCpf ? normalizeCpf(editForm.ownerCpf) : undefined,
      phone: editForm.ownerPhone,
    };
    const ownersPayload = propertyOwners.length
      ? propertyOwners.map((owner: { name: string; email?: string | null; cpf?: string | null; phone: string }, index: number) =>
          index === 0
            ? editedOwner
            : {
                name: owner.name,
                email: owner.email?.trim().toLowerCase() || undefined,
                cpf: owner.cpf ? normalizeCpf(owner.cpf) : undefined,
                phone: owner.phone,
              }
        )
      : [editedOwner];

    try {
      await updateProperty.mutateAsync({
        id: imovel.id,
        titulo: editForm.titulo,
        descricao: editForm.descricao,
        tipo: editForm.tipo,
        finalidade: editForm.finalidade,
        valor: parseMoneyCentsInput(isRentalOnly ? editForm.valorLocacao : editForm.valor) ?? 0,
        valorLocacao: isRentalOnly || editForm.finalidade === "ambos"
          ? parseMoneyCentsInput(editForm.valorLocacao)
          : null,
        area: editForm.area ? parseInt(editForm.area, 10) : null,
        quartos: editForm.quartos ? parseInt(editForm.quartos, 10) : null,
        banheiros: editForm.banheiros ? parseInt(editForm.banheiros, 10) : null,
        vagas: editForm.vagas ? parseInt(editForm.vagas, 10) : null,
        endereco: editForm.endereco,
        numero: editForm.numero || null,
        bairro: editForm.bairro,
        cidade: editForm.cidade,
        estado: editForm.estado,
        cep: editForm.cep,
        destaque: parseInt(editForm.destaque, 10),
        idCorretor: editForm.idCorretor ? parseInt(editForm.idCorretor, 10) : undefined,
        fotos: JSON.stringify(editingPhotoUrls),
        owner: editedOwner,
        owners: ownersPayload,
      });

      if (isAdminViewer) {
        await updateLegalDetails.mutateAsync({
          id: imovel.id,
          inscricaoImobiliaria: legalForm.inscricaoImobiliaria || null,
          matriculaRegistro: legalForm.matriculaRegistro || null,
          cartorioRegistro: legalForm.cartorioRegistro || null,
          registroMunicipal: legalForm.registroMunicipal || null,
          informacoesLegais: legalForm.informacoesLegais || null,
          observacoesJuridicas: legalForm.observacoesJuridicas || null,
        });
      }

      setInitialPropertyEditSnapshot(createPropertyEditSnapshot(editForm, legalForm, editingPhotoUrls));
      toast.success("Imovel atualizado com sucesso.");
      setIsEditingProperty(false);
      await utils.properties.getById.invalidate({ id });
      await utils.properties.getByIdAdmin.invalidate({ id });
      await utils.properties.list.invalidate();
      await utils.properties.myProperties.invalidate();
    } catch {
      // As mensagens de erro sao tratadas nas mutations.
    }
  };

  const renderLegalDetailsCard = (editable = true) => {
    if (!isAdminViewer) return null;

    const readOnlyValue = (value: string) => value.trim() || "Nao informado";

    return (
      <Card
        className={
          editable
            ? "rounded-[24px] border-slate-100 bg-slate-50/70 shadow-none"
            : "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]"
        }
      >
        <CardContent className={editable ? "space-y-5 p-5" : "space-y-5 p-6 md:p-7"}>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Dados legais e juridicos</h2>
            <p className="mt-2 text-sm text-slate-600">
              Informacoes oficiais, registros e observacoes juridicas do imovel.
            </p>
          </div>

          {editable ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="legal-inscricao-imobiliaria">Inscricao imobiliaria</Label>
                  <Input
                    id="legal-inscricao-imobiliaria"
                    className={LEGAL_FIELD_CLASS}
                    value={legalForm.inscricaoImobiliaria}
                    onChange={event =>
                      setLegalForm(current => ({ ...current, inscricaoImobiliaria: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal-matricula-registro">Matricula do registro</Label>
                  <Input
                    id="legal-matricula-registro"
                    className={LEGAL_FIELD_CLASS}
                    value={legalForm.matriculaRegistro}
                    onChange={event =>
                      setLegalForm(current => ({ ...current, matriculaRegistro: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal-observacoes-juridicas">Observacoes juridicas</Label>
                <Textarea
                  id="legal-observacoes-juridicas"
                  className="min-h-[120px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                  value={legalForm.observacoesJuridicas}
                  onChange={event =>
                    setLegalForm(current => ({ ...current, observacoesJuridicas: event.target.value }))
                  }
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Inscricao imobiliaria</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {readOnlyValue(legalForm.inscricaoImobiliaria)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Matricula do registro</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {readOnlyValue(legalForm.matriculaRegistro)}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Observacoes juridicas</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                  {readOnlyValue(legalForm.observacoesJuridicas)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderValuesCard = () => (
    <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-950">Valores e caracteristicas</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {editForm.finalidade === "locacao" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-valor-locacao">Valor de locacao (R$) *</Label>
            <MoneyInput
              id="edit-valor-locacao"
              value={editForm.valorLocacao}
              onValueChange={value => setEditForm({ ...editForm, valorLocacao: value })}
              placeholder="R$ 0,00"
            />
          </div>
        ) : editForm.finalidade === "ambos" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="edit-valor">Valor de venda (R$) *</Label>
              <MoneyInput
                id="edit-valor"
                value={editForm.valor}
                onValueChange={value => setEditForm({ ...editForm, valor: value })}
                placeholder="R$ 0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-valor-locacao">Valor de locacao (R$)</Label>
              <MoneyInput
                id="edit-valor-locacao"
                value={editForm.valorLocacao}
                onValueChange={value => setEditForm({ ...editForm, valorLocacao: value })}
                placeholder="R$ 0,00"
              />
            </div>
          </>
        ) : (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-valor">Valor de venda (R$) *</Label>
            <MoneyInput
              id="edit-valor"
              value={editForm.valor}
              onValueChange={value => setEditForm({ ...editForm, valor: value })}
              placeholder="R$ 0,00"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="edit-area">Area (m2)</Label>
          <Input
            id="edit-area"
            type="number"
            value={editForm.area}
            onChange={event => setEditForm({ ...editForm, area: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-quartos">Quartos</Label>
          <Input
            id="edit-quartos"
            type="number"
            value={editForm.quartos}
            onChange={event => setEditForm({ ...editForm, quartos: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-banheiros">Banheiros</Label>
          <Input
            id="edit-banheiros"
            type="number"
            value={editForm.banheiros}
            onChange={event => setEditForm({ ...editForm, banheiros: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-vagas">Vagas</Label>
          <Input
            id="edit-vagas"
            type="number"
            value={editForm.vagas}
            onChange={event => setEditForm({ ...editForm, vagas: event.target.value })}
          />
        </div>
      </div>
    </div>
  );

  const renderDocumentsCard = () => {
    if (!canManageProperty) return null;

    const documents = propertyDocuments.data ?? [];

    return (
      <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">Documentos</h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full bg-white"
            disabled={uploadingDocument || addPropertyDocument.isPending}
            onClick={() => document.getElementById("property-document-inline-upload")?.click()}
            aria-label="Adicionar documento"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Input
            id="property-document-inline-upload"
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleDocumentUpload}
            disabled={uploadingDocument || addPropertyDocument.isPending}
          />
        </div>

        {propertyDocuments.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(item => (
              <div key={item} className="h-12 animate-pulse rounded-2xl bg-white/80" />
            ))}
          </div>
        ) : documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map(document => (
              <div
                key={document.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/85 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{document.nomeArquivo}</p>
                  <p className="text-xs text-slate-500">{formatStoredDate(document.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleOpenDocument(document.urlArquivo)}
                    aria-label="Visualizar documento"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                    onClick={() => setDocumentPendingDelete(document.id)}
                    aria-label="Excluir documento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-white/70 px-4 py-8 text-center text-sm text-slate-500">
            <FileText className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            Nenhum documento anexado.
          </div>
        )}
      </div>
    );
  };

  const isMobileDevice = () => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  };

  const isIOSDevice = () => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  };

  const openLocationInBrowser = () => {
    window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
  };

  const handleAddressClick = () => {
    if (isMobileDevice()) {
      setLocationChoiceOpen(true);
      return;
    }

    openLocationInBrowser();
  };

  const handleOpenLocationInApp = () => {
    setLocationChoiceOpen(false);
    if (isIOSDevice()) {
      window.location.href = iosMapsAppUrl;
      return;
    }

    window.location.href = androidMapsAppUrl;
  };

  const handleOpenLocationInBrowser = () => {
    setLocationChoiceOpen(false);
    openLocationInBrowser();
  };

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-12">
        <div className="container py-6 md:py-7">
          <div className="mb-4 lg:mb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-2 gap-2 rounded-full border border-white/70 bg-white/80 text-slate-700 shadow-sm hover:bg-white lg:mb-2"
              onClick={() => requestNavigation(backHref)}
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          </div>

          {isEditingProperty && canManageProperty ? (
            <Card className="rounded-[32px] border-white/70 bg-white/95 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                      Ficha do imovel
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                      Editar Imovel
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      Edite os dados do anuncio, vinculos, endereco e fotos nesta mesma ficha.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="rounded-full bg-emerald-700 px-5 text-white hover:bg-emerald-800"
                      onClick={submitPropertyEdit}
                      disabled={updateProperty.isPending || updateLegalDetails.isPending}
                    >
                      {updateProperty.isPending || updateLegalDetails.isPending ? "Salvando..." : "Salvar alteracoes"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-base font-semibold text-slate-950">Fotos do imovel</h2>
                          <p className="text-sm text-slate-600">Adicione, remova ou arraste as imagens para mudar a ordem.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="relative overflow-hidden rounded-full"
                          disabled={uploadingPhoto || uploadPhotoMutation.isPending}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {uploadingPhoto || uploadPhotoMutation.isPending ? "Enviando..." : "Adicionar"}
                          <Input
                            type="file"
                            accept="image/*"
                            multiple
                            className="absolute inset-0 cursor-pointer opacity-0"
                            onChange={handleUploadEditPhotos}
                            disabled={uploadingPhoto || uploadPhotoMutation.isPending}
                          />
                        </Button>
                      </div>

                      {editingPhotoUrls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {editingPhotoUrls.map((url, index) => (
                            <div
                              key={`${url}-${index}`}
                              draggable
                              onDragStart={event => handlePhotoDragStart(event, index)}
                              onDragOver={event => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = "move";
                              }}
                              onDrop={event => handlePhotoDrop(event, index)}
                              className="group relative cursor-grab overflow-hidden rounded-2xl border bg-white active:cursor-grabbing"
                              title="Arraste para mudar a ordem"
                            >
                              <ProtectedPropertyImage
                                src={url}
                                alt={`Foto ${index + 1}`}
                                className="h-32 w-full object-cover"
                              />
                              <div className="absolute bottom-2 left-2 rounded-full bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">
                                {index + 1}
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="absolute right-2 top-2 h-8 w-8 rounded-full border border-white bg-white text-destructive shadow-sm hover:bg-rose-50"
                                onClick={() => handleRemoveEditPhoto(index)}
                                disabled={deleteUploadedPhotoMutation.isPending}
                                aria-label={`Remover foto ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed bg-white/70 text-sm text-slate-500">
                          <ImagePlus className="mr-2 h-4 w-4" />
                          Nenhuma foto cadastrada.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
                      <h2 className="mb-4 text-base font-semibold text-slate-950">Dados principais</h2>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="max-w-xl space-y-2 md:col-span-2">
                          <Label htmlFor="edit-titulo">Titulo *</Label>
                          <Input
                            id="edit-titulo"
                            value={editForm.titulo}
                            onChange={event => setEditForm({ ...editForm, titulo: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-tipo">Tipo *</Label>
                          <Select value={editForm.tipo} onValueChange={value => setEditForm({ ...editForm, tipo: value })}>
                            <SelectTrigger id="edit-tipo">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="apartamento">Apartamento</SelectItem>
                              <SelectItem value="casa">Casa</SelectItem>
                              <SelectItem value="terreno">Terreno</SelectItem>
                              <SelectItem value="comercial">Comercial</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-finalidade">Finalidade *</Label>
                          <Select value={editForm.finalidade} onValueChange={value => setEditForm({ ...editForm, finalidade: value })}>
                            <SelectTrigger id="edit-finalidade">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="venda">Venda</SelectItem>
                              <SelectItem value="locacao">Locacao</SelectItem>
                              <SelectItem value="ambos">Ambos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="edit-descricao">Descricao</Label>
                          <Textarea
                            id="edit-descricao"
                            value={editForm.descricao}
                            onChange={event => setEditForm({ ...editForm, descricao: event.target.value })}
                            className="min-h-[160px]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 2xl:grid-cols-2">
                    {renderLegalDetailsCard()}

                    <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
                      <h2 className="mb-4 text-base font-semibold text-slate-950">Endereco</h2>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="edit-endereco">Endereco *</Label>
                          <Input
                            id="edit-endereco"
                            value={editForm.endereco}
                            onChange={event => setEditForm({ ...editForm, endereco: event.target.value })}
                            disabled={cepLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-numero">Numero</Label>
                          <Input
                            id="edit-numero"
                            value={editForm.numero}
                            onChange={event => setEditForm({ ...editForm, numero: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-bairro">Bairro</Label>
                          <Input
                            id="edit-bairro"
                            value={editForm.bairro}
                            onChange={event => setEditForm({ ...editForm, bairro: event.target.value })}
                            disabled={cepLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-cidade">Cidade *</Label>
                          <Input
                            id="edit-cidade"
                            value={editForm.cidade}
                            onChange={event => setEditForm({ ...editForm, cidade: event.target.value })}
                            disabled={cepLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-estado">Estado *</Label>
                          <Input
                            id="edit-estado"
                            maxLength={2}
                            value={editForm.estado}
                            onChange={event => setEditForm({ ...editForm, estado: event.target.value.toUpperCase() })}
                            disabled={cepLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-cep">CEP</Label>
                          <Input
                            id="edit-cep"
                            value={editForm.cep}
                            inputMode="numeric"
                            maxLength={9}
                            onChange={event => handleZipCodeChange(event.target.value)}
                          />
                          {cepLoading ? <p className="text-xs text-slate-500">Buscando CEP...</p> : null}
                          {cepError ? <p className="text-xs text-red-500">{cepError}</p> : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-destaque">Destaque na Home?</Label>
                          <Select value={editForm.destaque} onValueChange={value => setEditForm({ ...editForm, destaque: value })}>
                            <SelectTrigger id="edit-destaque">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Nao</SelectItem>
                              <SelectItem value="1">Sim</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
                      <h2 className="mb-4 text-base font-semibold text-slate-950">Corretor / Responsavel</h2>
                      {user?.role === "administrativo" ? (
                        <Select
                          value={editForm.idCorretor || "empty"}
                          onValueChange={value => setEditForm({ ...editForm, idCorretor: value === "empty" ? "" : value })}
                        >
                          <SelectTrigger id="edit-id-corretor">
                            <SelectValue placeholder="Selecione o responsavel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="empty">Selecione</SelectItem>
                            {activeResponsibleUsers.map(responsible => (
                              <SelectItem key={responsible.id} value={String(responsible.id)}>
                                {responsible.name || responsible.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={user?.name || user?.email || "Corretor"} disabled />
                      )}
                    </div>

                    {renderValuesCard()}

                    <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
                      <h2 className="mb-1 text-base font-semibold text-slate-950">Proprietario do imovel</h2>
                      <p className="mb-4 text-sm text-slate-600">
                        Nome e telefone sao obrigatorios. CPF e e-mail ajudam a reaproveitar cadastros existentes.
                      </p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-owner-name">Nome e sobrenome *</Label>
                          <Input
                            id="edit-owner-name"
                            value={editForm.ownerName}
                            onChange={event => setEditForm({ ...editForm, ownerName: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-owner-email">E-mail</Label>
                          <Input
                            id="edit-owner-email"
                            type="email"
                            value={editForm.ownerEmail}
                            onChange={event => setEditForm({ ...editForm, ownerEmail: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-owner-phone">Telefone *</Label>
                          <Input
                            id="edit-owner-phone"
                            value={editForm.ownerPhone}
                            onChange={event => setEditForm({ ...editForm, ownerPhone: formatPhoneNumber(event.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-owner-cpf">CPF</Label>
                          <Input
                            id="edit-owner-cpf"
                            inputMode="numeric"
                            maxLength={14}
                            value={editForm.ownerCpf}
                            onChange={event => setEditForm({ ...editForm, ownerCpf: formatCpf(event.target.value) })}
                          />
                        </div>
                      </div>
                    </div>

                    {renderDocumentsCard()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="overflow-hidden rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              {temFotos ? (
                <div className="relative">
                  <div className="relative h-[500px] bg-slate-100 lg:h-[460px] xl:h-[520px]">
                    <ProtectedPropertyImage
                      src={fotos[currentImageIndex]}
                      alt={`${imovel.titulo} - Foto ${currentImageIndex + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {fotos.length > 1 ? (
                      <>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute left-4 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-white/25 bg-white/60 text-slate-800 shadow-md hover:bg-white/75"
                          onClick={prevImage}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-4 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-white/25 bg-white/60 text-slate-800 shadow-md hover:bg-white/75"
                          onClick={nextImage}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-slate-950/80 px-3 py-1 text-sm font-medium text-white backdrop-blur">
                          {currentImageIndex + 1} / {fotos.length}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex h-[500px] items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,243,0.88))] lg:h-[460px] xl:h-[520px]">
                  <Building2 className="h-16 w-16 text-slate-400" />
                </div>
              )}
            </Card>

            <Card className="rounded-[32px] border-transparent bg-[linear-gradient(135deg,#4e7b66,#628b78_55%,#7aa18b)] text-white shadow-[0_25px_60px_-35px_rgba(15,23,42,0.6)]">
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-white/70">
                    {imovel.finalidade === "locacao" ? "Valor da locacao" : "Valor do imóvel"}
                  </p>
                  <p className="text-[1.95rem] font-semibold leading-none tracking-tight xl:text-[2.15rem]">
                    {formatCurrency(imovel.finalidade === "locacao" ? (imovel.valorLocacao ?? imovel.valor) : imovel.valor)}
                  </p>
                  {imovel.valorLocacao && imovel.finalidade === "ambos" ? (
                    <p className="mt-2 text-sm text-white/80">
                      Locacao: {formatCurrency(imovel.valorLocacao)}/mes
                    </p>
                  ) : null}
                </div>

                {shouldShowContactActions ? (
                  <>
                    <Button className="h-12 w-full rounded-full bg-white text-slate-900 shadow-sm hover:bg-slate-100" asChild>
                      <a
                        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-5 w-5" />
                        Falar com Corretor
                      </a>
                    </Button>

                    <Link href={`/contato?idImovel=${imovel.id}#contato-formulario`}>
                      <Button
                        variant="outline"
                        className="h-12 w-full rounded-full border-white/30 bg-white/10 text-white hover:bg-white/15"
                        onClick={() => {
                          if (typeof window === "undefined") return;
                          window.sessionStorage.setItem(
                            CONTACT_INTEREST_PROPERTY_STORAGE_KEY,
                            JSON.stringify({
                              id: imovel.id,
                              savedAt: Date.now(),
                            })
                          );
                        }}
                      >
                        Enviar Mensagem
                      </Button>
                    </Link>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <CardContent className="space-y-6">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">
                        {imovel.finalidade === "venda"
                          ? "Venda"
                          : imovel.finalidade === "locacao"
                            ? "Locacao"
                            : "Venda/Locacao"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium capitalize text-slate-700">
                        {imovel.tipo}
                      </span>
                      <span className={`rounded-full px-3 py-1 font-medium ${propertyStatus.className}`}>
                        {propertyStatus.label}
                      </span>
                      {imovel.destaque === 1 ? (
                        <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 font-medium text-amber-700">
                          Destaque
                        </span>
                      ) : null}
                    </div>

                    {canManageProperty ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Acoes do imovel"
                            className="h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleEditProperty}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleGoToPropertyDetails}>
                            Ir para Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDocumentsOpen(true)}>
                            Documentos
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>

                  <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-950 lg:text-[1.8rem] xl:text-[1.95rem]">
                    {imovel.titulo}
                  </h1>
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
                    <button
                      type="button"
                      onClick={handleAddressClick}
                      className="text-left underline decoration-emerald-700/40 underline-offset-4 hover:text-emerald-800"
                    >
                      {propertyAddressText}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:gap-4">
                  {imovel.area ? (
                    <div className="xl:border-r xl:border-slate-200/80 xl:pr-4">
                      <p className="text-lg font-semibold tracking-tight text-slate-950 sm:text-2xl">{imovel.area}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-500 sm:mt-2 sm:text-xs sm:tracking-[0.18em]">m2</p>
                    </div>
                  ) : null}
                  {imovel.quartos ? (
                    <div className="xl:border-r xl:border-slate-200/80 xl:pr-4">
                      <p className="text-lg font-semibold tracking-tight text-slate-950 sm:text-2xl">{imovel.quartos}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-500 sm:mt-2 sm:text-xs sm:tracking-[0.18em]">Quartos</p>
                    </div>
                  ) : null}
                  {imovel.banheiros ? (
                    <div className="xl:border-r xl:border-slate-200/80 xl:pr-4">
                      <p className="text-lg font-semibold tracking-tight text-slate-950 sm:text-2xl">{imovel.banheiros}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-500 sm:mt-2 sm:text-xs sm:tracking-[0.18em]">Banheiros</p>
                    </div>
                  ) : null}
                  {imovel.vagas ? (
                    <div>
                      <p className="text-lg font-semibold tracking-tight text-slate-950 sm:text-2xl">{imovel.vagas}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-500 sm:mt-2 sm:text-xs sm:tracking-[0.18em]">Vagas</p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
              <CardContent className="space-y-4">
                <div>
                  <p className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                    Observacoes do imovel
                  </p>
                </div>
                <p className="whitespace-pre-line text-[15px] leading-7 text-slate-600">
                  {imovel.descricao?.trim() || "Nenhuma observacao cadastrada para este imovel ate o momento."}
                </p>
              </CardContent>
            </Card>

            {imovel.latitude && imovel.longitude ? (
              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
                <CardContent>
                  <h3 className="mb-4 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-950">
                    <MapPin className="h-5 w-5 text-emerald-700" />
                    Localizacao
                  </h3>
                  <div className="flex aspect-video items-center justify-center rounded-[28px] border border-slate-100 bg-slate-50">
                    <p className="text-sm text-slate-500">Mapa em breve</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {shouldShowVinculosCard ? (
              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
                <CardContent className="space-y-5">
                  <div>
                    <p className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                      Vinculos do imovel
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {shouldShowOwnerInVinculos ? (
                      <div className="space-y-2 rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Proprietarios</p>
                        {propertyOwners.length > 0 ? (
                          <div className="space-y-3">
                            {propertyOwners.map((owner: { id: number; name: string; email: string; phone: string }, index: number) => (
                              <div key={owner.id} className="border-b border-slate-200/70 pb-3 last:border-b-0 last:pb-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Proprietario {index + 1}
                                </p>
                                {isAdminViewer ? (
                                  <Link href={`/admin/proprietarios/${owner.id}?fromProperty=${imovel.id}`}>
                                    <a className="text-base font-semibold text-emerald-800 underline">
                                      {owner.name}
                                    </a>
                                  </Link>
                                ) : (
                                  <p className="text-base font-semibold text-slate-950">
                                    {owner.name}
                                  </p>
                                )}
                                <p className="text-sm text-slate-600">{owner.email}</p>
                                <p className="text-sm text-slate-600">{owner.phone}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">Nao informado</p>
                        )}
                      </div>
                    ) : null}

                    <div className="space-y-2 rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Corretor Responsável</p>
                      {imovel.corretorResponsavel ? (
                        isAdminViewer ? (
                          <Link href={`/admin/users/${imovel.corretorResponsavel.id}?fromProperty=${imovel.id}`}>
                            <a className="text-base font-semibold text-emerald-800 underline">
                              {imovel.corretorResponsavel.name || imovel.corretorResponsavel.email}
                            </a>
                          </Link>
                        ) : (
                          <p className="text-base font-semibold text-slate-950">
                            {imovel.corretorResponsavel.name || imovel.corretorResponsavel.email}
                          </p>
                        )
                      ) : (
                        <p className="text-sm text-slate-600">Nao informado</p>
                      )}
                    </div>
                  </div>

                  {isAdminViewer ? (
                    <div className="border-t border-slate-200/80 pt-3 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Cadastrado por:</span>{" "}
                      {imovel.cadastradoPor ? (
                        <Link href={`/admin/users/${imovel.cadastradoPor.id}?fromProperty=${imovel.id}`}>
                          <a className="font-medium text-emerald-800 underline">
                            {imovel.cadastradoPor.name || imovel.cadastradoPor.email}
                          </a>
                        </Link>
                      ) : (
                        "Nao informado"
                      )}
                      {imovel.createdAt ? ` • ${formatStoredDateTime(imovel.createdAt)}` : ""}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {renderLegalDetailsCard(false)}
          </div>
        </div>
          )}
        </div>

        <Dialog open={locationChoiceOpen} onOpenChange={setLocationChoiceOpen}>
          <DialogContent className="w-full max-w-sm rounded-[24px] border-white/80 bg-[#f7f6f2] p-5 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
            <DialogHeader>
              <DialogTitle>Abrir localizacao</DialogTitle>
              <DialogDescription>
                Deseja abrir no app de mapas instalado ou no navegador?
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex flex-col gap-2">
              <Button
                type="button"
                className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={handleOpenLocationInApp}
              >
                Abrir com App
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={handleOpenLocationInBrowser}
              >
                Abrir no navegador
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={documentsOpen} onOpenChange={setDocumentsOpen}>
          <DialogContent className="w-full max-h-[90vh] overflow-y-auto scrollbar-hidden lg:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Documentos do imovel</DialogTitle>
              <DialogDescription>
                Visualize, baixe e anexe documentos PDF relacionados a este imovel.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Arquivos anexados</p>
                  <p className="text-sm text-muted-foreground">Somente PDF.</p>
                </div>
                <div>
                  <Input
                    id="property-document-upload"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={handleDocumentUpload}
                    disabled={uploadingDocument || addPropertyDocument.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploadingDocument || addPropertyDocument.isPending}
                    onClick={() => document.getElementById("property-document-upload")?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingDocument ? "Anexando..." : "Anexar Novo Documento"}
                  </Button>
                </div>
              </div>

              {propertyDocuments.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(item => (
                    <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : propertyDocuments.data && propertyDocuments.data.length > 0 ? (
                <div className="space-y-3">
                  {propertyDocuments.data.map(document => (
                    <div
                      key={document.id}
                      className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          {documentPendingRename?.id === document.id ? (
                            <div className="space-y-2">
                              <Input
                                value={documentPendingRename.nomeArquivo}
                                onChange={event =>
                                  setDocumentPendingRename({
                                    id: document.id,
                                    nomeArquivo: event.target.value,
                                  })
                                }
                                className="h-9 w-full min-w-[220px]"
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 rounded-full bg-emerald-700 px-3 text-white hover:bg-emerald-800"
                                  onClick={handleConfirmRenameDocument}
                                  disabled={renamePropertyDocument.isPending}
                                >
                                  Salvar
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-full px-3"
                                  onClick={() => setDocumentPendingRename(null)}
                                  disabled={renamePropertyDocument.isPending}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="font-medium">{document.nomeArquivo}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Enviado em {formatStoredDate(document.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setDocumentPendingRename({
                              id: document.id,
                              nomeArquivo: document.nomeArquivo,
                            })
                          }
                          aria-label="Renomear documento"
                          disabled={renamePropertyDocument.isPending && documentPendingRename?.id === document.id}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleOpenDocument(document.urlArquivo)}
                          aria-label="Visualizar documento"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleDownloadDocument(document.urlArquivo, document.nomeArquivo)}
                          aria-label="Baixar documento"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDocumentPendingDelete(document.id)}
                          aria-label="Excluir documento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                  <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Nenhum documento anexado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use o botao acima para anexar o primeiro PDF deste imovel.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={documentPendingDelete !== null} onOpenChange={open => !open && setDocumentPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusao do documento?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa acao removera permanentemente o documento anexado a este imovel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (documentPendingDelete !== null) {
                    deletePropertyDocument.mutate({ id: documentPendingDelete });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir documento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {UnsavedChangesDialog}
      </div>
    </Layout>
  );
}
