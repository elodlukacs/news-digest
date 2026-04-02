# Migrating the News Reader Frontend from Vercel to CasaOS (Docker)

## Overview

Step-by-step guide to migrate the React 19 + Vite + TypeScript frontend from Vercel to your self-hosted CasaOS server, served as a static SPA from an Nginx container, with automated CI/CD via GitHub Actions on push to `main`.

**Current state:** Vercel builds the Vite app and serves `client/dist/` as a static site. The app fetches data from the backend via `VITE_API_URL` (set as a Vercel env var).

**Target state:** Same Vite build runs inside a Docker multi-stage container. Nginx serves the static files. Cloudflare Tunnel routes traffic. GitHub Actions deploys on push.

**Target architecture:**

```
  Internet (users)
        │
   ┌────▼─────────────┐
   │  Cloudflare       │  app.yourdomain.com (or yourdomain.com)
   │  Tunnel           │  (zero-trust, no open ports)
   └────┬─────────────┘
        │
   ┌────▼─────────────┐
   │  CasaOS (Ubuntu)  │
   │  Docker           │
   │  ┌──────────────┐ │
   │  │ newsreader   │ │  Nginx container :8080
   │  │  (static SPA) │ │  serves client/dist/
   │  └──────────────┘ │
   └───────────────────┘

GitHub push (client/**) → Actions → SSH → git pull → docker compose up --build
```

---

## Migration Steps (Do These In Order)

### Step 1: Gather prerequisites

| Prerequisite | Where to find it |
|---|---|
| CasaOS server IP and SSH credentials | Your server / router config |
| Cloudflare account with your domain | https://dash.cloudflare.com |
| GitHub repo admin access | To add Secrets and workflow files |
| Current `VITE_API_URL` from Vercel | Vercel project → Settings → Environment Variables |
| Backend URL from the migration | From `BACKEND_MIGRATION_GUIDE.md` Step 5 — e.g. `https://api.yourdomain.com/api` |

**Note:** If you haven't migrated the backend yet, do that first (see `BACKEND_MIGRATION_GUIDE.md`). The frontend needs a reachable backend URL.

---

### Step 2: Create and commit deployment files

Create the following files in the repo.

#### 2a. `client/Dockerfile`

```dockerfile
# Stage 1: Build the Vite app
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
```

**Key decisions:**
- **Multi-stage build** — Node.js build tools stay in the builder stage. Production image is just Nginx + static files (~25MB).
- **`ARG VITE_API_URL`** — passed at build time via docker-compose so Vite bakes it into the JS bundle. Defaults to `/api` (relative path).
- **Port 8080** — avoids conflicting with CasaOS services that may use port 80.

#### 2b. `client/nginx.conf`

```nginx
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 256;

    # Cache static assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Fonts and icons
    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        expires 6M;
        add_header Cache-Control "public";
    }

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

#### 2c. `client/.dockerignore`

```
node_modules
dist
.DS_Store
```

#### 2d. `client/docker-compose.yml`

```yaml
services:
  newsreader-web:
    build:
      context: .
      args:
        - VITE_API_URL=${VITE_API_URL:-/api}
    container_name: newsreader-web
    restart: unless-stopped
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/"]
      interval: 30s
      timeout: 5s
      start_period: 5s
      retries: 3
```

**Key points:**
- `VITE_API_URL` is a **build-time argument** — it's baked into the JavaScript bundle during `npm run build`. You must rebuild the container to change it.
- No volumes needed — this is a static site, no persistent data.
- Health check is a simple wget to the Nginx root.

#### 2e. `.github/workflows/deploy-frontend.yml`

```yaml
name: Deploy Frontend to CasaOS

on:
  push:
    branches: [main]
    paths:
      - 'client/**'
      - '.github/workflows/deploy-frontend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          port: ${{ secrets.DEPLOY_PORT || 22 }}
          command_timeout: 10m
          script: |
            ~/newsreader/deploy-frontend.sh
```

#### 2f. Commit everything

```bash
git add client/Dockerfile client/nginx.conf client/.dockerignore client/docker-compose.yml .github/workflows/deploy-frontend.yml FRONTEND_MIGRATION_GUIDE.md
git commit -m "Add CasaOS frontend deployment config"
git push origin main
```

> **Safe.** These files don't affect your Vercel deployment. Vercel uses its own build pipeline.

---

### Step 3: Set up the CasaOS server

SSH into your CasaOS server.

#### 3a. Create the .env file for the frontend

```bash
cat > ~/newsreader/repo/client/.env << 'EOF'
VITE_API_URL=https://api.yourdomain.com/api
EOF
```

This is read by `docker-compose.yml` as a build arg. It tells the Vite build where the backend is.

> **Important:** If you're using the same Cloudflare Tunnel for both frontend and backend, and you want to use a relative path instead, set `VITE_API_URL=/api` and add an Nginx reverse proxy rule (see [Alternative: Same-domain setup](#alternative-same-domain-setup) at the bottom).

#### 3b. Create the frontend deploy script

```bash
cat > ~/newsreader/deploy-frontend.sh << 'DEPLOY'
#!/bin/bash
set -euo pipefail

REPO_DIR="$HOME/newsreader/repo"
BRANCH="main"

echo "=== Frontend deploy started at $(date) ==="

cd "$REPO_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

cd "$REPO_DIR/client"
docker compose up -d --build

sleep 3

if docker ps | grep -q newsreader-web; then
    echo "=== Frontend deploy successful at $(date) ==="
else
    echo "=== ERROR: Frontend container failed to start ==="
    docker logs newsreader-web --tail 30
    exit 1
fi
DEPLOY

chmod +x ~/newsreader/deploy-frontend.sh
```

#### 3c. Build and start the container

```bash
cd ~/newsreader/repo/client
docker compose up -d --build
```

First build will take ~2-3 minutes (npm install + Vite build).

#### 3d. Verify

```bash
docker ps | grep newsreader-web
docker logs newsreader-web --tail 10
curl http://localhost:8080
```

You should see the HTML of your app.

#### 3e. (Optional) Add as CasaOS custom app

1. Open CasaOS web UI → **App Store → Custom App**
2. Paste:

```yaml
services:
  newsreader-web:
    build:
      context: /home/your-user/newsreader/repo/client
      args:
        - VITE_API_URL=https://api.yourdomain.com/api
    container_name: newsreader-web
    restart: unless-stopped
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/"]
      interval: 30s
      timeout: 5s
      start_period: 5s
      retries: 3
```

3. Click **Install**

---

### Step 4: Set up Cloudflare Tunnel

Add a new route to your existing Cloudflare Tunnel (the same one from the backend migration).

#### 4a. Add a public hostname

1. Go to **Cloudflare Dashboard → Zero Trust → Networks → Tunnels**
2. Click your existing `casaos` tunnel → **Public Hostname** tab
3. Click **Add a public hostname**

| Field | Value |
|---|---|
| Subdomain | `app` (or `@` for root domain) |
| Domain | `yourdomain.com` |
| Service Type | `HTTP` |
| URL | `localhost:8080` |

4. Save

#### 4b. Verify

```bash
curl https://app.yourdomain.com
```

You should see the HTML of your app. The SPA should load in a browser and fetch data from the backend.

---

### Step 5: Set up CI/CD

The GitHub Actions workflow was committed in Step 2. It reuses the same SSH deploy secrets from the backend migration (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`).

#### 5a. Verify secrets exist

The backend migration already created these. Confirm in GitHub → **Settings → Secrets and variables → Actions**:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PORT`

#### 5b. Test the pipeline

```bash
# Make a trivial change
echo "# deploy target: CasaOS" >> client/README.md
git add client/README.md
git commit -m "test: verify frontend CI/CD pipeline"
git push origin main
```

Go to **Actions** tab in GitHub — you should see both the backend and frontend workflows (if both were triggered). The frontend one should succeed.

On the server:

```bash
docker logs newsreader-web --tail 5
```

---

### Step 6: Cut over — decommission Vercel

#### 6a. Verify end-to-end

1. Open `https://app.yourdomain.com` in a browser
2. Check that the app loads, themes work, fonts load
3. Verify categories, feeds, summaries load from the backend
4. Test chat, bias radar, and other LLM features
5. Test on mobile (PWA manifest, touch targets)
6. Check browser console for any errors (CORS, failed API calls)

#### 6b. Update DNS if using root domain

If you're using `yourdomain.com` (root) instead of `app.yourdomain.com`:

1. Cloudflare Tunnel already handles this — just add `@` as the subdomain in Step 4a
2. Remove the Vercel DNS records if they conflict

#### 6c. Decommission Vercel (when ready)

1. Keep Vercel running for a few days as fallback
2. When confident, go to Vercel dashboard → your project → **Settings → Delete Project**
3. Remove any Vercel-specific files from the repo if you want (e.g. `vercel.json` if it exists)

---

## Alternative: Same-domain setup

If you want both frontend and backend on the same domain (e.g. `yourdomain.com` for the frontend, `yourdomain.com/api` proxied to the backend), you can add a reverse proxy rule to `nginx.conf`:

```nginx
# Add BEFORE the SPA fallback location block:
location /api/ {
    proxy_pass http://host.docker.internal:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;

    # LLM endpoints can be slow
    location /api/chat/ {
        proxy_pass http://host.docker.internal:3001;
        proxy_read_timeout 300s;
    }
}
```

Then set `VITE_API_URL=/api` (relative path — no CORS issues, no separate backend domain needed).

You'd only need one Cloudflare Tunnel route: `yourdomain.com` → `localhost:8080`.

> **Note:** `host.docker.internal` resolves to the Docker host on most setups. If it doesn't work on your CasaOS box, use the host's actual LAN IP or add `extra_hosts: - "host.docker.internal:host-gateway"` to docker-compose.yml.

---

## Reference

### Architecture details

| Component | What it does |
|---|---|
| **Dockerfile** (multi-stage) | Stage 1: `npm ci` + `npm run build` (Vite produces `dist/`). Stage 2: Nginx Alpine serves `dist/`. Final image ~25MB. |
| **nginx.conf** | SPA fallback (`try_files`), gzip, aggressive asset caching (1y for `/assets/`), security headers. Port 8080. |
| **docker-compose.yml** | Build arg `VITE_API_URL` passed to Dockerfile. Health check via wget. No volumes (stateless). |
| **Cloudflare Tunnel** | Reuses the same tunnel as the backend. Adds a second hostname: `app.yourdomain.com` → `localhost:8080`. |

### Environment variables

| Variable | Where set | When | Description |
|---|---|---|---|
| `VITE_API_URL` | `client/.env` on server | Build time | Backend API URL. Baked into JS bundle by Vite. Must rebuild container to change. |

To change the backend URL after deployment:

```bash
nano ~/newsreader/repo/client/.env    # update VITE_API_URL
cd ~/newsreader/repo/client
docker compose up -d --build          # must rebuild, not just restart
```

### Rollback procedure

```bash
ssh your-user@your-server-ip
cd ~/newsreader/repo
git log --oneline -5
git reset --hard <previous-commit-hash>
cd client
docker compose up -d --build
```

### Quick reference

| Task | Command |
|---|---|
| View container logs | `docker logs newsreader-web -f` |
| Rebuild container | `cd ~/newsreader/repo/client && docker compose up -d --build` |
| Restart container | `cd ~/newsreader/repo/client && docker compose restart` |
| Stop container | `cd ~/newsreader/repo/client && docker compose down` |
| Manual deploy | `ssh server '~/newsreader/deploy-frontend.sh'` |
| Update API URL | `nano ~/newsreader/repo/client/.env && cd ~/newsreader/repo/client && docker compose up -d --build` |
| Check served files | `docker exec newsreader-web ls /usr/share/nginx/html/` |
| Container shell | `docker exec -it newsreader-web sh` |

---

## Checklist

**Preparation**
- [ ] Backend migration completed (see `BACKEND_MIGRATION_GUIDE.md`)
- [ ] Backend URL confirmed reachable (`curl https://api.yourdomain.com/api/categories`)
- [ ] Current `VITE_API_URL` value noted from Vercel

**Deployment files**
- [ ] `client/Dockerfile` committed (Step 2a)
- [ ] `client/nginx.conf` committed (Step 2b)
- [ ] `client/.dockerignore` committed (Step 2c)
- [ ] `client/docker-compose.yml` committed (Step 2d)
- [ ] `.github/workflows/deploy-frontend.yml` committed (Step 2e)

**Server setup**
- [ ] `client/.env` created with `VITE_API_URL` (Step 3a)
- [ ] `deploy-frontend.sh` created and executable (Step 3b)
- [ ] Container built and serving on `localhost:8080` (Step 3c-3d)

**Networking**
- [ ] Cloudflare Tunnel route added: `app.yourdomain.com` → `localhost:8080` (Step 4)
- [ ] External access verified via browser (Step 4b)

**CI/CD**
- [ ] GitHub Secrets already configured (from backend migration)
- [ ] Test push triggered successful deploy (Step 5b)

**Cutover**
- [ ] End-to-end verification passed (Step 6a)
- [ ] Vercel project decommissioned (Step 6c)

---

## Running Both Frontend + Backend on CasaOS

After completing both migration guides, your server runs two containers:

| Container | Port | Cloudflare route | Purpose |
|---|---|---|---|
| `newsreader-api` | 3001 | `api.yourdomain.com` → `localhost:3001` | Express backend + SQLite |
| `newsreader-web` | 8080 | `app.yourdomain.com` → `localhost:8080` | Nginx serving static SPA |

```bash
# Check both are running
docker ps | grep newsreader

# Logs for both
docker logs newsreader-api -f    # backend
docker logs newsreader-web -f    # frontend

# Redeploy both manually
~/newsreader/deploy.sh           # backend
~/newsreader/deploy-frontend.sh  # frontend
```

Both deploy scripts are triggered automatically by GitHub Actions:
- Changes in `server/**` → redeploys backend only
- Changes in `client/**` → redeploys frontend only
- Changes in both → redeploys both (two parallel Actions jobs)
