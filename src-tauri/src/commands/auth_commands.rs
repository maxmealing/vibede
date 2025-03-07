use crate::services::auth_service::{Auth0Config, AuthService, AuthState};
use tauri::{AppHandle, State, command};
use crate::services::auth_service::AuthStateStore;

// Initialize Auth0 configuration
#[command]
pub fn initialize_auth0(
    app_handle: AppHandle,
    domain: String,
    client_id: String,
    callback_url: Option<String>,
    audience: Option<String>,
    scope: Option<String>,
) -> Result<(), String> {
    let service = AuthService::new(app_handle);
    
    let config = Auth0Config {
        domain,
        client_id,
        callback_url: callback_url.unwrap_or_else(|| "vibede://callback".to_string()),
        audience,
        scope: scope.unwrap_or_else(|| "openid profile email".to_string()),
    };
    
    service.initialize_config(config)
}

// Start the login process
#[command]
pub fn login(app_handle: AppHandle) -> Result<(), String> {
    let service = AuthService::new(app_handle);
    service.login()
}

// Handle the callback from Auth0
#[command]
pub fn handle_auth_callback(app_handle: AppHandle, callback_url: String) -> Result<(), String> {
    log::info!("Received handle_auth_callback command with URL: {}", callback_url);
    let service = AuthService::new(app_handle);
    service.handle_callback(&callback_url)
}

// Logout the user
#[command]
pub fn logout(app_handle: AppHandle) -> Result<(), String> {
    let service = AuthService::new(app_handle);
    service.logout()
}

// Get the current authentication state
#[command]
pub fn get_auth_state(app_handle: AppHandle) -> Result<AuthState, String> {
    let service = AuthService::new(app_handle);
    service.get_auth_state()
}

// Check if the user is authenticated
#[command]
pub fn is_authenticated(state: State<AuthStateStore>) -> Result<bool, String> {
    let auth_state = state.state.lock().map_err(|e| e.to_string())?;
    Ok(auth_state.authenticated)
}

// Register the deeplink handler (called by main.rs)
pub fn register_uri_scheme_handler(_app_handle: &AppHandle) {
    // Log that we're registering the handler
    log::info!("URI scheme handler for 'vibede://' is now handled by the deep-link plugin");
    
    // We don't need to set up event listeners here anymore since the deep-link plugin handles this
    // The deep-link plugin will emit events that are handled in lib.rs
}

// Helper function to handle protocol events - no longer needed with deep-link plugin
// fn handle_protocol_event(payload: &str, app_handle: &AppHandle) {
//     // Parse the payload as a JSON value and extract the URL string
//     if let Ok(value) = serde_json::from_str::<serde_json::Value>(payload) {
//         // Try different possible payload formats
//         let url = if let Some(url) = value.get("url").and_then(|v| v.as_str()) {
//             url.to_string()
//         } else if let Some(url) = value.as_str() {
//             url.to_string()
//         } else {
//             log::error!("Could not extract URL from payload: {}", payload);
//             return;
//         };
//         
//         // Make sure this is our protocol
//         if url.starts_with("vibede://") {
//             log::info!("Processing vibede:// protocol URL: {}", url);
//             
//             let service = AuthService::new(app_handle.clone());
//             
//             // Handle the callback
//             match service.handle_callback(&url) {
//                 Ok(_) => {
//                     log::info!("Auth0 callback handled successfully");
//                     
//                     // Emit an event to the UI
//                     if let Err(err) = app_handle.emit("auth:login-complete", ()) {
//                         log::error!("Failed to emit auth:login-complete event: {}", err);
//                     }
//                 },
//                 Err(err) => {
//                     log::error!("Error handling Auth0 callback: {}", err);
//                     
//                     // Emit an error event to the UI
//                     if let Err(e) = app_handle.emit("auth:login-error", err.clone()) {
//                         log::error!("Failed to emit auth:login-error event: {}", e);
//                     }
//                 }
//             }
//         } else {
//             log::warn!("Received non-vibede protocol URL: {}", url);
//         }
//     } else {
//         log::error!("Failed to parse protocol event payload: {}", payload);
//     }
// }

// Add a new command for manual authentication
#[tauri::command]
pub fn manual_authenticate(code: String, state: String, code_verifier: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    log::info!("Manual authentication requested with code, state, and code_verifier");
    
    // Create auth service
    let auth_service = AuthService::new(app_handle.clone());
    
    // Store the PKCE parameters first
    auth_service.store_pkce_params(&state, &code_verifier)?;
    
    log::info!("Stored PKCE parameters for manual authentication");
    
    // Create a callback URL from the provided code and state
    // Use the same redirect URI format that was used during authorization
    let callback_url = format!("http://localhost:3000/auth/callback?code={}&state={}", code, state);
    
    // Handle the callback
    match auth_service.handle_callback(&callback_url) {
        Ok(_) => {
            log::info!("Manual authentication successful");
            Ok(())
        },
        Err(e) => {
            log::error!("Manual authentication failed: {}", e);
            Err(e)
        }
    }
}

// Add a command to manually set PKCE parameters for testing
#[tauri::command]
pub fn set_test_pkce_params(state: String, code_verifier: String) -> Result<(), String> {
    log::info!("Setting test PKCE parameters: state={}, code_verifier length={}", state, code_verifier.len());
    
    // Store the PKCE parameters in the environment variable
    let pkce_pair = format!("{}:{}", state, code_verifier);
    std::env::set_var("AUTH0_PKCE", pkce_pair);
    
    log::info!("Test PKCE parameters set successfully");
    Ok(())
}

// Add a command to get the current PKCE parameters for testing
#[tauri::command]
pub fn get_test_pkce_params(app_handle: AppHandle) -> Result<(String, String), String> {
    log::info!("Retrieving test PKCE parameters for debugging");
    
    let service = AuthService::new(app_handle);
    match service.get_pkce_params() {
        Ok(params) => {
            let (ref state, ref code_verifier) = params;
            log::info!("Retrieved PKCE parameters: state={}, code_verifier_length={}", state, code_verifier.len());
            Ok(params)
        },
        Err(e) => {
            log::error!("Failed to retrieve PKCE parameters: {}", e);
            Err(e)
        }
    }
} 