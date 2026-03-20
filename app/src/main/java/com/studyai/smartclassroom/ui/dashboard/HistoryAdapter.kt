package com.studyai.smartclassroom.ui.dashboard

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
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
            val createdAt = item["createdAt"]?.toString().orEmpty()

            binding.tvTitle.text = if (id.isNotBlank()) "Recording #$id" else "Recording"
            binding.tvSubtitle.text = if (pdfUrl.isNotBlank()) "• PDF READY" else "• PROCESSING"
            binding.tvSubtitle.setTextColor(
                if (pdfUrl.isNotBlank()) 
                    holder.itemView.context.getColor(com.studyai.smartclassroom.R.color.status_ready)
                else 
                    holder.itemView.context.getColor(com.studyai.smartclassroom.R.color.status_processing)
            )
            binding.tvDate.text = if (createdAt.isNotBlank()) createdAt else "No date"

            binding.root.setOnClickListener {
                if (id.isNotBlank()) onClick(id)
            }
        }
    }
}

