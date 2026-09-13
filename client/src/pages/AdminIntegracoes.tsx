import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronRight, MessageSquare, PlugZap } from "lucide-react";
import { Link } from "wouter";

type Integracao = {
  slug: string;
  nome: string;
  descricao: string;
  href: string;
  icon: typeof MessageSquare;
  status: "ativa" | "planejada";
};

/**
 * Central de integrações externas. Cada integração aparece como um
 * card clicável que leva à sua tela específica. Só administrativo
 * acessa essa área.
 */
const INTEGRACOES: Integracao[] = [
  {
    slug: "botconversa",
    nome: "BotConversa",
    descricao:
      "Lista de contatos e futura sincronização de conversas de WhatsApp.",
    href: "/admin/integracoes/botconversa",
    icon: MessageSquare,
    status: "ativa",
  },
];

export default function AdminIntegracoes() {
  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <PlugZap className="h-6 w-6 text-emerald-700" />
            Integrações
          </h1>
          <p className="text-sm text-muted-foreground">
            Conecte serviços externos à plataforma.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {INTEGRACOES.map(int => {
            const Icon = int.icon;
            return (
              <Link key={int.slug} href={int.href}>
                <a className="block">
                  <Card className="transition-colors hover:border-emerald-700/40 hover:bg-accent">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <CardTitle>{int.nome}</CardTitle>
                            <CardDescription>{int.descricao}</CardDescription>
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <span
                        className={
                          int.status === "ativa"
                            ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {int.status === "ativa" ? "Ativa" : "Planejada"}
                      </span>
                    </CardContent>
                  </Card>
                </a>
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
