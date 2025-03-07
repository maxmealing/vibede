"use client";

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AgentsPage() {
  const [apiKey, setApiKey] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Default system prompt for claude
  const systemPrompt = 
    "You are Claude, an AI assistant by Anthropic. You are helpful, harmless, and honest. " +
    "Provide thoughtful, accurate, and ethical responses to the user's questions.";

  // Check if the agent service is already initialized
  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const initialized = await invoke("is_agent_initialized") as boolean;
        setIsInitialized(initialized);
      } catch (error) {
        console.error("Failed to check agent initialization:", error);
      }
    };

    checkInitialization();
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize the agent with API key
  const handleInitialize = async () => {
    if (!apiKey.trim()) {
      alert("Please enter an API key");
      return;
    }

    setInitializing(true);
    try {
      await invoke("initialize_agent", { apiKey });
      setIsInitialized(true);
      // Add a welcome message
      setMessages([
        {
          role: "assistant",
          content: "Hello! I'm Claude 3.7 Sonnet. How can I help you today?",
        },
      ]);
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      alert(`Failed to initialize: ${error}`);
    } finally {
      setInitializing(false);
    }
  };

  // Send a message to the agent
  const sendMessage = async () => {
    if (!input.trim() || loading || !isInitialized) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Use conversation invoke if we have history, otherwise use simple chain
      let response;
      if (messages.length > 0) {
        response = await invoke("agent_conversation_invoke", {
          systemPrompt,
          userInput: input,
          history: messages,
        }) as string;
      } else {
        response = await invoke("agent_chain_invoke", {
          systemPrompt,
          userInput: input,
        }) as string;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    } catch (error) {
      console.error("Failed to get response:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I encountered an error: ${error}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Claude Sonnet Agent</h1>

      {!isInitialized ? (
        <div className="flex flex-col gap-4 p-6 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold">Initialize Claude Agent</h2>
          <p className="text-gray-600">
            Enter your Anthropic API key to start chatting with Claude 3.7 Sonnet
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Anthropic API key"
            className="p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleInitialize}
            disabled={initializing}
            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
          >
            {initializing ? "Initializing..." : "Initialize"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col flex-grow">
          <div className="flex-grow overflow-auto border border-gray-200 rounded-lg p-4 mb-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-100 ml-8"
                    : "bg-gray-100 mr-8"
                }`}
              >
                <div className="font-semibold mb-1">
                  {message.role === "user" ? "You" : "Claude"}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            ))}
            {loading && (
              <div className="mb-4 p-3 rounded-lg bg-gray-100 mr-8">
                <div className="font-semibold mb-1">Claude</div>
                <div className="animate-pulse">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask something..."
              className="flex-grow p-2 border border-gray-300 rounded"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 