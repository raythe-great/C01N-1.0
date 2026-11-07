package com.c01n.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Penyimpanan file terenkripsi (AES-256-GCM). Kunci dibuat dan disimpan di Android Keystore,
 * tidak pernah keluar dari perangkat. Penulisan atomik: file lama aman bila penulisan gagal.
 */
class SecureStore(context: Context) {
    private val dir = File(context.filesDir, "c01n").apply { mkdirs() }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    fun exists(name: String): Boolean = File(dir, "$name.bin").exists()

    /** Mengembalikan null bila file belum ada. Melempar exception bila file ada tetapi tidak bisa didekripsi. */
    @Synchronized
    fun read(name: String): String? {
        val file = File(dir, "$name.bin")
        if (!file.exists()) return null
        val raw = AtomicFile(file).readFully()
        require(raw.size > IV_LEN + 16) { "File rusak" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, raw, 0, IV_LEN))
        return String(cipher.doFinal(raw, IV_LEN, raw.size - IV_LEN), Charsets.UTF_8)
    }

    @Synchronized
    fun write(name: String, text: String): Boolean {
        val atomic = AtomicFile(File(dir, "$name.bin"))
        val out = atomic.startWrite()
        return try {
            val iv = ByteArray(IV_LEN).also { SecureRandom().nextBytes(it) }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key(), GCMParameterSpec(128, iv))
            out.write(iv)
            out.write(cipher.doFinal(text.toByteArray(Charsets.UTF_8)))
            atomic.finishWrite(out)
            true
        } catch (_: Exception) {
            atomic.failWrite(out)
            false
        }
    }

    @Synchronized
    fun delete(name: String) {
        AtomicFile(File(dir, "$name.bin")).delete()
    }

    companion object {
        private const val ALIAS = "c01n_master_key_v1"
        private const val IV_LEN = 12
    }
}
