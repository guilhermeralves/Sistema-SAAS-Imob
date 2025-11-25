# AFG IMOBILIÁRIA - TODO

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
- [x] Criar Header com logo e menu dinâmico
- [x] Criar Footer
- [x] Criar Layout principal
- [x] Implementar navegação com base em roles

## Páginas Públicas
- [x] Página Home com banner e destaques
- [x] Página de Listagem de Imóveis com filtros
- [x] Página de Detalhes do Imóvel
- [x] Página Nossos Serviços
- [x] Página Fale Conosco com formulário

## Gestão de Imóveis
- [x] CRUD completo para administrativos
- [x] Corretores podem cadastrar seus imóveis
- [x] Corretores podem editar seus imóveis
- [ ] Upload de múltiplas fotos
- [ ] Integração com mapa de localização

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

## Funcionalidades Gerais
- [x] Design responsivo em todas as páginas
- [x] Integração com WhatsApp Business
- [x] Sistema de notificações por email (via formulário de contato)
- [x] Placeholders e comentários para edição
- [x] Testes de funcionalidades

## Melhorias Futuras (Opcional)
- [ ] Upload de múltiplas fotos para imóveis (requer S3)
- [ ] Integração com mapa de localização (Google Maps)
- [ ] Sistema de notificações push em tempo real
- [ ] Relatórios em PDF
- [ ] Dashboard com gráficos avançados
