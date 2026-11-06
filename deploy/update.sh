#!/usr/bin/env bash
# Rebuild and restart after `git pull` (your data folder and .env are kept).
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$(id -u)" = 0 ] || { echo "Run this with sudo."; exit 1; }
STAMP=$(date +%Y%m%d-%H%M)
echo "Taking a backup first: data/backups/before-update-$STAMP.sqlite"
docker compose exec -T erp node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/triagon-erp.sqlite').exec(\"VACUUM INTO '/data/backups/before-update-$STAMP.sqlite'\")" 2>/dev/null || echo "  (the app isn't running, skipped)"
docker compose up -d --build
docker image prune -f >/dev/null
echo "Updated. Check https://$(grep ^DOMAIN= .env | cut -d= -f2)"
