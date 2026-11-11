// ==UserScript==
// @name         HN Heatmap + Velocity Sort
// @namespace    https://news.ycombinator.com/
// @homepageURL  https://github.com/Versailles/userscripts
// @updateURL    https://raw.githubusercontent.com/Versailles/userscripts/main/hn-heatmap.user.js
// @downloadURL  https://raw.githubusercontent.com/Versailles/userscripts/main/hn-heatmap.user.js
// @version      1.1
// @description  Heat-map HN stories by points, add pts/hr + comments/pt badges, and a sort toolbar.
// @match        https://news.ycombinator.com/
// @match        https://news.ycombinator.com/news*
// @match        https://news.ycombinator.com/front*
// @match        https://news.ycombinator.com/best*
// @match        https://news.ycombinator.com/show*
// @match        https://news.ycombinator.com/ask*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';
  const first = document.querySelector('tr.athing');
  if (!first) return;
  const tbody = first.parentElement;
  const more = tbody.querySelector('.morelink')?.closest('tr') || null;

  const rows = [...tbody.querySelectorAll('tr.athing')].map((a) => {
    const sub = a.nextElementSibling;
    const spacer = sub?.nextElementSibling?.classList.contains('spacer') ? sub.nextElementSibling : null;
    const pts = +(sub?.querySelector('.score')?.textContent.match(/\d+/)?.[0] || 0);
    // Last item?id link is the comments link (the first one is the "N hours ago" link).
    const links = [...(sub?.querySelectorAll('a[href^="item?id"]') || [])];
    const comments = +((links.at(-1)?.textContent.match(/(\d+)\s*comment/) || [])[1] || 0);
    const ageAttr = sub?.querySelector('.age')?.getAttribute('title') || '';
    const [iso, unix] = ageAttr.split(' ');
    const ts = unix ? +unix * 1000 : Date.parse(iso + 'Z');
    const hrs = Math.max((Date.now() - ts) / 36e5, 0.1) || 1;
    const rank = +(a.querySelector('.rank')?.textContent.replace('.', '') || 0);
    return { a, sub, spacer, pts, comments, hrs, rank, velocity: pts / hrs };
  });

  const maxPts = Math.max(1, ...rows.map((r) => r.pts));
  const maxVel = Math.max(1e-9, ...rows.map((r) => r.velocity));

  for (const r of rows) {
    const t = r.pts / maxPts;
    const pct = Math.round(t * 100);
    r.a.style.background =
      `linear-gradient(90deg, hsla(${30 - 30 * t},95%,55%,${0.15 + 0.45 * t}) ${pct}%, transparent ${pct}%)`;

    const subline = r.sub?.querySelector('.subline');
    if (!subline) continue; // job posts have no points/comments
    const hot = r.velocity / maxVel > 0.6;
    const badge = document.createElement('span');
    badge.textContent =
      ` ${hot ? '🔥' : '⚡'} ${r.velocity.toFixed(1)} pts/hr · ${(r.comments / Math.max(r.pts, 1)).toFixed(2)} c/pt`;
    badge.style.cssText =
      `font:600 10px ui-monospace,monospace;margin-left:8px;padding:1px 6px;border-radius:9px;` +
      `background:${hot ? '#ff6600' : '#ddd'};color:${hot ? '#fff' : '#333'}`;
    subline.appendChild(badge);
  }

  const bar = document.createElement('div');
  bar.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:9999;background:#111;color:#fff;padding:10px 12px;' +
    'border-radius:10px;font:12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.35)';
  bar.innerHTML = '<b>⚙ HN sort</b><br>' + ['rank', 'pts', 'velocity', 'comments']
    .map((k) => `<button data-k="${k}" style="margin:4px 2px 0;border:0;border-radius:6px;padding:3px 7px;cursor:pointer">${k}</button>`)
    .join('');

  const sortBy = (k) => {
    const sorted = [...rows].sort((x, y) => (k === 'rank' ? x.rank - y.rank : y[k] - x[k]));
    for (const r of sorted) {
      for (const el of [r.a, r.sub, r.spacer]) if (el) tbody.insertBefore(el, more);
    }
    bar.querySelectorAll('button').forEach((b) => {
      b.style.background = b.dataset.k === k ? '#ff6600' : '';
      b.style.color = b.dataset.k === k ? '#fff' : '';
    });
    try { localStorage.setItem('hn-heatmap-sort', k); } catch {}
  };

  bar.addEventListener('click', (e) => {
    const k = e.target.dataset?.k;
    if (k) sortBy(k);
  });
  document.body.appendChild(bar);

  let saved = 'rank';
  try { saved = localStorage.getItem('hn-heatmap-sort') || 'rank'; } catch {}
  sortBy(saved);
})();
