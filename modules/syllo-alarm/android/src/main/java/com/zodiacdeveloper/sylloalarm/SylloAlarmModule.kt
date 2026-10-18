
package com.zodiacdeveloper.sylloalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SylloAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SylloAlarm")

    Function("canScheduleExactAlarms") {
      val context = appContext.reactContext ?: return@Function false

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager =
          context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        manager.canScheduleExactAlarms()
      } else {
        true
      }
    }

    Function("canUseFullScreenIntent") {
      val context = appContext.reactContext ?: return@Function false

      if (Build.VERSION.SDK_INT >= 34) {
        val manager =
          context.getSystemService(Context.NOTIFICATION_SERVICE)
            as android.app.NotificationManager
        manager.canUseFullScreenIntent()
      } else {
        true
      }
    }

    Function("openAlarmPermissionSettings") {
      val context = appContext.reactContext ?: return@Function false

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent =
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        context.startActivity(intent)
      }

      true
    }

    Function("openFullScreenPermissionSettings") {
      val context = appContext.reactContext ?: return@Function false

      if (Build.VERSION.SDK_INT >= 34) {
        val intent =
          Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        context.startActivity(intent)
      }

      true
    }

    Function("scheduleAlarm") {
        alarmId: String,
        className: String,
        triggerAtMillis: Long ->

      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context unavailable")

      val manager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        !manager.canScheduleExactAlarms()
      ) {
        throw IllegalStateException(
          "Allow Alarms & reminders permission for Syllo"
        )
      }

      val intent = Intent(context, AlarmReceiver::class.java).apply {
        putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId)
        putExtra(AlarmReceiver.EXTRA_CLASS_NAME, className)
      }

      val pendingIntent = PendingIntent.getBroadcast(
        context,
        alarmId.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        manager.setExactAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          triggerAtMillis,
          pendingIntent
        )
      } else {
        manager.setExact(
          AlarmManager.RTC_WAKEUP,
          triggerAtMillis,
          pendingIntent
        )
      }

      // Record the alarm ID so cancelAllAlarms() can find it.
      val preferences = context.getSharedPreferences(
        "syllo_native_alarms",
        Context.MODE_PRIVATE
      )

      val alarmIds = preferences
        .getStringSet("alarm_ids", emptySet())
        ?.toMutableSet() ?: mutableSetOf()

      alarmIds.add(alarmId)

      preferences.edit()
        .putStringSet("alarm_ids", alarmIds)
        .apply()

      true
    }

    Function("cancelAlarm") { alarmId: String ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context unavailable")

      val intent = Intent(context, AlarmReceiver::class.java)

      val pendingIntent = PendingIntent.getBroadcast(
        context,
        alarmId.hashCode(),
        intent,
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
      )

      val manager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      if (pendingIntent != null) {
        manager.cancel(pendingIntent)
        pendingIntent.cancel()
      }

      val preferences = context.getSharedPreferences(
        "syllo_native_alarms",
        Context.MODE_PRIVATE
      )

      val alarmIds = preferences
        .getStringSet("alarm_ids", emptySet())
        ?.toMutableSet() ?: mutableSetOf()

      alarmIds.remove(alarmId)

      preferences.edit()
        .putStringSet("alarm_ids", alarmIds)
        .apply()

      true
    }

    Function("cancelAllAlarms") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context unavailable")

      val preferences = context.getSharedPreferences(
        "syllo_native_alarms",
        Context.MODE_PRIVATE
      )

      val alarmIds = preferences
        .getStringSet("alarm_ids", emptySet())
        ?.toSet() ?: emptySet()

      val manager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

      for (alarmId in alarmIds) {
        val intent = Intent(context, AlarmReceiver::class.java)

        val pendingIntent = PendingIntent.getBroadcast(
          context,
          alarmId.hashCode(),
          intent,
          PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )

        if (pendingIntent != null) {
          manager.cancel(pendingIntent)
          pendingIntent.cancel()
        }
      }

      preferences.edit()
        .remove("alarm_ids")
        .apply()

      true
    }
  }
}
