pub mod commands;
pub mod services;
pub mod utils;

use commands::dialog_commands::{select_directory_dialog, list_directory_files};
use services::file_service::FileService;
use utils::panic_handler::setup_panic_handler;
use std::fs::File;
use std::io::Write;
use tauri::Manager;

// Simple file logger
fn log_to_file(message: &str) {
    let log_path = std::env::temp_dir().join("vibede-debug.log");
    
    if let Ok(mut file) = File::options().create(true).append(true).open(&log_path) {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let log_line = format!("[{}] {}\n", timestamp, message);
        
        let _ = file.write_all(log_line.as_bytes());
    } else {
        eprintln!("Failed to open log file at: {:?}", log_path);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log_to_file("Application entry point reached");
    
    // Set up panic handler
    setup_panic_handler();
    log_to_file("Panic handler set up");
    
    // Start logging
    log_to_file("Starting Tauri application");
    
    // Set up the Tauri builder
    log_to_file("Setting up Tauri builder");
    let builder = tauri::Builder::default();
    
    // Add the dialog plugin
    log_to_file("Initializing dialog plugin");
    let builder = builder.plugin(tauri_plugin_dialog::init());
    
    log_to_file("Setting up invoke handler");
    let builder = builder.invoke_handler(tauri::generate_handler![
        select_directory_dialog,
        list_directory_files
    ]);
    
    log_to_file("Setting up app");
    let builder = builder.setup(|app| {
        log_to_file("Application setup starting");
        
        // Set up panic recovery for dialog operations
        std::panic::set_hook(Box::new(|panic_info| {
            let message = format!("PANIC OCCURRED: {}", panic_info);
            log_to_file(&message);
            eprintln!("{}", message);
        }));
        
        // Example usage of FileService
        let file_service = FileService::new();
        if let Ok(cwd) = std::env::current_dir() {
            let cwd_str = cwd.to_string_lossy();
            log_to_file(&format!("Current working directory: {}", cwd_str));
            
            if file_service.path_exists(&cwd) {
                match file_service.get_file_info(&cwd) {
                    Ok(info) => {
                        log_to_file(&format!("Directory info: {}", info));
                    },
                    Err(e) => {
                        log_to_file(&format!("Error getting directory info: {}", e));
                    },
                }
            }
        }
        
        // Explicitly get the main window and show it
        log_to_file("Attempting to get main window");
        
        match app.get_webview_window("main") {
            Some(window) => {
                log_to_file("Successfully retrieved main window");
                
                match window.show() {
                    Ok(_) => {
                        log_to_file("Window show() successful");
                    },
                    Err(e) => {
                        log_to_file(&format!("Window show() failed: {}", e));
                    },
                }
                
                // Check if window is visible
                match window.is_visible() {
                    Ok(visible) => {
                        log_to_file(&format!("Window is_visible(): {}", visible));
                    },
                    Err(e) => {
                        log_to_file(&format!("Window is_visible() check failed: {}", e));
                    },
                }
            },
            None => {
                log_to_file("Failed to get main window. Window not found!");
            },
        }
        
        Ok(())
    });
    
    log_to_file("Running Tauri application");
    match builder.run(tauri::generate_context!()) {
        Ok(_) => log_to_file("Tauri application finished successfully"),
        Err(e) => {
            let err_msg = format!("Error running Tauri application: {}", e);
            log_to_file(&err_msg);
            eprintln!("{}", err_msg);
        }
    }
}
