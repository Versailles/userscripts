# userscripts

Personal userscripts. Install with [Violentmonkey](https://violentmonkey.github.io/) (or Tampermonkey).

## Scripts

| Script | Site | Install |
|---|---|---|
| **HN Heatmap + Velocity Sort** — heat-maps stories by points, adds pts/hr + comments/pt badges, floating sort toolbar (rank / pts / velocity / comments). Remembers last sort. | news.ycombinator.com | [install](https://raw.githubusercontent.com/Versailles/userscripts/main/hn-heatmap.user.js) |
| **Amazon Unit Price Sort** — normalizes unit prices (lb/g/kg→oz, ml/L/gal→fl oz, "100 Sheets"→sheet), sorts by true unit price, 🏆 cheapest + green top 20%, flags results in a non-comparable unit, estimates from the title when Amazon shows none, hides sponsored results/banners. | amazon.com search | [install](https://raw.githubusercontent.com/Versailles/userscripts/main/amazon-unit-price.user.js) |

Clicking an install link opens Violentmonkey's install page. Installed scripts auto-update from `main` via `@updateURL`.

## Workflow

The repo is the source of truth; don't edit scripts in the Violentmonkey editor.

1. Edit `<script>.user.js` locally (optionally with Violentmonkey "Track local file" for live reload).
2. Bump `@version` — Violentmonkey only updates when the version increases.
3. Commit and push to `main`. Browsers pick it up on the next update check (or Violentmonkey → "Check for updates").
