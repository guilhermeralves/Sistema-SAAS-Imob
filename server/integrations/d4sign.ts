// Integracao com a D4Sign (assinatura eletronica avancada/qualificada).
//
// Toda a configuracao vem do ambiente (.env) e nada e exposto ao frontend.
// O fluxo usado pelo modulo de Locacoes (etapa 24 - assinaturas) e:
//   1. uploadDocxBase64  -> sobe o contrato (.docx) num cofre e recebe um uuid;
//   2. createSignersList -> cadastra os signatarios (locatarios/proprietarios);
//   3. registerWebhook   -> registra a URL de callback (best-effort);
//   4. sendToSigner      -> dispara os e-mails de assinatura;
//   5. getDocumentStatus -> consulta o status atual do documento;
//   6. downloadSigned    -> baixa o PDF assinado quando finalizado.
//
// A D4Sign autentica por querystring (tokenAPI + cryptKey) e responde JSON.
// Docs: https://docapi.d4sign.com.br/

export type D4SignEnvironment = "sandbox" | "production";

export interface D4SignConfig {
  tokenApi: string;
  cryptKey: string;
  safeUuid: string;
  folderUuid: string | null;
  environment: D4SignEnvironment;
  baseUrl: string;
  // "email" = assinatura avancada (sem certificado); "icpbr" = qualificada.
  signatureType: "email" | "icpbr";
  webhookUrl: string | null;
}

export interface D4SignSignerInput {
  email: string;
  displayName: string;
  // Papel apenas para auditoria/log; nao e enviado a D4Sign.
  role: "locatario" | "proprietario" | "corretor";
}

export class D4SignError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "D4SignError";
  }
}

function readConfig(): D4SignConfig | null {
  const tokenApi = process.env.D4SIGN_TOKEN_API?.trim() || "";
  const cryptKey = process.env.D4SIGN_CRYPT_KEY?.trim() || "";
  const safeUuid = process.env.D4SIGN_SAFE_UUID?.trim() || "";

  if (!tokenApi || !cryptKey || !safeUuid) {
    return null;
  }

  const environment: D4SignEnvironment =
    process.env.D4SIGN_ENVIRONMENT?.trim() === "production"
      ? "production"
      : "sandbox";

  const baseUrl =
    environment === "production"
      ? "https://secure.d4sign.com.br/api/v1"
      : "https://sandbox.d4sign.com.br/api/v1";

  const signatureType: "email" | "icpbr" =
    process.env.D4SIGN_SIGNATURE_TYPE?.trim() === "icpbr" ? "icpbr" : "email";

  // URL do webhook: explicita ou derivada da base publica da app.
  const explicitWebhook = process.env.D4SIGN_WEBHOOK_URL?.trim() || "";
  const appBase =
    process.env.APP_BASE_URL?.trim() ||
    process.env.VITE_OAUTH_PORTAL_URL?.trim() ||
    "";
  const webhookUrl =
    explicitWebhook ||
    (appBase
      ? `${appBase.replace(/\/+$/, "")}/api/integrations/d4sign/webhook`
      : null);

  return {
    tokenApi,
    cryptKey,
    safeUuid,
    folderUuid: process.env.D4SIGN_FOLDER_UUID?.trim() || null,
    environment,
    baseUrl,
    signatureType,
    webhookUrl,
  };
}

export function isD4SignConfigured(): boolean {
  return readConfig() !== null;
}

export function getD4SignConfig(): D4SignConfig {
  const config = readConfig();
  if (!config) {
    throw new D4SignError(
      "Integracao D4Sign nao configurada. Defina D4SIGN_TOKEN_API, D4SIGN_CRYPT_KEY e D4SIGN_SAFE_UUID no .env."
    );
  }
  return config;
}

function buildUrl(config: D4SignConfig, path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${config.baseUrl}${path}${sep}tokenAPI=${encodeURIComponent(
    config.tokenApi
  )}&cryptKey=${encodeURIComponent(config.cryptKey)}`;
}

async function request<T>(
  config: D4SignConfig,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = buildUrl(config, path);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new D4SignError(
      `Falha de rede ao chamar a D4Sign (${path}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new D4SignError(
      `D4Sign retornou ${response.status} em ${path}.`,
      response.status,
      parsed
    );
  }

  // A D4Sign as vezes responde { message: [...] } ou { error: ... } com 200.
  if (
    parsed &&
    typeof parsed === "object" &&
    "error" in (parsed as Record<string, unknown>)
  ) {
    throw new D4SignError(
      `D4Sign reportou erro em ${path}.`,
      response.status,
      parsed
    );
  }

  return parsed as T;
}

// Sobe um .docx (base64 puro, sem prefixo data:) e retorna o uuid do documento.
export async function uploadDocxBase64(
  config: D4SignConfig,
  params: { base64: string; name: string }
): Promise<string> {
  const base64 = params.base64.replace(/^data:[^;]+;base64,/, "");
  const result = await request<{ uuid?: string }>(
    config,
    `/documents/${config.safeUuid}/uploadbinary`,
    {
      base64_binary_file: base64,
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: params.name,
      ...(config.folderUuid ? { uuid_folder: config.folderUuid } : {}),
    }
  );

  if (!result?.uuid) {
    throw new D4SignError(
      "D4Sign nao retornou o uuid do documento no upload.",
      200,
      result
    );
  }
  return result.uuid;
}

// Cadastra a lista de signatarios do documento.
export async function createSignersList(
  config: D4SignConfig,
  documentUuid: string,
  signers: D4SignSignerInput[]
): Promise<void> {
  const certificadoicpbr = config.signatureType === "icpbr" ? "1" : "0";
  await request(config, `/documents/${documentUuid}/createlist`, {
    signers: signers.map(signer => ({
      email: signer.email,
      act: "1", // assinar
      foreign: "0",
      certificadoicpbr,
      assinatura_presencial: "0",
      docauth: "0",
      embed_methodauth: "email",
      display_name: signer.displayName,
    })),
  });
}

// Registra (best-effort) a URL de webhook para o documento.
export async function registerWebhook(
  config: D4SignConfig,
  documentUuid: string
): Promise<void> {
  if (!config.webhookUrl) return;
  await request(config, `/documents/${documentUuid}/webhooks`, {
    url: config.webhookUrl,
  });
}

// Dispara os e-mails de assinatura para todos os signatarios.
export async function sendToSigner(
  config: D4SignConfig,
  documentUuid: string,
  params?: { message?: string }
): Promise<void> {
  await request(config, `/documents/${documentUuid}/sendtosigner`, {
    skip_email: "0",
    workflow: "0",
    ...(params?.message ? { message: params.message } : {}),
  });
}

export interface D4SignDocumentStatus {
  uuid: string;
  statusId: string | null;
  statusName: string | null;
  // Derivado: documento totalmente assinado/finalizado.
  finished: boolean;
  cancelled: boolean;
}

// Consulta o status atual do documento. statusId "4" = Finalizado, "6" = Cancelado.
export async function getDocumentStatus(
  config: D4SignConfig,
  documentUuid: string
): Promise<D4SignDocumentStatus> {
  const result = await request<unknown>(
    config,
    `/documents/${documentUuid}`
  );

  // A D4Sign retorna um array de documentos (geralmente 1 elemento).
  const doc = Array.isArray(result)
    ? (result[0] as Record<string, unknown> | undefined)
    : (result as Record<string, unknown> | undefined);

  const statusId =
    doc && doc.statusId != null ? String(doc.statusId) : null;
  const statusName =
    doc && doc.statusName != null ? String(doc.statusName) : null;
  const normalized = (statusName ?? "").toLowerCase();

  return {
    uuid: documentUuid,
    statusId,
    statusName,
    finished: statusId === "4" || normalized.includes("finaliz"),
    cancelled: statusId === "6" || normalized.includes("cancel"),
  };
}

// Baixa o PDF assinado e retorna como data URL base64.
export async function downloadSigned(
  config: D4SignConfig,
  documentUuid: string
): Promise<{ fileName: string; dataUrl: string }> {
  const result = await request<{ url?: string; name?: string }>(
    config,
    `/documents/${documentUuid}/download`,
    { type: "PDF" }
  );

  if (!result?.url) {
    throw new D4SignError(
      "D4Sign nao retornou a URL do PDF assinado.",
      200,
      result
    );
  }

  const fileResponse = await fetch(result.url);
  if (!fileResponse.ok) {
    throw new D4SignError(
      `Falha ao baixar o PDF assinado da D4Sign (${fileResponse.status}).`
    );
  }
  const arrayBuffer = await fileResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    fileName: result.name?.trim() || `${documentUuid}.pdf`,
    dataUrl: `data:application/pdf;base64,${base64}`,
  };
}

// Cancela o documento no provedor (best-effort).
export async function cancelDocument(
  config: D4SignConfig,
  documentUuid: string,
  comment?: string
): Promise<void> {
  await request(config, `/documents/${documentUuid}/cancel`, {
    ...(comment ? { comment } : {}),
  });
}
