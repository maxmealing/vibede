use tauri::{AppHandle, Manager, State, Emitter};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use url::Url;
use tauri_plugin_opener::OpenerExt;
use log;
use reqwest;
use serde_json;
use base64;

// Auth0 configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Auth0Config {
    pub domain: String,
    pub client_id: String,
    pub callback_url: String,
    pub audience: Option<String>,
    pub scope: String,
}

impl Default for Auth0Config {
    fn default() -> Self {
        Self {
            domain: String::new(),
            client_id: String::new(),
            callback_url: "vibede://callback".to_string(),
            audience: None,
            scope: "openid profile email".to_string(),
        }
    }
}

// Auth state
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct AuthState {
    pub authenticated: bool,
    pub access_token: Option<String>,
    pub id_token: Option<String>,
    pub expires_at: Option<u64>,
    pub user_info: Option<UserInfo>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub sub: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub picture: Option<String>,
}

// Shared state between commands
pub struct AuthStateStore {
    pub config: Arc<Mutex<Auth0Config>>,
    pub state: Arc<Mutex<AuthState>>,
}

impl Default for AuthStateStore {
    fn default() -> Self {
        Self {
            config: Arc::new(Mutex::new(Auth0Config::default())),
            state: Arc::new(Mutex::new(AuthState::default())),
        }
    }
}

// Auth service implementation
pub struct AuthService {
    app_handle: AppHandle,
}

impl AuthService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    // Initialize Auth0 configuration
    pub fn initialize_config(&self, config: Auth0Config) -> Result<(), String> {
        let state: State<AuthStateStore> = self.app_handle.state();
        let mut auth_config = state.config.lock().map_err(|e| e.to_string())?;
        *auth_config = config;
        Ok(())
    }

    // Start the login flow by opening the browser
    pub fn login(&self) -> Result<(), String> {
        let state: State<AuthStateStore> = self.app_handle.state();
        let config = state.config.lock().map_err(|e| e.to_string())?;
        
        // Generate a random state parameter for PKCE security
        let state_param = self.generate_random_string(32);
        let code_verifier = self.generate_random_string(64);
        let code_challenge = self.generate_code_challenge(&code_verifier);
        
        // Store the PKCE values in-memory
        self.store_pkce_params(&state_param, &code_verifier)?;
        
        // Determine the callback URL - use a web URL instead of direct protocol
        // This will handle the web flow first, then redirect to the custom protocol
        let redirect_uri = "http://localhost:3000/auth/callback";
        
        // Construct the Auth0 authorize URL
        let domain = if config.domain.starts_with("http") {
            // If domain already includes protocol, use it as is but ensure no trailing slash
            config.domain.trim_end_matches('/').to_string()
        } else {
            // Otherwise add https:// prefix
            format!("https://{}", config.domain.trim_end_matches('/'))
        };
        
        // Extract the base domain part without any paths
        let authorize_endpoint = if domain.contains("/api/") {
            // If domain contains API path, construct the authorize URL at the root level
            domain.split("/api/").next().unwrap_or(&domain).to_string()
        } else {
            domain
        };
        
        // Construct the full authorize URL
        let authorize_url = format!(
            "{}/authorize?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
            authorize_endpoint,
            config.client_id,
            urlencoding::encode(redirect_uri),
            urlencoding::encode(&config.scope),
            state_param,
            code_challenge
        );
        
        // Optional audience parameter
        let authorize_url = if let Some(audience) = &config.audience {
            format!("{}&audience={}", authorize_url, urlencoding::encode(audience))
        } else {
            authorize_url
        };
        
        // Open the browser with the Auth0 login page
        let opener = self.app_handle.opener();
        opener.open_url(&authorize_url, None::<&str>).map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    // Handle the callback from Auth0
    pub fn handle_callback(&self, callback_url: &str) -> Result<(), String> {
        log::info!("Handling Auth0 callback URL: {}", callback_url);
        
        // Parse the URL
        let url = match Url::parse(callback_url) {
            Ok(url) => {
                log::info!("Successfully parsed callback URL");
                url
            },
            Err(e) => {
                let error_msg = format!("Failed to parse callback URL: {}", e);
                log::error!("{}", error_msg);
                return Err(error_msg);
            }
        };
        
        // Extract the authorization code and state
        let params: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        
        log::info!("Callback parameters: {:?}", params);
        
        let code = match params.get("code") {
            Some(code) => {
                log::info!("Found authorization code: {}", code);
                code
            },
            None => {
                let error_msg = "No authorization code found in callback URL";
                log::error!("{}", error_msg);
                return Err(error_msg.to_string());
            }
        };
        
        let state = match params.get("state") {
            Some(state) => {
                log::info!("Found state parameter: {}", state);
                state
            },
            None => {
                let error_msg = "No state parameter found in callback URL";
                log::error!("{}", error_msg);
                return Err(error_msg.to_string());
            }
        };
        
        // Verify the state parameter
        let (stored_state, code_verifier) = match self.get_pkce_params() {
            Ok(params) => {
                log::info!("Retrieved PKCE parameters successfully");
                let (ref state, ref verifier) = params;
                log::info!("Stored state: {}, Code verifier length: {}", state, verifier.len());
                params
            },
            Err(e) => {
                let error_msg = format!("Failed to retrieve PKCE parameters: {}", e);
                log::error!("{}", error_msg);
                return Err(error_msg);
            }
        };
        
        if stored_state != *state {
            let error_msg = format!(
                "State parameter mismatch. Possible CSRF attack. Got: {}, Expected: {}", 
                state, stored_state
            );
            log::error!("{}", error_msg);
            return Err(error_msg);
        }
        
        log::info!("State parameter verified successfully");
        
        // Exchange the code for tokens
        match self.exchange_code_for_tokens(code, &code_verifier) {
            Ok(_) => {
                log::info!("Successfully exchanged code for tokens");
                
                // Emit an event to notify the frontend
                if let Err(e) = self.app_handle.emit("auth:login-complete", ()) {
                    log::warn!("Failed to emit auth:login-complete event: {}", e);
                } else {
                    log::info!("Emitted auth:login-complete event successfully");
                }
                
                Ok(())
            },
            Err(e) => {
                let error_msg = format!("Failed to exchange code for tokens: {}", e);
                log::error!("{}", error_msg);
                
                // Emit an error event to notify the frontend
                if let Err(e) = self.app_handle.emit("auth:login-error", error_msg.clone()) {
                    log::warn!("Failed to emit auth:login-error event: {}", e);
                } else {
                    log::info!("Emitted auth:login-error event successfully");
                }
                
                Err(error_msg)
            }
        }
    }
    
    // Exchange the authorization code for tokens
    fn exchange_code_for_tokens(&self, code: &str, code_verifier: &str) -> Result<(), String> {
        log::info!("Exchanging authorization code for tokens");
        
        // Get the Auth0 configuration
        let state: State<AuthStateStore> = self.app_handle.state();
        let config = state.config.lock().map_err(|e| e.to_string())?;
        
        log::info!("Auth0 config: domain={}, client_id={}", config.domain, config.client_id);
        
        // Determine the token endpoint URL
        let domain = if config.domain.starts_with("http") {
            config.domain.trim_end_matches('/').to_string()
        } else {
            format!("https://{}", config.domain.trim_end_matches('/'))
        };
        
        let token_url = format!("{}/oauth/token", domain);
        log::info!("Token URL: {}", token_url);
        
        // Prepare the token request payload
        let payload = serde_json::json!({
            "grant_type": "authorization_code",
            "client_id": config.client_id,
            "code_verifier": code_verifier,
            "code": code,
            "redirect_uri": "http://localhost:3000/auth/callback"
            // Uncomment and add your client secret if using a Regular Web Application
            // , "client_secret": "YOUR_CLIENT_SECRET_HERE"
        });
        
        log::info!("Sending token request with payload: {}", payload);
        
        // Make the token request
        let client = reqwest::blocking::Client::new();
        log::info!("Created HTTP client");
        
        let response = match client.post(&token_url)
            .header("Content-Type", "application/json")
            .body(payload.to_string())
            .send() {
                Ok(resp) => {
                    log::info!("Received response with status: {}", resp.status());
                    resp
                },
                Err(e) => {
                    let error_msg = format!("Failed to send token request: {}", e);
                    log::error!("{}", error_msg);
                    return Err(error_msg);
                }
            };
        
        // Check if the request was successful
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().unwrap_or_else(|_| "Unknown error".to_string());
            log::error!("Token request failed with payload: {}", payload);
            log::error!("Token request headers: Content-Type: application/json");
            log::error!("Token URL: {}", token_url);
            let error_msg = format!("Token request failed with status {}: {}", status, error_text);
            log::error!("{}", error_msg);
            return Err(error_msg);
        }
        
        // Parse the token response
        let token_response: serde_json::Value = match response.json() {
            Ok(json) => {
                log::info!("Successfully parsed token response");
                json
            },
            Err(e) => {
                let error_msg = format!("Failed to parse token response: {}", e);
                log::error!("{}", error_msg);
                return Err(error_msg);
            }
        };
        
        log::info!("Token response keys: {:?}", token_response.as_object().map(|obj| obj.keys().collect::<Vec<_>>()));
        
        // Extract the tokens
        let access_token = match token_response["access_token"].as_str() {
            Some(token) => {
                log::info!("Successfully extracted access token");
                token.to_string()
            },
            None => {
                let error_msg = "No access token in response";
                log::error!("{}", error_msg);
                return Err(error_msg.to_string());
            }
        };
        
        let id_token = match token_response["id_token"].as_str() {
            Some(token) => {
                log::info!("Successfully extracted ID token");
                token.to_string()
            },
            None => {
                let error_msg = "No ID token in response";
                log::error!("{}", error_msg);
                return Err(error_msg.to_string());
            }
        };
        
        let expires_in = token_response["expires_in"].as_u64().unwrap_or(3600);
        log::info!("Token expires in {} seconds", expires_in);
        
        // Decode the ID token to get user info
        // Note: In a production app, you should verify the token signature
        let id_token_parts: Vec<&str> = id_token.split('.').collect();
        if id_token_parts.len() < 2 {
            let error_msg = "Invalid ID token format";
            log::error!("{}", error_msg);
            return Err(error_msg.to_string());
        }
        
        log::info!("ID token has {} parts", id_token_parts.len());
        
        // Decode the payload part (second part) of the JWT
        let payload_base64 = id_token_parts[1];
        
        // Add padding if needed
        let mut padded_payload = payload_base64.to_string();
        while padded_payload.len() % 4 != 0 {
            padded_payload.push('=');
        }
        
        // Use the non-deprecated base64 decoding API
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine;
        let payload_bytes = match STANDARD.decode(padded_payload.replace('-', "+").replace('_', "/")) {
            Ok(bytes) => {
                log::info!("Successfully decoded ID token payload");
                bytes
            },
            Err(e) => {
                let error_msg = format!("Failed to decode ID token payload: {}", e);
                log::error!("{}", error_msg);
                return Err(error_msg);
            }
        };
        
        let payload_str = match String::from_utf8(payload_bytes) {
            Ok(str) => {
                log::info!("Successfully converted payload to string");
                str
            },
            Err(e) => {
                let error_msg = format!("Failed to convert payload to string: {}", e);
                log::error!("{}", error_msg);
                return Err(error_msg);
            }
        };
        
        let user_claims: serde_json::Value = match serde_json::from_str(&payload_str) {
            Ok(claims) => {
                log::info!("Successfully parsed user claims");
                claims
            },
            Err(e) => {
                let error_msg = format!("Failed to parse user claims: {}", e);
                log::error!("{}", error_msg);
                return Err(error_msg);
            }
        };
        
        log::info!("User claims keys: {:?}", user_claims.as_object().map(|obj| obj.keys().collect::<Vec<_>>()));
        
        // Extract user info from the claims
        let sub = match user_claims["sub"].as_str() {
            Some(sub) => {
                log::info!("Successfully extracted sub claim: {}", sub);
                sub.to_string()
            },
            None => {
                let error_msg = "No sub claim in ID token";
                log::error!("{}", error_msg);
                return Err(error_msg.to_string());
            }
        };
        
        let name = user_claims["name"].as_str().map(|s| s.to_string());
        let email = user_claims["email"].as_str().map(|s| s.to_string());
        let picture = user_claims["picture"].as_str().map(|s| s.to_string());
        
        log::info!("User info: sub={}, name={:?}, email={:?}, picture={:?}", 
            sub, name, email, picture);
        
        // Update the auth state
        let mut auth_state = state.state.lock().map_err(|e| e.to_string())?;
        auth_state.authenticated = true;
        auth_state.access_token = Some(access_token);
        auth_state.id_token = Some(id_token);
        auth_state.expires_at = Some(self.current_time() + expires_in);
        auth_state.user_info = Some(UserInfo {
            sub,
            name,
            email,
            picture,
        });
        
        log::info!("Auth state updated successfully");
        
        Ok(())
    }
    
    // Logout the user
    pub fn logout(&self) -> Result<(), String> {
        let state: State<AuthStateStore> = self.app_handle.state();
        let config = state.config.lock().map_err(|e| e.to_string())?;
        let mut auth_state = state.state.lock().map_err(|e| e.to_string())?;
        
        // Clear the auth state
        *auth_state = AuthState::default();
        
        // Construct the Auth0 logout URL
        let logout_url = format!(
            "https://{}/v2/logout?client_id={}&returnTo={}",
            config.domain,
            config.client_id,
            urlencoding::encode(&config.callback_url)
        );
        
        // Open the browser with the Auth0 logout page
        let opener = self.app_handle.opener();
        opener.open_url(&logout_url, None::<&str>).map_err(|e| e.to_string())?;
        
        // Emit an event to notify the frontend
        self.app_handle.emit("auth:logout-complete", ()).map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    // Get the current authentication state
    pub fn get_auth_state(&self) -> Result<AuthState, String> {
        let state: State<AuthStateStore> = self.app_handle.state();
        let auth_state = state.state.lock().map_err(|e| e.to_string())?;
        Ok(auth_state.clone())
    }
    
    // Helper functions
    
    // Generate a random string for PKCE
    fn generate_random_string(&self, length: usize) -> String {
        use rand::{distributions::Alphanumeric, Rng};
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(length)
            .map(char::from)
            .collect()
    }
    
    // Generate a code challenge from code verifier
    fn generate_code_challenge(&self, code_verifier: &str) -> String {
        use base64ct::{Base64UrlUnpadded, Encoding};
        use sha2::{Digest, Sha256};
        
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let hash = hasher.finalize();
        
        Base64UrlUnpadded::encode_string(&hash)
    }
    
    // Store PKCE parameters (in a real implementation, use secure storage)
    pub fn store_pkce_params(&self, state: &str, code_verifier: &str) -> Result<(), String> {
        // This is a simplified implementation for demonstration
        // In a real app, consider using secure storage
        
        log::info!("Storing PKCE parameters: state={}, code_verifier_length={}", state, code_verifier.len());
        let pkce_pair = format!("{}:{}", state, code_verifier);
        std::env::set_var("AUTH0_PKCE", pkce_pair);
        log::info!("PKCE parameters stored successfully");
        Ok(())
    }
    
    // Get stored PKCE parameters
    pub fn get_pkce_params(&self) -> Result<(String, String), String> {
        // This is a simplified implementation for demonstration
        
        log::info!("Retrieving PKCE parameters");
        let pkce_pair = std::env::var("AUTH0_PKCE").map_err(|e| {
            let error_msg = format!("PKCE parameters not found: {}", e);
            log::error!("{}", error_msg);
            error_msg
        })?;
        
        log::info!("Retrieved raw PKCE pair: {}", pkce_pair);
        let parts: Vec<&str> = pkce_pair.split(':').collect();
        
        if parts.len() != 2 {
            let error_msg = format!("Invalid PKCE parameters format: got {} parts", parts.len());
            log::error!("{}", error_msg);
            return Err(error_msg);
        }
        
        log::info!("Parsed PKCE parameters: state={}, code_verifier_length={}", parts[0], parts[1].len());
        Ok((parts[0].to_string(), parts[1].to_string()))
    }
    
    // Get current UNIX timestamp
    fn current_time(&self) -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }
} 