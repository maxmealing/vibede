import { useState, useCallback } from 'react';
import { generateTest } from '../lib/api/tauri';
import { FileInfo } from './useAnalysisState';
import { initializeAgentFromStorage, isAgentInitialized } from '../lib/agent-utils';
import { invoke } from '@tauri-apps/api/core';

export interface TestGenerationResult {
  filePath: string;
  testPath: string;
  success: boolean;
  message?: string;
  content?: string;
}

export interface TestGenerationState {
  isGenerating: boolean;
  generationQueue: string[];
  results: Map<string, TestGenerationResult>;
  currentFile: string | null;
  error: string | null;
  progress: number;
}

export function useTestGenerationState(
  projectPath: string | null,
  updateFileTestStatus: (filePath: string, hasTest: boolean, testPath?: string) => void,
  setFileGenerationStatus: (filePath: string, isGenerating: boolean) => void
) {
  const [state, setState] = useState<TestGenerationState>({
    isGenerating: false,
    generationQueue: [],
    results: new Map(),
    currentFile: null,
    error: null,
    progress: 0
  });

  // Update state with partial updates
  const updateState = useCallback((updates: Partial<TestGenerationState> | ((prev: TestGenerationState) => Partial<TestGenerationState>)) => {
    setState(prev => {
      if (typeof updates === 'function') {
        return { ...prev, ...updates(prev) };
      }
      return { ...prev, ...updates };
    });
  }, []);

  // Generate tests for selected files
  const generateTests = useCallback(async (files: FileInfo[]) => {
    if (!projectPath || files.length === 0) return;
    
    // Ensure the agent is initialized before generating tests
    const isInitialized = await isAgentInitialized();
    if (!isInitialized) {
      const success = await initializeAgentFromStorage();
      if (!success) {
        updateState({
          error: "Agent service has not been initialized with an API key. Please set an API key in the Settings page."
        });
        return;
      }
    }
    
    // Create a queue of file paths
    const filePaths = files.map(file => file.path);
    
    updateState({
      isGenerating: true,
      generationQueue: filePaths,
      currentFile: null,
      error: null,
      progress: 0
    });
    
    // Process files one by one
    await processGenerationQueue(filePaths);
  }, [projectPath, updateState]);

  // Process the generation queue
  const processGenerationQueue = useCallback(async (initialQueue: string[]) => {
    const queue = [...initialQueue];
    const results = new Map<string, TestGenerationResult>();
    let processed = 0;
    let hasSuccessfulTests = false;
    
    while (queue.length > 0) {
      const filePath = queue.shift()!;
      
      // Update current file and progress
      updateState(prev => ({
        currentFile: filePath,
        progress: initialQueue.length > 0 ? (processed / initialQueue.length) * 100 : 0
      }));
      
      // Mark file as generating
      setFileGenerationStatus(filePath, true);
      
      try {
        // Generate test for the file
        const result = await generateTestForFile(filePath);
        
        // Store the result
        results.set(filePath, result);
        
        // Update file test status if successful
        if (result.success) {
          updateFileTestStatus(filePath, true, result.testPath);
          hasSuccessfulTests = true;
        }
      } catch (error) {
        console.error(`Error generating test for ${filePath}:`, error);
        
        // Store error result
        results.set(filePath, {
          filePath,
          testPath: '',
          success: false,
          message: `Error: ${error}`
        });
      } finally {
        // Mark file as no longer generating
        setFileGenerationStatus(filePath, false);
        processed++;
      }
    }
    
    // Update final state - clear error if we had any successful tests
    updateState({
      isGenerating: false,
      generationQueue: [],
      results,
      currentFile: null,
      progress: 100,
      // Clear error state if we had successful tests to avoid misleading error messages
      error: hasSuccessfulTests ? null : state.error
    });
    
    // Reset progress after a delay
    setTimeout(() => {
      updateState({ progress: 0 });
    }, 3000);
    
    return results;
  }, [updateState, setFileGenerationStatus, updateFileTestStatus, state.error]);

  // Generate test for a single file
  const generateTestForFile = useCallback(async (filePath: string): Promise<TestGenerationResult> => {
    try {
      console.log(`Generating test for file: ${filePath}`);
      
      // Check if agent is initialized
      let isInitialized;
      try {
        isInitialized = await invoke("is_agent_initialized") as boolean;
      } catch (error) {
        console.error("Error checking agent initialization:", error);
        isInitialized = false;
      }
      
      // Initialize agent if needed
      if (!isInitialized) {
        const savedApiKey = localStorage.getItem("anthropic_api_key");
        if (savedApiKey) {
          try {
            console.log("Initializing agent with saved API key");
            // Use camelCase parameter names as expected by Tauri v2
            await invoke("initialize_agent", { apiKey: savedApiKey });
          } catch (initError) {
            console.error("Error initializing agent:", initError);
            throw new Error("Failed to initialize agent. Please check your API key in Settings.");
          }
        } else {
          throw new Error("Agent service has not been initialized with an API key. Please set an API key in the Settings page.");
        }
      }
      
      // Determine language based on file extension
      const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
      let language = 'typescript'; // default
      
      // Map file extensions to languages
      if (['js', 'jsx'].includes(fileExtension)) {
        language = 'javascript';
      } else if (['ts', 'tsx'].includes(fileExtension)) {
        language = 'typescript';
      } else if (['py'].includes(fileExtension)) {
        language = 'python';
      } else if (['rs'].includes(fileExtension)) {
        language = 'rust';
      }
      
      console.log(`Detected language for ${filePath}: ${language}`);
      
      // Call our API wrapper to generate the test
      // Use an empty string as a fallback if projectPath is not set
      const result = await generateTest(projectPath || '', filePath, language);
      
      // Process the result
      if (result && typeof result === 'object') {
        const testResult = result as any;
        
        return {
          filePath,
          testPath: testResult.test_path || '',
          success: testResult.success || false,
          message: testResult.message || '',
          content: testResult.content || ''
        };
      }
      
      throw new Error('Invalid result from test generation');
    } catch (error) {
      console.error(`Failed to generate test for ${filePath}:`, error);
      
      // Only set error state for API key issues if we're at the beginning of the process
      // This prevents showing API key errors if some tests were successfully generated
      const errorMessage = (error as Error).message || String(error);
      if ((errorMessage.includes("API key") || errorMessage.includes("not been initialized")) && !state.results.size) {
        updateState({
          error: errorMessage
        });
      }
      
      throw error;
    }
  }, [projectPath, updateState, state.results]);

  // Cancel test generation
  const cancelGeneration = useCallback(() => {
    updateState(prev => {
      // Mark all files in the queue as no longer generating
      for (const filePath of prev.generationQueue) {
        setFileGenerationStatus(filePath, false);
      }
      
      return {
        isGenerating: false,
        generationQueue: [],
        currentFile: null
      };
    });
  }, [updateState, setFileGenerationStatus]);

  // Clear results
  const clearResults = useCallback(() => {
    updateState({ results: new Map() });
  }, [updateState]);

  return {
    ...state,
    updateState,
    generateTests,
    generateTestForFile,
    cancelGeneration,
    clearResults
  };
} 