package com.studyai.smartclassroom.ui.notifications

import android.content.Context
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.databinding.ActivityNotificationSettingsBinding
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class NotificationSettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityNotificationSettingsBinding
    private val prefs by lazy { getSharedPreferences("app_settings", Context.MODE_PRIVATE) }
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNotificationSettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        loadPreferences()
        loadUserData()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        // Setup individual switches
        setupSwitch(binding.switchLecture, "lecture_reminders", true)
        setupSwitch(binding.switchMaterials, "new_materials", true)
        setupSwitch(binding.switchStreaks, "study_streaks", false)
        
        setupSwitch(binding.switchEmailSummary, "weekly_summary", true)
        setupSwitch(binding.switchBadges, "library_badges", true)
        setupSwitch(binding.switchSocial, "social_invites", false)
    }

    private fun setupSwitch(switch: com.google.android.material.switchmaterial.SwitchMaterial, key: String, default: Boolean) {
        switch.isChecked = prefs.getBoolean(key, default)
        switch.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(key, isChecked).apply()
            val msg = if (isChecked) "Enabled" else "Disabled"
            Toast.makeText(this, "${key.replace("_", " ").capitalize()} $msg", Toast.LENGTH_SHORT).show()
        }
    }

    private fun loadPreferences() {
        // Already handled in setupSwitch for initial state
    }

    private fun loadUserData() {
        val userId = auth.currentUser?.uid ?: return
        lifecycleScope.launch {
            try {
                val doc = db.collection("users").document(userId).get().await()
                val name = doc.getString("displayName") ?: "Aero Crystal"
                binding.tvUserName.text = name
                
                // Set avatar if exists
                // val avatarUrl = doc.getString("profileImageUrl")
                // if (!avatarUrl.isNullOrEmpty()) { Glide.with(this).load(avatarUrl).into(binding.ivUserAvatar) }
            } catch (e: Exception) { e.printStackTrace() }
        }
    }
}
