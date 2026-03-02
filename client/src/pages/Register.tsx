import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { getPostLoginPath } from "@/lib/auth-routing";
import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function Register() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { user, loading, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = trpc.auth.register.useMutation({
    onSuccess: async userData => {
      await utils.auth.me.invalidate();
      setLocation(getPostLoginPath(userData));
    },
    onError: error => {
      toast.error(error.message || "Não foi possível cadastrar");
    },
  });

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      setLocation(getPostLoginPath(user));
    }
  }, [isAuthenticated, loading, setLocation, user]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    register.mutate({
      name,
      cpf,
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
              O cadastro público cria sempre uma conta CLIENTE.
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
                  onChange={event => setCpf(event.target.value)}
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
