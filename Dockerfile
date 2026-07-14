FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# O codegen roda no build, offline: lê só a spec vendorizada. O endpoint da spec
# do Asaas responde 429 com facilidade — buscar durante o build tornaria a
# imagem irreprodutível.
RUN bun run codegen && bunx tsc --noEmit

FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

# Sem esta linha o default do código vale (`./data/asaas.db`, dentro de /app), e o
# `VOLUME /data` abaixo vira decoração: um `docker run -v meus-dados:/data` monta um
# volume que fica VAZIO, o banco vive na camada efêmera do container e some no
# primeiro `docker rm` — sem erro nenhum. O compose escapava porque define a
# variável na mão; quem usasse `docker run` perdia os dados em silêncio.
ENV DATABASE_PATH=/data/asaas.db

# Preenchidos pelo `docker buildx bake`/`--build-arg` na hora de publicar.
ARG VERSION=dev
ARG REVISION=unknown

LABEL org.opencontainers.image.title="Asaas Mock Server" \
      org.opencontainers.image.description="Simulador local do Asaas que ENTREGA WEBHOOK EM LOCALHOST — o que o sandbox oficial não faz. Relógio virtual: 32 dias em 40ms." \
      org.opencontainers.image.source="https://github.com/theoxys/asaas-mock-server" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/spec ./spec
COPY --from=build /app/package.json ./

RUN mkdir -p /data && chown -R bun:bun /data /app
USER bun
VOLUME /data

EXPOSE 45445
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "await fetch('http://localhost:'+(process.env.PORT??45445)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "bun run db:migrate && bun src/index.ts"]
