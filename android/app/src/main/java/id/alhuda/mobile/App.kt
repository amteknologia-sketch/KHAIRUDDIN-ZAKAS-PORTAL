package id.alhuda.mobile

import android.content.Context

object App {
    const val PREFS = "alhuda"
    @Volatile var foreground = false
    val queueLock = Any()

    /** Alamat Web App: yang diatur Pengembang di aplikasi (bila ada), jika tidak memakai bawaan APK. */
    fun apiUrl(ctx: Context): String {
        val o = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("api_url", "") ?: ""
        return if (o.startsWith("https://")) o else ctx.getString(R.string.web_app_url)
    }
}
