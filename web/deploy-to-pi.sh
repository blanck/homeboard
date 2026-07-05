#!/bin/bash
# Build locally and deploy to the Pi kiosk. Usage: ./deploy-to-pi.sh [user@host]
# The Pi only needs Node 16+ and the ws package; the bundle is built here.
# (server.mjs is written for Node 16 because Raspbian Buster's libstdc++
# cannot run Node 18+.)
set -euo pipefail
PI_HOST="${1:-pi@homeboard.local}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building bundle"
cd "$DIR"
npm run build

echo "==> Locating Node and pm2 on $PI_HOST"
NODE_BIN=$(ssh "$PI_HOST" 'ls -d $HOME/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -V | tail -1 || command -v node')
PM2_BIN=$(ssh "$PI_HOST" 'ls -d $HOME/.nvm/versions/node/v*/bin/pm2 2>/dev/null | sort -V | tail -1 || command -v pm2')
NODE_MAJOR=$(ssh "$PI_HOST" "$NODE_BIN -v" | sed 's/v\([0-9]*\).*/\1/')
echo "    node: $NODE_BIN (major $NODE_MAJOR), pm2: $PM2_BIN"
if [ "${NODE_MAJOR:-0}" -lt 16 ] 2>/dev/null; then
  echo "Node >= 16 required on the Pi (found: ${NODE_MAJOR:-none})."
  echo "Fix with: ssh $PI_HOST 'source ~/.nvm/nvm.sh && nvm install 16 --no-use'"
  exit 1
fi

echo "==> Copying files"
ssh "$PI_HOST" 'mkdir -p ~/homeboard-web'
rsync -az --delete "$DIR/dist/" "$PI_HOST:homeboard-web/dist/"
rsync -az "$DIR/server.mjs" "$PI_HOST:homeboard-web/"

echo "==> Installing ws + (re)starting pm2 process"
ssh "$PI_HOST" "
  cd ~/homeboard-web
  [ -d node_modules/ws ] || ${NODE_BIN%node}npm install ws@8 --no-audit --no-fund --loglevel=error
  $PM2_BIN delete server >/dev/null 2>&1 || true
  $PM2_BIN restart homeboard-web >/dev/null 2>&1 || \
    $PM2_BIN start ~/homeboard-web/server.mjs --name homeboard-web --interpreter $NODE_BIN
  $PM2_BIN save
"

echo "==> Refreshing kiosk browser"
ssh "$PI_HOST" 'export DISPLAY=:0; xdotool key F5' 2>/dev/null || true

echo "==> Deployed: http://homeboard.local:8080"
echo "    Rollback: ssh $PI_HOST 'pm2 delete homeboard-web; pm2 start ~/homeboard/server.js --name server; pm2 save'"
