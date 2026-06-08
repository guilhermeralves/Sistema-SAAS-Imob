export type ContractVariableOption = {
  key: string;
  label: string;
  aliases: string[];
};

export const CONTRACT_TEMPLATE_KINDS = ["locacao", "venda", "outro"] as const;
export type ContractTemplateKind = (typeof CONTRACT_TEMPLATE_KINDS)[number];

export const CONTRACT_PARTICIPANT_ROLES = [
  "locatario",
  "comprador",
  "proprietario",
  "vendedor",
  "corretor",
  "imovel",
  "locacao",
] as const;
export type ContractParticipantRole =
  (typeof CONTRACT_PARTICIPANT_ROLES)[number];

export const CONTRACT_TEMPLATE_KIND_LABELS: Record<
  ContractTemplateKind,
  string
> = {
  locacao: "Locação",
  venda: "Venda",
  outro: "Outro",
};

export const CONTRACT_PARTICIPANT_ROLE_LABELS: Record<
  ContractParticipantRole,
  string
> = {
  locatario: "Locatário",
  comprador: "Comprador",
  proprietario: "Proprietário",
  vendedor: "Vendedor",
  corretor: "Corretor",
  imovel: "Imóvel",
  locacao: "Locação",
};

export const DEFAULT_CONTRACT_TEMPLATE_PARTICIPANT_ROLES: Record<
  ContractTemplateKind,
  ContractParticipantRole[]
> = {
  locacao: ["locatario", "proprietario", "corretor", "imovel", "locacao"],
  venda: ["comprador", "vendedor", "corretor", "imovel"],
  outro: ["locatario", "comprador", "proprietario", "vendedor", "corretor", "imovel", "locacao"],
};

const PERSON_FIELDS = [
  { key: "nome", label: "Nome", aliases: ["nome"] },
  { key: "cpf", label: "CPF", aliases: ["cpf"] },
  { key: "rg", label: "RG", aliases: ["rg", "identidade"] },
  { key: "email", label: "E-mail", aliases: ["email", "e-mail"] },
  { key: "telefone", label: "Telefone", aliases: ["telefone", "celular"] },
  { key: "birthDate", label: "Data de nascimento", aliases: ["data de nascimento", "nascimento"] },
  { key: "profession", label: "Profissão", aliases: ["profissao", "profissão"] },
  { key: "maritalStatus", label: "Estado civil", aliases: ["estado civil"] },
  { key: "nacionalidade", label: "Nacionalidade", aliases: ["nacionalidade"] },
  { key: "grossMonthlyIncome", label: "Renda mensal", aliases: ["renda mensal", "renda"] },
  { key: "householdIncome", label: "Renda familiar", aliases: ["renda familiar"] },
  { key: "endereco", label: "Endereço", aliases: ["endereco", "endereço"] },
  { key: "addressNumber", label: "Número", aliases: ["numero", "número"] },
  { key: "bairro", label: "Bairro", aliases: ["bairro"] },
  { key: "cidade", label: "Cidade", aliases: ["cidade"] },
  { key: "estado", label: "Estado", aliases: ["estado", "uf"] },
  { key: "zipCode", label: "CEP", aliases: ["cep"] },
  { key: "observacoes", label: "Observações", aliases: ["observacoes", "observações"] },
] as const;

const PERSON_ROLES = [
  { key: "locatario", label: "Locatário", aliases: ["locatario", "locatário"] },
  { key: "comprador", label: "Comprador", aliases: ["comprador"] },
  { key: "proprietario", label: "Proprietário", aliases: ["proprietario", "proprietário", "locador"] },
  { key: "vendedor", label: "Vendedor", aliases: ["vendedor"] },
] as const;

const buildPersonOptions = (): ContractVariableOption[] =>
  PERSON_ROLES.flatMap(role =>
    PERSON_FIELDS.map(field => ({
      key: `${role.key}.${field.key}`,
      label: `${role.label} > ${field.label}`,
      aliases: role.aliases.flatMap(roleAlias =>
        field.aliases.flatMap(fieldAlias => [
          `${fieldAlias} do ${roleAlias}`,
          `${fieldAlias} da ${roleAlias}`,
          `${roleAlias} ${fieldAlias}`,
        ])
      ),
    }))
  );

export const CONTRACT_VARIABLE_FIELD_OPTIONS: ContractVariableOption[] = [
  ...buildPersonOptions(),
  { key: "corretor.nome", label: "Corretor > Nome", aliases: ["nome do corretor", "corretor nome"] },
  { key: "corretor.email", label: "Corretor > E-mail", aliases: ["email do corretor", "e-mail do corretor"] },
  { key: "corretor.telefone", label: "Corretor > Telefone", aliases: ["telefone do corretor", "celular do corretor"] },
  { key: "corretor.creci", label: "Corretor > CRECI", aliases: ["creci do corretor", "creci"] },
  { key: "imovel.titulo", label: "Imóvel > Título", aliases: ["titulo do imovel", "título do imóvel"] },
  { key: "imovel.enderecoCompleto", label: "Imóvel > Endereço completo", aliases: ["endereco do imovel", "endereço do imóvel", "endereco completo do imovel", "endereço completo do imóvel"] },
  { key: "imovel.endereco", label: "Imóvel > Endereço", aliases: ["logradouro do imovel", "logradouro do imóvel"] },
  { key: "imovel.numero", label: "Imóvel > Número", aliases: ["numero do imovel", "número do imóvel"] },
  { key: "imovel.bairro", label: "Imóvel > Bairro", aliases: ["bairro do imovel", "bairro do imóvel"] },
  { key: "imovel.cidade", label: "Imóvel > Cidade", aliases: ["cidade do imovel", "cidade do imóvel"] },
  { key: "imovel.estado", label: "Imóvel > Estado", aliases: ["estado do imovel", "estado do imóvel", "uf do imovel", "uf do imóvel"] },
  { key: "imovel.cep", label: "Imóvel > CEP", aliases: ["cep do imovel", "cep do imóvel"] },
  { key: "imovel.valorVenda", label: "Imóvel > Valor de venda", aliases: ["valor de venda", "valor do imovel", "valor do imóvel"] },
  { key: "imovel.valorLocacao", label: "Imóvel > Valor de locação", aliases: ["valor de locacao do imovel", "valor de locação do imóvel"] },
  { key: "imovel.valorCondominio", label: "Imóvel > Valor do condomínio", aliases: ["condominio do imovel", "condomínio do imóvel", "valor do condominio", "valor do condomínio"] },
  { key: "imovel.valorIptu", label: "Imóvel > Valor do IPTU", aliases: ["valor do iptu", "iptu do imovel", "iptu do imóvel"] },
  { key: "locacao.valorAluguel", label: "Locação > Valor do aluguel", aliases: ["valor do aluguel", "valor da locacao", "valor da locação", "aluguel"] },
  { key: "locacao.valorCondominio", label: "Locação > Valor do condomínio", aliases: ["valor do condominio da locacao", "valor do condomínio da locação"] },
  { key: "locacao.dataInicio", label: "Locação > Data de início", aliases: ["data de inicio", "data de início", "inicio da locacao", "início da locação"] },
  { key: "locacao.dataFim", label: "Locação > Data de término", aliases: ["data de termino", "data de término", "fim da locacao", "fim da locação"] },
  { key: "locacao.prazo", label: "Locação > Prazo", aliases: ["prazo de locacao", "prazo de locação", "tempo de contrato"] },
  { key: "locacao.diaVencimento", label: "Locação > Dia de vencimento", aliases: ["dia de vencimento", "vencimento"] },
  { key: "locacao.indiceReajuste", label: "Locação > Índice de reajuste", aliases: ["indice de reajuste", "índice de reajuste", "reajuste"] },
  { key: "locacao.tempoReajuste", label: "Locação > Tempo de reajuste", aliases: ["tempo de reajuste", "periodo de reajuste", "período de reajuste", "periodicidade do reajuste"] },
  { key: "locacao.taxaAdministracao", label: "Locação > Taxa de administração", aliases: ["taxa de administracao", "taxa de administração", "taxa de adm", "taxa administrativa"] },
  { key: "locacao.diasUteisRepasse", label: "Locação > Dias úteis para repasse", aliases: ["dias uteis para repasse", "dias úteis para repasse", "dias de repasse", "prazo de repasse"] },
  { key: "locacao.multaRescisoria", label: "Locação > Multa rescisória", aliases: ["multa rescisoria", "multa rescisória", "multa por rescisao", "multa por rescisão", "multa contratual"] },
  { key: "locacao.observacoes", label: "Locação > Observações", aliases: ["observacoes da locacao", "observações da locação", "observacoes", "observações"] },
];

export function normalizeContractVariableLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export const CONTRACT_VARIABLE_FIELD_MAP: Record<string, string> =
  Object.fromEntries(
    CONTRACT_VARIABLE_FIELD_OPTIONS.flatMap(option => [
      [normalizeContractVariableLabel(option.label.split(">").at(-1) ?? option.label), option.key],
      ...option.aliases.map(alias => [normalizeContractVariableLabel(alias), option.key] as const),
    ])
  );

export function parseContractParticipantRoles(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ContractParticipantRole =>
      CONTRACT_PARTICIPANT_ROLES.includes(item as ContractParticipantRole)
    );
  } catch {
    return [];
  }
}

export function getContractVariableOptionsForRoles(
  roles: ContractParticipantRole[]
) {
  const roleSet = new Set(roles);
  if (roleSet.size === 0) return CONTRACT_VARIABLE_FIELD_OPTIONS;

  return CONTRACT_VARIABLE_FIELD_OPTIONS.filter(option => {
    const [prefix] = option.key.split(".");
    return roleSet.has(prefix as ContractParticipantRole);
  });
}
