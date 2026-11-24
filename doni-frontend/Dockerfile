# Doni frontend image: the static PWA served by nginx. Build from the
# repository root, so the workspace lockfile is in the context:
#
#   docker build -f doni-frontend/Dockerfile -t doni-frontend .
#
# Set VITE_API_URL when the API is on another origin (read at build time):
#
#   docker build -f doni-frontend/Dockerfile \
#     --build-arg VITE_API_URL=https://api.example.com -t doni-frontend .

# ─── Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    npm_config_update_notifier=false
# pnpm version comes from "packageManager" in the root package.json.
RUN corepack enable
WORKDIR /repo

# Workspace manifests first, so the install layer is cached until a
# dependency changes. Every workspace package.json is needed for
# --frozen-lockfile to match the lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY doni-frontend/package.json doni-frontend/
COPY doni-backend/package.json doni-backend/
RUN pnpm install --frozen-lockfile --filter doni-frontend

COPY doni-frontend/ doni-frontend/

ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter doni-frontend build

# ─── Serve ──────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=build /repo/doni-frontend/dist /usr/share/nginx/html
COPY doni-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
