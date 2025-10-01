# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS frontend-build
WORKDIR /app/frontend
COPY frontend/pnpm-lock.yaml frontend/package.json ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM base AS backend-deps
WORKDIR /app/backend
# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++
COPY backend/package.json ./
RUN pnpm install --prod
# Explicitly rebuild better-sqlite3 for the container architecture
RUN cd node_modules/.pnpm/better-sqlite3@12.4.1/node_modules/better-sqlite3 && npm run build-release
COPY backend/src ./src

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -G nodejs

# Copy backend runtime assets
COPY --from=backend-deps /app/backend/package.json ./backend/package.json
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY --from=backend-deps /app/backend/src ./backend/src

# Copy built frontend assets
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=frontend-build /app/frontend/public ./frontend/public

# Create data directory and set permissions
RUN mkdir -p /app/backend/data && chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000
CMD ["node", "backend/src/server.js"]
