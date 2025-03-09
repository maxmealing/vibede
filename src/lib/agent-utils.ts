import { invoke } from "@tauri-apps/api/core";
import { Command } from '@tauri-apps/plugin-shell';
import path from 'path-browserify';

/**
 * Initializes the agent with the API key from localStorage if available
 * @returns A promise that resolves to a boolean indicating if the agent was initialized
 */
export async function initializeAgentFromStorage(): Promise<boolean> {
  try {
    // First check if the agent is already initialized
    const isInitialized = await invoke("is_agent_initialized") as boolean;
    if (isInitialized) {
      console.log("Agent is already initialized");
      return true;
    }
    
    // If not initialized, try to initialize with the saved API key
    const savedApiKey = localStorage.getItem("anthropic_api_key");
    if (savedApiKey) {
      try {
        console.log("Initializing agent with saved API key");
        await invoke("initialize_agent", { apiKey: savedApiKey });
        console.log("Agent initialized successfully");
        return true;
      } catch (error) {
        console.error("Error details for initialization failure:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
        }
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    return false;
  }
}

/**
 * Checks if the agent is initialized
 * @returns A promise that resolves to a boolean indicating if the agent is initialized
 */
export async function isAgentInitialized(): Promise<boolean> {
  try {
    return await invoke("is_agent_initialized") as boolean;
  } catch (error) {
    console.error("Failed to check agent initialization:", error);
    return false;
  }
}

/**
 * Detects the programming language from a file path based on its extension
 */
export function detectLanguageFromFile(filePath: string): { language: string; extension: string } {
  const extension = path.extname(filePath).toLowerCase();
  
  switch (extension) {
    case '.js':
      return { language: 'JavaScript', extension };
    case '.jsx':
      return { language: 'React', extension };
    case '.ts':
      return { language: 'TypeScript', extension };
    case '.tsx':
      return { language: 'React', extension };
    case '.py':
      return { language: 'Python', extension };
    case '.rb':
      return { language: 'Ruby', extension };
    case '.java':
      return { language: 'Java', extension };
    case '.go':
      return { language: 'Go', extension };
    case '.rs':
      return { language: 'Rust', extension };
    case '.php':
      return { language: 'PHP', extension };
    case '.cs':
      return { language: 'C#', extension };
    case '.cpp':
    case '.cc':
    case '.cxx':
      return { language: 'C++', extension };
    case '.c':
      return { language: 'C', extension };
    case '.swift':
      return { language: 'Swift', extension };
    case '.kt':
    case '.kts':
      return { language: 'Kotlin', extension };
    default:
      return { language: 'Unknown', extension };
  }
}

/**
 * Gets testing framework recommendations for a specific language
 */
export function getTestingRecommendations(language: string): { framework: string; installCommand: string; description: string } {
  switch (language) {
    case 'JavaScript':
      return {
        framework: 'Jest',
        installCommand: 'npm install --save-dev jest',
        description: 'Jest is a delightful JavaScript Testing Framework with a focus on simplicity.'
      };
    case 'TypeScript':
      return {
        framework: 'Jest + ts-jest',
        installCommand: 'npm install --save-dev jest ts-jest @types/jest',
        description: 'Jest with TypeScript support via ts-jest.'
      };
    case 'React':
      return {
        framework: 'React Testing Library',
        installCommand: 'npm install --save-dev @testing-library/react @testing-library/jest-dom',
        description: 'Simple and complete React DOM testing utilities that encourage good testing practices.'
      };
    case 'Python':
      return {
        framework: 'pytest',
        installCommand: 'pip install pytest',
        description: 'pytest is a framework that makes building simple and scalable tests easy.'
      };
    case 'Ruby':
      return {
        framework: 'RSpec',
        installCommand: 'gem install rspec',
        description: 'RSpec is a testing tool for Ruby, created for behavior-driven development (BDD).'
      };
    case 'Java':
      return {
        framework: 'JUnit',
        installCommand: 'Add JUnit 5 to your build tool (Maven/Gradle)',
        description: 'JUnit is a simple framework to write repeatable tests for Java applications.'
      };
    case 'Go':
      return {
        framework: 'Go Testing',
        installCommand: 'Built-in testing package',
        description: 'Go has a built-in testing package that provides tools for writing and running tests.'
      };
    case 'Rust':
      return {
        framework: 'Rust Test',
        installCommand: 'Built-in testing framework',
        description: 'Rust has a built-in testing framework that is simple to use.'
      };
    case 'PHP':
      return {
        framework: 'PHPUnit',
        installCommand: 'composer require --dev phpunit/phpunit',
        description: 'PHPUnit is a programmer-oriented testing framework for PHP.'
      };
    case 'C#':
      return {
        framework: 'xUnit.net',
        installCommand: 'Install-Package xunit',
        description: 'xUnit.net is a free, open source, community-focused unit testing tool for the .NET Framework.'
      };
    case 'C++':
      return {
        framework: 'Google Test',
        installCommand: 'Clone and build from GitHub',
        description: 'Google Test is a testing framework for C++ developed by Google.'
      };
    case 'C':
      return {
        framework: 'Unity',
        installCommand: 'Download from GitHub',
        description: 'Unity is a simple unit testing framework for C.'
      };
    case 'Swift':
      return {
        framework: 'XCTest',
        installCommand: 'Built-in testing framework',
        description: 'XCTest is Apple\'s built-in testing framework for Swift and Objective-C.'
      };
    case 'Kotlin':
      return {
        framework: 'JUnit + Kotlin',
        installCommand: 'Add JUnit 5 to your build tool (Maven/Gradle)',
        description: 'JUnit with Kotlin extensions for more idiomatic testing.'
      };
    default:
      return {
        framework: 'Unknown',
        installCommand: 'N/A',
        description: 'No specific testing framework recommendation available for this language.'
      };
  }
}

/**
 * Checks if a testing package is installed for a specific language
 */
export async function checkPackageInstallation(language: string): Promise<boolean> {
  try {
    // This would call a Tauri command to check if the package is installed
    // For now, we'll simulate this with a mock implementation
    const result = await invoke('check_package_installation', {
      language
    }).catch(() => false);
    
    return !!result;
  } catch (error) {
    console.error(`Error checking package installation for ${language}:`, error);
    return false;
  }
}

/**
 * Initializes the test generation agent with an API key
 */
export async function initializeAgent(api_key: string): Promise<boolean> {
  try {
    console.log("Initializing agent with provided API key");
    await invoke("initialize_agent", { apiKey: api_key });
    console.log("Agent initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing agent:", error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
    return false;
  }
} 