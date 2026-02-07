# Multi-stage build for Node.js server
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json* ./

# Copy shared workspace
COPY shared ./shared

# Copy server package files
COPY server/package.json server/package-lock.json* ./server/

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy server source files
COPY server ./server

# Build TypeScript
WORKDIR /app/server
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy shared workspace
COPY shared ./shared

# Copy server package files
COPY server/package.json server/package-lock.json* ./server/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/server/dist ./server/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

WORKDIR /app

EXPOSE 3005

CMD ["node", "server/dist/index.js"]
