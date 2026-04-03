# Migrating the Backend from Railway to Ubuntu/CasaOS

CasaOS is Docker-native — every managed app runs as a container. This guide takes the Docker-first approach so your News Reader backend appears in the CasaOS dashboard with restart policies, logs, and environment management built in.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [Export Data from Railway](#3-export-data-from-railway)
4. [Create the Dockerfile](#4-create-the-dockerfile)
5. [Create the Docker Compose File](#5-create-the-docker-compose-file)
6. [Deploy to CasaOS](#6-deploy-to-casaos)
7. [Configure Environment Variables](#7-configure-environment-variables)
8. [Migrate the Database](#8-migrate-the-database)
9. [Set Up Nginx Proxy Manager (HTTPS)](#9-set-up-nginx-proxy-manager-https)
10. [Auto-Deploy on Git Push](#10-auto-deploy-on-git-push)
11. [Update Vercel Frontend](#11-update-vercel-frontend)
12. [Verify Everything Works](#12-verify-everything-works)
13. [Decommission Railway](#13-decommission-railway)
14. [Maintenance & Backups](#14-maintenance--backups)
15. [Rollback Plan](#15-rollback-plan)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Prerequisites

- Ubuntu server (22.04+) with CasaOS installed and accessible via browser
- SSH access to the server
- A domain or subdomain pointed to your server's public IP (e.g., `api.yourdomain.com`)
- Ports 80 and 443 open/forwarded on your router
- Your current Railway environment variables (copy from Railway dashboard before starting)
- Docker and Docker Compose (installed automatically with CasaOS)

### Verify CasaOS is ready

```bash
ssh your-user@YOUR_SERVER_IP

# Check CasaOS is running
casaos -v

# Check Docker is available
docker --version
docker compose version
```

### Move CasaOS dashboard off port 80

CasaOS uses port 80 by default. You need to free it for the reverse proxy.

1. Open CasaOS dashboard in your browser
2. Go to **Settings** (gear icon) > **General**
3. Change the **WebUI Port** to `7778` (or any unused port)
4. Access the dashboard at `http://YOUR_SERVER_IP:7778` going forward

---

## 2. Architecture Overview

```
                    Internet
                       │
              ┌────────▼────────┐
              │  Nginx Proxy    │  :80 / :443
              │  Manager        │  (CasaOS container)
              │  (SSL + proxy)  │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  News Reader    │  :3001 (internal)
              │  API Server     │  (CasaOS container)
              │  Node 22 +     │
              │  SQLite         │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  /DATA/AppData/ │  Persistent volume
              │  newsreader/db/ │  (SQLite database)
              └─────────────────┘

Frontend: still on Vercel (static SPA, no change)
```

---

## 3. Export Data from Railway

Before touching anything, grab your data.

### Export environment variables

In the Railway dashboard, go to your service > Variables tab. Copy every key-value pair and save locally:

```bash
# On your local machine, create a reference file
cat > ~/railway-env-backup.txt << 'EOF'
PORT=3001
DB_PATH=/data/newsreader.db
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TMDB_API_KEY=...
ADMIN_API_KEY=...
INTERNAL_API_SECRET=...
EOF
```

### Export the database

```bash
# Option 1: Railway CLI
npm install -g @railway/cli
railway login
railway link  # Select your project
railway volume download  # Downloads volume contents

# Option 2: Railway dashboard
# Go to your service > Volumes > click the three dots > Download

# Save the .db file somewhere safe
cp newsreader.db ~/railway-db-backup.db
```

If you don't need existing data, skip the DB export — tables auto-create on first start.

---

## 4. Create the Dockerfile

Create this file at the root of your repo: `server/Dockerfile`

```dockerfile
# ── Build stage ──
FROM node:22-slim AS builder

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --production

# ── Runtime stage ──
FROM node:22-slim

# better-sqlite3 needs libstdc++ at runtime
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /data

# Default environment
ENV PORT=3001
ENV DB_PATH=/data/newsreader.db
ENV NODE_ENV=production

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3001/api/categories || exit 1

CMD ["node", "index.js"]
```

### Test the image locally (optional but recommended)

```bash
cd server
docker build -t newsreader-api .
docker run --rm -p 3001:3001 \
    -e GROQ_API_KEY=your_key \
    -v $(pwd)/data:/data \
    newsreader-api

# Test: http://localhost:3001/api/categories
```

---

## 5. Create the Docker Compose File

Create `server/docker-compose.yml`:

```yaml
version: "3.8"

services:
  newsreader-api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: newsreader-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - /DATA/AppData/newsreader/db:/data
    environment:
      - PORT=3001
      - DB_PATH=/data/newsreader.db
      - GROQ_API_KEY=${GROQ_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-}
      - TMDB_API_KEY=${TMDB_API_KEY:-}
      - ADMIN_API_KEY=${ADMIN_API_KEY:-}
      - INTERNAL_API_SECRET=${INTERNAL_API_SECRET:-}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/categories"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

# CasaOS metadata — makes the app appear in the dashboard with icon and description
x-casaos:
  architectures:
    - amd64
    - arm64
  main: newsreader-api
  store_app_id: newsreader-api
  title:
    en_us: "News Reader API"
  description:
    en_us: "AI-powered news reader backend — Express + SQLite"
  tagline:
    en_us: "Your personal news API server"
  icon: https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/freshrss.svg
  port_map: "3001"
  scheme: http
  category: Utility
```

---

## 6. Deploy to CasaOS

You have two options depending on your preference.

### Option A: Import via CasaOS UI (easiest)

1. SSH into your server and clone the repo:

```bash
cd /tmp
git clone https://github.com/YOUR_USERNAME/news-reader.git
cd news-reader/server
```

2. Build the Docker image on the server:

```bash
docker build -t newsreader-api:latest .
```

3. Open CasaOS dashboard (`http://YOUR_SERVER_IP:7778`)
4. Click **+** > **Install a customized app** > **Docker Compose**
5. Paste the contents of `docker-compose.yml` from step 5
6. Fill in the environment variables in the UI
7. Click **Install**

### Option B: Command line (more control)

```bash
# SSH into your server
ssh your-user@YOUR_SERVER_IP

# Clone the repo
cd /opt
sudo git clone https://github.com/YOUR_USERNAME/news-reader.git
cd news-reader/server

# Create the persistent data directory
sudo mkdir -p /DATA/AppData/newsreader/db

# Create .env file for Docker Compose
sudo nano .env
```

```env
GROQ_API_KEY=your_groq_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TMDB_API_KEY=your_tmdb_key
ADMIN_API_KEY=your_admin_key
INTERNAL_API_SECRET=your_internal_secret
```

```bash
# Build and start
docker compose up -d --build

# Verify
docker compose logs -f
curl http://localhost:3001/api/categories
```

The app will now appear in the CasaOS dashboard.

---

## 7. Configure Environment Variables

### Via CasaOS UI

1. Dashboard > click the **News Reader API** app
2. Click the **Settings** (gear) icon
3. Go to the **Environment** section
4. Add each variable:

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | `3001` |
| `DB_PATH` | Yes | `/data/newsreader.db` |
| `GROQ_API_KEY` | Yes | Primary LLM provider |
| `OPENROUTER_API_KEY` | Recommended | Fallback LLM provider |
| `TELEGRAM_BOT_TOKEN` | Optional | Send-to-Telegram feature |
| `TELEGRAM_CHAT_ID` | Optional | Telegram destination chat |
| `TMDB_API_KEY` | Optional | Movie/TV releases widget |
| `ADMIN_API_KEY` | Optional | Admin API access |
| `INTERNAL_API_SECRET` | Optional | Internal service auth |

5. Save and restart the container

### Via command line

Edit the `.env` file alongside `docker-compose.yml`:

```bash
sudo nano /opt/news-reader/server/.env
docker compose restart
```

---

## 8. Migrate the Database

### Fresh start (no data)

The server auto-creates all tables and seeds defaults on first boot. Nothing to do.

### Migrate existing data from Railway

```bash
# Copy the exported DB to the persistent volume
sudo cp ~/railway-db-backup.db /DATA/AppData/newsreader/db/newsreader.db

# Ensure correct permissions (container runs as node user, UID 1000)
sudo chown 1000:1000 /DATA/AppData/newsreader/db/newsreader.db

# Restart the container to pick up the database
docker compose restart newsreader-api

# Verify data loaded
curl http://localhost:3001/api/categories
```

> **Important**: SQLite WAL mode creates `-wal` and `-shm` companion files. Never copy a DB while the server is running — stop the container first, copy, then restart.

---

## 9. Set Up Nginx Proxy Manager (HTTPS)

Nginx Proxy Manager (NPM) is the standard CasaOS way to handle reverse proxy + SSL.

### Install NPM from CasaOS App Store

1. Dashboard > **App Store** > search "Nginx Proxy Manager"
2. Click **Install**
3. Wait for it to start — it binds to ports 80, 443, and 81 (admin UI)

### Access NPM admin panel

```
http://YOUR_SERVER_IP:81
```

Default login:
- Email: `admin@example.com`
- Password: `changeme`
- You'll be prompted to change these on first login

### Create a Proxy Host for the API

1. Click **Hosts** > **Proxy Hosts** > **Add Proxy Host**
2. Fill in:

**Details tab:**
| Field | Value |
|---|---|
| Domain Names | `api.yourdomain.com` |
| Scheme | `http` |
| Forward Hostname | `newsreader-api` (container name) or `YOUR_SERVER_LOCAL_IP` |
| Forward Port | `3001` |
| Block Common Exploits | checked |
| Websockets Support | checked |

> **Note**: If using the container name (`newsreader-api`), both containers must be on the same Docker network. If it doesn't resolve, use your server's local IP (e.g., `192.168.1.x` or `172.17.0.1`).

**SSL tab:**
| Field | Value |
|---|---|
| SSL Certificate | Request a new SSL Certificate |
| Force SSL | checked |
| Email for Let's Encrypt | your email |
| Agree to TOS | checked |

3. Click **Save**

### Add CORS for the Vercel frontend

In NPM, go to the proxy host > **Advanced** tab and add:

```nginx
# CORS headers for Vercel frontend
add_header Access-Control-Allow-Origin "https://yourdomain.com" always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

if ($request_method = 'OPTIONS') {
    add_header Access-Control-Allow-Origin "https://yourdomain.com";
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization";
    add_header Content-Length 0;
    add_header Content-Type text/plain;
    return 204;
}
```

### Verify

```bash
curl https://api.yourdomain.com/api/categories
```

---

## 10. Auto-Deploy on Git Push

Replicate Railway's "push to main = automatic deploy" behavior.

### Create the deploy script

```bash
sudo nano /opt/news-reader/deploy.sh
```

```bash
#!/bin/bash
set -e

LOG="/opt/news-reader/deploy.log"
echo "=== Deploy started: $(date) ===" >> "$LOG"

cd /opt/news-reader

# Pull latest code
git pull origin main >> "$LOG" 2>&1

# Rebuild and restart the container (zero-downtime with health check)
cd server
docker compose up -d --build >> "$LOG" 2>&1

# Prune old images to save disk space
docker image prune -f >> "$LOG" 2>&1

echo "=== Deploy finished: $(date) ===" >> "$LOG"
```

```bash
sudo chmod +x /opt/news-reader/deploy.sh
```

### Option A: GitHub Webhook (recommended, instant deploys)

Install the webhook listener on the host (not in Docker — it needs to run `docker compose`):

```bash
sudo apt install -y webhook
```

Create webhook config:

```bash
sudo nano /opt/news-reader/webhooks.json
```

```json
[
  {
    "id": "deploy-newsreader",
    "execute-command": "/opt/news-reader/deploy.sh",
    "command-working-directory": "/opt/news-reader",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "YOUR_WEBHOOK_SECRET_HERE",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/main",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
```

Run the webhook listener as a systemd service:

```bash
sudo nano /etc/systemd/system/webhook-newsreader.service
```

```ini
[Unit]
Description=GitHub Webhook Listener for News Reader
After=network.target docker.service

[Service]
Type=simple
ExecStart=/usr/bin/webhook -hooks /opt/news-reader/webhooks.json -port 9000 -verbose
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable webhook-newsreader
sudo systemctl start webhook-newsreader
```

Add a proxy route in Nginx Proxy Manager for the webhook:
1. Edit the `api.yourdomain.com` proxy host > **Advanced** tab
2. Add:

```nginx
location /hooks/ {
    proxy_pass http://127.0.0.1:9000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Configure GitHub:
1. Go to your repo > **Settings** > **Webhooks** > **Add webhook**
2. Fill in:

| Field | Value |
|---|---|
| Payload URL | `https://api.yourdomain.com/hooks/deploy-newsreader` |
| Content type | `application/json` |
| Secret | same as `YOUR_WEBHOOK_SECRET_HERE` above |
| Events | Just the push event |
| Active | checked |

3. Click **Add webhook**
4. Test: push a commit to `main` and check `/opt/news-reader/deploy.log`

### Option B: Cron poll (simpler, 5-minute delay)

If you don't want to set up webhooks:

```bash
sudo crontab -e
```

```cron
*/5 * * * * cd /opt/news-reader && git fetch origin main --quiet && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ] && /opt/news-reader/deploy.sh >> /opt/news-reader/deploy.log 2>&1
```

---

## 11. Update Vercel Frontend

Once the backend is confirmed working on your server:

1. Go to **Vercel dashboard** > your project > **Settings** > **Environment Variables**
2. Change `VITE_API_URL`:

```
# Old (Railway)
VITE_API_URL=https://your-railway-app.up.railway.app/api

# New (self-hosted)
VITE_API_URL=https://api.yourdomain.com/api
```

3. Trigger a redeploy: **Deployments** > latest > **Redeploy**
4. Wait for the build to finish, then test the live site

---

## 12. Verify Everything Works

Run through this checklist before decommissioning Railway:

- [ ] `curl https://api.yourdomain.com/api/categories` returns JSON
- [ ] Vercel frontend loads and shows news summaries
- [ ] Generating a new summary works (tests LLM API keys)
- [ ] Fetching jobs works
- [ ] Chat feature works
- [ ] Bias Radar panel loads
- [ ] MindGames section works
- [ ] Telegram send works (if configured)
- [ ] Container auto-restarts after `docker restart newsreader-api`
- [ ] Push a test commit to `main` — auto-deploy triggers
- [ ] Check CasaOS dashboard shows the container as healthy

---

## 13. Decommission Railway

**Wait at least 3-5 days** with everything running on the new server before doing this.

1. Take a final DB backup from Railway as insurance
2. In Railway dashboard: delete the service (or the entire project)
3. Remove `server/nixpacks.toml` from the repo (optional cleanup)
4. Cancel your Railway subscription if no longer needed

---

## 14. Maintenance & Backups

### Automated database backups

```bash
sudo nano /opt/news-reader/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR=/DATA/AppData/newsreader/backups
DB_PATH=/DATA/AppData/newsreader/db/newsreader.db
mkdir -p "$BACKUP_DIR"

# Stop writes briefly for a clean copy
docker compose -f /opt/news-reader/server/docker-compose.yml pause newsreader-api
cp "$DB_PATH" "$BACKUP_DIR/newsreader-$(date +%Y%m%d-%H%M%S).db"
docker compose -f /opt/news-reader/server/docker-compose.yml unpause newsreader-api

# Keep last 30 backups
ls -t "$BACKUP_DIR"/*.db 2>/dev/null | tail -n +31 | xargs -r rm
echo "Backup complete: $(date)"
```

```bash
sudo chmod +x /opt/news-reader/backup-db.sh

# Run daily at 3 AM
sudo crontab -e
# Add:
0 3 * * * /opt/news-reader/backup-db.sh >> /opt/news-reader/backup.log 2>&1
```

### Viewing logs

```bash
# Via CasaOS: click the app > Logs tab

# Via command line
docker compose -f /opt/news-reader/server/docker-compose.yml logs -f --tail 100

# Deploy log
tail -f /opt/news-reader/deploy.log
```

### Updating manually

```bash
cd /opt/news-reader
git pull origin main
cd server && docker compose up -d --build
```

### Updating Node.js

Change the `FROM node:22-slim` line in the Dockerfile to the desired version, then rebuild:

```bash
cd /opt/news-reader/server
docker compose up -d --build
```

---

## 15. Rollback Plan

If anything goes wrong mid-migration:

1. **Frontend**: Change `VITE_API_URL` back to the Railway URL in Vercel and redeploy — instant rollback
2. **Data**: Your Railway DB is untouched until you explicitly decommission it
3. **Parallel running**: Both Railway and self-hosted can run simultaneously since they're independent

**Recommended migration timeline:**
| Day | Action |
|---|---|
| Day 1 | Set up container, proxy, and deploy pipeline (steps 1-10) |
| Day 2 | Migrate DB, switch Vercel to new backend (steps 8, 11) |
| Day 2-5 | Monitor, check all features (step 12) |
| Day 5+ | Decommission Railway (step 13) |

---

## 16. Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs newsreader-api

# Common: better-sqlite3 compiled for wrong arch
# Fix: rebuild without cache
docker compose build --no-cache && docker compose up -d
```

### "SQLITE_CANTOPEN" error

```bash
# Check volume permissions
ls -la /DATA/AppData/newsreader/db/
# Should be owned by UID 1000 (node user)
sudo chown -R 1000:1000 /DATA/AppData/newsreader/db/
```

### Let's Encrypt SSL fails

- Verify your domain DNS A record points to your server's public IP
- Verify ports 80 and 443 are forwarded on your router
- Check NPM logs: Dashboard > Nginx Proxy Manager > Logs

### Webhook not triggering deploys

```bash
# Check the webhook listener is running
sudo systemctl status webhook-newsreader

# Check the log
journalctl -u webhook-newsreader -f

# Test manually
curl -X POST http://localhost:9000/hooks/deploy-newsreader
```

### CORS errors in browser

- Check the NPM Advanced tab has the correct CORS headers
- Ensure the `Access-Control-Allow-Origin` value matches your exact Vercel domain (including `https://`)
- Check browser dev tools Network tab for the actual error

### Container not visible in CasaOS dashboard

If you deployed via command line, CasaOS may not auto-discover it. Re-import using the CasaOS UI: **+** > **Install a customized app** > **Docker Compose** and paste the compose file.

---

## Quick Reference

| What | Where |
|---|---|
| Repo on server | `/opt/news-reader` |
| Docker Compose | `/opt/news-reader/server/docker-compose.yml` |
| Env vars | `/opt/news-reader/server/.env` |
| Database | `/DATA/AppData/newsreader/db/newsreader.db` |
| DB backups | `/DATA/AppData/newsreader/backups/` |
| Deploy script | `/opt/news-reader/deploy.sh` |
| Deploy log | `/opt/news-reader/deploy.log` |
| Webhook config | `/opt/news-reader/webhooks.json` |
| NPM admin UI | `http://YOUR_SERVER_IP:81` |
| CasaOS dashboard | `http://YOUR_SERVER_IP:7778` |
