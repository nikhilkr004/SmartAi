package com.studyai.smartclassroom.ui.pdf

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.databinding.ActivityPdfViewerBinding
import com.studyai.smartclassroom.utils.Constants
import java.io.File

class PdfViewerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPdfViewerBinding
    private var pdfUrl: String = ""
    private var fileName: String = "StudyAi_Notes.pdf"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPdfViewerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val pdfUrl = intent.getStringExtra(Constants.EXTRA_PDF_URL)
        val topic = intent.getStringExtra(Constants.EXTRA_TOPIC)
        val recordingId = intent.getStringExtra(Constants.EXTRA_RECORDING_ID)

        if (pdfUrl == null) {
            Toast.makeText(this, "Error: PDF URL not provided", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        this.pdfUrl = pdfUrl // Update the class-level pdfUrl

        // Track opening
        recordingId?.let { id ->
            FirebaseFirestore.getInstance().collection("recordings").document(id)
                .update("lastOpened", Timestamp.now())
        }

        binding.tvTitle.text = topic ?: "Study Guide"
        binding.toolbar.setNavigationOnClickListener { finish() }

        // Handle edge-to-edge
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        window.statusBarColor = android.graphics.Color.TRANSPARENT

        setupWebView()

        if (pdfUrl.isNotBlank()) {
            val googleDocsUrl = "https://docs.google.com/viewer?embedded=true&url=${Uri.encode(pdfUrl)}"
            binding.webView.loadUrl(googleDocsUrl)
        } else {
            Toast.makeText(this, "Empty PDF URL", Toast.LENGTH_SHORT).show()
            finish()
        }

        binding.btnDownload.setOnClickListener { downloadPdf() }
        binding.btnShare.setOnClickListener { sharePdf() }
        binding.btnFav.setOnClickListener { toggleFavorite() }
        binding.btnQuickNotes.setOnClickListener { showNotesSheet() }
        binding.btnSearch.setOnClickListener { 
            Toast.makeText(this, "Search feature coming soon!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showNotesSheet() {
        val dialog = BottomSheetDialog(this)
        val view = layoutInflater.inflate(R.layout.bottom_sheet_notes, null)
        val etNote = view.findViewById<EditText>(R.id.etQuickNote)
        val btnSave = view.findViewById<View>(R.id.btnSaveNote)

        btnSave.setOnClickListener {
            val note = etNote.text.toString()
            if (note.isNotBlank()) {
                Toast.makeText(this, "Quick Note Saved!", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
        }
        dialog.setContentView(view)
        dialog.show()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        binding.webView.settings.apply {
            javaScriptEnabled = true
            allowFileAccess = true
            domStorageEnabled = true
            builtInZoomControls = true
            displayZoomControls = false
        }
        
        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                binding.progressBar.visibility = View.VISIBLE
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                binding.progressBar.visibility = View.GONE
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                view?.loadUrl(url ?: "")
                return true
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean {
                view?.loadUrl(request?.url.toString())
                return true
            }
        }
        
        binding.webView.webChromeClient = WebChromeClient()
    }

    private fun downloadPdf() {
        if (pdfUrl.isBlank()) return
        
        val request = DownloadManager.Request(Uri.parse(pdfUrl))
            .setTitle(fileName)
            .setDescription("Downloading study notes...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        dm.enqueue(request)
        Toast.makeText(this, "Download started...", Toast.LENGTH_SHORT).show()
    }

    private fun sharePdf() {
        // For sharing, we usually want to download it locally first or share the link
        // Sharing the link is simplest for now, but a real app would share the actual file.
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "StudyAi Notes")
            putExtra(Intent.EXTRA_TEXT, "Check out my StudyAi notes: $pdfUrl")
        }
        startActivity(Intent.createChooser(intent, "Share PDF"))
    }

    private fun toggleFavorite() {
        if (pdfUrl.isBlank()) return
        val recordingId = intent.getStringExtra(Constants.EXTRA_RECORDING_ID) ?: return

        lifecycleScope.launch {
            try {
                val docRef = com.google.firebase.firestore.FirebaseFirestore.getInstance()
                    .collection(Constants.COLLECTION_RECORDINGS).document(recordingId)
                
                val doc = docRef.get().await()
                val isCurrentlyFavorite = doc.getBoolean("isFavorite") ?: false
                val newFavoriteStatus = !isCurrentlyFavorite
                
                docRef.update("isFavorite", newFavoriteStatus).await()
                
                binding.btnFav.setImageResource(
                    if (newFavoriteStatus) R.drawable.ic_star_filled else R.drawable.ic_star_outline
                )
                
                Toast.makeText(this@PdfViewerActivity, 
                    if (newFavoriteStatus) "Added to Favorites!" else "Removed from Favorites", 
                    Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this@PdfViewerActivity, "Failed to update favorite: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
