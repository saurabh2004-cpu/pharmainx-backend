#!/bin/sh
set -e

echo "🔄 Generating Prisma Client..."
pnpm prisma generate

echo "🚀 Running Prisma migrations..."
pnpm prisma migrate deploy

echo "▶️ Starting server..."
pnpm start
