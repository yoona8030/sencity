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

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "sencity"

  override fun onCreate(savedInstanceState: Bundle?) {
    // 반드시 super.onCreate() 전에 호출
    installSplashScreen()
    super.onCreate(savedInstanceState)
    applyEdgeToEdgeAndImmersive()
  }

  override fun onResume() {
    super.onResume()
    // 일부 기기/런처에서 복귀 시 시스템 바 상태가 바뀌는 문제 대비
    applyEdgeToEdgeAndImmersive()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      // 포커스 전환 시 재적용
      applyEdgeToEdgeAndImmersive()
    }
  }

  private fun applyEdgeToEdgeAndImmersive() {
    val window = window
    val decorView = window.decorView

    // (1) 컨텐츠를 시스템 영역까지 확장
    //     상태바는 보여줄 것이므로 top inset만 우리가 수동으로 반영
    WindowCompat.setDecorFitsSystemWindows(window, false)

    // (2) 상태바는 보이게, 하단 내비게이션 바는 자동 숨김
    val controller = WindowInsetsControllerCompat(window, decorView)
    controller.show(WindowInsetsCompat.Type.statusBars())
    controller.hide(WindowInsetsCompat.Type.navigationBars())
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    // (3) 번쩍임/하단 띠 방지
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      window.statusBarColor = Color.TRANSPARENT
      window.navigationBarColor = Color.TRANSPARENT
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }

    // (4) 상단 inset만 패딩으로 적용하고, 하단은 "키보드 열릴 때만" 패딩 적용
    val content: View = findViewById(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val statusTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top

      // IME(키보드) 보이는 동안에만 하단 패딩을 줌
      val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
      val imeBottom  = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      val bottomPadding = if (imeVisible) imeBottom else 0

      v.setPadding(0, statusTop, 0, bottomPadding)

      // ⚠️ 전파를 막지 말고 원본 insets를 돌려줘야
      // RN/하위 뷰에서 키보드/안전영역 처리가 정상 동작합니다.
      insets
    }
  }
}