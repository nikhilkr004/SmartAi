package com.studyai.smartclassroom.network

import com.studyai.smartclassroom.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Central Retrofit builder. Change backend URL in app/build.gradle.kts BuildConfig.BASE_URL.
 */
object RetrofitClient {

    private val logging = HttpLoggingInterceptor().apply {
        // Use HEADERS in debug to avoid garbled binary output from file uploads.
        // Change to Level.BODY if you need to debug JSON responses/requests specifically.
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.HEADERS
        else HttpLoggingInterceptor.Level.BASIC
    }

    private val okHttp = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(180, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)
        .addInterceptor(logging)
        .build()

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(okHttp)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val api: ApiService by lazy { retrofit.create(ApiService::class.java) }
}

