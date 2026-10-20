#!/usr/bin/env bash
# Opens the calendar full-screen on the wall display. Started automatically by kiosk.desktop.

SERVER="http://localhost:3000"
# The token goes after "#" so it stays in the browser and never reaches server logs.
URL="$SERVER/display#token=$(cat /opt/apps-calendar/display-token)&theme=light"
PREFS="$HOME/.config/chromium/Default/Preferences"

# Wait for the calendar server to be ready so the screen doesn't show an error page.
until curl --silent --output /dev/null "$SERVER"; do
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
