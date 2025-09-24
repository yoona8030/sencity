package com.sencity

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

import com.sencity.CustomSystemUIPackage // ✅ 추가

// ✅ 추가: 알림 채널 관련 import
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(CustomSystemUIPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    // ✅ 앱 시작 시 알림 채널 생성 (Android 8.0+)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)

      // 기본 채널 (앱 전반/리포트 등)
      val defaultCh = NotificationChannel(
        "default",                // ⚠️ 채널 ID
        "Default",                // 사용자에게 보이는 채널명
        NotificationManager.IMPORTANCE_DEFAULT
      ).apply {
        description = "General notifications"
      }
      nm.createNotificationChannel(defaultCh)

      // (선택) 마케팅/공지 채널 – 알림 종류 분리하고 싶을 때
      val marketingCh = NotificationChannel(
        "marketing",
        "Announcements & Marketing",
        NotificationManager.IMPORTANCE_DEFAULT
      ).apply {
        description = "Announcements, news, and marketing messages"
      }
      nm.createNotificationChannel(marketingCh)
    }
    loadReactNative(this)
  }
}
