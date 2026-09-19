# Documentação do Projeto Sistema-SAAS-Imob

Esta pasta organiza o contexto do projeto para humanos e agentes de IA.

Objetivo principal:

- reduzir perda de contexto;
- facilitar manutenção do sistema;
- orientar o Codex antes de alterar código;
- separar regras de negócio, arquitetura, fluxos e módulos.

## Estrutura

```text
docs/
  architecture/      # Visão técnica e decisões arquiteturais
  business-rules/    # Regras de negócio imobiliárias
  flows/             # Fluxos de uso e processos do sistema
  modules/           # Documentação por módulo funcional
```

## Modulos documentados

- `docs/modules/crm.md`: leads, corretores, clientes e acompanhamento comercial.
- `docs/modules/locacoes.md`: propostas de locacao, escolha de modelos e caminho ate locacao ativa.

## Como usar com Codex

Antes de pedir uma alteração grande, diga ao Codex para ler:

1. `AGENTS.md`
2. o arquivo de documentação relacionado ao módulo alterado
3. os arquivos reais de código relacionados

Exemplo:

```text
Leia AGENTS.md, docs/business-rules/permissions.md e docs/modules/crm.md. Depois implemente a regra X no CRM.
```
