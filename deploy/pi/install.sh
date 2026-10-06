#!/usr/bin/env bash
# Installs or updates the calendar on the Pi from an unzipped bundle. Safe to run again.
# Usage: sudo ./apps-calendar/install.sh   (as root: KIOSK_USER=<desktop user> ./apps-calendar/install.sh)
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo $0" >&2
  exit 1
fi

BUNDLE="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="/opt/apps-calendar"
# The desktop user that the TV logs in as (whoever ran sudo, unless KIOSK_USER is set).
KIOSK_USER="${KIOSK_USER:-${SUDO_USER:-pi}}"
if ! KIOSK_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)" || [ -z "$KIOSK_HOME" ]; then
  echo "User '$KIOSK_USER' doesn't exist. Set KIOSK_USER to the TV's desktop user." >&2
  exit 1
fi

echo "==> Checking Node.js"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "Installing Node.js 24..."
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
NODE_BIN="$(command -v node)"

echo "==> Copying the app to $INSTALL_DIR"
systemctl stop calendar 2>/dev/null || true
mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/app"
cp -r "$BUNDLE/app" "$INSTALL_DIR/app"
cp "$BUNDLE/kiosk.sh" "$INSTALL_DIR/kiosk.sh"
chmod +x "$INSTALL_DIR/kiosk.sh"
chown -R "$KIOSK_USER:" "$INSTALL_DIR"

echo "==> Setting up the calendar server to start at boot"
sed -e "s|^User=.*|User=$KIOSK_USER|" -e "s|/usr/bin/node|$NODE_BIN|" \
  "$BUNDLE/calendar.service" > /etc/systemd/system/calendar.service
systemctl daemon-reload
systemctl enable calendar
systemctl restart calendar

echo "==> Locking down Chromium for the TV"
mkdir -p /etc/chromium/policies/managed
cp "$BUNDLE/chromium-kiosk-policy.json" /etc/chromium/policies/managed/
for pkg in chromium chromium-browser; do
  dpkg -s "$pkg" >/dev/null 2>&1 && apt-mark hold "$pkg" >/dev/null
done

echo "==> Opening the calendar when the desktop starts"
sudo -u "$KIOSK_USER" mkdir -p "$KIOSK_HOME/.config/autostart"
# Copy as root (the bundle may sit somewhere the user can't read), then give it to the user.
install -o "$KIOSK_USER" -g "$KIOSK_USER" -m 644 "$BUNDLE/kiosk.desktop" "$KIOSK_HOME/.config/autostart/"

echo "==> Setting the TV to 1080p landscape"
sudo -u "$KIOSK_USER" mkdir -p "$KIOSK_HOME/.config/kanshi"
install -o "$KIOSK_USER" -g "$KIOSK_USER" -m 644 "$BUNDLE/kanshi.config" "$KIOSK_HOME/.config/kanshi/config"

if command -v tailscale >/dev/null; then
  echo "==> Sharing the calendar on Tailscale"
  # Serve waits forever if it isn't enabled on the tailnet yet; its output has the link to enable it.
  if ! timeout 15 tailscale serve --bg 3000; then
    echo "Tailscale Serve not set up. Open the link above, then run: sudo tailscale serve --bg 3000" >&2
  fi
fi

echo "==> Waiting for the server"
for _ in $(seq 1 30); do
  if curl --silent --output /dev/null http://localhost:3000; then
    echo
    echo "Calendar is running."
    echo "Reboot to refresh the TV: sudo reboot"
    exit 0
  fi
  sleep 1
done

echo "Server didn't start. Check: journalctl -u calendar -n 50" >&2
exit 1
