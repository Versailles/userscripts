# userscripts

Personal userscripts. Install with [Violentmonkey](https://violentmonkey.github.io/) (or Tampermonkey).

## Scripts

| Script | Site | Install |
|---|---|---|
| **HN Heatmap + Velocity Sort** — heat-maps stories by points, adds pts/hr + comments/pt badges, floating sort toolbar (rank / pts / velocity / comments). Remembers last sort. | news.ycombinator.com | [install](https://raw.githubusercontent.com/Versailles/userscripts/main/hn-heatmap.user.js) |

Clicking an install link opens Violentmonkey's install page. Installed scripts auto-update from `main` via `@updateURL`.

## Workflow

The repo is the source of truth; don't edit scripts in the Violentmonkey editor.

1. Edit `<script>.user.js` locally (optionally with Violentmonkey "Track local file" for live reload).
2. Bump `@version` — Violentmonkey only updates when the version increases.
3. Commit and push to `main`. Browsers pick it up on the next update check (or Violentmonkey → "Check for updates").
