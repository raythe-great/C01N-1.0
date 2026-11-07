/* Komponen UI yang dipakai ulang: ikon, format, toast, sheet, dialog, grafik. */
(function () {
  'use strict';
  const C = window.C01NCore;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICONS = {
    home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', expense: 'M22 17l-8.5-8.5-5 5L2 7 M16 17h6v-6',
    pie: 'M21 12A9 9 0 1 1 12 3 M12 3v9h9', target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', plus: 'M12 5v14M5 12h14',
    'arrow-in': 'M17 7L7 17 M17 17H7V7', 'arrow-out': 'M7 17L17 7 M7 7h10v10', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
    calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M16 2v4 M8 2v4 M3 10h18',
    wallet: 'M3 7a2 2 0 0 1 2-2h14v4 M3 7v11a2 2 0 0 0 2 2h16V9H5a2 2 0 0 1-2-2z M17 14h.01',
    repeat: 'M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3',
    bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    chart: 'M18 20V10M12 20V4M6 20v-6', settings: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
    lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12', trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
    edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'eye-off': 'M17.9 17.9A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9 M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2 M1 1l22 22',
    right: 'M9 18l6-6-6-6', left: 'M15 18l-6-6 6-6', close: 'M18 6L6 18M6 6l12 12', check: 'M20 6L9 17l-5-5', swap: 'M16 3l4 4-4 4 M20 7H4 M8 21l-4-4 4-4 M4 17h16',
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z M7 7h.01', file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8',
    printer: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
    backspace: 'M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M18 9l-6 6 M12 9l6 6', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
    finger: 'M12 11v3 M8 14c0-2.2 1.8-4 4-4s4 1.8 4 4v2 M5 16v-2a7 7 0 0 1 14 0v3 M9 20c1-1 1-3 1-5 M15 20c.5-1.5 1-3 1-5', warn: 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'
  };
  const icon = (n, cls) => '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICONS[n] || ICONS.info) + '"/></svg>';

  const S = () => window.Store.state;
  const cur = () => S().settings.currency;
  const money = (v, o) => C.formatMoney(v, cur(), o);
  const moneyH = v => S().settings.hideBalance ? C.CURRENCIES[cur()].symbol + ' ••••••' : money(v);
  const fdate = ts => C.formatDate(ts, S().settings.dateFormat);
  const rel = ts => { // "Hari ini", "Kemarin", atau tanggal
    const t = C.periodRange('day', Date.now())[0], d = C.periodRange('day', ts)[0], diff = Math.round((t - d) / 86400000);
    return diff === 0 ? 'Hari ini' : diff === 1 ? 'Kemarin' : fdate(ts);
  };

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg, kind) {
    const el = $('#snackbar'); el.textContent = msg; el.classList.toggle('bad', kind === 'bad'); el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), kind === 'bad' ? 3600 : 2400);
  }

  /* ---------- lapisan (sheet / dialog) agar tombol Kembali menutup yang paling atas ---------- */
  const Layers = [];
  function mountLayer(bd, center) {
    $('#overlay').append(bd); requestAnimationFrame(() => bd.classList.add('open'));
    const layer = { el: bd, close() { const i = Layers.indexOf(layer); if (i >= 0) Layers.splice(i, 1); bd.classList.remove('open'); setTimeout(() => bd.remove(), 230); } };
    Layers.push(layer); return layer;
  }
  function openSheet(o) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="grab"></div><div class="sheet-head"><h2>' + esc(o.title) + '</h2><button class="icon-btn" data-close aria-label="Tutup">' + icon('close') + '</button></div><div class="sheet-body">' + o.html + '</div></div>';
    const layer = mountLayer(bd);
    bd.addEventListener('click', e => { if (e.target === bd || e.target.closest('[data-close]')) layer.close(); });
    if (o.onMount) o.onMount($('.sheet-body', bd), layer);
    return layer;
  }
  function dialog(o) {
    return new Promise(resolve => {
      const bd = document.createElement('div'); bd.className = 'backdrop center';
      bd.innerHTML = '<div class="dialog" role="alertdialog" aria-modal="true"><h2>' + esc(o.title) + '</h2><p>' + esc(o.message || '') + '</p><div class="row">' +
        o.buttons.map((b, i) => '<button class="btn ' + (b.kind || '') + '" data-i="' + i + '">' + esc(b.label) + '</button>').join('') + '</div></div>';
      const layer = mountLayer(bd); layer.cancel = () => { layer.close(); resolve(null); };
      bd.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { layer.close(); resolve(o.buttons[+b.dataset.i].value); } else if (e.target === bd) layer.cancel(); });
    });
  }
  const confirmBox = (title, message, ok, danger) => dialog({ title, message, buttons: [{ label: 'Batal', value: false, kind: 'ghost' }, { label: ok || 'Ya', value: true, kind: danger ? 'danger' : 'primary' }] }).then(v => v === true);
  function closeTopLayer() { const l = Layers[Layers.length - 1]; if (!l) return false; if (l.cancel) l.cancel(); else l.close(); return true; }

  /* Cegah klik ganda (mis. transaksi tercatat dua kali) */
  async function guarded(btn, fn) {
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = '1'; btn.classList.add('loading');
    try { await fn(); } finally { delete btn.dataset.busy; btn.classList.remove('loading'); }
  }

  /* ---------- grafik ---------- */
  function barsHtml(series, mode) { // mode: both | income | expense
    const vals = series.flatMap(s => mode === 'both' ? [s.income, s.expense] : [mode === 'income' ? s.income : s.expense]);
    const max = Math.max(1, ...vals), dense = series.length > 12, step = series.length > 20 ? 5 : series.length > 12 ? 2 : 1;
    const h = v => (v ? Math.max(3, v / max * 100) : 2) + '%';
    const cols = series.map((s, i) => '<div class="bar-col" style="--d:' + (i * 12) + 'ms">' + (mode === 'both'
      ? '<div class="bar b-in" style="--h:' + h(s.income) + '"></div><div class="bar b-out" style="--h:' + h(s.expense) + '"></div>'
      : '<div class="bar single" style="--h:' + h(mode === 'income' ? s.income : s.expense) + '"></div>') + '</div>').join('');
    const labels = series.map((s, i) => '<span>' + (i % step === 0 ? esc(s.label) : '') + '</span>').join('');
    const total = series.reduce((a, s) => a + (mode === 'income' ? s.income : mode === 'expense' ? s.expense : s.income + s.expense), 0);
    return '<div class="bars' + (dense ? ' dense' : '') + '" role="img" aria-label="Grafik batang, total ' + esc(money(total)) + '">' + cols + '</div><div class="bar-labels">' + labels + '</div>';
  }
  function donutHtml(items, onPick) { // items: [{id,name,total,pct}]
    if (!items.length) return '';
    const top = items.slice(0, 5), rest = items.slice(5), list = top.slice();
    if (rest.length) list.push({ id: '', name: 'Lainnya', total: rest.reduce((a, x) => a + x.total, 0), pct: rest.reduce((a, x) => a + x.pct, 0) });
    let off = 0;
    const circles = list.map((x, i) => { const c = '<circle class="seg-' + i + '" cx="21" cy="21" r="15.9155" stroke-dasharray="' + Math.max(0.5, x.pct - 0.6).toFixed(2) + ' ' + (100 - Math.max(0.5, x.pct - 0.6)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>'; off += x.pct; return c; }).join('');
    const legend = list.map((x, i) => '<button class="cat-line pressable" ' + (x.id ? 'data-act="cat-detail" data-id="' + esc(x.id) + '"' : 'disabled') + '><i class="seg-' + i + '" style="stroke:none"></i><span class="n">' + esc(x.name) + '</span><span class="p num">' + Math.round(x.pct) + '%</span></button>').join('');
    return '<div class="donut-wrap"><svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Diagram kategori"><circle class="bgc" cx="21" cy="21" r="15.9155"/>' + circles + '</svg><div class="cat-list">' + legend + '</div></div>';
  }

  /* ---------- tema ---------- */
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    const st = S() ? S().settings : { theme: 'system', reduceMotion: false };
    const root = document.documentElement;
    if (st.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', st.theme);
    root.classList.toggle('reduce-motion', !!st.reduceMotion);
    const dark = st.theme === 'dark' || (st.theme === 'system' && mq && mq.matches);
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || (dark ? '#0F1B21' : '#F5F2EB');
    window.Native.setBars(bg, dark);
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (S() && S().settings.theme === 'system') applyTheme(); });

  /* ---------- komponen daftar transaksi ---------- */
  function txRow(t) {
    const st = S(), isT = t.type === 'transfer', w = id => (st.wallets.find(x => x.id === id) || {}).name || '?';
    const sub = isT ? w(t.walletId) + ' → ' + w(t.toWalletId) : C.categoryName(st, t.categoryId) + ' · ' + w(t.walletId);
    const cls = t.type === 'income' ? 'ok' : t.type === 'expense' ? 'bad' : 'muted';
    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
    return '<button class="tx" data-act="tx-edit" data-id="' + esc(t.id) + '"><span class="ico ' + cls + '">' + icon(isT ? 'swap' : t.type === 'income' ? 'arrow-in' : 'arrow-out', 'sm') + '</span><span class="info"><span class="t">' + esc(t.title || C.categoryName(st, t.categoryId)) + '</span><span class="s">' + esc(sub) + (t.recurringId ? ' · berulang' : '') + ' · ' + C.formatTime(t.ts) + '</span></span><span class="a num ' + cls + '">' + sign + ' ' + esc(money(t.amount, { noSymbol: false })) + '</span></button>';
  }
  function txGroups(items) { // dikelompokkan per hari
    let out = '', last = '';
    items.forEach(t => { const k = C.dateInputValue(t.ts); if (k !== last) { out += '<div class="day-h">' + esc(rel(t.ts)) + '</div>'; last = k; } out += txRow(t); });
    return out;
  }
  const emptyState = (ic, title, text, btn) => '<div class="empty">' + icon(ic) + '<b>' + esc(title) + '</b>' + esc(text || '') + (btn || '') + '</div>';

  window.UI = { $, $$, esc, icon, money, moneyH, fdate, rel, toast, Layers, openSheet, dialog, confirmBox, closeTopLayer, guarded, barsHtml, donutHtml, applyTheme, txRow, txGroups, emptyState, S };
})();
