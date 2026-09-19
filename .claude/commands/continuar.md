---
description: Retoma uma funcionalidade já iniciada, identificando onde parou
argument-hint: [nome do módulo/feature, ex.: locacoes]
---

Você vai **retomar** uma funcionalidade já em andamento no Sistema-SAAS-Imob.
Alvo (se informado): **$ARGUMENTS** — se vazio, descubra o item em andamento mais relevante.

## Fase 1 — Descobrir onde parou
1. Leia `todo.md` e localize itens marcados `[~]` (em andamento) ou `[ ]` (pendentes) relacionados ao alvo.
2. Rode `git status` e `git diff --stat HEAD` para ver trabalho não commitado no working tree.
3. Leia a doc do módulo correspondente em `docs/modules/` (ex.: `docs/modules/locacoes.md`) — compare o "estado implementado" com o código real (migrações, routers, telas). A doc pode estar atrás do código.
4. Leia os arquivos reais da feature (schema, router, páginas) para confirmar o ponto exato de parada.

## Fase 2 — Propor o próximo passo
Apresente de forma curta:
- o que já está pronto;
- qual é o **próximo passo concreto** (uma etapa, não a feature inteira);
- arquivos que serão tocados e se há impacto em banco/permissões.

Confirme comigo se o escopo for grande; siga direto se for um passo pequeno e claro.

## Fase 3 — Implementar e validar
1. Implemente seguindo as camadas (`shared/` → `server/` → `client/`), validando permissões no backend.
2. Reutilize tipos/contratos de `shared/` e padrões existentes; mudanças pequenas e coesas.
3. Rode `pnpm check` (e testes se aplicável).
4. Atualize `todo.md` (mova o item de `[~]`/`[ ]` conforme o avanço) e a doc do módulo se mudou a arquitetura.
5. Resuma o que avançou e qual o próximo passo sugerido para a próxima sessão.
