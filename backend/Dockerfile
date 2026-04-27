# Multi-stage build: smaller final image, no dev deps, no source.
# Works on Railway, Fly, Render, or any container platform.

# ---------- Stage 1: build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps with lockfile (falls back to `install` if no lockfile yet).
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Generate Prisma client + compile TypeScript.
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npx nest build

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Only the production deps (prisma client + runtime libs).
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Compiled output + Prisma schema (needed for `prisma migrate deploy`).
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Non-root user for defence-in-depth.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 4000

# Run migrations then start. `prisma migrate deploy` is idempotent — it
# applies only pending migrations and exits 0 if everything is up to date.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

# Platform health probes should hit GET /health (200 OK when the process
# is up; does NOT hit the DB so a transient Redis/DB blip doesn't kill
# the pod).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health || exit 1
