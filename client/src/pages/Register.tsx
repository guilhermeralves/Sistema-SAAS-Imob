import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DateInput from "@/components/DateInput";
import Layout from "@/components/Layout";
import { getLoginUrl } from "@/const";
import { getPostLoginPath } from "@/lib/auth-routing";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { displayDateToIso } from "@/lib/date";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LockKeyhole, Mail, Phone, User } from "lucide-react";
import { toast } from "sonner";

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function Register() {
  const utils = trpc.useUtils();
  const { user, loading, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const redirectWithRefresh = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const register = trpc.auth.register.useMutation({
    onSuccess: async data => {
      await utils.auth.me.invalidate();

      if (data.linkedLeadPreview?.latestInterest) {
        toast.success(
          `Encontramos um interesse anterior em: ${data.linkedLeadPreview.latestInterest}. Seu acesso foi vinculado a esse lead.`
        );
        window.setTimeout(() => {
          redirectWithRefresh(getPostLoginPath(data.user));
        }, 1200);
        return;
      }

      redirectWithRefresh(getPostLoginPath(data.user));
    },
    onError: error => {
      toast.error(error.message || "NÃ£o foi possÃ­vel cadastrar");
    },
  });

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      redirectWithRefresh(getPostLoginPath(user));
    }
  }, [isAuthenticated, loading, user]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidCpf(cpf)) {
      toast.error("CPF invÃ¡lido. Confira os dÃ­gitos informados.");
      return;
    }

    if (password.trim().length < 8) {
      toast.error("A senha deve ter no minimo 8 caracteres.");
      return;
    }

    register.mutate({
      name,
      cpf: normalizeCpf(cpf),
      birthDate: displayDateToIso(birthDate),
      phone,
      email,
      password,
    });
  };

  return (
    <Layout hideFooter mainClassName="min-h-0 overflow-hidden">
      <div className="h-full min-h-0 bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.92),rgba(244,240,232,0.86)_48%,rgba(248,248,246,1)_100%)]">
        <div className="container flex h-full min-h-0 items-stretch py-2 md:py-2.5 lg:py-2">
          <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 items-center">
            <Card className="max-h-full w-full self-center overflow-hidden rounded-[26px] border-white/70 bg-[#f6f5f1]/95 shadow-[0_28px_90px_-45px_rgba(15,23,42,0.48)] md:rounded-[32px]">
              <div className="grid h-full min-h-0 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="flex min-h-0 items-center overflow-y-auto px-5 py-5 sm:px-7 lg:px-9 lg:py-4">
                  <div className="mx-auto w-full max-w-md">
                    <div className="mb-4 lg:mb-3.5">
                      <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-[2rem] xl:text-4xl">
                        Crie sua conta
                      </h1>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600 sm:text-[15px]">
                        Cadastre-se para acompanhar os Imóveis, contratos e toda a experiência AFG.
                      </p>
                    </div>

                    <form className="space-y-3.5 lg:space-y-3" onSubmit={handleSubmit}>
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-slate-700">
                          Nome completo
                        </Label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            id="name"
                            value={name}
                            onChange={event => setName(event.target.value)}
                            required
                            className="h-12 rounded-2xl border-slate-200 bg-white/90 pl-11 shadow-sm lg:h-11"
                            placeholder="Seu nome completo"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cpf" className="text-slate-700">
                          CPF
                        </Label>
                        <Input
                          id="cpf"
                          value={cpf}
                          inputMode="numeric"
                          maxLength={14}
                          onChange={event => setCpf(formatCpf(event.target.value))}
                          required
                          className="h-12 rounded-2xl border-slate-200 bg-white/90 shadow-sm lg:h-11"
                          placeholder="000.000.000-00"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-slate-700">Data de nascimento</Label>
                          <DateInput
                            value={birthDate}
                            onValueChange={setBirthDate}
                            className="h-12 rounded-2xl border-slate-200 bg-white/90 shadow-sm lg:h-11"
                            placeholder="DD/MM/AAAA"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-slate-700">
                            Telefone
                          </Label>
                          <div className="relative">
                            <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              id="phone"
                              type="tel"
                              value={phone}
                              onChange={event => setPhone(formatPhoneNumber(event.target.value))}
                              required
                              className="h-12 rounded-2xl border-slate-200 bg-white/90 pl-11 shadow-sm lg:h-11"
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-700">
                          E-mail
                        </Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            required
                            className="h-12 rounded-2xl border-slate-200 bg-white/90 pl-11 shadow-sm lg:h-11"
                            placeholder="voce@exemplo.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-slate-700">
                          Senha
                        </Label>
                        <div className="relative">
                          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            minLength={8}
                            required
                            className="h-12 rounded-2xl border-slate-200 bg-white/90 pl-11 pr-12 shadow-sm lg:h-11"
                            placeholder="Crie sua senha"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(current => !current)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        className="h-12 w-full rounded-full bg-emerald-700 text-base text-white shadow-[0_18px_40px_-28px_rgba(4,120,87,0.75)] hover:bg-emerald-800 lg:h-11"
                        type="submit"
                        disabled={register.isPending}
                      >
                        {register.isPending ? "Criando..." : "Criar Conta"}
                      </Button>
                    </form>

                    <p className="mt-4 text-center text-sm text-slate-600 lg:mt-3.5">
                      Já possui conta?{" "}
                      <Link href={getLoginUrl()}>
                        <a className="font-medium text-emerald-800 underline-offset-4 hover:underline">
                          Entrar
                        </a>
                      </Link>
                    </p>
                  </div>
                </div>

                <div className="hidden min-h-0 p-3 lg:block xl:p-4">
                  <div className="relative flex h-full min-h-full overflow-hidden rounded-[32px] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] xl:rounded-[40px]">
                    <img
                      src="/banner_login_register/desktop.webp"
                      alt="AFG Imobiliária"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
