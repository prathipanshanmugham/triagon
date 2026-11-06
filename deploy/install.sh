#!/usr/bin/env bash
# Triagon ERP — one-time install on a Hostinger VPS (Ubuntu 22.04 / 24.04, also Debian 12).
# Run from the folder you unzipped:   sudo bash deploy/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
say() { printf '\n\033[1;33m▸ %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Run this with sudo (or as root)."; exit 1; }

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is missing. Install the docker-compose-plugin package and run this again."; exit 1; }

if [ ! -f .env ]; then
  say "Your domain"
  read -rp "Domain for the ERP (e.g. erp.triagonventures.com): " DOMAIN
  read -rp "Email for the HTTPS certificate notices: " ACME_EMAIL
  printf 'DOMAIN=%s\nACME_EMAIL=%s\n' "$DOMAIN" "$ACME_EMAIL" > .env
fi
. ./.env
[ -n "${DOMAIN:-}" ] || { echo "DOMAIN is empty in .env"; exit 1; }

say "Checking that $DOMAIN points to this server"
MYIP=$(curl -fsS4 https://api.ipify.org || true)
DNSIP=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)
if [ -n "$MYIP" ] && [ "$MYIP" != "$DNSIP" ]; then
  echo "  $DOMAIN resolves to '${DNSIP:-nothing}', but this VPS is $MYIP."
  echo "  Add an A record for $DOMAIN → $MYIP in your DNS (Hostinger hPanel › Domains › DNS), wait a few minutes, then run this again."
  read -rp "Continue anyway? [y/N] " a; [ "${a:-n}" = y ] || exit 1
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q active; then
  say "Opening ports 80 and 443 in the firewall"
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
fi

mkdir -p data && chown -R 1000:1000 data
say "Building and starting (first build takes a few minutes)"
docker compose up -d --build

say "Waiting for the ERP to start"
for i in $(seq 1 60); do curl -fsS http://127.0.0.1:8080/api/status >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:8080/api/status && echo

cat <<MSG

  Done. Open  https://$DOMAIN  in your browser.
  · First visit: create the CEO account (or import your desktop-app backup).
  · Data and nightly backups live in: $(pwd)/data
  · Update later:   sudo bash deploy/update.sh
  · Forgot the CEO password:   sudo docker compose exec erp node server/cli.js reset-password <username>

MSG
