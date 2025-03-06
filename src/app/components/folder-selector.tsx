"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderIcon } from "lucide-react";

// Global app error handler
const logError = (message: string, error: any) => {
  console.error(`${message}:`, error);
};

interface FolderSelectorProps {
  onDirectorySelect?: (path: string) => void;
}

export function FolderSelector({ onDirectorySelect }: FolderSelectorProps = {}) {
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Function to select a directory
  const selectDirectory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
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
        setSelectedDir(selected);
        // Notify parent component if callback is provided
        if (onDirectorySelect) {
          onDirectorySelect(selected);
        }
      }
    } catch (e) {
      logError("Error selecting directory", e);
      setError(`Failed to open directory selection dialog: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [onDirectorySelect]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Directory Selection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <Button 
            onClick={selectDirectory}
            disabled={isLoading}
            className="w-full md:w-auto"
          >
            <FolderIcon className="mr-2 h-4 w-4" />
            {isLoading ? 'Selecting...' : 'Select Folder'}
          </Button>
          
          {selectedDir && (
            <div className="p-3 bg-gray-100 rounded border border-gray-300 break-all">
              <strong>Selected:</strong> {selectedDir}
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-100 text-red-800 rounded border border-red-300">
              {error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 