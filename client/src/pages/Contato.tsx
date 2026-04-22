import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DateInput from "@/components/DateInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { displayDateToIso } from "@/lib/date";
import { formatCpf, isValidCpf } from "@/lib/cpf";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, FileText, MessageCircle, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const CONTACT_INFO = {
  phone: "(12) 99677-3547",
  email: "contato@afg.com",
  address: "Rua Exemplo, 123 - Centro - São Paulo/SP - CEP 01000-000",
  horario: "Segunda a Sexta: 9h às 18h | Sábado: 9h às 13h",
};

const WHATSAPP_CONFIG = {
  number: "5511999999999",
  message: "Olá! Gostaria de mais informações.",
};

const CAREERS_CONFIG = {
  email: "contato@afg.com",
  subject: "Trabalhe Conosco - Apresentação Profissional",
};
const CONTACT_INTEREST_OPTIONS = [
  { value: "Locação", label: "Locação" },
  { value: "Aquisição de Imóvel", label: "Aquisição de Imóvel" },
  { value: "Aquisição Imóvel na Planta", label: "Aquisição Imóvel na Planta" },
  { value: "Avaliação de Imóvel", label: "Avaliação de Imóvel" },
];
const CONTACT_INTEREST_PROPERTY_STORAGE_KEY = "afg:contact-interest-property";
const CONTACT_INTEREST_PROPERTY_TTL_MS = 30 * 60 * 1000;

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function parsePositivePropertyId(rawValue: string | null | undefined) {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function getPropertyIdFromUrlSearch() {
  if (typeof window === "undefined") return null;
  const rawValue = new URLSearchParams(window.location.search).get("idImovel");
  return parsePositivePropertyId(rawValue);
}

function storeReferencedPropertyId(id: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    CONTACT_INTEREST_PROPERTY_STORAGE_KEY,
    JSON.stringify({
      id,
      savedAt: Date.now(),
    })
  );
}

function getPropertyIdFromSessionStorage() {
  if (typeof window === "undefined") return null;

  const rawValue = window.sessionStorage.getItem(CONTACT_INTEREST_PROPERTY_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as { id?: unknown; savedAt?: unknown };
    const id = parsePositivePropertyId(
      parsed && typeof parsed.id === "number" ? String(parsed.id) : null
    );
    const savedAt = typeof parsed?.savedAt === "number" ? parsed.savedAt : null;

    if (!id || !savedAt || Date.now() - savedAt > CONTACT_INTEREST_PROPERTY_TTL_MS) {
      window.sessionStorage.removeItem(CONTACT_INTEREST_PROPERTY_STORAGE_KEY);
      return null;
    }

    return id;
  } catch {
    window.sessionStorage.removeItem(CONTACT_INTEREST_PROPERTY_STORAGE_KEY);
    return null;
  }
}

function getLeadReferencedPropertyId() {
  const idFromUrl = getPropertyIdFromUrlSearch();
  if (idFromUrl) {
    storeReferencedPropertyId(idFromUrl);
    return idFromUrl;
  }

  if (typeof window !== "undefined" && window.location.hash !== "#contato-formulario") {
    return null;
  }

  return getPropertyIdFromSessionStorage();
}

export default function Contato() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    birthDate: "",
    cpf: "",
    telefone: "",
    interesse: "",
    mensagem: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const isClientUser = isAuthenticated && user?.role === "cliente";
  const shouldHideContactPage = isAuthenticated && user?.role !== "cliente";

  useEffect(() => {
    if (shouldHideContactPage) {
      setLocation("/");
    }
  }, [setLocation, shouldHideContactPage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    getLeadReferencedPropertyId();

    const scrollToHashTarget = () => {
      const targetId =
        window.location.hash === "#contato-formulario"
          ? "contato-formulario"
          : window.location.hash === "#contato-topo"
            ? "contato-topo"
            : null;

      if (!targetId) return;

      window.requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      });
    };

    scrollToHashTarget();
    window.addEventListener("hashchange", scrollToHashTarget);

    return () => {
      window.removeEventListener("hashchange", scrollToHashTarget);
    };
  }, []);

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(CONTACT_INTEREST_PROPERTY_STORAGE_KEY);
      }
      setSubmitted(true);
      toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
      setFormData({ nome: "", email: "", birthDate: "", cpf: "", telefone: "", interesse: "", mensagem: "" });
    },
    onError: error => {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const referencedPropertyId = getLeadReferencedPropertyId();

    if ((!isClientUser && (!formData.nome || !formData.email)) || !formData.interesse || !formData.mensagem) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (!isClientUser && formData.cpf && !isValidCpf(formData.cpf)) {
      toast.error("CPF inválido. Confira os dígitos informados.");
      return;
    }

    if (formData.birthDate && !displayDateToIso(formData.birthDate)) {
      toast.error("Data de nascimento inválida. Use o formato DD/MM/AAAA.");
      return;
    }

    createLead.mutate({
      nome: isClientUser ? user?.name || user?.email || "Cliente" : formData.nome,
      email: isClientUser ? user?.email || "" : formData.email,
      cpf: isClientUser ? user?.cpf || undefined : formData.cpf || undefined,
      birthDate: isClientUser
        ? undefined
        : formData.birthDate
          ? displayDateToIso(formData.birthDate) || undefined
          : undefined,
      telefone: isClientUser ? user?.phone || "" : formData.telefone,
      origem: "site",
      interesse: formData.interesse,
      observacao: formData.mensagem,
      idImovel: referencedPropertyId ?? undefined,
      status: "novo",
    });
  };

  if (shouldHideContactPage) {
    return null;
  }

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="space-y-4 animate-pulse">
            <div className="h-12 w-1/3 rounded bg-muted" />
            <div className="h-96 rounded bg-muted" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-20">
        <section id="contato-topo" className="pt-10 md:pt-12">
          <div className="container">
            <div className="mb-10 max-w-3xl">
              <p className="mb-4 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                Fale conosco
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                Um canal direto, para dúvidas, oportunidades e interesses imobiliários.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Se você quer atendimento, orientação comercial ou mais informações sobre um imóvel,
                nossa equipe está pronta para responder com mais clareza e agilidade.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="rounded-[28px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,243,0.88))] shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                <CardContent className="p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-950">Atendimento rápido</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use o formulário ou siga direto para o WhatsApp quando quiser contato mais imediato.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,243,0.88))] shadow-[0_20px_50px_-34px_rgba(15,23,42,0.32)]">
                <CardContent className="p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <Send className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-950">Leads organizados</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Toda mensagem registrada pelo site já entra no fluxo de acompanhamento comercial.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-transparent bg-[linear-gradient(135deg,#4e7b66,#628b78_55%,#7aa18b)] text-white shadow-[0_25px_60px_-35px_rgba(15,23,42,0.6)] sm:col-span-2">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                    Disponibilidade
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight">
                    Atendimento em horário comercial com resposta estruturada pela equipe.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/80">{CONTACT_INFO.horario}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="pt-14 md:pt-18">
          <div className="container">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card
                id="contato-formulario"
                className="scroll-mt-24 rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]"
              >
                <CardHeader className="pb-2">
                  <div className="inline-flex w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                    Formulário
                  </div>
                  <CardTitle className="pt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    Envie sua Mensagem
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    {isClientUser
                      ? `Conte como podemos te ajudar ${user?.name || user?.email || ""}.`
                      : "Preencha os campos abaixo, nos informe sobre seu interesse e nossa equipe entrará em contato o mais breve possível."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submitted ? (
                    <div className="rounded-[28px] border border-emerald-100 bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,0.96))] px-6 py-10 text-center">
                      <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-600" />
                      <h3 className="text-xl font-semibold text-slate-950">Mensagem enviada!</h3>
                      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
                        Obrigado pelo contato. A equipe AFG vai analisar sua mensagem e responder em breve.
                      </p>
                      <Button
                        onClick={() => setSubmitted(false)}
                        className="mt-6 rounded-full bg-emerald-700 px-6 text-white hover:bg-emerald-800"
                      >
                        Enviar nova mensagem
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {isClientUser ? null : (
                        <>
                          <div className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="nome">Nome completo</Label>
                              <Input
                                id="nome"
                                value={formData.nome}
                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                required
                              />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="email">E-mail</Label>
                              <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="telefone">Telefone</Label>
                              <Input
                                id="telefone"
                                type="tel"
                                value={formData.telefone}
                                onChange={e =>
                                  setFormData({
                                    ...formData,
                                    telefone: formatPhoneNumber(e.target.value),
                                  })
                                }
                                className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="birthDate">Data de Nascimento</Label>
                              <DateInput
                                id="birthDate"
                                value={formData.birthDate}
                                onValueChange={value =>
                                  setFormData({
                                    ...formData,
                                    birthDate: value,
                                  })
                                }
                                className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                                placeholder="DD/MM/AAAA"
                              />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="cpf">CPF</Label>
                              <Input
                                id="cpf"
                                value={formData.cpf}
                                inputMode="numeric"
                                maxLength={14}
                                onChange={e => setFormData({ ...formData, cpf: formatCpf(e.target.value) })}
                                className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="interesse">Interesse</Label>
                        <Select
                          value={formData.interesse}
                          onValueChange={value => setFormData({ ...formData, interesse: value })}
                        >
                          <SelectTrigger id="interesse" className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm">
                            <SelectValue placeholder="Selecione seu interesse" />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTACT_INTEREST_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mensagem">Mensagem</Label>
                        <Textarea
                          id="mensagem"
                          placeholder="Como podemos ajudá-lo?"
                          rows={6}
                          value={formData.mensagem}
                          onChange={e => setFormData({ ...formData, mensagem: e.target.value })}
                          className="rounded-2xl border-slate-200 bg-white shadow-sm"
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        className="h-12 w-full rounded-full bg-emerald-700 text-white shadow-[0_18px_40px_-24px_rgba(4,120,87,0.85)] hover:bg-emerald-800"
                        disabled={createLead.isPending}
                      >
                        {createLead.isPending ? (
                          "Enviando..."
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Enviar mensagem
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
                  <CardHeader className="pb-2">
                    <div className="inline-flex w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                      Oportunidades
                    </div>
                    <CardTitle className="pt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      Trabalhe Conosco
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Se você se identifica com atendimento consultivo, organização e mercado imobiliário, queremos conhecer seu perfil.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">Perfil que buscamos</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Profissionais com boa comunicação, responsabilidade no processo e atenção ao relacionamento com clientes.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">Onde você pode atuar</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Comercial, atendimento, captação, suporte operacional e rotinas ligadas à jornada imobiliária.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">Como se apresentar</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Envie seu currículo ou uma breve apresentação profissional com seu interesse de atuação na AFG.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,243,0.88))] px-4 py-4">
                      <p className="font-semibold text-slate-950">Canal para envio</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Encaminhe seu material para o e-mail da equipe e identifique no assunto a área de interesse.
                      </p>
                      <Button
                        asChild
                        variant="outline"
                        className="mt-4 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <a
                          href={`mailto:${CAREERS_CONFIG.email}?subject=${encodeURIComponent(CAREERS_CONFIG.subject)}`}
                        >
                          Enviar apresentação
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
