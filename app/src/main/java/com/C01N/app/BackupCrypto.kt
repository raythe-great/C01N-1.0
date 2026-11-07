package com.c01n.app

import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Enkripsi file backup dengan kata sandi pengguna: PBKDF2-HMAC-SHA256 -> AES-256-GCM.
 * Format amplop (JSON): {"app":"C01N","format":"c01n-backup","v":1,"kdf":"PBKDF2WithHmacSHA256","iter":N,"salt":"b64","iv":"b64","ct":"b64"}
 * "ct" berisi ciphertext + tag GCM. Tanpa kata sandi yang benar, isinya tidak bisa dibaca atau diubah.
 */
object BackupCrypto {
    private const val ITER = 150_000
    private const val FORMAT = "c01n-backup"

    fun encrypt(plain: String, passphrase: String, iterations: Int = ITER): String {
        require(passphrase.length >= 6) { "Kata sandi minimal 6 karakter" }
        val rnd = SecureRandom()
        val salt = ByteArray(16).also { rnd.nextBytes(it) }
        val iv = ByteArray(12).also { rnd.nextBytes(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(passphrase, salt, iterations), GCMParameterSpec(128, iv))
        val ct = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        val b64 = Base64.getEncoder()
        return "{\"app\":\"C01N\",\"format\":\"$FORMAT\",\"v\":1,\"kdf\":\"PBKDF2WithHmacSHA256\",\"iter\":$iterations," +
            "\"salt\":\"${b64.encodeToString(salt)}\",\"iv\":\"${b64.encodeToString(iv)}\",\"ct\":\"${b64.encodeToString(ct)}\"}"
    }

    fun isEnvelope(text: String): Boolean = text.contains("\"format\"") && text.contains(FORMAT)

    /** Melempar exception bila kata sandi salah atau file diubah. */
    fun decrypt(envelope: String, passphrase: String): String {
        require(isEnvelope(envelope)) { "Bukan file backup C01N" }
        val iter = field(envelope, "iter", number = true).toInt()
        require(iter in 10_000..2_000_000) { "Parameter backup tidak valid" }
        val d = Base64.getDecoder()
        val salt = d.decode(field(envelope, "salt"))
        val iv = d.decode(field(envelope, "iv"))
        val ct = d.decode(field(envelope, "ct"))
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(passphrase, salt, iter), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(ct), Charsets.UTF_8)
    }

    private fun field(text: String, name: String, number: Boolean = false): String {
        val re = if (number) Regex("\"$name\"\\s*:\\s*(\\d+)") else Regex("\"$name\"\\s*:\\s*\"([A-Za-z0-9+/=]+)\"")
        return re.find(text)?.groupValues?.get(1) ?: throw IllegalArgumentException("Field $name tidak ada")
    }

    private fun key(pass: String, salt: ByteArray, iterations: Int): SecretKeySpec {
        val raw = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(PBEKeySpec(pass.toCharArray(), salt, iterations, 256)).encoded
        return SecretKeySpec(raw, "AES")
    }
}
