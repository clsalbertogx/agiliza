#!/bin/bash
set -e

echo "🔄 Running Prisma migrations..."
npx prisma generate
npx prisma migrate dev --name init --skip-generate
echo "✅ Migrations complete!"
