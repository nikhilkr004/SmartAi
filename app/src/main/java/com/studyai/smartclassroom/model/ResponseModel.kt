package com.studyai.smartclassroom.model

import com.google.gson.annotations.SerializedName

/**
 * Backend response model for /process.
 */
data class ResponseModel(
    @SerializedName("jobId") val jobId: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("error") val error: String? = null,
    @SerializedName("transcript") val transcript: String = "",
    @SerializedName("notes") val notes: String = "",
    @SerializedName(value = "pdfUrl", alternate = ["pdf_url"]) val pdfUrl: String = "",
    @SerializedName(value = "videoUrl", alternate = ["video_url"]) val videoUrl: String = ""
)

