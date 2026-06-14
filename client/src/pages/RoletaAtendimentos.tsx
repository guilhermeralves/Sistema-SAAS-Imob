import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function RoletaAtendimentos() {
  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.88),rgba(244,240,232,0.82)_45%,rgba(248,248,246,1)_100%)] pb-16">
        <div className="container py-8 md:py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Roleta de Atendimentos
            </h1>
            <p className="mt-2 text-slate-600">
              Distribuicao automatica de atendimentos entre os corretores.
            </p>
          </div>

          <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Target className="h-5 w-5 text-emerald-700" />
                Em construcao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                Esta area sera usada para configurar e acompanhar a roleta de
                distribuicao de atendimentos. Funcionalidade em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
