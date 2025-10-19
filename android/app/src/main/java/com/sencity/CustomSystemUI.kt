package com.sencity

import android.app.Activity
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CustomSystemUI(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CustomSystemUI"

  /**
   * 상단(StatusBar)은 보이게 유지하고,
   * 하단(NavigationBar)만 immersive-sticky 로 숨김.
   */
  @ReactMethod
  fun enableStickyHideNavKeepStatus() {
    // ❗ currentActivity가 null이면 바로 리턴해 비동기 타이밍 크래시 방지
    val act: Activity = currentActivity ?: return

    act.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val controller = act.window?.insetsController
        controller?.let {
          it.systemBarsBehavior =
            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
          it.hide(WindowInsets.Type.navigationBars())   // 하단만 숨김
          it.show(WindowInsets.Type.statusBars())       // 상단은 보이게
        }
      } else {
        @Suppress("DEPRECATION")
        act.window?.decorView?.systemUiVisibility =
          (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
           or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION)      // 절대 FULLSCREEN 넣지 말 것
      }
    }
  }

  /** 시스템 바 전부 다시 표시 (복구용) */
  @ReactMethod
  fun showSystemBars() {
    val act: Activity = currentActivity ?: return

    act.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        act.window?.insetsController?.show(WindowInsets.Type.systemBars())
      } else {
        @Suppress("DEPRECATION")
        act.window?.decorView?.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
      }
    }
  }
}