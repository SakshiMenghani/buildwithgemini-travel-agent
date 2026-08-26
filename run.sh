#!/usr/bin/env bash
set -e

# Export environment variables
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-qwiklabs-gcp-04-8ad58e4d2e8c}"
export GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
export PORT="${PORT:-8000}"

echo "Starting Roam AI Travel Agent application..."
python3 -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --reload
