# syntax=docker/dockerfile:1

# Build client and server artifacts
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared ./shared
COPY client ./client
COPY server ./server

RUN npm ci
RUN npm run build --workspace=client
RUN npm run build --workspace=server

# Production runtime image
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared ./shared
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./server/public

WORKDIR /app/server
EXPOSE 3005

CMD ["node", "dist/index.js"]
