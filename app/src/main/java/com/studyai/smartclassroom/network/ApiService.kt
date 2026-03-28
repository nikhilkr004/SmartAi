package com.studyai.smartclassroom.network

import com.studyai.smartclassroom.model.ResponseModel
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface ApiService {

    /**
     * Now accepts a JSON body with fileUrl (Firebase Storage path).
     */
    @POST("process")
    suspend fun processRecording(
        @Header("Authorization") authHeader: String,
        @Body request: Map<String, String>
    ): Response<ResponseModel>
}
