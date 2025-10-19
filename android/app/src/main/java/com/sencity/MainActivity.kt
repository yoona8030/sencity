package com.sencity

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactRootView

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "sencity"

  @Volatile
  private var isContentReady = false

  override fun onCreate(savedInstanceState: Bundle?) {
    // 1) 시스템 스플래시: RN 첫 프레임 준비될 때까지 유지
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val splash = installSplashScreen()
      splash.setKeepOnScreenCondition { !isContentReady }
      splash.setOnExitAnimationListener { it.remove() } // 잔상 없이 즉시 제거
    }

    super.onCreate(null)

    // 2) 엣지-투-엣지 ON: 컨텐츠가 시스템 바 영역까지 그리도록 (전역 padding 없음)
    //    ※ SafeArea는 RN에서 필요한 화면에만 선택적으로 처리하세요.
    WindowCompat.setDecorFitsSystemWindows(window, false) // ★ 변경

    // 상태/내비 바 색상(필요 시)
    val black = ContextCompat.getColor(this, R.color.app_black)
    window.statusBarColor = black
    window.navigationBarColor = black
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }

    // 3) 몰입형 전체화면 적용 (시스템 바 숨김)
    applyImmersive() // ★ 추가

    // 4) RN 첫 프레임이 실제로 그려지는 순간까지 대기 → 그 시점에 windowBackground 제거
    val content: View = findViewById(android.R.id.content)
    content.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
      override fun onPreDraw(): Boolean {
        val vg = content as? ViewGroup ?: return false
        val rr = (0 until vg.childCount)
          .map { vg.getChildAt(it) }
          .firstOrNull { it is ReactRootView } as? ReactRootView

        val ready = rr != null && rr.width > 0 && rr.height > 0 && rr.childCount > 0
        if (ready) {
          isContentReady = true
          content.viewTreeObserver.removeOnPreDrawListener(this)

          // 스플래시 종료 딱 그 시점에 windowBackground 제거 → '검은 화면' 재등장 방지
          window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT)) // ★ 유지

          // 일부 기기(삼성 등)에서 필요: 첫 프레임 직후 몰입형 재적용
          applyImmersive() // ★ 추가
          return true
        }
        return false
      }
    })
  }

  override fun onResume() {
    super.onResume()
    // 앱 복귀 시 몰입형 유지
    applyImmersive() // ★ 추가
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      // 사용자가 스와이프로 바를 잠깐 노출시킨 후에도 자동 복귀
      applyImmersive() // ★ 추가
    }
  }

  // ★ 추가: 몰입형 유틸
  private fun applyImmersive() {
    val controller = WindowInsetsControllerCompat(window, window.decorView)

    // 상·하단 시스템 바 모두 숨김, 스와이프 시 일시 노출
    controller.hide(WindowInsetsCompat.Type.systemBars())
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    // 검은 배경에 밝은 아이콘 비활성화
    controller.isAppearanceLightStatusBars = false
    controller.isAppearanceLightNavigationBars = false
  }
}
