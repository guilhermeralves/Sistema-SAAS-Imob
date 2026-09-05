import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCep } from "@/lib/cep";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Conjunto padronizado de campos de endereço com autocomplete via CEP.
 * Ao terminar de digitar o CEP (8 dígitos) e o campo perder o foco,
 * consulta ViaCEP + BrasilAPI e preenche endereço/bairro/cidade/UF.
 *
 * Uso:
 *   const [addr, setAddr] = useState<AddressValue>({});
 *   <AddressFields value={addr} onChange={setAddr} />
 *
 * Onde: `value` guarda cep/endereco/numero/complemento/bairro/cidade/estado.
 * O componente é controlado — quem chama detém o estado e persiste.
 */

export type AddressValue = {
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

export type AddressFieldsProps = {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  /** Rótulos customizados (ex: "CEP do imóvel") — opcional. */
  labels?: Partial<Record<keyof AddressValue, string>>;
  /** Quais campos ocultar (raramente necessário). */
  hide?: Array<keyof AddressValue>;
  /** Marcar todos como obrigatórios visualmente (asterisco). */
  required?: boolean;
  /** Classe extra no grid externo. */
  className?: string;
};

const DEFAULT_LABELS: Record<keyof AddressValue, string> = {
  cep: "CEP",
  endereco: "Endereço",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "UF",
};

export default function AddressFields({
  value,
  onChange,
  labels,
  hide,
  required,
  className,
}: AddressFieldsProps) {
  const [cepLoading, setCepLoading] = useState(false);
  const hidden = new Set(hide ?? []);
  const label = (key: keyof AddressValue) => labels?.[key] ?? DEFAULT_LABELS[key];

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  const handleCepBlur = async () => {
    const digits = (value.cep ?? "").replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const result = await lookupCep(digits);
      if (result.status === "success") {
        set({
          endereco: result.data.endereco || value.endereco,
          bairro: result.data.bairro || value.bairro,
          cidade: result.data.cidade || value.cidade,
          estado: result.data.estado || value.estado,
        });
      } else if (result.status === "not_found") {
        toast.error("CEP não encontrado.");
      } else {
        toast.error("Serviço de CEP indisponível.");
      }
    } finally {
      setCepLoading(false);
    }
  };

  const req = required ? " *" : "";

  return (
    <div
      className={
        "grid grid-cols-1 gap-3 md:grid-cols-4 " + (className ?? "")
      }
    >
      {!hidden.has("cep") && (
        <div className="md:col-span-1">
          <Label>
            {label("cep")}
            {req}
            {cepLoading ? (
              <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
            ) : null}
          </Label>
          <Input
            value={value.cep ?? ""}
            onChange={e => set({ cep: e.target.value })}
            onBlur={handleCepBlur}
            placeholder="00000-000"
          />
        </div>
      )}

      {!hidden.has("endereco") && (
        <div className="md:col-span-3">
          <Label>{label("endereco")}{req}</Label>
          <Input
            value={value.endereco ?? ""}
            onChange={e => set({ endereco: e.target.value })}
          />
        </div>
      )}

      {!hidden.has("numero") && (
        <div className="md:col-span-1">
          <Label>{label("numero")}</Label>
          <Input
            value={value.numero ?? ""}
            onChange={e => set({ numero: e.target.value })}
          />
        </div>
      )}

      {!hidden.has("complemento") && (
        <div className="md:col-span-3">
          <Label>{label("complemento")}</Label>
          <Input
            value={value.complemento ?? ""}
            onChange={e => set({ complemento: e.target.value })}
          />
        </div>
      )}

      {!hidden.has("bairro") && (
        <div className="md:col-span-2">
          <Label>{label("bairro")}</Label>
          <Input
            value={value.bairro ?? ""}
            onChange={e => set({ bairro: e.target.value })}
          />
        </div>
      )}

      {!hidden.has("cidade") && (
        <div className="md:col-span-1">
          <Label>{label("cidade")}{req}</Label>
          <Input
            value={value.cidade ?? ""}
            onChange={e => set({ cidade: e.target.value })}
          />
        </div>
      )}

      {!hidden.has("estado") && (
        <div className="md:col-span-1">
          <Label>{label("estado")}{req}</Label>
          <Input
            maxLength={2}
            value={value.estado ?? ""}
            onChange={e => set({ estado: e.target.value.toUpperCase() })}
          />
        </div>
      )}
    </div>
  );
}
