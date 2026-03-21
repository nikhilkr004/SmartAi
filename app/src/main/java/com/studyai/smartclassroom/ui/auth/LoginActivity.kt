package com.studyai.smartclassroom.ui.auth

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.databinding.ActivityLoginBinding
import com.studyai.smartclassroom.ui.dashboard.DashboardActivity
import com.studyai.smartclassroom.utils.Constants
import com.studyai.smartclassroom.viewmodel.MainViewModel
import kotlinx.coroutines.launch

/**
 * Firebase Google Login screen.
 *
 * IMPORTANT:
 * - You must add google-services.json to app/ and configure Firebase project.
 * - You must set a valid default_web_client_id in strings.xml via Firebase setup.
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }
    private val vm: MainViewModel by lazy { MainViewModel() }
    private lateinit var googleClient: GoogleSignInClient

    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            val account = task.getResult(ApiException::class.java)
            firebaseAuthWithGoogle(account.idToken)
        } catch (e: Exception) {
            showLoading(false)
            Log.e(Constants.TAG, "Google sign-in failed: ${e.message}", e)
            Toast.makeText(this, "Sign-in failed", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (auth.currentUser != null) {
            goToDashboard()
            return
        }

        // Uses web client ID from strings.xml populated by Firebase config.
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()

        googleClient = GoogleSignIn.getClient(this, gso)

        binding.btnGoogleSignIn.setOnClickListener {
            showLoading(true)
            signInLauncher.launch(googleClient.signInIntent)
        }

        binding.btnAppleSignIn.setOnClickListener {
            Toast.makeText(this, "Apple Sign-In is coming soon! 🍎", Toast.LENGTH_SHORT).show()
        }

        binding.btnMicrosoftSignIn.setOnClickListener {
            Toast.makeText(this, "Microsoft Sign-In is coming soon! ☁️", Toast.LENGTH_SHORT).show()
        }
    }

    private fun firebaseAuthWithGoogle(idToken: String?) {
        if (idToken.isNullOrBlank()) {
            showLoading(false)
            Toast.makeText(this, "Missing Google ID token", Toast.LENGTH_LONG).show()
            return
        }

        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential)
            .addOnSuccessListener {
                val user = auth.currentUser
                vm.saveUserProfile(
                    name = user?.displayName,
                    email = user?.email,
                    photoUrl = user?.photoUrl?.toString()
                )
                showLoading(false)
                goToDashboard()
            }
            .addOnFailureListener { e ->
                showLoading(false)
                Log.e(Constants.TAG, "Firebase auth failed: ${e.message}", e)
                Toast.makeText(this, "Firebase auth failed", Toast.LENGTH_LONG).show()
            }
    }

    private fun showLoading(show: Boolean) {
        binding.progress.visibility = if (show) View.VISIBLE else View.GONE
        binding.btnGoogleSignIn.isEnabled = !show
        binding.btnAppleSignIn.isEnabled = !show
        binding.btnMicrosoftSignIn.isEnabled = !show
    }

    private fun goToDashboard() {
        startActivity(Intent(this, DashboardActivity::class.java))
        finish()
    }
}

