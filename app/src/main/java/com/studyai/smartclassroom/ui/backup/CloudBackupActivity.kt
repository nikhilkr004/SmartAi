package com.studyai.smartclassroom.ui.backup

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.databinding.ActivityCloudBackupBinding
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class CloudBackupActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCloudBackupBinding
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCloudBackupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        loadBackupStatus()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        // Advanced Options setup
        binding.rowEncryption.tvRowTitle.text = "End-to-End Encryption"
        binding.rowEncryption.ivRowIcon.setImageResource(R.drawable.ic_settings_privacy)

        binding.rowSchedule.tvRowTitle.text = "Scheduled Backups"
        binding.rowSchedule.ivRowIcon.setImageResource(R.drawable.ic_settings_notifications)
        binding.rowSchedule.tvRowValue.visibility = View.VISIBLE
        binding.rowSchedule.tvRowValue.text = "Daily, 2 AM"

        binding.rowManage.tvRowTitle.text = "Manage Storage"
        binding.rowManage.ivRowIcon.setImageResource(R.drawable.ic_settings_storage)

        binding.btnGoProNow.setOnClickListener {
            // Handle Pro Upgrade
        }
    }

    private fun loadBackupStatus() {
        val userId = auth.currentUser?.uid ?: return

        lifecycleScope.launch {
            try {
                // 1. Get Plan Type
                val userDoc = db.collection("users").document(userId).get().await()
                val planType = userDoc.getString("planType") ?: "free"
                
                // 2. Count PDFs
                val recordingsSnapshot = db.collection("recordings")
                    .whereEqualTo("userId", userId)
                    .get()
                    .await()
                
                val count = recordingsSnapshot.size()
                val limit = 5
                
                updateUI(count, limit, planType)

            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    private fun updateUI(count: Int, limit: Int, planType: String) {
        val percentage = if (planType == "pro") 0 else (count * 100) / limit
        
        binding.storageProgress.progress = percentage
        binding.tvPercentage.text = "$percentage%"
        
        if (planType == "pro") {
            binding.tvProgressLabel.text = "Storage Used: Unlimited (Pro Plan)"
            binding.tvStatusSubtitle.text = "Premium Protection Active"
            binding.cardUpgrade.visibility = View.GONE
        } else {
            binding.tvProgressLabel.text = "Storage Used: $count / $limit PDF Limit"
            
            if (count >= limit) {
                // Limit reached UI
                binding.tvStatusSubtitle.text = "PDF limit reached"
                binding.ivStatusIcon.setImageResource(R.drawable.ic_settings_storage)
                binding.iconContainer.setCardBackgroundColor(android.graphics.Color.parseColor("#FFEBEF"))
                binding.ivStatusIcon.setColorFilter(android.graphics.Color.parseColor("#D32F2F"))
                
                binding.storageProgress.setIndicatorColor(android.graphics.Color.parseColor("#D32F2F"))
                binding.tvPercentage.setTextColor(android.graphics.Color.parseColor("#D32F2F"))
                
                binding.btnBackupNow.text = "Storage Full"
                binding.btnBackupNow.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#ECEFF1"))
                binding.btnBackupNow.setTextColor(android.graphics.Color.parseColor("#90A4AE"))
                
                binding.cardUpgrade.visibility = View.VISIBLE
            } else {
                binding.tvStatusSubtitle.text = "Your data is safe"
                binding.cardUpgrade.visibility = View.GONE
            }
        }
    }
}
