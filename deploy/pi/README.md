# Running the calendar on the Raspberry Pi

The Pi does two jobs:

1. **Runs the calendar website** for team members. Tailscale Funnel puts it on the public internet at `https://1241-calendar.tailf74d8d.ts.net`, so nobody needs Tailscale to use it.
2. **Shows the calendar full-screen** on the hanging TV. The TV has no keyboard or mouse, so everything here is set up to start on its own and never show a popup.

All calendar data lives in Convex (in the cloud), not on the Pi. If the Pi dies, nothing is lost. Install the bundle on a new one.

The code is **built on your laptop** into one zip file. The Pi never needs the git repo or `npm install`.

```
Your laptop                          Raspberry Pi
npm run deploy:pi  ──scp zip──▶  ./apps-calendar/install.sh
                                   ├─ calendar.service   website on localhost:3000 (starts at boot)
                                   ├─ tailscale funnel   https://1241-calendar.tailf74d8d.ts.net (public)
                                   └─ kiosk.desktop      Chromium full-screen on the TV (/display)
```

The TV opens **`/display`**, a read-only page that needs no login. It rotates week → month → announcements every 15 seconds and reloads itself at midnight. Everyone else uses the normal site (`/`), which requires signing in.

## Who can see what

| Who | How they get in |
| --- | --- |
| The TV | Opens `/display` with a secret **display token** that only the Pi has. No login. |
| Team members | Sign in with an email a mentor has added. No Tailscale needed. |
| Anyone else | Only the sign-in screen. Sign-up is limited to added emails, and the database refuses reads without a login or the display token. |

**Add a team member:** a mentor signs in, opens the avatar menu → **Admin panel**, and adds their email under **Add users**. They join as a student.

**Remove someone:** in the admin panel, delete their user and save. That also removes their email from the sign-up allowlist.

## Deploying (first time or an update, same steps)

The Pi is **`1241-calendar`** on the team tailnet. The TV's desktop user is **`theory`**. Deploys go over SSH as `root`.

You need:

- The repo on your laptop, with `npm install` done.
- **Tailscale on the team tailnet.** If you're also on another tailnet (work, school), switch with `tailscale switch`. `tailscale status` should list `1241-calendar`.
- **`.env`** in the repo root (ask a mentor).
- **`.env.production.local`** in the repo root (ask a mentor). It points the build at the **production** Convex database (`patient-frog-886`), so the TV doesn't use someone's personal dev database. It also holds the display token:

```
CONVEX_DEPLOYMENT=prod:patient-frog-886
NEXT_PUBLIC_CONVEX_URL=https://patient-frog-886.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://patient-frog-886.convex.site
DISPLAY_TOKEN=<same value as DISPLAY_TOKEN in Convex production>
```

Neither `.env` file is in git, because they hold secrets. Share them privately (in person or a password manager), never in chat or a commit.

### Deploy with one command

```bash
npm run deploy:pi              # website / TV changes only
npm run deploy:pi -- --convex  # also changed anything in convex/
```

`--convex` runs `npx convex deploy` first, so the backend is ready before the new site starts. Your Convex account needs to be in the Team 1241 THEORY6 team.

The script builds the bundle, copies it to the Pi, runs `install.sh`, reboots the Pi (which refreshes the TV), and waits until `https://1241-calendar.tailf74d8d.ts.net` loads again. It takes a few minutes. When it prints **Deployed**, open the site and check your change. The TV picks it up as soon as Chromium starts.

To target a different Pi or user, set `PI_HOST`, `PI_SSH_USER`, `KIOSK_USER` or `SITE_URL` (for example `PI_HOST=other-pi npm run deploy:pi`).

### Deploy by hand

These are the same steps the script runs, in case you need to do one on its own:

```bash
# 0. Only if you changed convex/
npx convex deploy

# 1. On your laptop, from the repo root
npm run bundle:pi

# 2. Copy the zip to the Pi (the build prints the exact file name)
scp dist/apps-calendar-pi-*.zip root@1241-calendar:~

# 3. Install it on the Pi and reboot to refresh the TV
ssh root@1241-calendar
unzip -o apps-calendar-pi-*.zip
KIOSK_USER=theory ./apps-calendar/install.sh
systemctl reboot
```

If you log in as `theory` instead of root, run `sudo ./apps-calendar/install.sh` and leave out `KIOSK_USER`, because the script uses whoever ran `sudo`.

The zip contains `.env` and the display token. Copy it only to the Pi and don't post it anywhere.

## How it works (technical)

Read this before changing the deploy setup. It covers what each piece does and why.

### Overview

There are three separate things in production, and only one of them is on the Pi:

| Piece | Where it runs | How it's updated |
| --- | --- | --- |
| **Convex backend** (`convex/`): database, queries, mutations, auth checks | Convex cloud, production deployment `patient-frog-886` | `npx convex deploy` from a laptop. It's independent of the Pi. |
| **Clerk** (sign-in) | Clerk cloud | Clerk dashboard. Convex trusts Clerk through `convex/auth.config.ts`. |
| **Next.js frontend** plus the **TV kiosk** | The Pi (`1241-calendar`) | `npm run deploy:pi` (below) |

The Pi holds no data. The browser (on the TV or a phone) talks straight to Convex over a websocket. The Next.js server on the Pi only serves pages and JS, and runs Clerk's middleware (`src/proxy.ts`).

### Build (laptop): `build-bundle.sh`

1. Checks that `.env` and `.env.production.local` exist and that `DISPLAY_TOKEN` is set.
2. `npm run build` with `output: "standalone"` (`next.config.ts`). Next.js reads `.env`, then `.env.production.local` on top of it. Values in `.env.production.local` win, so the build points at **production** Convex. `NEXT_PUBLIC_*` values are **baked into the JS at build time**, so a bundle only works against the Convex deployment it was built for.
3. Stages `dist/stage/apps-calendar/`:
   - `app/`: `.next/standalone` (a self-contained `server.js` with a trimmed `node_modules`), plus `public/` and `.next/static`, which standalone leaves out.
   - **Cross-platform fix:** `sharp` (used by `next/image`) ships native binaries. The script deletes the laptop's binaries and downloads the `linux-arm64` ones with `npm pack`, so a bundle built on macOS or x86 Linux runs on the Pi.
   - The Pi-side files (`install.sh`, `calendar.service`, `kiosk.sh`, `kiosk.desktop`, `kanshi.config`, `journald-persistent.conf`, `chromium-kiosk-policy.json`).
   - `display-token`: the token alone, in a file with mode 600.
4. Zips it to `dist/apps-calendar-pi-<date>-<git sha>.zip`. The SHA is `HEAD`, so uncommitted changes go into a zip named after the last commit.

**Secrets in the zip:** Next.js copies `.env` into the standalone output, so `app/.env` is in the bundle with `CLERK_SECRET_KEY` and the rest. The server reads it at runtime for Clerk; `src/env.ts` checks that the variables are set. `.env.production.local` is **not** copied, but its public values are already compiled in.

### Ship (laptop → Pi): `deploy.sh`

Plain `scp` and `ssh` as `root@1241-calendar` over **Tailscale SSH**. No SSH keys are set up: Tailscale authenticates you by your tailnet identity, which is why you must be on the team tailnet. Steps: optional `npx convex deploy`, build, `scp` the zip to `/root`, then over SSH unzip it into `/root/apps-calendar/`, delete the zip(s), run `install.sh` with `KIOSK_USER=theory`, and `systemctl reboot`. Finally it polls the public URL until it returns HTTP 200.

There is no versioning or rollback on the Pi. Each install replaces `/opt/apps-calendar/app`. To roll back, check out the old commit and deploy again.

### Install (Pi): `install.sh`

It runs as root and is idempotent, so updates and fresh installs are the same path.

1. **Node:** installs Node 24 from NodeSource if `node` is missing or older than 20.
2. **App:** stops `calendar`, replaces `/opt/apps-calendar/app`, and copies in `kiosk.sh` and `display-token`. Everything is owned by the kiosk user, and the directory is mode 700 because it holds secrets.
3. **Server:** writes `/etc/systemd/system/calendar.service`, filling in `User=` and the real `node` path. Then it enables and restarts the service.
4. **Chromium:** copies the policy to `/etc/chromium/policies/managed/`. It also runs `apt-mark hold` on the Chromium package, so an OS update can't change the browser behind the kiosk's back.
5. **Kiosk autostart:** `kiosk.desktop` goes to `~theory/.config/autostart/`, and `kanshi.config` goes to `~theory/.config/kanshi/config`.
6. **Screen:** `raspi-config nonint do_blanking 1` turns off screen blanking.
7. **Logs:** turns on persistent journald (50 MB cap).
8. **Public URL:** `tailscale funnel --bg http://localhost:3000`. This setting persists in tailscaled, so it survives reboots. It needs the `funnel` node attribute in the tailnet policy.
9. Waits up to 30 s for `localhost:3000` to respond.

### Runtime (Pi)

- **`calendar.service`** runs `node server.js` in `/opt/apps-calendar/app` as `theory`, with `HOSTNAME=localhost` and `PORT=3000`. It listens only on loopback, so nothing on the LAN can reach it directly. `Restart=always`.
- **Tailscale Funnel** terminates HTTPS for `1241-calendar.tailf74d8d.ts.net` and proxies to `localhost:3000`. This is the only way in from outside, and it's public: no Tailscale needed to view it.
- **TV kiosk:** the Pi auto-logs in to the desktop as `theory`, and autostart runs `kiosk.sh`. That script waits for the server, waits up to 2 minutes for NTP (the Pi has no RTC, so after a power cut its clock is wrong until synced), clears Chromium's "crashed" flag, turns off X11 blanking, then `exec`s Chromium in `--kiosk` mode on `http://localhost:3000/display#token=<token>&theme=light`. The TV goes to localhost directly, not through Funnel.
- **`/display`** (`src/app/display`, `src/components/display-app.tsx`) needs no login. It reads the token from the URL **fragment** (after `#`), so the token never appears in server logs or Referer headers. It passes the token to the Convex query `display.feed` (`convex/display.ts`), which compares it in constant time to the `DISPLAY_TOKEN` environment variable on the **Convex** production deployment and returns `null` on mismatch. The page rotates views, ignores all mouse input (CSS `pointer-events: none`), and reloads itself when the date changes.
- **Rebooting** is how an update reaches the TV: Chromium is only launched once, at login.

### Things to keep in mind if you change this

- The display token lives in **two places** that must match: `DISPLAY_TOKEN` in Convex production env, and `.env.production.local` → `/opt/apps-calendar/display-token`.
- Builds must target `linux-arm64` for native modules (currently only `sharp`).
- The build machine needs the secrets. Anything that builds in CI needs `.env` and `.env.production.local` (or the same variables) provided as CI secrets.
- `install.sh` assumes Raspberry Pi OS with a desktop (`raspi-config`, autostart, kanshi, and Chromium from apt).
- Funnel config, desktop auto-login and the tailnet `funnel` attribute are one-time setup outside the bundle (see the checklist below).

### Files in `deploy/pi/`

| File | What it's for |
| --- | --- |
| `deploy.sh` | Runs on your laptop (`npm run deploy:pi`). Builds, copies, installs, reboots and waits for the site. |
| `build-bundle.sh` | Runs on your laptop. Builds the app and zips it with everything below. |
| `install.sh` | Runs on the Pi. Copies the app to `/opt/apps-calendar` and sets up everything else. Safe to run again for updates. |
| `calendar.service` | Tells Linux (systemd) to start the website at boot and restart it if it crashes. |
| `kiosk.sh` | Waits for the website, then opens Chromium full-screen on `/display` with the display token. |
| `kiosk.desktop` | Makes `kiosk.sh` run when the Pi's desktop starts. |
| `kanshi.config` | Sets the TV to 1920×1080 at 60Hz, landscape. 4K makes everything tiny and is slow on the Pi. |
| `journald-persistent.conf` | Keeps system logs across reboots and power cuts (capped at 50 MB), so `journalctl` can show what happened before a restart. |
| `chromium-kiosk-policy.json` | Chromium settings that block popups (translate, notifications, password saving, "restore pages", sign-in prompts). Chromium is forced to follow these. |

## Something's wrong with the screen

| Problem | Try |
| --- | --- |
| Error page or blank screen | `systemctl status calendar`. If it isn't "active (running)", read the logs with `journalctl -u calendar -n 50`. |
| Website works on your laptop but the TV is frozen | `sudo reboot` |
| TV goes black after about 10 minutes | Screen blanking is back on. Check that `/etc/X11/xorg.conf.d/10-blanking.conf` exists (`sudo raspi-config nonint do_blanking 1` recreates it), then reboot. |
| Need to know what happened before a restart | `journalctl --list-boots` lists past boots, and `journalctl -b -1` shows the previous one. |
| TV shows the sign-in page | The kiosk is on the wrong page. `URL` in `/opt/apps-calendar/kiosk.sh` should point at `/display`. |
| TV says "Display not authorized" | The token on the Pi (`/opt/apps-calendar/display-token`) doesn't match `DISPLAY_TOKEN` in Convex production. Rebuild and reinstall the bundle with the right `.env.production.local`. |
| **Rotate the display token** (e.g. after a leak) | Generate one with `openssl rand -hex 32`. Put it in `.env.production.local`, run `npx convex env set DISPLAY_TOKEN <token> --prod`, then redeploy the bundle. |
| `npm run bundle:pi` fails | Usually a missing value in `.env`. The error message names the variable. |

## New Pi checklist (one time)

Use Raspberry Pi OS **with desktop**, **64-bit**, on a Pi 4 or 5, and connect it to Tailscale. Then:

1. **Install the bundle** using the deploy steps above. `install.sh` installs Node.js automatically if it's missing.
2. **Turn on auto-login.** Run `sudo raspi-config`, go to **System Options → Boot / Auto Login → Desktop Autologin**, then reboot. With no mouse plugged in, the cursor doesn't show.
3. **Allow Funnel for the Pi.** In the Tailscale admin console, open **Access controls** and give the Pi the `funnel` attribute (a `nodeAttrs` entry with `"attr": ["funnel"]`). Without it, `install.sh` can't make the site public and prints a link to fix it.
4. **Optional: check the popup blockers.** Turn on VNC with `sudo raspi-config` (**Interface Options → VNC**). Connect from your laptop, open `chrome://policy`, and check that every setting shows as applied.
