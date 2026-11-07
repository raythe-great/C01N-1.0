# Metode yang dipanggil dari JavaScript tidak boleh di-rename atau dihapus oleh R8.
-keepattributes JavascriptInterface
-keepclassmembers class com.c01n.app.MainActivity$AppBridge {
    @android.webkit.JavascriptInterface <methods>;
}
