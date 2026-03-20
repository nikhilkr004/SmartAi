package com.studyai.smartclassroom.ui.profile

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.firebase.auth.FirebaseAuth
import android.net.Uri
import androidx.activity.result.contract.ActivityResultContracts
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.studyai.smartclassroom.ui.auth.LoginActivity
import com.studyai.smartclassroom.ui.dashboard.HistoryAdapter
import com.studyai.smartclassroom.ui.result.ResultActivity
import com.studyai.smartclassroom.utils.Constants
import com.google.firebase.firestore.Query
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.ui.library.LibraryActivity
import com.studyai.smartclassroom.ui.pdf.PdfViewerActivity
import com.studyai.smartclassroom.ui.dashboard.DashboardActivity
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class ProfileActivity : AppCompatActivity() {

    private lateinit var binding: ActivityProfileBinding
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    private val favoritesAdapter = com.studyai.smartclassroom.ui.library.RecentlyViewedAdapter { recordingId ->
        openPdfViewer(recordingId)
    }

    private val imagePicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            binding.ivAvatar.setImageURI(it)
            Toast.makeText(this, "Profile picture updated locally!", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        loadUserData()
        loadStats()
        loadFavoritesHorizontal()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.recyclerFavoritesHorizontal.apply {
            layoutManager = LinearLayoutManager(this@ProfileActivity, LinearLayoutManager.HORIZONTAL, false)
            adapter = favoritesAdapter
        }

        binding.btnEditAvatar.setOnClickListener { imagePicker.launch("image/*") }
        binding.btnEditProfile.setOnClickListener { imagePicker.launch("image/*") }

        binding.btnSeeAllFavorites.setOnClickListener {
            startActivity(Intent(this, com.studyai.smartclassroom.ui.library.LibraryActivity::class.java))
        }

        binding.btnLogOutTab.setOnClickListener {
            showLogoutDialog()
        }

        // Settings items
        binding.rowNotifications.tvRowTitle.text = "Notifications"
        binding.rowNotifications.ivRowIcon.setImageResource(R.drawable.ic_settings_notifications)
        
        binding.rowPrivacy.tvRowTitle.text = "Privacy & Security"
        binding.rowPrivacy.ivRowIcon.setImageResource(R.drawable.ic_settings_privacy)
        
        binding.rowStorage.tvRowTitle.text = "Cloud Backup"
        binding.rowStorage.ivRowIcon.setImageResource(R.drawable.ic_settings_storage)

        // Bottom Nav Wiring
        binding.layoutBottomNav.btnNavHome.setOnClickListener { finish() }
        binding.layoutBottomNav.btnNavLibrary.setOnClickListener { 
            startActivity(Intent(this, com.studyai.smartclassroom.ui.library.LibraryActivity::class.java))
            finish()
        }
    }

    private fun showLogoutDialog() {
        val dialogView = layoutInflater.inflate(R.layout.layout_logout_dialog, null)
        val dialog = MaterialAlertDialogBuilder(this, R.style.ThemeOverlay_MaterialComponents_MaterialAlertDialog_Centered)
            .setView(dialogView)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        dialogView.findViewById<View>(R.id.btnCancel).setOnClickListener {
            dialog.dismiss()
        }

        dialogView.findViewById<View>(R.id.btnConfirmLogout).setOnClickListener {
            dialog.dismiss()
            auth.signOut()
            val intent = Intent(this, com.studyai.smartclassroom.ui.dashboard.DashboardActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            startActivity(intent)
            finish()
        }

        dialog.show()
    }

    private fun loadUserData() {
        val user = auth.currentUser
        binding.tvUserName.text = user?.displayName ?: "Scholar Student"
        // Title placeholder as per mockup
    }

    private fun loadStats() {
        val userId = auth.currentUser?.uid ?: return
        
        lifecycleScope.launch {
            try {
                val recordingsSnapshot = db.collection("recordings")
                    .whereEqualTo("userId", userId)
                    .get()
                    .await()
                
                binding.tvSessionsCount.text = "${recordingsSnapshot.size()} Sessions"
                
                // Mock stats for other fields as per mockup visual
                binding.tvStudyTime.text = "${recordingsSnapshot.size() * 15}m" 
                binding.tvGuidesRead.text = "${recordingsSnapshot.size()}"
                
            } catch (e: Exception) { }
        }
    }

    private fun loadFavoritesHorizontal() {
        val userId = auth.currentUser?.uid ?: return

        lifecycleScope.launch {
            try {
                val snapshot = db.collection("recordings")
                    .whereEqualTo("userId", userId)
                    .whereEqualTo("isFavorite", true)
                    .get()
                    .await()

                val items = snapshot.documents.map { doc ->
                    val data = doc.data?.toMutableMap() ?: mutableMapOf()
                    data["id"] = doc.id
                    data
                }.sortedByDescending { it["timestamp"] as? com.google.firebase.Timestamp }
                
                favoritesAdapter.submit(items)
            } catch (e: Exception) { }
        }
    }

    private fun openPdfViewer(recordingId: String) {
        lifecycleScope.launch {
            try {
                val doc = db.collection("recordings").document(recordingId).get().await()
                val pdfUrl = doc.getString("pdfUrl")
                val topic = doc.getString("topic")
                
                if (!pdfUrl.isNullOrBlank()) {
                    val intent = Intent(this@ProfileActivity, com.studyai.smartclassroom.ui.pdf.PdfViewerActivity::class.java).apply {
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
