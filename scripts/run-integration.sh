#!/usr/bin/env bash
#
# Run the live Vertex AI integration tests against a real GCP service account.
#
# Usage:
#   1. Edit GCP_KEY_FILE below to the absolute path of your service-account JSON.
#      (Or set GCP_KEY_FILE in your environment and skip editing.)
#   2. Run: ./scripts/run-integration.sh
#
# These tests make real, billable Vertex AI API calls. Prompts are kept small.
#

set -euo pipefail

# ---- EDIT THIS LINE ----------------------------------------------------------
: "${GCP_KEY_FILE:=/absolute/path/to/your-service-account.json}"
# -----------------------------------------------------------------------------

# Optional overrides — uncomment and edit if needed.
# : "${GCP_PROJECT_ID:=your-project-id}"     # defaults to project_id in the key file
# : "${GCP_LOCATION:=us-central1}"           # default
# : "${GEMINI_MODEL:=gemini-3.1-flash}"      # default — node also auto-picks latest flash

if [ ! -f "$GCP_KEY_FILE" ]; then
  echo "ERROR: GCP_KEY_FILE does not exist: $GCP_KEY_FILE" >&2
  echo "Edit the top of $0 (or export GCP_KEY_FILE) to point at your" >&2
  echo "service-account JSON." >&2
  exit 1
fi

export GCP_KEY_FILE
[ -n "${GCP_PROJECT_ID:-}" ] && export GCP_PROJECT_ID
[ -n "${GCP_LOCATION:-}" ]   && export GCP_LOCATION
[ -n "${GEMINI_MODEL:-}" ]   && export GEMINI_MODEL

# cd to the repo root regardless of where the script is invoked from.
cd "$(dirname "$0")/.."

# Make sure we're on a Node version that runs n8n (20+). Use nvm if available.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use 20.19.5 >/dev/null
fi

echo "Running live integration tests with:"
echo "  GCP_KEY_FILE   = $GCP_KEY_FILE"
echo "  GCP_PROJECT_ID = ${GCP_PROJECT_ID:-<from key file>}"
echo "  GCP_LOCATION   = ${GCP_LOCATION:-us-central1}"
echo "  GEMINI_MODEL   = ${GEMINI_MODEL:-from integration/helpers.ts default}"
echo

npm run test:integration
