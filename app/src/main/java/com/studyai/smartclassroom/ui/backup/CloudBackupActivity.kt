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
import android.content.res.ColorStateList
import android.graphics.Color
import android.util.TypedValue
import android.widget.Toast
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.studyai.smartclassroom.databinding.LayoutProUpgradeDialogBinding

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
            showProUpgradeDialog()
        }
    }

    private fun showProUpgradeDialog() {
        val dialog = BottomSheetDialog(this, R.style.TransparentBottomSheetDialog)
        val dialogBinding = LayoutProUpgradeDialogBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)

        var selectedPlan = "yearly"

        dialogBinding.planMonthly.setOnClickListener {
            selectedPlan = "monthly"
            dialogBinding.planMonthly.strokeWidth = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 2f, resources.displayMetrics).toInt()
            dialogBinding.planMonthly.setStrokeColor(ColorStateList.valueOf(Color.parseColor("#008080")))
            dialogBinding.planMonthly.setCardBackgroundColor(Color.parseColor("#F1F8F9"))

            dialogBinding.planYearly.strokeWidth = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1f, resources.displayMetrics).toInt()
            dialogBinding.planYearly.setStrokeColor(ColorStateList.valueOf(Color.parseColor("#EEF2F5")))
            dialogBinding.planYearly.setCardBackgroundColor(Color.parseColor("#F8F9FA"))
        }

        dialogBinding.planYearly.setOnClickListener {
            selectedPlan = "yearly"
            dialogBinding.planYearly.strokeWidth = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 2f, resources.displayMetrics).toInt()
            dialogBinding.planYearly.setStrokeColor(ColorStateList.valueOf(Color.parseColor("#008080")))
            dialogBinding.planYearly.setCardBackgroundColor(Color.parseColor("#F1F8F9"))

            dialogBinding.planMonthly.strokeWidth = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1f, resources.displayMetrics).toInt()
            dialogBinding.planMonthly.setStrokeColor(ColorStateList.valueOf(Color.parseColor("#EEF2F5")))
            dialogBinding.planMonthly.setCardBackgroundColor(Color.parseColor("#F8F9FA"))
        }

        dialogBinding.btnUpgradeNow.setOnClickListener {
            updateToPro(dialog)
        }

        dialogBinding.btnMaybeLater.setOnClickListener {
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun updateToPro(dialog: BottomSheetDialog) {
        val userId = auth.currentUser?.uid ?: return
        
        db.collection("users").document(userId)
            .update(mapOf("planType" to "pro", "limit" to null))
            .addOnSuccessListener {
                dialog.dismiss()
                Toast.makeText(this, "Welcome to Aero Pro! 🚀", Toast.LENGTH_LONG).show()
                loadBackupStatus() // Refresh current screen
            }
            .addOnFailureListener {
                Toast.makeText(this, "Upgrade failed. Please try again.", Toast.LENGTH_SHORT).show()
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
