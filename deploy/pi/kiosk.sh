#!/usr/bin/env bash
# Opens the calendar full-screen on the wall display. Started automatically by kiosk.desktop.

URL="http://localhost:3000/display"
PREFS="$HOME/.config/chromium/Default/Preferences"

# Wait for the calendar server to be ready so the screen doesn't show an error page.
until curl --silent --output /dev/null "$URL"; do
  sleep 2
done

# Pretend Chromium closed normally last time, so a power cut never shows "Restore pages?".
if [ -f "$PREFS" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"
fi

# Newer Raspberry Pi OS names it "chromium", older images use "chromium-browser".
BROWSER="$(command -v chromium || command -v chromium-browser)"

exec "$BROWSER" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --password-store=basic \
  --disable-features=Translate \
  "$URL"
