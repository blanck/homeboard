#!/bin/bash
# Build locally and deploy to the Pi kiosk. Usage: ./deploy-to-pi.sh [user@host]
# The Pi only needs Node 18+ and the ws package; the bundle is built here.
set -euo pipefail
PI_HOST="${1:-pi@homeboard.local}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building bundle"
cd "$DIR"
npm run build

echo "==> Checking Node on $PI_HOST"
NODE_MAJOR=$(ssh "$PI_HOST" 'source ~/.nvm/nvm.sh >/dev/null 2>&1 || true; node -v 2>/dev/null' | sed 's/v\([0-9]*\).*/\1/')
if [ "${NODE_MAJOR:-0}" -lt 18 ] 2>/dev/null; then
  echo "Node >= 18 required on the Pi (found: ${NODE_MAJOR:-none})."
  echo "Fix with: ssh $PI_HOST 'source ~/.nvm/nvm.sh && nvm install 22 && nvm alias default 22'"
  exit 1
fi

echo "==> Copying files"
ssh "$PI_HOST" 'mkdir -p ~/homeboard-web'
rsync -az --delete "$DIR/dist/" "$PI_HOST:homeboard-web/dist/"
rsync -az "$DIR/server.mjs" "$PI_HOST:homeboard-web/"

echo "==> Installing ws + switching pm2 to the new server"
ssh "$PI_HOST" '
  source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
  cd ~/homeboard-web
  [ -d node_modules/ws ] || npm install ws --no-audit --no-fund
  pm2 delete server >/dev/null 2>&1 || true
  pm2 restart homeboard-web >/dev/null 2>&1 || pm2 start server.mjs --name homeboard-web
  pm2 save
'

echo "==> Deployed: http://homeboard.local:8080"
echo "    Rollback: ssh $PI_HOST 'pm2 delete homeboard-web; pm2 start ~/homeboard/server.js --name server; pm2 save'"
