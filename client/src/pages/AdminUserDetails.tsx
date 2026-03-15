import { useAuth } from "@/_core/hooks/useAuth";
import DateInput from "@/components/DateInput";
import Layout from "@/components/Layout";
import MoneyInput from "@/components/MoneyInput";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCep } from "@/lib/cep";
import { formatCreci, isValidCreci } from "@/lib/creci";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
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
import { formatPhoneNumber } from "@/lib/phone";
import { trpc } from "@/lib/trpc";
import { type AppRole } from "@shared/auth";
import { USER_PROFILE_MARITAL_STATUSES, type UserProfileMaritalStatus } from "@shared/user-profile";
import { ArrowLeft, BadgeCheck, Clock3, Save, UserRoundSearch } from "lucide-react";
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
  creci: string;
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

const SOUTH_AMERICAN_NATIONALITIES = [
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Equador",
  "Guiana",
  "Paraguai",
  "Peru",
  "Suriname",
  "Uruguai",
  "Venezuela",
] as const;

export default function AdminUserDetails() {
  const { user: authenticatedUser } = useAuth();
  const [isAdminRoute, params] = useRoute("/admin/users/:id");
  const [isOwnerRoute, ownerParams] = useRoute("/admin/proprietarios/:id");
  const [isSelfRoute] = useRoute("/minha-ficha");
  const userId = isAdminRoute ? Number(params?.id) : authenticatedUser?.id ?? NaN;
  const ownerId = isOwnerRoute ? Number(ownerParams?.id) : NaN;
  const utils = trpc.useUtils();
  const [form, setForm] = useState<UserDetailsForm | null>(null);
  const [confirmCreciRemovalOpen, setConfirmCreciRemovalOpen] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const cepTimeoutRef = useRef<number | null>(null);

  const {
    data: adminUser,
    isLoading: adminUserLoading,
    error: adminUserError,
  } = trpc.admin.userById.useQuery(
    { id: userId },
    { enabled: isAdminRoute && Number.isFinite(userId) }
  );

  const { data: selfUser, isLoading: selfUserLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: isSelfRoute,
  });

  const { data: propertyOwner, isLoading: propertyOwnerLoading } = trpc.admin.propertyOwnerById.useQuery(
    { id: ownerId },
    { enabled: isOwnerRoute && Number.isFinite(ownerId) }
  );

  const user = isAdminRoute ? adminUser : selfUser;
  const isOwnerDetails = isOwnerRoute;
  const isLoading = isOwnerRoute
    ? propertyOwnerLoading
    : isAdminRoute
      ? adminUserLoading
      : selfUserLoading;
  const isEditingSelf = isSelfRoute && !isAdminRoute;
  const authenticatedIsRootAdmin =
    authenticatedUser?.role === "administrativo" &&
    authenticatedUser?.registrationSource === "bootstrap";
  const isViewingAdminAccount = user?.role === "administrativo";
  const isOwnAdminAccount = user?.id === authenticatedUser?.id;
  const isReadOnlyAdminAccount =
    isAdminRoute && isViewingAdminAccount && !authenticatedIsRootAdmin && !isOwnAdminAccount;
  const canValidateCreci =
    isAdminRoute &&
    authenticatedUser?.role === "administrativo" &&
    user?.role === "corretor" &&
    user?.creciStatus === "pending" &&
    !!user?.creci;
  const isFromClientArea =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("from") === "area-cliente";
  const isSelfRootAdmin =
    isSelfRoute &&
    selfUser?.role === "administrativo" &&
    selfUser?.registrationSource === "bootstrap";
  const fromPropertyId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("fromProperty")
      : null;
  const backHref = fromPropertyId
    ? `/imoveis/${fromPropertyId}`
    : isSelfRootAdmin
      ? "/admin"
    : isEditingSelf
      ? (isFromClientArea ? "/area-cliente" : "/")
      : isOwnerDetails
        ? "/admin"
        : "/admin/users";
  const backLabel = fromPropertyId
    ? "Voltar para imovel"
    : isSelfRootAdmin
      ? "Voltar para painel admin"
    : isEditingSelf
      ? isFromClientArea
        ? "Voltar para \u00C1rea do Cliente"
        : "Voltar para Home"
      : isOwnerDetails
        ? "Voltar para painel admin"
        : "Voltar para usu\u00E1rios";
  const accessBlockedMessage = isSelfRootAdmin
    ? "A ficha do admin principal não está disponível no sistema."
    : adminUserError?.message?.includes("ficha do admin principal")
      ? "A ficha do admin principal não está disponível no sistema."
      : null;

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

  const validateCreci = trpc.admin.validateCreci.useMutation({
    onSuccess: async () => {
      toast.success("CRECI validado com sucesso");
      await utils.admin.userById.invalidate({ id: userId });
      await utils.admin.users.invalidate();
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel validar o CRECI");
    },
  });

  const updatePropertyOwnerDetails = trpc.admin.updatePropertyOwnerDetails.useMutation({
    onSuccess: async () => {
      toast.success("Ficha do proprietario atualizada");
      await utils.admin.propertyOwnerById.invalidate({ id: ownerId });
    },
    onError: error => {
      if (error.message.startsWith("OWNER_EMAIL_CONFLICT::")) {
        toast.error(error.message.replace("OWNER_EMAIL_CONFLICT::", ""));
        return;
      }
      toast.error(error.message || "Nao foi possivel salvar a ficha do proprietario");
    },
  });

  useEffect(() => {
    if (isOwnerDetails) {
      if (!propertyOwner) return;

      setForm({
        name: propertyOwner.name || "",
        email: propertyOwner.email || "",
        cpf: propertyOwner.cpf || "",
        role: "cliente",
        isActive: "1",
        phone: propertyOwner.phone || "",
        creci: "",
        birthDate: "",
        profession: "",
        grossMonthlyIncome: "",
        maritalStatus: "",
        householdIncome: "",
        rg: "",
        nationality: "",
        address: "",
        neighborhood: "",
        addressNumber: "",
        city: "",
        state: "",
        zipCode: "",
        notes: propertyOwner.notes || "",
      });
      return;
    }

    if (!user) return;

    setForm({
      name: user.name || "",
      email: user.email || "",
      cpf: user.cpf || "",
      role: user.role,
      isActive: String(user.isActive) as "0" | "1",
      phone: user.phone || "",
      creci: user.creci || "",
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
  }, [isOwnerDetails, propertyOwner, user]);

  useEffect(() => {
    if (!isAdminRoute || !adminUser) return;

    void utils.admin.users.invalidate();
    void utils.admin.hasNewUsers.invalidate();
  }, [adminUser, isAdminRoute, utils]);

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

  const persistSave = () => {
    if (!form) return;

    if (isOwnerDetails) {
      updatePropertyOwnerDetails.mutate({
        id: ownerId,
        name: form.name,
        email: form.email,
        cpf: normalizeCpf(form.cpf),
        phone: form.phone,
        notes: form.notes || undefined,
      });
      return;
    }

    const payload = {
      name: form.name,
      email: form.email,
      cpf: normalizeCpf(form.cpf),
      phone: form.phone || undefined,
      creci: form.role === "corretor" ? formatCreci(form.creci) || undefined : undefined,
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
    };

    if (isEditingSelf) {
      updateOwnProfile.mutate(payload);
      return;
    }

    updateUserDetails.mutate({
      id: userId,
      ...payload,
      role: form.role,
      isActive: Number(form.isActive) as 0 | 1,
    });
  };

  const handleSave = () => {
    if (!form) return;
    if (isReadOnlyAdminAccount) {
      toast.error(
        "Apenas o proprio administrador ou o admin principal podem alterar esta conta administrativa."
      );
      return;
    }

    if (!isValidCpf(form.cpf)) {
      toast.error("CPF invalido. Confira os digitos informados.");
      return;
    }

    if (isOwnerDetails) {
      persistSave();
      return;
    }

    if (form.role === "corretor" && form.creci && !isValidCreci(form.creci)) {
      toast.error("CRECI invalido. Use o formato numero/UF, por exemplo 123456/SP.");
      return;
    }

    const isRemovingVerifiedCreci =
      user?.role === "corretor" &&
      user.creciStatus === "verified" &&
      !!user.creci &&
      (form.role !== "corretor" || !formatCreci(form.creci));

    if (isRemovingVerifiedCreci) {
      setConfirmCreciRemovalOpen(true);
      return;
    }

    persistSave();
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
            <h1 className="text-4xl font-bold">
              {isOwnerDetails ? "Ficha do Proprietario" : "Ficha do Usuário"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isOwnerDetails
                ? "Gerencie os dados do proprietario vinculado ao imovel."
                : "Complete os dados pessoais e financeiros exigidos para contratos."}
            </p>
          </div>
        </div>

        {accessBlockedMessage ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              {accessBlockedMessage}
            </CardContent>
          </Card>
        ) : isLoading || !form ? (
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
            {isReadOnlyAdminAccount ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-4 text-sm text-amber-900">
                  Apenas o proprio administrador ou o admin principal podem alterar esta conta administrativa.
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRoundSearch className="h-5 w-5" />
                  {isOwnerDetails ? "Dados do proprietario" : "Dados obrigatórios"}
                </CardTitle>
                <CardDescription>
                  {isOwnerDetails
                    ? "Nome, e-mail, CPF e telefone identificam o proprietario vinculado a este imovel."
                    : "Nome, e-mail, CPF e senha são obrigatórios para cadastro. Os demais campos podem ser preenchidos aqui."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    value={form.email}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    disabled={isReadOnlyAdminAccount}
                    inputMode="numeric"
                    maxLength={14}
                    onChange={e => setForm({ ...form, cpf: formatCpf(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={form.phone}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })}
                  />
                </div>
                {isOwnerDetails ? (
                  propertyOwner?.linkedUser ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Conta vinculada</Label>
                      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                        <Link href={`/admin/users/${propertyOwner.linkedUser.id}`}>
                          <a className="font-medium text-primary underline">
                            {propertyOwner.linkedUser.name || propertyOwner.linkedUser.email}
                          </a>
                        </Link>
                        <p className="mt-1 text-muted-foreground">
                          Este proprietario ja possui um usuario vinculado pelo CPF.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Conta vinculada</Label>
                      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        Este proprietario ainda nao possui login vinculado. Essa ficha permanece acessivel a partir do imovel.
                      </div>
                    </div>
                  )
                ) : isEditingSelf ? (
                  form.role === "corretor" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>CRECI</Label>
                        {user?.creciStatus === "verified" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <BadgeCheck className="h-4 w-4" />
                            Validado
                          </span>
                        ) : user?.creciStatus === "pending" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                            <Clock3 className="h-4 w-4" />
                            Pendente
                          </span>
                        ) : null}
                      </div>
                      <Input
                        value={form.creci}
                        disabled={isReadOnlyAdminAccount}
                        maxLength={10}
                        placeholder="123456/SP"
                        onChange={e => setForm({ ...form, creci: formatCreci(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use o formato numero/UF, por exemplo `123456/SP`.
                      </p>
                    </div>
                  ) : null
                ) : form.role === "corretor" ? (
                  <div className="grid gap-4 md:col-span-2 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>CRECI</Label>
                        {user?.creciStatus === "verified" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <BadgeCheck className="h-4 w-4" />
                            Validado
                          </span>
                        ) : user?.creciStatus === "pending" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                            <Clock3 className="h-4 w-4" />
                            Pendente
                          </span>
                        ) : null}
                      </div>
                      <Input
                        value={form.creci}
                        disabled={isReadOnlyAdminAccount}
                        maxLength={10}
                        placeholder="123456/SP"
                        onChange={e => setForm({ ...form, creci: formatCreci(e.target.value) })}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Use o formato numero/UF, por exemplo `123456/SP`.
                        </p>
                        {canValidateCreci ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-2"
                            disabled={validateCreci.isPending}
                            onClick={() => validateCreci.mutate({ userId })}
                          >
                            <BadgeCheck className="h-4 w-4" />
                            {validateCreci.isPending ? "Validando..." : "Validar"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Papel</Label>
                      <Select
                        value={form.role}
                        disabled={isReadOnlyAdminAccount}
                        onValueChange={value => setForm({ ...form, role: value as AppRole })}
                      >
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
                      <Select
                        value={form.isActive}
                        disabled={isReadOnlyAdminAccount}
                        onValueChange={value => setForm({ ...form, isActive: value as "0" | "1" })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Ativo</SelectItem>
                          <SelectItem value="0">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Papel</Label>
                      <Select
                        value={form.role}
                        disabled={isReadOnlyAdminAccount}
                        onValueChange={value => setForm({ ...form, role: value as AppRole })}
                      >
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
                      <Select
                        value={form.isActive}
                        disabled={isReadOnlyAdminAccount}
                        onValueChange={value => setForm({ ...form, isActive: value as "0" | "1" })}
                      >
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

            {!isOwnerDetails ? (
            <Card>
              <CardHeader>
                <CardTitle>Informações para Contratos</CardTitle>
                <CardDescription>
                  Estes campos são importantes para venda e locação.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <DateInput
                    disabled={isReadOnlyAdminAccount}
                    value={form.birthDate}
                    onValueChange={value => setForm({ ...form, birthDate: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profissão</Label>
                  <Input
                    value={form.profession}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, profession: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Salário Bruto Mensal</Label>
                  <MoneyInput
                    disabled={isReadOnlyAdminAccount}
                    value={form.grossMonthlyIncome}
                    onValueChange={value =>
                      setForm(current =>
                        current ? { ...current, grossMonthlyIncome: value } : current
                      )
                    }
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-[220px_220px]">
                  <div className="space-y-2">
                    <Label>Estado Civil</Label>
                  <Select
                    value={form.maritalStatus || "empty"}
                    disabled={isReadOnlyAdminAccount}
                    onValueChange={value =>
                      setForm({
                        ...form,
                        maritalStatus: value === "empty" ? "" : (value as UserProfileMaritalStatus),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empty">Não Informado</SelectItem>
                      {USER_PROFILE_MARITAL_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>
                          {getMaritalStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nacionalidade</Label>
                  <Select
                    value={form.nationality || "empty"}
                    disabled={isReadOnlyAdminAccount}
                    onValueChange={value =>
                      setForm({
                        ...form,
                        nationality: value === "empty" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empty">Não Informado</SelectItem>
                      {SOUTH_AMERICAN_NATIONALITIES.map(nationality => (
                        <SelectItem key={nationality} value={nationality}>
                          {nationality}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Renda Familiar Conjunta</Label>
                  <MoneyInput
                    disabled={isReadOnlyAdminAccount}
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
                  <Input
                    value={form.rg}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, rg: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>{isOwnerDetails ? "Observações do proprietário" : "Endereço Atual e Observações"}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {!isOwnerDetails ? (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Endereço</Label>
                      <Input
                        value={form.address}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input
                        value={form.addressNumber}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, addressNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input
                        value={form.neighborhood}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input
                        value={form.city}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>UF</Label>
                      <Input
                        value={form.state}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input
                        value={form.zipCode}
                        disabled={isReadOnlyAdminAccount}
                        inputMode="numeric"
                        maxLength={9}
                        onChange={e => handleZipCodeChange(e.target.value)}
                      />
                      {cepLoading ? (
                        <p className="text-xs text-muted-foreground">Buscando CEP...</p>
                      ) : null}
                      {cepError ? <p className="text-xs text-red-500">{cepError}</p> : null}
                    </div>
                  </>
                ) : null}
                <div className="space-y-2 md:col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={form.notes}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={5}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button
                  className="gap-2"
                  disabled={
                    isReadOnlyAdminAccount ||
                    updateUserDetails.isPending ||
                    updateOwnProfile.isPending ||
                    updatePropertyOwnerDetails.isPending
                  }
                  onClick={handleSave}
                >
                  <Save className="h-4 w-4" />
                  {updateUserDetails.isPending || updateOwnProfile.isPending || updatePropertyOwnerDetails.isPending
                    ? "Salvando..."
                    : "Salvar ficha"}
                </Button>
            </div>

            <AlertDialog
              open={confirmCreciRemovalOpen}
              onOpenChange={setConfirmCreciRemovalOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar remo??o do CRECI?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa operação está retirando o cadastro do CRECI desse corretor, deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setConfirmCreciRemovalOpen(false);
                      persistSave();
                    }}
                  >
                    Continuar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </Layout>
  );
}


