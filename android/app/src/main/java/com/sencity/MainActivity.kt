package com.sencity

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import com.facebook.react.ReactActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.ViewCompat

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "sencity" // 앱 이름에 맞게 수정

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyEdgeToEdgeAndImmersive()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      // 일부 기기에서 포커스 전환 시 플래그가 풀리는 문제 대응
      applyEdgeToEdgeAndImmersive()
    }
  }

  private fun applyEdgeToEdgeAndImmersive() {
    val window = window

    // 1) 시스템 바 아래까지 컨텐츠 확장
    WindowCompat.setDecorFitsSystemWindows(window, false)

    // 2) 상태바는 보이고, 하단 내비게이션 바만 숨김 (스와이프로 일시 노출)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.show(WindowInsetsCompat.Type.statusBars())
    controller.hide(WindowInsetsCompat.Type.navigationBars())
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    // 3) 하단 공백/번쩍임 방지
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      window.navigationBarColor = Color.TRANSPARENT
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      // 대비 강제 때문에 흰 띠가 남는 기기 대응
      window.isNavigationBarContrastEnforced = false
    }

    // 4) ✅ 하단 inset(내비게이션 바 높이)을 '소비'하고, 상단 inset만 padding으로 적용
    val content = findViewById<android.view.View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
      v.setPadding(0, top, 0, 0) // 상단만 padding, 하단은 0으로 강제 → 하얀 공백 제거
      WindowInsetsCompat.CONSUMED
    }
  }
}
