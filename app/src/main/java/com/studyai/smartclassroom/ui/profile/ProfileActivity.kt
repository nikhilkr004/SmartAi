package com.studyai.smartclassroom.ui.profile

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.studyai.smartclassroom.databinding.ActivityProfileBinding
import com.studyai.smartclassroom.ui.auth.LoginActivity
import com.studyai.smartclassroom.ui.dashboard.HistoryAdapter
import com.studyai.smartclassroom.ui.result.ResultActivity
import com.studyai.smartclassroom.utils.Constants
import com.studyai.smartclassroom.viewmodel.MainViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class ProfileActivity : AppCompatActivity() {

    private lateinit var binding: ActivityProfileBinding
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    private val favoritesAdapter = HistoryAdapter { recordingId ->
        openPdfViewer(recordingId)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        loadUserData()
        loadFavoritesPreview()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.recyclerFavorites.apply {
            layoutManager = LinearLayoutManager(this@ProfileActivity)
            adapter = favoritesAdapter
        }

        binding.btnSeeAllFavorites.setOnClickListener {
            startActivity(Intent(this, LibraryActivity::class.java))
        }

        binding.btnLogout.setOnClickListener {
            auth.signOut()
            val intent = Intent(this, DashboardActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }

        // Settings items
        binding.rowAccount.tvRowTitle.text = "Account Settings"
        binding.rowNotifications.tvRowTitle.text = "Notification Preferences"
        binding.rowNotifications.ivRowIcon.setImageResource(R.drawable.ic_settings_notifications)
        binding.rowStorage.tvRowTitle.text = "Storage Management"
        binding.rowStorage.ivRowIcon.setImageResource(R.drawable.ic_settings_storage)
        binding.rowPrivacy.tvRowTitle.text = "Privacy Policy"
        binding.rowPrivacy.ivRowIcon.setImageResource(R.drawable.ic_settings_privacy)

        // Bottom Nav Wiring
        binding.btnNavHome.setOnClickListener { finish() }
        binding.btnNavLibrary.setOnClickListener { 
            startActivity(Intent(this, LibraryActivity::class.java))
            finish()
        }
    }

    private fun loadUserData() {
        val user = auth.currentUser
        binding.tvUserName.text = user?.displayName ?: "Guest Student"
        binding.tvUserEmail.text = user?.email ?: "No email linked"
        // ID is usually backend generated, placeholders for now
        binding.tvUserId.text = "ID: ${user?.uid?.takeLast(10)?.uppercase() ?: "GUEST"}"
    }

    private fun loadFavoritesPreview() {
        val userId = auth.currentUser?.uid ?: return

        lifecycleScope.launch {
            try {
                val snapshot = db.collection("recordings")
                    .whereEqualTo("userId", userId)
                    .whereEqualTo("isFavorite", true)
                    .orderBy("timestamp", Query.Direction.DESCENDING)
                    .limit(2) // Just a preview
                    .get()
                    .await()

                val items = snapshot.documents.map { doc ->
                    val data = doc.data?.toMutableMap() ?: mutableMapOf()
                    data["id"] = doc.id
                    data
                }
                
                favoritesAdapter.submit(items)
            } catch (e: Exception) {
                // Ignore preview errors
            }
        }
    }

    private fun openPdfViewer(recordingId: String) {
        lifecycleScope.launch {
            try {
                val doc = db.collection("recordings").document(recordingId).get().await()
                val pdfUrl = doc.getString("pdfUrl")
                val topic = doc.getString("topic")
                
                if (!pdfUrl.isNullOrBlank()) {
                    val intent = Intent(this@ProfileActivity, PdfViewerActivity::class.java).apply {
                        putExtra(Constants.EXTRA_PDF_URL, pdfUrl)
                        putExtra(Constants.EXTRA_TOPIC, topic)
                        putExtra(Constants.EXTRA_RECORDING_ID, recordingId)
                    }
                    startActivity(intent)
                }
            } catch (e: Exception) { }
        }
    }
}
