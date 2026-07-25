FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --only=production && npm cache clean --force

FROM base AS builder
WORKDIR /app
COPY package.json ./
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm install && npm run build

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

EXPOSE 3333
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
