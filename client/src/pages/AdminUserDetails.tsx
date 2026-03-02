import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { type AppRole } from "@shared/auth";
import { USER_PROFILE_MARITAL_STATUSES, type UserProfileMaritalStatus } from "@shared/user-profile";
import { ArrowLeft, Save, UserRoundSearch } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

type UserDetailsForm = {
  name: string;
  email: string;
  cpf: string;
  role: AppRole;
  isActive: "0" | "1";
  phone: string;
  birthDate: string;
  profession: string;
  grossMonthlyIncome: string;
  maritalStatus: UserProfileMaritalStatus | "";
  householdIncome: string;
  rg: string;
  nationality: string;
  address: string;
  neighborhood: string;
  addressNumber: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
};

function currencyToNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits);
}

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

function formatCurrencyInput(value: string) {
  const normalized = normalizeCurrencyInput(value);
  if (!normalized) return "";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(normalized) / 100);
}

function getMaritalStatusLabel(status: UserProfileMaritalStatus) {
  const labels: Record<UserProfileMaritalStatus, string> = {
    solteiro: "Solteiro(a)",
    casado: "Casado(a)",
    uniao_estavel: "Uniao estavel",
    divorciado: "Divorciado(a)",
    viuvo: "Viuvo(a)",
  };

  return labels[status];
}

async function buscarCEP(cep: string) {
  const cepLimpo = cep.replace(/\D/g, "");

  if (cepLimpo.length !== 8) {
    return null;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await response.json();

    if (data.erro) {
      return null;
    }

    return {
      endereco: data.logradouro || "",
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      estado: data.uf || "",
    };
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    return null;
  }
}

export default function AdminUserDetails() {
  const [, params] = useRoute("/admin/users/:id");
  const userId = params?.id ? Number(params.id) : NaN;
  const utils = trpc.useUtils();
  const [form, setForm] = useState<UserDetailsForm | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const cepTimeoutRef = useRef<number | null>(null);

  const { data: user, isLoading } = trpc.admin.userById.useQuery(
    { id: userId },
    { enabled: Number.isFinite(userId) }
  );

  const updateUserDetails = trpc.admin.updateUserDetails.useMutation({
    onSuccess: async () => {
      toast.success("Ficha do usuário atualizada");
      await utils.admin.userById.invalidate({ id: userId });
      await utils.admin.users.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Não foi possível salvar a ficha");
    },
  });

  useEffect(() => {
    if (!user) return;

    setForm({
      name: user.name || "",
      email: user.email || "",
      cpf: user.cpf || "",
      role: user.role,
      isActive: String(user.isActive) as "0" | "1",
      phone: user.phone || "",
      birthDate: toDateInputValue(user.birthDate),
      profession: user.profession || "",
      grossMonthlyIncome:
        user.grossMonthlyIncome !== null && user.grossMonthlyIncome !== undefined
          ? String(user.grossMonthlyIncome)
          : "",
      maritalStatus: (user.maritalStatus as UserProfileMaritalStatus | null) || "",
      householdIncome:
        user.householdIncome !== null && user.householdIncome !== undefined
          ? String(user.householdIncome)
          : "",
      rg: user.rg || "",
      nationality: user.nationality || "",
      address: user.address || "",
      neighborhood: user.neighborhood || "",
      addressNumber: user.addressNumber || "",
      city: user.city || "",
      state: user.state || "",
      zipCode: user.zipCode || "",
      notes: user.notes || "",
    });
  }, [user]);

  useEffect(() => {
    return () => {
      if (cepTimeoutRef.current !== null) {
        window.clearTimeout(cepTimeoutRef.current);
      }
    };
  }, []);

  const handleZipCodeChange = (value: string) => {
    const formattedValue = formatZipCode(value);

    setForm(current => (current ? { ...current, zipCode: formattedValue } : current));
    setCepError("");

    if (cepTimeoutRef.current !== null) {
      window.clearTimeout(cepTimeoutRef.current);
    }

    if (formattedValue.replace(/\D/g, "").length < 8) {
      setCepLoading(false);
      return;
    }

    setCepLoading(true);

    cepTimeoutRef.current = window.setTimeout(async () => {
      const dados = await buscarCEP(formattedValue);

      if (!dados) {
        setCepError("CEP não encontrado");
        setCepLoading(false);
        return;
      }

      setForm(current =>
        current
          ? {
              ...current,
              zipCode: formattedValue,
              address: dados.endereco,
              neighborhood: dados.bairro,
              city: dados.cidade,
              state: dados.estado,
            }
          : current
      );

      setCepError("");
      setCepLoading(false);
    }, 500);
  };

  const updateCurrencyField = (
    field: "grossMonthlyIncome" | "householdIncome",
    nextValue: string
  ) => {
    const normalized = normalizeCurrencyInput(nextValue);
    setForm(current => (current ? { ...current, [field]: normalized } : current));
  };

  const handleCurrencyKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    field: "grossMonthlyIncome" | "householdIncome"
  ) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      setForm(current =>
        current
          ? { ...current, [field]: normalizeCurrencyInput(`${current[field]}${event.key}`) }
          : current
      );
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      setForm(current =>
        current ? { ...current, [field]: current[field].slice(0, -1) } : current
      );
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      updateCurrencyField(field, "");
      return;
    }

    const allowedKeys = ["Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowedKeys.includes(event.key)) {
      return;
    }

    event.preventDefault();
  };

  const handleCurrencyPaste = (
    event: ClipboardEvent<HTMLInputElement>,
    field: "grossMonthlyIncome" | "householdIncome"
  ) => {
    event.preventDefault();
    updateCurrencyField(field, event.clipboardData.getData("text"));
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-3">
              <Link href="/admin/users">
                <a className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Voltar para usuarios</span>
                </a>
              </Link>
            </div>
            <h1 className="text-4xl font-bold">Ficha do Usuário</h1>
            <p className="text-muted-foreground">
              Complete os dados pessoais e financeiros exigidos para contratos.
            </p>
          </div>
        </div>

        {isLoading || !form ? (
          <Card>
            <CardContent className="py-8">
              <div className="space-y-3">
                {[1, 2, 3].map(item => (
                  <div key={item} className="h-12 rounded bg-muted animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRoundSearch className="h-5 w-5" />
                  Dados obrigatórios
                </CardTitle>
                <CardDescription>
                  Nome, e-mail, CPF e senha são obrigatórios para cadastro. Os demais campos podem ser preenchidos aqui.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={form.role} onValueChange={value => setForm({ ...form, role: value as AppRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="corretor">Corretor</SelectItem>
                      <SelectItem value="administrativo">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.isActive} onValueChange={value => setForm({ ...form, isActive: value as "0" | "1" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Ativo</SelectItem>
                      <SelectItem value="0">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informações para contratos</CardTitle>
                <CardDescription>
                  Estes campos são importantes para venda e locação.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Profissão</Label>
                  <Input value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Salário bruto mensal</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInput(form.grossMonthlyIncome)}
                    onChange={() => undefined}
                    onKeyDown={event => handleCurrencyKeyDown(event, "grossMonthlyIncome")}
                    onPaste={event => handleCurrencyPaste(event, "grossMonthlyIncome")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado civil</Label>
                  <Select
                    value={form.maritalStatus || "empty"}
                    onValueChange={value =>
                      setForm({
                        ...form,
                        maritalStatus: value === "empty" ? "" : (value as UserProfileMaritalStatus),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empty">Não informado</SelectItem>
                      {USER_PROFILE_MARITAL_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>
                          {getMaritalStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Renda familiar conjunta</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInput(form.householdIncome)}
                    onChange={() => undefined}
                    onKeyDown={event => handleCurrencyKeyDown(event, "householdIncome")}
                    onPaste={event => handleCurrencyPaste(event, "householdIncome")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={form.rg} onChange={e => setForm({ ...form, rg: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nacionalidade</Label>
                  <Input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Endereço Atual e Observações</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={form.addressNumber}
                    onChange={e => setForm({ ...form, addressNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    value={form.neighborhood}
                    onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={form.zipCode}
                    inputMode="numeric"
                    maxLength={9}
                    onChange={e => handleZipCodeChange(e.target.value)}
                  />
                  {cepLoading ? (
                    <p className="text-xs text-muted-foreground">Buscando CEP...</p>
                  ) : null}
                  {cepError ? <p className="text-xs text-red-500">{cepError}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={5} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                className="gap-2"
                disabled={updateUserDetails.isPending}
                onClick={() =>
                  updateUserDetails.mutate({
                    id: userId,
                    name: form.name,
                    email: form.email,
                    cpf: form.cpf,
                    role: form.role,
                    isActive: Number(form.isActive) as 0 | 1,
                    phone: form.phone || undefined,
                    birthDate: form.birthDate || null,
                    profession: form.profession || undefined,
                    grossMonthlyIncome: currencyToNumber(form.grossMonthlyIncome),
                    maritalStatus: form.maritalStatus || null,
                    householdIncome: currencyToNumber(form.householdIncome),
                    rg: form.rg || undefined,
                    nationality: form.nationality || undefined,
                    address: form.address || undefined,
                    neighborhood: form.neighborhood || undefined,
                    addressNumber: form.addressNumber || undefined,
                    city: form.city || undefined,
                    state: form.state || undefined,
                    zipCode: form.zipCode || undefined,
                    notes: form.notes || undefined,
                  })
                }
              >
                <Save className="h-4 w-4" />
                {updateUserDetails.isPending ? "Salvando..." : "Salvar ficha"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
