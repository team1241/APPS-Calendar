# Running the calendar on the Raspberry Pi

The Pi does two jobs:

1. **Runs the calendar website**, so anyone on our Tailscale network can open it (that's how admins reach the admin panel).
2. **Shows the calendar full-screen** on the hanging TV. The TV has no keyboard or mouse, so everything here is set up to start on its own and never show a popup.

All calendar data lives in Convex (in the cloud), not on the Pi. If the Pi dies, nothing is lost. Install the bundle on a new one.

The code is **built on your laptop** into one zip file. The Pi never needs the git repo or `npm install`.

```
Your laptop                          Raspberry Pi
npm run bundle:pi  ──scp zip──▶  sudo ./apps-calendar/install.sh
                                   ├─ calendar.service   website on port 3000 (starts at boot)
                                   ├─ tailscale serve    https://<pi-name>.<tailnet>.ts.net
                                   └─ kiosk.desktop      Chromium full-screen on the TV (/display)
```

The TV opens **`/display`**, a read-only page that needs no login. It rotates month → week → announcements every 15 seconds and reloads itself at midnight. Everyone else uses the normal site (`/`), which requires signing in.

## Deploying (first time or an update, same steps)

You need: the repo on your laptop, the `.env` file in the repo root (ask a mentor), and Tailscale running.

```bash
# 1. On your laptop, from the repo root
npm run bundle:pi

# 2. Copy the zip to the Pi (the build prints the exact file name)
scp dist/apps-calendar-pi-*.zip pi@<pi-name>:~

# 3. Install it on the Pi
tailscale ssh pi@<pi-name>
unzip -o apps-calendar-pi-*.zip
sudo ./apps-calendar/install.sh
sudo reboot   # refreshes the TV
```

The zip contains `.env`, which holds secret keys. Copy it only to the Pi and don't post it anywhere.

## What each file does

| File | What it's for |
| --- | --- |
| `build-bundle.sh` | Runs on your laptop. Builds the app and zips it with everything below. |
| `install.sh` | Runs on the Pi. Copies the app to `/opt/apps-calendar` and sets up everything else. Safe to run again for updates. |
| `calendar.service` | Tells Linux (systemd) to start the website at boot and restart it if it crashes. |
| `kiosk.sh` | Waits for the website, then opens Chromium full-screen with no browser buttons. |
| `kiosk.desktop` | Makes `kiosk.sh` run when the Pi's desktop starts. |
| `kanshi.config` | Sets the TV to 1920×1080 at 60Hz, landscape. 4K makes everything tiny and is slow on the Pi. |
| `chromium-kiosk-policy.json` | Chromium settings that block popups (translate, notifications, password saving, "restore pages", sign-in prompts). Chromium is forced to follow these. |

## Something's wrong with the screen

| Problem | Try |
| --- | --- |
| Error page or blank screen | `systemctl status calendar`. If it isn't "active (running)", read the logs with `journalctl -u calendar -n 50`. |
| Website works on your laptop but the TV is frozen | `sudo reboot` |
| TV shows the sign-in page | The kiosk is on the wrong page. `URL` in `/opt/apps-calendar/kiosk.sh` should end in `/display`. |
| `npm run bundle:pi` fails | Usually a missing value in `.env`. The error message names the variable. |

## New Pi checklist (one time)

Use Raspberry Pi OS **with desktop**, **64-bit**, on a Pi 4 or 5, and connect it to Tailscale. Then:

1. **Install the bundle** using the deploy steps above. `install.sh` installs Node.js automatically if it's missing.
2. **Turn on auto-login.** Run `sudo raspi-config`, go to **System Options → Boot / Auto Login → Desktop Autologin**, then reboot. With no mouse plugged in, the cursor doesn't show.
3. **Optional: check the popup blockers.** Turn on VNC with `sudo raspi-config` (**Interface Options → VNC**). Connect from your laptop, open `chrome://policy`, and check that every setting shows as applied.
