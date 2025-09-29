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
COPY backend/package.json ./
RUN pnpm install --prod
COPY backend/src ./src
COPY backend/data ./data

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
COPY --from=backend-deps /app/backend/data ./backend/data

# Copy built frontend assets
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=frontend-build /app/frontend/public ./frontend/public

USER nodejs
EXPOSE 3000
CMD ["node", "backend/src/server.js"]
