#!/usr/bin/env bash
#
# Publica a imagem no Docker Hub, para linux/amd64 E linux/arm64.
#
# As duas arquiteturas não são luxo: você desenvolve num Mac ARM, mas o CI e os
# servidores onde os outros projetos vão rodar são quase sempre x86. Publicar só
# arm64 produz um `exec format error` na primeira vez que alguém sobe isso no CI —
# e o erro não diz "arquitetura errada", diz que o binário não existe.
#
#   ./tools/release.sh              # publica a versão do package.json + latest
#   ./tools/release.sh 1.2.0        # publica uma versão explícita
#   DRY_RUN=1 ./tools/release.sh    # constrói tudo, não empurra nada
#
set -euo pipefail

IMAGE="${IMAGE:-mpiresdev/asaas-mock-server}"
VERSION="${1:-$(bun -e 'console.log((await Bun.file("package.json").json()).version)')}"
REVISION="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
PLATFORMS="linux/amd64,linux/arm64"

echo "  imagem     $IMAGE"
echo "  versão     $VERSION  (+ latest)"
echo "  commit     $REVISION"
echo "  plataformas $PLATFORMS"
echo

# A suíte é a única coisa que separa "um simulador do Asaas" de "um mock que mente
# com confiança". Publicar sem ela passar é publicar uma mentira — e desta vez
# distribuída, para dentro de outros projetos.
echo "→ typecheck e testes"
bunx tsc --noEmit
bun test

# `docker buildx build --platform a,b` precisa de um builder que não seja o driver
# `docker` padrão (ele só sabe uma arquitetura de cada vez).
if ! docker buildx inspect asaas-builder >/dev/null 2>&1; then
  echo "→ criando o builder multi-arch"
  docker buildx create --name asaas-builder --driver docker-container --bootstrap
fi

PUSH="--push"
if [ -n "${DRY_RUN:-}" ]; then
  echo "→ DRY_RUN: constrói mas NÃO empurra"
  PUSH=""
fi

echo "→ build multi-arch"
docker buildx build \
  --builder asaas-builder \
  --platform "$PLATFORMS" \
  --build-arg "VERSION=$VERSION" \
  --build-arg "REVISION=$REVISION" \
  --tag "$IMAGE:$VERSION" \
  --tag "$IMAGE:latest" \
  $PUSH \
  .

if [ -z "${DRY_RUN:-}" ]; then
  echo
  echo "✓ publicado: $IMAGE:$VERSION e $IMAGE:latest"
  docker buildx imagetools inspect "$IMAGE:$VERSION" | grep -E "Name|Platform"
fi
