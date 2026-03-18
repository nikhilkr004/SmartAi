package com.studyai.smartclassroom.utils

/**
 * Central place for constants used across the app.
 */
object Constants {
    const val TAG = "SmartClassroom"

    // Firestore
    const val COLLECTION_USERS = "users"
    const val COLLECTION_RECORDINGS = "recordings"

    // Intent extras
    const val EXTRA_TRANSCRIPT = "extra_transcript"
    const val EXTRA_NOTES = "extra_notes"
    const val EXTRA_PDF_URL = "extra_pdf_url"
    const val EXTRA_RECORDING_ID = "extra_recording_id"

    // Screen recording service actions
    const val ACTION_START_RECORDING = "action_start_recording"
    const val ACTION_STOP_RECORDING = "action_stop_recording"

    // MediaProjection intent extras
    const val EXTRA_RESULT_CODE = "extra_result_code"
    const val EXTRA_RESULT_DATA = "extra_result_data"

    // Notification
    const val NOTIF_CHANNEL_ID = "screen_record_channel"
    const val NOTIF_CHANNEL_NAME = "Screen Recording"
    const val NOTIF_ID = 1001
}

