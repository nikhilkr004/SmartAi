package com.studyai.smartclassroom.ui.library

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.studyai.smartclassroom.databinding.ActivityLibraryBinding
import com.studyai.smartclassroom.ui.pdf.PdfViewerActivity
import com.studyai.smartclassroom.utils.Constants
import com.studyai.smartclassroom.ui.profile.ProfileActivity
import com.studyai.smartclassroom.ui.dashboard.DashboardActivity
import com.studyai.smartclassroom.R
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class LibraryActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLibraryBinding
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    
    private val favoritesAdapter = LibraryAdapter { recordingId ->
        openPdfViewer(recordingId)
    }
    
    private val recentAdapter = RecentlyViewedAdapter { recordingId ->
        openPdfViewer(recordingId)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLibraryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        loadLibraryData()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { finish() }
        
        binding.recyclerFavorites.apply {
            layoutManager = LinearLayoutManager(this@LibraryActivity)
            adapter = favoritesAdapter
        }
        
        binding.recyclerRecent.apply {
            layoutManager = LinearLayoutManager(this@LibraryActivity, LinearLayoutManager.HORIZONTAL, false)
            adapter = recentAdapter
        }

        setupBottomNav()
    }

    private fun setupBottomNav() {
        val nav = binding.layoutBottomNav
        
        // Highlight Library
        nav.btnNavLibrary.setBackgroundResource(R.drawable.bg_badge_pdf)
        nav.ivNavLibrary.setColorFilter(androidx.core.content.ContextCompat.getColor(this, R.color.primary_teal))
        nav.tvNavLibrary.setTextColor(androidx.core.content.ContextCompat.getColor(this, R.color.primary_teal))
        nav.tvNavLibrary.setTypeface(null, android.graphics.Typeface.BOLD)

        nav.btnNavHome.setOnClickListener {
            startActivity(Intent(this, DashboardActivity::class.java))
            finish()
        }
        nav.btnNavLibrary.setOnClickListener {
            Toast.makeText(this, "You are already here! ✨", Toast.LENGTH_SHORT).show()
        }
        nav.btnNavRecordings.setOnClickListener {
            // Already in Library/History
            Toast.makeText(this, "You are already in your collection! 📚", Toast.LENGTH_SHORT).show()
        }
        nav.btnNavProfile.setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
            finish()
        }
    }

    private fun loadLibraryData() {
        val userId = auth.currentUser?.uid ?: return

        lifecycleScope.launch {
            try {
                // Fetch Favorites
                val favSnapshot = db.collection("recordings")
                    .whereEqualTo("userId", userId)
                    .whereEqualTo("isFavorite", true)
                    .get()
                    .await()

                val favItems = favSnapshot.documents.map { doc ->
                    val data = doc.data?.toMutableMap() ?: mutableMapOf()
                    data["id"] = doc.id
                    data
                }.sortedByDescending { it["timestamp"] as? com.google.firebase.Timestamp }
                
                favoritesAdapter.submit(favItems)

                // Fetch Recent for the top carousel (e.g. last 5)
                val recentSnapshot = db.collection("recordings")
                    .whereEqualTo("userId", userId)
                    .orderBy("lastOpened", Query.Direction.DESCENDING)
                    .limit(5)
                    .get()
                    .await()
                
                val recentItems = recentSnapshot.documents.map { doc ->
                    val data = doc.data?.toMutableMap() ?: mutableMapOf()
                    data["id"] = doc.id
                    data
                }
                recentAdapter.submit(recentItems)

            } catch (e: Exception) {
                Toast.makeText(this@LibraryActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
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
                    val intent = Intent(this@LibraryActivity, PdfViewerActivity::class.java).apply {
                        putExtra(Constants.EXTRA_PDF_URL, pdfUrl)
                        putExtra(Constants.EXTRA_TOPIC, topic)
                        putExtra(Constants.EXTRA_RECORDING_ID, recordingId)
                    }
                    startActivity(intent)
                }
            } catch (e: Exception) {
                Toast.makeText(this@LibraryActivity, "Failed to load PDF", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
