import { useEffect, useMemo, useRef, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ChevronDown, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

type ContractTemplateHighlight = {
  id: string;
  start: number;
  end: number;
  placeholder: string;
  label: string;
  key?: string | null;
};

type ContractTemplateListItem = {
  id: number;
  name: string;
  notes: string | null;
  originalFileName: string;
  originalFileData: string;
  extractedText: string;
  reviewedText: string;
  variableHighlights: string;
};

type AdminContractsPanelProps = {
  createRequestKey: number;
};

const CONTRACT_VARIABLE_FIELD_MAP: Record<string, string> = {
  "nome do locatario": "locatario.nome",
  "cpf do locatario": "locatario.cpf",
  "rg do locatario": "locatario.rg",
  "email do locatario": "locatario.email",
  "telefone do locatario": "locatario.telefone",
  "nome do proprietario": "proprietario.nome",
  "cpf do proprietario": "proprietario.cpf",
  "email do proprietario": "proprietario.email",
  "telefone do proprietario": "proprietario.telefone",
  "endereco do imovel": "imovel.enderecoCompleto",
  "bairro do imovel": "imovel.bairro",
  "cidade do imovel": "imovel.cidade",
  "estado do imovel": "imovel.estado",
  "cep do imovel": "imovel.cep",
  "valor do aluguel": "locacao.valorAluguel",
  "valor da locacao": "locacao.valorAluguel",
  "data de inicio": "locacao.dataInicio",
  "data de termino": "locacao.dataFim",
  "prazo de locacao": "locacao.prazo",
  "dia de vencimento": "locacao.diaVencimento",
};

const CONTRACT_VARIABLE_FIELD_OPTIONS = [
  { key: "locatario.nome", label: "Locatário > Nome" },
  { key: "locatario.cpf", label: "Locatário > CPF" },
  { key: "locatario.rg", label: "Locatário > RG" },
  { key: "locatario.email", label: "Locatário > E-mail" },
  { key: "locatario.telefone", label: "Locatário > Telefone" },
  { key: "proprietario.nome", label: "Proprietário > Nome" },
  { key: "proprietario.cpf", label: "Proprietário > CPF" },
  { key: "proprietario.email", label: "Proprietário > E-mail" },
  { key: "proprietario.telefone", label: "Proprietário > Telefone" },
  { key: "imovel.enderecoCompleto", label: "Imóvel > Endereço completo" },
  { key: "imovel.bairro", label: "Imóvel > Bairro" },
  { key: "imovel.cidade", label: "Imóvel > Cidade" },
  { key: "imovel.estado", label: "Imóvel > Estado" },
  { key: "imovel.cep", label: "Imóvel > CEP" },
  { key: "locacao.valorAluguel", label: "Locação > Valor do aluguel" },
  { key: "locacao.dataInicio", label: "Locação > Data de início" },
  { key: "locacao.dataFim", label: "Locação > Data de término" },
  { key: "locacao.prazo", label: "Locação > Prazo" },
  { key: "locacao.diaVencimento", label: "Locação > Dia de vencimento" },
];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Nao foi possivel ler o arquivo."));
    };
    reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function getHighlightedTextSegments(text: string, highlights: ContractTemplateHighlight[]) {
  const normalized = highlights
    .filter(item => item.start >= 0 && item.end > item.start && item.end <= text.length)
    .sort((left, right) => left.start - right.start);
  const segments: Array<{ text: string; highlight?: ContractTemplateHighlight }> = [];
  let cursor = 0;

  for (const highlight of normalized) {
    if (highlight.start < cursor) continue;
    if (highlight.start > cursor) {
      segments.push({ text: text.slice(cursor, highlight.start) });
    }
    segments.push({ text: text.slice(highlight.start, highlight.end), highlight });
    cursor = highlight.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}

export default function AdminContractsPanel({ createRequestKey }: AdminContractsPanelProps) {
  const utils = trpc.useUtils();
  const contractsWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const contractTemplateModalScrollRef = useRef<HTMLDivElement | null>(null);
  const contractTemplateTextSectionRef = useRef<HTMLDivElement | null>(null);
  const contractTemplateEditableRef = useRef<HTMLDivElement | null>(null);
  const contractTemplateReviewedTextDraftRef = useRef("");
  const [contractTemplateModalOpen, setContractTemplateModalOpen] = useState(false);
  const [editingContractTemplateId, setEditingContractTemplateId] = useState<number | null>(null);
  const [contractTemplateName, setContractTemplateName] = useState("");
  const [contractTemplateNotes, setContractTemplateNotes] = useState("");
  const [contractTemplateFileName, setContractTemplateFileName] = useState("");
  const [contractTemplateFileData, setContractTemplateFileData] = useState("");
  const [contractTemplateExtractedText, setContractTemplateExtractedText] = useState("");
  const [contractTemplateReviewedText, setContractTemplateReviewedText] = useState("");
  const [contractTemplateHighlights, setContractTemplateHighlights] = useState<ContractTemplateHighlight[]>([]);
  const [contractTemplateTextExpanded, setContractTemplateTextExpanded] = useState(false);
  const [selectedContractTemplateId, setSelectedContractTemplateId] = useState<number | null>(null);
  const [contractTemplatePendingDelete, setContractTemplatePendingDelete] = useState<ContractTemplateListItem | null>(null);

  const { data: contractTemplates, isLoading: loadingContractTemplates } = trpc.contractTemplates.list.useQuery();

  const extractContractTemplateDocx = trpc.contractTemplates.extractDocxText.useMutation({
    onSuccess: data => {
      setContractTemplateFileName(data.fileName);
      setContractTemplateExtractedText(data.extractedText);
      setContractTemplateReviewedText(data.extractedText);
      contractTemplateReviewedTextDraftRef.current = data.extractedText;
      setContractTemplateHighlights(data.detectedVariables);
      setContractTemplateTextExpanded(false);
      toast.success("Texto extraido do DOCX. Revise as variaveis detectadas antes de salvar.");
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel ler o DOCX.");
    },
  });
  const createContractTemplate = trpc.contractTemplates.create.useMutation({
    onSuccess: async () => {
      toast.success("Modelo de contrato salvo com sucesso.");
      resetContractTemplateModal();
      await utils.contractTemplates.list.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel salvar o modelo de contrato.");
    },
  });
  const updateContractTemplate = trpc.contractTemplates.update.useMutation({
    onError: error => {
      toast.error(error.message || "Nao foi possivel atualizar o modelo de contrato.");
    },
  });
  const deleteContractTemplate = trpc.contractTemplates.delete.useMutation({
    onSuccess: async () => {
      toast.success("Modelo de contrato excluido com sucesso.");
      if (contractTemplatePendingDelete?.id === selectedContractTemplateId) {
        setSelectedContractTemplateId(null);
      }
      setContractTemplatePendingDelete(null);
      await utils.contractTemplates.list.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel excluir o modelo de contrato.");
    },
  });

  useEffect(() => {
    if (!contractTemplates?.length) {
      setSelectedContractTemplateId(null);
      return;
    }

    const selectedExists = contractTemplates.some(template => template.id === selectedContractTemplateId);
    if (!selectedExists) {
      setSelectedContractTemplateId(null);
    }
  }, [contractTemplates, selectedContractTemplateId]);

  useEffect(() => {
    if (createRequestKey <= 0) return;
    resetContractTemplateModal();
    setContractTemplateModalOpen(true);
  }, [createRequestKey]);

  const normalizeContractVariableLabel = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .toLowerCase();

  const detectContractTemplateVariables = (text: string): ContractTemplateHighlight[] => {
    const variables: ContractTemplateHighlight[] = [];
    for (const match of Array.from(text.matchAll(/\[([^\[\]\n]{2,120})\]/g))) {
      if (match.index === undefined) continue;

      const placeholder = match[0];
      const label = match[1].trim();
      const normalizedLabel = normalizeContractVariableLabel(label);
      variables.push({
        id: `${match.index}-${placeholder}`,
        start: match.index,
        end: match.index + placeholder.length,
        placeholder,
        label,
        key: CONTRACT_VARIABLE_FIELD_MAP[normalizedLabel] ?? null,
      });
    }

    return variables;
  };

  const updateContractTemplateReviewedText = (nextText: string) => {
    setContractTemplateReviewedText(nextText);
    contractTemplateReviewedTextDraftRef.current = nextText;
    setContractTemplateHighlights(detectContractTemplateVariables(nextText));
  };

  const getCurrentContractTemplateReviewedText = () =>
    contractTemplateEditableRef.current?.innerText ?? contractTemplateReviewedTextDraftRef.current ?? contractTemplateReviewedText;

  const parseContractTemplateHighlights = (value: string | null | undefined): ContractTemplateHighlight[] => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const openContractTemplateEditor = (template: ContractTemplateListItem) => {
    const reviewedText = template.reviewedText || template.extractedText || "";
    setEditingContractTemplateId(template.id);
    setContractTemplateName(template.name);
    setContractTemplateNotes(template.notes || "");
    setContractTemplateFileName(template.originalFileName);
    setContractTemplateFileData(template.originalFileData);
    setContractTemplateExtractedText(template.extractedText || reviewedText);
    setContractTemplateReviewedText(reviewedText);
    contractTemplateReviewedTextDraftRef.current = reviewedText;
    setContractTemplateHighlights(parseContractTemplateHighlights(template.variableHighlights));
    setContractTemplateTextExpanded(false);
    setContractTemplateModalOpen(true);
  };

  const selectContractTemplate = (templateId: number) => {
    setSelectedContractTemplateId(templateId);

    requestAnimationFrame(() => {
      const workspace = contractsWorkspaceRef.current;
      if (!workspace) return;

      const headerOffset = 178;
      const startTop = window.scrollY;
      const targetTop = Math.max(workspace.getBoundingClientRect().top + window.scrollY - headerOffset, 0);
      const distance = targetTop - startTop;
      const duration = 720;
      const startTime = performance.now();
      const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        window.scrollTo(0, startTop + distance * easeOutCubic(progress));

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };

      requestAnimationFrame(animateScroll);
    });
  };

  const scrollContractTemplateTextIntoView = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const modal = contractTemplateModalScrollRef.current;
        const section = contractTemplateTextSectionRef.current;
        if (!modal || !section) return;

        const modalTop = modal.getBoundingClientRect().top;
        const sectionTop = section.getBoundingClientRect().top;
        const startTop = modal.scrollTop;
        const targetTop = Math.max(startTop + sectionTop - modalTop - 18, 0);
        const distance = targetTop - startTop;
        const duration = 680;
        const startTime = performance.now();
        const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

        const animateScroll = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          modal.scrollTop = startTop + distance * easeOutCubic(progress);

          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          }
        };

        requestAnimationFrame(animateScroll);
      });
    });
  };

  const toggleContractTemplateTextExpanded = () => {
    setContractTemplateTextExpanded(current => {
      const nextExpanded = !current;
      if (nextExpanded) {
        scrollContractTemplateTextIntoView();
      }
      return nextExpanded;
    });
  };

  const resetContractTemplateModal = () => {
    setContractTemplateModalOpen(false);
    setEditingContractTemplateId(null);
    setContractTemplateName("");
    setContractTemplateNotes("");
    setContractTemplateFileName("");
    setContractTemplateFileData("");
    setContractTemplateExtractedText("");
    setContractTemplateReviewedText("");
    contractTemplateReviewedTextDraftRef.current = "";
    setContractTemplateHighlights([]);
    setContractTemplateTextExpanded(false);
  };

  const handleContractTemplateFileChange = async (file: File | null | undefined) => {
    if (!file) return;

    const isDocx =
      file.name.toLowerCase().endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isDocx) {
      toast.error("Envie um arquivo DOCX.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      toast.error("O DOCX deve ter no maximo 12 MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setContractTemplateFileName(file.name);
      setContractTemplateFileData(dataUrl);
      extractContractTemplateDocx.mutate({
        fileName: file.name,
        mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        dataUrl,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel ler o arquivo.");
    }
  };

  const saveContractTemplate = () => {
    if (!contractTemplateName.trim()) {
      toast.error("Informe o nome do modelo de contrato.");
      return;
    }

    if (!contractTemplateFileData || !contractTemplateFileName) {
      toast.error("Envie o DOCX base do contrato.");
      return;
    }

    const currentReviewedText = getCurrentContractTemplateReviewedText();

    if (!currentReviewedText.trim()) {
      toast.error("Revise o texto extraido antes de salvar.");
      return;
    }

    const detectedVariables = detectContractTemplateVariables(currentReviewedText);
    setContractTemplateReviewedText(currentReviewedText);
    contractTemplateReviewedTextDraftRef.current = currentReviewedText;
    setContractTemplateHighlights(detectedVariables);

    if (editingContractTemplateId !== null) {
      updateContractTemplate.mutate({
        id: editingContractTemplateId,
        name: contractTemplateName.trim(),
        notes: contractTemplateNotes.trim() || undefined,
        reviewedText: currentReviewedText,
        variableHighlights: detectedVariables,
      }, {
        onSuccess: async () => {
          toast.success("Modelo de contrato atualizado com sucesso.");
          resetContractTemplateModal();
          await utils.contractTemplates.list.invalidate();
        },
      });
      return;
    }

    createContractTemplate.mutate({
      name: contractTemplateName.trim(),
      notes: contractTemplateNotes.trim() || undefined,
      originalFileName: contractTemplateFileName,
      originalMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      originalFileData: contractTemplateFileData,
      extractedText: contractTemplateExtractedText,
      reviewedText: currentReviewedText,
      variableHighlights: detectedVariables,
    });
  };

  const selectedContractTemplate = useMemo(
    () => (contractTemplates ?? []).find(template => template.id === selectedContractTemplateId) ?? null,
    [contractTemplates, selectedContractTemplateId]
  );

  const contractVariableDictionary = useMemo(() => {
    const variablesByPlaceholder = new Map<
      string,
      {
        placeholder: string;
        label: string;
        key: string | null;
      }
    >();

    if (!selectedContractTemplate) {
      return [];
    }

    const parsedVariables = parseContractTemplateHighlights(selectedContractTemplate.variableHighlights);
    for (const variable of parsedVariables) {
      const existing = variablesByPlaceholder.get(variable.placeholder);
      const currentKey = variable.key || null;

      if (!existing) {
        variablesByPlaceholder.set(variable.placeholder, {
          placeholder: variable.placeholder,
          label: variable.label,
          key: currentKey,
        });
        continue;
      }

      if (!existing.key && currentKey) {
        existing.key = currentKey;
      }
    }

    return Array.from(variablesByPlaceholder.values()).sort((left, right) =>
      left.placeholder.localeCompare(right.placeholder, "pt-BR")
    );
  }, [selectedContractTemplate]);

  const contractVariableSummary = useMemo(() => {
    const detected = contractVariableDictionary.length;
    const recognized = contractVariableDictionary.filter(variable => Boolean(variable.key)).length;
    return {
      detected,
      recognized,
      unrecognized: detected - recognized,
    };
  }, [contractVariableDictionary]);

  const updateContractVariableMapping = async (placeholder: string, nextValue: string) => {
    const nextKey = nextValue === "unmapped" ? null : nextValue;
    if (!selectedContractTemplate) return;

    try {
      const updatedVariables = parseContractTemplateHighlights(selectedContractTemplate.variableHighlights).map(variable =>
        variable.placeholder === placeholder ? { ...variable, key: nextKey } : variable
      );

      await updateContractTemplate.mutateAsync({
        id: selectedContractTemplate.id,
        name: selectedContractTemplate.name,
        notes: selectedContractTemplate.notes || undefined,
        reviewedText: selectedContractTemplate.reviewedText || selectedContractTemplate.extractedText,
        variableHighlights: updatedVariables,
      });
      toast.success("Vinculo da variavel atualizado neste modelo.");
      await utils.contractTemplates.list.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar o vinculo da variavel.");
    }
  };

  const renderContractTemplatesList = () => {
    if (loadingContractTemplates) {
      return (
        <div className="space-y-3">
          {[1, 2].map(item => (
            <div key={item} className="h-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      );
    }

    if (!contractTemplates?.length) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-600">
          Nenhum modelo de contrato cadastrado ainda. Use o botao Novo Contrato para enviar o primeiro DOCX base.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {contractTemplates.map(template => {
          const isSelected = template.id === selectedContractTemplateId;

          return (
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              className={`block w-full cursor-pointer rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md ${
                isSelected
                  ? "border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-100"
                  : "border-slate-200 bg-white/85"
              }`}
              onClick={() => selectContractTemplate(template.id)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectContractTemplate(template.id);
                }
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{template.name}</p>
                    {isSelected ? (
                      <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                        Selecionado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{template.notes || "Sem observacoes."}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Arquivo base: {template.originalFileName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full bg-white px-4 text-xs font-semibold"
                    onClick={event => {
                      event.stopPropagation();
                      openContractTemplateEditor(template);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    onClick={event => {
                      event.stopPropagation();
                      setContractTemplatePendingDelete(template);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderContractVariableDictionary = () => {
    if (loadingContractTemplates) {
      return (
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded bg-muted" />
        </div>
      );
    }

    return (
      <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-slate-950">Dicionario de variaveis</p>
            <p className="mt-1 text-sm text-slate-600">
              {selectedContractTemplate ? (
                <>
                  Variáveis do modelo selecionado: <strong>{selectedContractTemplate.name}</strong>.
                </>
              ) : (
                "Selecione um modelo de contrato para visualizar o dicionário de variáveis."
              )}
            </p>
          </div>
          {selectedContractTemplate ? (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {contractVariableSummary.detected} detectada(s)
              </span>
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {contractVariableSummary.recognized} reconhecida(s)
              </span>
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {contractVariableSummary.unrecognized} nao reconhecida(s)
              </span>
            </div>
          ) : null}
        </div>

        {!selectedContractTemplate ? (
          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-600">
            Selecione um modelo cadastrado na lista ao lado para revisar e vincular suas variáveis.
          </div>
        ) : contractVariableDictionary.length > 0 ? (
          <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[1fr_1.15fr] gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
              <span>Variavel</span>
              <span>Status de reconhecimento</span>
            </div>
            <div className="divide-y divide-slate-100">
              {contractVariableDictionary.map(variable => (
                <div
                  key={variable.placeholder}
                  className="grid grid-cols-[1fr_1.15fr] items-center gap-3 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{variable.placeholder}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{variable.label}</p>
                  </div>
                  <Select
                    value={variable.key || "unmapped"}
                    disabled={updateContractTemplate.isPending}
                    onValueChange={value => updateContractVariableMapping(variable.placeholder, value)}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-slate-200 bg-white text-xs shadow-sm">
                      <SelectValue placeholder="Selecionar campo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">Nao reconhecida</SelectItem>
                      {CONTRACT_VARIABLE_FIELD_OPTIONS.map(option => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Nenhuma variavel foi identificada neste modelo. Revise o DOCX ou o texto extraido.
          </div>
        )}

        {selectedContractTemplate ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            A geração do contrato usará estes vínculos para trocar cada variável pelo dado real da locação selecionada.
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div ref={contractsWorkspaceRef} className="grid scroll-mt-32 gap-4 xl:grid-cols-[minmax(520px,1.35fr)_minmax(360px,0.85fr)]">
        <div className="min-w-0">{renderContractTemplatesList()}</div>
        <div className="min-w-0">{renderContractVariableDictionary()}</div>
      </div>

      <Dialog
        open={contractTemplateModalOpen}
        onOpenChange={open => {
          if (!open) {
            resetContractTemplateModal();
            return;
          }
          setContractTemplateModalOpen(true);
        }}
      >
        <DialogContent
          ref={contractTemplateModalScrollRef}
          className="max-h-[92vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto scrollbar-hidden rounded-[32px] border-white/80 bg-[#f7f6f2] p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] sm:max-w-2xl sm:p-6"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <DialogHeader className="space-y-3 pb-1">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
              {editingContractTemplateId !== null ? "Editar modelo de contrato" : "Novo modelo de contrato"}
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {editingContractTemplateId !== null
                ? "Revise o modelo aprovado e ajuste as informações variáveis quando necessário."
                : "Envie o arquivo base para preparar um modelo editável com campos variáveis revisáveis."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="contract-template-name">Nome do modelo de contrato</Label>
                <Input
                  id="contract-template-name"
                  value={contractTemplateName}
                  onChange={event => setContractTemplateName(event.target.value)}
                  className={FIELD_CLASS}
                  placeholder="Ex.: Locação residencial"
                />
              </div>

              <div className="space-y-2">
                <Label>Upload de arquivo</Label>
                <input
                  id="contract-template-upload"
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={event => handleContractTemplateFileChange(event.target.files?.[0])}
                />
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-2 text-left transition hover:border-emerald-300 hover:bg-white disabled:cursor-wait disabled:opacity-70"
                  disabled={extractContractTemplateDocx.isPending || editingContractTemplateId !== null}
                  onClick={() => document.getElementById("contract-template-upload")?.click()}
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <FileUp className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950">
                      {extractContractTemplateDocx.isPending
                        ? "Lendo texto do DOCX..."
                        : contractTemplateFileName
                          ? contractTemplateFileName
                          : "Selecionar DOCX"}
                    </span>
                    <span className="block truncate text-xs text-slate-600">
                      {editingContractTemplateId !== null
                        ? "Arquivo base preservado nesta edição"
                        : "Variáveis no padrão [Nome do Locatário]"}
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-template-notes">Observações</Label>
              <Textarea
                id="contract-template-notes"
                value={contractTemplateNotes}
                onChange={event => setContractTemplateNotes(event.target.value)}
                rows={4}
                className="min-h-[110px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base"
                placeholder="Inclua orientações internas sobre quando este modelo deve ser usado."
              />
            </div>

            {contractTemplateReviewedText ? (
              <div ref={contractTemplateTextSectionRef} className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={toggleContractTemplateTextExpanded}
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">Texto geral do documento</span>
                    <span className="mt-1 block text-sm text-slate-600">
                      Expanda para editar o texto extraido e revisar as variaveis destacadas.
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-500 transition ${
                      contractTemplateTextExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {contractTemplateTextExpanded ? (
                  <div
                    ref={contractTemplateEditableRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Texto geral do documento"
                    className="mt-4 max-h-[70vh] min-h-[460px] whitespace-pre-wrap overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-800 shadow-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    onInput={event => {
                      contractTemplateReviewedTextDraftRef.current = event.currentTarget.innerText;
                    }}
                    onBlur={event => updateContractTemplateReviewedText(event.currentTarget.innerText)}
                  >
                    {getHighlightedTextSegments(contractTemplateReviewedText, contractTemplateHighlights).map((segment, index) =>
                      segment.highlight ? (
                        <mark key={`${segment.highlight.id}-${index}`} className="rounded bg-yellow-200/70 px-0.5">
                          {segment.text}
                        </mark>
                      ) : (
                        <span key={index}>{segment.text}</span>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Após o upload, o sistema apresentará o texto identificado para revisão e listará as variáveis encontradas entre colchetes.
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-full bg-white/80" onClick={resetContractTemplateModal}>
                Cancelar
              </Button>
              <Button
                className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                disabled={
                  createContractTemplate.isPending ||
                  updateContractTemplate.isPending ||
                  extractContractTemplateDocx.isPending
                }
                onClick={saveContractTemplate}
              >
                {createContractTemplate.isPending || updateContractTemplate.isPending
                  ? "Salvando..."
                  : editingContractTemplateId !== null
                    ? "Salvar alterações"
                    : "Salvar modelo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={contractTemplatePendingDelete !== null}
        onOpenChange={open => {
          if (!open) setContractTemplatePendingDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-[28px] border-white/80 bg-[#f7f6f2]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo de contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              {contractTemplatePendingDelete
                ? `O modelo "${contractTemplatePendingDelete.name}" será removido da lista de modelos cadastrados.`
                : "Confirme a exclusão do modelo de contrato."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full bg-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-rose-700 text-white hover:bg-rose-800"
              disabled={deleteContractTemplate.isPending}
              onClick={event => {
                event.preventDefault();
                if (!contractTemplatePendingDelete) return;
                deleteContractTemplate.mutate({ id: contractTemplatePendingDelete.id });
              }}
            >
              {deleteContractTemplate.isPending ? "Excluindo..." : "Excluir modelo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
