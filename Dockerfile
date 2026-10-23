# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# 1. Build the static React SPA. There is no backend to compile: the journal
#    lives in each visitor's browser (IndexedDB).
# ---------------------------------------------------------------------------
FROM node:22-slim AS build

WORKDIR /src

RUN npm install --global pnpm@11

# Install dependencies first so this layer is cached until the lockfile changes.
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# ---------------------------------------------------------------------------
# 2. Serve the static files. nginx falls back to index.html so client-side
#    routes keep working on a hard refresh.
# ---------------------------------------------------------------------------
FROM nginx:alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80
