#!/bin/sh
set -eu

mkdir -p "$HOME/.config/build-bot-chromium" "$HOME/.config/pcmanfm/build-bot" "$HOME/Desktop" "$HOME/Downloads" "$HOME/workspace"
rm -f "$HOME/.config/build-bot-chromium/SingletonLock" "$HOME/.config/build-bot-chromium/SingletonSocket" "$HOME/.config/build-bot-chromium/SingletonCookie"
cp /opt/build-bot/google-chrome.desktop "$HOME/Desktop/Google Chrome.desktop"
chmod 0755 "$HOME/Desktop/Google Chrome.desktop"
cat > "$HOME/.config/pcmanfm/build-bot/desktop-items-0.conf" <<'EOF'
[*]
wallpaper_mode=crop
wallpaper_common=1
wallpaper=/usr/share/backgrounds/build-bot-home.jpg
desktop_bg=#000000
desktop_fg=#ffffff
desktop_shadow=#000000
show_wm_menu=0
sort=mtime;ascending;
show_documents=0
show_trash=0
show_mounts=0
EOF
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp &
sleep 1
openbox-session &
sleep 1
pcmanfm --desktop --profile build-bot &
sleep 1
node /opt/build-bot/browser-action-server.mjs &
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -localhost -quiet &

exec websockify --web=/usr/share/novnc 6080 localhost:5900
