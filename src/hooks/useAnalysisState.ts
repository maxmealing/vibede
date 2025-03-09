import { useState, useEffect, useCallback } from 'react';
import { findTestFiles } from '../lib/api/tauri';

export interface FileInfo {
  path: string;
  name: string;
  hasTest: boolean;
  testPath?: string;
  language?: string;
  isGenerating?: boolean;
  isSelected?: boolean;
}

export interface FilesByType {
  components: FileInfo[];
  services: FileInfo[];
  utils: FileInfo[];
  tests: FileInfo[];
}

export interface AnalysisState {
  filesByType: FilesByType;
  isAnalyzing: boolean;
  error: string | null;
  selectedFiles: Set<string>;
  lastAnalyzed: string | null;
}

const initialFilesByType: FilesByType = {
  components: [],
  services: [],
  utils: [],
  tests: []
};

export function useAnalysisState(projectPath: string | null) {
  const [state, setState] = useState<AnalysisState>({
    filesByType: initialFilesByType,
    isAnalyzing: false,
    error: null,
    selectedFiles: new Set<string>(),
    lastAnalyzed: null
  });

  // Update state with partial updates
  const updateState = useCallback((updates: Partial<AnalysisState> | ((prev: AnalysisState) => Partial<AnalysisState>)) => {
    setState(prev => {
      if (typeof updates === 'function') {
        return { ...prev, ...updates(prev) };
      }
      return { ...prev, ...updates };
    });
  }, []);

  // Helper function to detect language from file extension
  const detectLanguageFromExtension = (fileName: string): string | undefined => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (!extension) return undefined;
    
    switch (extension) {
      case 'js':
        return 'JavaScript';
      case 'ts':
        return 'TypeScript';
      case 'jsx':
        return 'React';
      case 'tsx':
        return 'React TypeScript';
      case 'py':
        return 'Python';
      case 'go':
        return 'Go';
      case 'java':
        return 'Java';
      case 'cs':
        return 'C#';
      case 'rs':
        return 'Rust';
      case 'rb':
        return 'Ruby';
      case 'php':
        return 'PHP';
      case 'c':
      case 'cpp':
      case 'h':
      case 'hpp':
        return 'C/C++';
      case 'swift':
        return 'Swift';
      default:
        return undefined;
    }
  };
  
  // Helper function to check if a file is a test file
  const isTestFile = (filePath: string): boolean => {
    const fileName = filePath.split('/').pop() || filePath;
    
    return filePath.includes('/test/') || 
           filePath.includes('/tests/') || 
           filePath.includes('/spec/') || 
           filePath.includes('/specs/') || 
           fileName.startsWith('test_') || 
           fileName.endsWith('.test.ts') || 
           fileName.endsWith('.test.js') || 
           fileName.endsWith('.test.tsx') || 
           fileName.endsWith('.test.jsx') || 
           fileName.endsWith('_test.go') || 
           fileName.endsWith('_test.py') || 
           fileName.endsWith('Test.java') || 
           fileName.endsWith('Tests.cs') || 
           fileName.endsWith('.spec.ts') || 
           fileName.endsWith('.spec.js') || 
           fileName.endsWith('_spec.rb');
  };

  // Process the analysis result from the Tauri command
  const processAnalysisResult = useCallback((result: any): FilesByType => {
    console.log("Raw analysis result:", result);
    
    if (!result || typeof result !== 'object') {
      console.error("Invalid analysis result format:", result);
      return initialFilesByType;
    }
    
    // Initialize the file structure
    const filesByType: FilesByType = {
      components: [],
      services: [],
      utils: [],
      tests: []
    };
    
    // Check if the result is the expected structure from Rust (HashMap<String, Option<String>>)
    // If so, we need to categorize the files ourselves
    if (!result.components && !result.services && !result.utils && !result.tests) {
      console.log("Processing flat file map from Rust backend");
      
      // Iterate through all files in the result
      Object.entries(result).forEach(([filePath, testPath]) => {
        // Extract the file name from the path
        const fileName = filePath.split('/').pop() || filePath;
        
        // Create a FileInfo object
        const fileInfo: FileInfo = {
          path: filePath,
          name: fileName,
          hasTest: testPath !== null,
          testPath: testPath as string | undefined,
          language: detectLanguageFromExtension(fileName)
        };
        
        // Categorize the file based on its path or name
        if (filePath.includes('/components/') || filePath.includes('\\components\\') || 
            fileName.includes('Component') || fileName.endsWith('.jsx') || fileName.endsWith('.tsx')) {
          filesByType.components.push(fileInfo);
        } else if (filePath.includes('/services/') || filePath.includes('\\services\\') || 
                  fileName.includes('Service') || fileName.endsWith('Service.ts') || fileName.endsWith('Service.js')) {
          filesByType.services.push(fileInfo);
        } else {
          filesByType.utils.push(fileInfo);
        }
        
        // If this is a test file, add it to the tests category as well
        if (isTestFile(filePath)) {
          filesByType.tests.push({
            ...fileInfo,
            hasTest: true // Test files always have tests (themselves)
          });
        }
      });
      
      return filesByType;
    }
    
    // If the result has the expected structure, process it as before
    // Process components
    if (Array.isArray(result.components)) {
      filesByType.components = result.components.map((file: any) => ({
        path: file.path,
        name: file.name,
        hasTest: !!file.test_path,
        testPath: file.test_path || undefined,
        language: file.language || undefined
      }));
    }
    
    // Process services
    if (Array.isArray(result.services)) {
      filesByType.services = result.services.map((file: any) => ({
        path: file.path,
        name: file.name,
        hasTest: !!file.test_path,
        testPath: file.test_path || undefined,
        language: file.language || undefined
      }));
    }
    
    // Process utils
    if (Array.isArray(result.utils)) {
      filesByType.utils = result.utils.map((file: any) => ({
        path: file.path,
        name: file.name,
        hasTest: !!file.test_path,
        testPath: file.test_path || undefined,
        language: file.language || undefined
      }));
    }
    
    // Process tests
    if (Array.isArray(result.tests)) {
      filesByType.tests = result.tests.map((file: any) => ({
        path: file.path,
        name: file.name,
        hasTest: true,
        language: file.language || undefined
      }));
    }
    
    return filesByType;
  }, []);

  // Analyze project files
  const analyzeProject = useCallback(async (path: string) => {
    if (!path) return;
    
    updateState({ isAnalyzing: true, error: null });
    
    try {
      console.log('Analyzing project files at:', path);
      
      const result = await findTestFiles(path);
      console.log('Analysis result:', result);
      
      // Check if the result has the new structure with source_files
      const filesByType = processAnalysisResult(
        result.source_files ? result.source_files : result
      );
      
      // Log some stats
      if (result.file_count !== undefined && result.test_count !== undefined) {
        console.log(`Found ${result.file_count} files, ${result.test_count} with tests`);
      }
      
      updateState({ 
        filesByType,
        isAnalyzing: false,
        lastAnalyzed: path
      });
      
      return filesByType;
    } catch (error) {
      console.error('Error analyzing project files:', error);
      updateState({ 
        isAnalyzing: false, 
        error: `Failed to analyze project: ${error}` 
      });
      return null;
    }
  }, [updateState, processAnalysisResult]);

  // Analyze project files when project path changes
  useEffect(() => {
    if (projectPath) {
      analyzeProject(projectPath);
    }
  }, [projectPath]);

  // Toggle file selection
  const toggleFileSelection = useCallback((filePath: string) => {
    updateState((prev: AnalysisState) => {
      const newSelectedFiles = new Set(prev.selectedFiles);
      
      if (newSelectedFiles.has(filePath)) {
        newSelectedFiles.delete(filePath);
      } else {
        newSelectedFiles.add(filePath);
      }
      
      return { selectedFiles: newSelectedFiles };
    });
  }, [updateState]);

  // Select all files without tests
  const selectAllFilesWithoutTests = useCallback(() => {
    updateState((prev: AnalysisState) => {
      const newSelectedFiles = new Set<string>();
      
      // Add all files without tests to the selection
      const allFiles = [
        ...prev.filesByType.components,
        ...prev.filesByType.services,
        ...prev.filesByType.utils
      ];
      
      for (const file of allFiles) {
        if (!file.hasTest) {
          newSelectedFiles.add(file.path);
        }
      }
      
      return { selectedFiles: newSelectedFiles };
    });
  }, [updateState]);

  // Clear file selection
  const clearFileSelection = useCallback(() => {
    updateState({ selectedFiles: new Set() });
  }, [updateState]);

  // Update file test status
  const updateFileTestStatus = useCallback((filePath: string, hasTest: boolean, testPath?: string) => {
    updateState((prev: AnalysisState) => {
      const newFilesByType = { ...prev.filesByType };
      
      // Update the file in the appropriate category
      for (const category of ['components', 'services', 'utils'] as const) {
        const index = newFilesByType[category].findIndex(file => file.path === filePath);
        
        if (index !== -1) {
          newFilesByType[category] = [...newFilesByType[category]];
          newFilesByType[category][index] = {
            ...newFilesByType[category][index],
            hasTest,
            testPath: testPath || undefined
          };
          break;
        }
      }
      
      return { filesByType: newFilesByType };
    });
  }, [updateState]);

  // Set file generation status
  const setFileGenerationStatus = useCallback((filePath: string, isGenerating: boolean) => {
    updateState((prev: AnalysisState) => {
      const newFilesByType = { ...prev.filesByType };
      
      // Update the file in the appropriate category
      for (const category of ['components', 'services', 'utils'] as const) {
        const index = newFilesByType[category].findIndex(file => file.path === filePath);
        
        if (index !== -1) {
          newFilesByType[category] = [...newFilesByType[category]];
          newFilesByType[category][index] = {
            ...newFilesByType[category][index],
            isGenerating
          };
          break;
        }
      }
      
      return { filesByType: newFilesByType };
    });
  }, [updateState]);

  return {
    ...state,
    updateState,
    analyzeProject,
    toggleFileSelection,
    selectAllFilesWithoutTests,
    clearFileSelection,
    updateFileTestStatus,
    setFileGenerationStatus
  };
} 