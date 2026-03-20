package com.studyai.smartclassroom.ui.dashboard

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import java.text.SimpleDateFormat
import java.util.Locale
import com.studyai.smartclassroom.databinding.ItemHistoryBinding

/**
 * Simple adapter for Firestore history maps.
 * For production, create a typed model instead of Map<String, Any?>.
 */
class HistoryAdapter(
    private val onClick: (recordingId: String) -> Unit
) : RecyclerView.Adapter<HistoryAdapter.VH>() {

    private val items = mutableListOf<Map<String, Any?>>()

    fun submit(newItems: List<Map<String, Any?>>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemHistoryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class VH(private val binding: ItemHistoryBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: Map<String, Any?>) {
            val id = item["id"]?.toString().orEmpty()
            val pdfUrl = item["pdfUrl"]?.toString().orEmpty()
            val createdAtObj = item["createdAt"] 
            val dateStr = if (createdAtObj is Timestamp) {
                val sdf = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                sdf.format(createdAtObj.toDate())
            } else {
                createdAtObj?.toString().orEmpty()
            }

            val topic = item["topic"]?.toString().orEmpty()
            val type = item["contentType"]?.toString().orEmpty()
            
            binding.tvTitle.text = topic.ifBlank { "Recording #$id" }
            binding.tvSubtitle.text = if (type.isNotBlank()) type else (if (pdfUrl.isNotBlank()) "• PDF READY" else "• PROCESSING")
            
            if (type.isBlank()) {
                binding.tvSubtitle.setTextColor(
                    if (pdfUrl.isNotBlank()) 
                        itemView.context.getColor(com.studyai.smartclassroom.R.color.status_ready)
                    else 
                        itemView.context.getColor(com.studyai.smartclassroom.R.color.status_processing)
                )
            } else {
                binding.tvSubtitle.setTextColor(itemView.context.getColor(com.studyai.smartclassroom.R.color.primary_teal))
            }
            
            binding.tvDate.text = if (dateStr.isNotBlank()) dateStr else "No date"

            binding.root.setOnClickListener {
                if (id.isNotBlank()) onClick(id)
            }
        }
    }
}

