use langchain_rust::{
    chain::{Chain, LLMChainBuilder},
    fmt_message, fmt_template,
    language_models::llm::LLM,
    llm::Claude,
    message_formatter,
    prompt::HumanMessagePromptTemplate,
    prompt_args,
    schemas::messages::Message,
    template_fstring,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Represents the response from an LLM model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub content: String,
}

/// Service for handling AI Agents using LangChain
pub struct AgentService {
    claude: Arc<Mutex<Option<Claude>>>,
}

impl AgentService {
    /// Create a new AgentService instance
    pub fn new() -> Self {
        Self {
            claude: Arc::new(Mutex::new(None)),
        }
    }

    /// Initialize the Claude model with the provided API key
    pub async fn initialize(&self, api_key: String) -> Result<(), String> {
        let claude = Claude::default()
            .with_api_key(api_key)
            .with_model("claude-3-7-sonnet-20250219");

        let mut lock = self.claude.lock().await;
        *lock = Some(claude);
        
        Ok(())
    }

    /// Check if the service has been initialized with an API key
    pub async fn is_initialized(&self) -> bool {
        let lock = self.claude.lock().await;
        lock.is_some()
    }

    /// Simple invocation of the LLM with a prompt
    pub async fn simple_invoke(&self, prompt: String) -> Result<AgentResponse, String> {
        let lock = self.claude.lock().await;
        
        if let Some(claude) = &*lock {
            let response = claude.invoke(&prompt).await
                .map_err(|e| format!("Error invoking LLM: {e}"))?;
            
            Ok(AgentResponse { content: response })
        } else {
            Err("Agent service has not been initialized with an API key".to_string())
        }
    }

    /// Create a chain with a system prompt and user input
    pub async fn create_chain_response(&self, system_prompt: String, user_input: String) -> Result<AgentResponse, String> {
        let lock = self.claude.lock().await;
        
        if let Some(claude) = &*lock {
            let prompt = message_formatter![
                fmt_message!(Message::new_system_message(&system_prompt)),
                fmt_template!(HumanMessagePromptTemplate::new(template_fstring!(
                    "{input}", "input"
                )))
            ];

            let chain = LLMChainBuilder::new()
                .prompt(prompt)
                .llm(claude.clone())
                .build()
                .map_err(|e| format!("Error building chain: {e}"))?;

            let result = chain
                .invoke(prompt_args! {
                    "input" => user_input,
                })
                .await
                .map_err(|e| format!("Error invoking chain: {e}"))?;

            let content = result.to_string();
            Ok(AgentResponse { content })
        } else {
            Err("Agent service has not been initialized with an API key".to_string())
        }
    }
    
    /// Generate tests for provided code
    pub async fn generate_tests(&self, code: String, language: String, test_framework: Option<String>) -> Result<AgentResponse, String> {
        let lock = self.claude.lock().await;
        
        if let Some(claude) = &*lock {
            // Create a specialized system prompt for test generation
            let system_prompt = format!(
                r#"You are a specialized test generation agent. Your task is to analyze the code provided and generate comprehensive test cases.

Follow these guidelines:
1. Create thorough test cases covering all functionality in the code
2. Include tests for edge cases and error handling
3. Ensure the tests are well-organized and commented
4. Use {}{}

Respond ONLY with the generated test code, without explanations or commentary outside the code."#,
                language,
                if let Some(framework) = test_framework {
                    format!(" and the {} testing framework", framework)
                } else {
                    " best practices for testing".to_string()
                }
            );

            let prompt = message_formatter![
                fmt_message!(Message::new_system_message(&system_prompt)),
                fmt_template!(HumanMessagePromptTemplate::new(template_fstring!(
                    "Here is the code to generate tests for:\n\n```\n{code}\n```\n\nGenerate comprehensive tests for this code.", 
                    "code"
                )))
            ];

            let chain = LLMChainBuilder::new()
                .prompt(prompt)
                .llm(claude.clone())
                .build()
                .map_err(|e| format!("Error building test generation chain: {e}"))?;

            let result = chain
                .invoke(prompt_args! {
                    "code" => code,
                })
                .await
                .map_err(|e| format!("Error generating tests: {e}"))?;

            let content = result.to_string();
            Ok(AgentResponse { content })
        } else {
            Err("Agent service has not been initialized with an API key".to_string())
        }
    }
} 