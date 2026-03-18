package com.studyai.smartclassroom.ui.result

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.firebase.firestore.FirebaseFirestore
import com.studyai.smartclassroom.databinding.ActivityResultBinding
import com.studyai.smartclassroom.utils.Constants
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.launch

/**
 * Displays transcript + notes and lets the user open the generated PDF.
 */
class ResultActivity : AppCompatActivity() {

    private lateinit var binding: ActivityResultBinding
    private val db: FirebaseFirestore by lazy { FirebaseFirestore.getInstance() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityResultBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val recordingId = intent.getStringExtra(Constants.EXTRA_RECORDING_ID).orEmpty()
        val transcriptExtra = intent.getStringExtra(Constants.EXTRA_TRANSCRIPT).orEmpty()
        val notesExtra = intent.getStringExtra(Constants.EXTRA_NOTES).orEmpty()
        val pdfUrlExtra = intent.getStringExtra(Constants.EXTRA_PDF_URL).orEmpty()

        if (transcriptExtra.isNotBlank() || notesExtra.isNotBlank() || pdfUrlExtra.isNotBlank()) {
            bindContent(transcriptExtra, notesExtra, pdfUrlExtra)
        } else if (recordingId.isNotBlank()) {
            loadFromFirestore(recordingId)
        } else {
            Toast.makeText(this, "No result data", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        binding.btnOpenPdf.setOnClickListener {
            val pdfUrl = binding.btnOpenPdf.tag as? String ?: ""
            if (pdfUrl.isBlank()) {
                Toast.makeText(this, "PDF URL missing", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(pdfUrl))
            startActivity(browserIntent)
        }
    }

    private fun bindContent(transcript: String, notes: String, pdfUrl: String) {
        binding.tvTranscript.text = transcript
        binding.tvNotes.text = notes
        binding.btnOpenPdf.tag = pdfUrl
    }

    private fun loadFromFirestore(id: String) {
        lifecycleScope.launch {
            try {
                showLoading(true)
                val doc = db.collection(Constants.COLLECTION_RECORDINGS).document(id).get().await()
                val data = doc.data
                if (data == null) {
                    Toast.makeText(this@ResultActivity, "Recording not found", Toast.LENGTH_LONG).show()
                    finish()
                    return@launch
                }
                val transcript = data["transcript"]?.toString().orEmpty()
                val notes = data["notes"]?.toString().orEmpty()
                val pdfUrl = data["pdfUrl"]?.toString().orEmpty()
                bindContent(transcript, notes, pdfUrl)
            } catch (e: Exception) {
                Toast.makeText(this@ResultActivity, e.message ?: "Failed to load", Toast.LENGTH_LONG).show()
                finish()
            } finally {
                showLoading(false)
            }
        }
    }

    private fun showLoading(show: Boolean) {
        binding.progress.visibility = if (show) View.VISIBLE else View.GONE
    }
}

