#!/bin/bash
set -e

# Cloudflare API Token (same as RMS deployment)
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:?set it first — see Keeper record: Claude Wrangler Deploy}"

PROJ_DIR="$HOME/claude-openclaw-copy/workspace/projects/pipeline-v2"
ACCOUNT_ID="ea21224737d86d6da54d6b78c173141b"
cd "$PROJ_DIR"

echo "=============================="
echo "CW Pipeline — Cloudflare Deploy"
echo "=============================="

# Step 1: Create D1 database
echo ""
echo "[1/5] Creating D1 database..."
DB_OUTPUT=$(npx wrangler d1 create pipeline-production 2>&1 || true)
echo "$DB_OUTPUT"

# Extract database ID from output
DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | head -1 | sed 's/database_id = "//;s/"//')

if [ -z "$DB_ID" ]; then
  echo "⚠️  Could not auto-extract DB ID. Checking if database already exists..."
  DB_ID=$(npx wrangler d1 list 2>&1 | grep "pipeline-production" | awk '{print $1}')
fi

if [ -z "$DB_ID" ]; then
  echo "❌ Failed to create or find D1 database. Please create it manually:"
  echo "   npx wrangler d1 create pipeline-production"
  echo "   Then update worker/wrangler.toml with the database_id"
  exit 1
fi

echo "✅ D1 database ID: $DB_ID"

# Update wrangler.toml with actual database ID
sed -i '' "s/database_id = \"PLACEHOLDER\"/database_id = \"$DB_ID\"/" "$PROJ_DIR/worker/wrangler.toml"
echo "✅ Updated worker/wrangler.toml with database ID"

# Step 2: Import schema to D1
echo ""
echo "[2/5] Importing schema to D1..."
npx wrangler d1 execute pipeline-production --file=d1-schema.sql 2>&1
echo "✅ Schema imported"

# Step 3: Deploy the Worker backend
echo ""
echo "[3/5] Deploying Worker backend..."
cd "$PROJ_DIR/worker"
npx wrangler deploy 2>&1
echo "✅ Worker deployed"

# Step 4: Build frontend
echo ""
echo "[4/5] Building frontend..."
cd "$PROJ_DIR/frontend"
npm run build 2>&1
echo "✅ Frontend built"

# Step 5: Deploy frontend to Pages
echo ""
echo "[5/5] Deploying frontend to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name=pipeline-frontend 2>&1
echo "✅ Frontend deployed"

echo ""
echo "=============================="
echo "Deployment complete!"
echo "=============================="
echo ""
echo "D1 Database ID: $DB_ID"
echo ""
echo "Next steps — set up custom domains in Cloudflare dashboard:"
echo ""
echo "1. Worker custom domain:"
echo "   Dashboard → Workers & Pages → pipeline-backend → Settings → Domains & Routes"
echo "   Add custom domain: pipeline-api.cwprop.com"
echo ""
echo "2. Pages custom domain:"
echo "   Dashboard → Workers & Pages → pipeline-frontend → Custom domains"
echo "   Add custom domain: pipeline.cwprop.com"
echo ""
echo "Test endpoints:"
echo "  curl https://pipeline-backend.office-a21.workers.dev/api/status"
echo "  curl https://pipeline-backend.office-a21.workers.dev/api/deals"
echo ""
