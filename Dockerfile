# Bellwright Companion — web app + save decompressor in one image.
#
# Build (cross-build for amd64 servers from an ARM Mac with):
#   docker buildx build --platform linux/amd64 -t bellwright-companion:latest .
# Run:
#   docker run -p 8710:8710 -v bellwright-data:/data bellwright-companion:latest
#
# The ingest API decompresses saves with the Rust `dump` binary (Oodle/VSWB),
# so the image builds it from tools/dump in a separate stage.

# ---- Stage 1: Rust save decompressor ------------------------------------
# Runs on the BUILD host's native arch and cross-compiles to the target —
# rustc segfaults under qemu emulation, and native compile is faster anyway.
FROM --platform=$BUILDPLATFORM rust:1-bookworm AS dump-builder
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc-x86-64-linux-gnu libc6-dev-amd64-cross \
      gcc-aarch64-linux-gnu libc6-dev-arm64-cross \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY tools/dump/ ./
RUN case "$TARGETARCH" in \
      amd64) TRIPLE=x86_64-unknown-linux-gnu  LINKER=x86_64-linux-gnu-gcc ;; \
      arm64) TRIPLE=aarch64-unknown-linux-gnu LINKER=aarch64-linux-gnu-gcc ;; \
      *) echo "unsupported TARGETARCH $TARGETARCH" && exit 1 ;; \
    esac \
    && rustup target add "$TRIPLE" \
    && TRIPLE_ENV=$(echo "$TRIPLE" | tr 'a-z-' 'A-Z_') \
    && env "CARGO_TARGET_${TRIPLE_ENV}_LINKER=$LINKER" "CC_${TRIPLE}=$LINKER" \
       cargo build --release --target "$TRIPLE" \
    && cp "target/$TRIPLE/release/dump" /dump

# ---- Stage 2: Next.js build (pnpm workspace) -----------------------------
# trixie: better-sqlite3 v13 prebuilds need glibc >= 2.38 (bookworm has 2.36)
FROM node:24-trixie AS web-builder
RUN corepack enable
WORKDIR /repo
# manifest-only layer so dependency install caches across source changes
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/package.json web/
COPY parser/package.json parser/
COPY publisher/package.json publisher/
RUN pnpm install --frozen-lockfile
COPY parser/ parser/
COPY web/ web/
RUN pnpm --filter bellwright-companion-web build

# ---- Stage 3: runtime -----------------------------------------------------
FROM node:24-trixie-slim
ENV NODE_ENV=production \
    DATA_DIR=/data \
    DUMP_BIN=/app/bin/dump \
    PORT=8710 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=dump-builder /dump /app/bin/dump
# standalone output keeps the monorepo shape: web/server.js + traced node_modules
COPY --from=web-builder /repo/web/.next/standalone/ ./
COPY --from=web-builder /repo/web/.next/static/ web/.next/static/
COPY --from=web-builder /repo/web/public/ web/public/
COPY --from=web-builder /repo/web/drizzle/ web/drizzle/
WORKDIR /app/web
VOLUME /data
EXPOSE 8710
CMD ["node", "server.js"]
