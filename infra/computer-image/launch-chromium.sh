#!/bin/sh
set -eu

if curl --silent --fail http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
  exit 0
fi

profile="$HOME/.config/build-bot-chromium"
mkdir -p "$profile"
mkdir -p /tmp/chromium-cache /tmp/chromium-media-cache
rm -f "$profile/SingletonLock" "$profile/SingletonSocket" "$profile/SingletonCookie"

exec chromium --no-sandbox --disable-dev-shm-usage --disable-background-networking \
  --disable-component-update --disable-default-apps --disable-extensions --disable-gpu \
  --disable-software-rasterizer --disable-sync --disable-breakpad --disable-crash-reporter \
  --disable-features=OptimizationGuideModelDownloading,OptimizationHints,OptimizationTargetPrediction,MediaRouter,Translate \
  --disk-cache-dir=/tmp/chromium-cache --media-cache-dir=/tmp/chromium-media-cache \
  --password-store=basic --no-service-autorun --renderer-process-limit=2 --no-first-run \
  --disable-session-crashed-bubble --start-maximized \
  --window-position=0,0 --window-size=1280,720 \
  --user-data-dir="$profile" --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 about:blank
