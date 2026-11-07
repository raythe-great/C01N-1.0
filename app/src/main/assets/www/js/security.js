/* PIN, biometrik, dan penguncian. Verifikasi PIN & penyimpanan hash dilakukan di sisi native;
   JavaScript tidak pernah menyimpan PIN. Saat terkunci, native menolak memberikan data. */
(function () {
  'use strict';
  const { $, esc, icon, toast } = window.UI;
  let activePrompt = null;

  /* Papan PIN 6 digit. validate(pin) -> {ok:true} | {ok:false,msg,lockoutMs}. Mengembalikan PIN atau null (batal). */
  function pinPrompt(o) {
    return new Promise(resolve => {
      if (activePrompt) activePrompt.dispose(null);
      const root = document.createElement('div'); root.className = 'fullscreen'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      root.innerHTML = '<div class="pin"><div class="logo">C</div><h1>' + esc(o.title) + '</h1><p class="pin-sub">' + esc(o.subtitle || '') + '</p>' +
        '<div class="pin-dots" aria-live="polite">' + '<i></i>'.repeat(6) + '</div><div class="pin-err" role="alert"></div>' +
        '<div class="keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button data-k="' + n + '" aria-label="' + n + '">' + n + '</button>').join('') +
        (o.biometric ? '<button class="ghost" data-bio aria-label="Gunakan biometrik">' + icon('finger') + '</button>' : (o.cancellable ? '<button class="ghost" data-cancel>Batal</button>' : '<button class="ghost" disabled></button>')) +
        '<button data-k="0" aria-label="0">0</button><button class="ghost" data-del aria-label="Hapus">' + icon('backspace') + '</button></div></div>';
      $('#overlay').append(root);
      let value = '', busy = false, timer = null, locked = 0;
      const dots = root.querySelectorAll('.pin-dots i'), err = root.querySelector('.pin-err'), keys = root.querySelectorAll('.keypad button');
      const paint = () => dots.forEach((d, i) => d.classList.toggle('f', i < value.length));
      const setKeys = off => keys.forEach(k => { if (k.dataset.k !== undefined || k.hasAttribute('data-del')) k.disabled = off; });
      function dispose(result) { clearInterval(timer); root.remove(); window.C01NNative.onBiometric = null; activePrompt = null; resolve(result); }
      function countdown(ms) {
        locked = Date.now() + ms; setKeys(true);
        const tick = () => { const left = Math.ceil((locked - Date.now()) / 1000); if (left <= 0) { clearInterval(timer); err.textContent = ''; setKeys(false); } else err.textContent = 'Terlalu banyak percobaan. Coba lagi dalam ' + (left >= 60 ? Math.ceil(left / 60) + ' menit' : left + ' detik') + '.'; };
        clearInterval(timer); tick(); timer = setInterval(tick, 1000);
      }
      async function submit() {
        busy = true; const pin = value;
        let res = { ok: true };
        try { if (o.validate) res = await o.validate(pin); } catch (_) { res = { ok: false, msg: 'Terjadi kesalahan. Coba lagi.' }; }
        if (res.ok !== false) { dispose(pin); return; }
        const d = root.querySelector('.pin-dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
        value = ''; paint(); err.textContent = res.msg || 'PIN salah.'; busy = false;
        if (res.lockoutMs > 0) countdown(res.lockoutMs);
        if (navigator.vibrate) { try { navigator.vibrate(60); } catch (_) { } }
      }
      root.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.hasAttribute('data-cancel')) return dispose(null);
        if (b.hasAttribute('data-bio')) return window.Native.authBiometric();
        if (busy) return;
        if (b.hasAttribute('data-del')) { value = value.slice(0, -1); paint(); err.textContent = ''; return; }
        if (b.dataset.k !== undefined && value.length < 6) { value += b.dataset.k; paint(); err.textContent = ''; if (value.length === 6) submit(); }
      });
      document.addEventListener('keydown', function onKey(e) {
        if (!root.isConnected) return document.removeEventListener('keydown', onKey);
        if (/^\d$/.test(e.key)) root.querySelector('[data-k="' + e.key + '"]').click(); else if (e.key === 'Backspace') root.querySelector('[data-del]').click();
      });
      window.C01NNative.onBiometric = ok => { if (ok) dispose('__biometric__'); else if (o.biometric) err.textContent = ''; };
      activePrompt = { dispose, cancellable: !!o.cancellable };
      if (o.lockoutMs > 0) countdown(o.lockoutMs);
      if (o.biometric && !(o.lockoutMs > 0)) setTimeout(() => window.Native.authBiometric(), 350);
    });
  }

  const verifyWith = fn => async pin => { const r = fn(pin); return r.ok ? { ok: true } : { ok: false, lockoutMs: r.lockoutMs, msg: r.lockoutMs > 0 ? '' : 'PIN salah. Sisa percobaan: ' + r.attemptsLeft }; };

  const Security = {
    status: () => window.Native.status(),
    /* Layar kunci. Selesai ketika native menandai aplikasi terbuka. */
    async unlock() {
      for (;;) {
        const st = window.Native.status();
        if (!st.pinEnabled || st.unlocked) return;
        await pinPrompt({ title: 'Buka C01N', subtitle: 'Masukkan PIN Anda', biometric: st.biometricEnabled && st.biometricAvailable, lockoutMs: st.lockoutMs, validate: verifyWith(window.Native.verifyPin) });
      }
    },
    /* Minta PIN saat ini untuk tindakan sensitif. Mengembalikan PIN atau null. */
    async confirmPin(title, subtitle) {
      const st = window.Native.status(); if (!st.pinEnabled) return '';
      return pinPrompt({ title, subtitle: subtitle || 'Masukkan PIN untuk melanjutkan', cancellable: true, lockoutMs: st.lockoutMs, validate: verifyWith(window.Native.verifyPin) });
    },
    /* Buat PIN baru dengan konfirmasi. */
    async createPin() {
      for (;;) {
        const a = await pinPrompt({ title: 'Buat PIN', subtitle: 'Pilih 6 digit angka', cancellable: true });
        if (a === null) return false;
        const b = await pinPrompt({ title: 'Konfirmasi PIN', subtitle: 'Masukkan PIN yang sama sekali lagi', cancellable: true, validate: async p => p === a ? { ok: true } : { ok: false, msg: 'PIN tidak sama. Ulangi.' } });
        if (b === null) return false;
        if (window.Native.setPin(a)) { toast('PIN berhasil diaktifkan'); return true; }
        toast('Gagal mengaktifkan PIN', 'bad'); return false;
      }
    },
    async changePin() {
      const old = await pinPrompt({ title: 'PIN saat ini', subtitle: 'Masukkan PIN lama', cancellable: true, lockoutMs: window.Native.status().lockoutMs, validate: verifyWith(window.Native.verifyPin) });
      if (old === null) return false;
      const a = await pinPrompt({ title: 'PIN baru', subtitle: 'Pilih 6 digit angka', cancellable: true });
      if (a === null) return false;
      const b = await pinPrompt({ title: 'Konfirmasi PIN baru', subtitle: 'Masukkan PIN baru sekali lagi', cancellable: true, validate: async p => p === a ? { ok: true } : { ok: false, msg: 'PIN tidak sama. Ulangi.' } });
      if (b === null) return false;
      const r = window.Native.changePin(old, a);
      if (r.ok) { toast('PIN berhasil diubah'); return true; }
      toast('PIN gagal diubah', 'bad'); return false;
    },
    async disablePin() {
      const pin = await pinPrompt({ title: 'Nonaktifkan PIN', subtitle: 'Masukkan PIN untuk memverifikasi', cancellable: true, lockoutMs: window.Native.status().lockoutMs, validate: verifyWith(window.Native.disablePin) });
      if (pin === null) return false;
      toast('PIN dinonaktifkan'); return true;
    },
    cancelPrompt() { if (activePrompt && activePrompt.cancellable) { activePrompt.dispose(null); return true; } return false; },
    hasPrompt: () => !!activePrompt
  };

  window.C01NNative = window.C01NNative || {};
  window.Security = Security;
})();
