"use client";
/// <reference types="@tauri-apps/api" />
// Custom reference declarations for Tauri modules
/// <reference path="../types/tauri.d.ts" />

import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import Link from "next/link";
import { AuthButton } from "../components/auth/AuthButton";
import { ManualAuthForm } from "../components/auth/ManualAuthForm";
import { useAuthContext } from "../components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Loader2, AlertCircle, FolderIcon, CheckCircleIcon, XCircleIcon, RefreshCwIcon, CodeIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
// Import sonner for toast notifications
import { Toaster, toast } from "sonner";
import { ProjectSelector } from "../components/ProjectSelector";

// Import our custom hooks
import { useProjectState } from "../hooks/useProjectState";
import { useLanguageState } from "../hooks/useLanguageState";
import { useAnalysisState } from "../hooks/useAnalysisState";
import { useTestGenerationState } from "../hooks/useTestGenerationState";

// Import our Tauri API wrapper
import { selectDirectory } from "../lib/api/tauri";
import { invoke } from "@tauri-apps/api/core";

// Replace Progress component with a div
const Progress: React.FC<{ value: number }> = ({ value }) => (
  <div className="bg-primary/20 relative h-2 w-full overflow-hidden rounded-full">
    <div 
      className="bg-primary h-full w-full flex-1 transition-all" 
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
);

// Replace Checkbox component with a div
interface CheckboxProps {
  id: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

const Checkbox: React.FC<CheckboxProps> = ({ 
  id, 
  checked, 
  onCheckedChange, 
  disabled 
}) => (
  <div 
    className={`h-4 w-4 rounded-sm border ${checked ? 'bg-primary border-primary' : 'border-primary'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    onClick={() => !disabled && onCheckedChange && onCheckedChange(!checked)}
  >
    {checked && (
      <div className="flex items-center justify-center text-primary-foreground">
        <CheckCircleIcon className="h-3 w-3" />
      </div>
    )}
  </div>
);

// Replace ScrollArea component with a div
interface ScrollAreaProps {
  className?: string;
  children: React.ReactNode;
}

const ScrollArea: React.FC<ScrollAreaProps> = ({ className, children }) => (
  <div className={`overflow-auto ${className || ''}`}>
    {children}
  </div>
);

export default function HomePage() {
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const { isLoading } = useAuthContext();
  
  // Initialize our custom hooks
  const projectState = useProjectState();
  const analysisState = useAnalysisState(projectState.selectedPath);
  const languageState = useLanguageState(projectState.selectedPath, analysisState.filesByType);
  const testGenerationState = useTestGenerationState(
    projectState.selectedPath,
    analysisState.updateFileTestStatus,
    analysisState.setFileGenerationStatus
  );
  
  // Initialize the agent from localStorage when the page loads
  useEffect(() => {
    const initAgent = async () => {
      try {
        // First check if the agent is already initialized
        const isInitialized = await invoke("is_agent_initialized") as boolean;
        if (isInitialized) {
          console.log("Agent is already initialized");
          return;
        }
        
        // If not initialized, try to initialize with the saved API key
        const savedApiKey = localStorage.getItem("anthropic_api_key");
        if (savedApiKey) {
          console.log("Initializing agent with saved API key");
          
          // Direct invocation with camelCase parameter name
          await invoke("initialize_agent", { 
            apiKey: savedApiKey 
          });
          
          console.log("Agent initialized successfully");
        } else {
          console.log("No API key found in localStorage");
        }
      } catch (error) {
        console.error("Failed to initialize agent:", error);
        // Show specific error details for debugging
        if (error instanceof Error) {
          console.error("Error message:", error.message);
        } else {
          console.error("Unknown error:", error);
        }
      }
    };
    
    initAgent();
  }, []);
  
  // Handle project selection
  const handleProjectSelect = async (projectPath: string) => {
    console.log("Project selected:", projectPath);
    
    // Validate the project path
    if (!projectPath) {
      console.error("Invalid project path");
      toast.error("Invalid project path");
          return;
        }
        
    // Update project state
    projectState.updateState({ selectedPath: projectPath });
    
    // Analyze the project
    console.log("Analyzing project:", projectPath);
    const result = await analysisState.analyzeProject(projectPath);
    
    if (result) {
      toast.success("Successfully loaded project at " + projectPath);
    }
  };
  
  // Handle test generation for selected files
  const handleGenerateTests = async () => {
    if (analysisState.selectedFiles.size === 0) {
      toast.error("Please select files to generate tests for");
      return;
    }
    
    // Check if we have an API key set
    const savedApiKey = localStorage.getItem("anthropic_api_key");
    if (!savedApiKey) {
      // If no API key is set, show an error and redirect to settings
      toast.error("Please set an Anthropic API key in Settings before generating tests");
      setShowApiKeyModal(true);
      return;
    }
    
    // Get the selected files
    const selectedFiles = [];
    for (const category of ['components', 'services', 'utils'] as const) {
      for (const file of analysisState.filesByType[category]) {
        if (analysisState.selectedFiles.has(file.path)) {
          selectedFiles.push(file);
        }
      }
    }
    
    try {
      // Generate tests
      await testGenerationState.generateTests(selectedFiles);
      
      // Check if we have successful test results, regardless of errors
      const successfulTests = Array.from(testGenerationState.results.values())
        .filter(result => result.success);
      
      // If we have successful results, show success message
      if (successfulTests.length > 0) {
        toast.success(`Generated ${successfulTests.length} test${successfulTests.length === 1 ? '' : 's'} successfully`);
      }
      
      // Only show API key error if no tests were generated
      if (testGenerationState.error && 
          testGenerationState.error.includes("API key") &&
          successfulTests.length === 0) {
        setApiKeyError(testGenerationState.error);
        setShowApiKeyModal(true);
        return;
      }
    } catch (error) {
      // If the error is related to API key, show the API key modal
      const errorMessage = String(error);
      if (errorMessage.includes("API key") || errorMessage.includes("not been initialized")) {
        setApiKeyError(errorMessage);
        setShowApiKeyModal(true);
      } else {
        toast.error(`Error generating tests: ${errorMessage}`);
      }
    }
  };
  
  // Calculate stats from filesByType
  const stats = {
    total: analysisState.filesByType.components.length + 
           analysisState.filesByType.services.length + 
           analysisState.filesByType.utils.length,
    withTests: analysisState.filesByType.components.filter(f => f.hasTest).length + 
               analysisState.filesByType.services.filter(f => f.hasTest).length + 
               analysisState.filesByType.utils.filter(f => f.hasTest).length,
    withoutTests: analysisState.filesByType.components.filter(f => !f.hasTest).length + 
                  analysisState.filesByType.services.filter(f => !f.hasTest).length + 
                  analysisState.filesByType.utils.filter(f => !f.hasTest).length
  };
  
  // Convert test generation results to the format expected by TestFileAnalysis
  const testGenerationResults = Array.from(testGenerationState.results.entries()).map(([filePath, result]) => ({
    file: filePath,
    success: result.success,
    testPath: result.testPath,
    error: result.message
  }));
  
  // Render file list for a category (simplified version)
  const renderFileList = (category: 'components' | 'services' | 'utils') => {
    const files = analysisState.filesByType[category];
    
    if (files.length === 0) {
      return (
        <div className="flex items-center justify-center h-20 text-muted-foreground">
          No {category} found
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.path}
            className={`flex items-center justify-between p-2 rounded-md ${
              analysisState.selectedFiles.has(file.path) ? "bg-muted" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id={file.path}
                checked={analysisState.selectedFiles.has(file.path)}
                onCheckedChange={() => analysisState.toggleFileSelection(file.path)}
                disabled={file.hasTest || file.isGenerating}
              />
              <Label
                htmlFor={file.path}
                className={`flex items-center gap-2 ${file.hasTest ? "text-muted-foreground" : ""}`}
              >
                <Loader2 className={`h-4 w-4 ${file.isGenerating ? "animate-spin" : "hidden"}`} />
                <span>{file.name}</span>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              {file.isGenerating ? (
                <Badge variant="outline" className="animate-pulse">
                  Generating...
                </Badge>
              ) : file.hasTest ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                  Tested
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <XCircleIcon className="h-3 w-3 mr-1" />
                  No Test
                </Badge>
              )}
              {file.language && (
                <Badge variant="outline" className="text-xs">
                  {file.language}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    );
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <ProjectSelector
              onProjectSelect={handleProjectSelect}
              initialProject={projectState.selectedPath || undefined}
            />
          </div>
          
          {analysisState.isAnalyzing ? (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle>Analyzing Files</CardTitle>
                <CardDescription>
                  Scanning project for test files
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing directory for test files...</span>
                </div>
              </CardContent>
            </Card>
          ) : projectState.selectedPath && languageState.detectedLanguages.size > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Detected Languages</CardTitle>
                <CardDescription>
                  Languages detected in your project and their testing frameworks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from(languageState.detectedLanguages.entries()).map(([language, info]) => (
                    <div key={language} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{language}</div>
                        <Badge
                          variant="outline"
                          className={`${
                            info.installed
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          } ${
                            languageState.recentlyInstalled.has(language)
                              ? "animate-pulse"
                              : ""
                          }`}
                        >
                          {info.installed ? "Installed" : "Not Installed"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {info.framework}
                      </div>
                      <div className="text-xs bg-muted p-2 rounded-md font-mono">
                        {info.installCommand}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => languageState.detectLanguages()}
                  disabled={languageState.checkStatus === 'checking'}
                >
                  <RefreshCwIcon className={`h-4 w-4 mr-2 ${languageState.checkStatus === 'checking' ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardContent>
            </Card>
          ) : projectState.selectedPath && languageState.checkStatus === 'checking' ? (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle>Languages & Frameworks</CardTitle>
                <CardDescription>
                  Detecting languages in your project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing project languages...</span>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
        
        {analysisState.error && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center text-red-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                <p>{analysisState.error}</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {!analysisState.isAnalyzing && !analysisState.error && projectState.selectedPath && (
          <Card>
            <CardHeader>
              <CardTitle>Project Files</CardTitle>
              <CardDescription>
                Select files to generate tests for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Files Summary</div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{stats.total} Total</Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.withTests} With Tests
                    </Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {stats.withoutTests} Without Tests
                    </Badge>
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="components">
                <TabsList className="mb-4">
                  <TabsTrigger value="components">Components</TabsTrigger>
                  <TabsTrigger value="services">Services</TabsTrigger>
                  <TabsTrigger value="utils">Utilities</TabsTrigger>
                </TabsList>
                <ScrollArea className="h-[400px]">
                  <TabsContent value="components">
                    {renderFileList('components')}
                  </TabsContent>
                  <TabsContent value="services">
                    {renderFileList('services')}
                  </TabsContent>
                  <TabsContent value="utils">
                    {renderFileList('utils')}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
            <CardContent className="pt-0 flex justify-between">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={analysisState.selectAllFilesWithoutTests}
                  disabled={analysisState.isAnalyzing}
                >
                  Select All Without Tests
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={analysisState.clearFileSelection}
                  disabled={analysisState.isAnalyzing || analysisState.selectedFiles.size === 0}
                >
                  Clear Selection
                </Button>
              </div>
              <Button
                onClick={handleGenerateTests}
                disabled={
                  analysisState.isAnalyzing ||
                  analysisState.selectedFiles.size === 0 ||
                  testGenerationState.isGenerating
                }
              >
                {testGenerationState.isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <CodeIcon className="h-4 w-4 mr-2" />
                    Generate Tests
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Test Generation Progress */}
        {testGenerationState.isGenerating && (
          <Card>
            <CardHeader>
              <CardTitle>Test Generation Progress</CardTitle>
              <CardDescription>
                Generating tests for selected files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={testGenerationState.progress} />
                <div className="text-center">
                  {testGenerationState.currentFile ? (
                    <span>
                      Generating test for{" "}
                      <span className="font-medium">
                        {testGenerationState.currentFile.split("/").pop()}
                      </span>
                    </span>
                  ) : (
                    <span>Preparing test generation...</span>
                  )}
                </div>
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <Button
                variant="outline"
                onClick={testGenerationState.cancelGeneration}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Test Generation Results */}
        {!testGenerationState.isGenerating && testGenerationState.results.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Generation Results</CardTitle>
              <CardDescription>
                Results of the test generation process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {testGenerationResults.map((result) => (
                    <div
                      key={result.file}
                      className={`flex items-center justify-between p-2 rounded-md ${
                        result.success ? "bg-green-50" : "bg-red-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{result.file.split("/").pop()}</span>
                      </div>
                      <div>
                        {result.success ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <XCircleIcon className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardContent className="pt-0">
              <Button
                variant="outline"
                onClick={testGenerationState.clearResults}
              >
                Clear Results
              </Button>
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
      
      <Toaster />
    </div>
  );
}