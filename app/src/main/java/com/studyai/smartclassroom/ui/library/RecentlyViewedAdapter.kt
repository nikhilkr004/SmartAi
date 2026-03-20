package com.studyai.smartclassroom.ui.library

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import com.studyai.smartclassroom.R
import com.studyai.smartclassroom.databinding.ItemRecentViewBinding
import java.text.SimpleDateFormat
import java.util.*

class RecentlyViewedAdapter(
    private val onClick: (recordingId: String) -> Unit
) : RecyclerView.Adapter<RecentlyViewedAdapter.VH>() {

    private val items = mutableListOf<Map<String, Any?>>()

    fun submit(newItems: List<Map<String, Any?>>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemRecentViewBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class VH(private val binding: ItemRecentViewBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: Map<String, Any?>) {
            val id = item["id"]?.toString().orEmpty()
            val topic = item["topic"]?.toString().orEmpty()
            val category = item["contentType"]?.toString().orEmpty()
            val timestamp = item["timestamp"] as? Timestamp
            
            binding.tvRecentTitle.text = topic.ifBlank { "Untitled Session" }
            
            val timeStr = timestamp?.let { 
                val diff = Date().time - it.toDate().time
                val hours = diff / (1000 * 60 * 60)
                if (hours < 1) "JUST NOW" else "${hours}H AGO"
            } ?: ""
            
            binding.tvRecentMeta.text = "${category.uppercase()} • $timeStr"

            val (iconRes, tint) = when (category.lowercase()) {
                "coding" -> R.drawable.ic_type_coding to 0xFF43A047.toInt()
                "math" -> R.drawable.ic_type_math to 0xFF1E88E5.toInt()
                "aptitude" -> R.drawable.ic_type_aptitude to 0xFFFB8C00.toInt()
                else -> R.drawable.ic_type_general to 0xFF546E7A.toInt()
            }
            binding.ivRecentIcon.setImageResource(iconRes)
            binding.ivRecentIcon.setColorFilter(tint)
            // item background tint is handled in xml but we could do it here too

            binding.root.setOnClickListener { onClick(id) }
        }
    }
}
