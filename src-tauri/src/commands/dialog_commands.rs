use log::info;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
}

/// Command to open a directory selection dialog
/// Returns the selected directory path or None if canceled
#[tauri::command]
pub async fn select_directory_dialog(app_handle: AppHandle) -> Result<Option<String>, String> {
    info!("Opening directory selection dialog");

    // Get the dialog manager from the app handle
    let dialog = app_handle.dialog();

    // Create a shared variable to store the result
    let result = Arc::new(Mutex::new(None));
    let result_clone = result.clone();

    // Use a channel to handle the dialog result
    let (tx, rx) = std::sync::mpsc::channel();

    // Start the dialog on the main thread
    dialog.file().pick_folder(move |file_path| {
        if let Some(path) = file_path {
            // Store the result
            let path_str = path.to_string();
            info!("User selected directory: {}", path_str);
            *result_clone.lock().unwrap() = Some(path_str);
        } else {
            info!("User cancelled directory selection");
        }
        // Signal that we're done
        let _ = tx.send(());
    });

    // Wait for the dialog to complete
    rx.recv()
        .map_err(|e| format!("Error waiting for dialog: {}", e))?;

    // Get the value from the mutex and return it
    let path = {
        let guard = result.lock().unwrap();
        guard.clone()
    };

    // Return the result
    Ok(path)
}

/// Command to list files in a directory
/// Returns a list of file information
#[tauri::command]
pub fn list_directory_files(directory_path: String) -> Result<Vec<FileInfo>, String> {
    info!("Listing files in directory: {}", directory_path);

    let path = Path::new(&directory_path);
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", directory_path));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", directory_path));
    }

    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    };

    let mut files = Vec::new();

    for entry in entries {
        match entry {
            Ok(entry) => {
                let file_path = entry.path();
                let file_name = file_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("Unknown")
                    .to_string();

                let metadata = match file_path.metadata() {
                    Ok(meta) => meta,
                    Err(_) => continue, // Skip if we can't get metadata
                };

                let is_directory = metadata.is_dir();
                let size = if is_directory { 0 } else { metadata.len() };

                files.push(FileInfo {
                    name: file_name,
                    path: file_path.to_string_lossy().to_string(),
                    is_directory,
                    size,
                });
            }
            Err(_) => continue, // Skip entries we can't read
        }
    }

    // Sort files: directories first, then alphabetically
    files.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    info!("Found {} files in directory", files.len());
    Ok(files)
}
