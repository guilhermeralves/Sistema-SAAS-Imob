#!/usr/bin/env bash
#
# scripts/deploy.sh — pipeline de deploy no servidor de produção.
#
# Uso (dentro do diretório da app, ex: /var/www/Sistema-SAAS-Imob):
#   ./scripts/deploy.sh
#
# Requer:
#   - git, corepack (Node 22+), pnpm, pm2 no PATH
#   - PM2 já com o processo criado (primeira vez: pm2 start dist/index.js --name newimob && pm2 save)
#
# Idempotente e seguro: todos os passos verificam o que já foi feito
# e pulam trabalho desnecessário.

set -euo pipefail

# Configurável via env: BRANCH=main ./scripts/deploy.sh
BRANCH="${BRANCH:-feat/licencas-tenants}"
APP_NAME="${APP_NAME:-newimob}"

step() {
  echo ""
  echo "============================================================"
  echo "  $1"
  echo "============================================================"
}

step "1/6 — git pull (branch: $BRANCH)"
git fetch origin
git checkout "$BRANCH"
BEFORE=$(git rev-parse HEAD)
git pull --ff-only origin "$BRANCH"
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "→ Nenhum commit novo. Deploy encerra aqui."
  echo "  (se você QUER forçar rebuild mesmo assim, roda: FORCE=1 ./scripts/deploy.sh)"
  if [ "${FORCE:-0}" != "1" ]; then
    exit 0
  fi
  echo "→ FORCE=1 setado, seguindo mesmo sem commits novos."
fi

echo "→ Novo HEAD: $AFTER"
echo "→ Commits novos:"
git log --oneline "$BEFORE..$AFTER" 2>/dev/null || true

step "2/6 — pnpm install"
corepack pnpm install --frozen-lockfile

step "3/6 — migrações do banco"
corepack pnpm run db:manual:sync

step "4/6 — build (frontend + backend)"
corepack pnpm run build

step "5/6 — restart PM2 ($APP_NAME)"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  echo "→ Processo '$APP_NAME' ainda não existe no PM2. Criando…"
  pm2 start dist/index.js --name "$APP_NAME"
  pm2 save
fi

step "6/6 — status"
pm2 status "$APP_NAME"
echo ""
echo "✔ Deploy concluído. HEAD: $AFTER"
