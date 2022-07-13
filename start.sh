#!/bin/bash
export DISPLAY=:0
xset s blank
xset s 0
unclutter -idle 0 &

xset -display :0.0 dpms force on; xset -display :0.0 -dpms

cd ~/homeboard/ && git fetch origin master
cd ~/homeboard/ && git reset --hard origin/master
cd ~/homeboard/ && git pull --no-edit https://github.com/blanck/homeboard.git

# npm install
sleep 1
cd ~/homeboard/ && npm run build-prod
sleep 5
pm2 restart server
# pm2 restart "npm run dev"
sleep 30
chromium-browser --kiosk --start-fullscreen --app=http://localhost:8080 &
