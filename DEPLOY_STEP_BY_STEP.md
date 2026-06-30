# Deploy dead.dance — step by step (no terminal needed)

You're publishing the front end to your GitHub Pages site. The app runs in demo without the
backend, so this alone lets you **see it out there**. ~5 minutes.

## What changed (only upload these 6)
From `/Users/michael/LUKAS_APPS/gd_project/02_Development/dead_dance_v1/`:
1. `index.html`
2. `sales_crm.html`
3. `hostaband.html`
4. `operator_academy.html`
5. `console_directory.html`  ← new file
6. `sw.js`  ← (this is what tells phones to grab the new version: v86)

## Path C — one command (after a 2-minute one-time setup) ⭐ fastest
A script now does the whole front-end deploy for you: **`deploy.sh`** (in this folder).
It auto-bumps the service-worker version, copies the web files into your repo (never touching CNAME), and commits + pushes.

**One-time setup (do once):**
1. Clone the repo locally if you haven't: `git clone https://github.com/michaellukasme-dot/dead_dance.git ~/dead_dance`
2. Open `deploy.sh`, confirm `REPO_DIR` points at that clone (default `~/dead_dance`).

**Every deploy after that — one line in Terminal:**
```
cd "/Users/michael/LUKAS_APPS/gd_project/02_Development/dead_dance_v1"
./deploy.sh "calendar hover restored"
```
It prints the new version and pushes. Wait ~1–2 min (repo → Actions tab → green), then hard-refresh the site. That's it — no more hand-uploading files.

## Path A — GitHub website (easiest, no terminal)
1. Go to **github.com** → sign in (`michaellukasme-dot`).
2. Open the **dead_dance** repository (the one whose Pages serves your site — it's the repo that already has `index.html` in it).
3. Make sure you're on the **main** branch and in the **folder where `index.html` currently lives** (repo root, unless you publish from a `/docs` folder — match wherever the existing `index.html` is).
4. Click **Add file ▸ Upload files**.
5. Drag in the **6 files** above. GitHub will overwrite the old ones with the same names (that's what we want).
6. Scroll down, **Commit changes** (commit straight to `main`).
7. **Do NOT delete the `CNAME` file** in the repo — that's what keeps your custom domain pointed. (Uploading files won't touch it; just don't remove it.)
8. Wait **1–2 minutes** for GitHub Pages to rebuild (you can watch it under the repo's **Actions** tab — green check = live).

## Path B — terminal (if you'd rather)
```
cd /Users/michael/LUKAS_APPS/gd_project/02_Development/dead_dance_v1
# copy the 6 files into your local clone of the dead_dance repo, then:
cd <your-dead_dance-repo>
git add index.html sales_crm.html hostaband.html operator_academy.html console_directory.html sw.js
git commit -m "ship v86: calendar rebuild, synthesis, hostaband, CRM scorecards/oversight/QA, console map"
git push origin main
```

## See it (and force the newest version)
1. Open your site (the dead.dance domain, or `https://michaellukasme-dot.github.io/dead_dance/`).
2. To be sure you're on v86, **hard refresh**: desktop = Cmd+Shift+R; phone = close all the site's tabs and reopen, or pull-to-refresh twice. (The service worker is network-first, so it self-updates within a load or two.)

## What to look at first (the new stuff)
- **Calendar (top-left)** — Upcoming list, "📍 shows near you," ▦ Month + ‹ › nav, Type filter, Tickets. *(This is your focus-group surface.)*
- **Daily Synthesis** (the 📰 tile in Groups Mirror) → **🎸 Headliner Synthesis** → tap **Dark Star Orchestra** → written recap "from 247 groups" + photo grid, each Like/📡 HyperPost.
- **🧪 Help test** (bottom-left) → the **📅 Calendar Study** tasks for the focus group.
- **Reader** → 👥 Friends · 🎸 Bands (Jen & Stu are in there).
- **hostaband.html** — pick a genre + date → **BOOK NOW**.
- **sales_crm.html** — pick **Michele 🐝** to see her scorecard + To‑Dos; the **🛰️ Oversight** roll‑up; **📊 Liquidity**; **🧪 QA** results; **🗺 Map** link.

## Backend (optional, later — for live data)
Apply migrations 25→36 in Supabase per `DEAD_DANCE_DEPLOY_RUNBOOK.md`. Not needed just to see it.

> If anything looks stale after deploy, it's almost always cache — hard refresh once more. SW is **v86**.
