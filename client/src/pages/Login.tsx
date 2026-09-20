import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { getRegisterUrl } from "@/const";
import { getPostLoginPath } from "@/lib/auth-routing";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";

const REMEMBER_EMAIL_KEY = "new_login_remember_email";
const SUPPORT_EMAIL = "contato@new.com";

function buildForgotPasswordMailto(email: string) {
  const subject = "Recuperação de acesso - New Imobiliária";
  const body = [
    "Olá, equipe New.",
    "",
    "Preciso de apoio para recuperar meu acesso ao sistema.",
    email ? `E-mail da conta: ${email}` : "E-mail da conta:",
    "",
    "Obrigado.",
  ].join("\n");

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function GoogleBadge() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm">
      <span className="text-sm font-bold text-slate-700">G</span>
    </span>
  );
}

export default function Login() {
  const utils = trpc.useUtils();
  const { user, loading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const searchParams = useMemo(
    () =>
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search),
    []
  );

  const redirectWithRefresh = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const login = trpc.auth.login.useMutation({
    onSuccess: async data => {
      await utils.auth.me.invalidate();

      if (typeof window !== "undefined") {
        if (rememberEmail) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      }

      redirectWithRefresh(getPostLoginPath(data));
    },
    onError: error => {
      toast.error(error.message || "Não foi possível entrar");
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (storedEmail) {
      setEmail(storedEmail);
      setRememberEmail(true);
      setForgotEmail(storedEmail);
    }
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      redirectWithRefresh(getPostLoginPath(user));
    }
  }, [isAuthenticated, loading, user]);

  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (!oauthError) return;

    if (oauthError === "google_start_failed") {
      toast.error("Não foi possível iniciar o login com Google.");
      return;
    }

    if (oauthError === "google_callback_failed") {
      toast.error("O login com Google não foi concluído.");
    }
  }, [searchParams]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  const handleGoogleLogin = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/api/oauth/google");
    }
  };

  const handleForgotPasswordSupport = () => {
    if (typeof window !== "undefined") {
      window.location.assign(buildForgotPasswordMailto(forgotEmail.trim() || email.trim()));
    }

    toast.success("Abrimos seu aplicativo de e-mail para solicitar apoio de acesso.");
    setForgotDialogOpen(false);
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
                    <div className="mb-5">
                      <h1 className="text-3xl font-semibold tracking-tight text-slate-950 xl:text-4xl">
                        Bem-vindo de volta!
                      </h1>
                      <p className="mt-2 text-sm text-slate-600 sm:text-[15px]">
                        Entre para acompanhar imóveis, oportunidades e gerenciar seus imóveis.
                      </p>
                    </div>

                    <div className="mb-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-start gap-3 rounded-2xl border-slate-200 bg-white/90 px-4 text-slate-700 shadow-sm hover:bg-white"
                        onClick={handleGoogleLogin}
                      >
                        <GoogleBadge />
                        <span className="font-medium">Continuar com Google</span>
                      </Button>
                    </div>

                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">ou</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <form className="space-y-3.5" onSubmit={handleSubmit}>
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
                            onChange={event => {
                              setEmail(event.target.value);
                              if (!forgotEmail) setForgotEmail(event.target.value);
                            }}
                            required
                            className="h-12 rounded-2xl border-slate-200 bg-white/90 pl-11 shadow-sm"
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
                            className="h-12 rounded-2xl border-slate-200 bg-white/90 pl-11 pr-12 shadow-sm"
                            placeholder="Informe sua senha"
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

                      <div className="flex flex-col gap-2.5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={rememberEmail}
                            onChange={event => setRememberEmail(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                          />
                          Lembrar meu e-mail
                        </label>

                        <Dialog open={forgotDialogOpen} onOpenChange={setForgotDialogOpen}>
                          <DialogTrigger asChild>
                            <button type="button" className="font-medium text-emerald-800 underline-offset-4 hover:underline">
                              Esqueceu sua senha?
                            </button>
                          </DialogTrigger>
                          <DialogContent
                            className="max-w-[23rem] lg:!max-w-[23rem] rounded-[24px] border-white/80 bg-[#f7f6f2] p-5 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)]"
                            onOpenAutoFocus={event => event.preventDefault()}
                          >
                            <DialogHeader className="space-y-2">
                              <div className="inline-flex w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                                Recuperação de acesso
                              </div>
                              <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950">
                                Solicitar apoio de acesso
                              </DialogTitle>
                              <DialogDescription className="text-sm leading-6 text-slate-600">
                                Ainda não temos recuperação automática por token. Nesta etapa, abrimos um pedido de suporte já com os dados da sua conta.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-3.5">
                              <div className="space-y-2">
                                <Label htmlFor="forgot-email">E-mail da conta</Label>
                                <Input
                                  id="forgot-email"
                                  type="email"
                                  value={forgotEmail}
                                  onChange={event => setForgotEmail(event.target.value)}
                                  className="h-11 rounded-2xl border-slate-200 bg-white/90 shadow-sm"
                                  placeholder="voce@exemplo.com"
                                />
                              </div>

                              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-600">
                                O botão abaixo abre seu e-mail padrão para falar com a equipe New.
                              </div>

                              <Button
                                type="button"
                                onClick={handleForgotPasswordSupport}
                                className="h-11 w-full rounded-full bg-emerald-700 text-sm text-white hover:bg-emerald-800"
                              >
                                Solicitar suporte de acesso
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <Button
                        className="h-12 w-full rounded-full bg-slate-950 text-base text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.7)] hover:bg-slate-800"
                        type="submit"
                        disabled={login.isPending}
                      >
                        {login.isPending ? "Entrando..." : "Entrar"}
                      </Button>
                    </form>

                    <p className="mt-4 text-center text-sm text-slate-600">
                      Ainda não tem conta?{' '}
                      <Link href={getRegisterUrl()}>
                        <a className="font-medium text-emerald-800 underline-offset-4 hover:underline">
                          Cadastre-se
                        </a>
                      </Link>
                    </p>
                  </div>
                </div>

                <div className="hidden min-h-0 p-3 lg:block xl:p-4">
                  <div className="relative flex h-full min-h-full overflow-hidden rounded-[32px] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] xl:rounded-[40px]">
                    <img
                      src="/banner_login_register/desktop.webp"
                      alt="New Imobiliária"
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
