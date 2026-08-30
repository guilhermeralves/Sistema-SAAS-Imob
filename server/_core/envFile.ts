import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Reescreve um conjunto de chaves no arquivo `.env` do processo,
 * preservando todas as outras linhas (comentários, ordem, etc.).
 * Chaves inexistentes são anexadas ao final numa seção "auto-gerada".
 *
 * IMPORTANTE: valores gravados aqui só passam a valer no `process.env`
 * na próxima inicialização do servidor. Módulos que precisam refletir
 * mudanças imediatamente devem ler direto do banco (via
 * `systemParameters.ts`) em vez de `process.env`.
 */
export async function updateEnvFile(
  updates: Record<string, string | null | undefined>
): Promise<{ file: string; changedKeys: string[] } | { skipped: string }> {
  const envPath = path.resolve(process.cwd(), ".env");

  let content = "";
  try {
    content = await fs.readFile(envPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      return { skipped: `read: ${(err as Error).message}` };
    }
    content = "";
  }

  const lines = content.split(/\r?\n/);
  const AUTO_MARK = "# --- gerenciado por /admin/parametros (não editar à mão) ---";
  const managedIdx = lines.indexOf(AUTO_MARK);

  const before = managedIdx >= 0 ? lines.slice(0, managedIdx) : lines;
  const changedKeys: string[] = [];

  // Atualizações in-place na parte "before" (chaves que já existem lá).
  const rewritten = before.map(line => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return line;
    const key = match[1];
    if (!(key in updates)) return line;
    const value = updates[key];
    if (value == null) return line; // não apagamos
    changedKeys.push(key);
    const quoted = value.includes(" ") || value.includes('"') || value.includes("\n")
      ? JSON.stringify(value)
      : value;
    return `${key}=${quoted}`;
  });

  // Chaves que ainda não foram escritas vão para o bloco gerenciado.
  const notWritten = Object.keys(updates).filter(
    k => !changedKeys.includes(k) && updates[k] != null
  );

  let managedBlock: string[] = [];
  if (notWritten.length > 0) {
    managedBlock = [
      "",
      AUTO_MARK,
      ...notWritten.map(k => {
        const v = updates[k] ?? "";
        const quoted =
          v.includes(" ") || v.includes('"') || v.includes("\n")
            ? JSON.stringify(v)
            : v;
        return `${k}=${quoted}`;
      }),
    ];
    changedKeys.push(...notWritten);
  }

  const finalContent = [...rewritten, ...managedBlock].join("\n");
  const withTrailingNewline = finalContent.endsWith("\n")
    ? finalContent
    : `${finalContent}\n`;

  await fs.writeFile(envPath, withTrailingNewline, "utf8");
  return { file: envPath, changedKeys };
}
