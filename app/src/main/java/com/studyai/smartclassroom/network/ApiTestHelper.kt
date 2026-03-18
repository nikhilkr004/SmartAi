package com.studyai.smartclassroom.network

import android.util.Log
import com.studyai.smartclassroom.utils.Constants
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

/**
 * Temporary connectivity test helper.
 *
 * Call this once (e.g., after login) to verify your backend is reachable and the multipart contract works.
 * It logs:
 * - success response body
 * - or full error body + exception message
 */
object ApiTestHelper {

    fun testProcessEndpoint(
        token: String,
        file: File,
        scope: CoroutineScope = CoroutineScope(Dispatchers.Main)
    ) {
        scope.launch {
            try {
                Log.d(Constants.TAG, "API TEST: File = ${file.name}, size = ${file.length()}")
                val fileBody = file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
                val filePart = MultipartBody.Part.createFormData("file", file.name, fileBody)

                Log.d(Constants.TAG, "API TEST: Sending request to /process...")
                val resp = withContext(Dispatchers.IO) {
                    RetrofitClient.api.processRecording("Bearer $token", filePart)
                }

                if (resp.isSuccessful) {
                    Log.i(Constants.TAG, "API TEST SUCCESS: Response: ${resp.body()}")
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

