// Catalogo de "integracoes nativas" do sistema: integracoes que vivem no codigo
// e sao configuradas por variaveis de ambiente (.env), diferente das integracoes
// cadastradas manualmente pelo admin na tabela `integrations`.
//
// Cada item traz informacoes previas (o que e, o que faz, o que precisa) e um
// status calculado em tempo real a partir do ambiente — sem nunca expor o valor
// dos segredos, apenas se estao preenchidos.

import { isD4SignConfigured } from "./d4sign";

export type NativeIntegrationCategory =
  | "portal_divulgacao"
  | "financeiro"
  | "assinaturas_eletronicas";

export type NativeIntegrationStatus = "nao_configurada" | "configurada";

export interface NativeIntegrationRequirement {
  // Nome da variavel de ambiente exigida.
  envVar: string;
  // Rotulo amigavel para o admin.
  label: string;
  // Se ja esta preenchida no ambiente (nunca expomos o valor).
  present: boolean;
  // Se e obrigatoria para a integracao funcionar.
  required: boolean;
}

export interface NativeIntegrationInfo {
  key: string;
  name: string;
  provider: string;
  category: NativeIntegrationCategory;
  // Resumo do que e a integracao.
  description: string;
  // O que ela faz, em topicos.
  capabilities: string[];
  // Link da documentacao oficial (ou null).
  docsUrl: string | null;
  status: NativeIntegrationStatus;
  // Detalhe curto do estado atual (ex.: ambiente/tipo).
  statusDetail: string;
  requirements: NativeIntegrationRequirement[];
}

function envPresent(name: string): boolean {
  return (process.env[name]?.trim().length ?? 0) > 0;
}

// Monta o catalogo com o status calculado agora. Chamado pelo router admin.
export function getNativeIntegrations(): NativeIntegrationInfo[] {
  const d4signConfigured = isD4SignConfigured();
  const d4signEnv =
    process.env.D4SIGN_ENVIRONMENT?.trim() === "production"
      ? "Produção"
      : "Sandbox (testes)";
  const d4signType =
    process.env.D4SIGN_SIGNATURE_TYPE?.trim() === "icpbr"
      ? "Qualificada (ICP-Brasil)"
      : "Avançada (e-mail)";

  return [
    {
      key: "d4sign",
      name: "D4Sign",
      provider: "D4Sign",
      category: "assinaturas_eletronicas",
      description:
        "Assinatura eletrônica dos contratos de locação. Envia o contrato aprovado para o locatário e o proprietário assinarem com validade jurídica.",
      capabilities: [
        "Envio dos contratos aprovados para assinatura na etapa de Locações",
        "Assinatura avançada (e-mail) ou qualificada (ICP-Brasil)",
        "Aviso automático por webhook quando todos assinam",
        "Download do PDF assinado direto na proposta",
      ],
      docsUrl: "https://docapi.d4sign.com.br/",
      status: d4signConfigured ? "configurada" : "nao_configurada",
      statusDetail: d4signConfigured
        ? `Ambiente: ${d4signEnv} · Tipo: ${d4signType}`
        : "Defina as credenciais no .env para habilitar o envio.",
      requirements: [
        {
          envVar: "D4SIGN_TOKEN_API",
          label: "Token da API",
          present: envPresent("D4SIGN_TOKEN_API"),
          required: true,
        },
        {
          envVar: "D4SIGN_CRYPT_KEY",
          label: "Chave de criptografia",
          present: envPresent("D4SIGN_CRYPT_KEY"),
          required: true,
        },
        {
          envVar: "D4SIGN_SAFE_UUID",
          label: "UUID do cofre",
          present: envPresent("D4SIGN_SAFE_UUID"),
          required: true,
        },
        {
          envVar: "D4SIGN_WEBHOOK_URL",
          label: "URL do webhook (opcional)",
          present: envPresent("D4SIGN_WEBHOOK_URL"),
          required: false,
        },
      ],
    },
  ];
}
