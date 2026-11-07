/* Lapisan penyimpanan & jembatan native.
   Di aplikasi: data terenkripsi (Android Keystore) lewat C01NBridge. Di browser biasa (hanya untuk pengembangan)
   dipakai localStorage sebagai cadangan agar UI bisa diuji. */
(function () {
  'use strict';
  const C = window.C01NCore, B = window.C01NBridge;
  const LEGACY_TX = 'c01n_transactions_v2', LEGACY_SET = 'c01n_settings_v1', WEB_KEY = 'c01n_v3_web';

  const Native = {
    available: !!B,
    status() {
      if (!B) return { native: false, pinEnabled: false, unlocked: true, lockoutMs: 0, biometricAvailable: false, biometricEnabled: false, autoLockMs: 60000, secureScreen: true, version: 'web' };
      try { return JSON.parse(B.status()); } catch (_) { return { native: true, pinEnabled: true, unlocked: false, lockoutMs: 0, biometricAvailable: false, biometricEnabled: false, autoLockMs: 60000, secureScreen: true, version: '?' }; }
    },
    verifyPin: pin => B ? JSON.parse(B.verifyPin(pin)) : { ok: true, lockoutMs: 0, attemptsLeft: 5 },
    setPin: pin => B ? B.setPin(pin) : false,
    changePin: (o, n) => JSON.parse(B.changePin(o, n)),
    disablePin: pin => JSON.parse(B.disablePin(pin)),
    setBiometric: on => B ? B.setBiometric(on) : false,
    authBiometric: () => { if (B) B.authBiometric(); },
    setAutoLock: ms => B ? B.setAutoLock(ms) : false,
    setSecureScreen: on => B ? B.setSecureScreen(on) : false,
    wipeAll: () => { if (B) return B.wipeAll(); localStorage.removeItem(WEB_KEY); return true; },
    encryptBackup(plain, pass) { return B ? parseReply(B.encryptBackup(plain, pass)) : { ok: false, error: 'native' }; },
    decryptBackup(env, pass) { return B ? parseReply(B.decryptBackup(env, pass)) : { ok: false, error: 'native' }; },
    isEncryptedBackup: t => B ? B.isEncryptedBackup(t) : /"format"\s*:\s*"c01n-backup"/.test(t),
    saveFile(name, mime, text) {
      if (B) { B.saveFile(name, mime, text); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.append(a); a.click(); a.remove();
    },
    printPage: title => { if (B) B.printPage(title); else window.print(); },
    setBars: (hex, lightIcons) => { if (B) B.setBars(hex, lightIcons); }
  };
  function parseReply(s) { s = String(s); return s.startsWith('OK:') ? { ok: true, data: s.slice(3) } : { ok: false, error: s.slice(4) }; }

  function readRaw() {
    if (B) { const r = parseReply(B.loadData()); if (!r.ok) throw new Error(r.error); return r.data; }
    return localStorage.getItem(WEB_KEY) || '';
  }
  function writeRaw(text) { return B ? B.saveData(text) : (localStorage.setItem(WEB_KEY, text), true); }

  const listeners = [];
  const Store = {
    state: null,
    on(fn) { listeners.push(fn); },
    emit() { listeners.forEach(fn => { try { fn(Store.state); } catch (e) { console.error(e); } }); },
    /* Memuat data. Melempar error bila file ada tetapi tidak terbaca: data TIDAK ditimpa. */
    load() {
      const raw = readRaw();
      let st;
      if (raw) st = C.normalizeState(JSON.parse(raw));
      else {
        let legacy = null;
        try {
          const tx = JSON.parse(localStorage.getItem(LEGACY_TX) || 'null'), set = JSON.parse(localStorage.getItem(LEGACY_SET) || 'null');
          if (Array.isArray(tx) && tx.length) legacy = { tx, set };
        } catch (_) { legacy = null; }
        st = legacy ? C.fromLegacy(legacy.tx, legacy.set, Date.now()) : C.freshState(Date.now());
        if (!writeRaw(JSON.stringify(st))) throw new Error('Tidak bisa menulis penyimpanan');
        if (legacy) { // hapus salinan polos lama hanya setelah salinan terenkripsi terbukti terbaca kembali
          const back = readRaw();
          if (back && JSON.parse(back).transactions.length === st.transactions.length) { localStorage.removeItem(LEGACY_TX); localStorage.removeItem(LEGACY_SET); }
        }
      }
      const rec = C.applyRecurring(st, Date.now());
      if (rec.state !== st) { st = rec.state; if (!writeRaw(JSON.stringify(st))) throw new Error('Tidak bisa menulis penyimpanan'); }
      Store.state = st; Store.recurringCreated = rec.created;
      return st;
    },
    /* Simpan dulu, baru ubah memori: tampilan tidak pernah lebih maju daripada data di disk. */
    commit(next) {
      const n = C.normalizeState(next);
      if (!writeRaw(JSON.stringify(n))) throw new Error('Gagal menyimpan data. Coba lagi.');
      Store.state = n; Store.emit(); return n;
    },
    clear() { Store.state = null; },
    reset() { Native.wipeAll(); Store.state = C.freshState(Date.now()); writeRaw(JSON.stringify(Store.state)); Store.emit(); }
  };
  window.Native = Native; window.Store = Store;
})();
