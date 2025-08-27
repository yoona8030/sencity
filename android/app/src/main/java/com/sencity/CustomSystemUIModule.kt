package com.sencity

import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CustomSystemUIModule(private val reactContext: ReactApplicationContext)
  : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CustomSystemUI"

  @ReactMethod
  fun enableStickyHideNavKeepStatus() {
    val activity = currentActivity ?: return
    activity.runOnUiThread {
      val window = activity.window

      // ✅ 시스템 바 아래까지 컨텐츠가 깔리게 설정 (공백 제거의 핵심)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        window.setDecorFitsSystemWindows(false)
      } else {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
          View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
          View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        )
      }

      // 상태바는 보이기, 내비게이션 바만 숨기기
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val controller = window.insetsController ?: return@runOnUiThread
        controller.show(WindowInsets.Type.statusBars())
        controller.hide(WindowInsets.Type.navigationBars())
        controller.systemBarsBehavior =
          WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      } else {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
          View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
          View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
      }

      // 내비게이션 영역이 잠깐 나타날 때도 배경이 하얗지 않도록 투명 처리
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        window.navigationBarColor = Color.TRANSPARENT
      }
    }
  }

  @ReactMethod
  fun showSystemBars() {
    val activity = currentActivity ?: return
    activity.runOnUiThread {
      val window = activity.window

      // 기본(안전영역 생김)으로 복구하려면 true, 계속 ‘전체화면 레이아웃’ 유지하려면 false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        window.setDecorFitsSystemWindows(true)
      } else {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val controller = window.insetsController ?: return@runOnUiThread
        controller.show(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
      } else {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      }
    }
  }
}
