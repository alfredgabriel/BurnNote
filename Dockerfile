# Stage 1: Build stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build essentials for native dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json package-lock.json .npmrc ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --legacy-peer-deps

# Copy application source
COPY . .

# Build SvelteKit application for production (adapter-node outputs to build/)
RUN npm run build

# Prune dev dependencies for production image
RUN npm prune --production --legacy-peer-deps

# Stage 2: Production runtime stage
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/burnnote.db

# Create a non-root group and user
RUN groupadd -g 10001 burnnote && \
    useradd -u 10001 -g burnnote -s /bin/sh -m burnnote

# Create persistent database directory and assign ownership
RUN mkdir -p /app/data && chown -R burnnote:burnnote /app

# Copy production node_modules from builder
COPY --from=builder --chown=burnnote:burnnote /app/node_modules ./node_modules
COPY --from=builder --chown=burnnote:burnnote /app/package.json ./package.json
COPY --from=builder --chown=burnnote:burnnote /app/build ./build

# Switch to non-root user
USER burnnote

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "build"]
