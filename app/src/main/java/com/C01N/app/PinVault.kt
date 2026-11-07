package com.c01n.app

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Logika PIN murni (tanpa class Android) agar bisa diuji dengan JUnit.
 * PIN tidak pernah disimpan: hanya hash PBKDF2-HMAC-SHA256 + salt acak.
 * Percobaan gagal dan waktu kunci disimpan lewat [Storage] (terenkripsi Keystore di aplikasi)
 * sehingga tidak bisa direset dengan menutup aplikasi.
 */
class PinVault(
    private val storage: Storage,
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val iterations: Int = 100_000
) {
    interface Storage {
        fun read(): String?
        fun write(text: String)
    }

    data class VerifyResult(val ok: Boolean, val lockoutMs: Long, val attemptsLeft: Int)

    private var salt = ""
    private var hash = ""
    private var iter = iterations
    private var fails = 0
    private var lockUntil = 0L
    var biometricEnabled = false
        private set
    var autoLockMs = 60_000L
        private set
    var secureScreen = true
        private set

    init { load() }

    @Synchronized
    private fun load() {
        val map = HashMap<String, String>()
        storage.read()?.lines()?.forEach { line ->
            val i = line.indexOf('=')
            if (i > 0) map[line.substring(0, i)] = line.substring(i + 1)
        }
        salt = map["salt"] ?: ""
        hash = map["hash"] ?: ""
        iter = map["iter"]?.toIntOrNull() ?: iterations
        fails = map["fails"]?.toIntOrNull() ?: 0
        lockUntil = map["lockUntil"]?.toLongOrNull() ?: 0L
        biometricEnabled = map["bio"] == "1" && hash.isNotEmpty()
        autoLockMs = map["autoLock"]?.toLongOrNull()?.coerceIn(0L, 3_600_000L) ?: 60_000L
        secureScreen = map["secure"] != "0"
    }

    private fun save() {
        storage.write(
            "salt=$salt\nhash=$hash\niter=$iter\nfails=$fails\nlockUntil=$lockUntil\n" +
                "bio=${if (biometricEnabled) 1 else 0}\nautoLock=$autoLockMs\nsecure=${if (secureScreen) 1 else 0}"
        )
    }

    @Synchronized fun isEnabled(): Boolean = hash.isNotEmpty()

    @Synchronized
    fun lockoutRemaining(): Long = (lockUntil - clock()).coerceAtLeast(0L)

    @Synchronized
    fun setPin(pin: String): Boolean {
        if (!validFormat(pin)) return false
        val s = ByteArray(16).also { SecureRandom().nextBytes(it) }
        salt = Base64.getEncoder().encodeToString(s)
        iter = iterations
        hash = Base64.getEncoder().encodeToString(derive(pin, s, iter))
        fails = 0
        lockUntil = 0L
        save()
        return true
    }

    @Synchronized
    fun verify(pin: String): VerifyResult {
        if (!isEnabled()) return VerifyResult(true, 0, ATTEMPTS_BEFORE_LOCK)
        val remaining = lockoutRemaining()
        if (remaining > 0) return VerifyResult(false, remaining, 0)
        val expected = Base64.getDecoder().decode(hash)
        val actual = if (validFormat(pin)) derive(pin, Base64.getDecoder().decode(salt), iter) else ByteArray(expected.size)
        val ok = validFormat(pin) && MessageDigest.isEqual(expected, actual)
        if (ok) {
            fails = 0
            lockUntil = 0L
            save()
            return VerifyResult(true, 0, ATTEMPTS_BEFORE_LOCK)
        }
        fails++
        lockUntil = clock() + delayFor(fails)
        save()
        return VerifyResult(false, lockoutRemaining(), (ATTEMPTS_BEFORE_LOCK - fails).coerceAtLeast(0))
    }

    @Synchronized
    fun disable() {
        salt = ""; hash = ""; fails = 0; lockUntil = 0L; biometricEnabled = false
        save()
    }

    @Synchronized
    fun setBiometric(on: Boolean) { if (isEnabled()) { biometricEnabled = on; save() } }

    @Synchronized
    fun setAutoLock(ms: Long) { autoLockMs = ms.coerceIn(0L, 3_600_000L); save() }

    @Synchronized
    fun setSecureScreen(on: Boolean) { secureScreen = on; save() }

    private fun derive(pin: String, salt: ByteArray, iterations: Int): ByteArray =
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(PBEKeySpec(pin.toCharArray(), salt, iterations, 256)).encoded

    companion object {
        const val ATTEMPTS_BEFORE_LOCK = 5

        fun validFormat(pin: String) = pin.length == 6 && pin.all { it in '0'..'9' }

        /** Penundaan setelah percobaan gagal ke-n: 1-4 tanpa jeda, lalu 30 dtk, 1 mnt, 5 mnt, 15 mnt. */
        fun delayFor(fails: Int): Long = when {
            fails < ATTEMPTS_BEFORE_LOCK -> 0L
            fails == 5 -> 30_000L
            fails == 6 -> 60_000L
            fails == 7 -> 300_000L
            else -> 900_000L
        }
    }
}
