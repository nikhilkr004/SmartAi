package com.studyai.smartclassroom.utils

import android.content.Intent

/**
 * Simple in-memory store for MediaProjection permission data.
 *
 * Some OEM builds can drop/strip nested Intent extras when starting a foreground service.
 * Storing it in-process avoids relying on parceling it through service start intents.
 */
object ProjectionPermissionStore {
    @Volatile private var resultCode: Int? = null
    @Volatile private var resultData: Intent? = null

    fun set(code: Int, data: Intent) {
        resultCode = code
        resultData = data
    }

    fun consume(): Pair<Int, Intent>? {
        val code = resultCode
        val data = resultData
        if (code == null || data == null) return null
        // Clear after read to avoid re-use.
        resultCode = null
        resultData = null
        return code to data
    }
}

