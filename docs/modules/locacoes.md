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
- a proposta avanca para `status = "boletos_pendentes"` e `currentStep = "boletos_pendentes"`;
- o codigo entra no rodape dos contratos de forma derivada na exibicao (cartao, banner e dialogo de edicao), sem alterar o `reviewedText` aprovado.

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
- A aprovacao do ultimo contrato pendente gera o codigo de referencia da proposta e avanca para a etapa de boletos.
- O codigo de referencia e unico por proposta e nao e regerado se ja existir.
- O codigo de referencia compoe o rodape dos contratos, derivado na exibicao a partir de `rentalProposals.referenceCode`.
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
- `client/src/pages/admin/AdminRentalProposalsPanel.tsx`: lista e acompanhamento das etapas.
- `client/src/pages/admin/AdminContractsPanel.tsx`: cadastro de modelos de contrato filtrado pelo modulo administrativo.
- `server/routers.ts`: validacoes e endpoints tRPC de propostas/modelos.
- `server/db.ts`: persistencia de propostas, participantes e modelos escolhidos.
- `drizzle/schema.ts`: schema Drizzle das entidades de locacao.
- `shared/contract-variables.ts`: catalogo compartilhado de variaveis reconhecidas em modelos de contrato.
- `shared/contract-reference.ts`: geracao do codigo de referencia da proposta e do rodape derivado dos contratos.

## Impactos

- Permissoes: fluxo administrativo via `adminProcedure`; corretores e clientes nao acessam esta etapa.
- Banco de dados: nova tabela de vinculo `rentalProposalContractTemplates`.
- Banco de dados: tabela `rentalProposalGeneratedContracts` armazena os textos gerados para revisao.
- Banco de dados: `contractTemplates` guarda `contractKind` e `participantRoles` para classificar modelos e filtrar variaveis por nicho.
- API: mutations `rentalProposals.updateContractTemplatesInReview` (escolhe/atualiza modelos e sincroniza contratos por diff), `rentalProposals.updateGeneratedContractText`, `rentalProposals.regenerateGeneratedContract`, `rentalProposals.deleteGeneratedContract` e `rentalProposals.approveGeneratedContract`; query `rentalProposals.pendingForProperty` bloqueia nova proposta para imovel ja vinculado.
- Frontend: a tela de detalhes usa cards de etapa colapsaveis (auto-minimizam ao concluir); a escolha de modelos e um checkbox unico de modelos de locacao que gera/atualiza/remove contratos, e cada contrato gerado pode ser editado, regerado, aprovado ou excluido enquanto a proposta nao estiver ativa.
- Banco de dados: `rentalProposals` ganha `referenceCode` para o codigo de referencia gerado na aprovacao final.
- API: `rentalProposals.approveGeneratedContract` passa a retornar `referenceCode` e, na ultima aprovacao, gera o codigo e avanca a proposta para `boletos_pendentes`.
- Fluxo futuro: a proxima etapa (19) e gerar os boletos de todo o periodo de vigencia da proposta ja com codigo de referencia.
