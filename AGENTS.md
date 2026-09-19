# AGENTS.md — Guia de contexto para agentes de IA

Este arquivo orienta agentes de IA, como Codex, Cursor, Claude Code ou ChatGPT, a trabalhar neste projeto com mais consistência, menor risco de quebrar funcionalidades existentes e melhor entendimento da arquitetura.

## 0. Identidade visual (LEIA ANTES DE CRIAR QUALQUER TELA)

O sistema tem uma identidade visual **cinza-neutro com acento verde emerald** — nada de azul, roxo ou slate tintado. Qualquer tela nova DEVE seguir estas regras. Elas evitam o retrabalho de "arrumar cor depois".

**Paleta:**
- Fundo do site: `bg-background` (cinza neutro claro no light, cinza escuro neutro no dark).
- Cards: `bg-card` + `border-border` (nunca `bg-white`, `bg-white/90`, `bg-slate-50` etc.).
- Texto: `text-foreground` para corpo, `text-muted-foreground` para secundário.
- Botão primário: `<Button>` padrão do shadcn — já resolve pra emerald via `--primary`.
- Acento/destaque: `bg-emerald-700` / `text-emerald-700` (ou `-600` / `-800`).
- **Nunca use** `bg-primary` esperando azul, `text-blue-*`, `text-sky-*`, `bg-blue-*`, `bg-sky-*` sem motivo explícito. O primário é emerald.
- **Nunca use** `text-slate-950`, `text-slate-900` etc. em vez de `text-foreground`. Slate tem tinta azul; foreground é neutro.

**Fundos hardcoded proibidos:**
- `bg-white`, `bg-white/70`, `bg-white/80`, `bg-white/90` → use `bg-card` ou `bg-background`.
- `bg-slate-50`, `bg-slate-100` → use `bg-muted` ou `bg-accent`.
- `bg-[#111827]`, `bg-[#0f172a]`, `bg-slate-900`, `bg-slate-950` (tons slate escuros) — nem no dark.
- Gradientes com `rgba(15,23,42,...)` (slate-900), `rgba(30,41,59,...)` (slate-800), `rgba(223,232,226,...)` (verde-creme) — use tons neutros.
- Sombras com `rgba(15,23,42,X)` — trocar por `rgba(0,0,0,X)` para tint neutra.

**Bordas:**
- `border-border` (padrão) — respeita a paleta.
- Nunca `border-white/*` ou `border-slate-*` diretamente em telas novas.

**Layout padrão de uma tela nova:**

```tsx
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MinhaPagina() {
  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Título</h1>
          <p className="text-sm text-muted-foreground">Descrição breve</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Seção</CardTitle>
            <CardDescription>Contexto da seção</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Sem bg-white, sem shadow hardcoded, sem rounded-[28px] */}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
```

**Endereço em qualquer formulário:**
Todos os cadastros que pedem endereço DEVEM usar `<AddressFields>` — ele já faz o autocomplete via CEP e mantém os campos padronizados:

```tsx
import AddressFields, { type AddressValue } from "@/components/AddressFields";
const [addr, setAddr] = useState<AddressValue>({});
<AddressFields value={addr} onChange={setAddr} required />
```

**Regra de ouro:** se você se pegar copiando classes de páginas antigas (Admin.tsx, Dashboard.tsx, AdminUsers.tsx etc.), pare — elas têm hardcodes legados. Use apenas tokens semânticos (`bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`) e o `<Button>` padrão do shadcn.

## 1. Visão geral do projeto

O projeto `Sistema-SAAS-Imob` é uma plataforma imobiliária construída com:

- Frontend em React, TypeScript, Vite e Tailwind CSS 4.
- Backend em Node.js, Express e tRPC.
- Banco de dados PostgreSQL usando Drizzle ORM.
- Código compartilhado entre frontend e backend em `shared/`.
- Componentes de interface baseados em Radix UI e bibliotecas auxiliares.

O objetivo funcional do sistema é atender uma operação imobiliária, incluindo imóveis, usuários, leads, CRM, permissões, mídia de imóveis e possíveis integrações futuras.

## 2. Comandos principais

Antes de finalizar qualquer alteração, o agente deve preferencialmente validar o projeto com:

```bash
pnpm check
pnpm test
pnpm build
```

Comandos disponíveis no `package.json`:

```bash
pnpm dev              # inicia ambiente de desenvolvimento
pnpm build            # build frontend + bundle backend
pnpm start            # inicia versão de produção
pnpm check            # valida TypeScript
pnpm format           # formata o projeto
pnpm test             # executa testes
pnpm db:push          # gera e aplica migrações Drizzle
pnpm db:manual:sync   # sincronização manual de banco
pnpm images:migrate   # migração de imagens de imóveis
```

## 3. Estrutura mental do projeto

Use esta separação ao analisar ou modificar código:

```text
client/      # Frontend React/Vite
server/      # Backend Express/tRPC, rotas, contexto, serviços
shared/      # Tipos, schemas e contratos compartilhados
drizzzle/    # Schema e migrações do banco de dados
scripts/     # Scripts auxiliares de manutenção/migração
```

Observação: se houver divergência entre esta visão e a estrutura real do repositório, o agente deve priorizar a estrutura real dos arquivos e atualizar esta documentação.

## 4. Regras de engenharia de contexto

Ao receber uma tarefa, o agente deve seguir este processo:

1. Identificar o módulo afetado.
2. Ler os arquivos diretamente relacionados antes de editar.
3. Procurar tipos, schemas e contratos em `shared/` antes de criar novos formatos.
4. Verificar se já existe função, hook, serviço ou componente semelhante.
5. Fazer alterações pequenas, coesas e localizadas.
6. Rodar validações quando possível.
7. Explicar o que foi alterado, onde foi alterado e por quê.

Evite mudanças grandes e genéricas sem necessidade.

## 5. Regras de modularização

Cada funcionalidade deve ter responsabilidade clara.

### Frontend

No frontend, prefira separar:

- páginas/telas;
- componentes reutilizáveis;
- hooks;
- chamadas de API;
- validações/formulários;
- tipos de UI.

Evite colocar regras de negócio pesadas diretamente dentro de componentes visuais.

### Backend

No backend, prefira separar:

- roteadores tRPC;
- serviços de domínio;
- acesso a banco;
- validações;
- autenticação/autorização;
- integrações externas;
- jobs/agendadores.

Evite colocar muita lógica diretamente no arquivo de entrada do servidor.

### Shared

Use `shared/` para contratos usados dos dois lados:

- tipos de entidades;
- schemas de validação;
- enums;
- regras comuns que não dependem de browser nem de Node específico.

Não coloque código com dependência de DOM, Express, banco ou filesystem em `shared/`.

## 6. Convenções importantes

- O TypeScript está configurado com `strict: true`. Não usar `any` sem justificativa forte.
- Usar imports com alias quando fizer sentido:
  - `@/` para `client/src/`
  - `@shared/` para `shared/`
- Não duplicar tipos entre frontend e backend se eles puderem viver em `shared/`.
- Não alterar schemas do banco sem entender impacto em migrações e dados existentes.
- Não criar rotas REST novas se a funcionalidade já segue padrão tRPC, salvo necessidade clara.
- Não expor segredos, tokens, chaves ou dados sensíveis no código.

## 7. Contexto de domínio imobiliário

As regras de negócio devem considerar os papéis principais:

- Cliente: usuário comum, normalmente pode visualizar imóveis e interagir com formulários.
- Corretor: pode gerenciar seus próprios leads e cadastrar imóveis conforme permissão definida.
- Admin: pode acessar e gerenciar usuários, imóveis, leads e configurações gerais.

Regras importantes esperadas:

- Corretores não devem acessar leads de outros corretores sem permissão.
- Admin deve ter visão global.
- Operações sensíveis devem validar permissão no backend, não apenas na interface.
- Leads podem ter origem em site próprio, campanhas pagas, portais imobiliários e integrações futuras.

## 8. Fluxo recomendado para tarefas do Codex

Para cada solicitação, o Codex deve responder mentalmente a estas perguntas antes de editar:

```text
Qual módulo estou alterando?
Quais arquivos definem os tipos e contratos dessa funcionalidade?
Existe regra de permissão envolvida?
Existe impacto no banco?
Existe impacto em telas existentes?
Preciso criar teste ou ajustar teste existente?
```

Depois disso, deve editar apenas os arquivos necessários.

## 9. Padrões para novas funcionalidades

Ao criar uma nova funcionalidade:

1. Criar ou reutilizar schema/tipo em `shared/` quando houver comunicação frontend-backend.
2. Implementar regra principal no backend.
3. Expor via router tRPC ou padrão já existente.
4. Criar hook/cliente no frontend se o projeto já seguir esse padrão.
5. Criar componente visual separado da lógica complexa.
6. Validar permissões no backend.
7. Atualizar documentação se a funcionalidade mudar a arquitetura.

## 10. Banco de dados e Drizzle

O Drizzle usa PostgreSQL e depende da variável `DATABASE_URL`.

Antes de mexer em banco:

- revisar `drizzle/schema.ts`;
- entender relações existentes;
- evitar renomear colunas/tabelas sem migração segura;
- preferir alterações incrementais;
- verificar se scripts de migração precisam ser atualizados.

## 11. Imagens e arquivos de imóveis

O servidor possui lógica específica para servir imagens de imóveis por rotas `/api/media/properties/...`.

Ao mexer em imagens:

- verificar funções relacionadas a upload, variantes e paths;
- manter proteções de acesso e headers de segurança;
- não expor diretórios internos diretamente;
- respeitar variantes como `large` e `thumb` quando existirem.

## 12. Autenticação e autorização

Antes de alterar login, sessão ou permissões:

- revisar contexto tRPC;
- revisar middlewares/autorizadores existentes;
- revisar onde o usuário atual é carregado;
- garantir que validações críticas aconteçam no backend.

Nunca confiar apenas em ocultar botões no frontend.

## 13. Como pedir tarefas melhores ao Codex

Use prompts objetivos e com escopo fechado.

Exemplo bom:

```text
Analise os arquivos relacionados ao módulo de leads/CRM. Depois implemente uma regra para que usuários com papel corretor vejam apenas leads atribuídos a eles, mantendo admin com acesso total. Antes de editar, identifique os arquivos afetados. Ao final, rode pnpm check se possível.
```

Exemplo ruim:

```text
Melhore o CRM inteiro.
```

## 14. Checklist antes de finalizar uma alteração

- A alteração ficou limitada ao módulo correto?
- O TypeScript continua válido?
- As permissões foram tratadas no backend?
- O frontend não duplicou regra crítica?
- Não foram criados tipos duplicados?
- Não foram expostos dados sensíveis?
- A documentação precisa ser atualizada?

## 15. Prioridade ao trabalhar neste projeto

Ao tomar decisões, priorize nesta ordem:

1. Segurança e integridade dos dados.
2. Regras de negócio imobiliárias.
3. Clareza arquitetural.
4. Baixo acoplamento entre módulos.
5. Facilidade de manutenção por humanos e agentes de IA.
6. Experiência do usuário.
7. Performance.
