# Gardien web (PWA) image. Build context is the repo ROOT.
#   docker build -f apps/web/Dockerfile -t gardien-web .
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# In production the web app calls the API on the same origin via /api.
ENV VITE_API_BASE_URL=""
RUN npm run build --workspace @gardien/web

# --- Serve static assets with nginx ---
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
