package com.studyai.smartclassroom.repository

import android.net.Uri
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
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
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val storage: FirebaseStorage = FirebaseStorage.getInstance()
) {

    fun currentUserId(): String? = auth.currentUser?.uid

    suspend fun uploadProfileImage(uri: Uri): String {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val ref = storage.reference.child("profile_images/$uid.jpg")
        ref.putFile(uri).await()
        return ref.downloadUrl.await().toString()
    }

    suspend fun updateUserProfile(name: String?, photoUrl: String?) {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val docRef = db.collection(Constants.COLLECTION_USERS).document(uid)
        
        val updates = mutableMapOf<String, Any>(
            "updatedAt" to FieldValue.serverTimestamp()
        )
        name?.let { updates["name"] = it }
        photoUrl?.let { updates["profilePic"] = it }
        
        docRef.update(updates).await()
        Log.d(Constants.TAG, "User profile updated for user: $uid")
    }

    suspend fun saveUserProfile(name: String?, email: String?, photoUrl: String?) {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val docRef = db.collection(Constants.COLLECTION_USERS).document(uid)
        val snap = docRef.get().await()

        if (!snap.exists()) {
            // New User Initialization
            val payload = hashMapOf(
                "name" to (name ?: ""),
                "email" to (email ?: ""),
                "profilePic" to (photoUrl ?: ""),
                "planType" to "free",
                "studyStreak" to 0L,
                "aiSummariesCount" to 0L,
                "lastActiveDate" to "",
                "limit" to 5L,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            docRef.set(payload).await()
            Log.d(Constants.TAG, "User profile initialized for new user: $uid")
        } else {
            // Existing User - Update profile sync
            val updates = mutableMapOf<String, Any>(
                "updatedAt" to FieldValue.serverTimestamp()
            )
            name?.let { updates["name"] = it }
            email?.let { updates["email"] = it }
            photoUrl?.let { updates["profilePic"] = it }
            
            docRef.update(updates).await()
            Log.d(Constants.TAG, "User profile synced for existing user: $uid")
        }
    }

    suspend fun uploadRecordingToBackend(file: File, contentType: String, topic: String): ResponseModel {
        val user = auth.currentUser ?: run {
            Log.e(Constants.TAG, "UPLOAD ERROR: User not logged in!")
            throw IllegalStateException("User not logged in")
        }
        
        Log.d(Constants.TAG, "Starting upload flow for: ${file.name} (${file.length()} bytes)")
        Log.d(Constants.TAG, "Requesting Firebase ID Token...")
        
        val tokenResult = user.getIdToken(true).await()
        val token = tokenResult.token ?: run {
            Log.e(Constants.TAG, "UPLOAD FAILED: ID Token was null!")
            throw IllegalStateException("Failed to get ID token")
        }
        
        Log.d(Constants.TAG, "Token acquired. Creating request...")
        val fileBody = file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
        val filePart = MultipartBody.Part.createFormData("file", file.name, fileBody)

        Log.d(Constants.TAG, "Calling backend /process endpoint with Type: $contentType, Topic: $topic")
        val contentTypeBody = contentType.toRequestBody("text/plain".toMediaTypeOrNull())
        val topicBody = topic.toRequestBody("text/plain".toMediaTypeOrNull())
        val resp = RetrofitClient.api.processRecording("Bearer $token", filePart, contentTypeBody, topicBody)
        
        if (!resp.isSuccessful && resp.code() != 202) {
            val err = resp.errorBody()?.string()
            Log.e(Constants.TAG, "BACKEND ERROR: HTTP ${resp.code()} Body: $err")
            throw RuntimeException("Backend error: HTTP ${resp.code()} ${err ?: ""}".trim())
        }
        
        val initialBody = resp.body() ?: throw RuntimeException("Backend returned empty body")
        val jobId = initialBody.jobId ?: return initialBody // Fallback if it returned direct result

        // --- NEW: Firestore Polling ---
        Log.i(Constants.TAG, "Job initiated: $jobId. Polling Firestore for results...")
        
        var attempts = 0
        while (attempts < 60) { // Poll for up to 5 minutes (5s * 60)
            kotlinx.coroutines.delay(5000)
            val snap = db.collection(Constants.COLLECTION_JOBS).document(jobId).get().await()
            val status = snap.getString("status")
            Log.d(Constants.TAG, "Job status: $status (Attempt ${attempts + 1}/60)")

            if (status == "success") {
                Log.i(Constants.TAG, "Job completed successfully!")
                return ResponseModel(
                    transcript = snap.getString("transcript") ?: "",
                    notes = snap.getString("notes") ?: "",
                    pdfUrl = snap.getString("pdfUrl") ?: "",
                    videoUrl = snap.getString("videoUrl") ?: ""
                )
            } else if (status == "error") {
                val error = snap.getString("error") ?: "Unknown AI processing error"
                throw RuntimeException("AI Processing Failed: $error")
            }
            attempts++
        }

        throw RuntimeException("Processing timeout. The AI is taking longer than expected. Please check your library in a few minutes.")
    }

    suspend fun saveRecordingResult(
        transcript: String,
        notes: String,
        pdfUrl: String,
        videoUrl: String,
        localFilePath: String,
        contentType: String,
        topic: String
    ): String {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val id = UUID.randomUUID().toString()
        val payload = hashMapOf(
            "id" to id,
            "userId" to uid,
            "transcript" to transcript,
            "notes" to notes,
            "pdfUrl" to pdfUrl,
            "videoUrl" to videoUrl,
            "localFilePath" to localFilePath,
            "contentType" to contentType,
            "topic" to topic,
            "createdAt" to FieldValue.serverTimestamp()
        )
        Log.d(Constants.TAG, "Saving result to Firestore for user: $uid")
        db.collection(Constants.COLLECTION_RECORDINGS).document(id).set(payload).await()
        
        // Increment AI Summary Count for the user
        db.collection(Constants.COLLECTION_USERS).document(uid)
            .update("aiSummariesCount", FieldValue.increment(1))
            
        Log.i(Constants.TAG, "FIRESTORE SUCCESS: Record saved with ID: $id")
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

    suspend fun fetchUserProfile(): Map<String, Any?>? {
        val uid = auth.currentUser?.uid ?: return null
        val doc = db.collection(Constants.COLLECTION_USERS).document(uid).get().await()
        return doc.data
    }
}

