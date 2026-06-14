import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { fillContractDocx, ContractDocxFillError } from "./contract-docx";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// Monta um .docx minimo a partir do conteudo de runs (cada item vira um <w:t>).
function buildDocx(runs: string[]): Buffer {
  const body = runs
    .map(text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`)
    .join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body><w:p>${body}</w:p></w:body></w:document>`;

  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer" });
}

function readDocumentXml(docx: Buffer): string {
  return new PizZip(docx).file("word/document.xml")!.asText();
}

describe("fillContractDocx", () => {
  it("substitui placeholders pelos valores preservando o restante", () => {
    const template = buildDocx([
      "Locatario: [NOME DO LOCATARIO], CPF [CPF].",
    ]);
    const out = fillContractDocx({
      templateBuffer: template,
      valuesByPlaceholder: {
        "[NOME DO LOCATARIO]": "Joao da Silva",
        "[CPF]": "123.456.789-00",
      },
    });
    const xml = readDocumentXml(out);
    expect(xml).toContain("Joao da Silva");
    expect(xml).toContain("123.456.789-00");
    expect(xml).not.toContain("[NOME DO LOCATARIO]");
  });

  it("resolve placeholder dividido em varios runs do Word", () => {
    const template = buildDocx(["Nome: [NO", "ME", "] fim."]);
    const out = fillContractDocx({
      templateBuffer: template,
      valuesByPlaceholder: { "[NOME]": "Maria" },
    });
    const xml = readDocumentXml(out);
    expect(xml).toContain("Maria");
    expect(xml).not.toContain("[NOME]");
  });

  it("mantem placeholders sem valor entre colchetes", () => {
    const template = buildDocx(["Valor: [VALOR], Pendente: [NAO MAPEADO]."]);
    const out = fillContractDocx({
      templateBuffer: template,
      valuesByPlaceholder: { "[VALOR]": "R$ 2.000,00" },
    });
    const xml = readDocumentXml(out);
    expect(xml).toContain("R$ 2.000,00");
    expect(xml).toContain("[NAO MAPEADO]");
  });

  it("aceita chaves de valores com e sem colchetes", () => {
    const template = buildDocx(["A: [A], B: [B]."]);
    const out = fillContractDocx({
      templateBuffer: template,
      valuesByPlaceholder: { "[A]": "um", B: "dois" },
    });
    const xml = readDocumentXml(out);
    expect(xml).toContain("um");
    expect(xml).toContain("dois");
  });

  it("lanca ContractDocxFillError para buffer que nao e .docx", () => {
    expect(() =>
      fillContractDocx({
        templateBuffer: Buffer.from("nao e um zip"),
        valuesByPlaceholder: {},
      })
    ).toThrow(ContractDocxFillError);
  });
});
