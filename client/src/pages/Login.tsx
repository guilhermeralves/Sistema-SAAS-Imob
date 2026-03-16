import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRegisterUrl } from "@/const";
import { getPostLoginPath } from "@/lib/auth-routing";
import { trpc } from "@/lib/trpc";
import { LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Login() {
  const utils = trpc.useUtils();
  const { user, loading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const redirectWithRefresh = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const login = trpc.auth.login.useMutation({
    onSuccess: async data => {
      await utils.auth.me.invalidate();
      redirectWithRefresh(getPostLoginPath(data));
    },
    onError: error => {
      toast.error(error.message || "Não foi possível entrar");
    },
  });

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      redirectWithRefresh(getPostLoginPath(user));
    }
  }, [isAuthenticated, loading, user]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({
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
              <LogIn className="h-5 w-5" />
              Entrar
            </CardTitle>
            <CardDescription>
              Faça login com seu e-mail e senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
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
              <Button className="w-full" type="submit" disabled={login.isPending}>
                {login.isPending ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link href={getRegisterUrl()}>
                <a className="text-primary underline">Cadastre-se</a>
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
