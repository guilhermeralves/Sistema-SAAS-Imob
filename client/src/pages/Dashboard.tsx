import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { formatStoredDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  CircleDollarSign,
  Download,
  FileCheck2,
  HandCoins,
  LayoutDashboard,
  Shield,
  Sparkles,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type DashboardPeriod = "month" | "week" | "year" | "all";
type ComparableRange = { start: number; end: number };
type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  date: Date | string | null | undefined;
  tone: "emerald" | "blue" | "amber";
};
type ChartPoint = { label: string; primary: number; secondary: number; tertiary: number };

type PreviewBalance = { incoming: number; outgoing: number; balance: number };

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "month", label: "M\u00eas atual" },
  { value: "week", label: "Semana atual" },
  { value: "year", label: "Anual" },
  { value: "all", label: "Geral" },
];

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  month: "M\u00eas atual",
  week: "Semana atual",
  year: "Anual",
  all: "Geral",
};

const PREVIEW_FINANCIAL_BALANCE: Record<DashboardPeriod, PreviewBalance> = {
  month: { incoming: 2845000, outgoing: 1132000, balance: 1713000 },
  week: { incoming: 638000, outgoing: 241500, balance: 396500 },
  year: { incoming: 18420000, outgoing: 7310000, balance: 11110000 },
  all: { incoming: 26850000, outgoing: 10440000, balance: 16410000 },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function getComparableTimestampFromStoredValue(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return Date.UTC(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth(),
    parsedDate.getUTCDate(),
    parsedDate.getUTCHours(),
    parsedDate.getUTCMinutes(),
    parsedDate.getUTCSeconds(),
    parsedDate.getUTCMilliseconds(),
  );
}

function getComparableTimestampFromLocalDate(date: Date) {
  return Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

function getPeriodRange(period: DashboardPeriod): ComparableRange {
  const now = new Date();
  const end = getComparableTimestampFromLocalDate(now);

  if (period === "month") {
    return { start: getComparableTimestampFromLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), end };
  }

  if (period === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return { start: getComparableTimestampFromLocalDate(start), end };
  }

  if (period === "year") {
    return { start: getComparableTimestampFromLocalDate(new Date(now.getFullYear(), 0, 1)), end };
  }

  return { start: Number.NEGATIVE_INFINITY, end };
}

function isStoredDateWithinRange(value: Date | string | null | undefined, range: ComparableRange) {
  const comparable = getComparableTimestampFromStoredValue(value);
  return comparable !== null && comparable >= range.start && comparable <= range.end;
}

function normalizePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPdfFromLines(title: string, lines: string[]) {
  const printableLines = [title, ...lines].map(normalizePdfText);
  const stream = printableLines
    .map((line, index) => {
      const fontSize = index === 0 ? 18 : 11;
      const positionY = 780 - index * 24;
      return `BT /F1 ${fontSize} Tf 40 ${positionY} Td (${line}) Tj ET`;
    })
    .join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function createPerformanceSeries(primary: number, secondary: number, tertiary: number): ChartPoint[] {
  const basePoints = [0.18, 0.34, 0.51, 0.63, 0.82, 1];

  return basePoints.map((weight, index) => ({
    label: `S${index + 1}`,
    primary: Math.max(0, Math.round(primary * weight)),
    secondary: Math.max(0, Math.round(secondary * (weight * 0.9 + 0.05))),
    tertiary: Math.max(0, Math.round(tertiary * (weight * 0.8 + 0.08))),
  }));
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accent = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof UserPlus;
  accent?: "default" | "success" | "warning";
}) {
  const iconWrapperClass =
    accent === "success"
      ? "bg-emerald-100 text-emerald-700"
      : accent === "warning"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", iconWrapperClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityList({ title, description, items }: { title: string; description: string; items: ActivityItem[] }) {
  const toneClassMap: Record<ActivityItem["tone"], string> = {
    emerald: "bg-emerald-500",
    blue: "bg-sky-500",
    amber: "bg-amber-500",
  };

  return (
    <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length > 0 ? (
          items.map(item => (
            <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3">
              <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", toneClassMap[item.tone])} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {formatStoredDateTime(item.date, "-")}
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum movimento para exibir neste per\u00edodo.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const isAdmin = user?.role === "administrativo";
  const isBroker = user?.role === "corretor";

  const usersQuery = trpc.admin.users.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchOnWindowFocus: true,
  });
  const leadsQuery = trpc.leads.list.useQuery(undefined, {
    enabled: isAuthenticated && (isAdmin || isBroker),
    refetchOnWindowFocus: true,
  });
  const contractsQuery = trpc.contracts.list.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchOnWindowFocus: true,
  });
  const propertiesQuery = trpc.properties.myProperties.useQuery(undefined, {
    enabled: isAuthenticated && (isAdmin || isBroker),
    refetchOnWindowFocus: true,
  });

  const range = useMemo(() => getPeriodRange(period), [period]);
  const financialPreview = PREVIEW_FINANCIAL_BALANCE[period];

  const users = usersQuery.data ?? [];
  const leads = leadsQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];

  const isDashboardLoading =
    loading ||
    leadsQuery.isLoading ||
    propertiesQuery.isLoading ||
    (isAdmin && (usersQuery.isLoading || contractsQuery.isLoading));

  const adminMetrics = useMemo(() => {
    const newClients = users.filter(item => item.role === "cliente" && item.registrationSource === "public_signup" && isStoredDateWithinRange(item.createdAt, range));
    const newLeads = leads.filter(item => isStoredDateWithinRange(item.createdAt, range));
    const activeContracts = contracts.filter(item => item.tipo === "locacao" && item.status === "ativo");
    const completedContracts = contracts.filter(item => item.status === "encerrado" && isStoredDateWithinRange(item.updatedAt ?? item.createdAt, range));

    return {
      newClientsCount: newClients.length,
      newLeadsCount: newLeads.length,
      activeContractsCount: activeContracts.length,
      completedContractsCount: completedContracts.length,
      chartData: createPerformanceSeries(newClients.length, newLeads.length, completedContracts.length),
      recentClients: [...newClients].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4).map(item => ({
        id: `client-${item.id}`,
        title: item.name || item.email || `Cliente #${item.id}`,
        subtitle: "Conta criada no portal da AFG",
        date: item.createdAt,
        tone: "emerald" as const,
      })),
      recentLeads: [...newLeads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4).map(item => ({
        id: `lead-${item.id}`,
        title: item.nome,
        subtitle: item.origem ? `Origem: ${item.origem}` : "Lead gerado no CRM",
        date: item.createdAt,
        tone: "blue" as const,
      })),
      recentContracts: [...completedContracts].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()).slice(0, 4).map(item => ({
        id: `contract-${item.id}`,
        title: `Contrato #${item.id}`,
        subtitle: `${item.tipo === "locacao" ? "Loca\u00e7\u00e3o" : "Venda"} encerrada`,
        date: item.updatedAt ?? item.createdAt,
        tone: "amber" as const,
      })),
    };
  }, [contracts, leads, range, users]);

  const brokerMetrics = useMemo(() => {
    const newLeads = leads.filter(item => isStoredDateWithinRange(item.createdAt, range));
    const activeProperties = properties.filter(item => item.status === "ativo");
    const highlightedProperties = properties.filter(item => item.destaque === 1);

    return {
      newLeadsCount: newLeads.length,
      activePropertiesCount: activeProperties.length,
      managedPropertiesCount: properties.length,
      highlightedPropertiesCount: highlightedProperties.length,
      chartData: createPerformanceSeries(newLeads.length, activeProperties.length, highlightedProperties.length),
      recentLeadItems: [...newLeads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4).map(item => ({
        id: `broker-lead-${item.id}`,
        title: item.nome,
        subtitle: item.interesse || "Novo interesse comercial",
        date: item.createdAt,
        tone: "blue" as const,
      })),
      recentPropertyItems: [...properties].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4).map(item => ({
        id: `broker-property-${item.id}`,
        title: item.titulo,
        subtitle: `${item.cidade}/${item.estado}`,
        date: item.createdAt,
        tone: "emerald" as const,
      })),
    };
  }, [leads, properties, range]);

  const reportLines = useMemo(() => {
    if (isAdmin) {
      return [
        { label: "Periodo selecionado", value: PERIOD_LABELS[period] },
        { label: "Novos clientes", value: String(adminMetrics.newClientsCount) },
        { label: "Novos leads", value: String(adminMetrics.newLeadsCount) },
        { label: "Contratos ativos", value: String(adminMetrics.activeContractsCount) },
        { label: "Contratos concluidos", value: String(adminMetrics.completedContractsCount) },
        { label: "Entradas financeiras (previa)", value: formatCurrency(financialPreview.incoming) },
        { label: "Saidas financeiras (previa)", value: formatCurrency(financialPreview.outgoing) },
        { label: "Saldo financeiro (previa)", value: formatCurrency(financialPreview.balance) },
      ];
    }

    return [
      { label: "Periodo selecionado", value: PERIOD_LABELS[period] },
      { label: "Novos leads", value: String(brokerMetrics.newLeadsCount) },
      { label: "Imoveis ativos", value: String(brokerMetrics.activePropertiesCount) },
      { label: "Imoveis na carteira", value: String(brokerMetrics.managedPropertiesCount) },
      { label: "Imoveis em destaque", value: String(brokerMetrics.highlightedPropertiesCount) },
      { label: "Saldo financeiro (previa)", value: formatCurrency(financialPreview.balance) },
    ];
  }, [adminMetrics, brokerMetrics, financialPreview, isAdmin, period]);

  const handleDownloadReportPreview = () => {
    const now = new Date();
    const lines = [
      `Periodo: ${PERIOD_LABELS[period]}`,
      ...reportLines.map(line => `${line.label}: ${line.value}`),
      `Emitido em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      "Este arquivo e uma previa visual do relatorio mensal automatizado.",
    ];
    downloadBlob(
      buildPdfFromLines("Relatorio de Performance Geral - Previa", lines),
      `relatorio-performance-geral-${now.toISOString().slice(0, 10)}.pdf`,
    );
    toast.success("Pr\u00e9via do relat\u00f3rio baixada com sucesso.");
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-10">
          <div className="space-y-5">
            <div className="h-28 rounded-[32px] bg-muted animate-pulse" />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-32 rounded-[28px] bg-muted animate-pulse" />
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-[1.45fr_0.95fr]">
              <div className="h-[360px] rounded-[32px] bg-muted animate-pulse" />
              <div className="h-[360px] rounded-[32px] bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <User className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Restrito</h1>
          <p className="mb-6 text-muted-foreground">Voc\u00ea precisa fazer login para acessar o Dashboard.</p>
          <Button asChild>
            <a href={getLoginUrl()}>Fazer Login</a>
          </Button>
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isBroker) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">Acesso Negado</h1>
          <p className="mb-6 text-muted-foreground">Esta \u00e1rea est\u00e1 dispon\u00edvel somente para administradores e corretores.</p>
          <Button asChild>
            <Link href="/">Voltar para o site</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const activeChartData = isAdmin ? adminMetrics.chartData : brokerMetrics.chartData;
  const summaryTitle = isAdmin ? "Performance Geral" : "Performance Comercial";
  const summaryDescription = isAdmin
    ? "Clientes, leads e contratos encerrados no per\u00edodo selecionado."
    : "Leads e carteira de im\u00f3veis acompanhados no per\u00edodo selecionado.";

  return (
    <Layout>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(223,232,226,0.95),rgba(244,240,232,0.92)_45%,rgba(248,248,246,1)_100%)]">
        <div className="container py-8 md:py-10">
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[36px] border border-white/70 bg-[#ece9e1] shadow-[0_24px_80px_-42px_rgba(15,23,42,0.5)]">
              <CardContent className="grid gap-8 p-6 md:p-8 xl:grid-cols-[1.2fr_0.9fr] xl:items-center">
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-700/10 text-emerald-800">
                      <LayoutDashboard className="h-8 w-8" />
                    </div>
                    <div>
                      <Badge variant="secondary" className="rounded-full bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                        Dashboard
                      </Badge>
                      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                        {isAdmin ? `Ol\u00e1, ${user?.name || "Administrador"}` : `Ol\u00e1, ${user?.name || "Corretor"}`}
                      </h1>
                    </div>
                  </div>

                  <div className="max-w-2xl space-y-2">
                    <p className="text-base text-slate-700 md:text-lg">
                      {isAdmin
                        ? "Acompanhe a evolu\u00e7\u00e3o comercial e operacional da AFG em um painel mais executivo."
                        : "Acompanhe seus leads, a carteira de im\u00f3veis e uma pr\u00e9via do desempenho do per\u00edodo."}
                    </p>
                    <p className="text-sm text-slate-500">Os dados consideram sempre o per\u00edodo selecionado, com M\u00eas atual ativo por padr\u00e3o.</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-[30px] border border-white/80 bg-white/70 p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Per\u00edodo de leitura</p>
                      <p className="text-xs text-muted-foreground">Altere a janela de an\u00e1lise sem mudar o restante do fluxo.</p>
                    </div>
                    <Badge className="rounded-full bg-emerald-700/90 px-3 py-1 text-white">{PERIOD_LABELS[period]}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {PERIOD_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPeriod(option.value)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                          period === option.value
                            ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-800",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="button" className="gap-2 rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={handleDownloadReportPreview}>
                      <Download className="h-4 w-4" />
                      Gerar Relat\u00f3rio de Performance Geral
                    </Button>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs text-slate-600">
                      PDF de pr\u00e9via para valida\u00e7\u00e3o visual
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isDashboardLoading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-32 rounded-[28px] bg-white/80 animate-pulse" />
                ))}
              </div>
            ) : isAdmin ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard title="Novos Clientes" value={String(adminMetrics.newClientsCount)} description={`Cadastros novos em ${PERIOD_LABELS[period].toLowerCase()}`} icon={UserPlus} accent="success" />
                <MetricCard title="Novos Leads" value={String(adminMetrics.newLeadsCount)} description="Interesses comerciais gerados no per\u00edodo" icon={Users} />
                <MetricCard title="Contratos Ativos" value={String(adminMetrics.activeContractsCount)} description="Contratos de loca\u00e7\u00e3o ativos no momento" icon={FileCheck2} />
                <MetricCard title="Contratos Conclu\u00eddos" value={String(adminMetrics.completedContractsCount)} description="Contratos encerrados dentro da janela selecionada" icon={Briefcase} accent="warning" />
                <Card className="rounded-[28px] border-transparent bg-[linear-gradient(135deg,#4e7b66,#628b78_55%,#7aa18b)] text-white shadow-[0_25px_60px_-35px_rgba(15,23,42,0.6)]">
                  <CardContent className="flex h-full flex-col justify-between p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white/80">Balan\u00e7o Financeiro</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(financialPreview.balance)}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                        <CircleDollarSign className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <ArrowUpRight className="h-4 w-4" />
                        Entradas: {formatCurrency(financialPreview.incoming)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <ArrowDownRight className="h-4 w-4" />
                        Sa\u00eddas: {formatCurrency(financialPreview.outgoing)}
                      </div>
                      <Badge className="mt-2 w-fit rounded-full bg-white/20 px-3 py-1 text-white">Pr\u00e9via visual at\u00e9 integra\u00e7\u00e3o financeira</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Novos Leads" value={String(brokerMetrics.newLeadsCount)} description={`Leads recebidos em ${PERIOD_LABELS[period].toLowerCase()}`} icon={Users} />
                <MetricCard title="Im\u00f3veis Ativos" value={String(brokerMetrics.activePropertiesCount)} description="Im\u00f3veis com status ativo sob sua gest\u00e3o" icon={Building2} accent="success" />
                <MetricCard title="Carteira de Im\u00f3veis" value={String(brokerMetrics.managedPropertiesCount)} description="Total de im\u00f3veis vinculados ao seu perfil" icon={LayoutDashboard} />
                <Card className="rounded-[28px] border-transparent bg-[linear-gradient(135deg,#4e7b66,#628b78_55%,#7aa18b)] text-white shadow-[0_25px_60px_-35px_rgba(15,23,42,0.6)]">
                  <CardContent className="flex h-full flex-col justify-between p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white/80">Balan\u00e7o Financeiro</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(financialPreview.balance)}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                        <HandCoins className="h-5 w-5" />
                      </div>
                    </div>
                    <Badge className="w-fit rounded-full bg-white/20 px-3 py-1 text-white">Pr\u00e9via visual</Badge>
                    <p className="text-sm text-white/80">O detalhamento financeiro do corretor entra na pr\u00f3xima etapa.</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[1.45fr_0.95fr]">
              <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{summaryTitle}</CardTitle>
                    <CardDescription>{summaryDescription}</CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full px-3 py-1">{PERIOD_LABELS[period]}</Badge>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{isAdmin ? "Clientes" : "Leads"}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{isAdmin ? adminMetrics.newClientsCount : brokerMetrics.newLeadsCount}</p>
                    </div>
                    <div className="rounded-[24px] bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{isAdmin ? "Leads" : "Im\u00f3veis ativos"}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{isAdmin ? adminMetrics.newLeadsCount : brokerMetrics.activePropertiesCount}</p>
                    </div>
                    <div className="rounded-[24px] bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{isAdmin ? "Conclu\u00eddos" : "Destaques"}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{isAdmin ? adminMetrics.completedContractsCount : brokerMetrics.highlightedPropertiesCount}</p>
                    </div>
                  </div>

                  <div className="mt-6 h-[280px] rounded-[28px] bg-[linear-gradient(180deg,rgba(238,245,240,0.9),rgba(255,255,255,0.65))] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activeChartData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="primaryFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3f6f5b" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#3f6f5b" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="secondaryFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#9cc1af" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#9cc1af" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="tertiaryFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d5b277" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#d5b277" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#d9e1dc" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#6b7280" />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="#6b7280" />
                        <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 15px 35px -25px rgba(15,23,42,0.55)" }} />
                        <Area type="monotone" dataKey="primary" stroke="#3f6f5b" strokeWidth={3} fill="url(#primaryFill)" />
                        <Area type="monotone" dataKey="secondary" stroke="#8db39f" strokeWidth={2.5} fill="url(#secondaryFill)" />
                        <Area type="monotone" dataKey="tertiary" stroke="#c49c59" strokeWidth={2.5} fill="url(#tertiaryFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5">
                <Card className="rounded-[32px] border-white/70 bg-white/90 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
                  <CardHeader className="pb-3">
                    <CardTitle>Resumo do Per\u00edodo</CardTitle>
                    <CardDescription>Leitura r\u00e1pida do que est\u00e1 mais relevante agora.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {reportLines.slice(0, 5).map(line => (
                      <div key={line.label} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                        <span className="text-sm text-slate-600">{line.label}</span>
                        <span className="text-sm font-semibold text-slate-950">{line.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-[32px] border-transparent bg-[linear-gradient(135deg,#fbfbfa,#f3f0e9)] shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle>Saldo Financeiro</CardTitle>
                        <CardDescription>Pr\u00e9via visual para aprova\u00e7\u00e3o de layout</CardDescription>
                      </div>
                      <Sparkles className="h-5 w-5 text-emerald-700" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-sm text-muted-foreground">Entradas</p>
                      <p className="text-2xl font-semibold text-emerald-700">{formatCurrency(financialPreview.incoming)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sa\u00eddas</p>
                      <p className="text-2xl font-semibold text-rose-600">{formatCurrency(financialPreview.outgoing)}</p>
                    </div>
                    <div className="rounded-[26px] bg-emerald-700 px-5 py-4 text-white">
                      <p className="text-sm text-white/75">Saldo estimado</p>
                      <p className="mt-1 text-3xl font-semibold">{formatCurrency(financialPreview.balance)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {isAdmin ? (
              <div className="grid gap-5 xl:grid-cols-3">
                <ActivityList title="Clientes Recentes" description="Cadastros mais novos no portal durante o per\u00edodo." items={adminMetrics.recentClients} />
                <ActivityList title="Leads Recentes" description="Interesses comerciais captados pelo sistema." items={adminMetrics.recentLeads} />
                <div className="grid gap-5">
                  <ActivityList title="Contratos Encerrados" description="Movimentos contratuais fechados na janela selecionada." items={adminMetrics.recentContracts} />
                  <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
                    <CardHeader className="pb-3">
                      <CardTitle>Atalhos R\u00e1pidos</CardTitle>
                      <CardDescription>Navega\u00e7\u00e3o direta para as \u00e1reas mais usadas do dia a dia.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <Button asChild variant="outline" className="justify-start gap-2 rounded-2xl"><Link href="/admin/users"><Users className="h-4 w-4" />Usu\u00e1rios</Link></Button>
                      <Button asChild variant="outline" className="justify-start gap-2 rounded-2xl"><Link href="/crm"><LayoutDashboard className="h-4 w-4" />CRM</Link></Button>
                      <Button asChild variant="outline" className="justify-start gap-2 rounded-2xl"><Link href="/admin"><Briefcase className="h-4 w-4" />Administrativo</Link></Button>
                      <Button asChild variant="outline" className="justify-start gap-2 rounded-2xl"><Link href="/financeiro"><CircleDollarSign className="h-4 w-4" />Financeiro</Link></Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
                <ActivityList title="Leads Recentes" description="Clientes em atendimento no per\u00edodo selecionado." items={brokerMetrics.recentLeadItems} />
                <ActivityList title="Im\u00f3veis Recentes" description="Itens mais recentes da sua carteira." items={brokerMetrics.recentPropertyItems} />
                <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
                  <CardHeader className="pb-3">
                    <CardTitle>Vis\u00e3o do Corretor</CardTitle>
                    <CardDescription>Esta primeira vers\u00e3o j\u00e1 entrega o painel base e abre caminho para os refinamentos do corretor.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">Leads do per\u00edodo: <span className="font-semibold text-slate-950">{brokerMetrics.newLeadsCount}</span></div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">Im\u00f3veis ativos: <span className="font-semibold text-slate-950">{brokerMetrics.activePropertiesCount}</span></div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">Im\u00f3veis em destaque: <span className="font-semibold text-slate-950">{brokerMetrics.highlightedPropertiesCount}</span></div>
                    <Button asChild variant="outline" className="mt-2 w-full justify-start gap-2 rounded-2xl"><Link href="/meus-imoveis"><Building2 className="h-4 w-4" />Abrir Meus Im\u00f3veis</Link></Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
