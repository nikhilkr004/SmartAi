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

        pdfUrl = intent.getStringExtra(Constants.EXTRA_PDF_URL).orEmpty()
        val topic = intent.getStringExtra(Constants.EXTRA_TOPIC) ?: "Study Notes"
        
        binding.toolbar.title = topic
        binding.toolbar.setNavigationOnClickListener { finish() }

        setupWebView()

        if (pdfUrl.isNotBlank()) {
            // Using Google Docs viewer as it's the most reliable way to display remote PDFs in WebView
            val googleDocsUrl = "https://docs.google.com/viewer?embedded=true&url=${Uri.encode(pdfUrl)}"
            binding.webView.loadUrl(googleDocsUrl)
        } else {
            Toast.makeText(this, "Empty PDF URL", Toast.LENGTH_SHORT).show()
            finish()
        }

        binding.fabDownload.setOnClickListener { downloadPdf() }
        binding.fabShare.setOnClickListener { sharePdf() }
        binding.fabFavorite.setOnClickListener { toggleFavorite() }
        binding.fabNotes.setOnClickListener { showNotesSheet() }
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
        // Placeholder for fav logic (updating Firestore)
        Toast.makeText(this, "Marked as Favorite!", Toast.LENGTH_SHORT).show()
        binding.fabFavorite.setImageResource(R.drawable.ic_star_filled)
    }
}
