#!/usr/bin/env bash
# Builds the calendar on your laptop and packs everything the Pi needs into one zip.
# Usage (from the repo root): npm run bundle:pi
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo "Missing .env in the repo root. Get it from a mentor first." >&2
  exit 1
fi

[ -d node_modules ] || npm ci
npm run build

OUT_DIR="$REPO_ROOT/dist"
STAGE="$OUT_DIR/stage/apps-calendar"
rm -rf "$OUT_DIR/stage"
mkdir -p "$STAGE"

# The standalone server, plus the static files Next leaves out of it.
cp -r .next/standalone "$STAGE/app"
cp -r public "$STAGE/app/public"
cp -r .next/static "$STAGE/app/.next/static"

# sharp (used by next/image) has native binaries; swap this laptop's for the Pi's (Linux arm64).
IMG_DIR="$STAGE/app/node_modules/@img"
SHARP_PKG="$STAGE/app/node_modules/sharp/package.json"
if [ -f "$SHARP_PKG" ]; then
  rm -rf "$IMG_DIR"/sharp-darwin-* "$IMG_DIR"/sharp-linux* "$IMG_DIR"/sharp-libvips-* "$IMG_DIR"/sharp-win32-*
  TMP="$(mktemp -d)"
  for pkg in @img/sharp-linux-arm64 @img/sharp-libvips-linux-arm64; do
    version="$(node -p "require('$SHARP_PKG').optionalDependencies['$pkg']")"
    tarball="$(npm pack "$pkg@$version" --pack-destination "$TMP" --silent)"
    mkdir -p "$IMG_DIR/${pkg#@img/}"
    tar -xzf "$TMP/$tarball" -C "$IMG_DIR/${pkg#@img/}" --strip-components=1
  done
  rm -rf "$TMP"
fi

cp deploy/pi/install.sh deploy/pi/calendar.service deploy/pi/kiosk.sh \
  deploy/pi/kiosk.desktop deploy/pi/chromium-kiosk-policy.json deploy/pi/kanshi.config "$STAGE/"
chmod +x "$STAGE/install.sh" "$STAGE/kiosk.sh"

ZIP_NAME="apps-calendar-pi-$(date +%Y%m%d)-$(git rev-parse --short HEAD).zip"
rm -f "$OUT_DIR/$ZIP_NAME"
(cd "$OUT_DIR/stage" && zip -qry "$OUT_DIR/$ZIP_NAME" apps-calendar)
rm -rf "$OUT_DIR/stage"

echo
echo "Bundle ready: dist/$ZIP_NAME"
echo "It contains .env (secret keys). Only copy it to the Pi, don't share it."
echo
echo "Next steps:"
echo "  scp dist/$ZIP_NAME pi@<pi-name>:~"
echo "  tailscale ssh pi@<pi-name>"
echo "  unzip -o $ZIP_NAME && sudo ./apps-calendar/install.sh"
