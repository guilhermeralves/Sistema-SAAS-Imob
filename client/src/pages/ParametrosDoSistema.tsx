import Layout from "@/components/Layout";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lookupCep } from "@/lib/cep";
import { trpc } from "@/lib/trpc";
import {
  Banknote,
  Building2,
  Loader2,
  Percent,
  Save,
  Settings,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Basis points (bps) helpers — 500 bps = 5.00 % */
function bpsToPercent(bps: number | null | undefined) {
  return ((bps ?? 0) / 100).toFixed(2).replace(".", ",");
}
function percentToBps(v: string) {
  const cleaned = v.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(10000, Math.round(num * 100)));
}

type FormState = {
  imobNomeFantasia: string;
  imobRazaoSocial: string;
  imobCnpj: string;
  imobCreciPj: string;
  imobInscricaoEstadual: string;
  imobTelefone: string;
  imobEmail: string;
  imobCep: string;
  imobEndereco: string;
  imobNumero: string;
  imobComplemento: string;
  imobBairro: string;
  imobCidade: string;
  imobEstado: string;
  respNome: string;
  respCpf: string;
  respCreci: string;
  respTelefone: string;
  respEmail: string;
  bancoNome: string;
  bancoAgencia: string;
  bancoConta: string;
  bancoTipoConta: "" | "corrente" | "poupanca";
  bancoTitular: string;
  bancoTitularDoc: string;
  pixTipo: "" | "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
  pixChave: string;
  comissaoVenda: string;
  comissaoLocacao: string;
  comissaoImobiliaria: string;
  comissaoCorretor: string;
  diaPagamentoCorretor: number;
  metodoPagamentoCorretor: "pix" | "ted" | "boleto";
};

const EMPTY: FormState = {
  imobNomeFantasia: "",
  imobRazaoSocial: "",
  imobCnpj: "",
  imobCreciPj: "",
  imobInscricaoEstadual: "",
  imobTelefone: "",
  imobEmail: "",
  imobCep: "",
  imobEndereco: "",
  imobNumero: "",
  imobComplemento: "",
  imobBairro: "",
  imobCidade: "",
  imobEstado: "",
  respNome: "",
  respCpf: "",
  respCreci: "",
  respTelefone: "",
  respEmail: "",
  bancoNome: "",
  bancoAgencia: "",
  bancoConta: "",
  bancoTipoConta: "",
  bancoTitular: "",
  bancoTitularDoc: "",
  pixTipo: "",
  pixChave: "",
  comissaoVenda: "6,00",
  comissaoLocacao: "10,00",
  comissaoImobiliaria: "50,00",
  comissaoCorretor: "50,00",
  diaPagamentoCorretor: 10,
  metodoPagamentoCorretor: "pix",
};

export default function ParametrosDoSistema() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.systemParameters.get.useQuery();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      imobNomeFantasia: data.imobNomeFantasia ?? "",
      imobRazaoSocial: data.imobRazaoSocial ?? "",
      imobCnpj: data.imobCnpj ?? "",
      imobCreciPj: data.imobCreciPj ?? "",
      imobInscricaoEstadual: data.imobInscricaoEstadual ?? "",
      imobTelefone: data.imobTelefone ?? "",
      imobEmail: data.imobEmail ?? "",
      imobCep: data.imobCep ?? "",
      imobEndereco: data.imobEndereco ?? "",
      imobNumero: data.imobNumero ?? "",
      imobComplemento: data.imobComplemento ?? "",
      imobBairro: data.imobBairro ?? "",
      imobCidade: data.imobCidade ?? "",
      imobEstado: data.imobEstado ?? "",
      respNome: data.respNome ?? "",
      respCpf: data.respCpf ?? "",
      respCreci: data.respCreci ?? "",
      respTelefone: data.respTelefone ?? "",
      respEmail: data.respEmail ?? "",
      bancoNome: data.bancoNome ?? "",
      bancoAgencia: data.bancoAgencia ?? "",
      bancoConta: data.bancoConta ?? "",
      bancoTipoConta: (data.bancoTipoConta as FormState["bancoTipoConta"]) ?? "",
      bancoTitular: data.bancoTitular ?? "",
      bancoTitularDoc: data.bancoTitularDoc ?? "",
      pixTipo: (data.pixTipo as FormState["pixTipo"]) ?? "",
      pixChave: data.pixChave ?? "",
      comissaoVenda: bpsToPercent(data.comissaoVendaBps),
      comissaoLocacao: bpsToPercent(data.comissaoLocacaoBps),
      comissaoImobiliaria: bpsToPercent(data.comissaoImobiliariaBps),
      comissaoCorretor: bpsToPercent(data.comissaoCorretorBps),
      diaPagamentoCorretor: data.diaPagamentoCorretor,
      metodoPagamentoCorretor: data.metodoPagamentoCorretor,
    });
  }, [data]);

  const save = trpc.systemParameters.save.useMutation({
    onSuccess: () => {
      toast.success("Parâmetros salvos.");
      utils.systemParameters.get.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(s => ({ ...s, [key]: value }));

  const onSubmit = () => {
    save.mutate({
      imobNomeFantasia: form.imobNomeFantasia || null,
      imobRazaoSocial: form.imobRazaoSocial || null,
      imobCnpj: form.imobCnpj || null,
      imobCreciPj: form.imobCreciPj || null,
      imobInscricaoEstadual: form.imobInscricaoEstadual || null,
      imobTelefone: form.imobTelefone || null,
      imobEmail: form.imobEmail || null,
      imobCep: form.imobCep || null,
      imobEndereco: form.imobEndereco || null,
      imobNumero: form.imobNumero || null,
      imobComplemento: form.imobComplemento || null,
      imobBairro: form.imobBairro || null,
      imobCidade: form.imobCidade || null,
      imobEstado: form.imobEstado || null,
      respNome: form.respNome || null,
      respCpf: form.respCpf || null,
      respCreci: form.respCreci || null,
      respTelefone: form.respTelefone || null,
      respEmail: form.respEmail || null,
      bancoNome: form.bancoNome || null,
      bancoAgencia: form.bancoAgencia || null,
      bancoConta: form.bancoConta || null,
      bancoTipoConta: form.bancoTipoConta || null,
      bancoTitular: form.bancoTitular || null,
      bancoTitularDoc: form.bancoTitularDoc || null,
      pixTipo: form.pixTipo || null,
      pixChave: form.pixChave || null,
      comissaoVendaBps: percentToBps(form.comissaoVenda),
      comissaoLocacaoBps: percentToBps(form.comissaoLocacao),
      comissaoImobiliariaBps: percentToBps(form.comissaoImobiliaria),
      comissaoCorretorBps: percentToBps(form.comissaoCorretor),
      diaPagamentoCorretor: form.diaPagamentoCorretor,
      metodoPagamentoCorretor: form.metodoPagamentoCorretor,
    });
  };

  const handleCepBlur = async () => {
    const digits = form.imobCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await lookupCep(digits);
      if (r.status === "success") {
        setForm(s => ({
          ...s,
          imobEndereco: r.data.endereco || s.imobEndereco,
          imobBairro: r.data.bairro || s.imobBairro,
          imobCidade: r.data.cidade || s.imobCidade,
          imobEstado: r.data.estado || s.imobEstado,
        }));
      } else if (r.status === "not_found") {
        toast.error("CEP não encontrado.");
      } else {
        toast.error("Serviço de CEP indisponível.");
      }
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Settings className="h-6 w-6" />
              Parâmetros do Sistema
            </h1>
            <p className="text-sm text-muted-foreground">
              Configurações gerais da imobiliária, corretor responsável,
              dados bancários e regras de comissão.
            </p>
          </div>
          <Button
            onClick={onSubmit}
            disabled={save.isPending || isLoading}
            size="lg"
          >
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>

        <Tabs defaultValue="imobiliaria" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="imobiliaria" className="gap-2">
              <Building2 className="h-4 w-4" /> Imobiliária
            </TabsTrigger>
            <TabsTrigger value="responsavel" className="gap-2">
              <UserRound className="h-4 w-4" /> Responsável
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-2">
              <Banknote className="h-4 w-4" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="comissoes" className="gap-2">
              <Percent className="h-4 w-4" /> Comissões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="imobiliaria" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações sobre a Imobiliária</CardTitle>
                <CardDescription>
                  Dados cadastrais que aparecem em contratos, boletos e
                  comunicados oficiais.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label>Nome fantasia</Label>
                  <Input
                    value={form.imobNomeFantasia}
                    onChange={e => set("imobNomeFantasia", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Razão social</Label>
                  <Input
                    value={form.imobRazaoSocial}
                    onChange={e => set("imobRazaoSocial", e.target.value)}
                  />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={form.imobCnpj}
                    onChange={e => set("imobCnpj", e.target.value)}
                  />
                </div>
                <div>
                  <Label>CRECI-PJ</Label>
                  <Input
                    value={form.imobCreciPj}
                    onChange={e => set("imobCreciPj", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={form.imobInscricaoEstadual}
                    onChange={e =>
                      set("imobInscricaoEstadual", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.imobTelefone}
                    onChange={e => set("imobTelefone", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>E-mail institucional</Label>
                  <Input
                    type="email"
                    value={form.imobEmail}
                    onChange={e => set("imobEmail", e.target.value)}
                  />
                </div>
                <div>
                  <Label>
                    CEP
                    {cepLoading ? (
                      <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
                    ) : null}
                  </Label>
                  <Input
                    value={form.imobCep}
                    onChange={e => set("imobCep", e.target.value)}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    value={form.imobEndereco}
                    onChange={e => set("imobEndereco", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={form.imobNumero}
                    onChange={e => set("imobNumero", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input
                    value={form.imobComplemento}
                    onChange={e => set("imobComplemento", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={form.imobBairro}
                    onChange={e => set("imobBairro", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={form.imobCidade}
                    onChange={e => set("imobCidade", e.target.value)}
                  />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input
                    maxLength={2}
                    value={form.imobEstado}
                    onChange={e =>
                      set("imobEstado", e.target.value.toUpperCase())
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="responsavel" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Corretor Responsável</CardTitle>
                <CardDescription>
                  Responsável técnico registrado no CRECI que assina em nome
                  da imobiliária.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={form.respNome}
                    onChange={e => set("respNome", e.target.value)}
                  />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={form.respCpf}
                    onChange={e => set("respCpf", e.target.value)}
                  />
                </div>
                <div>
                  <Label>CRECI</Label>
                  <Input
                    value={form.respCreci}
                    onChange={e => set("respCreci", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.respTelefone}
                    onChange={e => set("respTelefone", e.target.value)}
                  />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.respEmail}
                    onChange={e => set("respEmail", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financeiro" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações Financeiras</CardTitle>
                <CardDescription>
                  Conta bancária e chave PIX usadas em recebimentos e
                  transferências ao corretor.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label>Banco (nome ou nº)</Label>
                  <Input
                    value={form.bancoNome}
                    onChange={e => set("bancoNome", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tipo de conta</Label>
                  <Select
                    value={form.bancoTipoConta || undefined}
                    onValueChange={v =>
                      set("bancoTipoConta", v as FormState["bancoTipoConta"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input
                    value={form.bancoAgencia}
                    onChange={e => set("bancoAgencia", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input
                    value={form.bancoConta}
                    onChange={e => set("bancoConta", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Titular</Label>
                  <Input
                    value={form.bancoTitular}
                    onChange={e => set("bancoTitular", e.target.value)}
                  />
                </div>
                <div>
                  <Label>CPF/CNPJ do titular</Label>
                  <Input
                    value={form.bancoTitularDoc}
                    onChange={e => set("bancoTitularDoc", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tipo de chave PIX</Label>
                  <Select
                    value={form.pixTipo || undefined}
                    onValueChange={v =>
                      set("pixTipo", v as FormState["pixTipo"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Chave PIX</Label>
                  <Input
                    value={form.pixChave}
                    onChange={e => set("pixChave", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comissoes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Comissões e Pagamentos</CardTitle>
                <CardDescription>
                  Percentuais padrão aplicados a novas propostas. Percentuais
                  aceitam duas casas decimais (ex: 6,25).
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label>Comissão de venda (% do valor)</Label>
                  <Input
                    value={form.comissaoVenda}
                    onChange={e => set("comissaoVenda", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Comissão de locação (% do 1º aluguel)</Label>
                  <Input
                    value={form.comissaoLocacao}
                    onChange={e => set("comissaoLocacao", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Fica com a imobiliária (% da comissão)</Label>
                  <Input
                    value={form.comissaoImobiliaria}
                    onChange={e => set("comissaoImobiliaria", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Vai pro corretor (% da comissão)</Label>
                  <Input
                    value={form.comissaoCorretor}
                    onChange={e => set("comissaoCorretor", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Dia do pagamento ao corretor</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.diaPagamentoCorretor}
                    onChange={e =>
                      set(
                        "diaPagamentoCorretor",
                        parseInt(e.target.value || "10", 10)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Método de pagamento padrão</Label>
                  <Select
                    value={form.metodoPagamentoCorretor}
                    onValueChange={v =>
                      set(
                        "metodoPagamentoCorretor",
                        v as FormState["metodoPagamentoCorretor"]
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="ted">TED</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
