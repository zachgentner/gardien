# Gardien API image. Build context is the repo ROOT (monorepo workspaces).
#   docker build -f apps/api/Dockerfile -t gardien-api .
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# --- Dependencies (cached on lockfile) ---
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

# --- Source ---
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Generate the Prisma client into node_modules.
WORKDIR /app/apps/api
RUN npx prisma generate

EXPOSE 3000
# Apply migrations, seed if empty, then run the API (via tsx — see start script).
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
