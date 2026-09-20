# Notificações Push — guia de teste (antes da nuvem)

Este guia mostra como testar as notificações push **no celular** usando um túnel
HTTPS temporário, sem precisar publicar o sistema na nuvem.

> **Por que preciso de túnel?** Push e service worker só funcionam em **HTTPS** ou
> em `localhost`. No PC (`http://localhost:3000`) já funciona. No celular pela rede
> local (`http://192.168.x.x`) **não funciona** — por isso usamos um túnel que dá
> uma URL `https://...` temporária apontando para o seu servidor local.

---

## Pré-requisitos (já configurados no projeto)

- Pacote `web-push` instalado.
- Chaves `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` no `.env` (já geradas).
- Tabela `pushSubscriptions` criada no banco (`pnpm db:manual:sync`).
- Service worker (`/sw.js`) e manifest (`/manifest.webmanifest`) no front.

Se trocar de máquina/banco, rode uma vez:

```bash
node scripts/manual-db-sync.mjs
```

---

## Passo 1 — Subir o servidor local

No terminal, na raiz do projeto:

```bash
npm run dev
```

Anote a porta (geralmente **3000**). Deixe esse terminal rodando.

---

## Passo 2 — Abrir o túnel HTTPS

Escolha **uma** das opções abaixo (Cloudflare é o mais simples, sem cadastro).

### Opção A — Cloudflare Tunnel (recomendado, grátis, sem login)

1. Instale o `cloudflared`:
   - Windows: baixe em
     <https://github.com/cloudflare/cloudflared/releases> (arquivo
     `cloudflared-windows-amd64.exe`) e renomeie para `cloudflared.exe`, ou via
     `winget install --id Cloudflare.cloudflared`.
2. Em um **novo terminal**, rode (troque a porta se for diferente):

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. Ele vai imprimir uma URL parecida com:

   ```
   https://algo-aleatorio.trycloudflare.com
   ```

   **Essa é a URL que você abre no celular.**

### Opção B — ngrok (grátis, exige cadastro rápido)

1. Crie conta em <https://ngrok.com> e instale o ngrok.
2. Configure o token (uma vez): `ngrok config add-authtoken SEU_TOKEN`.
3. Rode:

   ```bash
   ngrok http 3000
   ```

4. Use a URL `https://....ngrok-free.app` que aparecer.

> O `vite.config.ts` já libera os domínios `*.trycloudflare.com`,
> `*.ngrok-free.app`, `*.ngrok.io` e `*.ngrok.app` no modo dev.

---

## Passo 3 — Instalar o PWA no iPhone (obrigatório no iOS)

No iPhone, o push **só funciona com o site instalado na tela inicial** e em
**iOS 16.4 ou superior**. Passos:

1. Abra a URL `https://...` do túnel **no Safari** (tem que ser Safari).
2. Faça login no sistema com seu usuário de corretor/admin.
3. Toque no botão **Compartilhar** (quadrado com seta para cima).
4. Toque em **"Adicionar à Tela de Início"** → **Adicionar**.
5. Feche o Safari e **abra o app pela tela inicial** (o ícone da New).

> No **Android** é mais simples: pode usar direto no Chrome. Se quiser, use o menu
> do Chrome → "Instalar app" / "Adicionar à tela inicial".

---

## Passo 4 — Ativar as notificações

1. Com o app aberto (logado como corretor/admin), toque no seu nome no canto
   superior direito.
2. No menu, toque em **"Ativar notificações"**.
3. Aceite o pedido de permissão do sistema.
4. Toque em **"Enviar notificação de teste"** — deve aparecer uma notificação
   na tela do celular. ✅

---

## Passo 5 — Testar o fluxo real do lead

1. Em outro dispositivo (ou no PC), entre como **administrador**.
2. Direcione um lead para o corretor que ativou as notificações
   (criar lead com responsável, usar **Direcionar**, ou trocar o responsável).
3. O celular do corretor recebe a notificação **"Novo lead para você"**.
4. Ao tocar, abre o sistema na tela do CRM.

---

## Dicas e solução de problemas

- **iPhone não mostra "Ativar notificações"**: confirme iOS ≥ 16.4 e que abriu
  pelo **ícone instalado** (não pela aba do Safari).
- **"Notificações bloqueadas no navegador"**: você negou a permissão antes. No
  iPhone: Ajustes → Notificações → New. No Android/Chrome: cadeado da página →
  Permissões → Notificações.
- **Túnel mudou de URL**: a cada `cloudflared`/`ngrok` reiniciado a URL muda.
  Reinstale o PWA com a nova URL (a inscrição antiga deixa de valer).
- **Nada chega no teste**: confira se as variáveis `VAPID_*` estão no `.env` e
  reinicie o `npm run dev`.

---

## Quando for para a nuvem

Em produção, com um domínio fixo e HTTPS (ex.: `https://app.newimobiliaria.com.br`),
nada disso de túnel é necessário — o push funciona direto. Basta:

- Definir `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no ambiente
  de produção (use as **mesmas** chaves do `.env`, ou gere novas e os corretores
  reativam).
- Garantir que o domínio sirva o `/sw.js` e o `/manifest.webmanifest` na raiz
  (o build já faz isso).
