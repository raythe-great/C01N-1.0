# C01N 1.0 — Pengelola Keuangan Pribadi

Android (Kotlin + WebView lokal). Offline, tanpa akun, tanpa server, tanpa permission internet.

## Isi folder
```
.github/workflows/build.apk.yml   build + tes + release
app/build.gradle.kts              konfigurasi (minSdk 26, targetSdk 35, v1.0.0)
app/proguard-rules.pro            aturan R8
app/src/main/AndroidManifest.xml  hanya permission USE_BIOMETRIC
app/src/main/java/com/C01N/app/   MainActivity, SecureStore, PinVault, BackupCrypto
app/src/main/assets/www/          index.html, style.css, app.js, js/{core,store,ui-kit,security,pages}.js
app/src/main/res/                 ikon, tema
app/src/test/                     unit test keamanan (JUnit)
tests/core.test.js                unit test logika keuangan (Node)
```

## Cara mengganti file (dari HP)
1. Di GitHub, **hapus semua isi repository lama** (atau file `app/`, `.github/`, `build.gradle.kts`).
2. Upload **seluruh isi** folder `C01N` ini (termasuk folder `.github`).
3. Buka **Actions → Build C01N APK → Run workflow** → `debug`.

## PENTING sebelum memasang versi ini
Tanda tangan APK baru berbeda dengan APK lama, jadi Android meminta aplikasi lama dihapus dulu.
**Di C01N 0.4: Pengaturan → Ekspor backup, simpan file JSON-nya.** Setelah memasang C01N 1.0, buka
Pengaturan → *Pulihkan dari backup* dan pilih file itu. (Bila 0.4 dipasang ulang di atas versi lama dengan tanda tangan sama, data lama otomatis dimigrasi.)

## APK release bertanda tangan
Kunci **tidak pernah** disimpan di repository (`.gitignore` memblokir `*.jks`). Simpan di GitHub Secrets:

1. Buat kunci (sekali saja, mis. di Termux: `pkg install openjdk-17`):
   `keytool -genkeypair -v -keystore c01n-release.jks -alias c01n -keyalg RSA -keysize 4096 -validity 10000`
2. Ubah ke teks: `base64 -w0 c01n-release.jks` lalu salin hasilnya.
3. Repo → **Settings → Secrets and variables → Actions → New repository secret**, buat empat secret:
   `C01N_KEYSTORE_BASE64` (hasil langkah 2), `C01N_KEYSTORE_PASSWORD`, `C01N_KEY_ALIAS` (`c01n`), `C01N_KEY_PASSWORD`.
4. **Simpan file `.jks` dan passwordnya di tempat aman di luar repo.** Bila hilang, aplikasi tidak bisa diperbarui.
5. Actions → Run workflow → `release`. Workflow menolak build bila secret kurang, lalu memverifikasi tanda tangan dengan `apksigner`.

Catatan Play Protect: APK di luar Play Store bisa tetap mendapat peringatan "aplikasi tidak dikenal". Itu dipengaruhi
reputasi distribusi, bukan hanya konfigurasi. Yang sudah dilakukan: release bertanda tangan sah, tanpa debug, tanpa permission berisiko, R8 aktif.

## Keamanan (model sebenarnya)
- Data disimpan di file terenkripsi AES-256-GCM; kunci ada di Android Keystore (tidak bisa diekspor).
- PIN 6 digit: hanya hash PBKDF2-HMAC-SHA256 + salt yang disimpan. Percobaan salah dan jeda (30 dtk → 1 → 5 → 15 mnt) tersimpan terenkripsi sehingga tidak bisa direset dengan menutup aplikasi.
- Saat terkunci, native menolak memberikan data ke WebView. Layar dikosongkan saat auto-lock.
- Biometrik memakai `android.hardware.biometrics.BiometricPrompt` (Android 9+). Di Android 8, PIN saja.
- Backup dienkripsi kata sandi pilihan pengguna (PBKDF2 150.000 iterasi → AES-GCM). Kata sandi tidak bisa dipulihkan.
- Batasan jujur: kunci Keystore terikat perangkat, bukan PIN. PIN menjaga akses lewat aplikasi; penyerang dengan akses root penuh berada di luar model ancaman. Jeda PIN memakai jam sistem. CSV/PDF tidak terenkripsi.
- WebView dibatasi ke aset lokal, request jaringan diblokir, `allowBackup=false`, `FLAG_SECURE` (bisa dimatikan).

## Fitur
Dashboard, Pengeluaran (harian/mingguan/bulanan/tahunan + perbandingan), Pemasukan, Anggaran total & per kategori (peringatan 80% & terlampaui),
Tabungan (target, tenggat, tambah/kurangi dana, riwayat), Profil, Pengaturan, banyak dompet + transfer, kategori sendiri,
transaksi berulang, pengingat tagihan (di dalam aplikasi), kalender, laporan bulanan/tahunan, ekspor CSV, laporan PDF (dialog cetak → Simpan sebagai PDF),
backup/restore terenkripsi, onboarding, tema terang/gelap, animasi + skeleton shimmer (hormati "kurangi animasi").
Tidak dibuat: ekspor Excel (.xlsx; CSV terbuka di Excel), notifikasi sistem di luar aplikasi (butuh permission tambahan).

## Pengujian
- `node --test tests/core.test.js` — 21 tes logika keuangan.
- `gradle testDebugUnitTest` — 13 tes PIN, lockout, enkripsi backup.
