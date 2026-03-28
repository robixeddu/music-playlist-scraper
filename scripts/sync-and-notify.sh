#!/bin/bash
# Battiti full sync — captures output to logs/battiti-sync-YYYY-MM-DD.log

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

set -a
# shellcheck disable=SC1091
source "$PROJECT_DIR/.env"
set +a

DATE=$(date +%Y-%m-%d)
LOG_FILE="$PROJECT_DIR/logs/battiti-sync-$DATE.log"

mkdir -p "$PROJECT_DIR/logs"

echo "=== Battiti sync — $DATE ===" > "$LOG_FILE"
echo "" >> "$LOG_FILE"

npm start 2>&1 | tee -a "$LOG_FILE"
