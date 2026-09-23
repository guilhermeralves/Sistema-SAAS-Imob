import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Coins, Loader2, Save, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function AdminLojaConfig() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.store.admin.settings.useQuery();

  const [form, setForm] = useState({
    tokenValueCents: "10",
    tokensSalePercentMilli: "0",
    tokensRentalPercentMilli: "0",
    pixKey: "",
    pixMerchantName: "",
    pixMerchantCity: "",
    pixKeyType: "cpf" as "cpf" | "cnpj" | "email" | "telefone" | "aleatoria",
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      tokenValueCents: String(settings.tokenValueCents ?? 10),
      tokensSalePercentMilli: String(settings.tokensSalePercentMilli ?? 0),
      tokensRentalPercentMilli: String(settings.tokensRentalPercentMilli ?? 0),
      pixKey: settings.pixKey ?? "",
      pixMerchantName: settings.pixMerchantName ?? "",
      pixMerchantCity: settings.pixMerchantCity ?? "",
      pixKeyType: "cpf",
    });
  }, [settings]);

  const update = trpc.store.admin.updateSettings.useMutation({
    onSuccess: async () => {
      toast.success("Configurações salvas.");
      await utils.store.admin.settings.invalidate();
      await utils.store.publicSettings.invalidate();
    },
    onError: e => toast.error(e.message || "Falha ao salvar."),
  });

  function submit() {
    const tokenValueCents = Number(form.tokenValueCents || "0");
    const tokensSalePercentMilli = Number(form.tokensSalePercentMilli || "0");
    const tokensRentalPercentMilli = Number(form.tokensRentalPercentMilli || "0");
    if (!Number.isInteger(tokenValueCents) || tokenValueCents < 0) {
      toast.error("Valor do token inválido.");
      return;
    }
    update.mutate({
      tokenValueCents,
      tokensSalePercentMilli,
      tokensRentalPercentMilli,
      pixKey: form.pixKey.trim() || undefined,
      pixMerchantName: form.pixMerchantName.trim() || undefined,
      pixMerchantCity: form.pixMerchantCity.trim() || undefined,
    });
  }

  // Preview: 1000 tokens valem quanto?
  const previewCents = Number(form.tokenValueCents || "0") * 1000;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/admin/loja">
              <a className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Voltar para produtos
              </a>
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Configurações da Loja</h1>
            <p className="text-sm text-muted-foreground">
              Defina as regras de funcionamento da vitrine e da carteira de tokens.
            </p>
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-emerald-700" />
                  Valor do token
                </CardTitle>
                <CardDescription>
                  Quanto 1 token vale em reais. Usado para converter tokens em
                  BRL na exibição e no cálculo do complemento PIX na compra.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tvc">Valor de 1 token (em centavos)</Label>
                    <Input
                      id="tvc"
                      inputMode="numeric"
                      value={form.tokenValueCents}
                      onChange={e =>
                        setForm(c => ({ ...c, tokenValueCents: e.target.value.replace(/\D/g, "") }))
                      }
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: 10 = R$ 0,10 por token. 25 = R$ 0,25 por token.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Simulação</Label>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                      <p>
                        <strong>1000 tokens</strong> equivalem a{" "}
                        <strong className="text-emerald-700">
                          {formatBRL(previewCents)}
                        </strong>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        1 token = {formatBRL(Number(form.tokenValueCents || "0"))}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-700" />
                  Bonificação por transação
                </CardTitle>
                <CardDescription>
                  Percentual do valor da venda ou locação fechada que vira
                  tokens na carteira do corretor. Guardado em milésimos (100 =
                  0,1%). Deixe 0 para desligar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sale">Vendas — milésimos de %</Label>
                    <Input
                      id="sale"
                      inputMode="numeric"
                      value={form.tokensSalePercentMilli}
                      onChange={e =>
                        setForm(c => ({
                          ...c,
                          tokensSalePercentMilli: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="100"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: 100 = 0,1% do valor da venda vira tokens.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent">Locações — milésimos de %</Label>
                    <Input
                      id="rent"
                      inputMode="numeric"
                      value={form.tokensRentalPercentMilli}
                      onChange={e =>
                        setForm(c => ({
                          ...c,
                          tokensRentalPercentMilli: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="500"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: 500 = 0,5% do valor mensal da locação vira tokens.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PIX para recebimento</CardTitle>
                <CardDescription>
                  Dados usados para gerar o QR Code das compras com pagamento
                  complementar em PIX.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo da chave</Label>
                    <Select
                      value={form.pixKeyType}
                      onValueChange={v =>
                        setForm(c => ({ ...c, pixKeyType: v as typeof c.pixKeyType }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pixKey">Chave PIX</Label>
                    <Input
                      id="pixKey"
                      value={form.pixKey}
                      onChange={e => setForm(c => ({ ...c, pixKey: e.target.value }))}
                      placeholder="Ex: 12345678900 ou email@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pixName">Nome do beneficiário</Label>
                    <Input
                      id="pixName"
                      value={form.pixMerchantName}
                      onChange={e => setForm(c => ({ ...c, pixMerchantName: e.target.value }))}
                      placeholder="Ex: New Imobiliária"
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pixCity">Cidade</Label>
                    <Input
                      id="pixCity"
                      value={form.pixMerchantCity}
                      onChange={e => setForm(c => ({ ...c, pixMerchantCity: e.target.value }))}
                      placeholder="Ex: São Paulo"
                      maxLength={40}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esses dados aparecem no QR Code do PIX que o corretor
                  escaneia ao pagar o complemento de uma compra na loja.
                </p>
              </CardContent>
            </Card>

            <Button
              className="w-full sm:w-auto"
              onClick={submit}
              disabled={update.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {update.isPending ? "Salvando..." : "Salvar configurações"}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
