# AFG IMOBILIÁRIA - Sistema de Gestão Imobiliária

Sistema completo de gestão imobiliária com CRM, gestão de imóveis, área do cliente e painel administrativo.

## Funcionalidades

## Páginas Públicas
- **Home**: Banner institucional, destaques de imóveis e chamada para captação
- **Imóveis**: Listagem com filtros (cidade, bairro, tipo, valor)
- **Detalhes do Imóvel**: Galeria de fotos, informações completas e botão WhatsApp
- **Nossos Serviços**: Compra, venda, locação e administração de imóveis
- **Fale Conosco**: Formulário de contato e integração WhatsApp Business

## Área do Cliente
- Visualização de contratos
- Visualização e upload de documentos
- Gerenciamento de dados pessoais

## Área do Corretor
- **Meus Imóveis**: CRUD completo de imóveis vinculados ao corretor
- **CRM**: Sistema de gestão de leads com pipeline (Novo → Atendimento → Proposta → Negociação → Fechado)
  - Cadastro e edição de leads
  - Sistema de anotações
  - Upload de arquivos
  - Histórico de interações

## Painel Administrativo
- Gerenciamento de usuários (alterar roles)
- Visualização de todos os imóveis
- Visualização de todos os leads
- Visualização de todos os contratos
- Dashboard com métricas do sistema

## Tipos de Usuários

### 1. Cliente
- Acesso à área do cliente
- Visualização de contratos e documentos
- Upload de documentos pessoais

### 2. Corretor
- Todas as funcionalidades do Cliente
- Cadastro e edição de seus próprios imóveis
- Acesso ao CRM para gestão de leads
- Visualização apenas dos seus leads

### 3. Administrativo
- Todas as funcionalidades do Corretor
- Gerenciamento de todos os usuários
- Visualização e gestão de todos os imóveis
- Visualização de todos os leads e contratos
- Acesso ao painel de métricas

## Estrutura do Banco de Dados

### Tabelas Principais

#### `users`
- id, openId, name, email, role, loginMethod
- Roles: cliente, corretor, administrativo

#### `properties` (Imóveis)
- Informações completas do imóvel
- Vinculado ao corretor (idCorretor)
- Status: ativo, vendido, alugado, inativo

#### `leads`
- Informações do lead
- Status: novo, atendimento, proposta, negociacao, fechado, todos
- Vinculado ao responsável (idResponsavel)

#### `lead_notes` (Anotações de Leads)
- Histórico de interações com o lead

#### `lead_files` (Arquivos de Leads)
- Documentos anexados aos leads

#### `contracts` (Contratos)
- Contratos de venda ou locação
- Vinculado a cliente e imóvel

#### `documents` (Documentos)
- Documentos dos clientes
- Status: pendente, aprovado, rejeitado

## Personalização

### Cores e Tema
Edite `client/src/index.css` para personalizar:
- Cores primárias e secundárias
- Fontes
- Espaçamentos

### Informações de Contato
Edite as seguintes páginas:
- `client/src/components/Footer.tsx` - Rodapé
- `client/src/pages/Contato.tsx` - Página de contato e WhatsApp

### Logo
Altere o logo em `client/src/const.ts`:
```typescript
export const APP_LOGO = "/caminho/para/seu/logo.png";
```

### Conteúdo das Páginas
Todas as páginas possuem seções marcadas com comentários `ÁREA DE EDIÇÃO` para facilitar a personalização:
- `client/src/pages/Home.tsx` - Conteúdo da home
- `client/src/pages/Servicos.tsx` - Serviços oferecidos
- `client/src/pages/Contato.tsx` - Informações de contato

## Como Usar

### Primeiro Acesso
1. Faça login através do botão "Entrar" no header
2. Seu usuário será criado automaticamente com role "cliente"
3. Para se tornar corretor ou administrativo, peça a um admin para alterar seu role no painel administrativo

### Como Corretor
1. Acesse "Meus Imóveis" para cadastrar imóveis
2. Acesse "CRM" para gerenciar leads
3. Use o pipeline para movimentar leads entre os status

### Como Administrativo
1. Acesse "Admin" para gerenciar usuários e visualizar métricas
2. Altere roles de usuários conforme necessário
3. Visualize todos os imóveis, leads e contratos do sistema


Isso criará:
- 4 imóveis de exemplo (apartamentos, casas, comercial)
- Imóveis em destaque na home

## Sistema de Permissões

### Rotas Públicas
- Home, Imóveis, Serviços, Contato

### Rotas Protegidas (Requer Login)
- Área do Cliente
- Meus Imóveis (Corretor/Admin)
- CRM (Corretor/Admin)
- Admin (Apenas Admin)

### Lógica de Permissões
- **Cliente**: Pode visualizar apenas seus próprios dados
- **Corretor**: Pode gerenciar seus próprios imóveis e leads
- **Administrativo**: Acesso total ao sistema

## Autenticação (Login)

O projeto usa **OAuth Manus** e cookie de sessão HTTP-only.

### Fluxo resumido
1. Frontend monta a URL de login (`getLoginUrl`) e envia o usuário para o portal OAuth.
2. O callback `/api/oauth/callback` troca o `code` por token e cria sessão (`app_session_id`).
3. Em cada request tRPC, o backend valida o cookie e injeta `ctx.user`.
4. `protectedProcedure` bloqueia rotas sem sessão válida.

### Variáveis de ambiente importantes
- `VITE_OAUTH_PORTAL_URL`: URL do portal OAuth (frontend).
- `VITE_APP_ID`: identificador da aplicação no OAuth.
- `OAUTH_SERVER_URL`: URL do servidor OAuth para troca de token.
- `JWT_SECRET`: segredo usado para assinar/verificar sessão.
- `AUTH_BYPASS_LOCAL=true` (opcional): habilita usuário admin fake **somente em dev** para testes locais.

> Recomendado: manter `AUTH_BYPASS_LOCAL` desabilitado em qualquer ambiente compartilhado.

## Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Express, tRPC 11
- **Banco de Dados**: MySQL/TiDB com Drizzle ORM
- **Autenticação**: Manus OAuth
- **Validação**: Zod (via tRPC)

## Responsividade

O site é totalmente responsivo e funciona perfeitamente em:
- Desktop (1920px+)
- Tablet (768px - 1919px)
- Mobile (320px - 767px)

## Próximas Melhorias Sugeridas

1. **Upload de Fotos**: Implementar upload de múltiplas fotos para imóveis usando S3
2. **Mapa de Localização**: Integrar Google Maps para mostrar localização dos imóveis
3. **Notificações**: Sistema de notificações para novos leads e atualizações
4. **Relatórios**: Gerar relatórios em PDF de contratos e documentos
5. **Busca Avançada**: Filtros mais complexos na listagem de imóveis
6. **Dashboard Analytics**: Gráficos e estatísticas mais detalhadas no painel admin

## Suporte

Para dúvidas ou suporte, entre em contato através do formulário de contato no site ou pelo WhatsApp configurado.

---

**© 2025 AFG Imobiliária - Gestão e Vendas. Todos os direitos reservados.**
