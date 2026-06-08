// Codigo de referencia da proposta de locacao e rodape derivado dos contratos.
// Mantido em shared para que backend (geracao) e frontend (exibicao) usem o
// mesmo formato.

/**
 * Gera o codigo de referencia de uma proposta de locacao.
 * Formato: LOC-<ano de geracao>-<id da proposta com 4 digitos>. Ex.: LOC-2026-0042.
 */
export function buildRentalProposalReferenceCode(
  proposalId: number,
  generatedAt: Date = new Date()
): string {
  const year = generatedAt.getFullYear();
  const paddedId = String(proposalId).padStart(4, "0");
  return `LOC-${year}-${paddedId}`;
}

/**
 * Linha de rodape padrao dos contratos com o codigo de referencia da proposta.
 */
export function buildContractReferenceFooter(referenceCode: string): string {
  return `Código de referência: ${referenceCode}`;
}
