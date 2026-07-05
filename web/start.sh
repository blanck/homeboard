#!/bin/bash
# Kiosk boot script for the Pi/Dell touchscreen. Replaces the legacy root start.sh.
export DISPLAY=:0
xset s blank
xset s 0
unclutter -idle 0 &

xset -display :0.0 dpms force on; xset -display :0.0 -dpms

# Pull latest and rebuild
cd ~/homeboard && git fetch origin master && git reset --hard origin/master
cd ~/homeboard/web && npm install --no-audit --no-fund && npm run build

# (Re)start the server under pm2
pm2 restart homeboard-web 2>/dev/null || pm2 start ~/homeboard/web/server.mjs --name homeboard-web
pm2 save

sleep 10
# localhost is the canonical kiosk origin; the OAuth forwarder pages on
# Firebase Hosting return callbacks to http://localhost:8080
chromium-browser --kiosk --start-fullscreen --noerrdialogs \
  --disable-session-crashed-bubble --disable-infobars --check-for-update-interval=604800 \
  --app=http://localhost:8080 &
