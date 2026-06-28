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
- [x] Geração de boletos do período — automática na aprovação dos contratos (`autoGenerateRentalProposalBoletos`)
- [x] Recebimento de comprovantes de seguro fiança e incêndio (etapa Seguros: confirmar/dispensar, anexo, e-mail + link wa.me)
- [~] Assinaturas digitais — integração D4Sign (avançada por e-mail, configurável p/ ICP-Brasil)
  - backend completo (tabela `rentalProposalSignatures`, serviço `server/integrations/d4sign.ts`,
    mutations `signatures`/`sendForSignature`/`refreshSignatureStatus`/`cancelSignature`,
    webhook `/api/integrations/d4sign/webhook`) + card "Assinaturas" no frontend
  - envio MANUAL por contrato aprovado; signatários = locatário(s) + proprietário(s)
  - FALTA: credenciais D4Sign no `.env` (D4SIGN_TOKEN_API/CRYPT_KEY/SAFE_UUID) p/ validar ponta a ponta
  - GOV.BR fica como futuro (exige credenciamento SGD/ME, não self-service)
  - FALLBACK MANUAL: botão "Marcar como assinado" (anexo opcional do PDF) avança sem D4Sign
    (mutation `markSignatureSignedManually`) — contingência e desbloqueio de testes
- [x] Transferência de titularidade de contas (energia, água, gás)
  - tabela `rentalProposalUtilityTransfers` (energia/agua/gas + contas `custom_*`), card no padrão dos Seguros
    (comprovante + observações + preview), confirmar/dispensar/reabrir
  - CONTAS PERSONALIZADAS: admin adiciona/remove contas extras (Internet, IPTU etc.) — `addUtilityTransfer`/`removeUtilityTransfer`
  - mutations `utilityTransfers`/`confirmUtilityTransfer`/`dispenseUtilityTransfer`/`reopenUtilityTransfer`
  - ao concluir TODAS as contas → avança para `vistoria_pendente`
  - PENDENTE (melhoria): e-mail/wa.me de solicitação ao locatário (hoje só cria as pendências)
- [x] Vistoria e laudo
  - tabela `rentalProposalInspections` (1 por proposta), card "Vistoria e laudo"
  - vistoriador = contato externo (nome/telefone/e-mail); notifica por link wa.me (sem push/API)
  - fluxo: solicitar vistoria → anexar laudo → validar locatário + proprietário → avança `entrega_chaves_pendente`
  - mutations `inspection`/`requestInspection`/`uploadInspectionLaudo`/`setInspectionValidation` + `inspectionLaudo`
  - PENDENTE (melhoria): e-mail automático ao vistoriador; agendamento (scheduledAt na UI)
- [ ] Entrega de chaves + e-mail de boas-vindas
- [ ] Conversão em locação ativa (sai de Propostas → Locações Ativas)

## Melhorias Futuras
- [ ] Relatórios em PDF (contratos, documentos)
- [ ] Dashboard com gráficos avançados
- [ ] Arquitetura multi-tenant (preparar para SaaS multi-imobiliária)

> Legenda: [x] feito · [~] em andamento · [ ] pendente
