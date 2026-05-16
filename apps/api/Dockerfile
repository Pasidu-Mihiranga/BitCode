FROM oven/bun:1.1.42-alpine AS base
WORKDIR /app

# Sharp needs libvips runtime; @node-rs/argon2 ships prebuilt N-API binaries
RUN apk add --no-cache vips libc6-compat

COPY package.json ./
COPY bun.lock* bun.lockb* ./
RUN bun install || true

COPY . .

ENV NODE_ENV=production
ENV API_PORT=3000
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
