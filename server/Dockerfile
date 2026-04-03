FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y python3 gcc gnumake && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci && npm rebuild better-sqlite3

FROM node:22-slim

RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules

COPY . .

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser && \
    mkdir -p /data && chown appuser:appuser /data

USER appuser

ENV PORT=3001
ENV DB_PATH=/data/newsreader.db
ENV NODE_ENV=production

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/categories').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "index.js"]
