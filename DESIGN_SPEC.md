# DeadDance / StageFill design spec — "Hanz & Franz"

**DEFAULT = LIGHT PURPLE. Never ship dark-purple/black pages.** Every new page starts from this palette
(canonical source: `dd_theme.css`). Dark is only allowed for a deliberate utility surface (e.g. a camera
scanner view) and must be explicitly requested.

## Palette (paste into any new page's `:root`)

```css
:root{
  --ink:#1b1226;      /* near-black text */
  --muted:#6a6280;    /* secondary text */
  --line:#e6e0f0;     /* borders / hairlines */
  --bg:#f6f4fa;       /* page background (light lavender) */
  --card:#ffffff;     /* panels / cards */
  --accent:#6d28d9;   /* primary purple */
  --accent2:#7c3aed;  /* purple gradient top */
  --purple:#5a2e86;   /* deep purple (dd_theme) */
  --gold:#b07d17;     /* rewards / merch highlight */
  --rose:#b8002e;     /* DeadDance rose accent */
  --ok:#12a150;       /* success */
}
```

## Surfaces
- **Page background:** `--bg` (or a soft light-purple top wash: `radial-gradient(120% 120% at 50% 0,#efe9fb,#f6f4fa 55%)`).
- **Cards/panels:** `--card` (#fff), `1px solid --line`, soft shadow `0 4px 18px rgba(90,46,134,.06)`.
- **Text:** `--ink`; secondary `--muted`. Never white text except on a filled accent/gold button.
- **Primary button:** purple `linear-gradient(180deg,var(--accent2),var(--accent))`, white text.
- **Reward/merch button:** gold `linear-gradient(180deg,#e0b94a,#c79a3a)`, ink `#3a2400` text.
- **Ghost button:** `#f1ecf7` bg, `--accent` text, `--line` border.
- **Inputs/selects:** white bg, `--line` border, `--ink` text, focus border `--accent`.
- **Success box:** `#eafaf1` bg / `#b7e6cc` border / `#12633f` text.  **Error:** `#fdecee` / `#f3b8c2` / `#c0203a`.
- **Toast:** solid `--ok` bg, white text.
- **Badges/pills:** `#f1ecf7` bg, `--accent` text, `--line` border.

## Reference pages (already on-spec)
`venue_claim.html`, `venue.html`, `stagefill_map.html`, `street.html`, `band_shirts.html`, `print_partner.html`.

## Rule of thumb
If a new page's background is dark or its cards are `#2a1b3d`/`#1a0f2b`/`#231238`, it's WRONG — convert to the
palette above before shipping.
