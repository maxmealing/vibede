import React, { useState, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { FolderIcon, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

// Global app error handler
const logError = (message: string, error: any) => {
  console.error(`${message}:`, error);
};

interface BaseDirectorySettingProps {
  onDirectoryChange?: (path: string) => void;
}

export function BaseDirectorySetting({ onDirectoryChange }: BaseDirectorySettingProps) {
  const [baseDirectory, setBaseDirectory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Load base directory from localStorage on component mount
  useEffect(() => {
    try {
      const savedBaseDir = localStorage.getItem('baseRepositoryDirectory');
      if (savedBaseDir) {
        setBaseDirectory(savedBaseDir);
      }
    } catch (error) {
      logError('Failed to load base directory', error);
    }
  }, []);

  // Function to select base directory
  const selectBaseDirectory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsSaved(false);
    
    try {
      console.log("Opening directory selection dialog");
      
      // Import core module with error handling
      let core;
      try {
        core = await import('@tauri-apps/api/core');
      } catch (e) {
        logError("Failed to import Tauri core module", e);
        throw new Error("Failed to import Tauri core module");
      }
      
      // Use invoke to call a Rust command that opens the directory selection dialog
      const selected = await core.invoke<string | null>('select_directory_dialog').catch(e => {
        logError("Error during directory selection", e);
        throw new Error(`Directory selection failed: ${e.message || String(e)}`);
      });
      
      console.log("Directory selection result:", selected ? selected : "cancelled");
      
      if (selected) {
        setBaseDirectory(selected);
        localStorage.setItem('baseRepositoryDirectory', selected);
        setIsSaved(true);
        
        // Notify parent component if callback is provided
        if (onDirectoryChange) {
          onDirectoryChange(selected);
        }

        // Show saved indicator for 3 seconds
        setTimeout(() => {
          setIsSaved(false);
        }, 3000);
      }
    } catch (e) {
      logError("Error selecting directory", e);
      setError(`Failed to open directory selection dialog: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [onDirectoryChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base Repository Directory</CardTitle>
        <CardDescription>
          Set the directory where all your projects/repositories are stored
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={selectBaseDirectory}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <FolderIcon className="mr-2 h-4 w-4" />
              {isLoading ? 'Selecting...' : baseDirectory ? 'Change Base Directory' : 'Select Base Directory'}
            </Button>
            
            {baseDirectory && (
              <div className="flex-1 p-3 bg-muted rounded border break-all text-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium mr-2">Current:</span> 
                    <span className="font-mono">{baseDirectory}</span>
                  </div>
                  {isSaved && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 text-red-800 rounded border border-red-200 flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            <p>This directory should contain all your project folders. You'll be able to select individual projects from this directory.</p>
            <p className="mt-2">Example: <span className="font-mono">/Users/username/Projects</span> or <span className="font-mono">C:\Users\username\Projects</span></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 