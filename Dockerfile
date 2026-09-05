# syntax=docker/dockerfile:1

# --- Etapa 1: build ---
FROM node:20-slim AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile

COPY . .
# O build (vite build + esbuild) não precisa de DATABASE_URL real —
# é apenas bundling estático (validado em sessão de desenvolvimento).
RUN pnpm run build

# --- Etapa 2: runtime ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable
COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
