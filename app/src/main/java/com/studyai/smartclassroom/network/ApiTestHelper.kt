package com.studyai.smartclassroom.network

import android.util.Log
import com.studyai.smartclassroom.utils.Constants
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Temporary connectivity test helper.
 *
 * Updated for Direct-to-Storage: Sends a JSON body with a test storage path.
 */
object ApiTestHelper {

    fun testProcessEndpoint(
        token: String,
        scope: CoroutineScope = CoroutineScope(Dispatchers.Main)
    ) {
        scope.launch {
            try {
                Log.d(Constants.TAG, "API TEST: Sending JSON request to /process...")
                
                val requestBody = mapOf(
                    "fileUrl" to "test_recordings/identity_check.mp4",
                    "contentType" to "General",
                    "topic" to "Connectivity Test"
                )

                val resp = withContext(Dispatchers.IO) {
                    RetrofitClient.api.processRecording("Bearer $token", requestBody)
                }

                if (resp.isSuccessful || resp.code() == 202) {
                    Log.i(Constants.TAG, "API TEST SUCCESS: Status ${resp.code()} Response: ${resp.body()}")
                } else {
                    val errorText = resp.errorBody()?.string()
                    Log.e(Constants.TAG, "API TEST FAILED: HTTP ${resp.code()} Body: $errorText")
                }
            } catch (e: Exception) {
                Log.e(Constants.TAG, "API TEST CRASH: ${e.message}", e)
            }
        }
    }
}
