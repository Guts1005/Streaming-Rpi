#!/usr/bin/env bash
set -euo pipefail

# Initial wait to allow system services to start
sleep 10

REPO_DIR="$HOME/Desktop/Projects/Streaming-Rpi/hm_releases"
cd "$REPO_DIR" || exit 1

# --- NETWORK WAIT LOOP ---
echo "Checking for network connectivity..."
MAX_RETRIES=20
RETRY_COUNT=0
NETWORK_AVAILABLE=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
    echo "Internet available!"
    NETWORK_AVAILABLE=true
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Network not available (Attempt $RETRY_COUNT/$MAX_RETRIES). Waiting 5s..."
  sleep 5
done

if [ "$NETWORK_AVAILABLE" = true ]; then
  echo "Force-updating from GitHub..."
  if [ -d .git ]; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
  fi

  if [ ! -d "venv" ]; then
    python3 -m venv --system-site-packages venv
  fi

  # shellcheck disable=SC1091
  source venv/bin/activate

  python -m pip install --upgrade pip
  [ -f requirements.txt ] && python -m pip install -r requirements.txt
  [ -f requirements-host.txt ] && python -m pip install -r requirements-host.txt
else
  echo "No internet connection after timeout. Skipping update."
  if [ -d "venv" ]; then
    source venv/bin/activate
  fi
fi

echo "Starting application..."
exec python3 init.py