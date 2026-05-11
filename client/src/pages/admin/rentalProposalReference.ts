export function formatRentalProposalReference(id: number, createdAt: Date | string) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return `0000000000-${id}`;
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateCode = `${year}${month}${day}`;
  const digitSum = dateCode.split("").reduce((sum, digit) => sum + Number(digit), 0);

  return `${dateCode}${digitSum}-${id}`;
}

export function getRentalProposalDetailsPath(id: number) {
  return `/admin/modulos/locacoes/propostas/${id}`;
}
