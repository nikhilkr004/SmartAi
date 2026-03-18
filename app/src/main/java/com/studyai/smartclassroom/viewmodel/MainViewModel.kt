package com.studyai.smartclassroom.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.studyai.smartclassroom.model.ResponseModel
import com.studyai.smartclassroom.repository.MainRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

/**
 * Single ViewModel powering dashboard + result flow.
 * For a larger app, split ViewModels per feature module.
 */
class MainViewModel(
    private val repo: MainRepository = MainRepository()
) : ViewModel() {

    sealed class UiState {
        data object Idle : UiState()
        data object Loading : UiState()
        data class Error(val message: String) : UiState()
        data class UploadSuccess(
            val response: ResponseModel,
            val recordingId: String
        ) : UiState()
        data class HistoryLoaded(val items: List<Map<String, Any?>>) : UiState()
    }

    private val _state = MutableStateFlow<UiState>(UiState.Idle)
    val state: StateFlow<UiState> = _state.asStateFlow()

    fun currentUserId(): String? = repo.currentUserId()

    fun saveUserProfile(name: String?, email: String?, photoUrl: String?) {
        viewModelScope.launch {
            try {
                _state.value = UiState.Loading
                repo.saveUserProfile(name, email, photoUrl)
                _state.value = UiState.Idle
            } catch (e: Exception) {
                _state.value = UiState.Error(e.message ?: "Failed to save profile")
            }
        }
    }

    fun uploadRecording(file: File) {
        viewModelScope.launch {
            try {
                _state.value = UiState.Loading
                val uid = repo.currentUserId() ?: throw IllegalStateException("Not logged in")
                val response = repo.uploadRecordingToBackend(file, uid)
                val recordingId = repo.saveRecordingResult(
                    transcript = response.transcript,
                    notes = response.notes,
                    pdfUrl = response.pdfUrl,
                    localFilePath = file.absolutePath
                )
                _state.value = UiState.UploadSuccess(response, recordingId)
            } catch (e: Exception) {
                _state.value = UiState.Error(e.message ?: "Upload failed")
            }
        }
    }

    fun loadHistory() {
        viewModelScope.launch {
            try {
                _state.value = UiState.Loading
                val items = repo.fetchHistory()
                _state.value = UiState.HistoryLoaded(items)
            } catch (e: Exception) {
                _state.value = UiState.Error(e.message ?: "Failed to load history")
            }
        }
    }
}

