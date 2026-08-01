FROM node:20.20-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder

WORKDIR /app
ARG NEXT_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_STANDALONE=$NEXT_STANDALONE

COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
COPY public ./public
COPY src ./src
COPY content ./content
COPY eslint.config.mjs next.config.mjs postcss.config.mjs tsconfig.json vitest.config.ts ./

RUN npx prisma generate
RUN npm run build

FROM dependencies AS migrator

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
COPY prisma ./prisma
COPY content ./content
COPY scripts/admin ./scripts/admin

RUN npx prisma generate

USER node

CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

ARG VCS_REF=unknown
LABEL org.opencontainers.image.revision=$VCS_REF

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

USER nextjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health?db=1').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
