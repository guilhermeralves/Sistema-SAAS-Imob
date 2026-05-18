# Visão Geral da Arquitetura

## Stack principal

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS 4
- React Query
- Radix UI

Backend:
- Node.js
- Express
- tRPC
- Drizzle ORM
- PostgreSQL

## Estrutura lógica

```text
Frontend (client/src)
        ↓
Hooks/API/tRPC
        ↓
Backend (server)
        ↓
Services / Business Rules
        ↓
Database (PostgreSQL + Drizzle)
```

## Responsabilidades

### client/
Responsável por:
- telas;
- componentes;
- experiência do usuário;
- formulários;
- consumo de APIs.

### server/
Responsável por:
- autenticação;
- autorização;
- regras de negócio;
- integração com banco;
- upload e mídia;
- APIs tRPC.

### shared/
Responsável por:
- tipos compartilhados;
- contratos frontend/backend;
- schemas comuns.

## Regras arquiteturais

- Frontend não deve conter regras críticas de permissão.
- Backend deve validar permissões.
- Shared não deve depender de browser ou Node específico.
- Evitar acoplamento excessivo entre módulos.
- Preferir composição e modularização.
