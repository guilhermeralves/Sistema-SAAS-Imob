# Modulo de Locacoes

## Objetivo

Centralizar o processo administrativo de abertura de uma locacao, desde a proposta inicial ate a conversao em contrato/locacao ativa.

## Sequencia completa do fluxo

1. Usuario inicia uma Nova Locacao.
2. Sistema abre a pagina de detalhes da proposta.
3. Usuario escolhe um imovel de locacao.
4. Ao escolher o imovel, o sistema cria o contexto com os dados do imovel.
5. Corretor responsavel vem preenchido automaticamente com o corretor do imovel, mas pode ser alterado.
6. Proprietarios vinculados ao imovel aparecem automaticamente na proposta.
7. Usuario pode remover proprietarios so da proposta, sem alterar o cadastro do imovel.
8. Usuario pode revincular proprietarios do imovel ou cadastrar novo proprietario.
9. Usuario escolhe um ou mais locatarios entre usuarios do tipo cliente.
10. Usuario confirma os dados dos proprietarios e locatarios.
11. Usuario informa dados da locacao: tempo em meses, indice de reajuste, valor da locacao, data de inicio, dia de vencimento e observacoes.
12. Se o imovel tiver condominio, aparece o campo Valor do Condominio, preenchido pelo cadastro quando existir e editavel manualmente.
13. Usuario salva a proposta como Rascunho.
14. Sistema solicita a escolha dos modelos de contrato que serao usados.
15. Sistema cruza os dados da proposta com as variaveis dos modelos de contrato.
16. Administrativo valida manualmente cada contrato gerado, podendo editar o texto antes de aprovar.
17. Apos aprovar os contratos, o sistema gera o codigo de referencia da proposta.
18. Codigo de referencia entra tambem no rodape dos contratos.
19. Sistema gera os boletos de todo o periodo de vigencia.
20. Aba Boletos recebe uma solicitacao pendente, com preview em carrossel.
21. Administrativo pode editar boletos em lote ou individualmente.
22. Proposta fica aguardando comprovantes das primeiras parcelas do seguro fianca e seguro incendio.
23. Administrativo confirma o recebimento dos comprovantes.
24. Sistema aguarda assinaturas digitais, com preferencia futura pela plataforma GOV.BR.
25. Proposta entra na etapa de transferencia de titularidade de contas: energia, agua, gas etc.
26. Locatario envia os comprovantes de transferencia.
27. Apos isso, e gerada uma vistoria pendente na aba Vistorias.
28. Com o laudo recebido, locatario e proprietario assinam validando o estado do imovel.
29. Sistema marca/cria evento ou tarefa de entrega das chaves, mencionando o corretor responsavel.
30. Sistema envia e-mail ao locatario com documento de entrega de chaves e boas-vindas.
31. Apos a entrega, o corretor conclui a entrega de chaves no sistema.
32. Proposta sai de Propostas de Locacao, vira contrato/locacao Ativa e aparece em Locacoes Ativas.

## Estado implementado

O rascunho inicial e salvo em `rentalProposals` com:

- `status = "rascunho"`;
- `currentStep = "modelos_contrato"`;
- `contextSnapshot` com imovel, proprietarios, corretor, locatarios e dados da locacao.

Os modelos de contrato escolhidos para uma proposta sao persistidos em `rentalProposalContractTemplates`.

Na etapa 15, os contratos gerados a partir dos modelos escolhidos sao persistidos em `rentalProposalGeneratedContracts` com:

- texto gerado;
- texto revisavel inicialmente igual ao texto gerado;
- valores de variaveis substituidas;
- lista de variaveis pendentes ou nao reconhecidas;
- status inicial `em_revisao`.

Na etapa 16, o administrativo revisa manualmente cada registro de `rentalProposalGeneratedContracts`:

- pode editar `reviewedText`;
- salvar uma edicao retorna o contrato para status `em_revisao`;
- pode aprovar cada contrato individualmente;
- ao aprovar, o contrato recebe `status = "aprovado"`, `approvedAt` e `approvedByUserId`.

Nas etapas 17 e 18, quando todos os contratos da proposta sao aprovados:

- o sistema gera o codigo de referencia e grava em `rentalProposals.referenceCode`;
- o formato e `LOC-<ano de geracao>-<id da proposta com 4 digitos>` (ex.: `LOC-2026-0042`), derivado pelo helper compartilhado `shared/contract-reference.ts`;
- a geracao e idempotente: se a proposta ja tem `referenceCode`, nao gera outro;
- a proposta avanca para `status = "boletos_pendentes"` e, em seguida, os boletos
  do periodo sao gerados automaticamente, levando a proposta direto para
  `status = "seguros_pendentes"` (ver etapa 19) — sem acao manual intermediaria;
- o codigo entra no rodape dos contratos de forma derivada na exibicao (cartao, banner e dialogo de edicao), sem alterar o `reviewedText` aprovado.

Apos a aprovacao, cada contrato gerado exibe botoes de download no card de modelos/contratos, preservando o layout original do modelo Word:

- "Baixar Word": preenche o `.docx` original do modelo (`contractTemplates.originalFileData`) com os valores ja substituidos do contrato (`variableValues`, chaveado por `[Rotulo]`), preservando fontes, tabelas e formatacao; placeholders sem valor permanecem visiveis como `[Rotulo]`;
- "Baixar PDF": so aparece quando o servidor tem um conversor (LibreOffice/soffice headless); converte o `.docx` preenchido em PDF mantendo o layout. Sem conversor, o usuario baixa o Word e usa "Salvar como PDF";
- o preenchimento usa `docxtemplater` + `pizzip` com os colchetes `[ ]` como delimitadores, resolvendo placeholders mesmo quando o Word os quebra em varios runs;
- as edicoes de texto livre do passo de revisao NAO sao refletidas no documento fiel (apenas os valores das variaveis sobre o modelo original).

Na etapa 19, a geracao dos boletos e **automatica**: ao aprovar o ultimo contrato,
`reconcileRentalProposalContractStage` gera o codigo de referencia e, na sequencia,
`autoGenerateRentalProposalBoletos` monta o cronograma e avanca a proposta para
`seguros_pendentes`. O card Boletos da tela de detalhes mantem um botao manual de
geracao apenas como fallback (propostas legadas que ficaram em `boletos_pendentes`):

- a geracao monta uma parcela por mes de vigencia (`leaseTermMonths`), com competencia a partir do mes de inicio (`startDate`) e vencimento no `dueDay` informado, fazendo "clamp" quando o mes nao tem o dia (ex.: 31 em fevereiro);
- o valor inicial de cada boleto replica `rentAmount` + `condominiumAmount` da proposta; `extraAmount`/`extraDescription` permitem encargos avulsos (IPTU, multas etc.);
- a geracao e idempotente: se ja existem boletos, nao duplica;
- a geracao automatica e best-effort: se o cronograma nao puder ser montado, a proposta permanece em `boletos_pendentes` para geracao manual, sem quebrar a aprovacao do contrato;
- gerar (auto ou manual) leva a proposta a `status = "seguros_pendentes"` e `currentStep = "seguros_pendentes"`.

Nas etapas 20 e 21, a gestao dos boletos vive na sub-pagina `Administrativo > Locacoes > Boletos` (independente da etapa da proposta):

- a lista mostra um conjunto por proposta com boletos, exibindo o codigo de referencia, o imovel/locatario, o total e o status do "boleto atual" antes de entrar nos detalhes;
- o status do boleto atual e derivado por `shared/rental-boletos.ts`: `Pago` (`paidAt` preenchido, futuramente por integracao bancaria), `Em aberto` (ainda nao venceu), `Atrasado` (venceu ha ate 2 dias) e `Vencido` (venceu ha mais de 2 dias);
- o "boleto atual" e o boleto em aberto mais antigo ja vencido; sem vencidos, o proximo a vencer; se todos pagos, a ultima parcela;
- em "Detalhes" o administrativo edita boletos em lote (todos ou um subconjunto selecionado) e individualmente, aprova cada boleto apos validacao manual das cobrancas, aprova todos de uma vez, da baixa manual de pagamento e estorna;
- editar um boleto recalcula o total e o devolve para `pendente` (revalidacao);
- e possivel regerar todo o cronograma enquanto nenhum boleto tiver sido aprovado.

Nas etapas 22 e 23 (Seguros), ao a proposta entrar em `seguros_pendentes` o helper
`initiateRentalInsuranceStage` cria duas linhas em `rentalProposalInsurances`
(`fianca` e `incendio`), marca `requestedAt` e envia ao locatario um e-mail
solicitando os comprovantes das primeiras parcelas (template
`rental-insurance-request`, best-effort). A gestao acontece no card "Seguros" da
tela de detalhes:

- cada seguro pode ser **confirmado** (com seguradora, apolice, valor e
  comprovante opcional anexado como base64) ou **dispensado** (quando nao se
  aplica, ex.: locacao com fiador no lugar de seguro fianca);
- o comprovante e guardado em `proofData` (data URL base64) e baixado por uma
  query admin-only (`insuranceProof`), no mesmo padrao do download de contratos —
  sem nova rota de midia;
- ha um botao para **reenviar o e-mail** de solicitacao e um **link wa.me** com
  mensagem pronta (o admin clica e envia pelo proprio WhatsApp; nao ha integracao
  automatica de WhatsApp);
- confirmar/dispensar **ambos** os seguros avanca a proposta para
  `assinaturas_pendentes`; reabrir um seguro ja resolvido retorna a proposta para
  `seguros_pendentes`.

## Regras de negocio

- A escolha de modelos de contrato e feita por proposta.
- Selecionar ou remover modelos em uma proposta nao altera os modelos globais cadastrados.
- A proposta deve ter ao menos um modelo escolhido para continuar o fluxo de contratos.
- A selecao de modelos so pode ocorrer quando `currentStep` for `modelos_contrato`.
- Propostas de locacao so podem vincular modelos com `contractKind = "locacao"`.
- A geracao dos contratos so pode ocorrer quando `currentStep` for `modelos_contrato`.
- Ao gerar os contratos, a proposta avanca para `currentStep = "contratos_em_revisao"` e `status = "contratos_em_revisao"`.
- Variaveis reconhecidas sao substituidas pelos dados do `contextSnapshot`; variaveis sem mapeamento ou sem valor permanecem pendentes para revisao manual.
- A validacao manual ocorre contrato a contrato.
- Contrato gerado com texto revisado vazio nao pode ser aprovado.
- A aprovacao do ultimo contrato pendente gera o codigo de referencia, gera automaticamente os boletos do periodo e avanca a proposta direto para a etapa de seguros (`seguros_pendentes`).
- O codigo de referencia e unico por proposta e nao e regerado se ja existir.
- O codigo de referencia compoe o rodape dos contratos, derivado na exibicao a partir de `rentalProposals.referenceCode`.
- A geracao de boletos ocorre automaticamente na aprovacao do ultimo contrato (helper `autoGenerateRentalProposalBoletos`); o botao manual permanece apenas como fallback quando `currentStep = "boletos_pendentes"` e a proposta ja tem `referenceCode`. Em ambos os casos, gerar avanca a proposta direto para `seguros_pendentes`.
- A gestao posterior dos boletos (regerar/editar/aprovar/baixar pagamento) fica disponivel sempre que a proposta tiver `referenceCode`, na sub-pagina de Boletos, sem alterar a etapa da proposta; regerar e bloqueado se houver boleto aprovado.
- O total de um boleto e sempre `rentAmount + condominiumAmount + extraAmount` (recalculado no backend a cada edicao).
- Reajustes (IGP-M etc.) nao sao aplicados automaticamente na geracao, pois o indice do periodo ainda nao e conhecido; sao lancados depois via edicao em lote.
- A aprovacao e uma validacao administrativa por boleto (`pendente` -> `aprovado`), individual ou em massa, e nao altera a etapa da proposta.
- O status temporal/pagamento exibido e derivado das datas e de `paidAt`: `pago`, `em_aberto`, `atrasado` (ate 2 dias apos vencer) e `vencido` (mais de 2 dias). `paidAt` sera preenchido por integracao bancaria; ha tambem baixa/estorno manual.
- O dicionario de variaveis dos modelos usa o catalogo compartilhado `shared/contract-variables.ts`.
- O catalogo deve expor campos cadastrais completos de envolvidos como locatario, comprador, proprietario, vendedor e corretor.
- Labels do dicionario podem ser amigaveis em portugues, mas a `key` salva no modelo deve usar o mesmo nome tecnico do campo real do sistema, prefixado pelo papel no contrato. Exemplo: `Locatario > Profissao` salva `locatario.profession`, e nao `locatario.profissao`.
- Cada modelo de contrato guarda `contractKind` e `participantRoles` para definir tipo e envolvidos do documento.
- O tipo e os envolvidos do modelo sao definidos automaticamente pelo modulo administrativo onde o modelo e criado ou editado.
- Em `Administrativo > Locacoes > Contratos`, modelos sao salvos como `contractKind = "locacao"` e recebem os envolvidos padrao de locacao: locatario, proprietario, corretor, imovel e locacao.
- Em `Administrativo > Vendas > Contratos`, modelos sao salvos como `contractKind = "venda"` e recebem os envolvidos padrao de venda: comprador, vendedor, corretor e imovel.
- O dicionario de variaveis do modelo e filtrado pelo nicho da pagina, evitando oferecer variaveis de venda em contratos de locacao e variaveis de locacao em contratos de venda.
- Campos sem valor preenchido na proposta permanecem como variaveis pendentes durante a geracao/revisao do contrato; a avaliacao de "nao informado" depende da proposta concreta, nao apenas do modelo global.
- O backend deve validar a existencia da proposta e dos modelos escolhidos.
- O acesso ao fluxo de propostas de locacao permanece restrito ao papel `administrativo`.

## Arquivos principais

- `client/src/pages/AdminRentalProposalNew.tsx`: entrada da Nova Locacao.
- `client/src/pages/AdminRentalProposalDetails.tsx`: detalhes da proposta existente.
- `client/src/pages/admin/RentalProposalForm.tsx`: dados iniciais e selecao de modelos da proposta.
- `client/src/pages/admin/AdminRentalProposalsPanel.tsx`: lista, acompanhamento das etapas e exclusao de propostas.
- `client/src/pages/admin/AdminRentalBoletosPanel.tsx`: sub-pagina Boletos (lista de conjuntos por proposta e detalhes com gestao em lote/individual).
- `client/src/pages/admin/AdminContractsPanel.tsx`: cadastro de modelos de contrato filtrado pelo modulo administrativo.
- `server/routers.ts`: validacoes e endpoints tRPC de propostas/modelos.
- `server/db.ts`: persistencia de propostas, participantes e modelos escolhidos.
- `drizzle/schema.ts`: schema Drizzle das entidades de locacao.
- `shared/contract-variables.ts`: catalogo compartilhado de variaveis reconhecidas em modelos de contrato.
- `shared/contract-reference.ts`: geracao do codigo de referencia da proposta e do rodape derivado dos contratos.
- `server/contract-docx.ts`: preenche o `.docx` original do modelo com os valores das variaveis (docxtemplater + pizzip), preservando o layout do Word.
- `server/docx-to-pdf.ts`: conversao opcional do `.docx` preenchido para PDF via LibreOffice/soffice headless (indisponivel quando nao ha conversor instalado).
- `shared/rental-boletos.ts`: regra compartilhada de cronograma de boletos (competencia, vencimento com clamp e total).

## Impactos

- Permissoes: fluxo administrativo via `adminProcedure`; corretores e clientes nao acessam esta etapa.
- Banco de dados: nova tabela de vinculo `rentalProposalContractTemplates`.
- Banco de dados: tabela `rentalProposalGeneratedContracts` armazena os textos gerados para revisao.
- Banco de dados: `contractTemplates` guarda `contractKind` e `participantRoles` para classificar modelos e filtrar variaveis por nicho.
- API: mutations `rentalProposals.updateContractTemplatesInReview` (escolhe/atualiza modelos e sincroniza contratos por diff), `rentalProposals.updateGeneratedContractText`, `rentalProposals.regenerateGeneratedContract`, `rentalProposals.deleteGeneratedContract` e `rentalProposals.approveGeneratedContract`; query `rentalProposals.pendingForProperty` bloqueia nova proposta para imovel ja vinculado.
- Frontend: a tela de detalhes usa cards de etapa colapsaveis (auto-minimizam ao concluir); a escolha de modelos e um checkbox unico de modelos de locacao que gera/atualiza/remove contratos, e cada contrato gerado pode ser editado, regerado, aprovado ou excluido enquanto a proposta nao estiver ativa.
- Banco de dados: `rentalProposals` ganha `referenceCode` para o codigo de referencia gerado na aprovacao final.
- API: `rentalProposals.approveGeneratedContract` passa a retornar `referenceCode` e, na ultima aprovacao, gera o codigo e avanca a proposta para `boletos_pendentes`.
- API: query `rentalProposals.generatedContractDocument` (`format: "docx" | "pdf"`) retorna `{ fileName, contentType, dataUrl }` do contrato aprovado preenchendo o `.docx` original; query `rentalProposals.documentExportCapabilities` informa se o servidor consegue gerar PDF. Botoes "Baixar Word" (sempre) e "Baixar PDF" (quando ha conversor) no card de contratos.
- Dependencias: `docxtemplater` e `pizzip` (preenchimento de .docx). Conversao para PDF usa LibreOffice/soffice headless quando disponivel (env `SOFFICE_PATH` opcional). O gerenciador de pacotes do projeto e o pnpm.
- Banco de dados: nova tabela `rentalProposalBoletos` (uma linha por parcela) com competencia, vencimento, componentes de valor, total, status de validacao, `paidAt` e auditoria de aprovacao.
- API: mutations `rentalProposals.generateBoletos` (gera e avanca para `seguros_pendentes`), `regenerateBoletos`, `updateBoleto`, `updateBoletosBatch`, `approveBoleto`, `approveAllBoletos` e `setBoletoPaid`; query `rentalProposals.boletoSets` lista os conjuntos; `getById` passa a retornar `boletos`.
- Frontend: card Boletos em `RentalProposalForm` reduzido a gerar (com preview) + atalho para a aba Boletos; a gestao (lista de conjuntos, edicao em lote/individual, aprovacao e baixa de pagamento) fica em `AdminRentalBoletosPanel`, na aba Boletos de Locacoes (deep-link via `?tab=Boletos`).
- Migracao: `drizzle/pg/0030_rental_proposal_boletos.sql` e patches idempotentes `2026-06-07_rental_proposal_boletos` e `2026-06-07_rental_proposal_boletos_paid_at` em `scripts/manual-db-sync.mjs`.
- Banco de dados: nova tabela `rentalProposalInsurances` (uma linha por proposta+tipo: `fianca`/`incendio`) com seguradora, apolice, valor, comprovante em base64, status (`pendente`/`confirmado`/`dispensado`) e auditoria. Migracao via patch idempotente `2026-06-27_rental_proposal_insurances` em `scripts/manual-db-sync.mjs`.
- API: query `rentalProposals.insurances` e `insuranceProof`; mutations `confirmInsurance` (anexo opcional), `dispenseInsurance`, `reopenInsurance` e `resendInsuranceRequest`; `getById` passa a retornar `insurances`. A aprovacao do ultimo contrato agora gera boletos e dispara a solicitacao de seguros (`autoGenerateRentalProposalBoletos` + `initiateRentalInsuranceStage`).
- E-mail: template `server/_core/email/templates/rental-insurance-request.ts` e funcao `sendRentalInsuranceRequestEmail` em `server/_core/email/service.ts`. Em dev o provider padrao e `preview` (grava HTML em `tmp/email-previews`); envio real exige `EMAIL_PROVIDER=smtp` + credenciais.
- Frontend: card "Seguros" em `RentalProposalForm` com dois blocos (`RentalInsuranceBlock`), botoes de reenviar e-mail e link wa.me.
- Fluxo futuro: a proxima etapa (24) e aguardar as assinaturas digitais (preferencia futura por GOV.BR).
