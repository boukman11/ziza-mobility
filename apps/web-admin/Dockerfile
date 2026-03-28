# syntax=docker/dockerfile:1.5
FROM node:20-alpine
WORKDIR /repo

# Reduce noisy/slow npm steps in Docker builds
ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_LOGLEVEL=warn \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_PREFER_OFFLINE=true

# Copy monorepo sources needed for build
COPY packages/shared ./packages/shared
COPY apps/web-admin ./apps/web-admin

# Use BuildKit cache for npm downloads (shared across builds)
WORKDIR /repo/packages/shared
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --no-audit --no-fund

WORKDIR /repo/apps/web-admin
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --no-audit --no-fund
RUN npm run build

EXPOSE 3002
CMD ["npm","run","dev","--","--host","0.0.0.0","--port","3002"]
