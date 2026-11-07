package com.c01n.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class SecurityTest {
    private class MemStorage : PinVault.Storage {
        var text: String? = null
        override fun read() = text
        override fun write(text: String) { this.text = text }
    }

    private var now = 1_000_000L
    private fun vault(s: MemStorage) = PinVault(s, { now }, iterations = 1_000)

    @Test fun pinFormatMustBeSixDigits() {
        assertTrue(PinVault.validFormat("123456"))
        assertFalse(PinVault.validFormat("12345"))
        assertFalse(PinVault.validFormat("1234567"))
        assertFalse(PinVault.validFormat("12a456"))
        assertFalse(vault(MemStorage()).setPin("1234"))
    }

    @Test fun correctPinVerifiesAndWrongPinFails() {
        val v = vault(MemStorage())
        assertFalse(v.isEnabled())
        assertTrue(v.setPin("246810".take(6)))
        assertTrue(v.isEnabled())
        assertTrue(v.verify("246810").ok)
        val bad = v.verify("000000")
        assertFalse(bad.ok)
        assertEquals(4, bad.attemptsLeft)
    }

    @Test fun pinIsNeverStoredInPlaintext() {
        val s = MemStorage()
        vault(s).setPin("918273")
        assertFalse(s.text!!.contains("918273"))
        assertTrue(s.text!!.contains("hash="))
    }

    @Test fun lockoutAfterFiveFailuresAndExpires() {
        val v = vault(MemStorage())
        v.setPin("123456")
        repeat(4) { assertEquals(0L, v.verify("111111").lockoutMs) }
        val fifth = v.verify("111111")
        assertEquals(30_000L, fifth.lockoutMs)
        // selama terkunci, PIN benar pun ditolak dan tidak menambah hitungan
        assertFalse(v.verify("123456").ok)
        now += 29_000
        assertFalse(v.verify("123456").ok)
        now += 2_000
        assertTrue(v.verify("123456").ok)
        // setelah sukses hitungan kembali nol
        assertEquals(4, v.verify("000000").attemptsLeft)
    }

    @Test fun delaysEscalate() {
        assertEquals(0L, PinVault.delayFor(4))
        assertEquals(30_000L, PinVault.delayFor(5))
        assertEquals(60_000L, PinVault.delayFor(6))
        assertEquals(300_000L, PinVault.delayFor(7))
        assertEquals(900_000L, PinVault.delayFor(12))
    }

    @Test fun failedAttemptsSurviveRestart() {
        val s = MemStorage()
        val v1 = vault(s)
        v1.setPin("123456")
        repeat(5) { v1.verify("999999") }
        val v2 = vault(s) // aplikasi "dibuka ulang"
        assertTrue(v2.lockoutRemaining() > 0)
        assertFalse(v2.verify("123456").ok)
    }

    @Test fun settingsPersistAndDisableClearsBiometric() {
        val s = MemStorage()
        val v = vault(s)
        v.setBiometric(true) // belum ada PIN: diabaikan
        assertFalse(v.biometricEnabled)
        v.setPin("123456")
        v.setBiometric(true)
        v.setAutoLock(300_000)
        v.setSecureScreen(false)
        val again = vault(s)
        assertTrue(again.biometricEnabled)
        assertEquals(300_000L, again.autoLockMs)
        assertFalse(again.secureScreen)
        again.disable()
        assertFalse(again.isEnabled())
        assertFalse(again.biometricEnabled)
        assertTrue(again.verify("anything").ok) // tanpa PIN, tidak terkunci
    }

    @Test fun changingPinReplacesOldPin() {
        val v = vault(MemStorage())
        v.setPin("111111")
        v.setPin("222222")
        assertFalse(v.verify("111111").ok)
        now += 60_000
        assertTrue(v.verify("222222").ok)
    }

    @Test fun backupRoundTrip() {
        val plain = "{\"state\":{\"transactions\":[{\"amount\":15000,\"title\":\"Kopi ☕\"}]}}"
        val env = BackupCrypto.encrypt(plain, "rahasia-saya", 10_000)
        assertTrue(BackupCrypto.isEnvelope(env))
        assertFalse(env.contains("Kopi"))
        assertEquals(plain, BackupCrypto.decrypt(env, "rahasia-saya"))
    }

    @Test fun backupWrongPassphraseFails() {
        val env = BackupCrypto.encrypt("data", "kata-sandi-1", 10_000)
        try { BackupCrypto.decrypt(env, "kata-sandi-2"); fail("harus gagal") } catch (_: Exception) {}
    }

    @Test fun backupTamperingIsDetected() {
        val env = BackupCrypto.encrypt("data penting", "kata-sandi-1", 10_000)
        val ct = Regex("\"ct\":\"([^\"]+)\"").find(env)!!.groupValues[1]
        val flipped = (if (ct[0] == 'A') 'B' else 'A') + ct.substring(1)
        try { BackupCrypto.decrypt(env.replace(ct, flipped), "kata-sandi-1"); fail("harus gagal") } catch (_: Exception) {}
    }

    @Test fun backupUsesFreshSaltAndIv() {
        val a = BackupCrypto.encrypt("x", "kata-sandi-1", 10_000)
        val b = BackupCrypto.encrypt("x", "kata-sandi-1", 10_000)
        assertNotEquals(a, b)
    }

    @Test fun shortPassphraseRejected() {
        try { BackupCrypto.encrypt("x", "123", 10_000); fail("harus gagal") } catch (_: IllegalArgumentException) {}
    }
}
