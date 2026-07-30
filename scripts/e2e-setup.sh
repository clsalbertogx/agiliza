#!/bin/bash
# E2E local setup script
# Starts test infrastructure + backend for local E2E testing

echo "Starting E2E infrastructure..."
docker compose -f docker/docker-compose.e2e.yml up -d

echo "Waiting for services..."
sleep 5

echo "Running database migrations..."
cd apps/backend && npx prisma migrate deploy && cd ../..

echo "Starting backend..."
cd apps/backend && npx tsx src/index.ts &
BACKEND_PID=$!

echo "Waiting for backend health check..."
npx wait-on http://localhost:3333/api/health --timeout 30000

echo "Backend is ready! Running E2E tests..."
npx playwright test --config=e2e/playwright.config.ts
E2E_EXIT_CODE=$?

echo "Stopping backend..."
kill $BACKEND_PID 2>/dev/null

echo "Stopping infrastructure..."
docker compose -f docker/docker-compose.e2e.yml down

exit $E2E_EXIT_CODE
