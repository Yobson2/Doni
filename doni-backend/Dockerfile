# Doni backend image. Build from the repository root, so the workspace
# lockfile is in the context:
#
#   docker build -f doni-backend/Dockerfile -t doni-backend .

# ─── Dependencies: downloaded once, exactly as locked ───────────────
FROM node:20-alpine AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    npm_config_update_notifier=false
# pnpm version comes from "packageManager" in the root package.json.
RUN corepack enable
WORKDIR /repo
# Workspace manifests only, so this layer is cached until a dependency
# changes. Every workspace package.json is needed for --frozen-lockfile
# to match the lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY doni-backend/package.json doni-backend/
COPY doni-frontend/package.json doni-frontend/
RUN pnpm install --frozen-lockfile --filter doni-backend

# ─── Build ──────────────────────────────────────────────────────────
FROM deps AS build
COPY doni-backend/ doni-backend/
RUN pnpm --filter doni-backend build

# ─── Production dependencies, from the store above (no download) ────
FROM deps AS prod-deps
RUN rm -rf node_modules doni-backend/node_modules && \
    pnpm install --frozen-lockfile --prod --offline --filter doni-backend

# ─── Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV NODE_ENV=production
ENV RUNNING_IN_DOCKER=true

WORKDIR /repo

# pnpm keeps packages in the root node_modules/.pnpm store and links them
# into doni-backend/node_modules: both are needed.
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/doni-backend/node_modules ./doni-backend/node_modules
COPY --from=build /repo/doni-backend/package.json ./doni-backend/
COPY --from=build /repo/doni-backend/dist ./doni-backend/dist
COPY --from=build /repo/doni-backend/templates ./doni-backend/templates

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser
# Templates are resolved from the working directory.
WORKDIR /repo/doni-backend

EXPOSE 3000

CMD ["node", "dist/main.js"]
