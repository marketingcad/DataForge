#!/usr/bin/env bash
# Run this script once after `vercel login` to push all env vars to Vercel.
# Usage: bash setup-vercel-env.sh
#
# Make sure you are in the dataforge-app directory and already linked:
#   vercel link --project data-forge-theta

set -e

PROD="production"
PREV="preview"

echo_env() {
  local KEY=$1
  local VAL=$2
  printf '%s' "$VAL" | vercel env add "$KEY" "$PROD" --force 2>/dev/null || true
  printf '%s' "$VAL" | vercel env add "$KEY" "$PREV" --force 2>/dev/null || true
  echo "  ✓ $KEY"
}

echo "Pushing environment variables to Vercel (production + preview)..."

# ── Database (Neon) ────────────────────────────────────────────────────────
echo_env POSTGRES_PRISMA_URL "postgresql://neondb_owner:npg_v5EKlqjAmez2@ep-misty-scene-am5r82m7-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&connect_timeout=15&sslmode=require"
echo_env POSTGRES_URL_NON_POOLING "postgresql://neondb_owner:npg_v5EKlqjAmez2@ep-misty-scene-am5r82m7.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

# ── NextAuth ───────────────────────────────────────────────────────────────
echo_env AUTH_SECRET "8D0E_kdSFclUhj7_h2NRxHhneiajlmTAjZf3DBoOomU"
echo_env NEXTAUTH_URL "https://data-forge-theta.vercel.app"

# ── Cron ───────────────────────────────────────────────────────────────────
echo_env CRON_SECRET "61735dd5d82b82f15065d449522e0cef4bc3cb483261547f78ed8da78a07bedc"

# ── SerpAPI (optional — scraping won't work without it) ───────────────────
# Uncomment and fill in your key:
# echo_env SERPAPI_API_KEY "your_serpapi_key_here"

echo ""
echo "Done! Trigger a redeploy:"
echo "  vercel --prod"
