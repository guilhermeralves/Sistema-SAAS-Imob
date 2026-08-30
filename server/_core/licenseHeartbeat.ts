import { callHeartbeat } from "./noxilonClient";
import {
  loadGateState,
  updateHeartbeatFailure,
  updateHeartbeatSuccess,
} from "./licenseGate";

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1h

async function runOnce() {
  const gate = await loadGateState();
  if (!gate.activated) return;

  const result = await callHeartbeat({
    tenantId: gate.activation.tenantId,
    activationCodeId: gate.activation.activationCodeId,
  });

  if (!("ok" in result) || !result.ok) {
    const err = result as { code: string; message: string };
    await updateHeartbeatFailure(
      gate.activation.id,
      `${err.code}: ${err.message}`
    );
    console.warn(
      `[license-heartbeat] falhou: ${err.code} - ${err.message}`
    );
    return;
  }

  await updateHeartbeatSuccess({
    activationId: gate.activation.id,
    token: result.token,
    tokenExpiresAt: result.expiresAt,
    licenseStatus: result.license.status,
    dueDate: result.license.dueDate,
  });
}

export function startLicenseHeartbeat() {
  // Roda uma vez logo após o boot (dá 5s para o servidor central estar de pé)
  setTimeout(() => {
    void runOnce();
    setInterval(() => void runOnce(), HEARTBEAT_INTERVAL_MS);
  }, 5000);
}
