package com.sencity

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import com.facebook.react.ReactActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.ViewCompat
// import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen // ❌ 사용하지 않음
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "sencity"

  private var insetsListenerApplied = false

  override fun onCreate(savedInstanceState: Bundle?) {
    // ✅ rn-bootsplash만 사용
    RNBootSplash.init(this, R.style.BootTheme)
    super.onCreate(null)    // RN 권장: null 전달

    applyEdgeToEdgeAndImmersive()
  }

  override fun onResume() {
    super.onResume()
    applyEdgeToEdgeAndImmersive()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) applyEdgeToEdgeAndImmersive()
  }

  private fun applyEdgeToEdgeAndImmersive() {
    val w = window
    val decorView = w.decorView

    WindowCompat.setDecorFitsSystemWindows(w, false)

    val controller = WindowInsetsControllerCompat(w, decorView)
    controller.show(WindowInsetsCompat.Type.statusBars())
    controller.hide(WindowInsetsCompat.Type.navigationBars())
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      w.statusBarColor = Color.TRANSPARENT
      w.navigationBarColor = Color.TRANSPARENT
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      w.isNavigationBarContrastEnforced = false
    }

    if (!insetsListenerApplied) {
      val content: View = findViewById(android.R.id.content)
      ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
        val statusTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
        val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
        val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        v.setPadding(0, statusTop, 0, if (imeVisible) imeBottom else 0)
        insets
      }
      insetsListenerApplied = true
    }
  }
}
