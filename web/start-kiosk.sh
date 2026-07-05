#!/bin/bash
# Minimal kiosk boot script. Use this on Pis that cannot build the bundle
# themselves (e.g. Raspbian Buster, which maxes out at Node 16): the server
# is resurrected by pm2's systemd unit, and new versions are pushed from a
# dev machine with web/deploy-to-pi.sh. This only preps the display and
# launches the browser.
export DISPLAY=:0
xset s blank
xset s 0
unclutter -idle 0 &

xset -display :0.0 dpms force on; xset -display :0.0 -dpms

sleep 8
chromium-browser --kiosk --start-fullscreen --noerrdialogs \
  --disable-session-crashed-bubble --disable-infobars --check-for-update-interval=604800 \
  --app=http://localhost:8080 &
