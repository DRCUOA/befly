# Multi-stage build for Vue client
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json* ./

# Copy shared workspace
COPY shared ./shared

# Copy client package files
COPY client/package.json client/package-lock.json* ./client/

# Install dependencies (workspace-aware)
RUN npm ci

# Copy client source files
COPY client ./client

# Build the application
WORKDIR /app/client
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy nginx configuration
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
