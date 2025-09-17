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
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "sencity"

  // ✅ 한번만 Insets 리스너를 붙이도록 플래그
  private var insetsListenerApplied = false

  override fun onCreate(savedInstanceState: Bundle?) {
    // super 전에
    installSplashScreen()
    // ✅ bootsplash는 테마 리소스 ID가 필요 (styles.xml의 Theme.Sencity.Splash)
    RNBootSplash.init(this, R.style.Theme_Sencity_Splash)

    super.onCreate(savedInstanceState)
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

  // ✅ 상태바 보이되 내비게이션 바는 자동 숨김 + 인셋 패딩 적용
  private fun applyEdgeToEdgeAndImmersive() {
    val w = window
    val decorView = w.decorView

    // 컨텐츠를 시스템 영역까지 확장
    WindowCompat.setDecorFitsSystemWindows(w, false)

    // 상태바는 보이게, 하단 네비바는 스와이프로 일시 표시
    val controller = WindowInsetsControllerCompat(w, decorView)
    controller.show(WindowInsetsCompat.Type.statusBars())
    controller.hide(WindowInsetsCompat.Type.navigationBars())
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    // 번쩍임/하단 띠 방지
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      w.statusBarColor = Color.TRANSPARENT
      w.navigationBarColor = Color.TRANSPARENT
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      w.isNavigationBarContrastEnforced = false
    }

    // 최상위 콘텐츠에 상단/키보드 인셋만 패딩 반영 (한 번만 등록)
    if (!insetsListenerApplied) {
      val content: View = findViewById(android.R.id.content)
      ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
        val statusTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
        val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
        val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        val bottomPadding = if (imeVisible) imeBottom else 0
        v.setPadding(0, statusTop, 0, bottomPadding)
        insets // 반드시 원본 전달
      }
      insetsListenerApplied = true
    }
  }
}
