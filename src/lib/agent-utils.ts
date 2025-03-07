import { invoke } from "@tauri-apps/api/core";
import { Command } from '@tauri-apps/plugin-shell';

/**
 * Initializes the agent with the API key from localStorage if available
 * @returns A promise that resolves to a boolean indicating if the agent was initialized
 */
export async function initializeAgentFromStorage(): Promise<boolean> {
  try {
    // First check if the agent is already initialized
    const isInitialized = await invoke("is_agent_initialized") as boolean;
    if (isInitialized) {
      return true;
    }
    
    // If not initialized, try to initialize with the saved API key
    const savedApiKey = localStorage.getItem("anthropic_api_key");
    if (savedApiKey) {
      await invoke("initialize_agent", { apiKey: savedApiKey });
      return true;
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
 * Determines the programming language based on file extension
 * @param filePath The path of the file
 * @returns The programming language and appropriate test framework
 */
export function detectLanguageFromFile(filePath: string): {
  language: string;
  framework: string | null;
} {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'ts':
    case 'tsx':
      return { language: 'TypeScript', framework: 'Jest' };
    case 'js':
    case 'jsx':
      return { language: 'JavaScript', framework: 'Jest' };
    case 'py':
      return { language: 'Python', framework: 'pytest' };
    case 'go':
      return { language: 'Go', framework: 'testing' };
    case 'java':
      return { language: 'Java', framework: 'JUnit' };
    case 'cs':
      return { language: 'C#', framework: 'NUnit' };
    case 'rb':
      return { language: 'Ruby', framework: 'RSpec' };
    case 'rs':
      return { language: 'Rust', framework: 'cargo test' };
    default:
      return { language: 'Unknown', framework: null };
  }
}

/**
 * Gets the recommended testing framework and installation instructions for a language
 * @param language The programming language
 * @returns Information about the recommended testing framework
 */
export function getTestingRecommendations(language: string): {
  framework: string;
  installCommand: string;
  description: string;
} {
  const normalizedLanguage = language.toLowerCase();
  
  switch (normalizedLanguage) {
    case 'typescript':
    case 'javascript':
      return {
        framework: 'Jest',
        installCommand: 'npm install --save-dev jest @testing-library/react @testing-library/jest-dom',
        description: 'Jest is a delightful JavaScript Testing Framework with a focus on simplicity.'
      };
    case 'python':
      return {
        framework: 'pytest',
        installCommand: 'pip install pytest',
        description: 'pytest is a framework that makes building simple and scalable tests easy.'
      };
    case 'go':
      return {
        framework: 'testing',
        installCommand: 'Go includes a built-in testing package',
        description: 'Go has a built-in testing package that provides tools for writing and running tests.'
      };
    case 'java':
      return {
        framework: 'JUnit',
        installCommand: 'Add JUnit dependency to your Maven or Gradle build file',
        description: 'JUnit is a simple framework to write repeatable tests for Java applications.'
      };
    case 'c#':
    case 'csharp':
      return {
        framework: 'NUnit',
        installCommand: 'dotnet add package NUnit',
        description: 'NUnit is a unit-testing framework for all .NET languages.'
      };
    case 'ruby':
      return {
        framework: 'RSpec',
        installCommand: 'gem install rspec',
        description: 'RSpec is a testing tool for Ruby, created for behavior-driven development.'
      };
    case 'rust':
      return {
        framework: 'cargo test',
        installCommand: 'Built-in with Cargo - no additional installation needed',
        description: 'Rust has a built-in testing framework that can be used with "cargo test" command.'
      };
    default:
      return {
        framework: 'Unknown',
        installCommand: 'Please manually install testing dependencies',
        description: 'No specific testing framework recommendation available for this language.'
      };
  }
}

/**
 * Checks if testing packages are installed for a specific language
 * @param language The programming language to check
 * @returns A promise that resolves to a boolean indicating if the packages are installed
 */
export async function checkPackageInstallation(language: string): Promise<boolean> {
  try {
    const normalizedLanguage = language.toLowerCase();
    
    switch (normalizedLanguage) {
      case 'typescript':
      case 'javascript':
        return await checkJsPackages();
      case 'python':
        return await checkPythonPackages();
      case 'go':
        return await checkGoPackages();
      case 'java':
        return await checkJavaPackages();
      case 'c#':
      case 'csharp':
        return await checkCSharpPackages();
      case 'ruby':
        return await checkRubyPackages();
      case 'rust':
        return await checkRustPackages();
      default:
        return false;
    }
  } catch (error) {
    console.error(`Failed to check package installation for ${language}:`, error);
    return false;
  }
}

/**
 * Checks if Jest is installed for JavaScript/TypeScript projects
 */
async function checkJsPackages(): Promise<boolean> {
  try {
    const command = Command.create('check-jest', ['npx', 'jest', '--version']);
    const output = await command.execute();
    return output.code === 0;
  } catch (error) {
    console.error('Failed to check Jest installation:', error);
    return false;
  }
}

/**
 * Checks if pytest is installed for Python projects
 */
async function checkPythonPackages(): Promise<boolean> {
  try {
    const command = Command.create('check-pytest', ['python', '-m', 'pytest', '--version']);
    const output = await command.execute();
    return output.code === 0;
  } catch (error) {
    console.error('Failed to check pytest installation:', error);
    return false;
  }
}

/**
 * Checks if Go testing is available
 */
async function checkGoPackages(): Promise<boolean> {
  try {
    const command = Command.create('check-go', ['go', 'version']);
    const output = await command.execute();
    return output.code === 0;
  } catch (error) {
    console.error('Failed to check Go installation:', error);
    return false;
  }
}

/**
 * Checks if JUnit is available for Java projects
 */
async function checkJavaPackages(): Promise<boolean> {
  try {
    const command = Command.create('check-java', ['java', '-version']);
    const output = await command.execute();
    return output.code === 0;
  } catch (error) {
    console.error('Failed to check Java installation:', error);
    return false;
  }
}

/**
 * Checks if NUnit is available for C# projects
 */
async function checkCSharpPackages(): Promise<boolean> {
  try {
    const command = Command.create('check-dotnet', ['dotnet', '--version']);
    const output = await command.execute();
    return output.code === 0;
  } catch (error) {
    console.error('Failed to check .NET installation:', error);
    return false;
  }
}

/**
 * Checks if RSpec is installed for Ruby projects
 */
async function checkRubyPackages(): Promise<boolean> {
  try {
    const command = Command.create('check-rspec', ['gem', 'list']);
    const output = await command.execute();
    return output.code === 0 && output.stdout.includes('rspec');
  } catch (error) {
    console.error('Failed to check RSpec installation:', error);
    return false;
  }
}

/**
 * Checks if Rust and Cargo are installed
 */
async function checkRustPackages(): Promise<boolean> {
  try {
    const command = Command.create('check-rust', ['cargo', '--version']);
    const output = await command.execute();
    return output.code === 0;
  } catch (error) {
    console.error('Failed to check Rust installation:', error);
    return false;
  }
} 