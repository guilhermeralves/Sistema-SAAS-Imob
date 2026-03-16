import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { getPostLoginPath } from "@/lib/auth-routing";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { trpc } from "@/lib/trpc";
import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Register() {
  const utils = trpc.useUtils();
  const { user, loading, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
      toast.error(error.message || "Não foi possível cadastrar");
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
      toast.error("CPF invalido. Confira os digitos informados.");
      return;
    }

    register.mutate({
      name,
      cpf: normalizeCpf(cpf),
      phone,
      email,
      password,
    });
  };

  return (
    <Layout>
      <div className="container py-16">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Criar Conta
            </CardTitle>
            <CardDescription>
              Cadastre-se para aproveitar os benefícios de nossa plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  inputMode="numeric"
                  maxLength={14}
                  onChange={event => setCpf(formatCpf(event.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={event => setPhone(formatPhoneNumber(event.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button className="w-full" type="submit" disabled={register.isPending}>
                {register.isPending ? "Criando..." : "Criar Conta"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">
              Já possui conta?{" "}
              <Link href={getLoginUrl()}>
                <a className="text-primary underline">Entrar</a>
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
