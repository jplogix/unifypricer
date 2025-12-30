# Stage 1: Build Frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ .
RUN npm run build

# Stage 2: Build and Run Backend
FROM node:22-slim AS backend
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --production

# Copy source code
COPY src/ src/
COPY tsconfig.json .

# Build backend
RUN yarn build

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
CMD ["node", "dist/index.js"]
