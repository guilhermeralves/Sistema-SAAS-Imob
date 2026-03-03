import { useAuth } from "@/_core/hooks/useAuth";
import DateInput from "@/components/DateInput";
import Layout from "@/components/Layout";
import MoneyInput from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCep } from "@/lib/cep";
import { displayDateToIso, isoDateToDisplay } from "@/lib/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseMoneyCentsInput } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { type AppRole } from "@shared/auth";
import { USER_PROFILE_MARITAL_STATUSES, type UserProfileMaritalStatus } from "@shared/user-profile";
import { ArrowLeft, Save, UserRoundSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
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

export default function AdminUserDetails() {
  const { user: authenticatedUser } = useAuth();
  const [isAdminRoute, params] = useRoute("/admin/users/:id");
  const [isSelfRoute] = useRoute("/minha-ficha");
  const userId = isAdminRoute ? Number(params?.id) : authenticatedUser?.id ?? NaN;
  const utils = trpc.useUtils();
  const [form, setForm] = useState<UserDetailsForm | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const cepTimeoutRef = useRef<number | null>(null);

  const { data: adminUser, isLoading: adminUserLoading } = trpc.admin.userById.useQuery(
    { id: userId },
    { enabled: isAdminRoute && Number.isFinite(userId) }
  );

  const { data: selfUser, isLoading: selfUserLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: isSelfRoute,
  });

  const user = isAdminRoute ? adminUser : selfUser;
  const isLoading = isAdminRoute ? adminUserLoading : selfUserLoading;
  const isEditingSelf = isSelfRoute && !isAdminRoute;
  const isFromClientArea =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("from") === "area-cliente";
  const backHref = isEditingSelf ? (isFromClientArea ? "/area-cliente" : "/") : "/admin/users";
  const backLabel = isEditingSelf
    ? isFromClientArea
      ? "Voltar para \u00C1rea do Cliente"
      : "Voltar para Home"
    : "Voltar para usu\u00E1rios";

  const updateUserDetails = trpc.admin.updateUserDetails.useMutation({
    onSuccess: async () => {
      toast.success("Ficha do usu\u00E1rio atualizada");
      await utils.admin.userById.invalidate({ id: userId });
      await utils.admin.users.invalidate();
    },
    onError: error => {
      toast.error(error.message || "N\u00E3o foi poss\u00EDvel salvar a ficha");
    },
  });

  const updateOwnProfile = trpc.profile.update.useMutation({
    onSuccess: async () => {
      toast.success("Ficha do usu\u00E1rio atualizada");
      await utils.auth.me.invalidate();
    },
    onError: error => {
      toast.error(error.message || "N\u00E3o foi poss\u00EDvel salvar a ficha");
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
      birthDate: isoDateToDisplay(user.birthDate),
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
      const result = await lookupCep(formattedValue);

      if (result.status !== "success") {
        setCepError(
          result.status === "not_found"
            ? "CEP não encontrado"
            : "Serviço de CEP indisponível no momento"
        );
        setCepLoading(false);
        return;
      }

      const dados = result.data;
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

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-3">
              <Link href={backHref}>
                <a className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  <span>{backLabel}</span>
                </a>
              </Link>
            </div>
            <h1 className="text-4xl font-bold">{"Ficha do Usu\u00E1rio"}</h1>
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
                {isEditingSelf ? null : (
                  <>
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
                  </>
                )}
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
                  <DateInput
                    value={form.birthDate}
                    onValueChange={value => setForm({ ...form, birthDate: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profissão</Label>
                  <Input value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Salário bruto mensal</Label>
                  <MoneyInput
                    value={form.grossMonthlyIncome}
                    onValueChange={value =>
                      setForm(current =>
                        current ? { ...current, grossMonthlyIncome: value } : current
                      )
                    }
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
                  <MoneyInput
                    value={form.householdIncome}
                    onValueChange={value =>
                      setForm(current =>
                        current ? { ...current, householdIncome: value } : current
                      )
                    }
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
                  disabled={updateUserDetails.isPending || updateOwnProfile.isPending}
                  onClick={() =>
                    isEditingSelf
                      ? updateOwnProfile.mutate({
                          name: form.name,
                          email: form.email,
                          cpf: form.cpf,
                          phone: form.phone || undefined,
                          birthDate: displayDateToIso(form.birthDate) || null,
                          profession: form.profession || undefined,
                          grossMonthlyIncome: parseMoneyCentsInput(form.grossMonthlyIncome),
                          maritalStatus: form.maritalStatus || null,
                          householdIncome: parseMoneyCentsInput(form.householdIncome),
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
                      : updateUserDetails.mutate({
                          id: userId,
                          name: form.name,
                          email: form.email,
                          cpf: form.cpf,
                          role: form.role,
                          isActive: Number(form.isActive) as 0 | 1,
                          phone: form.phone || undefined,
                          birthDate: displayDateToIso(form.birthDate) || null,
                          profession: form.profession || undefined,
                          grossMonthlyIncome: parseMoneyCentsInput(form.grossMonthlyIncome),
                          maritalStatus: form.maritalStatus || null,
                          householdIncome: parseMoneyCentsInput(form.householdIncome),
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
                  {updateUserDetails.isPending || updateOwnProfile.isPending ? "Salvando..." : "Salvar ficha"}
                </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
