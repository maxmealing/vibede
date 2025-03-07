use crate::services::AgentService;
use serde::{Deserialize, Serialize};
use tauri::State;

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