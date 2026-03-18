package com.studyai.smartclassroom.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.ui.dashboard.DashboardActivity
import com.studyai.smartclassroom.utils.Constants
import com.studyai.smartclassroom.utils.ProjectionPermissionStore
import java.io.File

/**
 * Foreground service that records screen + microphone audio using MediaProjection + MediaRecorder.
 *
 * This service is intentionally simple and defensive:
 * - It records a single session to a local MP4 file.
 * - When stopped, it broadcasts the saved file path.
 */
class ScreenRecordService : Service() {

    companion object {
        const val BROADCAST_RECORDING_STOPPED = "broadcast_recording_stopped"
        const val BROADCAST_RECORDING_ERROR = "broadcast_recording_error"
        const val EXTRA_SAVED_FILE_PATH = "extra_saved_file_path"
        const val EXTRA_ERROR_MESSAGE = "extra_error_message"
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            Constants.ACTION_START_RECORDING -> startRecording(intent)
            Constants.ACTION_STOP_RECORDING -> stopRecording()
        }
        return START_NOT_STICKY
    }

    private fun startRecording(intent: Intent) {
        try {
            // Immediately enter foreground to satisfy Android's timeout for foreground services.
            startForeground(Constants.NOTIF_ID, buildNotification("Preparing recording"))

            val resultCode = intent.getIntExtra(Constants.EXTRA_RESULT_CODE, Integer.MIN_VALUE)
            val data: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(Constants.EXTRA_RESULT_DATA, Intent::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Constants.EXTRA_RESULT_DATA)
            }
            val fallback = ProjectionPermissionStore.get()
            val finalResultCode = if (resultCode != Integer.MIN_VALUE) resultCode else fallback?.first ?: Integer.MIN_VALUE
            val finalData = data ?: fallback?.second

            if (finalResultCode == Integer.MIN_VALUE || finalData == null) {
                Log.e(Constants.TAG, "Missing MediaProjection permission data (code=$finalResultCode). Service cannot start recording.")
                // Notify activity if it's still listening
                sendBroadcast(Intent(BROADCAST_RECORDING_ERROR).apply {
                    putExtra(EXTRA_ERROR_MESSAGE, "Permission data missing. Please try again.")
                })
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return
            }

            val metrics = DisplayMetrics()
            val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealMetrics(metrics)
            val width = metrics.widthPixels
            val height = metrics.heightPixels
            val density = metrics.densityDpi

            val outDir = File(getExternalFilesDir(null), "recordings").apply { mkdirs() }
            outputFile = File(outDir, "recording_${System.currentTimeMillis()}.mp4")

            recorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setOutputFile(outputFile!!.absolutePath)
                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setVideoEncodingBitRate(8_000_000)
                setVideoFrameRate(30)
                setVideoSize(width, height)
                prepare()
            }

            val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = mpm.getMediaProjection(finalResultCode, finalData)

            // Android 14 (API 34) requires registering a callback BEFORE creating a virtual display.
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.i(Constants.TAG, "MediaProjection stopped by system")
                    stopRecording()
                }
            }, null)

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "SmartClassroomRecorder",
                width,
                height,
                density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                recorder?.surface,
                null,
                null
            )

            recorder?.start()
            Log.i(Constants.TAG, "Recording started: ${outputFile?.absolutePath}")
        } catch (e: Exception) {
            Log.e(Constants.TAG, "Failed to start recording: ${e.message}", e)
            stopSelf()
        }
    }

    private fun stopRecording() {
        try {
            if (recorder == null) {
                Log.w(Constants.TAG, "Stop requested but recorder not running")
            }
            recorder?.run {
                try {
                    stop()
                } catch (e: Exception) {
                    // stop() may throw if recording was too short.
                    Log.e(Constants.TAG, "Recorder stop error: ${e.message}", e)
                }
                reset()
                release()
            }
            recorder = null

            virtualDisplay?.release()
            virtualDisplay = null

            mediaProjection?.stop()
            mediaProjection = null

            val path = outputFile?.absolutePath
            ProjectionPermissionStore.clear()
            Log.i(Constants.TAG, "Recording stopped. Saved file=$path")

            // Broadcast to Dashboard to trigger upload flow.
            if (!path.isNullOrBlank()) {
                Log.d(Constants.TAG, "SERVICE: Sending STOPPED broadcast for path: $path")
                val b = Intent(BROADCAST_RECORDING_STOPPED).apply {
                    setPackage(packageName) // Explicitly target our own app
                    putExtra(EXTRA_SAVED_FILE_PATH, path)
                }
                sendBroadcast(b)
                Log.d(Constants.TAG, "SERVICE: Broadcast sent successfully.")
            } else {
                Log.e(Constants.TAG, "SERVICE: Cannot broadcast because path is null!")
            }
        } finally {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun buildNotification(text: String): Notification {
        val intent = Intent(this, DashboardActivity::class.java)
        val pi = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, Constants.NOTIF_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_name)
            .setContentTitle("Screen recording")
            .setContentText(text)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                Constants.NOTIF_CHANNEL_ID,
                Constants.NOTIF_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }
}

