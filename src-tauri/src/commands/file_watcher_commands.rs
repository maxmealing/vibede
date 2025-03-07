use crate::services::file_watcher_service::FileChangeEvent;
use crate::services::FileWatcherService;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

/// Shared state for the file watcher service
pub struct FileWatcherState {
    service: FileWatcherService,
}

impl FileWatcherState {
    /// Creates a new FileWatcherState
    pub fn new(app_handle: AppHandle) -> Self {
        let mut service = FileWatcherService::new();
        service.set_app_handle(app_handle);
        FileWatcherState { service }
    }
}

/// Starts watching a directory for file changes
///
/// # Arguments
/// * `path` - The directory path to watch
/// * `recursive` - Whether to watch subdirectories recursively
/// * `watch_id` - Optional custom ID for the watcher (generates UUID if not provided)
///
/// # Returns
/// * `Result<String, String>` - The watch ID on success, error message on failure
#[tauri::command]
pub async fn start_watching_directory(
    path: String,
    recursive: bool,
    watch_id: Option<String>,
    _app_handle: AppHandle,
    state: State<'_, FileWatcherState>,
) -> Result<String, String> {
    // Generate a watch ID if not provided
    let watch_id = watch_id.unwrap_or_else(|| Uuid::new_v4().to_string());

    // Convert the path string to PathBuf
    let path = PathBuf::from(path);

    // Start watching the directory
    state
        .service
        .watch_directory(path.clone(), watch_id.clone(), recursive)
        .await?;

    // Log the action
    println!(
        "Started watching directory: {}, ID: {}",
        path.display(),
        watch_id
    );

    Ok(watch_id)
}

/// Stops watching a directory
///
/// # Arguments
/// * `watch_id` - The ID of the watcher to stop
///
/// # Returns
/// * `Result<(), String>` - Success or error message
#[tauri::command]
pub fn stop_watching_directory(
    watch_id: String,
    state: State<'_, FileWatcherState>,
) -> Result<(), String> {
    // Stop the watcher
    state.service.stop_watching(&watch_id)?;

    // Log the action
    println!("Stopped watching directory with ID: {}", watch_id);

    Ok(())
}

/// Lists all active watchers
///
/// # Returns
/// * `Vec<(String, String)>` - List of (watch_id, path) pairs
#[tauri::command]
pub fn list_active_watchers(state: State<'_, FileWatcherState>) -> Vec<(String, String)> {
    state.service.list_watchers()
}

/// Triggers a test event for debugging purposes
///
/// # Returns
/// * `Result<(), String>` - Success or error message
#[tauri::command]
pub fn trigger_test_event(app_handle: AppHandle) -> Result<(), String> {
    // Create a test event
    let test_event = FileChangeEvent {
        path: "/test/path/test-file.txt".to_string(),
        kind: "modified".to_string(),
        watch_id: "test-watcher-id".to_string(),
    };

    // Emit the event
    if let Err(e) = app_handle.emit("file-change", test_event) {
        return Err(format!("Failed to emit test event: {}", e));
    }

    // Log the action
    println!("Triggered test event");

    Ok(())
}
