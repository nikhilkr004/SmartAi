package com.studyai.smartclassroom.ui.dashboard

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.util.Log
import android.graphics.Color
import android.view.View
import android.widget.*
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
    private var selectedContentType: String = "General"
    private var selectedTopic: String = ""
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
                    Log.d(Constants.TAG, "RECEIVER: Broadcast STOPPED received. Path: $path")
                    if (path.isNullOrBlank()) {
                        Log.e(Constants.TAG, "RECEIVER: Path is null or blank!")
                        return
                    }
                    val f = File(path)
                    if (!f.exists()) {
                        Log.e(Constants.TAG, "RECEIVER: File does not exist at path: $path")
                        Toast.makeText(this@DashboardActivity, "Recording file missing", Toast.LENGTH_LONG).show()
                        return
                    }
                    binding.btnStart.isEnabled = true
                    binding.btnStop.isEnabled = false
                    Log.d(Constants.TAG, "RECEIVER: Starting upload for ${f.name} (Type: $selectedContentType, Topic: $selectedTopic)")
                    vm.uploadRecording(f, selectedContentType, selectedTopic)
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
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val micGranted = results[Manifest.permission.RECORD_AUDIO] ?: false
        if (micGranted) {
            startMediaProjectionRequest()
        } else {
            Toast.makeText(this, "Microphone permission is required", Toast.LENGTH_LONG).show()
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
                            putExtra(Constants.EXTRA_CONTENT_TYPE, selectedContentType) 
                            putExtra(Constants.EXTRA_TOPIC, selectedTopic)
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

        // Persistent receiver for recording events.
        val filter = IntentFilter().apply {
            addAction(ScreenRecordService.BROADCAST_RECORDING_STOPPED)
            addAction(ScreenRecordService.BROADCAST_RECORDING_ERROR)
        }
        Log.d(Constants.TAG, "Dashboard: Registering recording receiver (Created)")
        registerReceiver(
            recordingStoppedReceiver,
            filter,
            Context.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onStart() {
        super.onStart()
        Log.d(Constants.TAG, "Dashboard: onStart")
    }

    override fun onStop() {
        super.onStop()
        Log.d(Constants.TAG, "Dashboard: onStop (Activity backgrounded)")
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(Constants.TAG, "Dashboard: onDestroy (Cleaning up receiver)")
        try {
            unregisterReceiver(recordingStoppedReceiver)
        } catch (e: Exception) {
            // Might already be unregistered
        }
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
        showRecordingSetupDialog()
    }

    private fun showRecordingSetupDialog() {
        val types = arrayOf("Coding", "Math", "Aptitude", "General")
        var tempType = "General"

        val dialogView = layoutInflater.inflate(R.layout.dialog_recording_setup, null)
        val etTopic = dialogView.findViewById<EditText>(R.id.etSessionName)
        val btnStart = dialogView.findViewById<View>(R.id.btnStart)
        val btnCancel = dialogView.findViewById<View>(R.id.btnCancel)

        // Type Buttons
        val btnCoding = dialogView.findViewById<LinearLayout>(R.id.btnTypeCoding)
        val btnMath = dialogView.findViewById<LinearLayout>(R.id.btnTypeMath)
        val btnAptitude = dialogView.findViewById<LinearLayout>(R.id.btnTypeAptitude)
        val btnGeneral = dialogView.findViewById<LinearLayout>(R.id.btnTypeGeneral)

        val typeButtons = mapOf(
            "Coding" to btnCoding,
            "Math" to btnMath,
            "Aptitude" to btnAptitude,
            "General" to btnGeneral
        )

        etTopic.setText("Session on General")

        fun updateSelection(selected: String) {
            tempType = selected
            if (etTopic.text.toString().startsWith("Session on")) {
                etTopic.setText("Session on $selected")
            }

            typeButtons.forEach { (type, view) ->
                val isSelected = type == selected
                view.setBackgroundResource(if (isSelected) R.drawable.bg_type_selected else R.drawable.bg_type_unselected)
                
                // Update text and icon colors
                val color = if (isSelected) Color.parseColor("#006064") else Color.parseColor("#546E7A")
                val tv = view.getChildAt(1) as? TextView
                val iv = view.getChildAt(0) as? ImageView
                tv?.setTextColor(color)
                iv?.setColorFilter(color)
            }
        }

        btnCoding.setOnClickListener { updateSelection("Coding") }
        btnMath.setOnClickListener { updateSelection("Math") }
        btnAptitude.setOnClickListener { updateSelection("Aptitude") }
        btnGeneral.setOnClickListener { updateSelection("General") }

        val dialog = androidx.appcompat.app.AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnStart.setOnClickListener {
            selectedContentType = tempType
            selectedTopic = etTopic.text.toString().ifBlank { "Session on $selectedContentType" }
            dialog.dismiss()

            val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                perms.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            requestAudioPermission.launch(perms.toTypedArray())
        }

        dialog.show()
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

