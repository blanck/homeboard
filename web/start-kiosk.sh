#!/bin/bash
# Minimal kiosk boot script. Use this on Pis that cannot build the bundle
# themselves (e.g. Raspbian Buster, which maxes out at Node 16): the server
# is resurrected by pm2's systemd unit, and new versions are pushed from a
# dev machine with web/deploy-to-pi.sh. This only preps the display and
# launches the browser.
#
# Idempotent: deploy-to-pi.sh reruns it with --restart to relaunch the
# browser onto a fresh bundle (xdotool F5 is ignored by --app windows).
export DISPLAY=:0
xset s blank
xset s 0
pgrep unclutter >/dev/null || unclutter -idle 0 &

xset -display :0.0 dpms force on; xset -display :0.0 -dpms

pkill chromium 2>/dev/null && sleep 2

[ "$1" = "--restart" ] || sleep 8
# GPU flags: chromium 92 blocklists compositing on the Pi otherwise
chromium-browser --kiosk --start-fullscreen --noerrdialogs \
  --disable-session-crashed-bubble --disable-infobars --check-for-update-interval=604800 \
  --use-gl=egl --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy \
  --app=http://localhost:8080 &
