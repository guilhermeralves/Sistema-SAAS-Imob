import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCpf, isValidCpf } from "@/lib/cpf";
import { trpc } from "@/lib/trpc";
import { Mail, Phone, MapPin, MessageCircle, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

/**
 * Página de Contato
 * 
 * Formulário de contato e informações de contato da imobiliária.
 * 
 * EDIÇÃO:
 * - Para alterar informações de contato: edite CONTACT_INFO abaixo
 * - Para modificar o número do WhatsApp: edite WHATSAPP_CONFIG
 */

// ========== ÁREA DE EDIÇÃO - INFORMAÇÕES DE CONTATO ==========
const CONTACT_INFO = {
  phone: "(12) 99677-3547",
  email: "contato@afgimobiliaria.com.br",
  address: "Rua Exemplo, 123 - Centro - São Paulo/SP - CEP 01000-000",
  horario: "Segunda a Sexta: 9h às 18h | Sábado: 9h às 13h",
};

const WHATSAPP_CONFIG = {
  number: "5511999999999", // Formato: código do país + DDD + número
  message: "Olá! Gostaria de mais informações.",
};
// ========== FIM DA ÁREA DE EDIÇÃO ==========

export default function Contato() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cpf: "",
    telefone: "",
    mensagem: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const isClientUser = isAuthenticated && user?.role === "cliente";
  const shouldHideContactPage = isAuthenticated && user?.role !== "cliente";

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  useEffect(() => {
    if (shouldHideContactPage) {
      setLocation("/");
    }
  }, [setLocation, shouldHideContactPage]);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#contato-topo") {
      return;
    }

    document.getElementById("contato-topo")?.scrollIntoView({ block: "start" });
  }, []);

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
      setFormData({ nome: "", email: "", cpf: "", telefone: "", mensagem: "" });
    },
    onError: (error) => {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if ((!isClientUser && (!formData.nome || !formData.email)) || !formData.mensagem) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (!isClientUser && formData.cpf && !isValidCpf(formData.cpf)) {
      toast.error("CPF invalido. Confira os digitos informados.");
      return;
    }

    createLead.mutate({
      nome: isClientUser ? user?.name || user?.email || "Cliente" : formData.nome,
      email: isClientUser ? user?.email || "" : formData.email,
      cpf: isClientUser ? user?.cpf || undefined : formData.cpf || undefined,
      telefone: isClientUser ? user?.phone || "" : formData.telefone,
      origem: "site",
      interesse: formData.mensagem,
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
      {/* Hero */}
      <section
        id="contato-topo"
        className="bg-gradient-to-br from-primary/15 via-background to-accent/10 py-8 md:py-12"
      >
        <div className="container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">Fale Conosco</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Estamos prontos para ajudá-lo. Entre em contato conosco!
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Envie sua Mensagem</CardTitle>
                  <CardDescription>
                    {isClientUser
                      ? `Conte como podemos te ajudar ${user?.name || user?.email || ""}`
                      : "Preencha o formulário abaixo e entraremos em contato o mais breve possível"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submitted ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold mb-2">Mensagem Enviada!</h3>
                      <p className="text-muted-foreground mb-6">
                        Obrigado pelo contato. Nossa equipe responderá em breve.
                      </p>
                      <Button onClick={() => setSubmitted(false)}>
                        Enviar Nova Mensagem
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {isClientUser ? null : (
                        <>
                          <div>
                            <Label className="py-2" htmlFor="nome">Nome Completo</Label>
                            <Input
                              id="nome"
                              value={formData.nome}
                              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                              required
                            />
                          </div>

                          <div>
                            <Label className="py-2" htmlFor="email">E-mail</Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              required
                            />
                          </div>

                          <div>
                            <Label className="py-2" htmlFor="cpf">CPF</Label>
                            <Input
                              id="cpf"
                              value={formData.cpf}
                              inputMode="numeric"
                              maxLength={14}
                              onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })}
                            />
                          </div>

                          <div>
                            <Label className="py-2" htmlFor="telefone">Telefone</Label>
                            <Input
                              id="telefone"
                              type="tel"
                              value={formData.telefone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  telefone: formatPhoneNumber(e.target.value),
                                })
                              }
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <Label className="py-2" htmlFor="mensagem">Mensagem</Label>
                        <Textarea
                          id="mensagem"
                          placeholder="Como podemos ajudá-lo?"
                          rows={5}
                          value={formData.mensagem}
                          onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full gap-2"
                        disabled={createLead.isPending}
                      >
                        {createLead.isPending ? (
                          "Enviando..."
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Enviar Mensagem
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Informações de Contato */}
            <div className="space-y-6">
              {/* WhatsApp */}
              <Card className="border-2 border-green-500/20 bg-green-500/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-2">WhatsApp Business</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Atendimento rápido e direto pelo WhatsApp
                      </p>
                      <Button
                        asChild
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <a
                          href={`https://wa.me/${WHATSAPP_CONFIG.number}?text=${encodeURIComponent(WHATSAPP_CONFIG.message)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Iniciar Conversa
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Outras Informações */}
              <Card>
                <CardHeader>
                  <CardTitle>Outras Formas de Contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Telefone</p>
                      <a
                        href={`tel:${CONTACT_INFO.phone.replace(/\D/g, "")}`}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        {CONTACT_INFO.phone}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">E-mail</p>
                      <a
                        href={`mailto:${CONTACT_INFO.email}`}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        {CONTACT_INFO.email}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Endereço</p>
                      <p className="text-sm text-muted-foreground">
                        {CONTACT_INFO.address}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Horário de Atendimento */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold mb-2">Horário de Atendimento</h3>
                  <p className="text-sm text-muted-foreground">
                    {CONTACT_INFO.horario}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
