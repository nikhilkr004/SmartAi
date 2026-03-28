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
    @SerializedName("pdfUrl") @SerializedName("pdf_url") val pdfUrl: String = "", // Handle both naming conventions
    @SerializedName("videoUrl") @SerializedName("video_url") val videoUrl: String = ""
)

