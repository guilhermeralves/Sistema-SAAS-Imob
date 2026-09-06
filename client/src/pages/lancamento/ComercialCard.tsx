import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CircleCheck, Clock, Handshake, Home } from "lucide-react";

/**
 * Card "Comercial" com visualização proporcional dos 4 status de
 * unidades. Recebe os valores atuais + callbacks para edição.
 *
 * No modo leitura mostra um donut SVG e legenda; no modo edição,
 * inputs numéricos para cada status. Alerta quando a soma não bate
 * com o total de unidades.
 */

export type ComercialCounts = {
  total: number;
  disponiveis: number;
  reservadas: number;
  emNegociacao: number;
  vendidas: number;
};

const SEGMENTS = [
  {
    key: "disponiveis" as const,
    label: "Disponíveis",
    color: "#10b981", // emerald-500
    icon: Home,
  },
  {
    key: "reservadas" as const,
    label: "Reservadas",
    color: "#f59e0b", // amber-500
    icon: Clock,
  },
  {
    key: "emNegociacao" as const,
    label: "Em negociação",
    color: "#3b82f6", // blue-500
    icon: Handshake,
  },
  {
    key: "vendidas" as const,
    label: "Vendidas",
    color: "#6366f1", // indigo-500
    icon: CircleCheck,
  },
];

function DonutChart({ counts }: { counts: ComercialCounts }) {
  const total = Math.max(1, counts.total);
  const size = 180;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Se total = 0, mostra apenas o fundo neutro
  const hasData = counts.total > 0;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        {hasData
          ? SEGMENTS.map(seg => {
              const value = counts[seg.key];
              if (value <= 0) return null;
              const fraction = value / total;
              const length = fraction * circumference;
              const dasharray = `${length} ${circumference - length}`;
              const currentOffset = offset;
              offset += length;
              return (
                <circle
                  key={seg.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dasharray}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="butt"
                />
              );
            })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold leading-none">{counts.total}</span>
        <span className="mt-1 text-xs text-muted-foreground">
          {counts.total === 1 ? "unidade" : "unidades"}
        </span>
      </div>
    </div>
  );
}

type Props = {
  counts: ComercialCounts;
  editMode: boolean;
  onChange: (patch: Partial<ComercialCounts>) => void;
};

export default function ComercialCard({ counts, editMode, onChange }: Props) {
  const soma =
    counts.disponiveis +
    counts.reservadas +
    counts.emNegociacao +
    counts.vendidas;
  const mismatch = counts.total > 0 && soma !== counts.total;

  const pct = (n: number) => {
    if (counts.total <= 0) return "0%";
    return `${Math.round((n / counts.total) * 100)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comercial</CardTitle>
        <CardDescription>
          {editMode
            ? "Ajuste a quantidade de unidades em cada status."
            : "Distribuição atual das unidades por status."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <DonutChart counts={counts} />

          <div className="w-full space-y-2">
            {SEGMENTS.map(seg => {
              const value = counts[seg.key];
              const Icon = seg.icon;
              return (
                <div
                  key={seg.key}
                  className="flex items-center justify-between gap-3 rounded-md border p-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: seg.color }}
                      aria-hidden
                    />
                    <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {seg.label}
                    </span>
                  </div>
                  {editMode ? (
                    <Input
                      type="number"
                      min={0}
                      value={value}
                      onChange={e =>
                        onChange({
                          [seg.key]: Math.max(
                            0,
                            parseInt(e.target.value || "0", 10)
                          ),
                        } as Partial<ComercialCounts>)
                      }
                      className="h-8 w-20 text-right"
                    />
                  ) : (
                    <div className="text-right">
                      <div className="text-sm font-semibold">{value}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {pct(value)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {editMode ? (
            <div className="w-full">
              <Label>Total de unidades</Label>
              <Input
                type="number"
                min={0}
                value={counts.total}
                onChange={e =>
                  onChange({
                    total: Math.max(0, parseInt(e.target.value || "0", 10)),
                  })
                }
              />
              {mismatch ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  Soma dos status ({soma}) diferente do total ({counts.total}).
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
