FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --only=production --legacy-peer-deps && npm cache clean --force

FROM base AS builder
WORKDIR /app
COPY package.json ./
COPY next.config.js ./
COPY tsconfig.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY src/ ./src/
RUN npm install --legacy-peer-deps && npm run build

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json ./
COPY next.config.js ./
USER node
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
