"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterToggles } from "@/components/FileWatcherFilters/FilterToggles";
import { FilterStatus } from "@/components/FileWatcherFilters/FilterStatus";
import { useFileFilters } from "@/hooks/useFileFilters";
import { RepoType } from "@/types/fileWatcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { invoke } from "@tauri-apps/api/core";
import { BaseDirectorySetting } from "@/components/BaseDirectorySetting";
import { toast } from "sonner";

export default function SettingsPage() {
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);
  const [detectedRepoType, setDetectedRepoType] = useState<RepoType | undefined>(undefined);
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>("");
  const [isApiKeyInitialized, setIsApiKeyInitialized] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const filterHooks = useFileFilters();

  // Check if agent is already initialized when component mounts
  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const initialized = await invoke("is_agent_initialized") as boolean;
        setIsApiKeyInitialized(initialized);
        
        // If initialized but no key in localStorage, try to save it
        if (initialized) {
          const savedApiKey = localStorage.getItem("anthropic_api_key");
          if (savedApiKey) {
            setAnthropicApiKey(savedApiKey);
          } else {
            // This is a case where the agent is initialized but we don't have the key in storage
            try {
              await invoke("initialize_agent", { apiKey: savedApiKey });
              setIsApiKeyInitialized(true);
            } catch (error) {
              console.error("Failed to reinitialize agent:", error);
            }
          }
        }
      } catch (error) {
        console.error("Failed to check agent initialization:", error);
      }
    };
    
    checkInitialization();
  }, []);
  
  // Save the API key to localStorage and initialize the agent
  const saveAnthropicApiKey = async () => {
    if (!anthropicApiKey.trim()) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Save API key to localStorage
      localStorage.setItem("anthropic_api_key", anthropicApiKey);
      
      // Initialize the agent with the API key
      try {
        await invoke("initialize_agent", { apiKey: anthropicApiKey });
        setIsApiKeyInitialized(true);
        toast.success("API key saved and agent initialized successfully!");
      } catch (error) {
        console.error("Failed to initialize agent:", error);
        toast.error("Failed to initialize agent. Please check your API key.");
      }
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error("Failed to save API key.");
    } finally {
      setIsSaving(false);
    }
  };

  // Load the API key from localStorage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem("anthropic_api_key");
    if (savedApiKey) {
      setAnthropicApiKey(savedApiKey);
      
      // If we have a saved API key but the agent is not initialized, initialize it
      if (!isApiKeyInitialized) {
        const initializeAgent = async () => {
          try {
            await invoke("initialize_agent", { apiKey: savedApiKey });
            setIsApiKeyInitialized(true);
          } catch (error) {
            console.error("Failed to initialize agent with saved API key:", error);
          }
        };
        
        initializeAgent();
      }
    }
  }, [isApiKeyInitialized]);
  
  // Handle base directory change
  const handleBaseDirectoryChange = (path: string) => {
    console.log("Base directory changed in settings:", path);
    // The BaseDirectorySetting component already saves to localStorage
    // This is just for additional actions if needed
  };
  
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/file-watcher">File Watcher</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/agents">AI Agents</Link>
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="filters" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="filters">File Filters</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="directories">Directories</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Watcher Filters</CardTitle>
              <CardDescription>
                Configure which files and events are displayed in the file watcher
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">How Filters Work</h3>
                <p className="text-sm text-blue-700">
                  Filters help you focus on relevant file changes by hiding noise from build directories, 
                  temporary files, and other non-essential changes. Enable the filters you need and click 
                  "Filter Events" on the main page to apply them.
                </p>
                <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
                  <li>Directory filters hide changes in build folders like "node_modules" and "out"</li>
                  <li>Pattern filters hide temporary files like ".DS_Store" and log files</li>
                  <li>Extension filters let you focus on specific file types</li>
                  <li>Event type filters let you focus on specific events (created, modified, deleted)</li>
                  <li>Debounce filters consolidate multiple rapid changes to the same file</li>
                </ul>
              </div>
              
              <FilterStatus 
                totalEvents={0}
                filteredEvents={0}
                activeFiltersCount={filterHooks.activeFiltersCount}
                detectedRepoType={detectedRepoType}
                onChangeRepoType={filterHooks.applyPreset}
              />
              
              <FilterToggles
                filterConfig={filterHooks.filterConfig}
                onToggleFilter={filterHooks.toggleFilter}
                onResetFilters={filterHooks.resetFilters}
                isExpanded={isFilterExpanded}
                onToggleExpand={() => setIsFilterExpanded(!isFilterExpanded)}
              />
              
              <div className="mt-4">
                <Button 
                  variant="default" 
                  onClick={filterHooks.resetFilters}
                  className="mr-2"
                >
                  Reset All Filters
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Repository Type Detection</CardTitle>
              <CardDescription>
                Automatically apply filter presets based on repository type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Available Presets</h3>
                  <div className="space-y-2">
                    {['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'go', 'rust', 'php', 'ruby'].map((type) => (
                      <Button 
                        key={type}
                        variant="outline" 
                        size="sm"
                        className="mr-2 mb-2 capitalize"
                        onClick={() => filterHooks.applyPreset(type as RepoType)}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Current Preset</h3>
                  <div className="p-2 bg-gray-100 rounded">
                    {detectedRepoType ? (
                      <span className="capitalize">{detectedRepoType}</span>
                    ) : (
                      <span className="text-gray-500">No preset selected</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <Switch id="dark-mode" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="compact-view">Compact View</Label>
                  <Switch id="compact-view" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Configure API keys for external services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="anthropic-api-key" className="text-base font-medium">
                      Anthropic API Key
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Required for AI test generation functionality
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="anthropic-api-key"
                        type="password"
                        value={anthropicApiKey}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnthropicApiKey(e.target.value)}
                        placeholder="Enter your Anthropic API key"
                        className="flex-1"
                      />
                      <Button 
                        onClick={saveAnthropicApiKey}
                        disabled={isSaving || !anthropicApiKey.trim()}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                    {saveSuccess && (
                      <p className="text-sm text-green-600 mt-2">
                        API key saved successfully!
                      </p>
                    )}
                    {saveError && (
                      <p className="text-sm text-red-600 mt-2">
                        {saveError}
                      </p>
                    )}
                    {isApiKeyInitialized && (
                      <p className="text-sm text-green-600 mt-2">
                        Test generation is ready to use
                      </p>
                    )}
                  </div>
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">About API Keys</h3>
                    <p className="text-sm text-blue-700">
                      Your API keys are stored locally on your device and are only used to authenticate with the respective services.
                      We never transmit your keys to our servers.
                    </p>
                    <p className="text-sm text-blue-700 mt-2">
                      <a 
                        href="https://console.anthropic.com/settings/keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Get an Anthropic API key
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="directories" className="space-y-4">
          <BaseDirectorySetting onDirectoryChange={handleBaseDirectoryChange} />
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure advanced application settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="debug-mode">Debug Mode</Label>
                  <Switch id="debug-mode" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-update">Automatic Updates</Label>
                  <Switch id="auto-update" defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 