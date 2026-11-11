// ==UserScript==
// @name         Amazon Unit Price Sort
// @namespace    https://github.com/Versailles/userscripts
// @homepageURL  https://github.com/Versailles/userscripts
// @updateURL    https://raw.githubusercontent.com/Versailles/userscripts/main/amazon-unit-price.user.js
// @downloadURL  https://raw.githubusercontent.com/Versailles/userscripts/main/amazon-unit-price.user.js
// @version      1.0
// @description  Normalize unit prices on Amazon search results, sort by true unit price, flag the best deals, hide sponsored.
// @match        https://www.amazon.com/s?*
// @match        https://www.amazon.com/s/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  // ---------- units ----------
  // Each unit maps to a family and a factor into that family's base unit.
  const UNITS = {
    // weight -> ounce
    'ounce': ['wt', 1], 'ounces': ['wt', 1], 'oz': ['wt', 1],
    'pound': ['wt', 16], 'pounds': ['wt', 16], 'lb': ['wt', 16], 'lbs': ['wt', 16],
    'gram': ['wt', 0.035274], 'grams': ['wt', 0.035274], 'g': ['wt', 0.035274],
    'kilogram': ['wt', 35.274], 'kilograms': ['wt', 35.274], 'kg': ['wt', 35.274],
    // volume -> fluid ounce
    'fluid ounce': ['vol', 1], 'fluid ounces': ['vol', 1], 'fl oz': ['vol', 1], 'fl. oz': ['vol', 1],
    'milliliter': ['vol', 0.033814], 'milliliters': ['vol', 0.033814], 'ml': ['vol', 0.033814],
    'liter': ['vol', 33.814], 'liters': ['vol', 33.814], 'l': ['vol', 33.814],
    'gallon': ['vol', 128], 'gallons': ['vol', 128], 'quart': ['vol', 32], 'pint': ['vol', 16],
    // count -> item
    'count': ['ct', 1], 'ct': ['ct', 1], 'each': ['ct', 1], 'item': ['ct', 1], 'items': ['ct', 1],
    'sheet': ['ct', 1], 'sheets': ['ct', 1], 'load': ['load', 1], 'loads': ['load', 1],
    'square foot': ['sqft', 1], 'sq ft': ['sqft', 1], 'foot': ['ft', 1], 'feet': ['ft', 1],
  };
  const BASE_LABEL = { wt: 'oz', vol: 'fl oz', ct: 'item', load: 'load', sqft: 'sq ft', ft: 'ft', liq: 'oz*' };

  const parseMoney = (s) => {
    s = s.replace(/,/g, '');
    const c = s.match(/([\d.]+)\s*¢/);
    if (c) return +c[1] / 100;
    const d = s.match(/\$\s*([\d.]+)/);
    return d ? +d[1] : NaN;
  };

  // "100 Sheets" -> {family:'ct', factor:100}; "ounce" -> {family:'wt', factor:1}
  const parseUnit = (raw) => {
    const m = raw.trim().toLowerCase().match(/^([\d.,]+)?\s*(.+?)\.?$/);
    if (!m) return null;
    const qty = m[1] ? +m[1].replace(/,/g, '') : 1;
    const u = UNITS[m[2]];
    return u ? { family: u[0], factor: u[1] * qty } : { family: 'other:' + m[2], factor: qty };
  };

  // Fallback: estimate from the title, e.g. "Coffee, 2 lb, Pack of 3".
  const TITLE_RE = /(\d+(?:\.\d+)?)\s*-?\s*(fl\.?\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|kilograms?|kg|grams?|g|milliliters?|ml|liters?|l|count|ct)\b/i;
  const PACK_RE = /(?:pack of|set of)\s*(\d+)|(\d+)\s*-?\s*(?:pack|pk)\b/i;
  const estimateFromTitle = (title, price) => {
    const m = title.match(TITLE_RE);
    if (!m || !(price > 0)) return null;
    const u = UNITS[m[2].toLowerCase().replace(/\s+/g, ' ').replace('fl. oz', 'fl oz').replace('fl.oz', 'fl oz')];
    if (!u) return null;
    const p = title.match(PACK_RE);
    const packs = p ? +(p[1] || p[2]) : 1;
    const qtyBase = +m[1] * u[1] * packs;
    if (!(qtyBase > 0)) return null;
    return { family: u[0], perBase: price / qtyBase, est: true };
  };

  // ---------- state ----------
  const LS = 'aup-settings';
  let settings = { sort: 'unit', hideSponsored: true, mergeLiquids: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(LS) || '{}')); } catch {}
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(settings)); } catch {} };

  let seq = 0;
  const data = new WeakMap(); // element -> parsed info

  const analyze = (el) => {
    if (data.has(el)) return data.get(el);
    const info = { idx: seq++, sponsored: !!el.querySelector('.puis-sponsored-label-text') };
    const price = parseMoney(el.querySelector('.a-price:not(.a-text-price) .a-offscreen')?.textContent || '');
    const span = [...el.querySelectorAll('span.a-size-base')]
      .find((s) => /\/[^)]+\)\s*$/.test(s.textContent) && /[$¢]/.test(s.textContent));
    if (span) {
      const txt = span.textContent.replace(/\s+/g, ' ');
      const per = parseMoney(span.querySelector('.a-offscreen')?.textContent || txt);
      const unit = parseUnit((txt.match(/\/\s*([^)]+)\)\s*$/) || [])[1] || '');
      if (per > 0 && unit) Object.assign(info, { family: unit.family, perBase: per / unit.factor, est: false });
    }
    if (info.perBase == null) {
      const est = estimateFromTitle(el.querySelector('h2')?.textContent || '', price);
      if (est) Object.assign(info, est);
    }
    data.set(el, info);
    return info;
  };

  // Decide once per widget, on first sight while it's still visible. Re-checking later is wrong:
  // innerText of a display:none element falls back to textContent, which starts with tracking scripts.
  const adCache = new WeakMap();
  const AD_SEL = '[aria-label^="Sponsored"], .puis-sponsored-label-text, .s-sponsored-label-text, [data-component-type^="sbv"], [data-component-type*="sponsored" i]';
  const isAdWidget = (w) => {
    if (!adCache.has(w)) {
      adCache.set(w, !!w.querySelector(AD_SEL) || /\bSponsored\b/.test((w.innerText || '').slice(0, 300)));
    }
    return adCache.get(w);
  };

  const famOf = (i) => (settings.mergeLiquids && (i.family === 'wt' || i.family === 'vol') ? 'liq' : i.family);
  const fmt = (v) => (v < 0.1 ? (v * 100).toFixed(v < 0.01 ? 2 : 1) + '¢' : '$' + v.toFixed(2));

  // ---------- render ----------
  const css = document.createElement('style');
  css.textContent = `
    .aup-badge{display:inline-block;margin:4px 0;padding:2px 8px;border-radius:10px;font:600 12px/1.6 ui-monospace,monospace;background:#eef0f2;color:#232f3e}
    .aup-badge.aup-best{background:#067d62;color:#fff}
    .aup-badge.aup-good{background:#c7f0e3;color:#04503f}
    .aup-badge.aup-other{background:#fff4d6;color:#7a5800}
    .aup-hidden{display:none!important}
    #aup-bar{position:fixed;right:16px;bottom:16px;z-index:99999;background:#232f3e;color:#fff;padding:10px 12px;border-radius:10px;
      font:13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);min-width:210px}
    #aup-bar b{display:block;margin-bottom:6px}
    #aup-bar label{display:flex;gap:6px;align-items:center;margin:3px 0;cursor:pointer}
    #aup-bar select{width:100%;margin:2px 0 4px;padding:2px;border-radius:5px}
    #aup-bar small{opacity:.75;display:block;margin-top:4px}`;
  document.head.appendChild(css);

  const bar = document.createElement('div');
  bar.id = 'aup-bar';
  bar.innerHTML = `<b>⚖ Unit price</b>
    <select data-k="sort"><option value="unit">Sort: unit price (low→high)</option><option value="amazon">Sort: Amazon default</option></select>
    <label><input type="checkbox" data-k="hideSponsored"> Hide sponsored</label>
    <label title="Treat fl oz and oz as comparable (≈ for water-like liquids)"><input type="checkbox" data-k="mergeLiquids"> Merge oz ≈ fl oz</label>
    <small id="aup-stats"></small>`;
  bar.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    settings[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    save();
    apply();
  });
  const syncBar = () => {
    bar.querySelector('[data-k=sort]').value = settings.sort;
    bar.querySelector('[data-k=hideSponsored]').checked = settings.hideSponsored;
    bar.querySelector('[data-k=mergeLiquids]').checked = settings.mergeLiquids;
  };

  let applying = false;
  let marker = null;
  const apply = () => {
    const slot = document.querySelector('.s-main-slot');
    if (!slot) return;
    applying = true;
    try {
      const results = [...slot.querySelectorAll(':scope > [data-component-type="s-search-result"]')];
      const infos = results.map((el) => [el, analyze(el)]);

      // dominant family = most common among priced results
      const counts = {};
      infos.forEach(([, i]) => { if (i.perBase != null) counts[famOf(i)] = (counts[famOf(i)] || 0) + 1; });
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

      // rank within dominant family (sponsored included only if visible)
      const visible = (i) => !(settings.hideSponsored && i.sponsored);
      const ranked = infos.filter(([, i]) => i.perBase != null && famOf(i) === dominant && visible(i))
        .map(([, i]) => i.perBase).sort((a, b) => a - b);
      const bestCut = ranked[0], goodCut = ranked[Math.max(0, Math.ceil(ranked.length * 0.2) - 1)];

      for (const [el, i] of infos) {
        el.classList.toggle('aup-hidden', !visible(i));
        let b = el.querySelector('.aup-badge');
        if (i.perBase == null) { b?.remove(); continue; }
        if (!b) {
          b = document.createElement('div');
          b.className = 'aup-badge';
          (el.querySelector('[data-cy="price-recipe"]') || el.querySelector('h2')?.parentElement || el).appendChild(b);
        }
        const fam = famOf(i);
        const label = BASE_LABEL[fam] || fam.replace('other:', '');
        b.textContent = `${fam === dominant && i.perBase === bestCut ? '🏆 ' : ''}${fmt(i.perBase)}/${label}${i.est ? ' (est. from title)' : ''}`;
        b.className = 'aup-badge' + (fam !== dominant ? ' aup-other' : i.perBase === bestCut ? ' aup-best' : i.perBase <= goodCut ? ' aup-good' : '');
        b.title = fam !== dominant ? 'Different unit than most results — not directly comparable' : 'Normalized unit price';
      }

      // non-result sponsored widgets (brand banners, sponsored video, carousels)
      for (const w of slot.querySelectorAll(':scope > .s-result-item:not([data-component-type="s-search-result"])')) {
        w.classList.toggle('aup-hidden', settings.hideSponsored && isAdWidget(w));
      }

      // sort
      const order = [...infos].sort(([, a], [, b]) => {
        if (settings.sort === 'amazon') return a.idx - b.idx;
        const ka = a.perBase == null ? 2 : famOf(a) === dominant ? 0 : 1;
        const kb = b.perBase == null ? 2 : famOf(b) === dominant ? 0 : 1;
        if (ka !== kb) return ka - kb;
        if (ka === 2) return a.idx - b.idx;
        if (ka === 1 && famOf(a) !== famOf(b)) return famOf(a) < famOf(b) ? -1 : 1;
        return a.perBase - b.perBase || a.idx - b.idx;
      });
      // A fixed marker where the first result originally sat; sorted results go right after it.
      if (!marker || marker.parentNode !== slot) {
        marker = document.createComment('aup-results');
        slot.insertBefore(marker, results[0] || null);
      }
      const frag = document.createDocumentFragment();
      order.forEach(([el]) => frag.appendChild(el));
      slot.insertBefore(frag, marker.nextSibling);

      const priced = infos.filter(([, i]) => i.perBase != null).length;
      const est = infos.filter(([, i]) => i.est).length;
      const hidden = slot.querySelectorAll(':scope > .aup-hidden').length;
      bar.querySelector('#aup-stats').textContent =
        `${priced}/${infos.length} priced${est ? ` (${est} est.)` : ''} · unit: ${BASE_LABEL[dominant] || dominant || '—'} · ${hidden} hidden`;
    } finally {
      applying = false;
    }
  };

  document.body.appendChild(bar);
  syncBar();
  apply();

  // Amazon swaps results in place on some filter/sort changes: re-apply when new results show up.
  let t;
  new MutationObserver(() => {
    if (applying) return;
    clearTimeout(t);
    t = setTimeout(() => {
      const fresh = [...document.querySelectorAll('.s-main-slot > [data-component-type="s-search-result"]')].some((el) => !data.has(el));
      if (fresh) apply();
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });
})();
