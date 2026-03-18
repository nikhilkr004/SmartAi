package com.studyai.smartclassroom.ui.dashboard

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.firebase.auth.FirebaseAuth
import com.studyai.smartclassroom.databinding.ActivityDashboardBinding
import com.studyai.smartclassroom.network.ApiTestHelper
import com.studyai.smartclassroom.service.ScreenRecordService
import com.studyai.smartclassroom.ui.result.ResultActivity
import com.studyai.smartclassroom.utils.Constants
import com.studyai.smartclassroom.utils.ProjectionPermissionStore
import com.studyai.smartclassroom.viewmodel.MainViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.io.File

/**
 * Dashboard:
 * - Start/stop screen recording
 * - Upload after stopping
 * - Show Firestore history list
 */
class DashboardActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDashboardBinding
    private val vm: MainViewModel by lazy { MainViewModel() }
    private val adapter: HistoryAdapter by lazy {
        HistoryAdapter { id ->
            openHistoryItem(id)
        }
    }

    private val recordingStoppedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                ScreenRecordService.BROADCAST_RECORDING_STOPPED -> {
                    val path = intent.getStringExtra(ScreenRecordService.EXTRA_SAVED_FILE_PATH)
                    if (path.isNullOrBlank()) return
                    val f = File(path)
                    if (!f.exists()) {
                        Toast.makeText(this@DashboardActivity, "Recording file missing", Toast.LENGTH_LONG).show()
                        return
                    }
                    binding.btnStart.isEnabled = true
                    binding.btnStop.isEnabled = false
                    vm.uploadRecording(f)
                }
                ScreenRecordService.BROADCAST_RECORDING_ERROR -> {
                    val msg = intent.getStringExtra(ScreenRecordService.EXTRA_ERROR_MESSAGE) ?: "Unknown Error"
                    Toast.makeText(this@DashboardActivity, msg, Toast.LENGTH_LONG).show()
                    binding.btnStart.isEnabled = true
                    binding.btnStop.isEnabled = false
                }
            }
        }
    }

    private val requestAudioPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) {
            Toast.makeText(this, "Microphone permission is required", Toast.LENGTH_LONG).show()
        } else {
            startMediaProjectionRequest()
        }
    }

    private val mediaProjectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != RESULT_OK || result.data == null) {
            Toast.makeText(this, "Screen capture permission denied", Toast.LENGTH_LONG).show()
            return@registerForActivityResult
        }

        // Store in-memory as a reliable fallback for the service.
        ProjectionPermissionStore.set(result.resultCode, result.data!!)

        val startIntent = Intent(this, ScreenRecordService::class.java).apply {
            action = Constants.ACTION_START_RECORDING
            putExtra(Constants.EXTRA_RESULT_CODE, result.resultCode)
            putExtra(Constants.EXTRA_RESULT_DATA, result.data)
        }
        ContextCompat.startForegroundService(this, startIntent)

        binding.btnStart.isEnabled = false
        binding.btnStop.isEnabled = true
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (FirebaseAuth.getInstance().currentUser == null) {
            finish()
            return
        }

        binding.recyclerHistory.layoutManager = LinearLayoutManager(this)
        binding.recyclerHistory.adapter = adapter

        binding.btnStart.setOnClickListener {
            ensurePermissionsAndStart()
        }
        binding.btnStop.setOnClickListener {
            val stopIntent = Intent(this, ScreenRecordService::class.java).apply {
                action = Constants.ACTION_STOP_RECORDING
            }
            startService(stopIntent)
            binding.btnStop.isEnabled = false
        }

        // Collect VM state.
        lifecycleScope.launch {
            vm.state.collectLatest { state ->
                when (state) {
                    is MainViewModel.UiState.Idle -> showLoading(false)
                    is MainViewModel.UiState.Loading -> showLoading(true)
                    is MainViewModel.UiState.Error -> {
                        showLoading(false)
                        Toast.makeText(this@DashboardActivity, state.message, Toast.LENGTH_LONG).show()
                    }
                    is MainViewModel.UiState.UploadSuccess -> {
                        showLoading(false)
                        val resp = state.response
                        val i = Intent(this@DashboardActivity, ResultActivity::class.java).apply {
                            putExtra(Constants.EXTRA_TRANSCRIPT, resp.transcript)
                            putExtra(Constants.EXTRA_NOTES, resp.notes)
                            putExtra(Constants.EXTRA_PDF_URL, resp.pdfUrl)
                            putExtra(Constants.EXTRA_RECORDING_ID, state.recordingId)
                        }
                        startActivity(i)
                        vm.loadHistory()
                    }
                    is MainViewModel.UiState.HistoryLoaded -> {
                        showLoading(false)
                        adapter.submit(state.items)
                    }
                }
            }
        }

        // Load initial history.
        vm.loadHistory()
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter().apply {
            addAction(ScreenRecordService.BROADCAST_RECORDING_STOPPED)
            addAction(ScreenRecordService.BROADCAST_RECORDING_ERROR)
        }
        registerReceiver(
            recordingStoppedReceiver,
            filter,
            Context.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onStop() {
        super.onStop()
        unregisterReceiver(recordingStoppedReceiver)
    }

    /**
     * STEP 1 requirement (backend verification):
     * Once you have a real backend URL and a local sample file, you can call:
     * ApiTestHelper.testProcessEndpoint(file, userId)
     *
     * This logs success / failure to Logcat.
     */
    private fun runApiConnectivityTestIfNeeded(file: File) {
        val user = FirebaseAuth.getInstance().currentUser ?: return
        lifecycleScope.launch {
            try {
                Log.d(Constants.TAG, "Fetching ID token for API test...")
                val tokenResult = user.getIdToken(true).await()
                val token = tokenResult.token ?: run {
                    Log.e(Constants.TAG, "ID Token result was null!")
                    return@launch
                }
                Log.d(Constants.TAG, "ID Token fetched successfully. Starting connectivity test...")
                ApiTestHelper.testProcessEndpoint(token = token, file = file, scope = lifecycleScope)
            } catch (e: Exception) {
                Log.e(Constants.TAG, "API TEST FAILURE: Failed to get ID Token! Reason: ${e.message}", e)
                Log.e(Constants.TAG, "CRITICAL: This usually means your SHA-1 fingerprint is missing in Firebase Console.")
            }
        }
    }

    private fun ensurePermissionsAndStart() {
        // Only RECORD_AUDIO is runtime; FOREGROUND_SERVICE is normal permission.
        requestAudioPermission.launch(Manifest.permission.RECORD_AUDIO)
    }

    private fun startMediaProjectionRequest() {
        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjectionLauncher.launch(mpm.createScreenCaptureIntent())
    }

    private fun showLoading(show: Boolean) {
        binding.progress.visibility = if (show) View.VISIBLE else View.GONE
    }

    private fun openHistoryItem(id: String) {
        val i = Intent(this, ResultActivity::class.java).apply {
            putExtra(Constants.EXTRA_RECORDING_ID, id)
        }
        startActivity(i)
    }
}

