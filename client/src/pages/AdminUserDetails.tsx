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
import WalletAdminPanel from "@/components/WalletAdminPanel";
import { trpc } from "@/lib/trpc";
import { type AppRole } from "@shared/auth";
import { USER_PROFILE_MARITAL_STATUSES, type UserProfileMaritalStatus } from "@shared/user-profile";
import { ArrowLeft, BadgeCheck, Clock3, KeyRound, Save, UserRoundSearch } from "lucide-react";
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

const SURFACE_CARD_CLASS =
  "rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur";
const FIELD_CLASS =
  "rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm sm:text-base";

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
  const fromRentalProposalId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("fromRentalProposal")
      : null;
  const backHref = fromRentalProposalId
    ? `/admin/modulos/locacoes/propostas/${fromRentalProposalId}`
    : fromPropertyId
    ? `/imoveis/${fromPropertyId}`
    : isSelfRootAdmin
      ? "/admin"
    : isEditingSelf
      ? (isFromClientArea ? "/area-cliente" : "/")
      : isOwnerDetails
        ? "/admin"
        : "/admin/users";
  const backLabel = fromRentalProposalId
    ? "Voltar para proposta"
    : fromPropertyId
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

  const createPropertyOwnerLogin = trpc.admin.createPropertyOwnerLogin.useMutation({
    onSuccess: async result => {
      await utils.admin.propertyOwnerById.invalidate({ id: ownerId });
      await utils.admin.users.invalidate();
      if (result.temporaryPassword) {
        toast.success(`Login cadastrado. Senha temporaria: ${result.temporaryPassword}`);
        return;
      }
      toast.success("Login vinculado ao proprietario.");
    },
    onError: error => {
      toast.error(error.message || "Nao foi possivel cadastrar o login do proprietario.");
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
        birthDate: isoDateToDisplay(propertyOwner.birthDate),
        profession: propertyOwner.profession || "",
        grossMonthlyIncome:
          propertyOwner.grossMonthlyIncome !== null && propertyOwner.grossMonthlyIncome !== undefined
            ? String(propertyOwner.grossMonthlyIncome)
            : "",
        maritalStatus: (propertyOwner.maritalStatus as UserProfileMaritalStatus | null) || "",
        householdIncome:
          propertyOwner.householdIncome !== null && propertyOwner.householdIncome !== undefined
            ? String(propertyOwner.householdIncome)
            : "",
        rg: propertyOwner.rg || "",
        nationality: propertyOwner.nationality || "",
        address: propertyOwner.address || "",
        neighborhood: propertyOwner.neighborhood || "",
        addressNumber: propertyOwner.addressNumber || "",
        city: propertyOwner.city || "",
        state: propertyOwner.state || "",
        zipCode: propertyOwner.zipCode || "",
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
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)]">
      <div className="container space-y-6 py-8 md:py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-3">
              <Button variant="outline" asChild className="rounded-full bg-white/90 shadow-sm hover:bg-white">
                <Link href={backHref}>
                  <a className="inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>{backLabel}</span>
                  </a>
                </Link>
              </Button>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              {isOwnerDetails ? "Ficha do Proprietario" : "Ficha do Usuário"}
            </h1>
            <p className="mt-2 text-slate-600">
              {isOwnerDetails
                ? "Gerencie os dados do proprietario vinculado ao imovel."
                : "Complete os dados pessoais e financeiros exigidos para contratos."}
            </p>
          </div>
          {isOwnerDetails && propertyOwner && !propertyOwner.linkedUser ? (
            <Button
              type="button"
              className="gap-2 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={createPropertyOwnerLogin.isPending}
              onClick={() => createPropertyOwnerLogin.mutate({ id: ownerId })}
            >
              <KeyRound className="h-4 w-4" />
              {createPropertyOwnerLogin.isPending ? "Cadastrando..." : "Cadastrar login"}
            </Button>
          ) : null}
        </div>

        {accessBlockedMessage ? (
          <Card className={SURFACE_CARD_CLASS}>
            <CardContent className="py-8 text-sm text-slate-600">
              {accessBlockedMessage}
            </CardContent>
          </Card>
        ) : isLoading || !form ? (
          <Card className={SURFACE_CARD_CLASS}>
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
              <Card className="rounded-[28px] border-amber-200 bg-amber-50 shadow-[0_20px_50px_-36px_rgba(120,53,15,0.4)]">
                <CardContent className="py-4 text-sm text-amber-900">
                  Apenas o proprio administrador ou o admin principal podem alterar esta conta administrativa.
                </CardContent>
              </Card>
            ) : null}
            {isAdminRoute && user?.role === "corretor" ? (
              <WalletAdminPanel userId={userId} />
            ) : null}
            <Card className={SURFACE_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <UserRoundSearch className="h-5 w-5" />
                  {isOwnerDetails ? "Dados do proprietario" : "Dados obrigatórios"}
                </CardTitle>
                <CardDescription className="text-slate-600">
                  {isOwnerDetails
                    ? "Nome, e-mail, CPF e telefone identificam o proprietario vinculado a este imovel."
                    : "Nome, e-mail, CPF e senha são obrigatórios para cadastro. Os demais campos podem ser preenchidos aqui."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    className={FIELD_CLASS}
                    value={form.name}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    className={FIELD_CLASS}
                    value={form.email}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    className={FIELD_CLASS}
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
                    className={FIELD_CLASS}
                    value={form.phone}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })}
                  />
                </div>
                {isOwnerDetails ? null : isEditingSelf ? (
                  form.role === "corretor" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
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
                        className={`${FIELD_CLASS} w-full max-w-[220px]`}
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
                      <div className="flex items-center gap-2">
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
                        className={`${FIELD_CLASS} w-full max-w-[220px]`}
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
                        <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
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
                        <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
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
                        <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
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
                        <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
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

            <Card className={SURFACE_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-slate-950">Informações para Contratos</CardTitle>
                <CardDescription className="text-slate-600">
                  Estes campos são importantes para venda e locação.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <DateInput
                    className={FIELD_CLASS}
                    disabled={isReadOnlyAdminAccount}
                    value={form.birthDate}
                    onValueChange={value => setForm({ ...form, birthDate: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profissão</Label>
                  <Input
                    className={FIELD_CLASS}
                    value={form.profession}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, profession: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Salário Bruto Mensal</Label>
                  <MoneyInput
                    className={FIELD_CLASS}
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
                    <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className={FIELD_CLASS}><SelectValue /></SelectTrigger>
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
                    className={FIELD_CLASS}
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
                    className={FIELD_CLASS}
                    value={form.rg}
                    disabled={isReadOnlyAdminAccount}
                    onChange={e => setForm({ ...form, rg: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={SURFACE_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-slate-950">Endereço Atual e Observações</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Endereço</Label>
                      <Input
                        className={FIELD_CLASS}
                        value={form.address}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input
                        className={FIELD_CLASS}
                        value={form.addressNumber}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, addressNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input
                        className={FIELD_CLASS}
                        value={form.neighborhood}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input
                        className={FIELD_CLASS}
                        value={form.city}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>UF</Label>
                      <Input
                        className={FIELD_CLASS}
                        value={form.state}
                        disabled={isReadOnlyAdminAccount}
                        onChange={e => setForm({ ...form, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input
                        className={FIELD_CLASS}
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
                <div className="space-y-2 md:col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    className={FIELD_CLASS}
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
                  className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800"
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
              <AlertDialogContent className="rounded-[32px] border-white/80 bg-[#f7f6f2] shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">Confirmar remoção do CRECI?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600">
                    Essa operação está retirando o cadastro do CRECI desse corretor, deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
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
      </div>
    </Layout>
  );
}
