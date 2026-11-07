/* C01N core — logika keuangan murni (tanpa DOM, tanpa penyimpanan).
   Semua nominal adalah INTEGER dalam satuan terkecil mata uang (IDR: rupiah, USD: sen). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.C01NCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_AMOUNT = 9007199254740; // aman untuk integer JS setelah dikalikan 100
  const CURRENCIES = {
    IDR: { symbol: 'Rp', decimals: 0, thousand: '.', decimal: ',', name: 'Rupiah (IDR)' },
    USD: { symbol: '$', decimals: 2, thousand: ',', decimal: '.', name: 'US Dollar (USD)' },
    EUR: { symbol: '€', decimals: 2, thousand: '.', decimal: ',', name: 'Euro (EUR)' },
    MYR: { symbol: 'RM', decimals: 2, thousand: ',', decimal: '.', name: 'Ringgit (MYR)' },
    SGD: { symbol: 'S$', decimals: 2, thousand: ',', decimal: '.', name: 'Singapore Dollar (SGD)' }
  };
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const METHODS = ['Tunai', 'Transfer bank', 'Kartu', 'E-wallet', 'QRIS', 'Lainnya'];
  const WALLET_TYPES = { cash: 'Tunai', bank: 'Rekening bank', ewallet: 'E-wallet', other: 'Lainnya' };
  const DATE_FORMATS = ['dd MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'];

  /* ---------- util ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isInt(n) { return typeof n === 'number' && Number.isSafeInteger(n); }
  function cleanText(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }

  /* ---------- uang ---------- */
  function currencyOf(code) { return CURRENCIES[code] || CURRENCIES.IDR; }
  function formatMoney(minor, cur, opts) {
    const c = currencyOf(cur), o = opts || {};
    const n = Math.trunc(Number(minor) || 0), neg = n < 0, abs = Math.abs(n);
    const div = Math.pow(10, c.decimals), whole = Math.floor(abs / div), frac = abs % div;
    let s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, c.thousand);
    if (c.decimals) s += c.decimal + String(frac).padStart(c.decimals, '0');
    const sign = neg ? '-' : (o.plus && n > 0 ? '+' : '');
    return sign + (o.noSymbol ? '' : c.symbol + ' ') + s;
  }
  function parseAmount(input, cur) {
    const d = currencyOf(cur).decimals;
    let s = String(input == null ? '' : input).trim().replace(/[^\d.,]/g, '');
    if (!s) return null;
    if (d === 0) s = s.replace(/[.,]/g, '');
    else {
      const m = s.match(/^(.*?)[.,](\d{1,2})$/);
      if (m) s = m[1].replace(/[.,]/g, '') + m[2].padEnd(2, '0');
      else s = s.replace(/[.,]/g, '') + '00';
    }
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    if (!isInt(n) || n <= 0 || n > MAX_AMOUNT) return null;
    return n;
  }
  function amountToInput(minor, cur) {
    const d = currencyOf(cur).decimals;
    if (!d) return String(minor);
    return (minor / Math.pow(10, d)).toFixed(d);
  }
  function plainAmount(minor, cur) { // untuk CSV
    const d = currencyOf(cur).decimals;
    return d ? (minor / Math.pow(10, d)).toFixed(d) : String(minor);
  }

  /* ---------- tanggal ---------- */
  function formatDate(ts, fmt) {
    const d = new Date(ts), dd = pad(d.getDate()), mm = pad(d.getMonth() + 1), y = d.getFullYear();
    if (fmt === 'dd/MM/yyyy') return dd + '/' + mm + '/' + y;
    if (fmt === 'yyyy-MM-dd') return y + '-' + mm + '-' + dd;
    return dd + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + y;
  }
  function formatTime(ts) { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dateInputValue(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function timeInputValue(ts) { return formatTime(ts); }
  function parseDateTime(dateStr, timeStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || ''); if (!m) return null;
    const t = /^(\d{2}):(\d{2})$/.exec(timeStr || '12:00') || [0, '12', '00'];
    const dt = new Date(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
    return isNaN(dt.getTime()) || dt.getMonth() !== +m[2] - 1 ? null : dt.getTime();
  }
  function monthKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function periodRange(kind, ref) {
    const d = new Date(ref); let s, e;
    if (kind === 'day') { s = new Date(d.getFullYear(), d.getMonth(), d.getDate()); e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
    else if (kind === 'week') { const dow = (d.getDay() + 6) % 7; s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow); e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7); }
    else if (kind === 'month') { s = new Date(d.getFullYear(), d.getMonth(), 1); e = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    else { s = new Date(d.getFullYear(), 0, 1); e = new Date(d.getFullYear() + 1, 0, 1); }
    return [s.getTime(), e.getTime()];
  }
  function shiftPeriod(kind, ref, n) {
    const d = new Date(ref);
    if (kind === 'day') d.setDate(d.getDate() + n);
    else if (kind === 'week') d.setDate(d.getDate() + 7 * n);
    else if (kind === 'month') { d.setDate(1); d.setMonth(d.getMonth() + n); }
    else { d.setDate(1); d.setFullYear(d.getFullYear() + n); }
    return d.getTime();
  }
  function periodLabel(kind, ref, fmt) {
    const [s, e] = periodRange(kind, ref), d = new Date(ref);
    if (kind === 'day') return formatDate(s, fmt);
    if (kind === 'week') return formatDate(s, fmt) + ' – ' + formatDate(e - 1, fmt);
    if (kind === 'month') return MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear();
    return String(d.getFullYear());
  }

  /* ---------- state ---------- */
  function defaultCategories() {
    const inc = ['Gaji', 'Bisnis', 'Bonus', 'Investasi', 'Hadiah', 'Lainnya'];
    const exp = ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Kesehatan', 'Hiburan', 'Pendidikan', 'Tempat tinggal', 'Lainnya'];
    const slug = s => s.toLowerCase().replace(/\s+/g, '-');
    return inc.map(n => ({ id: 'in-' + slug(n), name: n, type: 'income', builtin: true }))
      .concat(exp.map(n => ({ id: 'ex-' + slug(n), name: n, type: 'expense', builtin: true })));
  }
  function freshState(now) {
    const t = now || Date.now();
    return {
      v: 3, createdAt: t,
      settings: { name: '', photo: '', currency: 'IDR', dateFormat: 'dd MMM yyyy', theme: 'system', reduceMotion: false, hideBalance: false, onboarded: false },
      wallets: [{ id: 'w-main', name: 'Dompet Utama', type: 'cash', archived: false, createdAt: t }],
      categories: defaultCategories(),
      transactions: [], budgets: [], goals: [], recurring: [], bills: []
    };
  }

  function normalizeTx(t, state) {
    if (!t || !['income', 'expense', 'transfer'].includes(t.type)) return null;
    const amount = Number(t.amount), ts = Number(t.ts);
    if (!isInt(amount) || amount <= 0 || !Number.isFinite(ts)) return null;
    const out = {
      id: String(t.id || uid()), type: t.type, amount, ts,
      walletId: String(t.walletId || ''), toWalletId: t.type === 'transfer' ? String(t.toWalletId || '') : '',
      categoryId: t.type === 'transfer' ? '' : String(t.categoryId || ''),
      title: cleanText(t.title, 60), note: cleanText(t.note, 160), method: cleanText(t.method, 24)
    };
    if (t.recurringId) out.recurringId = String(t.recurringId);
    if (!state.wallets.some(w => w.id === out.walletId)) return null;
    if (out.type === 'transfer' && (!state.wallets.some(w => w.id === out.toWalletId) || out.toWalletId === out.walletId)) return null;
    if (out.type !== 'transfer' && !state.categories.some(c => c.id === out.categoryId && c.type === out.type)) {
      const fb = state.categories.find(c => c.type === out.type && c.name === 'Lainnya');
      if (!fb) return null; out.categoryId = fb.id;
    }
    return out;
  }
  function normalizeState(raw, now) {
    const base = freshState(now), r = raw || {};
    const s = { v: 3, createdAt: Number(r.createdAt) || base.createdAt };
    const rs = r.settings || {};
    s.settings = Object.assign({}, base.settings, {
      name: cleanText(rs.name, 40),
      photo: (typeof rs.photo === 'string' && rs.photo.length < 150000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(rs.photo)) ? rs.photo : '',
      currency: CURRENCIES[rs.currency] ? rs.currency : 'IDR',
      dateFormat: DATE_FORMATS.includes(rs.dateFormat) ? rs.dateFormat : base.settings.dateFormat,
      theme: ['system', 'light', 'dark'].includes(rs.theme) ? rs.theme : 'system',
      reduceMotion: !!rs.reduceMotion, hideBalance: !!rs.hideBalance, onboarded: !!rs.onboarded
    });
    s.wallets = (Array.isArray(r.wallets) ? r.wallets : []).filter(w => w && w.id && w.name).map(w => ({
      id: String(w.id), name: cleanText(w.name, 30), type: WALLET_TYPES[w.type] ? w.type : 'other', archived: !!w.archived, createdAt: Number(w.createdAt) || s.createdAt
    }));
    if (!s.wallets.length) s.wallets = base.wallets;
    const cats = Array.isArray(r.categories) ? r.categories : [];
    s.categories = defaultCategories();
    cats.forEach(c => { if (c && c.id && c.name && ['income', 'expense'].includes(c.type) && !s.categories.some(x => x.id === String(c.id))) s.categories.push({ id: String(c.id), name: cleanText(c.name, 24), type: c.type, builtin: false }); });
    s.transactions = [];
    (Array.isArray(r.transactions) ? r.transactions : []).forEach(t => { const n = normalizeTx(t, s); if (n) s.transactions.push(n); });
    s.budgets = (Array.isArray(r.budgets) ? r.budgets : []).filter(b => b && isInt(Number(b.limit)) && Number(b.limit) > 0 && (b.categoryId === null || s.categories.some(c => c.id === b.categoryId && c.type === 'expense')))
      .map(b => ({ id: String(b.id || uid()), categoryId: b.categoryId === null ? null : String(b.categoryId), limit: Number(b.limit) }));
    s.goals = (Array.isArray(r.goals) ? r.goals : []).filter(g => g && g.id && isInt(Number(g.target)) && Number(g.target) > 0).map(g => ({
      id: String(g.id), name: cleanText(g.name, 40), target: Number(g.target), deadline: g.deadline ? Number(g.deadline) : null,
      saved: Math.max(0, Number(g.saved) || 0), createdAt: Number(g.createdAt) || s.createdAt,
      history: (Array.isArray(g.history) ? g.history : []).filter(h => h && isInt(Number(h.delta))).map(h => ({ id: String(h.id || uid()), ts: Number(h.ts) || s.createdAt, delta: Number(h.delta), note: cleanText(h.note, 60) }))
    }));
    s.recurring = (Array.isArray(r.recurring) ? r.recurring : []).filter(x => x && x.id && ['income', 'expense'].includes(x.type) && ['daily', 'weekly', 'monthly', 'yearly'].includes(x.freq) && isInt(Number(x.amount)) && Number(x.amount) > 0 && Number.isFinite(Number(x.nextTs)) && s.wallets.some(w => w.id === x.walletId)).map(x => ({
      id: String(x.id), title: cleanText(x.title, 60), type: x.type, amount: Number(x.amount), walletId: String(x.walletId), categoryId: String(x.categoryId || ''), method: cleanText(x.method, 24), note: cleanText(x.note, 160),
      freq: x.freq, anchorDay: Number(x.anchorDay) || new Date(Number(x.nextTs)).getDate(), nextTs: Number(x.nextTs), endTs: x.endTs ? Number(x.endTs) : null, active: x.active !== false
    }));
    s.bills = (Array.isArray(r.bills) ? r.bills : []).filter(b => b && b.id && b.name && isInt(Number(b.amount)) && Number(b.amount) > 0).map(b => ({
      id: String(b.id), name: cleanText(b.name, 40), amount: Number(b.amount), dueDay: Math.min(31, Math.max(1, Number(b.dueDay) || 1)),
      remindDays: Math.min(14, Math.max(0, Number(b.remindDays) || 3)), paid: (b.paid && typeof b.paid === 'object') ? b.paid : {}
    }));
    return s;
  }

  /* Migrasi dari C01N 0.4 (localStorage: transaksi bernama kategori, tanpa dompet) */
  function fromLegacy(legacyTx, legacySettings, now) {
    const s = freshState(now), list = Array.isArray(legacyTx) ? legacyTx : [];
    let earliest = Infinity;
    list.forEach(t => {
      if (!t || !['income', 'expense'].includes(t.type)) return;
      const amount = Math.round(Number(t.amount)), ts = Number(t.date);
      if (!isInt(amount) || amount <= 0 || !Number.isFinite(ts)) return;
      let cat = s.categories.find(c => c.type === t.type && c.name === t.category);
      if (!cat) {
        const nm = cleanText(t.category, 24) || 'Lainnya';
        cat = s.categories.find(c => c.type === t.type && c.name === nm);
        if (!cat) { cat = { id: 'cu-' + uid(), name: nm, type: t.type, builtin: false }; s.categories.push(cat); }
      }
      earliest = Math.min(earliest, ts);
      s.transactions.push({ id: 'L' + String(t.id), type: t.type, amount, ts, walletId: 'w-main', toWalletId: '', categoryId: cat.id, title: cleanText(t.title, 60) || 'Transaksi', note: cleanText(t.note, 160), method: '' });
    });
    const budget = Math.round(Number(legacySettings && legacySettings.monthlyBudget));
    if (isInt(budget) && budget > 0) s.budgets.push({ id: uid(), categoryId: null, limit: budget });
    if (legacySettings && legacySettings.hideBalance) s.settings.hideBalance = true;
    if (s.transactions.length) { s.settings.onboarded = true; s.createdAt = earliest; s.wallets[0].createdAt = earliest; }
    return s;
  }

  /* ---------- saldo & agregat ---------- */
  function walletBalance(state, walletId) {
    let b = 0;
    for (const t of state.transactions) {
      if (t.type === 'income' && t.walletId === walletId) b += t.amount;
      else if (t.type === 'expense' && t.walletId === walletId) b -= t.amount;
      else if (t.type === 'transfer') { if (t.walletId === walletId) b -= t.amount; if (t.toWalletId === walletId) b += t.amount; }
    }
    return b;
  }
  function totalBalance(state) { return state.wallets.filter(w => !w.archived).reduce((s, w) => s + walletBalance(state, w.id), 0); }
  function sumByType(txs) { const r = { income: 0, expense: 0 }; txs.forEach(t => { if (t.type === 'income') r.income += t.amount; else if (t.type === 'expense') r.expense += t.amount; }); return r; }
  function inRange(txs, range) { return txs.filter(t => t.ts >= range[0] && t.ts < range[1]); }
  function categoryName(state, id) { const c = state.categories.find(x => x.id === id); return c ? c.name : 'Tanpa kategori'; }
  function groupByCategory(state, txs, type) {
    const m = new Map(); let total = 0;
    txs.filter(t => t.type === type).forEach(t => { m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount); total += t.amount; });
    return [...m.entries()].map(([id, sum]) => ({ id, name: categoryName(state, id), total: sum, pct: total ? sum / total * 100 : 0 })).sort((a, b) => b.total - a.total);
  }
  function queryTransactions(state, f) {
    const q = cleanText(f.q, 60).toLowerCase(); let items = state.transactions.slice();
    if (f.type && f.type !== 'all') items = items.filter(t => t.type === f.type);
    if (f.walletId) items = items.filter(t => t.walletId === f.walletId || t.toWalletId === f.walletId);
    if (f.categoryId) items = items.filter(t => t.categoryId === f.categoryId);
    if (f.from != null) items = items.filter(t => t.ts >= f.from);
    if (f.to != null) items = items.filter(t => t.ts < f.to);
    if (f.minAmount) items = items.filter(t => t.amount >= f.minAmount);
    if (q) items = items.filter(t => (t.title + ' ' + t.note + ' ' + categoryName(state, t.categoryId) + ' ' + t.method).toLowerCase().includes(q));
    const sorts = { 'date-desc': (a, b) => b.ts - a.ts, 'date-asc': (a, b) => a.ts - b.ts, 'amount-desc': (a, b) => b.amount - a.amount, 'amount-asc': (a, b) => a.amount - b.amount };
    return items.sort(sorts[f.sort] || sorts['date-desc']);
  }
  function dailyBars(state, endTs, days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const r = periodRange('day', shiftPeriod('day', endTs, -i)), t = sumByType(inRange(state.transactions, r));
      out.push({ ts: r[0], income: t.income, expense: t.expense });
    }
    return out;
  }
  function dayTotals(state, y, m) {
    const map = {}, r = [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()];
    inRange(state.transactions, r).forEach(t => {
      if (t.type === 'transfer') return;
      const d = new Date(t.ts).getDate(); map[d] = map[d] || { income: 0, expense: 0 }; map[d][t.type] += t.amount;
    });
    return map;
  }

  /* ---------- transaksi (immutable) ---------- */
  function validateTx(state, t, isNew) {
    if (!['income', 'expense', 'transfer'].includes(t.type)) throw new Error('Jenis transaksi tidak valid.');
    if (!isInt(t.amount) || t.amount <= 0) throw new Error('Nominal harus lebih dari 0.');
    if (!Number.isFinite(t.ts)) throw new Error('Tanggal tidak valid.');
    const w = state.wallets.find(x => x.id === t.walletId);
    if (!w || (isNew && w.archived)) throw new Error('Dompet tidak ditemukan.');
    if (t.type === 'transfer') {
      const to = state.wallets.find(x => x.id === t.toWalletId);
      if (!to || (isNew && to.archived)) throw new Error('Dompet tujuan tidak ditemukan.');
      if (t.toWalletId === t.walletId) throw new Error('Dompet asal dan tujuan harus berbeda.');
    } else if (!state.categories.some(c => c.id === t.categoryId && c.type === t.type)) throw new Error('Pilih kategori.');
    if (t.type !== 'transfer' && !cleanText(t.title, 60)) throw new Error('Deskripsi wajib diisi.');
  }
  function addTransaction(state, input) {
    const n = Object.assign({ id: uid(), title: '', note: '', method: '', toWalletId: '', categoryId: '' }, input);
    if (n.type === 'transfer') { n.categoryId = ''; if (!cleanText(n.title, 60)) n.title = 'Transfer antar dompet'; }
    validateTx(state, n, true);
    const tx = normalizeTx(n, state); if (!tx) throw new Error('Data transaksi tidak valid.');
    return { state: Object.assign({}, state, { transactions: state.transactions.concat([tx]) }), tx };
  }
  function updateTransaction(state, id, input) {
    const old = state.transactions.find(t => t.id === id); if (!old) throw new Error('Transaksi tidak ditemukan.');
    const n = Object.assign({}, old, input, { id });
    if (n.type === 'transfer') { n.categoryId = ''; if (!cleanText(n.title, 60)) n.title = 'Transfer antar dompet'; } else n.toWalletId = '';
    validateTx(state, n, false);
    const tx = normalizeTx(n, state); if (!tx) throw new Error('Data transaksi tidak valid.');
    return { state: Object.assign({}, state, { transactions: state.transactions.map(t => t.id === id ? tx : t) }), tx };
  }
  function deleteTransaction(state, id) {
    if (!state.transactions.some(t => t.id === id)) throw new Error('Transaksi tidak ditemukan.');
    return Object.assign({}, state, { transactions: state.transactions.filter(t => t.id !== id) });
  }

  /* ---------- dompet & kategori ---------- */
  function addWallet(state, name, type) {
    const nm = cleanText(name, 30); if (!nm) throw new Error('Nama dompet wajib diisi.');
    if (state.wallets.some(w => w.name.toLowerCase() === nm.toLowerCase() && !w.archived)) throw new Error('Nama dompet sudah dipakai.');
    return Object.assign({}, state, { wallets: state.wallets.concat([{ id: 'w-' + uid(), name: nm, type: WALLET_TYPES[type] ? type : 'other', archived: false, createdAt: Date.now() }]) });
  }
  function renameWallet(state, id, name, type) {
    const nm = cleanText(name, 30); if (!nm) throw new Error('Nama dompet wajib diisi.');
    if (state.wallets.some(w => w.id !== id && !w.archived && w.name.toLowerCase() === nm.toLowerCase())) throw new Error('Nama dompet sudah dipakai.');
    return Object.assign({}, state, { wallets: state.wallets.map(w => w.id === id ? Object.assign({}, w, { name: nm, type: WALLET_TYPES[type] ? type : w.type }) : w) });
  }
  function removeWallet(state, id) { // hapus bila kosong, arsipkan bila punya riwayat
    const w = state.wallets.find(x => x.id === id); if (!w) throw new Error('Dompet tidak ditemukan.');
    if (state.wallets.filter(x => !x.archived).length <= 1 && !w.archived) throw new Error('Minimal harus ada satu dompet aktif.');
    const used = state.transactions.some(t => t.walletId === id || t.toWalletId === id) || state.recurring.some(r => r.walletId === id);
    if (!used) return { state: Object.assign({}, state, { wallets: state.wallets.filter(x => x.id !== id) }), archived: false };
    return { state: Object.assign({}, state, { wallets: state.wallets.map(x => x.id === id ? Object.assign({}, x, { archived: true }) : x), recurring: state.recurring.map(r => r.walletId === id ? Object.assign({}, r, { active: false }) : r) }), archived: true };
  }
  function addCategory(state, name, type) {
    const nm = cleanText(name, 24); if (!nm) throw new Error('Nama kategori wajib diisi.');
    if (!['income', 'expense'].includes(type)) throw new Error('Jenis kategori tidak valid.');
    if (state.categories.some(c => c.type === type && c.name.toLowerCase() === nm.toLowerCase())) throw new Error('Kategori sudah ada.');
    return Object.assign({}, state, { categories: state.categories.concat([{ id: 'cu-' + uid(), name: nm, type, builtin: false }]) });
  }
  function removeCategory(state, id) { // transaksi dipindah ke "Lainnya"
    const c = state.categories.find(x => x.id === id); if (!c) throw new Error('Kategori tidak ditemukan.');
    if (c.builtin) throw new Error('Kategori bawaan tidak bisa dihapus.');
    const fb = state.categories.find(x => x.type === c.type && x.name === 'Lainnya');
    return Object.assign({}, state, {
      categories: state.categories.filter(x => x.id !== id),
      transactions: state.transactions.map(t => t.categoryId === id ? Object.assign({}, t, { categoryId: fb.id }) : t),
      recurring: state.recurring.map(r => r.categoryId === id ? Object.assign({}, r, { categoryId: fb.id }) : r),
      budgets: state.budgets.filter(b => b.categoryId !== id)
    });
  }

  /* ---------- anggaran ---------- */
  function budgetLevel(spent, limit) { if (!limit) return 'none'; if (spent > limit) return 'over'; if (spent * 100 >= limit * 80) return 'warn'; return 'ok'; }
  function budgetStatus(state, ref) {
    const txs = inRange(state.transactions, periodRange('month', ref)).filter(t => t.type === 'expense');
    const spentAll = txs.reduce((s, t) => s + t.amount, 0), by = {};
    txs.forEach(t => { by[t.categoryId] = (by[t.categoryId] || 0) + t.amount; });
    const mk = (b, spent) => ({ id: b.id, categoryId: b.categoryId, limit: b.limit, spent, remaining: b.limit - spent, pct: Math.round(spent / b.limit * 100), level: budgetLevel(spent, b.limit) });
    const tb = state.budgets.find(b => b.categoryId === null);
    return { total: tb ? mk(tb, spentAll) : null, spentAll, categories: state.budgets.filter(b => b.categoryId !== null).map(b => mk(b, by[b.categoryId] || 0)) };
  }
  function setBudget(state, categoryId, limit) {
    const rest = state.budgets.filter(b => b.categoryId !== categoryId);
    if (!limit) return Object.assign({}, state, { budgets: rest });
    if (!isInt(limit) || limit <= 0) throw new Error('Batas anggaran tidak valid.');
    if (categoryId !== null && !state.categories.some(c => c.id === categoryId && c.type === 'expense')) throw new Error('Kategori tidak valid.');
    return Object.assign({}, state, { budgets: rest.concat([{ id: uid(), categoryId, limit }]) });
  }
  /* peringatan yang layak ditampilkan setelah transaksi pengeluaran */
  function budgetAlerts(before, after) {
    const out = [];
    if (before.total && after.total && before.total.level !== after.total.level && ['warn', 'over'].includes(after.total.level)) out.push({ scope: 'total', level: after.total.level });
    after.categories.forEach(c => { const b = before.categories.find(x => x.id === c.id); if (b && b.level !== c.level && ['warn', 'over'].includes(c.level)) out.push({ scope: c.categoryId, level: c.level }); });
    return out;
  }

  /* ---------- tabungan ---------- */
  function goalPct(g) { return Math.min(100, Math.floor(g.saved / g.target * 100)); }
  function goalAdjust(g, delta, ts, note) {
    if (!isInt(delta) || delta === 0) throw new Error('Nominal tidak valid.');
    if (g.saved + delta < 0) throw new Error('Dana yang dikurangi melebihi dana tabungan.');
    return Object.assign({}, g, { saved: g.saved + delta, history: g.history.concat([{ id: uid(), ts, delta, note: cleanText(note, 60) }]) });
  }
  function goalMonthlyNeed(g, now) {
    if (!g.deadline || g.saved >= g.target) return 0;
    const a = new Date(now), b = new Date(g.deadline);
    const months = Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
    return Math.ceil((g.target - g.saved) / months);
  }

  /* ---------- transaksi berulang ---------- */
  function addInterval(ts, freq, anchorDay) {
    const d = new Date(ts), y = d.getFullYear(), m = d.getMonth(), h = d.getHours(), mi = d.getMinutes();
    if (freq === 'daily') { d.setDate(d.getDate() + 1); return d.getTime(); }
    if (freq === 'weekly') { d.setDate(d.getDate() + 7); return d.getTime(); }
    if (freq === 'monthly') return new Date(y, m + 1, Math.min(anchorDay, daysInMonth(y, m + 1)), h, mi).getTime();
    return new Date(y + 1, m, Math.min(anchorDay, daysInMonth(y + 1, m)), h, mi).getTime();
  }
  function applyRecurring(state, now) {
    let created = 0; const txs = state.transactions.slice(), ids = new Set(txs.map(t => t.id));
    const rules = state.recurring.map(r => {
      if (!r.active) return r;
      let next = r.nextTs, guard = 0, active = true;
      while (next <= now && guard++ < 400) {
        if (r.endTs && next > r.endTs) { active = false; break; }
        const id = 'r-' + r.id + '-' + next;
        if (!ids.has(id)) {
          const tx = normalizeTx({ id, type: r.type, amount: r.amount, ts: next, walletId: r.walletId, categoryId: r.categoryId, title: r.title, note: r.note, method: r.method, recurringId: r.id }, state);
          if (tx) { txs.push(tx); ids.add(id); created++; }
        }
        next = addInterval(next, r.freq, r.anchorDay);
      }
      if (r.endTs && next > r.endTs) active = false;
      return Object.assign({}, r, { nextTs: next, active });
    });
    return { state: created || rules.some((r, i) => r.nextTs !== state.recurring[i].nextTs || r.active !== state.recurring[i].active) ? Object.assign({}, state, { transactions: txs, recurring: rules }) : state, created };
  }
  function addRecurring(state, r) {
    const amount = r.amount, title = cleanText(r.title, 60);
    if (!title) throw new Error('Deskripsi wajib diisi.');
    if (!isInt(amount) || amount <= 0) throw new Error('Nominal tidak valid.');
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(r.freq)) throw new Error('Frekuensi tidak valid.');
    if (!state.wallets.some(w => w.id === r.walletId && !w.archived)) throw new Error('Dompet tidak valid.');
    if (!state.categories.some(c => c.id === r.categoryId && c.type === r.type)) throw new Error('Pilih kategori.');
    if (!Number.isFinite(r.startTs)) throw new Error('Tanggal mulai tidak valid.');
    const rule = { id: uid(), title, type: r.type, amount, walletId: r.walletId, categoryId: r.categoryId, method: cleanText(r.method, 24), note: cleanText(r.note, 160), freq: r.freq, anchorDay: new Date(r.startTs).getDate(), nextTs: r.startTs, endTs: r.endTs || null, active: true };
    return Object.assign({}, state, { recurring: state.recurring.concat([rule]) });
  }

  /* ---------- tagihan ---------- */
  function billDueDate(bill, ref) { const d = new Date(ref); return new Date(d.getFullYear(), d.getMonth(), Math.min(bill.dueDay, daysInMonth(d.getFullYear(), d.getMonth()))).getTime(); }
  function billStatus(bill, now) {
    const key = monthKey(now);
    if (bill.paid && bill.paid[key]) return { status: 'paid', days: 0 };
    const due = billDueDate(bill, now), today = periodRange('day', now)[0];
    const days = Math.round((due - today) / 86400000);
    return { status: days < 0 ? 'overdue' : days <= bill.remindDays ? 'soon' : 'upcoming', days };
  }
  function addBill(state, b) {
    const name = cleanText(b.name, 40); if (!name) throw new Error('Nama tagihan wajib diisi.');
    if (!isInt(b.amount) || b.amount <= 0) throw new Error('Nominal tidak valid.');
    return Object.assign({}, state, { bills: state.bills.concat([{ id: uid(), name, amount: b.amount, dueDay: Math.min(31, Math.max(1, Number(b.dueDay) || 1)), remindDays: Math.min(14, Math.max(0, Number(b.remindDays) || 3)), paid: {} }]) });
  }
  function markBillPaid(state, id, now, walletId) {
    const bill = state.bills.find(b => b.id === id); if (!bill) throw new Error('Tagihan tidak ditemukan.');
    const key = monthKey(now); let next = state;
    if (walletId) {
      const cat = state.categories.find(c => c.type === 'expense' && c.name === 'Tagihan');
      next = addTransaction(next, { type: 'expense', amount: bill.amount, ts: now, walletId, categoryId: cat.id, title: bill.name, method: '' }).state;
    }
    return Object.assign({}, next, { bills: next.bills.map(b => b.id === id ? Object.assign({}, b, { paid: Object.assign({}, b.paid, { [key]: now }) }) : b) });
  }

  /* ---------- laporan ---------- */
  function monthlyReport(state, ref) {
    const cur = inRange(state.transactions, periodRange('month', ref)), prev = inRange(state.transactions, periodRange('month', shiftPeriod('month', ref, -1)));
    const a = sumByType(cur), b = sumByType(prev), d = new Date(ref);
    const today = new Date(), sameMonth = today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth();
    const elapsed = sameMonth ? today.getDate() : daysInMonth(d.getFullYear(), d.getMonth());
    return {
      income: a.income, expense: a.expense, net: a.income - a.expense, prevIncome: b.income, prevExpense: b.expense,
      expenseChangePct: b.expense ? Math.round((a.expense - b.expense) / b.expense * 100) : null,
      byExpense: groupByCategory(state, cur, 'expense'), byIncome: groupByCategory(state, cur, 'income'),
      count: cur.length, dailyAvgExpense: Math.round(a.expense / Math.max(1, elapsed))
    };
  }
  function yearlyReport(state, year) {
    const months = [];
    for (let m = 0; m < 12; m++) { const t = sumByType(inRange(state.transactions, [new Date(year, m, 1).getTime(), new Date(year, m + 1, 1).getTime()])); months.push({ month: m, income: t.income, expense: t.expense }); }
    const income = months.reduce((s, x) => s + x.income, 0), expense = months.reduce((s, x) => s + x.expense, 0);
    const yr = inRange(state.transactions, [new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime()]);
    return { months, income, expense, net: income - expense, byExpense: groupByCategory(state, yr, 'expense') };
  }
  /* deret batang untuk halaman pengeluaran/pemasukan: minggu = 7 hari, bulan = tiap tanggal, tahun = 12 bulan */
  function bucketSeries(state, kind, ref) {
    const out = [], txs = state.transactions;
    const mk = (label, s, e) => { const t = sumByType(inRange(txs, [s, e])); out.push({ label, ts: s, income: t.income, expense: t.expense }); };
    const d = new Date(ref);
    if (kind === 'week') { const s = periodRange('week', ref)[0]; for (let i = 0; i < 7; i++) { const a = new Date(s); a.setDate(a.getDate() + i); const b = new Date(a); b.setDate(b.getDate() + 1); mk(DAYS_SHORT[a.getDay()], a.getTime(), b.getTime()); } }
    else if (kind === 'month') { const n = daysInMonth(d.getFullYear(), d.getMonth()); for (let i = 1; i <= n; i++) mk(String(i), new Date(d.getFullYear(), d.getMonth(), i).getTime(), new Date(d.getFullYear(), d.getMonth(), i + 1).getTime()); }
    else if (kind === 'year') { for (let m = 0; m < 12; m++) mk(MONTHS_SHORT[m], new Date(d.getFullYear(), m, 1).getTime(), new Date(d.getFullYear(), m + 1, 1).getTime()); }
    return out;
  }
  function periodCompare(state, kind, ref) {
    const cur = sumByType(inRange(state.transactions, periodRange(kind, ref))), prev = sumByType(inRange(state.transactions, periodRange(kind, shiftPeriod(kind, ref, -1))));
    return { cur, prev, expenseDelta: cur.expense - prev.expense, expensePct: prev.expense ? Math.round((cur.expense - prev.expense) / prev.expense * 100) : null, incomeDelta: cur.income - prev.income };
  }

  /* ---------- CSV ---------- */
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection di spreadsheet
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(state, txs) {
    const cur = state.settings.currency, wn = id => (state.wallets.find(w => w.id === id) || {}).name || '';
    const rows = [['Tanggal', 'Waktu', 'Jenis', 'Kategori', 'Deskripsi', 'Nominal', 'Mata uang', 'Dompet', 'Dompet tujuan', 'Metode', 'Catatan']];
    txs.slice().sort((a, b) => a.ts - b.ts).forEach(t => rows.push([dateInputValue(t.ts), formatTime(t.ts), t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer', t.type === 'transfer' ? '' : categoryName(state, t.categoryId), t.title, plainAmount(t.amount, cur), cur, wn(t.walletId), wn(t.toWalletId), t.method, t.note]));
    return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  /* ---------- backup (isi sebelum dienkripsi) ---------- */
  function backupPayload(state) { return JSON.stringify({ app: 'C01N', format: 'c01n-data', version: 3, exportedAt: new Date().toISOString(), state }); }
  function parseBackup(text, now) { // menerima backup v3 dan backup lama 0.4 (JSON polos)
    let data; try { data = JSON.parse(text); } catch (_) { throw new Error('File backup rusak atau bukan JSON.'); }
    if (data && data.state && data.format === 'c01n-data') return normalizeState(data.state, now);
    if (data && Array.isArray(data.transactions)) return fromLegacy(data.transactions, data.settings, now);
    throw new Error('Format backup tidak dikenali.');
  }
  function mergeStates(base, incoming) { // gabung: ID yang sudah ada dilewati
    const s = clone(base);
    incoming.wallets.forEach(w => { if (!s.wallets.some(x => x.id === w.id)) s.wallets.push(w); });
    incoming.categories.forEach(c => { if (!s.categories.some(x => x.id === c.id)) s.categories.push(c); });
    const ids = new Set(s.transactions.map(t => t.id)); let added = 0;
    incoming.transactions.forEach(t => { if (!ids.has(t.id)) { s.transactions.push(t); added++; } });
    ['budgets', 'goals', 'recurring', 'bills'].forEach(k => incoming[k].forEach(x => { if (!s[k].some(y => y.id === x.id) && !(k === 'budgets' && s.budgets.some(y => y.categoryId === x.categoryId))) s[k].push(x); }));
    return { state: normalizeState(s), added };
  }

  return {
    CURRENCIES, MONTHS_SHORT, MONTHS_LONG, DAYS_SHORT, METHODS, WALLET_TYPES, DATE_FORMATS, MAX_AMOUNT,
    uid, cleanText, formatMoney, parseAmount, amountToInput, plainAmount, formatDate, formatTime, dateInputValue, timeInputValue, parseDateTime, monthKey, daysInMonth,
    periodRange, shiftPeriod, periodLabel, freshState, normalizeState, fromLegacy, defaultCategories,
    walletBalance, totalBalance, sumByType, inRange, categoryName, groupByCategory, queryTransactions, dailyBars, dayTotals,
    addTransaction, updateTransaction, deleteTransaction, addWallet, renameWallet, removeWallet, addCategory, removeCategory,
    budgetLevel, budgetStatus, setBudget, budgetAlerts, goalPct, goalAdjust, goalMonthlyNeed,
    addInterval, applyRecurring, addRecurring, billStatus, billDueDate, addBill, markBillPaid,
    monthlyReport, yearlyReport, periodCompare, bucketSeries, toCSV, csvCell, backupPayload, parseBackup, mergeStates
  };
});
