/* Bootstrap C01N: kunci → muat data → onboarding → tampilan utama. */
(function () {
  'use strict';
  const C = window.C01NCore, U = window.UI, Store = window.Store, Native = window.Native, Security = window.Security, Pages = window.Pages;
  const { $, esc, icon, toast } = U;
  let starting = false;

  function showError(message) {
    $('#boot').hidden = true; $('#shell').hidden = true;
    const e = $('#bootError'); e.hidden = false;
    e.innerHTML = icon('warn') + '<h2>Data tidak dapat dibuka</h2><p>' + esc(message) + '</p><button class="btn primary" id="btnRetry">Coba lagi</button><button class="btn danger" id="btnReset">Mulai ulang</button>';
    $('#btnRetry').onclick = () => start();
    $('#btnReset').onclick = async () => {
      if (await U.confirmBox('Mulai ulang?', 'Data terenkripsi yang tidak terbaca akan dihapus. Setelah itu Anda dapat memulihkan dari file backup.', 'Hapus dan mulai ulang', true)) { Native.wipeAll(); start(); }
    };
  }

  /* Penyambutan pengguna baru: nama, mata uang, saldo awal opsional, lalu tawaran PIN. */
  function onboarding() {
    return new Promise(resolve => {
      const root = document.createElement('div'); root.className = 'fullscreen'; $('#overlay').append(root);
      let step = 0;
      const dots = n => '<div class="steps">' + [0, 1, 2].map(i => '<i class="' + (i === n ? 'on' : '') + '"></i>').join('') + '</div>';
      const point = (ic, t, s) => '<div class="point">' + icon(ic) + '<div><b>' + t + '</b><div class="muted">' + s + '</div></div></div>';
      function render() {
        if (step === 0) root.innerHTML = '<div class="ob">' + dots(0) + '<div class="logo">C</div><h1>Selamat datang di C01N</h1><p>Pengelola keuangan pribadi yang rapi, aman, dan bekerja tanpa internet.</p>' +
          point('shield', 'Privasi lebih dulu', 'Tanpa akun, tanpa server, tanpa pelacak. Data terenkripsi di perangkat Anda.') + point('wallet', 'Semua tercatat', 'Dompet, anggaran, tabungan, tagihan, dan laporan dalam satu tempat.') + point('lock', 'Dikunci sesuai keinginan', 'Lindungi dengan PIN dan sidik jari.') +
          '<button class="btn primary block" data-ob="next" style="margin-top:18px">Mulai</button></div>';
        else if (step === 1) {
          root.innerHTML = '<div class="ob">' + dots(1) + '<h1>Kenalan dulu</h1><p>Semua ini bisa diubah kapan saja.</p><form novalidate><label class="f" for="ob_n">Nama panggilan (opsional)</label><input class="in" id="ob_n" name="name" maxlength="40" autocomplete="off"><label class="f" for="ob_c">Mata uang</label><select class="in" id="ob_c" name="cur">' +
            Object.keys(C.CURRENCIES).map(k => '<option value="' + k + '">' + esc(C.CURRENCIES[k].name) + '</option>').join('') + '</select><label class="f" for="ob_b">Saldo awal dompet utama (opsional)</label><input class="in" id="ob_b" name="bal" inputmode="decimal" placeholder="0" autocomplete="off"><div class="err" role="alert"></div><button class="btn primary block" type="submit" style="margin-top:6px">Lanjut</button></form></div>';
          root.querySelector('form').onsubmit = ev => {
            ev.preventDefault(); const f = ev.target, raw = f.elements.bal.value.trim(), cur = f.elements.cur.value;
            const bal = raw ? C.parseAmount(raw, cur) : 0; if (raw && !bal) { f.querySelector('.err').textContent = 'Saldo awal tidak valid.'; return; }
            try {
              let st = Store.state; st = Object.assign({}, st, { settings: Object.assign({}, st.settings, { name: C.cleanText(f.elements.name.value, 40), currency: cur, onboarded: true }) });
              if (bal) st = C.addTransaction(st, { type: 'income', amount: bal, ts: Date.now(), walletId: st.wallets[0].id, categoryId: st.categories.find(c => c.type === 'income' && c.name === 'Lainnya').id, title: 'Saldo awal' }).state;
              Store.commit(st); step = 2; render();
            } catch (e) { f.querySelector('.err').textContent = e.message; }
          };
        } else root.innerHTML = '<div class="ob">' + dots(2) + '<div class="logo">' + icon('lock') + '</div><h1>Kunci aplikasi?</h1><p>PIN 6 digit melindungi catatan keuangan Anda. Anda bisa mengaktifkannya nanti di Pengaturan.</p><button class="btn primary block" data-ob="pin">Aktifkan PIN</button><button class="btn ghost block" data-ob="done" style="margin-top:10px">Lewati untuk sekarang</button></div>';
      }
      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-ob]'); if (!b) return;
        if (b.dataset.ob === 'next') { step = 1; render(); }
        else if (b.dataset.ob === 'pin') {
          if (await Security.createPin()) { const n = Native.status(); if (n.biometricAvailable && await U.confirmBox('Aktifkan sidik jari?', 'Buka C01N dengan biometrik. PIN tetap menjadi cadangan.', 'Aktifkan')) Native.setBiometric(true); root.remove(); resolve(); }
        } else if (b.dataset.ob === 'done') { root.remove(); resolve(); }
      });
      render();
    });
  }

  async function start() {
    if (starting) return; starting = true;
    try {
      $('#bootError').hidden = true; $('#shell').hidden = true;
      const st = Native.status();
      $('#boot').hidden = !!(st.pinEnabled && !st.unlocked);
      await Security.unlock();
      $('#boot').hidden = false;
      try { Store.load(); } catch (err) { showError(err && err.message === 'unreadable' ? 'Data terenkripsi tidak bisa dibaca. Ini dapat terjadi bila pengaturan keamanan perangkat berubah. Coba lagi, atau mulai ulang lalu pulihkan dari backup.' : 'Terjadi kesalahan saat memuat data. Data Anda tidak diubah. Coba lagi.'); return; }
      U.applyTheme();
      if (!Store.state.settings.onboarded) { $('#boot').hidden = true; await onboarding(); }
      $('#boot').hidden = true; $('#shell').hidden = false; Pages.Nav.setTab('home');
      if (Store.recurringCreated) toast(Store.recurringCreated + ' transaksi berulang dicatat otomatis');
    } finally { starting = false; }
  }

  /* Penguncian dari native (auto-lock): hapus semua isi layar dari memori tampilan lalu minta PIN. */
  function lockNow() {
    U.Layers.slice().forEach(l => l.close());
    Pages.Nav.clear(); Store.clear();
    document.querySelectorAll('.page').forEach(p => { p.innerHTML = ''; });
    $('#shell').hidden = true; $('#boot').hidden = true;
    const stale = document.querySelector('#overlay .fullscreen'); if (stale && !Security.hasPrompt()) stale.remove();
    start();
  }

  window.C01NNative.onLock = lockNow;
  window.C01NNative.onBack = () => Pages.Nav.back();
  Pages.onReset = () => { start(); };
  window.addEventListener('error', e => { try { toast('Terjadi kesalahan: ' + (e.message || 'tidak diketahui'), 'bad'); } catch (_) { } });
  start();
})();
