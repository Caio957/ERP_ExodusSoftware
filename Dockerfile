# syntax=docker/dockerfile:1
# ------------------------------------------------------------------
# Exodus Software — imagem monolito para Railway.
# A API Fastify serve a própria API (/api) E o PWA React já compilado.
# ------------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

# Toolchain mínima para módulos nativos (ex.: prisma) no Alpine.
RUN apk add --no-cache libc6-compat openssl

# 1) Instala dependências (com devDeps — precisamos de vite/tsup/tsc para o build).
#    Copiamos apenas os manifests primeiro para aproveitar cache de camadas.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# 2) Copia o código e compila os três pacotes.
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w @exodus/shared \
 && npm run build -w @exodus/api \
 && npm run build -w @exodus/web

# 3) Configuração de runtime (produção).
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV WEB_DIST=/app/apps/web/dist

# A porta real é injetada pelo Railway via $PORT (lida em env.ts).
EXPOSE 3333

# Aplica migrações pendentes e sobe a API (que também serve o PWA).
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/server.js"]
