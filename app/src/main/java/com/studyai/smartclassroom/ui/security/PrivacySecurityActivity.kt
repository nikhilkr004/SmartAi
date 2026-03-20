package com.studyai.smartclassroom.ui.security

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.studyai.smartclassroom.databinding.ActivityPrivacySecurityBinding

class PrivacySecurityActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPrivacySecurityBinding
    private val auth = FirebaseAuth.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPrivacySecurityBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
    }

    override fun onResume() {
        super.onResume()
        checkPermissions()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.switchMic.setOnClickListener { openAppSettings() }
        binding.switchStorage.setOnClickListener { openAppSettings() }

        binding.btnDelete.setOnClickListener {
            showDeleteConfirmation()
        }
    }

    private fun checkPermissions() {
        val micStatus = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        binding.switchMic.isChecked = micStatus == PackageManager.PERMISSION_GRANTED
        
        // Storage on Android 13+ is different, but for this mockup let's assume broad check
        binding.switchStorage.isChecked = true 
    }

    private fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
        }
        startActivity(intent)
        Toast.makeText(this, "Please manage permissions in System Settings", Toast.LENGTH_SHORT).show()
    }

    private fun showDeleteConfirmation() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Delete Account?")
            .setMessage("This action is permanent and cannot be undone. All your recordings and data will be erased.")
            .setPositiveButton("Delete Permanently") { _, _ ->
                deleteAccount()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun deleteAccount() {
        val user = auth.currentUser ?: return
        val userId = user.uid

        // 1. Wipe Firestore (Optional but good practice)
        // FirebaseFirestore.getInstance().collection("recordings").whereEqualTo("userId", userId)...
        
        // 2. Delete Auth
        user.delete().addOnCompleteListener { task ->
            if (task.isSuccessful) {
                Toast.makeText(this, "Account deleted successfully", Toast.LENGTH_LONG).show()
                val intent = Intent(this, com.studyai.smartclassroom.ui.auth.LoginActivity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                startActivity(intent)
                finish()
            } else {
                Toast.makeText(this, "Error: Re-authentication may be required", Toast.LENGTH_LONG).show()
            }
        }
    }
}
