"use client";
/// <reference types="@tauri-apps/api" />
// Custom reference declarations for Tauri modules
/// <reference path="../types/tauri.d.ts" />

import { useState, useEffect, useCallback } from "react";
import { Button } from "../components/ui/button";
import Link from "next/link";
import { AuthButton } from "../components/auth/AuthButton";
import { ManualAuthForm } from "../components/auth/ManualAuthForm";
import { useAuthContext } from "../components/auth/AuthProvider";
import { FolderSelector } from "./components/folder-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { initializeAgentFromStorage, detectLanguageFromFile, getTestingRecommendations, checkPackageInstallation } from "../lib/agent-utils";
import React from "react";
import _ from "lodash";

// Define types for file analysis
interface FileAnalysisResult {
  [sourceFile: string]: string | null; // Maps source file to test file (null if no test exists)
}

interface FilesByType {
  components: Array<{ path: string; hasTest: boolean; testPath: string | null }>;
  services: Array<{ path: string; hasTest: boolean; testPath: string | null }>;
  utils: Array<{ path: string; hasTest: boolean; testPath: string | null }>;
}

export default function HomePage() {
  const [selectedDirectory, setSelectedDirectory] = useState<string>("");
  const [showManualAuth, setShowManualAuth] = useState(false);
  const { isLoading } = useAuthContext();
  const [filesByType, setFilesByType] = useState<FilesByType>({
    components: [],
    services: [],
    utils: []
  });
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, withTests: 0, withoutTests: 0 });
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [testGenerationResults, setTestGenerationResults] = useState<Array<{
    file: string;
    success: boolean;
    testPath?: string;
    error?: string;
  }>>([]);
  const [showResults, setShowResults] = useState(false);
  const [detectedLanguages, setDetectedLanguages] = useState<Map<string, {
    framework: string;
    installCommand: string;
    description: string;
    installed?: boolean;
  }>>(new Map());
  const [packageCheckStatus, setPackageCheckStatus] = useState<'idle' | 'checking' | 'complete'>('idle');
  const [isAgentInitialized, setIsAgentInitialized] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [packageWatcherId, setPackageWatcherId] = useState<string | null>(null);
  const [recentlyInstalledPackages, setRecentlyInstalledPackages] = useState<Set<string>>(new Set());

  // Create a ref to track the current watcher ID and cleanup function
  const watcherRef = React.useRef<{
    id: string | null;
    cleanup: (() => void) | null;
    directory: string | null;
  }>({
    id: null,
    cleanup: null,
    directory: null
  });

  // Helper function to determine if a file is related to package management
  const isPackageRelatedFile = (filePath: string): boolean => {
    // More specific matching to avoid false positives
    const packageFilePatterns = [
      // Node.js
      /(?:^|\/|\\)package\.json$/,
      /(?:^|\/|\\)package-lock\.json$/,
      /(?:^|\/|\\)yarn\.lock$/,
      
      // Python
      /(?:^|\/|\\)requirements\.txt$/,
      /(?:^|\/|\\)Pipfile$/,
      /(?:^|\/|\\)Pipfile\.lock$/,
      
      // Rust
      /(?:^|\/|\\)Cargo\.toml$/,
      /(?:^|\/|\\)Cargo\.lock$/,
      
      // Go
      /(?:^|\/|\\)go\.mod$/,
      /(?:^|\/|\\)go\.sum$/,
      
      // Ruby
      /(?:^|\/|\\)Gemfile$/,
      /(?:^|\/|\\)Gemfile\.lock$/,
      
      // C#
      /(?:^|\/|\\)[^\/\\]+\.csproj$/,
      /(?:^|\/|\\)packages\.config$/
    ];
    
    // Test the path against each pattern
    return packageFilePatterns.some(pattern => pattern.test(filePath));
  };
  
  // Function to get the language associated with a package file
  const getLanguageFromPackageFile = (filePath: string): string | null => {
    // Map file patterns to languages
    const packageFileToLanguage = [
      // Node.js (JavaScript/TypeScript)
      { pattern: /(?:^|\/|\\)package\.json$/, language: 'typescript' },
      { pattern: /(?:^|\/|\\)package-lock\.json$/, language: 'typescript' },
      { pattern: /(?:^|\/|\\)yarn\.lock$/, language: 'typescript' },
      
      // Python
      { pattern: /(?:^|\/|\\)requirements\.txt$/, language: 'python' },
      { pattern: /(?:^|\/|\\)Pipfile$/, language: 'python' },
      { pattern: /(?:^|\/|\\)Pipfile\.lock$/, language: 'python' },
      
      // Rust
      { pattern: /(?:^|\/|\\)Cargo\.toml$/, language: 'rust' },
      { pattern: /(?:^|\/|\\)Cargo\.lock$/, language: 'rust' },
      
      // Go
      { pattern: /(?:^|\/|\\)go\.mod$/, language: 'go' },
      { pattern: /(?:^|\/|\\)go\.sum$/, language: 'go' },
      
      // Ruby
      { pattern: /(?:^|\/|\\)Gemfile$/, language: 'ruby' },
      { pattern: /(?:^|\/|\\)Gemfile\.lock$/, language: 'ruby' },
      
      // C#
      { pattern: /(?:^|\/|\\)[^\/\\]+\.csproj$/, language: 'c#' },
      { pattern: /(?:^|\/|\\)packages\.config$/, language: 'c#' }
    ];
    
    // Find the first matching pattern and return the associated language
    for (const { pattern, language } of packageFileToLanguage) {
      if (pattern.test(filePath)) {
        return language;
      }
    }
    
    return null;
  };
  
  // Function to check all packages for detected languages
  const checkAllPackages = useCallback(async () => {
    if (detectedLanguages.size === 0) return;
    
    setPackageCheckStatus('checking');
    
    const updatedLanguages = new Map(detectedLanguages);
    const newlyInstalled = new Set<string>();
    
    for (const [language, info] of updatedLanguages.entries()) {
      try {
        const isInstalled = await checkPackageInstallation(language);
        
        // Check if status changed from not installed to installed
        if (info.installed === false && isInstalled === true) {
          newlyInstalled.add(language);
        }
        
        updatedLanguages.set(language, { ...info, installed: isInstalled });
      } catch (error) {
        console.error(`Error checking packages for ${language}:`, error);
      }
    }
    
    setDetectedLanguages(updatedLanguages);
    
    // Set recently installed packages for animation
    if (newlyInstalled.size > 0) {
      setRecentlyInstalledPackages(newlyInstalled);
      
      // Clear the animation after a few seconds
      setTimeout(() => {
        setRecentlyInstalledPackages(new Set());
      }, 3000);
    }
    
    setPackageCheckStatus('complete');
  }, [detectedLanguages]);

  // Function to check a specific package
  const checkSpecificPackage = useCallback(async (language: string) => {
    if (!language || !detectedLanguages.has(language)) return;
    
    try {
      const info = detectedLanguages.get(language)!;
      const isInstalled = await checkPackageInstallation(language);
      
      // Check if status changed from not installed to installed
      const wasNewlyInstalled = info.installed === false && isInstalled === true;
      
      // Update the language info with the new installation status
      const updatedLanguages = new Map(detectedLanguages);
      updatedLanguages.set(language, { ...info, installed: isInstalled });
      setDetectedLanguages(updatedLanguages);
      
      // If newly installed, add to recently installed set for animation
      if (wasNewlyInstalled) {
        const newlyInstalled = new Set(recentlyInstalledPackages);
        newlyInstalled.add(language);
        setRecentlyInstalledPackages(newlyInstalled);
        
        // Clear the animation after a few seconds
        setTimeout(() => {
          setRecentlyInstalledPackages(prev => {
            const updated = new Set(prev);
            updated.delete(language);
            return updated;
          });
        }, 3000);
      }
      
      return isInstalled;
    } catch (error) {
      console.error(`Error checking package for ${language}:`, error);
      return false;
    }
  }, [detectedLanguages, recentlyInstalledPackages]);

  // Create a stable debounce function that won't change on re-renders
  const stableDebounce = useCallback((fn: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        fn(...args);
        timeoutId = null;
      }, delay);
    };
  }, []);

  // Stable version of the setupPackageWatcher function that doesn't recreate on re-renders
  const setupPackageWatcher = useCallback(async (directory: string) => {
    // Skip if we're already watching this directory
    if (watcherRef.current.directory === directory && watcherRef.current.id) {
      console.log(`Already watching directory: ${directory} with ID: ${watcherRef.current.id}`);
      return watcherRef.current.cleanup;
    }
    
    // Clean up any existing watcher first
    if (watcherRef.current.cleanup) {
      console.log(`Cleaning up previous watcher before setting up new one`);
      watcherRef.current.cleanup();
      watcherRef.current.cleanup = null;
      watcherRef.current.id = null;
    }
    
    console.log(`Setting up new watcher for directory: ${directory}`);
    
    try {
      // Start a new watcher
      const watchId = await invoke<string>('start_watching_directory', {
        path: directory,
        recursive: true
      });
      
      console.log(`New watcher started with ID: ${watchId}`);
      
      // Update the state for UI purposes
      setPackageWatcherId(watchId);
      
      // Update our ref
      watcherRef.current.id = watchId;
      watcherRef.current.directory = directory;
      
      // Set to track recently processed files to avoid duplicate processing
      const recentlyProcessed = new Set<string>();
      
      // Create a handler function that won't change with re-renders
      const debouncedHandler = (filePath: string, language: string) => {
        const key = `${filePath}:${language}`;
        
        // Skip if already processed recently
        if (recentlyProcessed.has(key)) {
          return;
        }
        
        // Mark as processed
        recentlyProcessed.add(key);
        
        // Process the file change
        console.log(`Processing package file change: ${filePath} (${language})`);
        
        // Check if the specific package is installed
        checkSpecificPackage(language);
        
        // Remove from processed set after a delay
        setTimeout(() => {
          recentlyProcessed.delete(key);
        }, 10000); // 10 second cooldown
      };
      
      // Debounce the handler
      const debouncedCheckPackage = _.debounce(debouncedHandler, 2000);
      
      // Set up the event listener
      const unlisten = await listen('file-change', (event: any) => {
        // Skip if this watcher is no longer current
        if (watcherRef.current.id !== watchId) {
          return;
        }
        
        const { payload } = event;
        
        // Only process events from our watcher
        if (payload.watch_id !== watchId) return;
        
        // Only process created or modified events
        if (payload.kind !== 'created' && payload.kind !== 'modified') return;
        
        // Normalize path
        const normalizedPath = payload.path.replace(/\\/g, '/');
        
        // Skip common directories that cause excessive events
        const ignoredPatterns = [
          /node_modules/,
          /\.git/,
          /\.vscode/,
          /\.idea/,
          /\.DS_Store/,
          /\.next/,
          /dist/,
          /build/,
          /target\/debug/,
          /target\/release/,
          /venv/,
          /\.venv/
        ];
        
        if (ignoredPatterns.some(pattern => pattern.test(normalizedPath))) {
          return;
        }
        
        // Check if this is a package file
        if (isPackageRelatedFile(normalizedPath)) {
          const language = getLanguageFromPackageFile(normalizedPath);
          
          if (language && detectedLanguages.has(language)) {
            debouncedCheckPackage(normalizedPath, language);
          }
        }
      });
      
      // Create cleanup function
      const cleanup = () => {
        console.log(`Cleaning up watcher: ${watchId}`);
        
        // Remove the event listener
        unlisten();
        
        // Stop the watcher
        if (watchId) {
          invoke('stop_watching_directory', { watchId })
            .then(() => console.log(`Successfully stopped watcher: ${watchId}`))
            .catch(error => console.warn(`Error stopping watcher during cleanup: ${error}`));
        }
        
        // Clear the ref if it still points to this watcher
        if (watcherRef.current.id === watchId) {
          watcherRef.current.id = null;
          watcherRef.current.cleanup = null;
          watcherRef.current.directory = null;
          
          // Also update the state
          setPackageWatcherId(null);
        }
      };
      
      // Store the cleanup function in our ref
      watcherRef.current.cleanup = cleanup;
      
      // Return the cleanup function
      return cleanup;
    } catch (error) {
      console.error('Error setting up package watcher:', error);
      
      // Clear the ref on error
      watcherRef.current.id = null;
      watcherRef.current.cleanup = null;
      watcherRef.current.directory = null;
      
      // Also update the state
      setPackageWatcherId(null);
      
      return null;
    }
  }, [detectedLanguages, getLanguageFromPackageFile, isPackageRelatedFile, checkSpecificPackage]);

  // Function to process analysis results
  const processAnalysisResult = (result: FileAnalysisResult) => {
    // Process the analysis results
    const filesByType: FilesByType = {
      components: [],
      services: [],
      utils: []
    };
    
    let totalFiles = 0;
    let filesWithTests = 0;
    let filesWithoutTests = 0;
    
    // Detect languages from the files
    const languages = new Map<string, {
      framework: string;
      installCommand: string;
      description: string;
      installed?: boolean;
    }>();
    
    // Process each source file
    for (const [sourceFile, testFile] of Object.entries(result)) {
      totalFiles++;
      
      const hasTest = testFile !== null;
      if (hasTest) {
        filesWithTests++;
      } else {
        filesWithoutTests++;
      }
      
      // Categorize the file
      const fileInfo = {
        path: sourceFile,
        hasTest,
        testPath: testFile
      };
      
      if (sourceFile.includes('/components/') || sourceFile.includes('\\components\\')) {
        filesByType.components.push(fileInfo);
      } else if (sourceFile.includes('/services/') || sourceFile.includes('\\services\\')) {
        filesByType.services.push(fileInfo);
      } else {
        filesByType.utils.push(fileInfo);
      }
      
      // Detect language
      const { language, framework } = detectLanguageFromFile(sourceFile);
      
      if (language && !languages.has(language)) {
        const recommendations = getTestingRecommendations(language);
        languages.set(language, {
          ...recommendations,
          installed: undefined // Will be checked later
        });
      }
    }
    
    // Update state with the processed data
    setFilesByType(filesByType);
    setStats({
      total: totalFiles,
      withTests: filesWithTests,
      withoutTests: filesWithoutTests
    });
    
    // Set detected languages
    if (languages.size > 0) {
      setDetectedLanguages(languages);
      // Check installation status for all detected languages
      checkAllPackages();
    }
  };

  // Load saved directory on component mount - use a stable empty dependency array
  // to ensure this only runs once
  useEffect(() => {
    console.log("Initial mount effect running");
    let isMounted = true;
    let cleanupWatcher: (() => void) | null = null;
    
    const initialize = async () => {
      try {
        // Check if agent is initialized
        const isInitialized = await initializeAgentFromStorage();
        if (!isMounted) return;
        
        setIsAgentInitialized(isInitialized);
        
        if (!isInitialized) {
          setShowApiKeyModal(true);
        }
        
        // Load saved directory if available
        const savedDirectory = localStorage.getItem("selectedDirectory");
        if (!savedDirectory || !isMounted) return;
        
        setSelectedDirectory(savedDirectory);
        
        // Analyze the directory
        setIsAnalyzing(true);
        setAnalysisError(null);
        
        try {
          // Analyze the directory for source files and tests
          const result = await invoke<FileAnalysisResult>("find_test_files", {
            directory: savedDirectory
          });
          
          if (!isMounted) return;
          
          processAnalysisResult(result);
          
          // Set up file watcher for package installation detection
          cleanupWatcher = await setupPackageWatcher(savedDirectory);
        } catch (error) {
          if (!isMounted) return;
          
          console.error("Error analyzing directory:", error);
          setAnalysisError(typeof error === 'string' ? error : 'Failed to analyze directory');
        } finally {
          if (isMounted) {
            setIsAnalyzing(false);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error during initialization:", error);
        }
      }
    };
    
    initialize();
    
    // Clean up function
    return () => {
      console.log("Cleanup from initial mount effect");
      isMounted = false;
      
      if (cleanupWatcher) {
        cleanupWatcher();
      }
    };
  }, []); // Empty dependency array ensures this only runs once

  // Function to handle directory selection - keep this separate from the initial load
  const handleDirectorySelect = async (path: string) => {
    console.log("Directory selected:", path);
    setSelectedDirectory(path);
    setAnalysisError(null);
    setIsAnalyzing(true);
    setFilesByType({ components: [], services: [], utils: [] });
    setStats({ total: 0, withTests: 0, withoutTests: 0 });
    setTestGenerationResults([]);
    setShowResults(false);
    setDetectedLanguages(new Map());
    
    // Save the selected directory to localStorage
    localStorage.setItem("selectedDirectory", path);
    
    try {
      // Call the Tauri command to analyze test files
      const result = await invoke<FileAnalysisResult>("find_test_files", {
        directory: path
      });
      
      processAnalysisResult(result);
      
      // Set up a new watcher for the directory
      await setupPackageWatcher(path);
    } catch (error) {
      console.error("Error analyzing directory:", error);
      setAnalysisError(typeof error === 'string' ? error : 'Failed to analyze directory');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to detect languages in the selected directory
  const detectLanguagesInDirectory = useCallback(async () => {
    if (!selectedDirectory) return;
    
    setPackageCheckStatus('checking');
    const newDetectedLanguages = new Map<string, {
      framework: string;
      installCommand: string;
      description: string;
      installed?: boolean;
    }>();
    
    // Get all files in the directory
    const allFiles = [...filesByType.components, ...filesByType.services, ...filesByType.utils].map(file => file.path);
    
    // Detect languages from file extensions
    for (const file of allFiles) {
      const { language } = detectLanguageFromFile(file);
      
      if (language !== 'Unknown' && !newDetectedLanguages.has(language)) {
        const recommendations = getTestingRecommendations(language);
        newDetectedLanguages.set(language, {
          ...recommendations,
          installed: undefined // Will be checked later
        });
      }
    }
    
    // Update state with detected languages
    setDetectedLanguages(newDetectedLanguages);
    
    // Check if testing packages are installed for each language
    if (newDetectedLanguages.size > 0) {
      for (const [language, info] of newDetectedLanguages.entries()) {
        try {
          const isInstalled = await checkPackageInstallation(language);
          newDetectedLanguages.set(language, {
            ...info,
            installed: isInstalled
          });
        } catch (error) {
          console.error(`Error checking packages for ${language}:`, error);
        }
      }
      
      // Update state with installation status
      setDetectedLanguages(new Map(newDetectedLanguages));
    }
    
    setPackageCheckStatus('complete');
  }, [selectedDirectory, filesByType]);

  // Update detected languages when directory or files change
  useEffect(() => {
    if (selectedDirectory && stats.total > 0) {
      detectLanguagesInDirectory();
    }
  }, [selectedDirectory, stats.total, detectLanguagesInDirectory]);

  // Toggle selection of a file
  const toggleFileSelection = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  // Generate tests for selected files
  const generateTests = async () => {
    console.log("Generating tests for:", Array.from(selectedFiles));
    
    if (selectedFiles.size === 0) return;
    
    // Check if the agent is initialized
    try {
      const initialized = await initializeAgentFromStorage();
      if (!initialized) {
        alert("Please set your Anthropic API key in Settings before generating tests.");
        return;
      }
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      alert("Failed to initialize agent. Please try again.");
      return;
    }
    
    setIsGeneratingTests(true);
    setTestGenerationResults([]);
    setShowResults(false);
    
    // Create a copy of the selected files to avoid issues with state updates
    const filesToProcess = Array.from(selectedFiles);
    
    // Track the results
    const results: { file: string; success: boolean; testPath?: string; error?: string }[] = [];
    
    // Check for language support and provide recommendations
    const languageMap = new Map<string, { framework: string; installCommand: string }>();
    const unsupportedFiles: string[] = [];
    
    // First pass: check languages and collect recommendations
    for (const file of filesToProcess) {
      const { language, framework } = detectLanguageFromFile(file);
      
      if (language === 'Unknown') {
        unsupportedFiles.push(file);
        results.push({
          file,
          success: false,
          error: `Unsupported file type: ${file.split('.').pop()}`
        });
        continue;
      }
      
      if (!languageMap.has(language)) {
        const recommendations = getTestingRecommendations(language);
        languageMap.set(language, {
          framework: recommendations.framework,
          installCommand: recommendations.installCommand
        });
      }
    }
    
    // Show recommendations for testing frameworks
    if (languageMap.size > 0) {
      let recommendationMessage = "Recommended testing frameworks for your files:\n\n";
      
      languageMap.forEach((value, language) => {
        recommendationMessage += `${language}: ${value.framework}\n`;
        recommendationMessage += `Install with: ${value.installCommand}\n\n`;
      });
      
      // Just log recommendations instead of showing a modal to avoid blocking the UI
      console.info(recommendationMessage);
    }
    
    // Show warning for unsupported files
    if (unsupportedFiles.length > 0) {
      const warningMessage = `Warning: ${unsupportedFiles.length} file(s) have unsupported extensions and will be skipped.`;
      console.warn(warningMessage);
      alert(warningMessage);
    }
    
    // Process each supported file
    for (const file of filesToProcess) {
      // Skip files we already identified as unsupported
      if (unsupportedFiles.includes(file)) {
        continue;
      }
      
      try {
        const { language, framework } = detectLanguageFromFile(file);
        
        // Generate and write the test
        const testPath = await invoke('generate_and_write_test', {
          directory: selectedDirectory,
          sourceFile: file,
          language,
          testFramework: framework
        }) as string;
        
        results.push({
          file,
          success: true,
          testPath
        });
        
        console.log(`Generated test for ${file} at ${testPath}`);
      } catch (error) {
        console.error(`Failed to generate test for ${file}:`, error);
        results.push({
          file,
          success: false,
          error: String(error)
        });
      }
    }
    
    // Update the UI with the results
    setTestGenerationResults(results);
    setShowResults(true);
    setIsGeneratingTests(false);
    
    // Refresh the file analysis to show the new test files
    handleDirectorySelect(selectedDirectory);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header with navigation */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Test Generation Tool</h1>
        <div className="flex items-center gap-4">
          <AuthButton />
          {isLoading && (
            <Button 
              variant="outline" 
              onClick={() => setShowManualAuth(!showManualAuth)}
            >
              {showManualAuth ? 'Hide Manual Auth' : 'Manual Auth'}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/file-watcher">File Watcher</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
        </div>
      </div>
      
      {showManualAuth && (
        <div className="mb-6 flex justify-center">
          <ManualAuthForm />
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6">
        <FolderSelector onDirectorySelect={handleDirectorySelect} initialDirectory={selectedDirectory} />
        
        {selectedDirectory && (
          <Card>
            <CardHeader>
              <CardTitle>Detected Languages & Testing Frameworks</CardTitle>
              <CardDescription>
                Languages detected in your project and recommended testing frameworks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                {packageCheckStatus === 'checking' ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing project languages...</span>
                  </div>
                ) : detectedLanguages.size === 0 ? (
                  <div className="text-gray-500">
                    No languages detected. Select a directory with source files.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.from(detectedLanguages.entries()).map(([language, info]) => (
                      <div 
                        key={language} 
                        className={`border rounded-md p-4 ${
                          info.installed === true 
                            ? 'border-green-200 bg-green-50' 
                            : info.installed === false 
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium">{language}</h3>
                          <div className="flex items-center gap-2">
                            {info.installed === true ? (
                              <Badge variant="outline" className={`bg-green-100 text-green-800 border-green-200 ${
                                recentlyInstalledPackages.has(language) ? 'transition-all duration-300 animate-pulse' : ''
                              }`}>
                                <CheckCircle className="mr-1 h-3 w-3" /> Installed
                              </Badge>
                            ) : info.installed === false ? (
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                                <AlertCircle className="mr-1 h-3 w-3" /> Not Installed
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Checking...
                              </Badge>
                            )}
                            <Badge variant="outline">{info.framework}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{info.description}</p>
                        <div className={`p-2 rounded text-sm font-mono ${
                          info.installed === false ? 'bg-amber-100' : 'bg-gray-50'
                        }`}>
                          {info.installCommand}
                        </div>
                        {info.installed === false && (
                          <div className="mt-2 text-sm text-amber-700">
                            Install the testing framework to generate tests for {language} files.
                          </div>
                        )}
                        {info.installed === true && (
                          <div className="mt-2 text-sm text-green-700">
                            Testing framework is installed and ready to use!
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {isAnalyzing && (
          <Card>
            <CardContent className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <p>Analyzing directory for test files...</p>
            </CardContent>
          </Card>
        )}
        
        {analysisError && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center text-red-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                <p>{analysisError}</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {!isAnalyzing && !analysisError && selectedDirectory && (
          <Card>
            <CardHeader>
              <CardTitle>Test File Analysis</CardTitle>
              <CardDescription>
                Files in your project and their test coverage status.
              </CardDescription>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="bg-green-50">
                  {stats.withTests} files with tests
                </Badge>
                <Badge variant="outline" className="bg-yellow-50">
                  {stats.withoutTests} files without tests
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="components">
                <TabsList className="mb-4">
                  <TabsTrigger value="components">Components ({filesByType.components.length})</TabsTrigger>
                  <TabsTrigger value="services">Services ({filesByType.services.length})</TabsTrigger>
                  <TabsTrigger value="utils">Utilities ({filesByType.utils.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="components" className="space-y-4">
                  {filesByType.components.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No component files found</p>
                  ) : (
                    filesByType.components.map((file, i) => (
                      <div key={i} className="flex items-center p-2 border rounded hover:bg-gray-50">
                        <input 
                          type="checkbox" 
                          id={`component-${i}`} 
                          className="mr-3 h-4 w-4" 
                          checked={selectedFiles.has(file.path)}
                          onChange={() => toggleFileSelection(file.path)}
                          disabled={file.hasTest}
                        />
                        <label htmlFor={`component-${i}`} className="flex-1 cursor-pointer">
                          {file.path.split('/').pop() || file.path.split('\\').pop()}
                        </label>
                        {file.hasTest ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Has test</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-yellow-600">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">No test</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>
                
                <TabsContent value="services" className="space-y-4">
                  {filesByType.services.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No service files found</p>
                  ) : (
                    filesByType.services.map((file, i) => (
                      <div key={i} className="flex items-center p-2 border rounded hover:bg-gray-50">
                        <input 
                          type="checkbox" 
                          id={`service-${i}`} 
                          className="mr-3 h-4 w-4" 
                          checked={selectedFiles.has(file.path)}
                          onChange={() => toggleFileSelection(file.path)}
                          disabled={file.hasTest}
                        />
                        <label htmlFor={`service-${i}`} className="flex-1 cursor-pointer">
                          {file.path.split('/').pop() || file.path.split('\\').pop()}
                        </label>
                        {file.hasTest ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Has test</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-yellow-600">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">No test</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>
                
                <TabsContent value="utils" className="space-y-4">
                  {filesByType.utils.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No utility files found</p>
                  ) : (
                    filesByType.utils.map((file, i) => (
                      <div key={i} className="flex items-center p-2 border rounded hover:bg-gray-50">
                        <input 
                          type="checkbox" 
                          id={`util-${i}`} 
                          className="mr-3 h-4 w-4" 
                          checked={selectedFiles.has(file.path)}
                          onChange={() => toggleFileSelection(file.path)}
                          disabled={file.hasTest}
                        />
                        <label htmlFor={`util-${i}`} className="flex-1 cursor-pointer">
                          {file.path.split('/').pop() || file.path.split('\\').pop()}
                        </label>
                        {file.hasTest ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Has test</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-yellow-600">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">No test</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
              
              <div className="mt-6">
                <Button 
                  disabled={selectedFiles.size === 0 || isGeneratingTests} 
                  onClick={generateTests}
                  className="w-full"
                >
                  {isGeneratingTests ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Tests...
                    </>
                  ) : (
                    `Generate Tests for ${selectedFiles.size} Selected ${selectedFiles.size === 1 ? 'File' : 'Files'}`
                  )}
                </Button>
              </div>
              
              {showResults && testGenerationResults.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Test Generation Results</h3>
                  <div className="space-y-2">
                    {testGenerationResults.map((result, index) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                      >
                        <div className="flex items-start">
                          {result.success ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-medium">{result.file}</div>
                            {result.success ? (
                              <div className="text-sm text-green-700">
                                Test created at: {result.testPath}
                              </div>
                            ) : (
                              <div className="text-sm text-red-700">
                                Error: {result.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">API Key Required</h2>
            <p className="mb-4 text-gray-700">
              {apiKeyError || "An Anthropic API key is required to generate tests."}
            </p>
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setShowApiKeyModal(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowApiKeyModal(false);
                  window.location.href = "/settings";
                }}
              >
                Go to Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}