package com.studyai.smartclassroom.network

import com.studyai.smartclassroom.model.ResponseModel
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

/**
 * Retrofit API definitions. Backend expected:
 * POST /process multipart/form-data:
 * - file: audio/video file
 * - user_id: string
 */
interface ApiService {

    @Multipart
    @POST("process")
    suspend fun processRecording(
        @Header("Authorization") authHeader: String,
        @Part file: MultipartBody.Part,
        @Part("contentType") contentType: RequestBody,
        @Part("topic") topic: RequestBody
    ): Response<ResponseModel>
}

