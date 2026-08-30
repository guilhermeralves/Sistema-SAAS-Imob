/**
 * Cliente HTTP que fala com o NOXILON Central. URL configurada via env
 * NOXILON_CENTRAL_URL (padrão http://localhost:3001 para dev).
 */
import os from "node:os";

export type CentralLicensePayload = {
  status: "active" | "grace" | "readonly" | "suspended";
  effectiveStatus: "active" | "grace" | "readonly" | "suspended";
  dueDate: string;
  gracePeriodDays: number;
  daysUntilDue: number;
  daysOverdue: number;
};

export type CentralActivationResponse = {
  ok: true;
  token: string;
  expiresAt: string;
  tenant: { id: number; slug: string; nome: string };
  license: CentralLicensePayload;
  activationCodeId: number;
};

export type CentralHeartbeatResponse = {
  ok: true;
  token: string;
  expiresAt: string;
  license: CentralLicensePayload;
};

export type CentralError = {
  ok: false;
  code: string;
  message: string;
};

function centralBaseUrl() {
  const url =
    process.env.NOXILON_CENTRAL_URL?.trim() || "http://localhost:3001";
  return url.replace(/\/+$/, "");
}

function serverFingerprint() {
  return `${os.hostname()}:${process.pid}`;
}

async function post<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T | CentralError> {
  const url = `${centralBaseUrl()}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, serverFingerprint: serverFingerprint() }),
    });
    const json = (await res.json()) as T | CentralError;
    return json;
  } catch (err) {
    return {
      ok: false,
      code: "network",
      message: err instanceof Error ? err.message : "network error",
    };
  }
}

export function callActivate(code: string) {
  return post<CentralActivationResponse>("/api/license/activate", { code });
}

export function callHeartbeat(input: {
  tenantId: number;
  activationCodeId: number;
}) {
  return post<CentralHeartbeatResponse>("/api/license/heartbeat", input);
}
