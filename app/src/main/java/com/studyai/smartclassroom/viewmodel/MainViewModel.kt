package com.studyai.smartclassroom.viewmodel

import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.studyai.smartclassroom.model.ResponseModel
import com.studyai.smartclassroom.repository.MainRepository
import com.studyai.smartclassroom.utils.Constants
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
        data class UserDataLoaded(val data: Map<String, Any?>) : UiState()
        data object ProfileUpdated : UiState()
    }

    private val _state = MutableStateFlow<UiState>(UiState.Idle)
    val state: StateFlow<UiState> = _state.asStateFlow()

    fun currentUserId(): String? = repo.currentUserId()

    fun fetchUserProfile() {
        viewModelScope.launch {
            try {
                _state.value = UiState.Loading
                val data = repo.fetchUserProfile()
                if (data != null) {
                    _state.value = UiState.UserDataLoaded(data)
                } else {
                    _state.value = UiState.Idle
                }
            } catch (e: Exception) {
                _state.value = UiState.Error(e.message ?: "Failed to fetch profile")
            }
        }
    }

    fun updateProfile(name: String?, photoUri: Uri?) {
        viewModelScope.launch {
            try {
                _state.value = UiState.Loading
                var photoUrl: String? = null
                if (photoUri != null) {
                    photoUrl = repo.uploadProfileImage(photoUri)
                }
                repo.updateUserProfile(name, photoUrl)
                _state.value = UiState.ProfileUpdated
            } catch (e: Exception) {
                _state.value = UiState.Error(e.message ?: "Failed to update profile")
            }
        }
    }

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

    fun uploadRecording(file: File, contentType: String, topic: String) {
        viewModelScope.launch {
            try {
                Log.d(Constants.TAG, "ViewModel: Starting upload process for ${file.name} (Type: $contentType)")
                _state.value = UiState.Loading
                val response = repo.uploadRecordingToBackend(file, contentType, topic)
                Log.d(Constants.TAG, "ViewModel: Backend processing complete. Saving result...")
                val recordingId = repo.saveRecordingResult(
                    transcript = response.transcript,
                    notes = response.notes,
                    pdfUrl = response.pdfUrl,
                    videoUrl = response.videoUrl,
                    localFilePath = file.absolutePath,
                    contentType = contentType,
                    topic = topic
                )
                Log.i(Constants.TAG, "ViewModel: Full flow successful.")
                _state.value = UiState.UploadSuccess(response, recordingId)
            } catch (e: Exception) {
                Log.e(Constants.TAG, "ViewModel FLOW ERROR: ${e.message}", e)
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

