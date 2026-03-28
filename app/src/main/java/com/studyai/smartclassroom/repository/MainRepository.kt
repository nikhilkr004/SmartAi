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
import java.io.File
import java.util.UUID

/**
 * Repository hides data sources (network + Firestore) from ViewModel.
 * Optimized for Direct-to-Storage upload to bypass 504 Gateway Timeouts.
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
    }

    suspend fun saveUserProfile(name: String?, email: String?, photoUrl: String?) {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("User not logged in")
        val docRef = db.collection(Constants.COLLECTION_USERS).document(uid)
        val snap = docRef.get().await()

        if (!snap.exists()) {
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
        } else {
            val updates = mutableMapOf<String, Any>("updatedAt" to FieldValue.serverTimestamp())
            name?.let { updates["name"] = it }
            email?.let { updates["email"] = it }
            photoUrl?.let { updates["profilePic"] = it }
            docRef.update(updates).await()
        }
    }

    /**
     * UPLOAD STRATEGY: 
     * 1. Upload file directly to Firebase Storage (No 30s limit).
     * 2. Send storage path to backend as a small JSON request.
     * 3. Poll Firestore for AI results.
     */
    suspend fun uploadRecordingToBackend(file: File, contentType: String, topic: String): ResponseModel {
        val user = auth.currentUser ?: throw IllegalStateException("User not logged in")
        val uid = user.uid
        val jobId = UUID.randomUUID().toString()
        val storagePath = "recordings/$uid/$jobId-${file.name}"
        
        Log.d(Constants.TAG, "STEP 1/3: Uploading to Firebase Storage: $storagePath")
        val storageRef = storage.reference.child(storagePath)
        storageRef.putFile(Uri.fromFile(file)).await()
        
        Log.d(Constants.TAG, "STEP 2/3: Notifying backend via /process")
        val tokenResult = user.getIdToken(true).await()
        val token = tokenResult.token ?: throw IllegalStateException("Failed to get ID token")
        
        val requestBody = mapOf(
            "fileUrl" to storagePath,
            "contentType" to contentType,
            "topic" to topic
        )
        
        val resp = RetrofitClient.api.processRecording("Bearer $token", requestBody)
        
        if (!resp.isSuccessful && resp.code() != 202) {
            val err = resp.errorBody()?.string()
            Log.e(Constants.TAG, "BACKEND ERROR: HTTP ${resp.code()} Body: $err")
            throw RuntimeException("Backend error: HTTP ${resp.code()}")
        }
        
        val initialBody = resp.body() ?: throw RuntimeException("Empty response from backend")
        val serverJobId = initialBody.jobId ?: jobId

        Log.i(Constants.TAG, "STEP 3/3: Polling Firestore for results (Job: $serverJobId)...")
        
        var attempts = 0
        while (attempts < 60) { 
            kotlinx.coroutines.delay(5000)
            val snap = db.collection(Constants.COLLECTION_JOBS).document(serverJobId).get().await()
            val status = snap.getString("status")
            Log.d(Constants.TAG, "Polling Status: $status (Attempt ${attempts + 1}/60)")

            if (status == "success") {
                Log.i(Constants.TAG, "AI PROCESSING COMPLETED!")
                return ResponseModel(
                    transcript = snap.getString("transcript") ?: "",
                    notes = snap.getString("notes") ?: "",
                    pdfUrl = snap.getString("pdfUrl") ?: "",
                    videoUrl = snap.getString("videoUrl") ?: ""
                )
            } else if (status == "error") {
                val error = snap.getString("error") ?: "AI Processing Error"
                throw RuntimeException("AI Error: $error")
            }
            attempts++
        }

        throw RuntimeException("AI processing timed out. Please check your library later.")
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
        db.collection(Constants.COLLECTION_RECORDINGS).document(id).set(payload).await()
        db.collection(Constants.COLLECTION_USERS).document(uid).update("aiSummariesCount", FieldValue.increment(1))
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
