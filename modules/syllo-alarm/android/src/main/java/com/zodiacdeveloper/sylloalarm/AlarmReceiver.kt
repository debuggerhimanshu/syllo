
package com.zodiacdeveloper.sylloalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val alarmId = intent.getStringExtra(EXTRA_ALARM_ID) ?: return
    val className = intent.getStringExtra(EXTRA_CLASS_NAME) ?: "Upcoming class"

    Log.i(TAG, "Alarm received for $className ($alarmId)")

    val serviceIntent = Intent(context, AlarmRingingService::class.java).apply {
      action = AlarmRingingService.ACTION_START
      putExtra(EXTRA_ALARM_ID, alarmId)
      putExtra(EXTRA_CLASS_NAME, className)
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
    } catch (error: Exception) {
      Log.e(TAG, "Unable to start alarm ringing service", error)
    }
  }

  companion object {
    const val TAG = "SylloAlarm"
    const val EXTRA_ALARM_ID = "syllo_alarm_id"
    const val EXTRA_CLASS_NAME = "syllo_class_name"
  }
}
