# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ .
RUN npm run build

# Stage 2: Build and Run Backend
FROM oven/bun:1 AS backend
WORKDIR /app

# Install production dependencies
COPY package.json bun.lockb ./
RUN bun install --production

# Copy source code
COPY src/ src/
COPY tsconfig.json .

# Build backend (optional if running with bun directly, but good for optim)
# We will just run with bun ts for simplicity as per setup
# Or we can build into a standalone binary. Let's run with bun directly.

# Copy frontend build to public folder
COPY --from=frontend-builder /app/dist ./public

# Create data directory
RUN mkdir -p data

# Environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/price-sync.db

EXPOSE 3000

# Start command
CMD ["bun", "src/index.ts"]
