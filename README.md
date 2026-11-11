# userscripts

Personal userscripts. Install with [Violentmonkey](https://violentmonkey.github.io/) (or Tampermonkey on Chrome).

## Scripts

| Script | Site | What it does |
|---|---|---|
| `hn-heatmap.user.js` | news.ycombinator.com | Heat-maps stories by points, adds pts/hr + comments/pt badges, floating sort toolbar (rank / pts / velocity / comments). Remembers last sort. |

## Dev loop (Violentmonkey)

1. `chrome://extensions` → Violentmonkey → enable **Allow access to file URLs**.
2. Open `file:///home/versailles/Work/userscripts/<script>.user.js` in Chrome and install.
3. Keep that tab open — Violentmonkey tracks the file and reloads the script on every save.
