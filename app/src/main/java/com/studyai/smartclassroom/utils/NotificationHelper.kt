package com.studyai.smartclassroom.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.ui.result.ResultActivity

object NotificationHelper {

    private const val CHANNEL_ID = "study_updates"
    private const val CHANNEL_NAME = "Study AI Updates"
    private const val CHANNEL_DESC = "Notifications for PDF generation and study plan updates"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = CHANNEL_DESC
            }
            val notificationManager: NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showPdfReadyNotification(
        context: Context,
        title: String,
        transcript: String,
        notes: String,
        pdfUrl: String,
        recordingId: String
    ) {
        val intent = Intent(context, ResultActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra(Constants.EXTRA_TRANSCRIPT, transcript)
            putExtra(Constants.EXTRA_NOTES, notes)
            putExtra(Constants.EXTRA_PDF_URL, pdfUrl)
            putExtra(Constants.EXTRA_RECORDING_ID, recordingId)
        }
        
        val pendingIntent: PendingIntent = PendingIntent.getActivity(
            context, 
            recordingId.hashCode(), 
            intent, 
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_study_cap)
            .setContentTitle("PDF Notes Ready! 💎")
            .setContentText("Your masterclass guide for '$title' is ready to view.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)

        with(NotificationManagerCompat.from(context)) {
            try {
                notify(recordingId.hashCode(), builder.build())
            } catch (e: SecurityException) {
                // Permission not granted
            }
        }
    }
}
