# Running the calendar on the Raspberry Pi

The Pi does two jobs:

1. **Runs the calendar website** for team members on our Tailscale network (that's how admins reach the admin panel).
2. **Shows the calendar full-screen** on the hanging TV. The TV has no keyboard or mouse, so everything here is set up to start on its own and never show a popup.

All calendar data lives in Convex (in the cloud), not on the Pi. If the Pi dies, nothing is lost. Install the bundle on a new one.

The code is **built on your laptop** into one zip file. The Pi never needs the git repo or `npm install`.

```
Your laptop                          Raspberry Pi
npm run bundle:pi  ──scp zip──▶  sudo ./apps-calendar/install.sh
                                   ├─ calendar.service   website on localhost:3000 (starts at boot)
                                   ├─ tailscale serve    https://<pi-name>.<tailnet>.ts.net
                                   └─ kiosk.desktop      Chromium full-screen on the TV (/display)
```

The TV opens **`/display`**, a read-only page that needs no login. It rotates month → week → announcements every 15 seconds and reloads itself at midnight. Everyone else uses the normal site (`/`), which requires signing in.

## Who can see what

| Who | How they get in |
| --- | --- |
| The TV | Opens `/display` with a secret **display token** that only the Pi has. No login. |
| Team members | Must be on our tailnet (the Pi is shared with them in Tailscale) **and** sign in with an invited account. |
| Anyone else | Nothing. The website only listens on the Pi itself, sign-up is invite-only, and the database refuses reads without a login or the display token. |

**Add a team member:**

1. In the Tailscale admin console, open **Machines → `1241-calendar` → Share**, and send them the invite.
2. In the Clerk dashboard, open **Users → Invite**, and invite their email.

**Remove someone:** remove their share in Tailscale, and delete their user in Clerk.

## Deploying (first time or an update, same steps)

You need: the repo on your laptop, the `.env` file in the repo root (ask a mentor), and Tailscale running.

You also need `.env.production.local` in the repo root (ask a mentor). It points the build at the **production** Convex database (`patient-frog-886`), so the TV doesn't use someone's personal dev database. It also holds the display token:

```
CONVEX_DEPLOYMENT=prod:patient-frog-886
NEXT_PUBLIC_CONVEX_URL=https://patient-frog-886.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://patient-frog-886.convex.site
DISPLAY_TOKEN=<same value as DISPLAY_TOKEN in Convex production>
```

Neither `.env` file is in git, because they hold secrets. Share them privately (in person or a password manager), never in chat or a commit.

If you change anything in `convex/`, deploy the backend too with `npx convex deploy`. Your Convex account needs to be in the Team 1241 THEORY6 team.

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

The zip contains `.env` and the display token. Copy it only to the Pi and don't post it anywhere.

## What each file does

| File | What it's for |
| --- | --- |
| `build-bundle.sh` | Runs on your laptop. Builds the app and zips it with everything below. |
| `install.sh` | Runs on the Pi. Copies the app to `/opt/apps-calendar` and sets up everything else. Safe to run again for updates. |
| `calendar.service` | Tells Linux (systemd) to start the website at boot and restart it if it crashes. |
| `kiosk.sh` | Waits for the website, then opens Chromium full-screen on `/display` with the display token. |
| `kiosk.desktop` | Makes `kiosk.sh` run when the Pi's desktop starts. |
| `kanshi.config` | Sets the TV to 1920×1080 at 60Hz, landscape. 4K makes everything tiny and is slow on the Pi. |
| `chromium-kiosk-policy.json` | Chromium settings that block popups (translate, notifications, password saving, "restore pages", sign-in prompts). Chromium is forced to follow these. |

## Something's wrong with the screen

| Problem | Try |
| --- | --- |
| Error page or blank screen | `systemctl status calendar`. If it isn't "active (running)", read the logs with `journalctl -u calendar -n 50`. |
| Website works on your laptop but the TV is frozen | `sudo reboot` |
| TV shows the sign-in page | The kiosk is on the wrong page. `URL` in `/opt/apps-calendar/kiosk.sh` should point at `/display`. |
| TV says "Display not authorized" | The token on the Pi (`/opt/apps-calendar/display-token`) doesn't match `DISPLAY_TOKEN` in Convex production. Rebuild and reinstall the bundle with the right `.env.production.local`. |
| **Rotate the display token** (e.g. after a leak) | Generate one with `openssl rand -hex 32`. Put it in `.env.production.local`, run `npx convex env set DISPLAY_TOKEN <token> --prod`, then redeploy the bundle. |
| `npm run bundle:pi` fails | Usually a missing value in `.env`. The error message names the variable. |

## New Pi checklist (one time)

Use Raspberry Pi OS **with desktop**, **64-bit**, on a Pi 4 or 5, and connect it to Tailscale. Then:

1. **Install the bundle** using the deploy steps above. `install.sh` installs Node.js automatically if it's missing.
2. **Turn on auto-login.** Run `sudo raspi-config`, go to **System Options → Boot / Auto Login → Desktop Autologin**, then reboot. With no mouse plugged in, the cursor doesn't show.
3. **Optional: check the popup blockers.** Turn on VNC with `sudo raspi-config` (**Interface Options → VNC**). Connect from your laptop, open `chrome://policy`, and check that every setting shows as applied.
