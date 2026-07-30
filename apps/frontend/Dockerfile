FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
# Copy workspace manifest files for npm workspaces resolution
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --legacy-peer-deps && npm cache clean --force

FROM base AS builder
WORKDIR /app
# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
# Copy frontend source code
COPY apps/frontend/ ./apps/frontend/
# Copy shared package source
COPY packages/shared/ ./packages/shared/
WORKDIR /app/apps/frontend
RUN npm run build

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/frontend/.next ./.next
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/package.json ./
COPY --from=builder /app/apps/frontend/next.config.js ./
EXPOSE 3000
ENV NODE_ENV=production
USER node
CMD ["npm", "start"]
