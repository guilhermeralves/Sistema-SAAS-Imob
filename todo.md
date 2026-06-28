# AFG IMOBILIÁRIA - TODO

> Fonte da verdade do progresso. Atualize ao concluir/iniciar funcionalidades —
> agentes de IA leem este arquivo para saber o que fazer.

## Estrutura de Banco de Dados
- [x] Criar tabela properties (imóveis)
- [x] Criar tabela leads (CRM)
- [x] Criar tabela contracts (contratos)
- [x] Criar tabela documents (documentos)
- [x] Criar tabela lead_notes (anotações de leads)
- [x] Criar tabela lead_files (arquivos de leads)
- [x] Estender tabela users com roles (cliente, corretor, administrativo)

## Sistema de Autenticação e Permissões
- [x] Implementar sistema de roles (cliente, corretor, administrativo)
- [x] Criar middleware de proteção por role
- [x] Implementar lógica de permissões em procedures

## Componentes Compartilhados
- [x] Header com logo e menu dinâmico
- [x] Footer
- [x] Layout principal
- [x] Navegação com base em roles

## Páginas Públicas
- [x] Home com banner e destaques
- [x] Listagem de Imóveis com filtros
- [x] Detalhes do Imóvel
- [x] Nossos Serviços
- [x] Fale Conosco com formulário

## Gestão de Imóveis
- [x] CRUD completo para administrativos
- [x] Corretores podem cadastrar/editar seus imóveis
- [x] Upload de múltiplas fotos (coluna `fotos`, lib `property-image.ts`)
- [x] Integração com mapa de localização (componente `Map.tsx`)
- [x] Lançamentos de imóveis (migração 0024_property_launches)

## CRM (Corretores e Administrativos)
- [x] Dashboard do CRM com pipeline
- [x] Cadastro de leads
- [x] Visualização de leads por status
- [x] Sistema de anotações por lead
- [x] Upload de arquivos por lead
- [x] Histórico de interações
- [x] Movimentação de leads entre status

## Área do Cliente
- [x] Visualização de contratos
- [x] Visualização de solicitações
- [x] Edição de dados pessoais
- [x] Upload de documentos

## Painel Administrativo
- [x] Gerenciar usuários (CRUD)
- [x] Gerenciar todos os imóveis
- [x] Gerenciar todos os leads
- [x] Dashboard com métricas
- [x] Controle de permissões

## Notificações
- [x] Notificações por email (formulário de contato)
- [x] Notificações push / PWA para novos leads (NotificationBell, PushNotificationToggle, sw.js)
  - ver `docs/notificacoes-push-teste.md`

## Locações (módulo em andamento — ver docs/modules/locacoes.md)
- [x] Nova proposta de locação (`AdminRentalProposalNew`)
- [x] Detalhes da proposta (`AdminRentalProposalDetails`)
- [x] Snapshot de contexto (imóvel, proprietários, corretor, locatários)
- [x] Seleção de modelos de contrato por proposta
- [x] Geração de contratos com substituição de variáveis (`shared/contract-variables.ts`)
- [x] Revisão e aprovação manual de contratos (etapas 1–16 do fluxo)
- [~] Código de referência da proposta (migração 0028 criada — validar implementação)
- [~] Geração de boletos do período (migração 0030 criada — em andamento)
- [ ] Recebimento de comprovantes de seguro fiança e incêndio
- [ ] Assinaturas digitais (preferência futura por GOV.BR)
- [ ] Transferência de titularidade de contas (energia, água, gás)
- [ ] Vistoria e laudo (assinatura locatário/proprietário)
- [ ] Entrega de chaves + e-mail de boas-vindas
- [ ] Conversão em locação ativa (sai de Propostas → Locações Ativas)

## Melhorias Futuras
- [ ] Relatórios em PDF (contratos, documentos)
- [ ] Dashboard com gráficos avançados
- [ ] Arquitetura multi-tenant (preparar para SaaS multi-imobiliária)

> Legenda: [x] feito · [~] em andamento · [ ] pendente
