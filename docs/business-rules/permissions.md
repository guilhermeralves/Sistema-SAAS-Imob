# Permissões e Papéis

## Papéis principais

### Cliente
Permissões esperadas:
- visualizar imóveis;
- entrar em contato;
- criar conta;
- acessar funcionalidades básicas.

Restrições:
- não pode acessar CRM administrativo;
- não pode alterar imóveis;
- não pode visualizar leads internos.

---

### Corretor
Permissões esperadas:
- acessar CRM próprio;
- visualizar leads atribuídos;
- cadastrar imóveis;
- atualizar informações de imóveis permitidos.

Restrições:
- não pode remover dados críticos sem permissão;
- não deve acessar leads de outros corretores;
- não deve alterar permissões de usuários.

---

### Admin
Permissões esperadas:
- acesso completo ao CRM;
- gerenciamento de usuários;
- gerenciamento de imóveis;
- gerenciamento de leads;
- acesso global ao sistema.

## Regras importantes

- Toda permissão crítica deve ser validada no backend.
- Não confiar apenas em ocultar botões no frontend.
- Alterações de papéis devem ser auditáveis futuramente.
- Rotas administrativas devem exigir autenticação válida.
