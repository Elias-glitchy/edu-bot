# Per-bot Linux computer runtime

BUILD BOT assigns one logical computer record and one persistent Docker volume to every bot. Containers start only when needed; stopping a computer retains its home volume, Chromium profile, downloads, and workspace.

## Development runtime

Prerequisites:

1. Windows Subsystem for Linux 2.
2. Docker Desktop using the WSL 2 backend.
3. The local `build-bot-computer:dev` image.

From an elevated PowerShell window, enable WSL and restart Windows if requested:

```powershell
wsl --install
wsl --update
```

After Docker Desktop is installed and running:

```powershell
npm run computer:doctor
npm run computer:build
npm run dev
```

The image contains Chromium, Xvfb, Openbox, PCManFM, x11vnc, noVNC/websockify, and a narrowly scoped persistent Playwright action service. The backend creates containers with a read-only root filesystem, a non-root user, all Linux capabilities dropped, `no-new-privileges`, CPU/memory/PID limits, tmpfs scratch space, and a separate named home volume.

## Lifecycle and isolation

- Computer inventory is tenant scoped and bound one-to-one to an agent.
- Starting an active bot provisions its container and volume if needed.
- The local Docker provider defaults to one active computer at a time (`COLLEAGUE_ZERO_MAX_RUNNING_COMPUTERS=1`). Starting another computer stops the oldest idle computer, while an active owner/agent lease is never interrupted.
- Each computer starts on the BUILD BOT wallpaper desktop with a Chrome shortcut. Chromium opens only when the shortcut is used or an approved browser task requires it.
- Pause freezes the container; resume unfreezes it.
- Stop removes active sessions but keeps the persistent volume.
- Reset recreates the runtime while keeping the volume. Destructive volume erasure is intentionally not exposed by the local API.
- Exclusive leases prevent simultaneous automation and owner control.
- Live-view bearer tokens are random, stored only as SHA-256 hashes, expire after five minutes, and are bound to a running session.
- The gateway proxies noVNC HTTP and WebSocket traffic without passing BUILD BOT cookies or authorization headers into the container.

The full Gemini or other AI-provider key is never injected into bot containers. The agent executor calls the provider from the trusted backend and exposes only narrowly scoped, approved computer actions to each bot.

## Production direction

Replace the Docker provider with a Kubernetes provider that creates one PVC and isolated workload identity per bot. Use a read-only image, non-root security context, default-deny NetworkPolicy, resource quotas, encrypted storage, an egress proxy, a credential broker, and a hardened runtime class such as gVisor or Kata Containers. The logical computer API and database records remain provider independent.

Do not place school credentials or real student records inside development containers. Use fictional demonstration data until connector-specific access control, audit, retention, and incident response are implemented and independently reviewed.
