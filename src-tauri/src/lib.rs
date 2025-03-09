pub mod commands;
pub mod services;
pub mod utils;

use commands::dialog_commands::{select_directory_dialog, list_directory_files, list_directories};
use commands::file_watcher_commands::{start_watching_directory, stop_watching_directory, list_active_watchers, trigger_test_event, FileWatcherState};
use commands::auth_commands::{initialize_auth0, login, logout, get_auth_state, is_authenticated, handle_auth_callback, register_uri_scheme_handler, manual_authenticate, set_test_pkce_params, get_test_pkce_params};
use commands::agent_commands::{initialize_agent, is_agent_initialized, agent_simple_invoke, agent_chain_invoke, generate_tests, check_package_installation};
use commands::file_analysis_commands::{find_test_files, generate_and_write_test};
use services::file_service::FileService;
use services::auth_service::{AuthService, AuthStateStore};
use services::AgentService;
use utils::panic_handler::setup_panic_handler;
use std::fs::File;
use std::io::Write;
use tauri::Manager;
use tauri::Emitter;
use tauri::Listener;

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
    
    // Add the HTTP plugin
    log_to_file("Initializing HTTP plugin");
    let builder = builder.plugin(tauri_plugin_http::init());
    
    // Add the Shell plugin
    log_to_file("Initializing Shell plugin");
    let builder = builder.plugin(tauri_plugin_shell::init());
    
    // Add the Opener plugin
    log_to_file("Initializing Opener plugin");
    let builder = builder.plugin(tauri_plugin_opener::init());
    
    // Add the Deep Link plugin
    log_to_file("Initializing Deep Link plugin");
    let builder = builder.plugin(tauri_plugin_deep_link::init());
    
    // Initialize the auth state store
    log_to_file("Initializing auth state store");
    let builder = builder.manage(AuthStateStore::default());
    
    // Initialize the Agent service
    log_to_file("Initializing Agent service");
    let builder = builder.manage(AgentService::new());
    
    log_to_file("Setting up invoke handler");
    let builder = builder.invoke_handler(tauri::generate_handler![
        select_directory_dialog,
        list_directory_files,
        list_directories,
        start_watching_directory,
        stop_watching_directory,
        list_active_watchers,
        trigger_test_event,
        
        // Auth0 commands
        initialize_auth0,
        login,
        logout,
        get_auth_state,
        is_authenticated,
        handle_auth_callback,
        manual_authenticate,
        set_test_pkce_params,
        get_test_pkce_params,
        
        // Agent commands
        initialize_agent,
        is_agent_initialized,
        agent_simple_invoke,
        agent_chain_invoke,
        generate_tests,
        check_package_installation,
        
        // File analysis commands
        find_test_files,
        generate_and_write_test,
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
        
        // Initialize the file watcher state
        let app_handle = app.handle().clone();
        app.manage(FileWatcherState::new(app_handle.clone()));
        log_to_file("File watcher state initialized");
        
        // Register URI scheme handler for Auth0 callbacks
        log_to_file("Registering URI scheme handler for Auth0");
        register_uri_scheme_handler(&app.handle());
        
        // Register deep link scheme at runtime for development
        #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
        {
            log_to_file("Registering deep link scheme at runtime for development");
            // Import DeepLinkExt trait locally
            use tauri_plugin_deep_link::DeepLinkExt;
            if let Err(e) = app.deep_link().register_all() {
                log_to_file(&format!("Failed to register deep link schemes: {}", e));
            } else {
                log_to_file("Deep link schemes registered successfully");
            }
        }
        
        // Set up deep link event listener
        log_to_file("Setting up deep link event listener");
        {
            // Clone the app handle for use in the event listener
            let event_app_handle = app.handle().clone();
            
            // Listen for deep link events
            app.handle().listen("tauri://deep-link", move |event| {
                // Get the payload as a string
                let payload = event.payload().to_string();
                log_to_file(&format!("Deep link received: {}", payload));
                
                // Check if this is a callback URL
                if payload.starts_with("vibede://callback") {
                    log_to_file(&format!("Processing Auth0 callback URL: {}", payload));
                    
                    // Create auth service and handle the callback
                    let auth_service = AuthService::new(event_app_handle.clone());
                    
                    // Handle the callback
                    match auth_service.handle_callback(&payload) {
                        Ok(_) => {
                            log_to_file("Auth0 callback handled successfully");
                            // Emit event to notify frontend
                            if let Err(e) = event_app_handle.emit("auth:login-complete", ()) {
                                log_to_file(&format!("Failed to emit auth:login-complete event: {}", e));
                            }
                        },
                        Err(e) => {
                            log_to_file(&format!("Error handling Auth0 callback: {}", e));
                            // Emit error event
                            if let Err(e) = event_app_handle.emit("auth:login-error", e.clone()) {
                                log_to_file(&format!("Failed to emit auth:login-error event: {}", e));
                            }
                        }
                    }
                }
            });
        }
        
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
