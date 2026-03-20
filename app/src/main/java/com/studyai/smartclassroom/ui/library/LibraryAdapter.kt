package com.studyai.smartclassroom.ui.library

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.databinding.ItemLibraryCardBinding
import java.text.SimpleDateFormat
import java.util.*

class LibraryAdapter(
    private val onClick: (recordingId: String) -> Unit
) : RecyclerView.Adapter<LibraryAdapter.VH>() {

    private val items = mutableListOf<Map<String, Any?>>()

    fun submit(newItems: List<Map<String, Any?>>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemLibraryCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class VH(private val binding: ItemLibraryCardBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: Map<String, Any?>) {
            val id = item["id"]?.toString().orEmpty()
            val topic = item["topic"]?.toString().orEmpty()
            val category = item["contentType"]?.toString().orEmpty()
            val timestamp = item["timestamp"] as? Timestamp
            
            binding.tvLibTitle.text = topic.ifBlank { "Untitled Session" }
            binding.tvLibCategory.text = category.ifBlank { "General" }
            
            val sdf = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
            binding.tvLibDate.text = timestamp?.let { sdf.format(it.toDate()) } ?: "Unknown Date"

            // Set icon based on category
            val iconRes = when (category.lowercase()) {
                "coding" -> R.drawable.ic_type_coding
                "math" -> R.drawable.ic_type_math
                "aptitude" -> R.drawable.ic_type_aptitude
                else -> R.drawable.ic_type_general
            }
            binding.ivLibIcon.setImageResource(iconRes)

            binding.btnOpenGuide.setOnClickListener { onClick(id) }
            binding.root.setOnClickListener { onClick(id) }
        }
    }
}
