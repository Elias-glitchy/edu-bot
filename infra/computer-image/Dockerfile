FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    HOME=/home/bot

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium dbus-x11 fonts-dejavu-core fonts-liberation novnc openbox pcmanfm procps \
    tini websockify x11vnc xvfb ca-certificates curl && \
    rm -rf /var/lib/apt/lists/* && \
    useradd --create-home --uid 10001 --shell /bin/bash bot

WORKDIR /opt/build-bot
COPY package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY start-computer.sh launch-chromium.sh browser-action.mjs browser-action-server.mjs google-chrome.desktop ./
COPY home-wallpaper.jpg /usr/share/backgrounds/build-bot-home.jpg
RUN chmod 0755 /opt/build-bot/start-computer.sh /opt/build-bot/launch-chromium.sh /opt/build-bot/google-chrome.desktop && \
    chown -R bot:bot /opt/build-bot /usr/share/backgrounds/build-bot-home.jpg

USER bot
EXPOSE 6080
ENTRYPOINT ["/usr/bin/tini","--","/opt/build-bot/start-computer.sh"]
