/* Halaman, navigasi, dan aksi pengguna C01N. */
(function () {
  'use strict';
  const C = window.C01NCore, U = window.UI;
  const { $, $$, esc, icon, money, moneyH, fdate, toast, openSheet, confirmBox, dialog, guarded, barsHtml, donutHtml, txGroups, txRow, emptyState } = U;
  const S = () => window.Store.state, Store = window.Store, Native = window.Native, Security = window.Security;
  const now = () => Date.now();

  const ui = {
    tab: 'home', exp: { kind: 'month', ref: now() }, inc: { kind: 'month', ref: now() },
    hist: { q: '', type: 'all', sort: 'date-desc', walletId: '', categoryId: '', from: '', to: '' },
    cal: { y: new Date().getFullYear(), m: new Date().getMonth(), sel: new Date().getDate() }, rep: { mode: 'month', ref: now() }
  };
  const TABS = [['home', 'Beranda', 'home'], ['expense', 'Pengeluaran', 'expense'], ['budget', 'Anggaran', 'pie'], ['goals', 'Tabungan', 'target'], ['profile', 'Profil', 'user']];
  const KINDS = [['day', 'Harian'], ['week', 'Mingguan'], ['month', 'Bulanan'], ['year', 'Tahunan']];
  const opts = (list, sel) => list.map(([v, l]) => '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
  const walletOpts = (sel, withArchived) => opts(S().wallets.filter(w => withArchived || !w.archived || w.id === sel).map(w => [w.id, w.name + (w.archived ? ' (arsip)' : '')]), sel);
  const catOpts = (type, sel) => opts(S().categories.filter(c => c.type === type).map(c => [c.id, c.name]), sel);
  const sumTx = (txs) => txs.reduce((a, t) => a + t.amount, 0);
  const amt = (v) => C.amountToInput(v, S().settings.currency);
  const parseMoney = v => C.parseAmount(v, S().settings.currency);
  const curSym = () => C.CURRENCIES[S().settings.currency].symbol;
  function commit(fn) { Store.commit(fn(S())); }

  /* ================= navigasi ================= */
  const Nav = {
    stack: [],
    setTab(t) {
      ui.tab = t; $$('.page').forEach(p => { p.hidden = p.dataset.tab !== t; });
      $('#nav').innerHTML = TABS.map(([k, l, ic]) => '<button class="nav-item' + (k === t ? ' on' : '') + '" data-act="tab" data-tab="' + k + '" aria-label="' + l + '"' + (k === t ? ' aria-current="page"' : '') + '>' + icon(ic) + '<span>' + l + '</span></button>').join('');
      renderTab(t); window.scrollTo(0, 0);
    },
    push(name, params) {
      const el = document.createElement('div'); el.className = 'sub'; el.dataset.sub = name; $('#stack').append(el);
      const e = { name, params: params || {}, el }; Nav.stack.push(e); renderSub(e); el.scrollTop = 0; document.body.style.overflow = 'hidden';
    },
    pop() {
      const e = Nav.stack.pop(); if (!e) return false;
      e.el.classList.add('closing'); setTimeout(() => e.el.remove(), 200);
      if (!Nav.stack.length) document.body.style.overflow = '';
      return true;
    },
    clear() { Nav.stack.forEach(e => e.el.remove()); Nav.stack = []; document.body.style.overflow = ''; },
    back() {
      if (Security.cancelPrompt()) return true;
      if (Security.hasPrompt()) return false;
      if (U.closeTopLayer()) return true;
      if ($('#overlay .fullscreen')) return true;
      if (Nav.pop()) return true;
      if (ui.tab !== 'home') { Nav.setTab('home'); return true; }
      return false;
    }
  };

  /* ================= tampilan tab ================= */
  function alertsHtml() {
    const st = S(), out = [], bs = C.budgetStatus(st, now());
    if (bs.total && ['warn', 'over'].includes(bs.total.level)) out.push(banner(bs.total.level, 'Anggaran bulanan ' + (bs.total.level === 'over' ? 'terlampaui ' + money(-bs.total.remaining) : 'hampir habis (' + bs.total.pct + '%)'), 'budget'));
    bs.categories.filter(c => ['warn', 'over'].includes(c.level)).forEach(c => out.push(banner(c.level, 'Anggaran ' + C.categoryName(st, c.categoryId) + (c.level === 'over' ? ' terlampaui' : ' hampir habis (' + c.pct + '%)'), 'budget')));
    st.bills.forEach(b => { const s = C.billStatus(b, now()); if (s.status === 'overdue' || s.status === 'soon') out.push(banner(s.status === 'overdue' ? 'over' : 'warn', 'Tagihan ' + b.name + (s.status === 'overdue' ? ' terlambat ' + Math.abs(s.days) + ' hari' : s.days === 0 ? ' jatuh tempo hari ini' : ' jatuh tempo ' + s.days + ' hari lagi') + ' · ' + money(b.amount), 'bills')); });
    return out.join('');
  }
  const banner = (lvl, text, go) => '<button class="banner ' + (lvl === 'over' ? 'over' : '') + ' pressable" style="width:100%;text-align:left" data-act="' + (go === 'budget' ? 'tab" data-tab="budget' : 'sub" data-sub="bills') + '">' + icon('warn', 'sm') + '<span>' + esc(text) + '</span></button>';

  function homeView() {
    const st = S(), mTx = C.inRange(st.transactions, C.periodRange('month', now())), m = C.sumByType(mTx), bs = C.budgetStatus(st, now());
    const recent = C.queryTransactions(st, { sort: 'date-desc' }).slice(0, 8);
    const name = st.settings.name ? ', ' + esc(st.settings.name.split(' ')[0]) : '';
    const hour = new Date().getHours(), greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
    const bud = bs.total
      ? '<div class="card-head"><h2>Anggaran bulan ini</h2><button class="link-btn" data-act="tab" data-tab="budget">Detail</button></div><div class="row" style="justify-content:space-between;flex:none"><b class="num">' + money(bs.total.spent) + '</b><span class="muted num">dari ' + money(bs.total.limit) + '</span></div><div class="progress ' + (bs.total.level === 'over' ? 'over' : '') + '"><i style="--w:' + Math.min(100, bs.total.pct) + '%"></i></div><div class="muted" style="font-size:13px">' + (bs.total.level === 'over' ? 'Terlampaui ' + money(-bs.total.remaining) : 'Sisa ' + money(bs.total.remaining) + ' (' + bs.total.pct + '% terpakai)') + '</div>'
      : '<div class="card-head"><h2>Anggaran bulan ini</h2></div><div class="muted" style="font-size:13px;margin-bottom:10px">Atur batas pengeluaran agar keuangan lebih terkendali.</div><button class="btn block" data-act="budget-total">Atur anggaran</button>';
    return '<div class="page-head"><div><div class="eyebrow">' + greet + name + '</div><h1>C01N</h1></div><button class="icon-btn pressable" data-act="hide-toggle" aria-label="' + (st.settings.hideBalance ? 'Tampilkan saldo' : 'Sembunyikan saldo') + '">' + icon(st.settings.hideBalance ? 'eye-off' : 'eye') + '</button></div>' +
      alertsHtml() +
      '<section class="balance"><div class="eyebrow">Total saldo</div><div class="amount num">' + esc(moneyH(C.totalBalance(st))) + '</div><div class="stat-row"><div class="stat"><span class="lbl ok">' + icon('arrow-in', 'sm') + 'Pemasukan</span><b class="num">' + esc(moneyH(m.income)) + '</b></div><div class="stat"><span class="lbl bad">' + icon('arrow-out', 'sm') + 'Pengeluaran</span><b class="num">' + esc(moneyH(m.expense)) + '</b></div></div></section>' +
      '<div class="row" style="margin-bottom:12px"><button class="btn primary pressable" data-act="add-tx" data-type="income">' + icon('plus', 'sm') + 'Pemasukan</button><button class="btn primary pressable" data-act="add-tx" data-type="expense">' + icon('plus', 'sm') + 'Pengeluaran</button></div>' +
      '<div class="quick"><button class="pressable" data-act="sub" data-sub="income">' + icon('arrow-in') + 'Pemasukan</button><button class="pressable" data-act="transfer">' + icon('swap') + 'Transfer</button><button class="pressable" data-act="sub" data-sub="calendar">' + icon('calendar') + 'Kalender</button><button class="pressable" data-act="sub" data-sub="bills">' + icon('bell') + 'Tagihan</button></div>' +
      '<section class="card"><div class="card-head"><h2>Arus kas 7 hari</h2></div>' + barsHtml(C.dailyBars(st, now(), 7).map(d => ({ label: C.DAYS_SHORT[new Date(d.ts).getDay()], income: d.income, expense: d.expense })), 'both') + '<div class="legend"><span><i style="background:var(--accent)"></i>Masuk</span><span><i style="background:var(--muted)"></i>Keluar</span></div></section>' +
      '<section class="card">' + bud + '</section>' +
      '<section class="card"><div class="card-head"><h2>Riwayat terbaru</h2><button class="link-btn" data-act="sub" data-sub="history">Lihat semua</button></div>' +
      (recent.length ? txGroups(recent) : emptyState('file', 'Belum ada transaksi', 'Catat pemasukan atau pengeluaran pertama Anda.', '<br><button class="btn primary" data-act="add-tx" data-type="expense">Tambah transaksi</button>')) + '</section>';
  }

  function flowView(type, key, standalone) {
    const st = S(), p = ui[key], range = C.periodRange(p.kind, p.ref), txs = C.inRange(st.transactions, range).filter(t => t.type === type);
    const total = sumTx(txs), cmp = C.periodCompare(st, p.kind, p.ref), prev = cmp.prev[type], cur = cmp.cur[type];
    const delta = prev ? Math.round((cur - prev) / prev * 100) : null, good = type === 'income' ? delta > 0 : delta < 0;
    const days = Math.max(1, Math.ceil((Math.min(now(), range[1]) - range[0]) / 86400000)), cats = C.groupByCategory(st, txs, type), biggest = txs.slice().sort((a, b) => b.amount - a.amount)[0];
    const series = p.kind === 'day' ? [] : C.bucketSeries(st, p.kind, p.ref), label = type === 'expense' ? 'Pengeluaran' : 'Pemasukan';
    const sorted = txs.slice().sort((a, b) => b.ts - a.ts);
    return (standalone ? '' : '<div class="page-head"><h1>' + label + '</h1><button class="link-btn" data-act="sub" data-sub="income">Lihat pemasukan</button></div>') +
      '<div class="seg">' + KINDS.map(([k, l]) => '<button class="' + (p.kind === k ? 'on' : '') + '" data-act="kind" data-key="' + key + '" data-kind="' + k + '">' + l + '</button>').join('') + '</div>' +
      '<div class="period-nav"><button class="icon-btn pressable" data-act="shift" data-key="' + key + '" data-n="-1" aria-label="Periode sebelumnya">' + icon('left') + '</button><button data-act="today" data-key="' + key + '"><b>' + esc(C.periodLabel(p.kind, p.ref, st.settings.dateFormat)) + '</b></button><button class="icon-btn pressable" data-act="shift" data-key="' + key + '" data-n="1" aria-label="Periode berikutnya">' + icon('right') + '</button></div>' +
      '<section class="card"><div class="eyebrow">Total ' + label.toLowerCase() + '</div><div class="amount num" style="font-size:28px;font-weight:700;margin:4px 0">' + esc(money(total)) + '</div>' +
      '<div style="font-size:13px" class="' + (delta === null ? 'muted' : good ? 'ok' : 'bad') + '">' + (delta === null ? 'Belum ada data periode sebelumnya' : (delta > 0 ? '▲ Naik ' : delta < 0 ? '▼ Turun ' : '＝ Sama ') + (delta !== 0 ? Math.abs(delta) + '% ' : '') + 'dibanding periode sebelumnya (' + esc(money(prev)) + ')') + '</div>' +
      (series.length ? barsHtml(series, type) : '') + '</section>' +
      (txs.length ? '<section class="card"><div class="card-head"><h2>' + (type === 'expense' ? 'Per kategori' : 'Sumber pemasukan') + '</h2></div>' + donutHtml(cats) + '</section>' +
        '<section class="card"><div class="card-head"><h2>Statistik</h2></div><div class="stat-row"><div class="stat"><span class="lbl">Transaksi</span><b>' + txs.length + '</b></div><div class="stat"><span class="lbl">Rata-rata/hari</span><b class="num">' + esc(money(Math.round(total / days))) + '</b></div></div>' + (biggest ? '<div class="muted" style="font-size:13px;margin-top:10px">Terbesar: ' + esc(biggest.title) + ' · ' + esc(money(biggest.amount)) + '</div>' : '') + '</section>' : '') +
      '<section class="card"><div class="card-head"><h2>Detail transaksi</h2>' + (standalone ? '<button class="link-btn" data-act="add-tx" data-type="' + type + '">+ Tambah</button>' : '') + '</div>' +
      (sorted.length ? txGroups(sorted.slice(0, 100)) + (sorted.length > 100 ? '<div class="muted" style="font-size:12px;padding-top:8px">Menampilkan 100 transaksi terbaru. Gunakan Riwayat untuk semuanya.</div>' : '') : emptyState(type === 'expense' ? 'expense' : 'arrow-in', 'Tidak ada ' + label.toLowerCase(), 'Belum ada catatan pada periode ini.', '<br><button class="btn primary" data-act="add-tx" data-type="' + type + '">Tambah ' + label.toLowerCase() + '</button>')) + '</section>' +
      (standalone ? '' : '<button class="fab" data-act="add-tx" data-type="expense" aria-label="Tambah pengeluaran">' + icon('plus') + '</button>');
  }

  function budgetView() {
    const st = S(), bs = C.budgetStatus(st, now()), m = C.MONTHS_LONG[new Date().getMonth()] + ' ' + new Date().getFullYear();
    const card = (b, name, onclick) => '<button class="card pressable" style="width:100%;text-align:left" data-act="' + onclick + '"><div class="goal-top"><b>' + esc(name) + '</b><span class="pill ' + (b.level === 'over' ? 'bad' : b.level === 'warn' ? 'warn' : '') + '">' + b.pct + '%</span></div><div class="progress ' + (b.level === 'over' ? 'over' : '') + '"><i style="--w:' + Math.min(100, b.pct) + '%"></i></div><div class="goal-top muted" style="font-size:13px"><span class="num">' + esc(money(b.spent)) + ' / ' + esc(money(b.limit)) + '</span><span class="' + (b.level === 'over' ? 'bad' : '') + '">' + (b.level === 'over' ? 'Lebih ' + esc(money(-b.remaining)) : b.level === 'warn' ? 'Hampir habis · sisa ' + esc(money(b.remaining)) : 'Sisa ' + esc(money(b.remaining))) + '</span></div></button>';
    return '<div class="page-head"><div><div class="eyebrow">' + m + '</div><h1>Anggaran</h1></div></div>' +
      (bs.total ? card(bs.total, 'Total bulanan', 'budget-total') : '<div class="card"><div class="card-head"><h2>Anggaran total</h2></div><p class="muted" style="margin-bottom:12px">Tetapkan batas pengeluaran per bulan. Anggaran berlaku setiap bulan sampai Anda mengubahnya.</p><button class="btn primary block" data-act="budget-total">Atur anggaran total</button></div>') +
      '<div class="group-title">Per kategori</div>' +
      (bs.categories.length ? bs.categories.map(b => card(b, C.categoryName(st, b.categoryId), 'budget-cat" data-id="' + esc(b.categoryId))).join('') : '<div class="card flat">' + emptyState('pie', 'Belum ada anggaran kategori', 'Batasi pengeluaran tertentu, misalnya Makanan atau Hiburan.') + '</div>') +
      '<button class="btn block" data-act="budget-cat">' + icon('plus', 'sm') + 'Tambah anggaran kategori</button>';
  }

  function goalCard(g) {
    const pct = C.goalPct(g), need = C.goalMonthlyNeed(g, now()), done = g.saved >= g.target;
    return '<button class="card pressable" style="width:100%;text-align:left" data-act="goal-open" data-id="' + esc(g.id) + '"><div class="goal-top"><b>' + esc(g.name) + '</b>' + (done ? '<span class="pill ok">Tercapai</span>' : '<span class="pill">' + pct + '%</span>') + '</div><div class="progress"><i style="--w:' + pct + '%"></i></div><div class="goal-top muted" style="font-size:13px"><span class="num">' + esc(money(g.saved)) + ' / ' + esc(money(g.target)) + '</span><span>' + (g.deadline ? esc(fdate(g.deadline)) : 'Tanpa tenggat') + '</span></div>' + (need && !done ? '<div class="muted" style="font-size:12px;margin-top:6px">Perlu menabung ± ' + esc(money(need)) + ' per bulan</div>' : '') + '</button>';
  }
  function goalsView() {
    const gs = S().goals, total = gs.reduce((a, g) => a + g.saved, 0);
    return '<div class="page-head"><h1>Tabungan</h1><button class="btn primary pressable" data-act="goal-add">' + icon('plus', 'sm') + 'Target</button></div>' +
      (gs.length ? '<div class="card"><div class="eyebrow">Total dana tabungan</div><div class="amount num" style="font-size:26px;font-weight:700;margin-top:4px">' + esc(moneyH(total)) + '</div><div class="muted" style="font-size:12px;margin-top:4px">Dana target dicatat terpisah dan tidak mengurangi saldo dompet.</div></div>' + gs.map(goalCard).join('') : '<div class="card flat">' + emptyState('target', 'Belum ada target tabungan', 'Buat target, tentukan nominal dan tenggat, lalu catat kemajuannya.', '<br><button class="btn primary" data-act="goal-add">Buat target</button>') + '</div>');
  }

  function menuItem(ic, title, sub, act, extra) { return '<button class="menu-item" data-act="' + act + '"' + (extra || '') + '>' + icon(ic) + '<span class="mi">' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + icon('right', 'sm') + '</button>'; }
  function profileView() {
    const st = S(), s = st.settings, days = Math.max(1, Math.floor((now() - st.createdAt) / 86400000));
    return '<div class="page-head"><h1>Profil</h1></div><section class="card"><div class="row" style="align-items:center;gap:16px"><div class="avatar" style="flex:none">' + (s.photo ? '<img alt="" src="' + s.photo + '">' : esc((s.name || 'C').trim().charAt(0).toUpperCase())) + '</div><div style="flex:1;min-width:0"><b style="font-size:18px">' + esc(s.name || 'Pengguna C01N') + '</b><div class="muted" style="font-size:13px">Akun lokal sejak ' + esc(fdate(st.createdAt)) + '</div><div class="muted" style="font-size:13px">' + st.transactions.length + ' transaksi · ' + days + ' hari</div></div></div><button class="btn block" style="margin-top:14px" data-act="profile-edit">' + icon('edit', 'sm') + 'Ubah profil</button></section>' +
      '<div class="group-title">Keuangan</div><div class="menu">' + menuItem('wallet', 'Dompet', st.wallets.filter(w => !w.archived).length + ' dompet aktif', 'sub" data-sub="wallets') + menuItem('tag', 'Kategori', 'Kelola kategori sendiri', 'sub" data-sub="categories') + menuItem('repeat', 'Transaksi berulang', st.recurring.filter(r => r.active).length + ' aktif', 'sub" data-sub="recurring') + menuItem('bell', 'Pengingat tagihan', st.bills.length + ' tagihan', 'sub" data-sub="bills') + menuItem('calendar', 'Kalender keuangan', '', 'sub" data-sub="calendar') + menuItem('chart', 'Laporan', 'Bulanan dan tahunan, ekspor CSV/PDF', 'sub" data-sub="reports') + menuItem('arrow-in', 'Halaman pemasukan', '', 'sub" data-sub="income') + '</div>' +
      '<div class="group-title">Aplikasi</div><div class="menu">' + menuItem('settings', 'Pengaturan', 'Keamanan, tampilan, backup', 'sub" data-sub="settings') + menuItem('download', 'Ekspor data (CSV)', 'Semua transaksi', 'export-csv') + '<button class="menu-item danger" data-act="wipe">' + icon('trash') + '<span class="mi">Hapus semua data<small>Menghapus transaksi, pengaturan, dan PIN</small></span></button></div>';
  }

  const VIEWS = { home: homeView, expense: () => flowView('expense', 'exp', false), budget: budgetView, goals: goalsView, profile: profileView };
  function renderTab(t) { const el = $('#page-' + t); if (el && S()) el.innerHTML = VIEWS[t](); }

  /* ================= subhalaman ================= */
  const SUBS = {
    income: () => ({ title: 'Pemasukan', html: flowView('income', 'inc', true) }),
    history: () => {
      const h = ui.hist, st = S();
      return { title: 'Riwayat transaksi', html: '<div class="search">' + icon('search', 'sm') + '<input id="histQ" data-input="hist-q" type="search" placeholder="Cari deskripsi, kategori, catatan" aria-label="Cari transaksi" value="' + esc(h.q) + '"></div>' +
        '<div class="chips">' + [['all', 'Semua'], ['income', 'Pemasukan'], ['expense', 'Pengeluaran'], ['transfer', 'Transfer']].map(([k, l]) => '<button class="chip ' + (h.type === k ? 'on' : '') + '" data-act="hist-type" data-v="' + k + '">' + l + '</button>').join('') + '</div>' +
        '<div class="row" style="margin-bottom:8px"><select class="in" data-change="hist-wallet" aria-label="Dompet"><option value="">Semua dompet</option>' + walletOpts(h.walletId, true) + '</select><select class="in" data-change="hist-cat" aria-label="Kategori"><option value="">Semua kategori</option>' + opts(st.categories.map(c => [c.id, c.name + (c.type === 'income' ? ' (masuk)' : '')]), h.categoryId) + '</select></div>' +
        '<div class="row" style="margin-bottom:8px"><input class="in" type="date" data-change="hist-from" value="' + esc(h.from) + '" aria-label="Dari tanggal"><input class="in" type="date" data-change="hist-to" value="' + esc(h.to) + '" aria-label="Sampai tanggal"></div>' +
        '<select class="in" data-change="hist-sort" aria-label="Urutkan" style="margin-bottom:12px">' + opts([['date-desc', 'Terbaru dulu'], ['date-asc', 'Terlama dulu'], ['amount-desc', 'Nominal terbesar'], ['amount-asc', 'Nominal terkecil']], h.sort) + '</select>' +
        '<div class="card" id="histList">' + histList() + '</div>', actions: '<button class="icon-btn" data-act="hist-reset" aria-label="Reset filter">' + icon('repeat', 'sm') + '</button>' };
    },
    calendar: () => {
      const st = S(), c = ui.cal, first = new Date(c.y, c.m, 1).getDay(), dim = C.daysInMonth(c.y, c.m), totals = C.dayTotals(st, c.y, c.m), today = new Date();
      let cells = C.DAYS_SHORT.map(d => '<div class="dow">' + d + '</div>').join('') + '<div class="blank"></div>'.repeat(first);
      for (let d = 1; d <= dim; d++) { const t = totals[d], isT = today.getFullYear() === c.y && today.getMonth() === c.m && today.getDate() === d; cells += '<button class="pressable ' + (isT ? 'today ' : '') + (c.sel === d ? 'sel' : '') + '" data-act="cal-day" data-d="' + d + '" aria-label="Tanggal ' + d + '">' + d + '<span class="dots">' + (t && t.income ? '<i></i>' : '') + (t && t.expense ? '<i class="x"></i>' : '') + '</span></button>'; }
      const dayTx = C.queryTransactions(st, { from: new Date(c.y, c.m, c.sel).getTime(), to: new Date(c.y, c.m, c.sel + 1).getTime() }), mt = C.sumByType(C.inRange(st.transactions, [new Date(c.y, c.m, 1).getTime(), new Date(c.y, c.m + 1, 1).getTime()]));
      return { title: 'Kalender keuangan', html: '<div class="period-nav"><button class="icon-btn" data-act="cal-shift" data-n="-1" aria-label="Bulan sebelumnya">' + icon('left') + '</button><b>' + C.MONTHS_LONG[c.m] + ' ' + c.y + '</b><button class="icon-btn" data-act="cal-shift" data-n="1" aria-label="Bulan berikutnya">' + icon('right') + '</button></div><div class="card"><div class="cal">' + cells + '</div><div class="legend"><span><i style="background:var(--ok)"></i>Pemasukan</span><span><i style="background:var(--bad)"></i>Pengeluaran</span></div></div>' +
        '<div class="stat-row" style="margin-bottom:14px"><div class="stat"><span class="lbl ok">Masuk bulan ini</span><b class="num">' + esc(money(mt.income)) + '</b></div><div class="stat"><span class="lbl bad">Keluar bulan ini</span><b class="num">' + esc(money(mt.expense)) + '</b></div></div>' +
        '<div class="card"><div class="card-head"><h2>' + c.sel + ' ' + C.MONTHS_LONG[c.m] + '</h2><button class="link-btn" data-act="add-tx" data-type="expense" data-date="' + C.dateInputValue(new Date(c.y, c.m, c.sel, 12).getTime()) + '">+ Tambah</button></div>' + (dayTx.length ? dayTx.map(txRow).join('') : emptyState('calendar', 'Tidak ada transaksi', 'Belum ada catatan pada tanggal ini.')) + '</div>' };
    },
    wallets: () => {
      const st = S(), act = st.wallets.filter(w => !w.archived), arch = st.wallets.filter(w => w.archived);
      const row = w => '<button class="menu-item" data-act="wallet-edit" data-id="' + esc(w.id) + '">' + icon('wallet') + '<span class="mi">' + esc(w.name) + '<small>' + C.WALLET_TYPES[w.type] + '</small></span><b class="num">' + esc(moneyH(C.walletBalance(st, w.id))) + '</b></button>';
      return { title: 'Dompet', html: '<div class="card"><div class="eyebrow">Total saldo</div><div class="amount num" style="font-size:26px;font-weight:700;margin-top:4px">' + esc(moneyH(C.totalBalance(st))) + '</div></div><div class="menu">' + act.map(row).join('') + '</div><div class="row"><button class="btn primary" data-act="wallet-add">' + icon('plus', 'sm') + 'Dompet</button><button class="btn" data-act="transfer">' + icon('swap', 'sm') + 'Transfer</button></div>' + (arch.length ? '<div class="group-title">Diarsipkan</div><div class="menu">' + arch.map(row).join('') + '</div>' : '') };
    },
    categories: () => {
      const st = S(), list = (type) => st.categories.filter(c => c.type === type).map(c => '<div class="menu-item" style="cursor:default">' + icon('tag') + '<span class="mi">' + esc(c.name) + '<small>' + (c.builtin ? 'Bawaan' : 'Buatan sendiri') + '</small></span>' + (c.builtin ? '' : '<button class="icon-btn" data-act="cat-del" data-id="' + esc(c.id) + '" aria-label="Hapus ' + esc(c.name) + '">' + icon('trash', 'sm') + '</button>') + '</div>').join('');
      return { title: 'Kategori', html: '<div class="group-title" style="margin-top:0">Pengeluaran</div><div class="menu">' + list('expense') + '</div><div class="group-title">Pemasukan</div><div class="menu">' + list('income') + '</div><button class="btn primary block" data-act="cat-add">' + icon('plus', 'sm') + 'Kategori baru</button>' };
    },
    recurring: () => {
      const st = S(), fl = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' };
      return { title: 'Transaksi berulang', html: '<p class="muted" style="margin-bottom:12px">Transaksi dicatat otomatis saat aplikasi dibuka setelah jatuh tempo, termasuk yang terlewat.</p>' + (st.recurring.length ? '<div class="menu">' + st.recurring.map(r => '<div class="menu-item" style="cursor:default">' + icon('repeat') + '<span class="mi">' + esc(r.title) + '<small>' + fl[r.freq] + ' · ' + esc(money(r.amount)) + ' · ' + (r.active ? 'berikutnya ' + esc(fdate(r.nextTs)) : 'nonaktif') + '</small></span><button class="switch ' + (r.active ? 'on' : '') + '" data-act="rec-toggle" data-id="' + esc(r.id) + '" role="switch" aria-checked="' + r.active + '" aria-label="Aktifkan ' + esc(r.title) + '"></button><button class="icon-btn" data-act="rec-del" data-id="' + esc(r.id) + '" aria-label="Hapus">' + icon('trash', 'sm') + '</button></div>').join('') + '</div>' : '<div class="card flat">' + emptyState('repeat', 'Belum ada transaksi berulang', 'Cocok untuk gaji, cicilan, langganan, atau sewa.') + '</div>') + '<button class="btn primary block" data-act="rec-add">' + icon('plus', 'sm') + 'Tambah transaksi berulang</button>' };
    },
    bills: () => {
      const st = S(), label = { paid: ['Lunas', 'ok'], overdue: ['Terlambat', 'bad'], soon: ['Segera', 'warn'], upcoming: ['Mendatang', ''] };
      return { title: 'Pengingat tagihan', html: '<p class="muted" style="margin-bottom:12px">Pengingat tampil di Beranda saat tagihan mendekati jatuh tempo. C01N tidak mengirim notifikasi di luar aplikasi.</p>' + (st.bills.length ? '<div class="menu">' + st.bills.slice().sort((a, b) => a.dueDay - b.dueDay).map(b => { const s = C.billStatus(b, now()), l = label[s.status]; return '<div class="menu-item" style="cursor:default">' + icon('bell') + '<span class="mi">' + esc(b.name) + '<small>Tgl ' + b.dueDay + ' tiap bulan · ' + esc(money(b.amount)) + '</small></span><span class="pill ' + l[1] + '">' + l[0] + '</span>' + (s.status !== 'paid' ? '<button class="btn" style="min-height:36px;padding:0 12px" data-act="bill-pay" data-id="' + esc(b.id) + '">Bayar</button>' : '') + '<button class="icon-btn" data-act="bill-del" data-id="' + esc(b.id) + '" aria-label="Hapus">' + icon('trash', 'sm') + '</button></div>'; }).join('') + '</div>' : '<div class="card flat">' + emptyState('bell', 'Belum ada tagihan', 'Tambahkan listrik, internet, cicilan, dan lainnya.') + '</div>') + '<button class="btn primary block" data-act="bill-add">' + icon('plus', 'sm') + 'Tambah tagihan</button>' };
    },
    reports: () => {
      const st = S(), r = ui.rep, monthly = r.mode === 'month';
      const rep = monthly ? C.monthlyReport(st, r.ref) : C.yearlyReport(st, new Date(r.ref).getFullYear());
      const label = monthly ? C.MONTHS_LONG[new Date(r.ref).getMonth()] + ' ' + new Date(r.ref).getFullYear() : String(new Date(r.ref).getFullYear());
      const cmp = monthly ? (rep.expenseChangePct === null ? 'Belum ada data bulan sebelumnya.' : 'Pengeluaran ' + (rep.expenseChangePct >= 0 ? 'naik ' : 'turun ') + Math.abs(rep.expenseChangePct) + '% dibanding bulan lalu (' + money(rep.prevExpense) + ').') : '';
      const series = monthly ? C.bucketSeries(st, 'month', r.ref) : rep.months.map(m => ({ label: C.MONTHS_SHORT[m.month], income: m.income, expense: m.expense }));
      return { title: 'Laporan', printable: true, actions: '<button class="icon-btn no-print" data-act="export-pdf" aria-label="Simpan PDF">' + icon('printer', 'sm') + '</button><button class="icon-btn no-print" data-act="export-csv-period" aria-label="Ekspor CSV">' + icon('download', 'sm') + '</button>',
        html: '<div class="seg no-print"><button class="' + (monthly ? 'on' : '') + '" data-act="rep-mode" data-m="month">Bulanan</button><button class="' + (!monthly ? 'on' : '') + '" data-act="rep-mode" data-m="year">Tahunan</button></div><div class="period-nav no-print"><button class="icon-btn" data-act="rep-shift" data-n="-1" aria-label="Sebelumnya">' + icon('left') + '</button><b>' + label + '</b><button class="icon-btn" data-act="rep-shift" data-n="1" aria-label="Berikutnya">' + icon('right') + '</button></div>' +
          '<h2 style="margin-bottom:10px">Laporan keuangan ' + label + '</h2><div class="stat-row" style="margin-bottom:14px"><div class="stat"><span class="lbl ok">Pemasukan</span><b class="num">' + esc(money(rep.income)) + '</b></div><div class="stat"><span class="lbl bad">Pengeluaran</span><b class="num">' + esc(money(rep.expense)) + '</b></div></div>' +
          '<div class="card"><div class="eyebrow">Selisih bersih</div><div class="amount num ' + (rep.net >= 0 ? 'ok' : 'bad') + '" style="font-size:26px;font-weight:700;margin:4px 0">' + esc(money(rep.net, { plus: true })) + '</div>' + (monthly ? '<div class="muted" style="font-size:13px">' + esc(cmp) + ' Rata-rata ' + esc(money(rep.dailyAvgExpense)) + '/hari · ' + rep.count + ' transaksi.</div>' : '') + barsHtml(series, 'both') + '<div class="legend"><span><i style="background:var(--accent)"></i>Masuk</span><span><i style="background:var(--muted)"></i>Keluar</span></div></div>' +
          '<div class="card"><div class="card-head"><h2>Pengeluaran per kategori</h2></div>' + (rep.byExpense.length ? rep.byExpense.map(c => '<div class="cat-line" style="padding:6px 0"><span class="n">' + esc(c.name) + '</span><b class="num" style="font-size:13px">' + esc(money(c.total)) + '</b><span class="p num">' + Math.round(c.pct) + '%</span></div>').join('') : '<div class="muted">Tidak ada pengeluaran.</div>') + '</div>' +
          (monthly ? '<div class="card"><div class="card-head"><h2>Sumber pemasukan</h2></div>' + (rep.byIncome.length ? rep.byIncome.map(c => '<div class="cat-line" style="padding:6px 0"><span class="n">' + esc(c.name) + '</span><b class="num" style="font-size:13px">' + esc(money(c.total)) + '</b><span class="p num">' + Math.round(c.pct) + '%</span></div>').join('') : '<div class="muted">Tidak ada pemasukan.</div>') + '</div>' : '') };
    },
    catDetail: (p) => {
      const st = S(), range = C.periodRange(p.kind, p.ref), txs = C.queryTransactions(st, { categoryId: p.id, from: range[0], to: range[1] });
      return { title: C.categoryName(st, p.id), html: '<div class="card"><div class="eyebrow">' + esc(C.periodLabel(p.kind, p.ref, st.settings.dateFormat)) + '</div><div class="amount num" style="font-size:26px;font-weight:700;margin:4px 0">' + esc(money(sumTx(txs))) + '</div><div class="muted">' + txs.length + ' transaksi</div></div><div class="card">' + (txs.length ? txGroups(txs) : emptyState('file', 'Tidak ada transaksi', '')) + '</div>' };
    },
    goal: (p) => {
      const g = S().goals.find(x => x.id === p.id); if (!g) return { title: 'Target', html: emptyState('target', 'Target tidak ditemukan', '') };
      const pct = C.goalPct(g), need = C.goalMonthlyNeed(g, now());
      return { title: g.name, html: '<div class="card"><div class="goal-top"><div class="amount num" style="font-size:26px;font-weight:700">' + esc(money(g.saved)) + '</div><span class="pill ' + (g.saved >= g.target ? 'ok' : '') + '">' + (g.saved >= g.target ? 'Tercapai' : pct + '%') + '</span></div><div class="muted num">dari ' + esc(money(g.target)) + '</div><div class="progress"><i style="--w:' + pct + '%"></i></div><div class="muted" style="font-size:13px">' + (g.deadline ? 'Tenggat ' + esc(fdate(g.deadline)) : 'Tanpa tenggat') + (need ? ' · perlu ± ' + esc(money(need)) + '/bulan' : '') + (g.saved < g.target ? ' · kurang ' + esc(money(g.target - g.saved)) : '') + '</div></div>' +
        '<div class="row" style="margin-bottom:12px"><button class="btn primary" data-act="goal-funds" data-id="' + esc(g.id) + '" data-mode="add">' + icon('plus', 'sm') + 'Tambah dana</button><button class="btn" data-act="goal-funds" data-id="' + esc(g.id) + '" data-mode="sub">Kurangi dana</button></div>' +
        '<div class="row" style="margin-bottom:14px"><button class="btn ghost" data-act="goal-edit" data-id="' + esc(g.id) + '">' + icon('edit', 'sm') + 'Ubah</button><button class="btn danger" data-act="goal-del" data-id="' + esc(g.id) + '">' + icon('trash', 'sm') + 'Hapus</button></div>' +
        '<div class="card"><div class="card-head"><h2>Riwayat perkembangan</h2></div>' + (g.history.length ? g.history.slice().reverse().map(h => '<div class="tx" style="cursor:default"><span class="ico ' + (h.delta > 0 ? 'ok' : 'bad') + '">' + icon(h.delta > 0 ? 'arrow-in' : 'arrow-out', 'sm') + '</span><span class="info"><span class="t">' + (h.delta > 0 ? 'Tambah dana' : 'Kurangi dana') + '</span><span class="s">' + esc(fdate(h.ts)) + (h.note ? ' · ' + esc(h.note) : '') + '</span></span><span class="a num ' + (h.delta > 0 ? 'ok' : 'bad') + '">' + (h.delta > 0 ? '+' : '−') + ' ' + esc(money(Math.abs(h.delta))) + '</span></div>').join('') : emptyState('clock', 'Belum ada riwayat', 'Tambahkan dana pertama untuk mulai.')) + '</div>' };
    },
    settings: () => {
      const st = S(), s = st.settings, n = Native.status(), hasTx = st.transactions.length > 0;
      const sw = (on, act, label) => '<button class="switch ' + (on ? 'on' : '') + '" data-act="' + act + '" role="switch" aria-checked="' + on + '" aria-label="' + label + '"></button>';
      const item = (ic, t, sub, right) => '<div class="menu-item" style="cursor:default">' + icon(ic) + '<span class="mi">' + t + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + right + '</div>';
      return { title: 'Pengaturan', html: '<div class="group-title" style="margin-top:0">Tampilan</div><div class="card"><div class="eyebrow" style="margin-bottom:8px">Tema</div><div class="seg" style="margin-bottom:0">' + [['system', 'Sistem'], ['light', 'Terang'], ['dark', 'Gelap']].map(([k, l]) => '<button class="' + (s.theme === k ? 'on' : '') + '" data-act="set-theme" data-v="' + k + '">' + l + '</button>').join('') + '</div></div>' +
        '<div class="menu">' + item('clock', 'Kurangi animasi', 'Hormati preferensi gerak yang lebih tenang', sw(s.reduceMotion, 'set-motion', 'Kurangi animasi')) + '</div>' +
        '<div class="group-title">Umum</div><div class="card"><label class="f" style="margin-top:0" for="setCur">Mata uang</label><select class="in" id="setCur" data-change="set-currency"' + (hasTx ? ' disabled' : '') + '>' + opts(Object.keys(C.CURRENCIES).map(k => [k, C.CURRENCIES[k].name]), s.currency) + '</select>' + (hasTx ? '<div class="muted" style="font-size:12px;margin-top:6px">Mata uang dikunci setelah ada transaksi agar nominal tidak salah tafsir.</div>' : '') + '<label class="f" for="setDate">Format tanggal</label><select class="in" id="setDate" data-change="set-datefmt">' + opts(C.DATE_FORMATS.map(f => [f, C.formatDate(now(), f)]), s.dateFormat) + '</select></div>' +
        '<div class="group-title">Keamanan</div><div class="menu">' + (n.pinEnabled ? item('lock', 'PIN aktif', 'Ubah atau nonaktifkan', '<button class="btn" style="min-height:36px;padding:0 12px" data-act="pin-change">Ubah</button><button class="btn danger" style="min-height:36px;padding:0 12px" data-act="pin-off">Matikan</button>') : item('lock', 'PIN 6 digit', 'Kunci aplikasi saat dibuka', '<button class="btn primary" style="min-height:36px;padding:0 14px" data-act="pin-on">Aktifkan</button>')) +
        (n.pinEnabled ? item('finger', 'Sidik jari / biometrik', n.biometricAvailable ? 'PIN tetap menjadi cadangan' : 'Tidak tersedia di perangkat ini', n.biometricAvailable ? sw(n.biometricEnabled, 'bio-toggle', 'Biometrik') : '') : '') +
        (n.pinEnabled ? '<div class="menu-item" style="cursor:default">' + icon('clock') + '<span class="mi">Kunci otomatis<small>Setelah aplikasi ditinggalkan</small></span><select class="in" style="width:auto;min-height:38px" data-change="set-autolock" aria-label="Kunci otomatis">' + opts([['0', 'Segera'], ['30000', '30 detik'], ['60000', '1 menit'], ['300000', '5 menit'], ['900000', '15 menit']], String(n.autoLockMs)) + '</select></div>' : '') +
        item('shield', 'Blokir tangkapan layar', 'Juga menyembunyikan pratinjau di aplikasi terbaru', sw(n.secureScreen, 'set-secure', 'Blokir tangkapan layar')) + '</div>' +
        '<div class="group-title">Data</div><div class="menu">' + menuItem('upload', 'Buat backup terenkripsi', 'Dilindungi kata sandi pilihan Anda', 'backup') + menuItem('download', 'Pulihkan dari backup', 'Termasuk backup C01N versi 0.4', 'restore') + menuItem('file', 'Ekspor CSV', 'Semua transaksi', 'export-csv') + menuItem('chart', 'Laporan PDF', 'Dari halaman Laporan', 'sub" data-sub="reports') + '</div>' +
        '<div class="group-title">Tentang</div><div class="menu">' + menuItem('shield', 'Kebijakan privasi', '', 'sub" data-sub="privacy') + menuItem('info', 'Tentang C01N', 'Versi ' + esc(n.version), 'sub" data-sub="about') + '</div>' };
    },
    privacy: () => ({ title: 'Kebijakan privasi', html: '<div class="card stack-gap"><p><b>Data Anda tetap di perangkat Anda.</b> C01N tidak memerlukan akun, tidak memiliki server, dan tidak meminta izin internet. Tidak ada analitik, pelacak, atau iklan.</p><p>Transaksi, dompet, anggaran, dan tabungan disimpan terenkripsi (AES-256-GCM) dengan kunci yang dikelola Android Keystore. PIN tidak disimpan; hanya hash berlapis garam yang dipakai untuk memverifikasi.</p><p>File backup dienkripsi dengan kata sandi yang Anda pilih. Kata sandi tidak dapat dipulihkan: bila hilang, backup tidak dapat dibuka.</p><p>Ekspor CSV dan PDF tidak dienkripsi. Simpan dan bagikan dengan hati-hati. Anda dapat menghapus seluruh data kapan saja dari halaman Profil.</p><p>Aplikasi hanya meminta izin biometrik untuk membuka kunci dengan sidik jari. Penyimpanan file dilakukan lewat pemilih file Android sehingga tidak butuh izin penyimpanan.</p></div>' }),
    about: () => ({ title: 'Tentang C01N', html: '<div class="card" style="text-align:center"><div class="logo">C</div><h2 style="margin-top:12px">C01N</h2><p class="muted">Pengelola keuangan pribadi · privasi lebih dulu · bekerja offline</p><p class="muted" style="margin-top:8px">Versi ' + esc(Native.status().version) + '</p></div><div class="card stack-gap"><p>Fitur: banyak dompet, transfer, anggaran, tabungan, transaksi berulang, pengingat tagihan, laporan, backup terenkripsi, PIN dan biometrik.</p><p class="muted">Seluruh data berada di perangkat ini.</p></div>' })
  };

  function histList() {
    const h = ui.hist, st = S();
    const items = C.queryTransactions(st, { q: h.q, type: h.type, walletId: h.walletId, categoryId: h.categoryId, sort: h.sort, from: h.from ? C.parseDateTime(h.from, '00:00') : null, to: h.to ? C.parseDateTime(h.to, '00:00') + 86400000 : null });
    if (!items.length) return emptyState('search', 'Tidak ada transaksi', 'Ubah kata kunci atau filter.');
    const byDate = h.sort.startsWith('date');
    return '<div class="muted" style="font-size:12px;margin-bottom:4px">' + items.length + ' transaksi' + (items.length > 200 ? ' (200 teratas)' : '') + '</div>' + (byDate ? txGroups(items.slice(0, 200)) : items.slice(0, 200).map(txRow).join(''));
  }

  function renderSub(e) {
    if (!S()) return;
    const def = SUBS[e.name](e.params); const keep = e.el.scrollTop;
    e.el.classList.toggle('printing', false);
    e.el.innerHTML = '<div class="sub-head"><button class="icon-btn" data-act="back" aria-label="Kembali">' + icon('left') + '</button><h1>' + esc(def.title) + '</h1>' + (def.actions || '') + '</div><div class="sub-body">' + def.html + '</div>';
    e.el.scrollTop = keep; e.printable = !!def.printable;
  }
  function renderAll() { if (!S()) return; renderTab(ui.tab); Nav.stack.forEach(renderSub); }

  /* ================= form & sheet ================= */
  function formSheet(o) {
    return openSheet({ title: o.title, html: '<form novalidate autocomplete="off">' + o.body + '<div class="err" role="alert"></div><button class="btn primary block" type="submit">' + (o.submit || 'Simpan') + '</button>' + (o.extra || '') + '</form>',
      onMount(el, layer) {
        const f = el.querySelector('form');
        f.addEventListener('submit', ev => { ev.preventDefault(); guarded(f.querySelector('[type=submit]'), async () => { try { await o.onSubmit(f, layer); } catch (err) { f.querySelector('.err').textContent = err.message || 'Terjadi kesalahan.'; } }); });
        if (o.onMount) o.onMount(f, layer);
      } });
  }
  const field = (label, html, id) => '<label class="f"' + (id ? ' for="' + id + '"' : '') + '>' + label + '</label>' + html;
  const amountField = (name, value, label) => field(label || 'Nominal', '<div class="amount-field"><span>' + esc(curSym()) + '</span><input class="in" id="f_' + name + '" name="' + name + '" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(value || '') + '"></div>', 'f_' + name);
  const needAmount = (f, name) => { const v = parseMoney(f.elements[name].value); if (!v) throw new Error('Nominal harus angka lebih dari 0.'); return v; };

  function txSheet(o) {
    const st = S(), edit = o.id ? st.transactions.find(t => t.id === o.id) : null;
    if (o.id && !edit) return;
    const type = edit ? edit.type : (o.type || 'expense'), ts = edit ? edit.ts : (o.date ? C.parseDateTime(o.date, C.formatTime(now())) : now());
    const wallet = edit ? edit.walletId : (st.wallets.find(w => !w.archived) || {}).id;
    const body = '<div class="seg" id="typeSeg" style="margin:10px 0 0">' + [['income', 'Pemasukan'], ['expense', 'Pengeluaran'], ['transfer', 'Transfer']].map(([k, l]) => '<button type="button" data-t="' + k + '" class="' + (k === type ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
      amountField('amount', edit ? amt(edit.amount) : '') +
      field('Deskripsi', '<input class="in" id="f_title" name="title" maxlength="60" placeholder="Contoh: Makan siang" value="' + esc(edit ? edit.title : '') + '">', 'f_title') +
      '<div data-for="cat">' + field('Kategori', '<select class="in" id="f_cat" name="categoryId"></select>', 'f_cat') + '</div>' +
      field('<span data-lbl="from">Dompet</span>', '<select class="in" id="f_wallet" name="walletId">' + walletOpts(wallet) + '</select>', 'f_wallet') +
      '<div data-for="to">' + field('Dompet tujuan', '<select class="in" id="f_to" name="toWalletId">' + walletOpts(edit && edit.toWalletId ? edit.toWalletId : ((st.wallets.filter(w => !w.archived && w.id !== wallet)[0] || {}).id)) + '</select>', 'f_to') + '</div>' +
      '<div data-for="method">' + field('Metode pembayaran', '<select class="in" id="f_method" name="method"><option value="">—</option>' + opts(C.METHODS.map(m => [m, m]), edit ? edit.method : '') + '</select>', 'f_method') + '</div>' +
      '<div class="row">' + field('Tanggal', '<input class="in" type="date" id="f_date" name="date" value="' + C.dateInputValue(ts) + '">', 'f_date') + field('Waktu', '<input class="in" type="time" id="f_time" name="time" value="' + C.timeInputValue(ts) + '">', 'f_time') + '</div>' +
      field('Catatan (opsional)', '<textarea class="in" id="f_note" name="note" maxlength="160" rows="2">' + esc(edit ? edit.note : '') + '</textarea>', 'f_note');
    formSheet({ title: edit ? 'Ubah transaksi' : 'Tambah transaksi', body, submit: edit ? 'Simpan perubahan' : 'Simpan transaksi',
      extra: edit ? '<button type="button" class="btn danger block" style="margin-top:10px" data-act="tx-delete" data-id="' + esc(edit.id) + '">' + icon('trash', 'sm') + 'Hapus transaksi</button>' : '',
      onMount(f) {
        let cur = type;
        const apply = (t, keepCat) => {
          cur = t; f.dataset.type = t; $$('#typeSeg button', f).forEach(b => b.classList.toggle('on', b.dataset.t === t));
          f.querySelector('[data-for=cat]').hidden = t === 'transfer'; f.querySelector('[data-for=to]').hidden = t !== 'transfer'; f.querySelector('[data-for=method]').hidden = t === 'transfer';
          f.querySelector('[data-lbl=from]').textContent = t === 'transfer' ? 'Dari dompet' : 'Dompet';
          if (t !== 'transfer') f.elements.categoryId.innerHTML = catOpts(t, keepCat);
        };
        apply(type, edit ? edit.categoryId : '');
        f.querySelector('#typeSeg').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) apply(b.dataset.t, ''); });
        f.dataset.get = '1'; f._type = () => cur;
      },
      onSubmit(f, layer) {
        const t = f._type(), amount = needAmount(f, 'amount'), ts2 = C.parseDateTime(f.elements.date.value, f.elements.time.value);
        if (ts2 === null) throw new Error('Tanggal atau waktu tidak valid.');
        const input = { type: t, amount, ts: ts2, title: f.elements.title.value, note: f.elements.note.value, walletId: f.elements.walletId.value, method: t === 'transfer' ? '' : f.elements.method.value };
        if (t === 'transfer') input.toWalletId = f.elements.toWalletId.value; else input.categoryId = f.elements.categoryId.value;
        const before = C.budgetStatus(S(), ts2);
        const res = edit ? C.updateTransaction(S(), edit.id, input) : C.addTransaction(S(), input);
        const saved = Store.commit(res.state);
        layer.close(); toast(edit ? 'Perubahan transaksi disimpan' : 'Transaksi berhasil ditambahkan');
        if (t === 'expense') C.budgetAlerts(before, C.budgetStatus(saved, ts2)).forEach(a => setTimeout(() => toast('Anggaran ' + (a.scope === 'total' ? 'bulanan' : C.categoryName(saved, a.scope)) + (a.level === 'over' ? ' terlampaui' : ' hampir habis'), 'bad'), 1500));
      } });
  }

  function budgetSheet(categoryId, pickCategory) {
    const st = S(), existing = st.budgets.find(b => b.categoryId === categoryId);
    formSheet({ title: categoryId === null ? 'Anggaran total bulanan' : pickCategory ? 'Anggaran kategori' : 'Anggaran ' + C.categoryName(st, categoryId),
      body: (pickCategory ? field('Kategori', '<select class="in" name="cat" id="f_c">' + opts(st.categories.filter(c => c.type === 'expense' && !st.budgets.some(b => b.categoryId === c.id)).map(c => [c.id, c.name]), '') + '</select>', 'f_c') : '') + amountField('limit', existing ? amt(existing.limit) : '', 'Batas pengeluaran per bulan') + '<p class="muted" style="font-size:12px;margin-top:8px">Peringatan muncul saat pemakaian mencapai 80% dan saat terlampaui.</p>',
      extra: existing ? '<button type="button" class="btn danger block" style="margin-top:10px" data-act="budget-del" data-id="' + esc(categoryId === null ? '' : categoryId) + '">Hapus anggaran</button>' : '',
      onSubmit(f, layer) { const lim = needAmount(f, 'limit'), cid = pickCategory ? f.elements.cat.value : categoryId; if (cid === '' || cid === undefined) throw new Error('Pilih kategori.'); commit(s => C.setBudget(s, cid, lim)); layer.close(); toast('Anggaran disimpan'); } });
  }

  function goalSheet(id) {
    const g = id ? S().goals.find(x => x.id === id) : null;
    formSheet({ title: g ? 'Ubah target' : 'Target tabungan baru', body: field('Nama target', '<input class="in" id="f_n" name="name" maxlength="40" placeholder="Contoh: Dana darurat" value="' + esc(g ? g.name : '') + '">', 'f_n') + amountField('target', g ? amt(g.target) : '', 'Nominal target') + field('Tenggat (opsional)', '<input class="in" type="date" id="f_d" name="deadline" value="' + (g && g.deadline ? C.dateInputValue(g.deadline) : '') + '">', 'f_d'),
      onSubmit(f, layer) {
        const name = C.cleanText(f.elements.name.value, 40); if (!name) throw new Error('Nama target wajib diisi.');
        const target = needAmount(f, 'target'), dl = f.elements.deadline.value ? C.parseDateTime(f.elements.deadline.value, '23:59') : null;
        if (f.elements.deadline.value && dl === null) throw new Error('Tenggat tidak valid.');
        commit(s => Object.assign({}, s, { goals: g ? s.goals.map(x => x.id === id ? Object.assign({}, x, { name, target, deadline: dl }) : x) : s.goals.concat([{ id: C.uid(), name, target, deadline: dl, saved: 0, createdAt: now(), history: [] }]) }));
        layer.close(); toast(g ? 'Target diperbarui' : 'Target dibuat');
      } });
  }
  function fundsSheet(id, mode) {
    const g = S().goals.find(x => x.id === id); if (!g) return;
    formSheet({ title: (mode === 'add' ? 'Tambah dana · ' : 'Kurangi dana · ') + g.name, body: amountField('amount', '') + field('Catatan (opsional)', '<input class="in" id="f_note" name="note" maxlength="60">', 'f_note'), submit: mode === 'add' ? 'Tambahkan' : 'Kurangi',
      onSubmit(f, layer) {
        const a = needAmount(f, 'amount'), upd = C.goalAdjust(g, mode === 'add' ? a : -a, now(), f.elements.note.value);
        commit(s => Object.assign({}, s, { goals: s.goals.map(x => x.id === id ? upd : x) })); layer.close();
        toast(upd.saved >= upd.target && g.saved < g.target ? 'Selamat! Target tabungan tercapai' : mode === 'add' ? 'Dana ditambahkan' : 'Dana dikurangi');
      } });
  }

  function walletSheet(id) {
    const st = S(), w = id ? st.wallets.find(x => x.id === id) : null;
    formSheet({ title: w ? 'Ubah dompet' : 'Dompet baru', body: field('Nama dompet', '<input class="in" id="f_n" name="name" maxlength="30" value="' + esc(w ? w.name : '') + '" placeholder="Contoh: Rekening BCA">', 'f_n') + field('Jenis', '<select class="in" id="f_t" name="type">' + opts(Object.entries(C.WALLET_TYPES), w ? w.type : 'bank') + '</select>', 'f_t') + (w ? '<div class="muted" style="font-size:13px;margin-top:10px">Saldo: ' + esc(money(C.walletBalance(st, w.id))) + '</div>' : (!st.transactions.length ? '' : '')) + (w ? '' : amountField('initial', '', 'Saldo awal (opsional)')),
      extra: w ? '<button type="button" class="btn danger block" style="margin-top:10px" data-act="wallet-del" data-id="' + esc(w.id) + '">' + icon('trash', 'sm') + (st.transactions.some(t => t.walletId === w.id || t.toWalletId === w.id) ? 'Arsipkan dompet' : 'Hapus dompet') + '</button>' : '',
      onSubmit(f, layer) {
        if (w) commit(s => C.renameWallet(s, id, f.elements.name.value, f.elements.type.value));
        else {
          let s2 = C.addWallet(S(), f.elements.name.value, f.elements.type.value); const nw = s2.wallets[s2.wallets.length - 1], raw = f.elements.initial.value.trim();
          if (raw) { const v = parseMoney(raw); if (!v) throw new Error('Saldo awal tidak valid.'); s2 = C.addTransaction(s2, { type: 'income', amount: v, ts: now(), walletId: nw.id, categoryId: s2.categories.find(c => c.type === 'income' && c.name === 'Lainnya').id, title: 'Saldo awal' }).state; }
          Store.commit(s2);
        }
        layer.close(); toast('Dompet disimpan');
      } });
  }
  function transferSheet() {
    const st = S(), ws = st.wallets.filter(w => !w.archived);
    if (ws.length < 2) { toast('Buat minimal dua dompet untuk transfer', 'bad'); return; }
    formSheet({ title: 'Transfer antar dompet', body: field('Dari', '<select class="in" id="f_a" name="from">' + walletOpts(ws[0].id) + '</select>', 'f_a') + field('Ke', '<select class="in" id="f_b" name="to">' + walletOpts(ws[1].id) + '</select>', 'f_b') + amountField('amount', '') + field('Catatan (opsional)', '<input class="in" id="f_note" name="note" maxlength="60">', 'f_note') + '<p class="muted" style="font-size:12px;margin-top:8px">Transfer memindahkan saldo dan tidak dihitung sebagai pemasukan atau pengeluaran.</p>', submit: 'Transfer',
      onSubmit(f, layer) { const a = needAmount(f, 'amount'); commit(s => C.addTransaction(s, { type: 'transfer', amount: a, ts: now(), walletId: f.elements.from.value, toWalletId: f.elements.to.value, title: f.elements.note.value }).state); layer.close(); toast('Transfer berhasil'); } });
  }
  function categorySheet() {
    formSheet({ title: 'Kategori baru', body: '<div class="seg" style="margin:10px 0 0" id="ctype"><button type="button" data-t="expense" class="on">Pengeluaran</button><button type="button" data-t="income">Pemasukan</button></div>' + field('Nama kategori', '<input class="in" id="f_n" name="name" maxlength="24">', 'f_n'),
      onMount(f) { f.dataset.type = 'expense'; f.querySelector('#ctype').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; f.dataset.type = b.dataset.t; $$('#ctype button', f).forEach(x => x.classList.toggle('on', x === b)); }); },
      onSubmit(f, layer) { commit(s => C.addCategory(s, f.elements.name.value, f.dataset.type)); layer.close(); toast('Kategori ditambahkan'); } });
  }
  function recurringSheet() {
    const st = S();
    formSheet({ title: 'Transaksi berulang', body: '<div class="seg" style="margin:10px 0 0" id="rtype"><button type="button" data-t="expense" class="on">Pengeluaran</button><button type="button" data-t="income">Pemasukan</button></div>' + field('Deskripsi', '<input class="in" id="f_t" name="title" maxlength="60" placeholder="Contoh: Cicilan, Gaji">', 'f_t') + amountField('amount', '') + field('Kategori', '<select class="in" id="f_c" name="cat"></select>', 'f_c') + field('Dompet', '<select class="in" id="f_w" name="wallet">' + walletOpts('') + '</select>', 'f_w') + field('Frekuensi', '<select class="in" id="f_f" name="freq">' + opts([['daily', 'Harian'], ['weekly', 'Mingguan'], ['monthly', 'Bulanan'], ['yearly', 'Tahunan']], 'monthly') + '</select>', 'f_f') + '<div class="row">' + field('Mulai', '<input class="in" type="date" id="f_s" name="start" value="' + C.dateInputValue(now()) + '">', 'f_s') + field('Berakhir (opsional)', '<input class="in" type="date" id="f_e" name="end">', 'f_e') + '</div>',
      onMount(f) { const set = t => { f.dataset.type = t; $$('#rtype button', f).forEach(x => x.classList.toggle('on', x.dataset.t === t)); f.elements.cat.innerHTML = catOpts(t, ''); }; set('expense'); f.querySelector('#rtype').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) set(b.dataset.t); }); },
      onSubmit(f, layer) {
        const amount = needAmount(f, 'amount'), start = C.parseDateTime(f.elements.start.value, '08:00'), end = f.elements.end.value ? C.parseDateTime(f.elements.end.value, '23:59') : null;
        if (start === null) throw new Error('Tanggal mulai tidak valid.');
        let s2 = C.addRecurring(S(), { type: f.dataset.type, title: f.elements.title.value, amount, walletId: f.elements.wallet.value, categoryId: f.elements.cat.value, freq: f.elements.freq.value, startTs: start, endTs: end });
        const r = C.applyRecurring(s2, now()); Store.commit(r.state); layer.close(); toast(r.created ? r.created + ' transaksi dicatat otomatis' : 'Transaksi berulang ditambahkan');
      } });
  }
  function billSheet() {
    formSheet({ title: 'Tagihan baru', body: field('Nama tagihan', '<input class="in" id="f_n" name="name" maxlength="40" placeholder="Contoh: Listrik">', 'f_n') + amountField('amount', '') + '<div class="row">' + field('Jatuh tempo (tanggal)', '<input class="in" id="f_d" name="day" inputmode="numeric" maxlength="2" placeholder="1–31">', 'f_d') + field('Ingatkan (hari)', '<input class="in" id="f_r" name="remind" inputmode="numeric" maxlength="2" value="3">', 'f_r') + '</div>',
      onSubmit(f, layer) { const day = parseInt(f.elements.day.value, 10); if (!(day >= 1 && day <= 31)) throw new Error('Tanggal jatuh tempo harus 1–31.'); const amount = needAmount(f, 'amount'); commit(s => C.addBill(s, { name: f.elements.name.value, amount, dueDay: day, remindDays: parseInt(f.elements.remind.value, 10) || 0 })); layer.close(); toast('Tagihan ditambahkan'); } });
  }

  function profileSheet() {
    const s = S().settings;
    formSheet({ title: 'Ubah profil', body: '<div style="text-align:center;margin:10px 0"><div class="avatar" id="avPrev" style="margin:0 auto 10px;width:84px;height:84px">' + (s.photo ? '<img alt="" src="' + s.photo + '">' : esc((s.name || 'C').charAt(0).toUpperCase())) + '</div><button type="button" class="link-btn" data-act="photo-pick">Pilih foto</button>' + (s.photo ? ' · <button type="button" class="link-btn" data-act="photo-del">Hapus foto</button>' : '') + '</div>' + field('Nama', '<input class="in" id="f_n" name="name" maxlength="40" value="' + esc(s.name) + '" placeholder="Nama Anda">', 'f_n'),
      onSubmit(f, layer) { const name = C.cleanText(f.elements.name.value, 40); commit(st => Object.assign({}, st, { settings: Object.assign({}, st.settings, { name }) })); layer.close(); toast('Profil disimpan'); } });
  }
  function processPhoto(file) {
    if (!file) return; const rd = new FileReader();
    rd.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), m = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 256, 256);
      try { const url = c.toDataURL('image/jpeg', .82); commit(st => Object.assign({}, st, { settings: Object.assign({}, st.settings, { photo: url }) })); U.closeTopLayer(); toast('Foto profil diperbarui'); } catch (_) { toast('Foto tidak bisa diproses', 'bad'); }
    }; img.onerror = () => toast('File bukan gambar yang valid', 'bad'); img.src = rd.result; };
    rd.readAsDataURL(file);
  }

  /* ================= backup, restore, ekspor ================= */
  function backupSheet() {
    formSheet({ title: 'Backup terenkripsi', body: '<p class="muted" style="margin-top:8px">Backup dienkripsi dengan kata sandi ini. <b>Kata sandi tidak bisa dipulihkan</b> bila lupa.</p>' + field('Kata sandi (min. 6 karakter)', '<input class="in" type="password" id="f_p" name="p1" autocomplete="new-password">', 'f_p') + field('Ulangi kata sandi', '<input class="in" type="password" id="f_p2" name="p2" autocomplete="new-password">', 'f_p2'), submit: 'Buat backup',
      onSubmit(f, layer) {
        const a = f.elements.p1.value; if (a.length < 6) throw new Error('Kata sandi minimal 6 karakter.'); if (a !== f.elements.p2.value) throw new Error('Kata sandi tidak sama.');
        const r = Native.encryptBackup(C.backupPayload(S()), a); if (!r.ok) throw new Error('Gagal mengenkripsi backup.');
        Native.saveFile('C01N-backup-' + C.dateInputValue(now()) + '.json', 'application/json', r.data); layer.close(); toast('Pilih lokasi penyimpanan backup');
      } });
  }
  function restoreFlow() { const inp = $('#restoreFile'); inp.value = ''; inp.removeAttribute('accept'); inp.click(); }
  function handleRestoreFile(file) {
    if (!file) return; const rd = new FileReader();
    rd.onerror = () => toast('File tidak bisa dibaca', 'bad');
    rd.onload = () => {
      const text = String(rd.result);
      if (Native.isEncryptedBackup(text)) {
        formSheet({ title: 'Buka backup', body: '<p class="muted" style="margin-top:8px">Masukkan kata sandi yang dipakai saat membuat backup.</p>' + field('Kata sandi', '<input class="in" type="password" id="f_p" name="p" autocomplete="off">', 'f_p'), submit: 'Buka backup',
          onSubmit(f, layer) { const r = Native.decryptBackup(text, f.elements.p.value); if (!r.ok) throw new Error('Kata sandi salah atau file backup rusak.'); layer.close(); applyRestore(r.data); } });
      } else applyRestore(text);
    };
    rd.readAsText(file);
  }
  async function applyRestore(text) {
    let incoming; try { incoming = C.parseBackup(text, now()); } catch (e) { toast(e.message, 'bad'); return; }
    const n = incoming.transactions.length;
    const choice = await dialog({ title: 'Pulihkan ' + n + ' transaksi', message: 'Gabungkan menambah data yang belum ada. Ganti semua menimpa data saat ini dengan isi backup.', buttons: [{ label: 'Batal', value: null, kind: 'ghost' }, { label: 'Gabungkan', value: 'merge', kind: 'primary' }, { label: 'Ganti semua', value: 'replace', kind: 'danger' }] });
    if (!choice) return;
    if (choice === 'replace' && !(await confirmBox('Ganti semua data?', 'Data saat ini akan dihapus dan diganti isi backup. Tindakan ini tidak bisa dibatalkan.', 'Ganti semua', true))) return;
    try {
      if (choice === 'merge') { const m = C.mergeStates(S(), incoming); Store.commit(m.state); toast(m.added + ' transaksi ditambahkan'); }
      else { incoming.settings.onboarded = true; Store.commit(incoming); toast('Data dipulihkan dari backup'); }
    } catch (e) { toast(e.message, 'bad'); }
  }
  function exportCsv(txs, name) { Native.saveFile(name, 'text/csv', '﻿' + C.toCSV(S(), txs)); toast('Pilih lokasi penyimpanan CSV'); }

  async function wipeFlow() {
    if (!(await confirmBox('Hapus semua data?', 'Semua transaksi, dompet, anggaran, tabungan, pengaturan, dan PIN akan dihapus permanen. Buat backup terlebih dahulu bila perlu.', 'Lanjutkan', true))) return;
    if (Native.status().pinEnabled) { if ((await Security.confirmPin('Verifikasi PIN', 'Masukkan PIN untuk menghapus semua data')) === null) return; }
    else {
      const ok = await new Promise(res => formSheet({ title: 'Konfirmasi penghapusan', body: '<p class="muted" style="margin-top:8px">Ketik <b>HAPUS</b> untuk melanjutkan.</p><input class="in" name="w" autocomplete="off" aria-label="Ketik HAPUS">', submit: 'Hapus semua data', onSubmit(f, layer) { if (f.elements.w.value.trim().toUpperCase() !== 'HAPUS') throw new Error('Ketik HAPUS untuk konfirmasi.'); layer.close(); res(true); }, onMount(f, layer) { const t = setInterval(() => { if (!layer.el.isConnected) { clearInterval(t); res(false); } }, 300); } }));
      if (!ok) return;
    }
    Store.reset(); Nav.clear(); if (Pages.onReset) Pages.onReset();
  }

  /* ================= aksi (delegasi event) ================= */
  const shift = (key, n) => { const p = ui[key]; p.ref = C.shiftPeriod(p.kind, p.ref, n); renderAll(); };
  const A = {
    tab: el => { Nav.clear(); Nav.setTab(el.dataset.tab); },
    back: () => Nav.back(),
    sub: el => { const sub = el.dataset.sub; if (sub === 'reports') ui.rep = { mode: 'month', ref: now() }; if (sub === 'calendar') { const d = new Date(); ui.cal = { y: d.getFullYear(), m: d.getMonth(), sel: d.getDate() }; } Nav.push(sub); },
    'hide-toggle': () => commit(s => Object.assign({}, s, { settings: Object.assign({}, s.settings, { hideBalance: !s.settings.hideBalance }) })),
    'add-tx': el => txSheet({ type: el.dataset.type, date: el.dataset.date }), 'tx-edit': el => txSheet({ id: el.dataset.id }),
    'tx-delete': async el => { const t = S().transactions.find(x => x.id === el.dataset.id); if (!t) return; if (await confirmBox('Hapus transaksi?', '"' + (t.title || 'Transaksi') + '" akan dihapus dan saldo dihitung ulang.', 'Hapus', true)) { commit(s => C.deleteTransaction(s, t.id)); U.closeTopLayer(); toast('Transaksi dihapus dan saldo diperbarui'); } },
    kind: el => { ui[el.dataset.key].kind = el.dataset.kind; renderAll(); }, shift: el => shift(el.dataset.key, +el.dataset.n), today: el => { ui[el.dataset.key].ref = now(); renderAll(); },
    'cat-detail': el => { const key = Nav.stack.length && Nav.stack[Nav.stack.length - 1].name === 'income' ? 'inc' : 'exp'; Nav.push('catDetail', { id: el.dataset.id, kind: ui[key].kind, ref: ui[key].ref }); },
    'hist-type': el => { ui.hist.type = el.dataset.v; renderAll(); }, 'hist-reset': () => { ui.hist = { q: '', type: 'all', sort: 'date-desc', walletId: '', categoryId: '', from: '', to: '' }; renderAll(); },
    'budget-total': () => budgetSheet(null, false), 'budget-cat': el => { if (el.dataset.id) budgetSheet(el.dataset.id, false); else if (S().categories.some(c => c.type === 'expense' && !S().budgets.some(b => b.categoryId === c.id))) budgetSheet('', true); else toast('Semua kategori sudah punya anggaran'); },
    'budget-del': el => { const id = el.dataset.id === '' ? null : el.dataset.id; commit(s => C.setBudget(s, id, 0)); U.closeTopLayer(); toast('Anggaran dihapus'); },
    'goal-add': () => goalSheet(null), 'goal-open': el => Nav.push('goal', { id: el.dataset.id }), 'goal-edit': el => goalSheet(el.dataset.id), 'goal-funds': el => fundsSheet(el.dataset.id, el.dataset.mode),
    'goal-del': async el => { if (await confirmBox('Hapus target?', 'Target dan riwayatnya akan dihapus.', 'Hapus', true)) { Nav.pop(); commit(s => Object.assign({}, s, { goals: s.goals.filter(g => g.id !== el.dataset.id) })); toast('Target dihapus'); } },
    'wallet-add': () => walletSheet(null), 'wallet-edit': el => walletSheet(el.dataset.id), transfer: transferSheet,
    'wallet-del': async el => { const w = S().wallets.find(x => x.id === el.dataset.id); if (!w) return; try { const probe = C.removeWallet(S(), w.id); if (!(await confirmBox(probe.archived ? 'Arsipkan dompet?' : 'Hapus dompet?', probe.archived ? 'Dompet punya riwayat, jadi diarsipkan: riwayat tetap ada tetapi tidak bisa dipakai lagi.' : 'Dompet kosong ini akan dihapus.', probe.archived ? 'Arsipkan' : 'Hapus', true))) return; Store.commit(probe.state); U.closeTopLayer(); toast(probe.archived ? 'Dompet diarsipkan' : 'Dompet dihapus'); } catch (e) { toast(e.message, 'bad'); } },
    'cat-add': categorySheet, 'cat-del': async el => { if (await confirmBox('Hapus kategori?', 'Transaksi dengan kategori ini dipindahkan ke "Lainnya".', 'Hapus', true)) try { commit(s => C.removeCategory(s, el.dataset.id)); toast('Kategori dihapus'); } catch (e) { toast(e.message, 'bad'); } },
    'rec-add': recurringSheet, 'rec-toggle': el => commit(s => Object.assign({}, s, { recurring: s.recurring.map(r => r.id === el.dataset.id ? Object.assign({}, r, { active: !r.active, nextTs: !r.active && r.nextTs < now() ? C.addInterval(now(), r.freq, r.anchorDay) : r.nextTs }) : r) })),
    'rec-del': async el => { if (await confirmBox('Hapus aturan berulang?', 'Transaksi yang sudah tercatat tidak ikut terhapus.', 'Hapus', true)) commit(s => Object.assign({}, s, { recurring: s.recurring.filter(r => r.id !== el.dataset.id) })); },
    'bill-add': billSheet, 'bill-del': async el => { if (await confirmBox('Hapus tagihan?', '', 'Hapus', true)) commit(s => Object.assign({}, s, { bills: s.bills.filter(b => b.id !== el.dataset.id) })); },
    'bill-pay': async el => { const b = S().bills.find(x => x.id === el.dataset.id); if (!b) return; const c = await dialog({ title: 'Bayar ' + b.name, message: 'Catat sebagai pengeluaran ' + money(b.amount) + ' dari dompet pertama?', buttons: [{ label: 'Batal', value: null, kind: 'ghost' }, { label: 'Tandai saja', value: 'mark' }, { label: 'Catat pengeluaran', value: 'rec', kind: 'primary' }] }); if (!c) return; try { commit(s => C.markBillPaid(s, b.id, now(), c === 'rec' ? s.wallets.find(w => !w.archived).id : null)); toast('Tagihan ditandai lunas'); } catch (e) { toast(e.message, 'bad'); } },
    'cal-shift': el => { const d = new Date(ui.cal.y, ui.cal.m + (+el.dataset.n), 1); ui.cal = { y: d.getFullYear(), m: d.getMonth(), sel: 1 }; renderAll(); }, 'cal-day': el => { ui.cal.sel = +el.dataset.d; renderAll(); },
    'rep-mode': el => { ui.rep.mode = el.dataset.m; renderAll(); }, 'rep-shift': el => { ui.rep.ref = C.shiftPeriod(ui.rep.mode, ui.rep.ref, +el.dataset.n); renderAll(); },
    'export-pdf': () => { const top = Nav.stack[Nav.stack.length - 1]; if (!top) return; top.el.classList.add('printing'); Native.printPage('Laporan C01N'); setTimeout(() => top.el.classList.remove('printing'), 4000); toast('Pilih "Simpan sebagai PDF" di dialog cetak'); },
    'export-csv': () => exportCsv(S().transactions, 'C01N-transaksi-' + C.dateInputValue(now()) + '.csv'),
    'export-csv-period': () => { const r = ui.rep, range = r.mode === 'month' ? C.periodRange('month', r.ref) : C.periodRange('year', r.ref); exportCsv(C.inRange(S().transactions, range), 'C01N-laporan-' + C.dateInputValue(range[0]).slice(0, r.mode === 'month' ? 7 : 4) + '.csv'); },
    'profile-edit': profileSheet, 'photo-pick': () => { const i = $('#photoFile'); i.value = ''; i.click(); }, 'photo-del': () => { commit(s => Object.assign({}, s, { settings: Object.assign({}, s.settings, { photo: '' }) })); U.closeTopLayer(); toast('Foto dihapus'); }, wipe: wipeFlow,
    'set-theme': el => { commit(s => Object.assign({}, s, { settings: Object.assign({}, s.settings, { theme: el.dataset.v }) })); U.applyTheme(); }, 'set-motion': () => { commit(s => Object.assign({}, s, { settings: Object.assign({}, s.settings, { reduceMotion: !s.settings.reduceMotion }) })); U.applyTheme(); },
    'pin-on': async () => { if (await Security.createPin()) renderAll(); }, 'pin-change': () => Security.changePin(), 'pin-off': async () => { if (await Security.disablePin()) renderAll(); },
    'bio-toggle': () => { const n = Native.status(); if (!Native.setBiometric(!n.biometricEnabled)) toast('Biometrik tidak dapat diaktifkan di perangkat ini', 'bad'); renderAll(); },
    'set-secure': () => { Native.setSecureScreen(!Native.status().secureScreen); renderAll(); },
    backup: backupSheet, restore: restoreFlow
  };
  const I = { 'hist-q': el => { ui.hist.q = el.value; const l = $('#histList'); if (l) l.innerHTML = histList(); } };
  const CH = {
    'hist-wallet': el => { ui.hist.walletId = el.value; renderAll(); }, 'hist-cat': el => { ui.hist.categoryId = el.value; renderAll(); }, 'hist-sort': el => { ui.hist.sort = el.value; renderAll(); },
    'hist-from': el => { ui.hist.from = el.value; renderAll(); }, 'hist-to': el => { ui.hist.to = el.value; renderAll(); },
    'set-currency': el => { commit(s => Object.assign({}, s, { settings: Object.assign({}, s.settings, { currency: el.value }) })); }, 'set-datefmt': el => { commit(s => Object.assign({}, s, { settings: Object.assign({}, s.settings, { dateFormat: el.value }) })); },
    'set-autolock': el => { Native.setAutoLock(+el.value); toast('Kunci otomatis diperbarui'); }
  };
  document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (!t) return; const fn = A[t.dataset.act]; if (!fn) return; e.preventDefault(); try { const r = fn(t, e); if (r && r.catch) r.catch(err => toast(err.message || 'Terjadi kesalahan', 'bad')); } catch (err) { toast(err.message || 'Terjadi kesalahan', 'bad'); } });
  document.addEventListener('input', e => { const t = e.target.closest('[data-input]'); if (t && I[t.dataset.input]) I[t.dataset.input](t); });
  document.addEventListener('change', e => { const t = e.target.closest('[data-change]'); if (t && CH[t.dataset.change]) CH[t.dataset.change](t); });
  $('#restoreFile').addEventListener('change', e => handleRestoreFile(e.target.files[0]));
  $('#photoFile').addEventListener('change', e => processPhoto(e.target.files[0]));
  Store.on(renderAll);

  const Pages = { Nav, ui, renderAll, txSheet, onReset: null };
  window.Pages = Pages;
})();
