# Migrating the News Reader Backend from Railway to CasaOS (Docker)

## Overview

Step-by-step guide to migrate the Express 5 + SQLite backend from Railway to your self-hosted CasaOS server, with automated CI/CD via GitHub Actions on push to `main`.

**Target architecture:**

```
  Internet (Vercel frontend)
        │
   ┌────▼─────────────┐
   │  Cloudflare       │  api.yourdomain.com
   │  Tunnel           │  (zero-trust, no open ports)
   └────┬─────────────┘
        │
   ┌────▼─────────────┐
   │  CasaOS (Ubuntu)  │
   │  Docker           │
   │  ┌──────────────┐ │
   │  │ newsreader   │ │  container :3001
   │  │  (Node.js)22) │ │
   │  └──────┬───────┘ │
   │         │         │
   │  ┌──────▼───────┐ │
   │  │ Docker Volume │ │  /data/newsreader.db (persistent)
   │  └──────────────┘ │
   └───────────────────┘

GitHub push (server/**) → Actions → SSH → git pull → docker compose up --build
```

---

## Migration Steps (Do These In Order)

### Step 1: Gather prerequisites

You need the following before starting:

| Prerequisite | Where to find it |
|---|---|
| CasaOS server IP and SSH credentials | Your server / router config |
| Cloudflare account with your domain | https://dash.cloudflare.com |
| GitHub repo admin access | To add Secrets and workflow files |
| Railway project access | To export the existing database |
| API keys from Railway env vars | `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TMDB_API_KEY` |
| Vercel project access | To update `VITE_API_URL` |

**Export env vars from Railway now:**

1. Go to your Railway project → your backend service → **Variables** tab
2. Copy all values — you'll need them in Step 4

---

### Step 2: Commit deployment files to the repo

The following files already exist in your repo. Verify they're committed and pushed:

| File | Purpose |
|---|---|
| `server/Dockerfile` | Multi-stage build: compiles `better-sqlite3` in builder, ships clean production image |
| `server/.dockerignore` | Excludes `node_modules`, DB files, `.env` from build context |
| `server/docker-compose.yml` | Container config: port 3001, persistent volume, health check, 30s grace period |
| `.github/workflows/deploy-backend.yml` | CI/CD: triggers on push to `main` with `server/**` changes |

```bash
# From the repo root on your local machine
git add server/Dockerfile server/.dockerignore server/docker-compose.yml .github/workflows/deploy-backend.yml MIGRATION_GUIDE.md
git commit -m "Add CasaOS deployment config"
git push origin main
```

> **This is safe.** These files are inert — they don't affect your Railway deployment in any way. Railway uses `nixpacks.toml` + `Procfile`, not Docker.

---

### Step 3: Set up the CasaOS server

SSH into your CasaOS server:

```bash
ssh your-user@your-server-ip
```

#### 3a. Verify Docker is available

```bash
docker --version
docker compose version
```

CasaOS includes Docker. If for some reason it's missing, install it:

```bash
curl -fsSL https://get.docker.com | sh
```

#### 3b. Clone the repo

```bash
mkdir -p ~/newsreader
git clone https://github.com/<YOUR_USERNAME>/news-reader.git ~/newsreader/repo
```

#### 3c. Create the .env file

Use the values you exported from Railway in Step 1:

```bash
cat > ~/newsreader/repo/server/.env << 'EOF'
GROQ_API_KEY=<paste from Railway>
TELEGRAM_BOT_TOKEN=<paste from Railway>
TELEGRAM_CHAT_ID=<paste from Railway>
TMDB_API_KEY=<paste from Railway>
EOF

chmod 600 ~/newsreader/repo/server/.env
```

> `PORT` (3001) and `DB_PATH` (`/data/newsreader.db`) are set in the Dockerfile and docker-compose.yml — don't add them to `.env`.

#### 3d. Create the deploy script

This is what GitHub Actions will call on every push:

```bash
cat > ~/newsreader/deploy.sh << 'DEPLOY'
#!/bin/bash
set -euo pipefail

REPO_DIR="$HOME/newsreader/repo"
BRANCH="main"

echo "=== Deploy started at $(date) ==="

cd "$REPO_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

cd "$REPO_DIR/server"
docker compose up -d --build

sleep 5

if docker ps | grep -q newsreader-api; then
    echo "=== Deploy successful at $(date) ==="
else
    echo "=== ERROR: Container failed to start ==="
    docker logs newsreader-api --tail 30
    exit 1
fi
DEPLOY

chmod +x ~/newsreader/deploy.sh
```

#### 3e. Build and start the container

```bash
cd ~/newsreader/repo/server
docker compose up -d --build
```

This will take a few minutes on first run (compiles `better-sqlite3` from source).

#### 3f. Verify

```bash
docker ps | grep newsreader-api
docker logs newsreader-api --tail 20
curl http://localhost:3001/api/categories
```

You should see a JSON response (empty categories if no data imported yet).

#### 3g. (Optional) Add as CasaOS custom app

If you want the container visible in the CasaOS UI:

1. Open CasaOS web UI → **App Store → Custom App**
2. Paste the docker-compose content with absolute paths:

```yaml
services:
  newsreader:
    build: /home/your-user/newsreader/repo/server
    container_name: newsreader-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - newsreader-data:/data
    env_file:
      - /home/your-user/newsreader/repo/server/.env
    environment:
      - DB_PATH=/data/newsreader.db
    stop_grace_period: 30s
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/api/categories').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3

volumes:
  newsreader-data:
    driver: local
```

3. Click **Install**

---

### Step 4: Export data from Railway and import to CasaOS

#### 4a. Export from Railway

**Option A: Railway CLI**

```bash
npm install -g @railway/cli
railway login
railway link   # select your project and backend service

# Download the database file
railway run cat $DB_PATH > ./newsreader_railway_export.db
```

**Option B: Railway Dashboard**

1. Go to your service → **Deployments** → click the active deployment
2. Open a **terminal** shell
3. Run: `echo $DB_PATH` to find the path, then `cat $DB_PATH` and copy the output
4. Or use Railway's volume snapshot/backup feature

#### 4b. Upload to CasaOS server

```bash
# From your local machine
scp ./newsreader_railway_export.db your-user@your-server-ip:/tmp/newsreader_import.db
```

#### 4c. Import into the Docker volume

```bash
ssh your-user@your-server-ip

# Stop the container first (so no writes happen during import)
cd ~/newsreader/repo/server
docker compose down

# Copy into the volume
docker run --rm -v newsreader-data:/data -v /tmp:/backup alpine \
  cp /backup/newsreader_import.db /data/newsreader.db

# Verify the file is there
docker run --rm -v newsreader-data:/data alpine ls -la /data/

# Start the container
docker compose up -d
```

#### 4d. Verify the data

```bash
curl http://localhost:3001/api/categories
curl http://localhost:3001/api/feeds
```

You should see your categories and feeds from Railway.

---

### Step 5: Set up Cloudflare Tunnel

This exposes `api.yourdomain.com` to the internet via your existing Cloudflare account — no open ports, no Nginx, no certbot.

#### 5a. Create the tunnel

1. Go to **Cloudflare Dashboard → Zero Trust → Networks → Tunnels**
2. Click **Create a tunnel**
3. Name it `casaos`
4. Follow the instructions to install `cloudflared` on your server:

```bash
# On the CasaOS server
sudo cloudflared service install <YOUR_TUNNEL_TOKEN>
```

#### 5b. Configure the route

In the tunnel's **Public Hostname** tab, add:

| Field | Value |
|---|---|
| Subdomain | `api` |
| Domain | `yourdomain.com` |
| Service Type | `HTTP` |
| URL | `localhost:3001` |

Save — the tunnel routes `https://api.yourdomain.com` → `http://localhost:3001` on your server.

#### 5c. Verify

```bash
curl https://api.yourdomain.com/api/categories
```

You should get the same JSON response as `localhost:3001`. Cloudflare handles SSL automatically.

---

### Step 6: Set up CI/CD (GitHub Actions → SSH deploy)

This makes every push to `main` with changes in `server/` automatically deploy to your CasaOS server.

#### 6a. Generate an SSH deploy key

```bash
# On your LOCAL machine
ssh-keygen -t ed25519 -C "github-deploy-newsreader" -f ~/.ssh/newsreader_deploy

# Copy the public key to the CasaOS server
ssh-copy-id -i ~/.ssh/newsreader_deploy.pub your-user@your-server-ip
```

Verify it works:

```bash
ssh -i ~/.ssh/newsreader_deploy your-user@your-server-ip 'echo OK'
```

#### 6b. Add GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | Your CasaOS server IP or hostname |
| `DEPLOY_USER` | Your SSH username on the server |
| `DEPLOY_SSH_KEY` | Contents of `~/.ssh/newsreader_deploy` (private key) |
| `DEPLOY_PORT` | SSH port (default: `22`) |

#### 6c. Verify the workflow file

The workflow file `.github/workflows/deploy-backend.yml` should already be committed (from Step 2). It triggers on:

- Push to `main` branch
- Changes in `server/**` or the workflow file itself

#### 6d. Test the pipeline

Make a trivial change and push:

```bash
# In the server/ directory, make a small change
echo "# deploy target: CasaOS" >> server/README.md
git add server/README.md
git commit -m "test: verify CI/CD pipeline"
git push origin main
```

Go to **Actions** tab in GitHub — you should see the workflow run and succeed.

On the server, verify the container was rebuilt:

```bash
docker logs newsreader-api --tail 5
```

---

### Step 7: Set up backups

On the CasaOS server:

```bash
cat > ~/newsreader/backup-db.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

BACKUP_DIR="$HOME/newsreader/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

docker exec newsreader-api sqlite3 /data/newsreader.db \
  ".backup '/data/newsreader_$TIMESTAMP.db'"

docker run --rm -v newsreader-data:/data -v "$BACKUP_DIR":/backup alpine \
  cp "/data/newsreader_$TIMESTAMP.db" "/backup/newsreader_$TIMESTAMP.db"

docker exec newsreader-api rm -f "/data/newsreader_$TIMESTAMP.db"

ls -t "$BACKUP_DIR"/newsreader_*.db | tail -n +31 | xargs -r rm --

echo "[$(date)] Backup created: newsreader_$TIMESTAMP.db"
SCRIPT

chmod +x ~/newsreader/backup-db.sh
```

Test it:

```bash
~/newsreader/backup-db.sh
ls -la ~/newsreader/backups/
```

Set up daily cron:

```bash
crontab -e
# Add:
# 0 3 * * * /home/your-user/newsreader/backup-db.sh >> /home/your-user/newsreader/backups/backup.log 2>&1
```

---

### Step 8: Cut over — update the frontend

#### 8a. Update Vercel

1. Go to your Vercel project → **Settings → Environment Variables**
2. Update `VITE_API_URL` to `https://api.yourdomain.com/api`
3. Redeploy the frontend (push a commit or trigger redeploy in Vercel)

#### 8b. Verify end-to-end

1. Open your frontend URL in a browser
2. Check that categories, feeds, and summaries load
3. Test chat and any LLM-powered features
4. Check the CasaOS server logs: `docker logs newsreader-api --tail 20`

#### 8c. Decommission Railway (when ready)

Once everything works:

1. Keep Railway running for a few days as fallback
2. When confident, go to Railway dashboard → your backend service → **Settings → Delete Service**
3. Remove the `nixpacks.toml` and `Procfile` from `server/` if you want (no longer needed)

---

## Reference

### Architecture details

| Component | What it does |
|---|---|
| **Dockerfile** (multi-stage) | Builder stage compiles `better-sqlite3` with `python3/gcc/gnumake`. Production stage ships only compiled `node_modules` + `sqlite3` CLI. Runs as non-root `appuser`. |
| **docker-compose.yml** | Named volume `newsreader-data` at `/data` for SQLite. `stop_grace_period: 30s` for in-flight LLM requests. Health check hits `/api/categories` every 30s. |
| **Cloudflare Tunnel** | Zero-trust ingress — no ports exposed, TLS termination at Cloudflare edge. `api.yourdomain.com` → `localhost:3001`. |
| **GitHub Actions** | On push to `main` with `server/**` changes: SSHs in, runs `deploy.sh` (git pull → docker compose up --build). |

### Environment variables

| Variable | Where set | Description |
|---|---|---|
| `GROQ_API_KEY` | `.env` on server | Groq LLM API key |
| `TELEGRAM_BOT_TOKEN` | `.env` on server | Telegram bot token |
| `TELEGRAM_CHAT_ID` | `.env` on server | Telegram chat ID |
| `TMDB_API_KEY` | `.env` on server | TMDB API key |
| `PORT` | Dockerfile (3001) | Server port |
| `DB_PATH` | docker-compose.yml (`/data/newsreader.db`) | SQLite path inside container |
| `NODE_ENV` | Dockerfile (`production`) | Node environment |

To update secrets: `nano ~/newsreader/repo/server/.env` then `docker compose restart` (in the server dir).

### Rollback procedure

```bash
ssh your-user@your-server-ip
cd ~/newsreader/repo
git log --oneline -5                        # find the working commit
git reset --hard <previous-commit-hash>     # rollback
cd server
docker compose up -d --build                # rebuild with old code
```

### Restore database from backup

```bash
cd ~/newsreader/repo/server
docker compose down

docker run --rm -v newsreader-data:/data -v "$HOME/newsreader/backups":/backup alpine \
  cp /backup/newsreader_YYYYMMDD_HHMMSS.db /data/newsreader.db

docker compose up -d
```

### Quick reference

| Task | Command |
|---|---|
| View container logs | `docker logs newsreader-api -f` |
| Restart container | `cd ~/newsreader/repo/server && docker compose restart` |
| Full rebuild | `cd ~/newsreader/repo/server && docker compose up -d --build` |
| Stop container | `cd ~/newsreader/repo/server && docker compose down` |
| Manual deploy | `ssh server '~/newsreader/deploy.sh'` |
| Backup DB | `~/newsreader/backup-db.sh` |
| Check DB in volume | `docker run --rm -v newsreader-data:/data alpine ls -la /data/` |
| Update .env secrets | `nano ~/newsreader/repo/server/.env && cd ~/newsreader/repo/server && docker compose restart` |
| Container shell | `docker exec -it newsreader-api sh` |
| Check Cloudflare tunnel | `cloudflared tunnel list` |

---

## Checklist

**Preparation**
- [ ] Exported env vars from Railway (Step 1)
- [ ] Committed Dockerfile, docker-compose.yml, .dockerignore, workflow to repo (Step 2)

**Server setup**
- [ ] SSH access to CasaOS server confirmed (Step 3)
- [ ] Repo cloned to `~/newsreader/repo` (Step 3b)
- [ ] `.env` created with all API keys (Step 3c)
- [ ] `deploy.sh` created and executable (Step 3d)
- [ ] Container built and responding on `localhost:3001` (Step 3e-3f)

**Data migration**
- [ ] SQLite database exported from Railway (Step 4a)
- [ ] Database imported into Docker volume (Step 4c)
- [ ] Data verified via `/api/categories` and `/api/feeds` (Step 4d)

**Networking**
- [ ] Cloudflare Tunnel created and `cloudflared` installed on server (Step 5a)
- [ ] Tunnel routes `api.yourdomain.com` → `localhost:3001` (Step 5b)
- [ ] External access verified via `curl https://api.yourdomain.com/api/categories` (Step 5c)

**CI/CD**
- [ ] SSH deploy key generated and public key added to server (Step 6a)
- [ ] GitHub Secrets configured (Step 6b)
- [ ] Test push triggered successful deploy (Step 6d)

**Backups**
- [ ] `backup-db.sh` created and tested (Step 7)
- [ ] Daily cron job configured (Step 7)

**Cutover**
- [ ] Vercel `VITE_API_URL` updated to `https://api.yourdomain.com/api` (Step 8a)
- [ ] Frontend redeployed and working end-to-end (Step 8b)
- [ ] Railway service decommissioned (Step 8c)
