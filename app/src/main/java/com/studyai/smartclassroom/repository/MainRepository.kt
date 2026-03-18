package com.studyai.smartclassroom.repository

import android.net.Uri
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.studyai.smartclassroom.model.ResponseModel
import com.studyai.smartclassroom.network.RetrofitClient
import com.studyai.smartclassroom.utils.Constants
import kotlinx.coroutines.tasks.await
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.UUID

/**
 * Repository hides data sources (network + Firestore) from ViewModel.
 */
class MainRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {

    fun currentUserId(): String? = auth.currentUser?.uid

    suspend fun saveUserProfile(name: String?, email: String?, photoUrl: String?) {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val payload = hashMapOf(
            "name" to (name ?: ""),
            "email" to (email ?: ""),
            "profilePic" to (photoUrl ?: ""),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        db.collection(Constants.COLLECTION_USERS).document(uid).set(payload).await()
    }

    suspend fun uploadRecordingToBackend(file: File, userId: String): ResponseModel {
        val userIdBody = userId.toRequestBody("text/plain".toMediaTypeOrNull())
        val fileBody = file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
        val filePart = MultipartBody.Part.createFormData("file", file.name, fileBody)

        val resp = RetrofitClient.api.processRecording(filePart, userIdBody)
        if (!resp.isSuccessful) {
            val err = resp.errorBody()?.string()
            throw RuntimeException("Backend error: HTTP ${resp.code()} ${err ?: ""}".trim())
        }
        return resp.body() ?: throw RuntimeException("Backend returned empty body")
    }

    suspend fun saveRecordingResult(
        transcript: String,
        notes: String,
        pdfUrl: String,
        localFilePath: String
    ): String {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val id = UUID.randomUUID().toString()
        val payload = hashMapOf(
            "id" to id,
            "userId" to uid,
            "transcript" to transcript,
            "notes" to notes,
            "pdfUrl" to pdfUrl,
            "localFilePath" to localFilePath,
            "createdAt" to FieldValue.serverTimestamp()
        )
        db.collection(Constants.COLLECTION_RECORDINGS).document(id).set(payload).await()
        return id
    }

    suspend fun fetchHistory(): List<Map<String, Any?>> {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val snap = db.collection(Constants.COLLECTION_RECORDINGS)
            .whereEqualTo("userId", uid)
            .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .get()
            .await()

        return snap.documents.map { doc ->
            doc.data.orEmpty() + mapOf("id" to doc.id)
        }
    }

    suspend fun getRecordingById(id: String): Map<String, Any?>? {
        val doc = db.collection(Constants.COLLECTION_RECORDINGS).document(id).get().await()
        return doc.data?.plus(mapOf("id" to doc.id))
    }
}

