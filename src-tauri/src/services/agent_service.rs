use langchain_rust::{
    chain::{Chain, LLMChainBuilder},
    fmt_message, fmt_placeholder, fmt_template,
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

    /// Create a conversation chain that maintains conversation history
    pub async fn create_conversation_response(
        &self, 
        system_prompt: String, 
        user_input: String, 
        history: Vec<(String, String)>
    ) -> Result<AgentResponse, String> {
        let lock = self.claude.lock().await;
        
        if let Some(claude) = &*lock {
            // Convert history to Message format
            let history_messages: Vec<Message> = history
                .into_iter()
                .flat_map(|(human, ai)| {
                    vec![
                        Message::new_human_message(human),
                        Message::new_ai_message(ai),
                    ]
                })
                .collect();

            let prompt = message_formatter![
                fmt_message!(Message::new_system_message(&system_prompt)),
                fmt_placeholder!("history"),
                fmt_template!(HumanMessagePromptTemplate::new(template_fstring!(
                    "{input}", "input"
                ))),
            ];

            let chain = LLMChainBuilder::new()
                .prompt(prompt)
                .llm(claude.clone())
                .build()
                .map_err(|e| format!("Error building conversation chain: {e}"))?;

            let result = chain
                .invoke(prompt_args! {
                    "input" => user_input,
                    "history" => history_messages,
                })
                .await
                .map_err(|e| format!("Error invoking conversation chain: {e}"))?;

            let content = result.to_string();
            Ok(AgentResponse { content })
        } else {
            Err("Agent service has not been initialized with an API key".to_string())
        }
    }
} 