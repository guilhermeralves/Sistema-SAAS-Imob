---
description: Inicia uma nova funcionalidade do zero seguindo a arquitetura do Sistema-SAAS-Imob
argument-hint: <descrição da funcionalidade>
---

Você vai iniciar uma nova funcionalidade no Sistema-SAAS-Imob: **$ARGUMENTS**

Siga este processo (baseado em `AGENTS.md`). NÃO comece a editar código antes de entender o contexto.

## Fase 1 — Entender (antes de codar)
1. Leia `CLAUDE.md`/`AGENTS.md` e identifique qual módulo será afetado.
2. Leia a doc do módulo relacionado em `docs/` (ex.: `docs/modules/`, `docs/business-rules/permissions.md`).
3. Procure em `shared/` por tipos, schemas e contratos já existentes que possam ser reutilizados — **não crie formatos novos se já existir**.
4. Verifique se já existe função, hook, serviço, router ou componente semelhante.
5. Identifique impactos: banco de dados? permissões? telas existentes? testes?

## Fase 2 — Planejar e confirmar
Apresente um plano curto e objetivo cobrindo:
- arquivos que serão criados/alterados (por camada: `shared/` → `server/` → `client/`);
- impacto no banco (migração Drizzle necessária?);
- regra de permissão envolvida (qual papel: cliente/corretor/admin);
- se precisa criar/ajustar testes.

Se o escopo estiver ambíguo ou for grande, **pare e peça confirmação** antes de implementar. Se estiver claro e pequeno, siga.

## Fase 3 — Implementar (na ordem das camadas)
1. Criar/reutilizar schema/tipo em `shared/` quando houver comunicação frontend-backend.
2. Implementar a regra principal no backend (`server/`), validando permissões no backend (nunca só no frontend).
3. Expor via router tRPC seguindo o padrão existente (não criar REST novo sem necessidade clara).
4. Criar hook/cliente no frontend se o projeto já seguir esse padrão.
5. Criar componente visual separado da lógica complexa.

Faça alterações pequenas, coesas e localizadas. Não use `any` sem justificativa forte.

## Fase 4 — Validar e registrar
1. Rode `pnpm check` (e `pnpm test` se houver testes relevantes).
2. Atualize `todo.md` marcando a funcionalidade e seu status (`[x]`/`[~]`/`[ ]`).
3. Atualize a doc do módulo em `docs/` se a arquitetura mudou.
4. Resuma o que foi alterado, onde e por quê.

Lembre: o Sistema-SAAS-Imob vai virar SaaS multi-imobiliária no futuro — ao desenhar dados, considere isolamento por tenant quando fizer sentido.
