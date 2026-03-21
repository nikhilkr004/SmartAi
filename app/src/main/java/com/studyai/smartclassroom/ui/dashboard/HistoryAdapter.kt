package com.studyai.smartclassroom.ui.dashboard

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import java.text.SimpleDateFormat
import java.util.Locale
import com.studyai.smartclassroom.databinding.ItemRecentSessionBinding
import com.studyai.smartclassroom.R
import android.graphics.Color

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
        val binding = ItemRecentSessionBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class VH(private val binding: ItemRecentSessionBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: Map<String, Any?>) {
            val id = item["id"]?.toString().orEmpty()
            val pdfUrl = item["pdfUrl"]?.toString().orEmpty()
            val createdAtObj = item["createdAt"] 
            
            val sdfStr = if (createdAtObj is Timestamp) {
                val sdf = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                sdf.format(createdAtObj.toDate())
            } else createdAtObj?.toString().orEmpty()

            val topic = item["topic"]?.toString().orEmpty()
            val type = item["contentType"]?.toString().orEmpty()
            
            binding.tvTitle.text = topic.ifBlank { "Unbound Pursuit #$id" }
            binding.tvDetails.text = "$sdfStr  •  ${item["duration"] ?: "45:12"} min"
            
            // Status Badge
            if (pdfUrl.isNotBlank()) {
                binding.tvStatus.text = "PDF READY"
                binding.badgeStatus.setCardBackgroundColor(Color.parseColor("#E0F2F1"))
                binding.tvStatus.setTextColor(Color.parseColor("#00796B"))
                binding.tvStatus.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_library, 0, 0, 0)
            } else {
                binding.tvStatus.text = "PROCESSING"
                binding.badgeStatus.setCardBackgroundColor(Color.parseColor("#FFF3E0"))
                binding.tvStatus.setTextColor(Color.parseColor("#E65100"))
                binding.tvStatus.setCompoundDrawablesWithIntrinsicBounds(0, 0, 0, 0)
            }

            // Category Icon
            val iconRes = when(type) {
                "Math" -> android.R.drawable.ic_menu_edit
                "Coding" -> android.R.drawable.ic_menu_crop
                "Aptitude" -> android.R.drawable.ic_menu_help
                else -> android.R.drawable.ic_menu_agenda
            }
            binding.ivTypeIcon.setImageResource(iconRes)

            binding.root.setOnClickListener {
                if (id.isNotBlank()) onClick(id)
            }
        }
    }
}

