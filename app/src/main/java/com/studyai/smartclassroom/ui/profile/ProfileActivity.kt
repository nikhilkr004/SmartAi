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
    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }
    private val db: FirebaseFirestore by lazy { FirebaseFirestore.getInstance() }
    
    private val adapter: HistoryAdapter by lazy {
        HistoryAdapter { id ->
            val i = Intent(this, ResultActivity::class.java).apply {
                putExtra(Constants.EXTRA_RECORDING_ID, id)
            }
            startActivity(i)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        loadUserData()
        loadFavorites()
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener { finish() }
        binding.recyclerFavorites.layoutManager = LinearLayoutManager(this)
        binding.recyclerFavorites.adapter = adapter

        binding.btnLogout.setOnClickListener {
            auth.signOut()
            val intent = Intent(this, LoginActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(intent)
            finish()
        }
    }

    private fun loadUserData() {
        val user = auth.currentUser
        binding.tvUserName.text = user?.displayName ?: "Scholar"
        binding.tvUserEmail.text = user?.email ?: "student@studyai.com"
    }

    private fun loadFavorites() {
        val user = auth.currentUser ?: return
        
        lifecycleScope.launch {
            try {
                // Fetching recordings where userId matches AND isFavorite is true
                val snapshot = db.collection(Constants.COLLECTION_RECORDINGS)
                    .whereEqualTo("userId", user.uid)
                    .whereEqualTo("isFavorite", true)
                    .get()
                    .await()

                val items = snapshot.documents.map { doc ->
                    val data = doc.data?.toMutableMap() ?: mutableMapOf()
                    data["id"] = doc.id
                    data // Return the map
                }

                if (items.isEmpty()) {
                    binding.tvEmptyFavorites.visibility = View.VISIBLE
                    binding.recyclerFavorites.visibility = View.GONE
                } else {
                    binding.tvEmptyFavorites.visibility = View.GONE
                    binding.recyclerFavorites.visibility = View.VISIBLE
                    adapter.submit(items)
                }
            } catch (e: Exception) {
                Toast.makeText(this@ProfileActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
