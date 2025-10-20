package com.sencity

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.view.Choreographer
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactRootView

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "sencity"

  @Volatile private var isContentReady = false
  private var splashOverlay: View? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    // 1) 시스템 스플래시: RN 첫 프레임 준비될 때까지 유지
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val splash = installSplashScreen()
      splash.setKeepOnScreenCondition { !isContentReady }
      splash.setOnExitAnimationListener { it.remove() } // 잔상 없이 즉시 제거
    }

    super.onCreate(null)

    // 2) 전역 padding 없음 + 몰입형(시스템바 숨김)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val black = ContextCompat.getColor(this, R.color.app_black)
    window.statusBarColor = black
    window.navigationBarColor = black
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
    applyImmersive()

    // 3) RN 첫 "실제" 프레임까지 대기 → 그 순간에 부드럽게 전환
    val content: View = findViewById(android.R.id.content)
    content.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
      override fun onPreDraw(): Boolean {
        val vg = content as? ViewGroup ?: return false
        val rr = (0 until vg.childCount)
          .map { vg.getChildAt(it) }
          .firstOrNull { it is ReactRootView } as? ReactRootView

        // ReactRootView가 존재 + 사이즈 확보 + 자식뷰(첫 프레임) 존재
        val ready = rr != null && rr.width > 0 && rr.height > 0 && rr.childCount > 0
        if (ready) {
          isContentReady = true
          content.viewTreeObserver.removeOnPreDrawListener(this)

          // (A) 같은 드로어블(로고+검정) 오버레이를 최상단에 잠깐 올림
          addSplashOverlay()

          // (B) windowBackground를 투명으로 즉시 교체 → 검은 빈화면 노출 구간 제거
          window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))

          // (C) 로그인 UI가 실제 픽셀로 1~2프레임 렌더된 뒤 오버레이 제거
          runAfterFrames(2) {
            removeSplashOverlayWithFade()
            applyImmersive() // 일부 기기에서 바 튐 방지 재적용
          }
          return true
        }
        return false
      }
    })
  }

  override fun onResume() {
    super.onResume()
    applyImmersive()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) applyImmersive()
  }

  /** 시스템 바(상·하) 숨김 + 스와이프 시 일시 노출 */
  private fun applyImmersive() {
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.hide(WindowInsetsCompat.Type.systemBars())
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    controller.isAppearanceLightStatusBars = false
    controller.isAppearanceLightNavigationBars = false
  }

  /** styles.xml/windowBackground와 동일한 드로어블을 가진 오버레이 추가 */
  private fun addSplashOverlay() {
    if (splashOverlay != null) return
    val decor = window.decorView as ViewGroup
    splashOverlay = View(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      // ★ 여기 드로어블이 현재 스플래시(로고+검정)와 같아야 ‘완전 동일’하게 보입니다.
      background = ContextCompat.getDrawable(this@MainActivity, R.drawable.splash_black_center)
      alpha = 1f
    }
    decor.addView(splashOverlay)
  }

  /** 오버레이를 150ms로 부드럽게 제거 */
  private fun removeSplashOverlayWithFade() {
    val overlay = splashOverlay ?: return
    overlay.animate().alpha(0f).setDuration(150).withEndAction {
      val decor = window.decorView as ViewGroup
      decor.removeView(overlay)
      splashOverlay = null
    }.start()
  }

  /** N 프레임 뒤에 실행 (프레임 타이밍 정밀 제어) */
  private fun runAfterFrames(frames: Int, action: () -> Unit) {
    if (frames <= 0) { action(); return }
    Choreographer.getInstance().postFrameCallback {
      runAfterFrames(frames - 1, action)
    }
  }
}
