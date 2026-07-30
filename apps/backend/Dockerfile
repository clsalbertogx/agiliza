FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
# Copy workspace manifest files so npm can resolve workspaces
COPY package.json package-lock.json ./
COPY turbo.json tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --legacy-peer-deps

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/tsconfig.base.json ./tsconfig.base.json
COPY apps/backend/ ./apps/backend/
COPY packages/ ./packages/
# Generate Prisma client
RUN cd apps/backend && npx prisma generate
# Compile TypeScript
RUN cd apps/backend && npm run build

FROM base AS runner
ENV NODE_ENV production
WORKDIR /app
# Copy tsconfig files for path resolution
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/apps/backend/tsconfig.json ./tsconfig.json
# Copy source code (tsx runs from source, handles path resolution)
COPY --from=build /app/apps/backend/src ./src
# Copy node_modules (includes tsx)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./
# Copy Prisma client
COPY --from=build /app/apps/backend/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3333
USER node
CMD ["npx", "tsx", "src/index.ts"]
