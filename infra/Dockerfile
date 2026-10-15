# Production image: API + built storefront in one container.
# The API serves the SPA with server-side SEO tags (see apps/api/src/seo).

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY prisma prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=4000 \
    WEB_DIST_PATH=/app/apps/web/dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/infra/scripts ./infra/scripts
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
RUN mkdir -p /app/apps/api/uploads && chown -R node:node /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, load demo data into an empty DB (only if SEED_ON_EMPTY=true), then start.
# Working dir = apps/api (uploads/ and .mail/ live there).
CMD ["sh", "-c", "npx prisma migrate deploy && node infra/scripts/seed-if-empty.mjs && cd apps/api && node dist/main.js"]
