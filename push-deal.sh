#!/bin/bash
# Push a deal JSON file to the CW Pipeline API
# Usage: bash push-deal.sh deal.json
# Or pipe JSON: echo '{"name":"Test Deal"}' | bash push-deal.sh

API_URL="https://pipeline-backend.office-a21.workers.dev/api/deals"
AUTH_EMAIL="macminicp@gmail.com"

# Shared secret proving this is a trusted server-side caller. The Worker
# requires it (X-Proxy-Secret) once PROXY_SECRET is set on it. Resolve from the
# env, then the out-of-repo secrets file.
PROXY_SECRET="${PIPELINE_PROXY_SECRET:-}"
if [ -z "$PROXY_SECRET" ]; then
  SECRETS_FILE="$HOME/.claude/projects/C--Users-jmiddleton-CWP-CWP---Documents-Ford/secrets/proxy-secrets.env"
  [ -f "$SECRETS_FILE" ] && PROXY_SECRET=$(grep '^PIPELINE_PROXY_SECRET=' "$SECRETS_FILE" | cut -d= -f2- | tr -d '\r\n ')
fi

if [ -n "$1" ] && [ -f "$1" ]; then
  JSON=$(cat "$1")
elif [ ! -t 0 ]; then
  JSON=$(cat)
else
  echo "Usage: bash push-deal.sh <deal.json>"
  echo "   or: echo '{\"name\":\"Test\"}' | bash push-deal.sh"
  exit 1
fi

curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Authenticated-User-Email: $AUTH_EMAIL" \
  ${PROXY_SECRET:+-H "X-Proxy-Secret: $PROXY_SECRET"} \
  ${PROXY_SECRET:+-H "X-Proxy-User-Email: $AUTH_EMAIL"} \
  -d "$JSON" | python3 -m json.tool

echo ""
echo "✅ Deal pushed to pipeline.cwprop.com"
