#!/bin/bash
# E2E local setup script
# Starts test infrastructure + backend for local E2E testing.
#
# The API-level specs (client-flow, invoice-flow, onboarding-flow,
# error-states, backend-health) run against the backend only.
#
# The browser-level spec (dashboard-navigation) additionally requires a live
# frontend. Pass --with-frontend to also start apps/frontend and export
# E2E_FRONTEND_URL so the browser slice RUNS instead of being skipped:
#
#   ./scripts/e2e-setup.sh --with-frontend

WITH_FRONTEND=0
if [ "$1" = "--with-frontend" ]; then
  WITH_FRONTEND=1
fi

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

FRONTEND_PID=""
if [ "$WITH_FRONTEND" = "1" ]; then
  echo "Starting frontend (npm run dev)..."
  cd apps/frontend && npm run dev &
  FRONTEND_PID=$!

  echo "Waiting for frontend on :3000..."
  npx wait-on http://localhost:3000 --timeout 60000
  export E2E_FRONTEND_URL=http://localhost:3000
fi

echo "Backend is ready! Running E2E tests..."
npx playwright test --config=e2e/playwright.config.ts
E2E_EXIT_CODE=$?

echo "Stopping backend..."
kill $BACKEND_PID 2>/dev/null

if [ -n "$FRONTEND_PID" ]; then
  echo "Stopping frontend..."
  kill $FRONTEND_PID 2>/dev/null
fi

echo "Stopping infrastructure..."
docker compose -f docker/docker-compose.e2e.yml down

exit $E2E_EXIT_CODE
