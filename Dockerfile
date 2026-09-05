# syntax=docker/dockerfile:1

# --- Etapa 1: build ---
FROM node:20-slim AS build
WORKDIR /app

# Instala o pnpm diretamente (mais robusto que corepack em redes restritas/
# Docker Desktop no Windows, onde a verificação de assinatura do corepack
# pode falhar). Versão fixa alinhada ao "packageManager" do package.json.
RUN npm install -g pnpm@10.4.1

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
# O build (vite build + esbuild) não precisa de DATABASE_URL real —
# é apenas bundling estático (validado em sessão de desenvolvimento).
RUN pnpm run build

# --- Etapa 2: runtime ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@10.4.1
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
