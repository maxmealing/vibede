use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::{self, Receiver, Sender};

/// Represents a file change event that will be sent to the frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileChangeEvent {
    /// Path of the file that changed
    pub path: String,
    /// Type of change (Created, Modified, Removed, etc.)
    pub kind: String,
    /// Watch ID to identify which watcher triggered the event
    pub watch_id: String,
}

/// Service for watching file system changes
pub struct FileWatcherService {
    /// Map of watch IDs to their respective watchers
    watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
    /// Map of watch IDs to their respective paths
    watched_paths: Arc<Mutex<HashMap<String, PathBuf>>>,
    /// Tauri app handle for sending events
    app_handle: Option<AppHandle>,
}

impl FileWatcherService {
    /// Creates a new FileWatcherService instance
    pub fn new() -> Self {
        FileWatcherService {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            watched_paths: Arc::new(Mutex::new(HashMap::new())),
            app_handle: None,
        }
    }

    /// Sets the app handle for sending events
    pub fn set_app_handle(&mut self, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Starts watching a directory for changes
    pub async fn watch_directory<P: AsRef<Path>>(
        &self,
        path: P,
        watch_id: String,
        recursive: bool,
    ) -> Result<(), String> {
        if self.app_handle.is_none() {
            return Err("App handle not set. Call set_app_handle first.".to_string());
        }

        let path = path.as_ref().to_path_buf();
        if !path.exists() {
            return Err(format!("Path does not exist: {}", path.display()));
        }

        // Check if we're already watching this path with this ID
        {
            let watched_paths = self.watched_paths.lock().unwrap();
            if watched_paths.contains_key(&watch_id) {
                return Err(format!("Already watching with ID: {}", watch_id));
            }
        }

        // Create a channel for the watcher to send events
        let (tx, rx) = mpsc::channel(100);

        // Clone necessary data for the async task
        let app_handle = self.app_handle.clone().unwrap();
        let watch_id_clone = watch_id.clone();
        let path_clone = path.clone();

        // Spawn a task to handle events
        tokio::spawn(async move {
            Self::handle_events(rx, app_handle, watch_id_clone, path_clone).await;
        });

        // Create the watcher
        let recursive_mode = if recursive {
            RecursiveMode::Recursive
        } else {
            RecursiveMode::NonRecursive
        };

        match Self::create_watcher(tx, path.clone(), recursive_mode) {
            Ok(watcher) => {
                // Store the watcher and path
                {
                    let mut watchers = self.watchers.lock().unwrap();
                    watchers.insert(watch_id.clone(), watcher);
                }
                {
                    let mut watched_paths = self.watched_paths.lock().unwrap();
                    watched_paths.insert(watch_id, path);
                }
                Ok(())
            }
            Err(e) => Err(format!("Failed to create watcher: {}", e)),
        }
    }

    /// Stops watching a directory
    pub fn stop_watching(&self, watch_id: &str) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();
        let mut watched_paths = self.watched_paths.lock().unwrap();

        if watchers.remove(watch_id).is_some() {
            watched_paths.remove(watch_id);
            Ok(())
        } else {
            Err(format!("No watcher found with ID: {}", watch_id))
        }
    }

    /// Lists all active watchers
    pub fn list_watchers(&self) -> Vec<(String, String)> {
        let _watchers = self.watchers.lock().unwrap();
        let watched_paths = self.watched_paths.lock().unwrap();

        watched_paths
            .iter()
            .map(|(id, path)| (id.clone(), path.to_string_lossy().to_string()))
            .collect()
    }

    /// Creates a new file watcher
    fn create_watcher(
        tx: Sender<Result<Event, notify::Error>>,
        path: PathBuf,
        recursive_mode: RecursiveMode,
    ) -> Result<RecommendedWatcher, String> {
        // Create a new watcher with default config
        let config = Config::default();

        // Create the event handler
        let event_handler = move |res: Result<Event, notify::Error>| {
            let _ = tx.blocking_send(res);
        };

        // Create the watcher
        match RecommendedWatcher::new(event_handler, config) {
            Ok(mut watcher) => {
                // Start watching the path
                if let Err(e) = watcher.watch(path.as_ref(), recursive_mode) {
                    return Err(format!("Failed to watch path: {}", e));
                }
                Ok(watcher)
            }
            Err(e) => Err(format!("Failed to create watcher: {}", e)),
        }
    }

    /// Handles file system events and emits them to the frontend
    async fn handle_events(
        mut rx: Receiver<Result<Event, notify::Error>>,
        app_handle: AppHandle,
        watch_id: String,
        base_path: PathBuf,
    ) {
        while let Some(result) = rx.recv().await {
            match result {
                Ok(event) => {
                    // Process the event
                    let kind = match event.kind {
                        EventKind::Create(_) => "created",
                        EventKind::Modify(_) => "modified",
                        EventKind::Remove(_) => "removed",
                        EventKind::Access(_) => "accessed",
                        EventKind::Other => "other",
                        _ => "unknown",
                    };

                    // Process each path in the event
                    for path in event.paths {
                        // Create a relative path if possible
                        let path_str = if path.starts_with(&base_path) {
                            match path.strip_prefix(&base_path) {
                                Ok(rel_path) => rel_path.to_string_lossy().to_string(),
                                Err(_) => path.to_string_lossy().to_string(),
                            }
                        } else {
                            path.to_string_lossy().to_string()
                        };

                        // Create the event payload
                        let file_event = FileChangeEvent {
                            path: path_str,
                            kind: kind.to_string(),
                            watch_id: watch_id.clone(),
                        };

                        // Emit the event to the frontend
                        let _ = app_handle.emit("file-change", file_event);
                    }
                }
                Err(e) => {
                    eprintln!("Watch error: {:?}", e);
                    // Optionally emit an error event to the frontend
                    let _ = app_handle.emit(
                        "file-watcher-error",
                        format!("Error in watcher {}: {}", watch_id, e),
                    );
                }
            }
        }
    }
}
