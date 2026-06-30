#!/usr/bin/env bash
# ============================================================================
# dead.dance — one-command front-end deploy to GitHub Pages
# Run from your Mac (uses YOUR git login). It:
#   1. auto-bumps the service-worker cache version (so phones grab the new build)
#   2. copies the web files into your dead_dance repo clone (NEVER deletes CNAME)
#   3. commits + pushes → GitHub Pages rebuilds → live in ~1–2 min
#
# ONE-TIME SETUP: set REPO_DIR below to your local clone of the dead_dance repo
#   (the folder that has the live index.html + the CNAME file).
# THEN, any time you want to ship:  ./deploy.sh "what changed"
# ============================================================================
set -euo pipefail

# ---- CONFIG ----------------------------------------------------------------
SRC="/Users/michael/LUKAS_APPS/gd_project/02_Development/dead_dance_v1"
REPO_DIR="${REPO_DIR:-$HOME/dead_dance}"     # local clone (auto-created on first run)
REPO_URL="${REPO_URL:-https://github.com/michaellukasme-dot/dead_dance.git}"
BRANCH="${BRANCH:-main}"
MSG="${1:-deploy $(date '+%Y-%m-%d %H:%M')}"

# ---- guards ----------------------------------------------------------------
[ -d "$SRC" ] || { echo "❌ source not found: $SRC"; exit 1; }

# auto-clone the repo the FIRST time so there's zero setup
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "📥 first run — cloning the site repo into $REPO_DIR …"
  git clone "$REPO_URL" "$REPO_DIR" || { echo "❌ clone failed. If it asked for a login, sign in to GitHub once (or run: gh auth login), then re-run ./deploy.sh"; exit 1; }
fi
git -C "$REPO_DIR" pull --quiet origin "$BRANCH" 2>/dev/null || true

# ---- 1) auto-bump the service-worker cache version (vNN -> vNN+1) -----------
cur=$(grep -oE 'deaddance-v[0-9]+' "$SRC/sw.js" | head -1 | grep -oE '[0-9]+' || echo "")
if [ -n "$cur" ]; then
  next=$((cur+1)); today=$(date '+%Y-%m-%d')
  perl -pi -e "s/deaddance-v[0-9]+-[0-9-]+/deaddance-v${next}-${today}/" "$SRC/sw.js"
  echo "🔖 service worker bumped: v${cur} → v${next} (${today})"
fi

# ---- 2) copy web files into the repo (NO --delete; keep CNAME) -------------
# only ship web assets; never push docs/sql/scripts/backups to the public site.
rsync -av --no-perms --omit-dir-times \
  --exclude='.git' --exclude='CNAME' \
  --exclude='*.md' --exclude='*.sql' --exclude='*.sh' --exclude='*.bak' \
  --include='*/' \
  --include='*.html' --include='*.js' --include='*.css' \
  --include='*.png' --include='*.svg' --include='*.webmanifest' --include='*.json' \
  --exclude='*' \
  "$SRC/"  "$REPO_DIR/"

# ---- 3) commit + push ------------------------------------------------------
cd "$REPO_DIR"
[ -f CNAME ] && echo "🔒 CNAME present — custom domain preserved." || echo "⚠️  no CNAME in repo (custom domain may not be set)."
git add -A
if git diff --cached --quiet; then
  echo "✓ nothing changed — already up to date."; exit 0
fi
git commit -m "$MSG"
git push origin "$BRANCH"

echo "✅ deployed: $MSG"
echo "   GitHub Pages rebuilds in ~1–2 min (watch the repo's Actions tab)."
echo "   Then hard-refresh the site (Cmd+Shift+R) to pull the new build."
