
package com.zodiacdeveloper.sylloalarm

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AlarmActivity : Activity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      )
    }

    val className = intent.getStringExtra(AlarmReceiver.EXTRA_CLASS_NAME)
      ?: "Upcoming class"

    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(32, 48, 32, 48)
      setBackgroundColor(Color.rgb(15, 18, 28))
    }

    val appName = TextView(this).apply {
      text = "SYLLO ALARM"
      textSize = 16f
      setTextColor(Color.rgb(155, 170, 255))
      gravity = Gravity.CENTER
    }

    val title = TextView(this).apply {
      text = className
      textSize = 30f
      setTypeface(null, Typeface.BOLD)
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 32, 0, 16)
    }

    val subtitle = TextView(this).apply {
      text = "Your class is starting"
      textSize = 17f
      setTextColor(Color.LTGRAY)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 48)
    }

    val stopButton = Button(this).apply {
      text = "STOP ALARM"
      textSize = 18f
      isAllCaps = false

      setOnClickListener {
        val stopIntent = Intent(
          this@AlarmActivity,
          AlarmRingingService::class.java
        ).apply {
          action = AlarmRingingService.ACTION_STOP
        }

        startService(stopIntent)
        finish()
      }
    }

    layout.addView(appName)
    layout.addView(title)
    layout.addView(subtitle)
    layout.addView(
      stopButton,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    )

    setContentView(layout)
  }

  @Deprecated("Deprecated in Android")
  override fun onBackPressed() {
    // Keep the alarm screen visible until the user stops the alarm.
  }
}
