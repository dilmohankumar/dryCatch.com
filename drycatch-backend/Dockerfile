# Multi-stage build (Phase 21, rule #12) — the `deps` stage installs
# production-only dependencies once and is cached across rebuilds as long
# as package*.json doesn't change; the final image copies only what's
# needed to run, never devDependencies (vitest/supertest/mongodb-memory-server),
# never .env, never .git.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Non-root user (rule #12) — the base image ships a `node` user already;
# just switch to it rather than inventing a new one.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
COPY src ./src

USER node

EXPOSE 5000

# Health check (rule #38) — a cheap liveness probe, not an expensive
# dependency check (that's what /ready is for, hit separately by an
# orchestrator's readiness probe, not this container-level check).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
