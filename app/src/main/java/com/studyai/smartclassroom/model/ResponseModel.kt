package com.studyai.smartclassroom.model

import com.google.gson.annotations.SerializedName

/**
 * Backend response model for /process.
 */
data class ResponseModel(
    @SerializedName("transcript") val transcript: String = "",
    @SerializedName("notes") val notes: String = "",
    @SerializedName("pdf_url") val pdfUrl: String = "",
    @SerializedName("video_url") val videoUrl: String = ""
)

