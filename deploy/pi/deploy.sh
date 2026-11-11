#!/usr/bin/env bash
# Builds the bundle, installs it on the Pi over Tailscale, reboots, and waits for the site.
# Usage (from the repo root): npm run deploy:pi [-- --convex]
#   --convex  also push convex/ to production first (needed when backend code changed)
# Override the target with PI_HOST, PI_SSH_USER, KIOSK_USER or SITE_URL.
set -euo pipefail

PI_HOST="${PI_HOST:-1241-calendar}"
PI_SSH_USER="${PI_SSH_USER:-root}"
KIOSK_USER="${KIOSK_USER:-theory}"
SITE_URL="${SITE_URL:-https://1241-calendar.tailf74d8d.ts.net}"
TARGET="$PI_SSH_USER@$PI_HOST"

DEPLOY_CONVEX=false
for arg in "$@"; do
  case "$arg" in
    --convex) DEPLOY_CONVEX=true ;;
    *)
      echo "Unknown option: $arg (see the top of deploy/pi/deploy.sh)" >&2
      exit 1
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

if ! tailscale status 2>/dev/null | grep -qw "$PI_HOST"; then
  echo "Can't see '$PI_HOST' on your tailnet. Is Tailscale on, and switched to the team tailnet (tailscale switch)?" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Note: deploying uncommitted changes."
fi

if $DEPLOY_CONVEX; then
  echo "==> Deploying Convex backend to production"
  npx convex deploy
fi

echo "==> Building bundle"
rm -f dist/apps-calendar-pi-*.zip
bash deploy/pi/build-bundle.sh >/dev/null
ZIP="$(cd dist && ls -t apps-calendar-pi-*.zip | head -n 1)"

echo "==> Copying $ZIP to $TARGET"
scp -q "dist/$ZIP" "$TARGET:~"

echo "==> Installing on the Pi"
# sudo is a no-op for root and needed for any other SSH user.
ssh "$TARGET" "cd ~ && unzip -oq '$ZIP' && rm -f apps-calendar-pi-*.zip && sudo KIOSK_USER='$KIOSK_USER' ./apps-calendar/install.sh"

echo "==> Rebooting the Pi (refreshes the TV)"
ssh "$TARGET" "sudo systemctl reboot" || true

echo "==> Waiting for $SITE_URL"
sleep 20
for _ in $(seq 1 36); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SITE_URL/")" = "200" ]; then
    echo "Deployed. The site is up and the TV will show the new version once Chromium starts."
    exit 0
  fi
  sleep 5
done

echo "The Pi didn't come back within about 3 minutes. Check it with: ssh $TARGET 'systemctl status calendar'" >&2
exit 1
