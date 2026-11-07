package com.c01n.app

import android.app.Activity
import android.content.DialogInterface
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.SystemClock
import android.print.PrintAttributes
import android.print.PrintManager
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import java.io.ByteArrayInputStream
import java.io.IOException

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var store: SecureStore
    private lateinit var vault: PinVault

    @Volatile private var unlocked = false
    private var stoppedAt = 0L
    private var suppressLock = false
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingFile: ByteArray? = null
    private var bioCancel: CancellationSignal? = null

    companion object {
        private const val REQ_PICK = 4101
        private const val REQ_SAVE = 4102
        private const val ASSET_PREFIX = "file:///android_asset/"
        private const val DATA = "data"
        private const val SEC = "sec"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = SecureStore(this)
        vault = PinVault(object : PinVault.Storage {
            override fun read(): String? = try { store.read(SEC) } catch (_: Exception) { null }
            override fun write(text: String) { store.write(SEC, text) }
        })
        unlocked = !vault.isEnabled()
        applySecureFlag()
        window.decorView.setBackgroundColor(Color.rgb(15, 27, 33))
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            @Suppress("DEPRECATION")
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true            // hanya untuk migrasi data lama dari versi 0.4
                allowFileAccess = false             // aset (android_asset) tetap bisa dimuat
                allowContentAccess = false
                allowFileAccessFromFileURLs = false
                allowUniversalAccessFromFileURLs = false
                javaScriptCanOpenWindowsAutomatically = false
                setSupportZoom(false)
                builtInZoomControls = false
                setGeolocationEnabled(false)
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = true
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val url = request?.url?.toString() ?: return null
                    if (url.startsWith(ASSET_PREFIX) || url.startsWith("data:") || url.startsWith("blob:")) return null
                    return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView?,
                    callback: ValueCallback<Array<Uri>>?,
                    params: FileChooserParams?
                ): Boolean {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = callback
                    val accept = params?.acceptTypes?.firstOrNull { it.contains('/') } ?: "*/*"
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = accept
                    }
                    suppressLock = true
                    return try {
                        startActivityForResult(intent, REQ_PICK)
                        true
                    } catch (_: Exception) {
                        suppressLock = false
                        filePathCallback = null
                        false
                    }
                }
            }
            addJavascriptInterface(AppBridge(), "C01NBridge")
            setOnApplyWindowInsetsListener { v, insets ->
                val b = barInsets(insets)
                v.setPadding(b[0], b[1], b[2], b[3])
                insets
            }
        }
        setContentView(webView)
        webView.loadUrl(ASSET_PREFIX + "www/index.html")
    }

    @Suppress("DEPRECATION")
    private fun barInsets(insets: WindowInsets): IntArray =
        if (Build.VERSION.SDK_INT >= 30) {
            val i = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
            intArrayOf(i.left, i.top, i.right, i.bottom)
        } else {
            intArrayOf(
                insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                insets.systemWindowInsetRight, insets.systemWindowInsetBottom
            )
        }

    private fun applySecureFlag() {
        if (vault.secureScreen) window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }

    /* ---------- kunci otomatis ---------- */
    override fun onStop() {
        super.onStop()
        stoppedAt = SystemClock.elapsedRealtime()
    }

    override fun onStart() {
        super.onStart()
        if (suppressLock) { suppressLock = false; return }
        if (stoppedAt == 0L || !vault.isEnabled() || !unlocked) return
        if (SystemClock.elapsedRealtime() - stoppedAt >= vault.autoLockMs) lockNow()
    }

    private fun lockNow() {
        if (!vault.isEnabled()) return
        unlocked = false
        bioCancel?.cancel()
        webView.evaluateJavascript("window.C01NNative&&C01NNative.onLock()", null)
    }

    private fun sendBio(ok: Boolean, code: String) {
        webView.evaluateJavascript("window.C01NNative&&C01NNative.onBiometric($ok,'$code')", null)
    }

    private fun biometricAvailable(): Boolean {
        if (Build.VERSION.SDK_INT < 28) return false
        return try {
            when {
                Build.VERSION.SDK_INT >= 30 -> {
                    val bm = getSystemService(BiometricManager::class.java)
                    bm != null && bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
                }
                Build.VERSION.SDK_INT >= 29 -> {
                    val bm = getSystemService(BiometricManager::class.java)
                    bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS
                }
                else -> packageManager.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)
            }
        } catch (_: Exception) { false }
    }

    private fun showBiometric() {
        if (Build.VERSION.SDK_INT < 28) { sendBio(false, "unavailable"); return }
        val cancel = CancellationSignal().also { bioCancel = it }
        try {
            val prompt = BiometricPrompt.Builder(this)
                .setTitle("Buka C01N")
                .setSubtitle("Gunakan sidik jari atau biometrik perangkat")
                .setNegativeButton("Gunakan PIN", mainExecutor, DialogInterface.OnClickListener { _, _ -> sendBio(false, "cancel") })
                .build()
            prompt.authenticate(cancel, mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) {
                    if (vault.isEnabled() && vault.biometricEnabled) {
                        unlocked = true
                        sendBio(true, "")
                    } else sendBio(false, "disabled")
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence?) { sendBio(false, "error") }
            })
        } catch (_: Exception) {
            sendBio(false, "error")
        }
    }

    /* ---------- jembatan JS <-> native (hanya untuk halaman lokal) ---------- */
    inner class AppBridge {
        private fun verifyJson(r: PinVault.VerifyResult) =
            "{\"ok\":${r.ok},\"lockoutMs\":${r.lockoutMs},\"attemptsLeft\":${r.attemptsLeft}}"

        @JavascriptInterface
        fun status(): String =
            "{\"native\":true,\"pinEnabled\":${vault.isEnabled()},\"unlocked\":$unlocked,\"lockoutMs\":${vault.lockoutRemaining()}," +
                "\"biometricAvailable\":${biometricAvailable()},\"biometricEnabled\":${vault.biometricEnabled}," +
                "\"autoLockMs\":${vault.autoLockMs},\"secureScreen\":${vault.secureScreen},\"version\":\"1.0.0\"}"

        @JavascriptInterface
        fun verifyPin(pin: String): String {
            val r = vault.verify(pin)
            if (r.ok) unlocked = true
            return verifyJson(r)
        }

        /** Membuat PIN baru. Bila PIN sudah aktif, aplikasi harus sedang terbuka. */
        @JavascriptInterface
        fun setPin(pin: String): Boolean {
            if (vault.isEnabled() && !unlocked) return false
            val ok = vault.setPin(pin)
            if (ok) unlocked = true
            return ok
        }

        @JavascriptInterface
        fun changePin(oldPin: String, newPin: String): String {
            val r = vault.verify(oldPin)
            if (!r.ok) return verifyJson(r)
            if (!vault.setPin(newPin)) return verifyJson(PinVault.VerifyResult(false, 0, 0))
            return verifyJson(r)
        }

        @JavascriptInterface
        fun disablePin(pin: String): String {
            val r = vault.verify(pin)
            if (r.ok) { vault.disable(); unlocked = true }
            return verifyJson(r)
        }

        @JavascriptInterface
        fun setBiometric(on: Boolean): Boolean {
            if (!unlocked || !vault.isEnabled()) return false
            if (on && !biometricAvailable()) return false
            vault.setBiometric(on)
            return true
        }

        @JavascriptInterface
        fun authBiometric() {
            if (!vault.isEnabled() || !vault.biometricEnabled || !biometricAvailable()) { sendBio(false, "unavailable"); return }
            runOnUiThread { showBiometric() }
        }

        @JavascriptInterface
        fun setAutoLock(ms: Long): Boolean {
            if (!unlocked) return false
            vault.setAutoLock(ms)
            return true
        }

        @JavascriptInterface
        fun setSecureScreen(on: Boolean): Boolean {
            if (!unlocked) return false
            vault.setSecureScreen(on)
            runOnUiThread { applySecureFlag() }
            return true
        }

        /** "OK:<json>" (kosong bila belum ada data), atau "ERR:<alasan>". Ditolak saat terkunci. */
        @JavascriptInterface
        fun loadData(): String {
            if (!unlocked) return "ERR:locked"
            return try { "OK:" + (store.read(DATA) ?: "") } catch (_: Exception) { "ERR:unreadable" }
        }

        @JavascriptInterface
        fun saveData(json: String): Boolean = unlocked && store.write(DATA, json)

        @JavascriptInterface
        fun wipeAll(): Boolean {
            if (!unlocked) return false
            store.delete(DATA)
            vault.disable()
            vault.setAutoLock(60_000)
            vault.setSecureScreen(true)
            runOnUiThread { applySecureFlag() }
            return true
        }

        @JavascriptInterface
        fun encryptBackup(plain: String, pass: String): String {
            if (!unlocked) return "ERR:locked"
            return try { "OK:" + BackupCrypto.encrypt(plain, pass) } catch (e: IllegalArgumentException) { "ERR:" + (e.message ?: "invalid") } catch (_: Exception) { "ERR:failed" }
        }

        @JavascriptInterface
        fun decryptBackup(envelope: String, pass: String): String {
            if (!unlocked) return "ERR:locked"
            return try { "OK:" + BackupCrypto.decrypt(envelope, pass) } catch (_: Exception) { "ERR:wrong" }
        }

        @JavascriptInterface
        fun isEncryptedBackup(text: String): Boolean = BackupCrypto.isEnvelope(text)

        /** Menyimpan teks ke file pilihan pengguna lewat Storage Access Framework (tanpa permission storage). */
        @JavascriptInterface
        fun saveFile(name: String, mime: String, text: String) {
            if (!unlocked) return
            runOnUiThread {
                pendingFile = text.toByteArray(Charsets.UTF_8)
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mime
                    putExtra(Intent.EXTRA_TITLE, name)
                }
                suppressLock = true
                try {
                    startActivityForResult(intent, REQ_SAVE)
                } catch (_: Exception) {
                    suppressLock = false
                    pendingFile = null
                    Toast.makeText(this@MainActivity, "Tidak bisa membuka penyimpanan file", Toast.LENGTH_SHORT).show()
                }
            }
        }

        /** Cetak halaman aktif; di dialog cetak pilih "Simpan sebagai PDF". */
        @JavascriptInterface
        fun printPage(title: String) {
            if (!unlocked) return
            runOnUiThread {
                try {
                    val pm = getSystemService(PRINT_SERVICE) as PrintManager
                    pm.print(title, webView.createPrintDocumentAdapter(title), PrintAttributes.Builder().build())
                } catch (_: Exception) {
                    Toast.makeText(this@MainActivity, "Tidak bisa membuka layanan cetak", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun setBars(hex: String, lightIcons: Boolean) {
            runOnUiThread {
                try {
                    val c = Color.parseColor(hex)
                    window.decorView.setBackgroundColor(c)
                    window.statusBarColor = c
                    window.navigationBarColor = c
                    var flags = window.decorView.systemUiVisibility
                    val mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                    flags = if (lightIcons) flags and mask.inv() else flags or mask
                    window.decorView.systemUiVisibility = flags
                } catch (_: Exception) { }
            }
        }
    }

    @Deprecated("Deprecated in Android API; retained for broad device compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_PICK) {
            val uri = data?.data
            filePathCallback?.onReceiveValue(if (resultCode == RESULT_OK && uri != null) arrayOf(uri) else null)
            filePathCallback = null
        } else if (requestCode == REQ_SAVE) {
            val uri = data?.data
            val bytes = pendingFile
            pendingFile = null
            if (resultCode == RESULT_OK && uri != null && bytes != null) {
                try {
                    contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes) }
                    Toast.makeText(this, "File berhasil disimpan", Toast.LENGTH_LONG).show()
                } catch (_: IOException) {
                    Toast.makeText(this, "Gagal menyimpan file", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    @Deprecated("Deprecated in Android API; retained for broad device compatibility")
    override fun onBackPressed() {
        // JS menangani tombol kembali (menutup sheet/halaman). Bila tidak ada yang bisa ditutup, JS memanggil exit.
        webView.evaluateJavascript("(window.C01NNative&&C01NNative.onBack)?C01NNative.onBack():false") { r ->
            if (r != "true") defaultBack()
        }
    }

    @Suppress("DEPRECATION")
    private fun defaultBack() { super.onBackPressed() }
}
