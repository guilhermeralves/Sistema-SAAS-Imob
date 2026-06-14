// Geracao do .docx final de um contrato de proposta de locacao preservando o
// layout do modelo Word original. A ideia: reaproveitar a estrutura/formatacao
// do .docx do modelo e apenas substituir o TEXTO de cada paragrafo pelo texto
// final ja revisado e validado pelo administrativo (reviewedText), que contem
// tanto as variaveis substituidas quanto as edicoes manuais.
//
// O casamento e feito por ordem entre os paragrafos NAO vazios do .docx e as
// linhas NAO vazias do texto final. O mammoth (usado para extrair o texto
// editavel) emite exatamente uma linha por paragrafo, inclusive para cada
// celula de tabela, entao esse alinhamento preserva tabelas e formatacao.
import PizZip from "pizzip";

export class ContractDocxFillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractDocxFillError";
  }
}

const FOOTER_PART_NAME = "word/footer_afg.xml";
const FOOTER_RELATIONSHIP_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer";
const FOOTER_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml";
const R_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const PARAGRAPH_REGEX = /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
const TEXT_REGEX = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;

function paragraphPlainText(paragraphXml: string): string {
  let text = "";
  let match: RegExpExecArray | null;
  TEXT_REGEX.lastIndex = 0;
  while ((match = TEXT_REGEX.exec(paragraphXml))) {
    text += decodeXml(match[1]);
  }
  return text;
}

type ParagraphShell = { openTag: string; pPr: string; rPr: string };

// Extrai a "casca" de um paragrafo: a tag de abertura, as propriedades do
// paragrafo (<w:pPr>) e as propriedades do primeiro run (<w:rPr>), usadas para
// reescrever o texto preservando a formatacao.
function getParagraphShell(paragraphXml: string): ParagraphShell | null {
  const openMatch = paragraphXml.match(/^<w:p\b[^>]*>/);
  if (!openMatch) return null;
  const openTag = openMatch[0];
  const inner = paragraphXml.slice(
    openTag.length,
    paragraphXml.length - "</w:p>".length
  );
  const pPrMatch = inner.match(
    /^\s*(<w:pPr\b[^>]*\/>|<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>)/
  );
  const pPr = pPrMatch ? pPrMatch[1] : "";
  const rPrMatch = inner.match(
    /<w:r\b[^>]*>\s*(<w:rPr\b[^>]*\/>|<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>)/
  );
  const rPr = rPrMatch ? rPrMatch[1] : "";
  return { openTag, pPr, rPr };
}

function buildParagraph(shell: ParagraphShell, text: string): string {
  return `${shell.openTag}${shell.pPr}<w:r>${shell.rPr}<w:t xml:space="preserve">${encodeXml(text)}</w:t></w:r></w:p>`;
}

function rewriteParagraphText(paragraphXml: string, text: string): string {
  const shell = getParagraphShell(paragraphXml);
  if (!shell) return paragraphXml;
  return buildParagraph(shell, text);
}

function buildFooterParagraph(footerText: string): string {
  return (
    `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>` +
    `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>` +
    `<w:t xml:space="preserve">${encodeXml(footerText)}</w:t></w:r></w:p>`
  );
}

// Substitui o texto dos paragrafos do documento pelas linhas nao vazias do
// texto final, na ordem. Paragrafos vazios sao preservados (mantem o
// espacamento). Sobras de linhas sao anexadas como novos paragrafos.
function applyBodyText(documentXml: string, bodyText: string): string {
  const finalLines = bodyText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const finalNonEmpty = finalLines.filter(line => line.trim() !== "");

  let nonEmptyIndex = 0;
  let lastShell: ParagraphShell | null = null;

  let rewritten = documentXml.replace(PARAGRAPH_REGEX, full => {
    const text = paragraphPlainText(full);
    if (text.trim() === "") return full;

    const shell = getParagraphShell(full);
    if (shell) lastShell = shell;

    if (nonEmptyIndex < finalNonEmpty.length) {
      const newText = finalNonEmpty[nonEmptyIndex];
      nonEmptyIndex += 1;
      return rewriteParagraphText(full, newText);
    }
    // Modelo tem mais paragrafos do que o texto final: esvazia o excedente.
    return rewriteParagraphText(full, "");
  });

  // Linhas finais que sobraram (texto adicionado nas edicoes): anexa como novos
  // paragrafos clonando a formatacao do ultimo paragrafo conhecido.
  if (nonEmptyIndex < finalNonEmpty.length && lastShell) {
    const extra = finalNonEmpty
      .slice(nonEmptyIndex)
      .map(line => buildParagraph(lastShell as ParagraphShell, line))
      .join("");
    const sectStart = rewritten.lastIndexOf("<w:sectPr");
    if (sectStart >= 0) {
      rewritten = rewritten.slice(0, sectStart) + extra + rewritten.slice(sectStart);
    } else {
      rewritten = rewritten.replace("</w:body>", `${extra}</w:body>`);
    }
  }

  return rewritten;
}

function ensureRNamespace(documentXml: string): string {
  if (/<w:document\b[^>]*\bxmlns:r=/.test(documentXml)) return documentXml;
  return documentXml.replace(
    /<w:document\b/,
    `<w:document xmlns:r="${R_NAMESPACE}"`
  );
}

function nextRelationshipId(relsXml: string): string {
  let max = 0;
  for (const match of relsXml.matchAll(/Id="rId(\d+)"/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return `rId${max + 1}`;
}

// Garante que o codigo de referencia apareca no rodape de todas as paginas:
// anexa o codigo aos rodapes ja existentes do modelo e cria um rodape padrao
// para as secoes que ainda nao tem um.
function applyReferenceFooter(
  zip: PizZip,
  documentXml: string,
  footerText: string
): string {
  const footerParagraph = buildFooterParagraph(footerText);

  const relsPath = "word/_rels/document.xml.rels";
  let relsXml =
    zip.file(relsPath)?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  // 1) Anexa o codigo aos rodapes ja referenciados pelo documento.
  const referencedRelIds = new Set<string>();
  for (const match of documentXml.matchAll(
    /<w:footerReference\b[^>]*\br:id="(rId\d+)"[^>]*\/?>/g
  )) {
    referencedRelIds.add(match[1]);
  }

  const targetByRelId = new Map<string, string>();
  for (const match of relsXml.matchAll(
    /<Relationship\b[^>]*\bId="(rId\d+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>/g
  )) {
    targetByRelId.set(match[1], match[2]);
  }

  const appendedParts = new Set<string>();
  for (const relId of referencedRelIds) {
    const target = targetByRelId.get(relId);
    if (!target) continue;
    const partName = target.startsWith("/")
      ? target.slice(1)
      : `word/${target}`;
    if (appendedParts.has(partName)) continue;
    const part = zip.file(partName);
    if (!part) continue;
    const partXml = part.asText();
    if (!partXml.includes("</w:ftr>")) continue;
    zip.file(
      partName,
      partXml.replace("</w:ftr>", `${footerParagraph}</w:ftr>`)
    );
    appendedParts.add(partName);
  }

  // 2) Secoes sem rodape padrao recebem um novo rodape compartilhado com o codigo.
  const sections = Array.from(documentXml.matchAll(/<w:sectPr\b[^>]*\/>|<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g));
  const sectionsMissingDefault = sections.filter(
    match => !/<w:footerReference\b[^>]*w:type="default"/.test(match[0])
  );

  if (sections.length === 0) {
    // Documento sem sectPr (raro): cria a secao com o rodape.
    const newRelId = nextRelationshipId(relsXml);
    createSharedFooter(zip, footerParagraph, newRelId, relsXml, relsPath);
    relsXml = zip.file(relsPath)!.asText();
    const footerRef = `<w:footerReference w:type="default" r:id="${newRelId}"/>`;
    return documentXml.replace(
      "</w:body>",
      `<w:sectPr>${footerRef}</w:sectPr></w:body>`
    );
  }

  if (sectionsMissingDefault.length === 0) {
    return documentXml;
  }

  const newRelId = nextRelationshipId(relsXml);
  createSharedFooter(zip, footerParagraph, newRelId, relsXml, relsPath);
  const footerRef = `<w:footerReference w:type="default" r:id="${newRelId}"/>`;

  let result = documentXml;
  for (const match of sectionsMissingDefault) {
    const original = match[0];
    let updated: string;
    if (/<w:sectPr\b[^>]*\/>/.test(original)) {
      updated = original.replace(
        /<w:sectPr\b([^>]*)\/>/,
        `<w:sectPr$1>${footerRef}</w:sectPr>`
      );
    } else {
      updated = original.replace(/^<w:sectPr\b[^>]*>/, m => `${m}${footerRef}`);
    }
    result = result.replace(original, updated);
  }
  return result;
}

function createSharedFooter(
  zip: PizZip,
  footerParagraph: string,
  relId: string,
  relsXml: string,
  relsPath: string
): void {
  const footerXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${R_NAMESPACE}">` +
    `${footerParagraph}</w:ftr>`;
  zip.file(FOOTER_PART_NAME, footerXml);

  // Relationship document.xml -> footer_afg.xml
  const relationship = `<Relationship Id="${relId}" Type="${FOOTER_RELATIONSHIP_TYPE}" Target="footer_afg.xml"/>`;
  const updatedRels = relsXml.replace(
    /<\/Relationships>\s*$/,
    `${relationship}</Relationships>`
  );
  zip.file(relsPath, updatedRels);

  // Content type override.
  const ctPath = "[Content_Types].xml";
  const ctXml = zip.file(ctPath)?.asText();
  if (ctXml && !ctXml.includes(`PartName="/${FOOTER_PART_NAME}"`)) {
    const override = `<Override PartName="/${FOOTER_PART_NAME}" ContentType="${FOOTER_CONTENT_TYPE}"/>`;
    zip.file(
      ctPath,
      ctXml.replace(/<\/Types>\s*$/, `${override}</Types>`)
    );
  }
}

/**
 * Gera o .docx final do contrato a partir do modelo (.docx original) e do texto
 * final revisado, preservando o layout do modelo. Adiciona o codigo de
 * referencia (footerText) ao rodape de todas as paginas.
 */
export function renderContractDocx(params: {
  templateBuffer: Buffer;
  bodyText: string;
  footerText?: string | null;
}): Buffer {
  let zip: PizZip;
  try {
    zip = new PizZip(params.templateBuffer);
  } catch {
    throw new ContractDocxFillError(
      "Nao foi possivel abrir o arquivo .docx do modelo."
    );
  }

  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new ContractDocxFillError(
      "O modelo .docx nao tem um documento principal valido."
    );
  }

  let documentXml = documentFile.asText();
  documentXml = ensureRNamespace(documentXml);
  documentXml = applyBodyText(documentXml, params.bodyText);

  if (params.footerText && params.footerText.trim()) {
    documentXml = applyReferenceFooter(zip, documentXml, params.footerText.trim());
  }

  zip.file("word/document.xml", documentXml);

  try {
    return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  } catch {
    throw new ContractDocxFillError(
      "Nao foi possivel gerar o arquivo .docx do contrato."
    );
  }
}
