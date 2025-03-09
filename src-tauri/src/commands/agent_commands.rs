use crate::services::AgentService;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::process::Command;

/// Represents a chat message with role and content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,    // "user" or "assistant"
    pub content: String, // The message content
}

/// Initialize the Agent service with an OpenAI API key
#[tauri::command]
pub async fn initialize_agent(
    api_key: String,
    agent_service: State<'_, AgentService>,
) -> Result<(), String> {
    agent_service.initialize(api_key).await
}

/// Check if the Agent service is initialized
#[tauri::command]
pub async fn is_agent_initialized(
    agent_service: State<'_, AgentService>,
) -> Result<bool, String> {
    Ok(agent_service.is_initialized().await)
}

/// Check if packages required for testing a specific language are installed
#[tauri::command]
pub async fn check_package_installation(language: String) -> Result<bool, String> {
    match language.to_lowercase().as_str() {
        "javascript" | "typescript" => {
            // Check for Jest
            let jest_output = Command::new("npx")
                .args(["jest", "--version"])
                .output();
            
            match jest_output {
                Ok(output) => {
                    if output.status.success() {
                        return Ok(true);
                    }
                    log::info!("Jest not found: {:?}", output);
                    Ok(false)
                },
                Err(e) => {
                    log::error!("Error checking for Jest: {}", e);
                    Ok(false)
                }
            }
        },
        "python" => {
            // Check for pytest
            let pytest_output = Command::new("python")
                .args(["-m", "pytest", "--version"])
                .output();
            
            match pytest_output {
                Ok(output) => {
                    if output.status.success() {
                        return Ok(true);
                    }
                    log::info!("pytest not found: {:?}", output);
                    Ok(false)
                },
                Err(e) => {
                    log::error!("Error checking for pytest: {}", e);
                    Ok(false)
                }
            }
        },
        "rust" => {
            // Check for cargo (Rust's package manager)
            let cargo_output = Command::new("cargo")
                .arg("--version")
                .output();
            
            match cargo_output {
                Ok(output) => {
                    if output.status.success() {
                        // Cargo is installed, which includes the test framework
                        return Ok(true);
                    }
                    log::info!("Cargo not found: {:?}", output);
                    Ok(false)
                },
                Err(e) => {
                    log::error!("Error checking for Cargo: {}", e);
                    Ok(false)
                }
            }
        },
        _ => {
            log::warn!("No package installation check implemented for language: {}", language);
            // Return true for unknown languages to avoid blocking test generation
            Ok(true)
        }
    }
}

/// Simple invocation of the LLM with a prompt
#[tauri::command]
pub async fn agent_simple_invoke(
    prompt: String,
    agent_service: State<'_, AgentService>,
) -> Result<String, String> {
    let response = agent_service.simple_invoke(prompt).await?;
    Ok(response.content)
}

/// Create a chain with a system prompt and user input
#[tauri::command]
pub async fn agent_chain_invoke(
    system_prompt: String,
    user_input: String,
    agent_service: State<'_, AgentService>,
) -> Result<String, String> {
    let response = agent_service
        .create_chain_response(system_prompt, user_input)
        .await?;
    Ok(response.content)
}

/// Generate tests for provided code
#[tauri::command]
pub async fn generate_tests(
    code: String,
    language: String,
    test_framework: Option<String>,
    agent_service: State<'_, AgentService>,
) -> Result<String, String> {
    let response = agent_service
        .generate_tests(code, language, test_framework)
        .await?;
    Ok(response.content)
} 