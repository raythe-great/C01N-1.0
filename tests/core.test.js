'use strict';
// Jalankan: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../app/src/main/assets/www/js/core.js');

const D = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
function base() { return C.freshState(D(2026, 1, 1)); }
function cat(s, type, name) { return s.categories.find(c => c.type === type && c.name === name).id; }
function add(s, o) { return C.addTransaction(s, Object.assign({ walletId: 'w-main', title: 'x', ts: D(2026, 11, 5) }, o)).state; }

test('format & parse uang (integer, tanpa pembulatan float)', () => {
  assert.equal(C.formatMoney(1500000, 'IDR'), 'Rp 1.500.000');
  assert.equal(C.formatMoney(-2500, 'IDR'), '-Rp 2.500');
  assert.equal(C.formatMoney(123456, 'USD'), '$ 1,234.56');
  assert.equal(C.formatMoney(5, 'USD'), '$ 0.05');
  assert.equal(C.parseAmount('1.500.000', 'IDR'), 1500000);
  assert.equal(C.parseAmount('Rp 25000', 'IDR'), 25000);
  assert.equal(C.parseAmount('15,5', 'USD'), 1550);
  assert.equal(C.parseAmount('1.500', 'USD'), 150000);
  assert.equal(C.parseAmount('0.10', 'USD'), 10);
  assert.equal(C.parseAmount('', 'IDR'), null);
  assert.equal(C.parseAmount('0', 'IDR'), null);
  assert.equal(C.parseAmount('abc', 'IDR'), null);
  assert.equal(C.parseAmount('99999999999999999999', 'IDR'), null);
  assert.equal(C.amountToInput(1550, 'USD'), '15.50');
});

test('0.1 + 0.2 tidak jadi masalah: penjumlahan tetap integer', () => {
  let s = base(); const c = cat(s, 'income', 'Gaji');
  s = add(s, { type: 'income', amount: 10, categoryId: c }); s = add(s, { type: 'income', amount: 20, categoryId: c });
  assert.equal(C.totalBalance(s), 30);
});

test('saldo mengikuti tambah, edit, dan hapus transaksi', () => {
  let s = base(); const inc = cat(s, 'income', 'Gaji'), ex = cat(s, 'expense', 'Makanan');
  let r = C.addTransaction(s, { type: 'income', amount: 1000000, walletId: 'w-main', categoryId: inc, title: 'Gaji', ts: D(2026, 11, 1) }); s = r.state;
  const e = C.addTransaction(s, { type: 'expense', amount: 250000, walletId: 'w-main', categoryId: ex, title: 'Makan', ts: D(2026, 11, 2) }); s = e.state;
  assert.equal(C.totalBalance(s), 750000);
  s = C.updateTransaction(s, e.tx.id, { amount: 300000 }).state;
  assert.equal(C.totalBalance(s), 700000);
  s = C.updateTransaction(s, e.tx.id, { type: 'income', categoryId: inc }).state; // ubah jenis
  assert.equal(C.totalBalance(s), 1300000);
  s = C.deleteTransaction(s, e.tx.id);
  assert.equal(C.totalBalance(s), 1000000);
  assert.throws(() => C.deleteTransaction(s, 'nope'));
});

test('validasi input transaksi', () => {
  const s = base(), ex = cat(s, 'expense', 'Makanan'), inc = cat(s, 'income', 'Gaji');
  const ok = { type: 'expense', amount: 5, walletId: 'w-main', categoryId: ex, title: 't', ts: D(2026, 1, 2) };
  assert.throws(() => C.addTransaction(s, Object.assign({}, ok, { amount: 0 })), /Nominal/);
  assert.throws(() => C.addTransaction(s, Object.assign({}, ok, { amount: 1.5 })), /Nominal/);
  assert.throws(() => C.addTransaction(s, Object.assign({}, ok, { title: ' ' })), /Deskripsi/);
  assert.throws(() => C.addTransaction(s, Object.assign({}, ok, { walletId: 'zzz' })), /Dompet/);
  assert.throws(() => C.addTransaction(s, Object.assign({}, ok, { categoryId: inc })), /kategori/i); // kategori pemasukan untuk pengeluaran
  assert.throws(() => C.addTransaction(s, Object.assign({}, ok, { ts: NaN })), /Tanggal/);
});

test('transfer antar dompet tidak dihitung sebagai pemasukan/pengeluaran', () => {
  let s = C.addWallet(base(), 'Bank', 'bank'); const bank = s.wallets[1].id, inc = cat(s, 'income', 'Gaji');
  s = add(s, { type: 'income', amount: 1000, categoryId: inc });
  s = C.addTransaction(s, { type: 'transfer', amount: 400, walletId: 'w-main', toWalletId: bank, ts: D(2026, 11, 6) }).state;
  assert.equal(C.walletBalance(s, 'w-main'), 600);
  assert.equal(C.walletBalance(s, bank), 400);
  assert.equal(C.totalBalance(s), 1000);
  const sum = C.sumByType(s.transactions);
  assert.deepEqual(sum, { income: 1000, expense: 0 });
  assert.throws(() => C.addTransaction(s, { type: 'transfer', amount: 1, walletId: bank, toWalletId: bank, ts: 1 }), /berbeda/);
});

test('hapus dompet: arsipkan bila punya riwayat, hapus bila kosong', () => {
  let s = C.addWallet(base(), 'Bank', 'bank'); const bank = s.wallets[1].id, inc = cat(s, 'income', 'Gaji');
  let r = C.removeWallet(s, bank); assert.equal(r.archived, false); assert.equal(r.state.wallets.length, 1);
  s = add(s, { type: 'income', amount: 10, walletId: bank, categoryId: inc });
  r = C.removeWallet(s, bank); assert.equal(r.archived, true);
  assert.equal(r.state.transactions.length, 1);
  assert.throws(() => C.removeWallet(r.state, 'w-main'), /Minimal/);
  assert.throws(() => C.addWallet(s, 'bank', 'bank'), /dipakai/);
});

test('kategori kustom: hapus memindahkan transaksi ke Lainnya', () => {
  let s = C.addCategory(base(), 'Kopi', 'expense'); const kopi = cat(s, 'expense', 'Kopi');
  s = add(s, { type: 'expense', amount: 20, categoryId: kopi });
  s = C.setBudget(s, kopi, 100);
  s = C.removeCategory(s, kopi);
  assert.equal(s.transactions[0].categoryId, cat(s, 'expense', 'Lainnya'));
  assert.equal(s.budgets.length, 0);
  assert.throws(() => C.removeCategory(s, cat(s, 'expense', 'Makanan')), /bawaan/);
  assert.throws(() => C.addCategory(s, 'makanan', 'expense'), /sudah ada/);
});

test('anggaran: level ok/warn/over dan peringatan', () => {
  assert.equal(C.budgetLevel(79, 100), 'ok'); assert.equal(C.budgetLevel(80, 100), 'warn');
  assert.equal(C.budgetLevel(100, 100), 'warn'); assert.equal(C.budgetLevel(101, 100), 'over'); assert.equal(C.budgetLevel(5, 0), 'none');
  let s = C.setBudget(base(), null, 1000); const ex = cat(s, 'expense', 'Makanan'); s = C.setBudget(s, ex, 500);
  const ref = D(2026, 11, 10), before = C.budgetStatus(s, ref);
  s = add(s, { type: 'expense', amount: 450, categoryId: ex });
  const after = C.budgetStatus(s, ref);
  assert.equal(after.total.level, 'ok'); assert.equal(after.categories[0].level, 'warn'); assert.equal(after.categories[0].pct, 90);
  assert.deepEqual(C.budgetAlerts(before, after), [{ scope: ex, level: 'warn' }]);
  s = add(s, { type: 'expense', amount: 100, categoryId: ex });
  assert.equal(C.budgetStatus(s, ref).categories[0].level, 'over');
  assert.equal(C.budgetStatus(s, D(2026, 12, 1)).total.spent, 0); // bulan lain
  s = C.setBudget(s, ex, 0); assert.equal(s.budgets.length, 1);
});

test('tabungan: tambah, kurangi, batas, persen, kebutuhan bulanan', () => {
  let g = { id: 'g', name: 'Laptop', target: 1000, deadline: D(2027, 1, 15), saved: 0, createdAt: 0, history: [] };
  g = C.goalAdjust(g, 400, 1, 'awal'); assert.equal(C.goalPct(g), 40);
  g = C.goalAdjust(g, -100, 2, ''); assert.equal(g.saved, 300);
  assert.throws(() => C.goalAdjust(g, -301, 3, ''), /melebihi/);
  assert.throws(() => C.goalAdjust(g, 0, 3, ''));
  assert.equal(C.goalMonthlyNeed(g, D(2026, 11, 7)), 350); // 700 / 2 bulan
  g = C.goalAdjust(g, 5000, 4, ''); assert.equal(C.goalPct(g), 100); assert.equal(g.history.length, 3);
});

test('transaksi berulang: bulanan di akhir bulan, idempotent, catch-up', () => {
  assert.equal(C.addInterval(D(2026, 1, 31), 'monthly', 31), D(2026, 2, 28));
  assert.equal(C.addInterval(D(2026, 2, 28), 'monthly', 31), D(2026, 3, 31));
  assert.equal(C.addInterval(D(2028, 2, 29), 'yearly', 29), D(2029, 2, 28));
  assert.equal(C.addInterval(D(2026, 12, 31), 'monthly', 31), D(2027, 1, 31));
  assert.equal(C.addInterval(D(2026, 11, 7), 'weekly', 7), D(2026, 11, 14));
  let s = base();
  s = C.addRecurring(s, { type: 'income', amount: 100, walletId: 'w-main', categoryId: cat(s, 'income', 'Gaji'), title: 'Gaji', freq: 'monthly', startTs: D(2026, 8, 25) });
  const r1 = C.applyRecurring(s, D(2026, 11, 7));
  assert.equal(r1.created, 3); // 25 Agu, 25 Sep, 25 Okt; 25 Nov belum jatuh tempo
  assert.equal(r1.state.transactions.length, 3);
  assert.equal(r1.state.recurring[0].nextTs, D(2026, 11, 25));
});

test('transaksi berulang: jumlah benar dan tidak dobel saat dijalankan ulang', () => {
  let s = base();
  s = C.addRecurring(s, { type: 'expense', amount: 50, walletId: 'w-main', categoryId: cat(s, 'expense', 'Tagihan'), title: 'Internet', freq: 'weekly', startTs: D(2026, 11, 1) });
  const a = C.applyRecurring(s, D(2026, 11, 20));
  assert.equal(a.created, 3); // 1, 8, 15 Nov
  const b = C.applyRecurring(a.state, D(2026, 11, 20));
  assert.equal(b.created, 0); assert.equal(b.state.transactions.length, 3);
  const c = C.applyRecurring(b.state, D(2026, 11, 22));
  assert.equal(c.created, 1); // 22 Nov
  // rule berhenti setelah endTs
  let e = C.addRecurring(base(), { type: 'expense', amount: 5, walletId: 'w-main', categoryId: cat(base(), 'expense', 'Makanan'), title: 'x', freq: 'daily', startTs: D(2026, 11, 1), endTs: D(2026, 11, 3, 23, 0) });
  const f = C.applyRecurring(e, D(2026, 11, 30));
  assert.equal(f.created, 3); assert.equal(f.state.recurring[0].active, false);
});

test('tagihan: status & tandai lunas mencatat pengeluaran', () => {
  let s = C.addBill(base(), { name: 'Listrik', amount: 300, dueDay: 10, remindDays: 3 });
  const b = s.bills[0];
  assert.equal(C.billStatus(b, D(2026, 11, 5)).status, 'upcoming');
  assert.equal(C.billStatus(b, D(2026, 11, 8)).status, 'soon');
  assert.equal(C.billStatus(b, D(2026, 11, 12)).status, 'overdue');
  s = C.markBillPaid(s, b.id, D(2026, 11, 8), 'w-main');
  assert.equal(C.billStatus(s.bills[0], D(2026, 11, 9)).status, 'paid');
  assert.equal(s.transactions.length, 1); assert.equal(C.totalBalance(s), -300);
  assert.equal(C.billStatus(s.bills[0], D(2026, 12, 1)).status, 'upcoming'); // bulan baru
  assert.equal(C.billDueDate({ dueDay: 31 }, D(2026, 2, 1)), new Date(2026, 1, 28).getTime());
});

test('rentang periode: hari, minggu (Senin), bulan, tahun', () => {
  const sun = D(2026, 11, 8); // Minggu
  const [ws, we] = C.periodRange('week', sun);
  assert.equal(ws, new Date(2026, 10, 2).getTime()); assert.equal(we, new Date(2026, 10, 9).getTime());
  assert.deepEqual(C.periodRange('month', D(2026, 12, 15)), [new Date(2026, 11, 1).getTime(), new Date(2027, 0, 1).getTime()]);
  assert.equal(C.periodRange('year', sun)[0], new Date(2026, 0, 1).getTime());
  assert.equal(new Date(C.shiftPeriod('month', D(2026, 1, 31), -1)).getMonth(), 11);
  assert.equal(new Date(C.shiftPeriod('month', D(2026, 3, 31), -1)).getMonth(), 1);
});

test('laporan bulanan, tahunan, dan perbandingan periode', () => {
  let s = base(); const ex = cat(s, 'expense', 'Makanan'), tr = cat(s, 'expense', 'Transportasi'), inc = cat(s, 'income', 'Gaji');
  s = add(s, { type: 'income', amount: 1000, categoryId: inc, ts: D(2026, 10, 1) });
  s = add(s, { type: 'expense', amount: 200, categoryId: ex, ts: D(2026, 10, 3) });
  s = add(s, { type: 'income', amount: 2000, categoryId: inc, ts: D(2026, 11, 1) });
  s = add(s, { type: 'expense', amount: 300, categoryId: ex, ts: D(2026, 11, 3) });
  s = add(s, { type: 'expense', amount: 100, categoryId: tr, ts: D(2026, 11, 4) });
  const m = C.monthlyReport(s, D(2026, 11, 15));
  assert.equal(m.income, 2000); assert.equal(m.expense, 400); assert.equal(m.net, 1600);
  assert.equal(m.expenseChangePct, 100); assert.equal(m.byExpense[0].name, 'Makanan'); assert.equal(Math.round(m.byExpense[0].pct), 75);
  const y = C.yearlyReport(s, 2026);
  assert.equal(y.months[9].income, 1000); assert.equal(y.months[10].expense, 400); assert.equal(y.income, 3000); assert.equal(y.expense, 600);
  const cmp = C.periodCompare(s, 'month', D(2026, 11, 15));
  assert.equal(cmp.expenseDelta, 200); assert.equal(cmp.expensePct, 100);
  assert.equal(C.dayTotals(s, 2026, 10)[3].expense, 300);
  assert.equal(C.dailyBars(s, D(2026, 11, 4), 7).length, 7);
});

test('pencarian, filter, dan pengurutan transaksi', () => {
  let s = base(); const ex = cat(s, 'expense', 'Makanan'), inc = cat(s, 'income', 'Gaji');
  s = add(s, { type: 'expense', amount: 50, categoryId: ex, title: 'Nasi goreng', ts: D(2026, 11, 1) });
  s = add(s, { type: 'expense', amount: 10, categoryId: ex, title: 'Teh', note: 'dingin', ts: D(2026, 11, 2) });
  s = add(s, { type: 'income', amount: 500, categoryId: inc, title: 'Gaji', ts: D(2026, 11, 3) });
  assert.equal(C.queryTransactions(s, { q: 'NASI' }).length, 1);
  assert.equal(C.queryTransactions(s, { q: 'dingin' }).length, 1);
  assert.equal(C.queryTransactions(s, { q: 'makanan' }).length, 2);
  assert.equal(C.queryTransactions(s, { type: 'income' }).length, 1);
  assert.deepEqual(C.queryTransactions(s, { sort: 'amount-desc' }).map(t => t.amount), [500, 50, 10]);
  assert.deepEqual(C.queryTransactions(s, { sort: 'date-asc' }).map(t => t.amount), [50, 10, 500]);
  assert.equal(C.queryTransactions(s, { from: D(2026, 11, 2), to: D(2026, 11, 3) }).length, 1);
});

test('migrasi dari C01N 0.4 menjaga semua transaksi dan anggaran', () => {
  const old = [
    { id: 1, title: 'Gaji', amount: 5000000, type: 'income', date: D(2026, 10, 25), category: 'Gaji', note: '' },
    { id: 2, title: 'Kopi', amount: 20000, type: 'expense', date: D(2026, 10, 26), category: 'Ngopi', note: 'pagi' },
    { id: 3, title: 'Rusak', amount: -5, type: 'expense', date: 1, category: 'Makanan' }
  ];
  const s = C.fromLegacy(old, { monthlyBudget: 1500000, hideBalance: true }, D(2026, 11, 7));
  assert.equal(s.transactions.length, 2); assert.equal(C.totalBalance(s), 4980000);
  assert.equal(C.categoryName(s, s.transactions[1].categoryId), 'Ngopi');
  assert.equal(s.budgets[0].limit, 1500000); assert.equal(s.budgets[0].categoryId, null);
  assert.equal(s.settings.onboarded, true); assert.equal(s.settings.hideBalance, true);
  assert.equal(C.fromLegacy([], {}, 1).settings.onboarded, false);
  // hasil migrasi stabil setelah dinormalisasi ulang
  assert.equal(C.normalizeState(JSON.parse(JSON.stringify(s))).transactions.length, 2);
});

test('normalizeState membuang data rusak tanpa crash', () => {
  const s = C.normalizeState({ settings: { currency: 'XXX', theme: 'neon' }, wallets: [], transactions: [{ type: 'income', amount: 'abc' }, null, { type: 'income', amount: 5, ts: 1, walletId: 'ghost', categoryId: 'x' }], budgets: [{ categoryId: 'nope', limit: 5 }], goals: [{ id: 'g', target: -1 }] });
  assert.equal(s.settings.currency, 'IDR'); assert.equal(s.settings.theme, 'system');
  assert.equal(s.transactions.length, 0); assert.equal(s.wallets.length, 1); assert.equal(s.budgets.length, 0); assert.equal(s.goals.length, 0);
  assert.doesNotThrow(() => C.normalizeState(null)); assert.doesNotThrow(() => C.normalizeState('x'));
});

test('CSV: escape, kutip, dan proteksi formula injection', () => {
  let s = base(); const ex = cat(s, 'expense', 'Makanan');
  s = add(s, { type: 'expense', amount: 1234, categoryId: ex, title: '=HYPERLINK("x")', note: 'a, "b"\nc' });
  const csv = C.toCSV(s, s.transactions);
  const lines = csv.split('\r\n');
  assert.equal(lines[0].split(',')[0], 'Tanggal');
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"a, ""b"" c"')); // baris baru di catatan dinormalisasi jadi spasi
  assert.ok(csv.includes(',1234,IDR,'));
});

test('backup: roundtrip, backup lama 0.4, dan gabung tanpa duplikat', () => {
  let s = base(); const inc = cat(s, 'income', 'Gaji');
  s = add(s, { type: 'income', amount: 100, categoryId: inc });
  const back = C.parseBackup(C.backupPayload(s), 1);
  assert.equal(back.transactions.length, 1); assert.equal(C.totalBalance(back), 100);
  const legacy = C.parseBackup(JSON.stringify({ app: 'C01N', version: '0.4', transactions: [{ id: 9, title: 'a', amount: 10, type: 'income', date: 5, category: 'Gaji' }], settings: {} }), 1);
  assert.equal(legacy.transactions.length, 1);
  assert.throws(() => C.parseBackup('{bukan json', 1), /rusak/);
  assert.throws(() => C.parseBackup('{"x":1}', 1), /tidak dikenali/);
  const m = C.mergeStates(s, back); assert.equal(m.added, 0); assert.equal(m.state.transactions.length, 1);
  const m2 = C.mergeStates(base(), back); assert.equal(m2.added, 1);
});

test('integritas: jumlah saldo dompet = pemasukan - pengeluaran', () => {
  let s = C.addWallet(base(), 'Bank', 'bank'); const bank = s.wallets[1].id, inc = cat(s, 'income', 'Gaji'), ex = cat(s, 'expense', 'Makanan');
  let seed = 7; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
  for (let i = 0; i < 200; i++) {
    const k = rnd(3), w = rnd(2) ? 'w-main' : bank, amt = 1 + rnd(100000);
    if (k === 0) s = add(s, { type: 'income', amount: amt, walletId: w, categoryId: inc, ts: D(2026, 1 + rnd(11), 1 + rnd(27)) });
    else if (k === 1) s = add(s, { type: 'expense', amount: amt, walletId: w, categoryId: ex, ts: D(2026, 1 + rnd(11), 1 + rnd(27)) });
    else s = C.addTransaction(s, { type: 'transfer', amount: amt, walletId: w, toWalletId: w === bank ? 'w-main' : bank, ts: D(2026, 1 + rnd(11), 1 + rnd(27)) }).state;
    if (i % 17 === 0) s = C.deleteTransaction(s, s.transactions[rnd(s.transactions.length)].id);
  }
  const t = C.sumByType(s.transactions);
  assert.equal(C.totalBalance(s), t.income - t.expense);
});

test('deret batang per periode dan foto profil tervalidasi', () => {
  let s = base(); const ex = cat(s, 'expense', 'Makanan');
  s = add(s, { type: 'expense', amount: 70, categoryId: ex, ts: D(2026, 11, 4) }); // Rabu
  const w = C.bucketSeries(s, 'week', D(2026, 11, 5));
  assert.equal(w.length, 7); assert.equal(w[0].label, 'Sen'); assert.equal(w[2].expense, 70);
  assert.equal(C.bucketSeries(s, 'month', D(2026, 2, 10)).length, 28);
  assert.equal(C.bucketSeries(s, 'year', D(2026, 2, 10))[10].expense, 70);
  assert.equal(C.bucketSeries(s, 'day', 1).length, 0);
  assert.equal(C.normalizeState({ settings: { photo: 'data:image/jpeg;base64,AAAA' } }).settings.photo, 'data:image/jpeg;base64,AAAA');
  assert.equal(C.normalizeState({ settings: { photo: 'javascript:alert(1)' } }).settings.photo, '');
});
