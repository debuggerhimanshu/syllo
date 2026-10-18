
package com.zodiacdeveloper.sylloalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

class AlarmRingingService : Service() {

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopAlarm()
        return START_NOT_STICKY
      }

      ACTION_START -> {
        val alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID) ?: "class-alarm"
        val className = intent.getStringExtra(AlarmReceiver.EXTRA_CLASS_NAME) ?: "Upcoming class"

        startForeground(NOTIFICATION_ID, createNotification(alarmId, className))
        startRinging()

        Log.i(TAG, "Ringing started for $className")
      }

      else -> return START_NOT_STICKY
    }

    return START_STICKY
  }

  private fun createNotification(alarmId: String, className: String): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Class alarms",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Ringing alarms for scheduled classes"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setSound(null, null)
        enableVibration(false)
      }
      manager.createNotificationChannel(channel)
    }

    val screenIntent = Intent(this, AlarmActivity::class.java).apply {
      putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId)
      putExtra(AlarmReceiver.EXTRA_CLASS_NAME, className)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    val screenPendingIntent = PendingIntent.getActivity(
      this,
      alarmId.hashCode(),
      screenIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val stopIntent = Intent(this, AlarmRingingService::class.java).apply {
      action = ACTION_STOP
    }

    val stopPendingIntent = PendingIntent.getService(
      this,
      alarmId.hashCode() + 1,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Syllo class alarm")
      .setContentText(className)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setContentIntent(screenPendingIntent)
      .setFullScreenIntent(screenPendingIntent, true)
      .addAction(
        android.R.drawable.ic_media_pause,
        "Stop",
        stopPendingIntent
      )
      .build()
  }

  private fun startRinging() {
    if (player?.isPlaying == true) return

    try {
      val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

      if (alarmUri != null) {
        player = MediaPlayer().apply {
          setDataSource(this@AlarmRingingService, alarmUri)
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
          isLooping = true
          setOnPreparedListener { it.start() }
          setOnErrorListener { _, _, _ ->
            Log.e(TAG, "Alarm audio playback failed")
            true
          }
          prepareAsync()
        }
      }
    } catch (error: Exception) {
      Log.e(TAG, "Unable to play alarm sound", error)
    }

    try {
      vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        manager.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }

      val pattern = longArrayOf(0, 700, 300, 700, 300)

      if (vibrator?.hasVibrator() == true) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator?.vibrate(
            VibrationEffect.createWaveform(pattern, 0)
          )
        } else {
          @Suppress("DEPRECATION")
          vibrator?.vibrate(pattern, 0)
        }
      }
    } catch (error: Exception) {
      Log.e(TAG, "Unable to vibrate", error)
    }
  }

  private fun stopAlarm() {
    try {
      player?.stop()
    } catch (_: Exception) {
    }

    player?.release()
    player = null

    vibrator?.cancel()
    vibrator = null

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }

    stopSelf()
    Log.i(TAG, "Alarm stopped")
  }

  override fun onDestroy() {
    try {
      player?.stop()
    } catch (_: Exception) {
    }

    player?.release()
    player = null
    vibrator?.cancel()
    vibrator = null

    super.onDestroy()
  }

  companion object {
    const val ACTION_START = "com.zodiacdeveloper.sylloalarm.START"
    const val ACTION_STOP = "com.zodiacdeveloper.sylloalarm.STOP"
    const val CHANNEL_ID = "syllo-native-class-alarms"
    const val NOTIFICATION_ID = 7401
    const val TAG = "SylloAlarm"
  }
}
