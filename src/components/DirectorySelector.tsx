import React, { useState, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { 
  FolderIcon, 
  AlertCircle, 
  Clock, 
  Star, 
  StarOff
} from "lucide-react";
import { cn } from "../lib/utils";

// Global app error handler
const logError = (message: string, error: any) => {
  console.error(`${message}:`, error);
};

interface DirectoryHistory {
  recent: Array<string>;
  favorites: Array<string>;
}

interface DirectorySelectorProps {
  onDirectorySelect?: (path: string) => void;
  initialDirectory?: string;
}

export function DirectorySelector({ onDirectorySelect, initialDirectory }: DirectorySelectorProps) {
  const [selectedDir, setSelectedDir] = useState<string | null>(initialDirectory || null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [directoryHistory, setDirectoryHistory] = useState<DirectoryHistory>({
    recent: [],
    favorites: []
  });

  // Load directory history from localStorage on component mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('directoryHistory');
      if (savedHistory) {
        setDirectoryHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      logError('Failed to load directory history', error);
    }
  }, []);

  // Update selected directory when initialDirectory prop changes
  useEffect(() => {
    if (initialDirectory) {
      setSelectedDir(initialDirectory);
    }
  }, [initialDirectory]);

  // Save directory history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('directoryHistory', JSON.stringify(directoryHistory));
    } catch (error) {
      logError('Failed to save directory history', error);
    }
  }, [directoryHistory]);

  // Function to update recent directories
  const updateRecentDirectories = (path: string) => {
    setDirectoryHistory(prev => {
      // Remove the path if it already exists in recent
      const filteredRecent = prev.recent.filter(dir => dir !== path);
      
      // Add the path to the beginning of the array
      const newRecent = [path, ...filteredRecent].slice(0, 5); // Keep only the 5 most recent
      
      return {
        ...prev,
        recent: newRecent
      };
    });
  };

  // Function to toggle favorite status
  const toggleFavorite = (path: string) => {
    setDirectoryHistory(prev => {
      if (prev.favorites.includes(path)) {
        // Remove from favorites
        return {
          ...prev,
          favorites: prev.favorites.filter(dir => dir !== path)
        };
      } else {
        // Add to favorites
        return {
          ...prev,
          favorites: [...prev.favorites, path]
        };
      }
    });
  };

  // Function to select a directory from history
  const selectDirectoryFromHistory = (path: string) => {
    setSelectedDir(path);
    if (onDirectorySelect) {
      onDirectorySelect(path);
    }
    updateRecentDirectories(path);
  };

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
        // Update recent directories
        updateRecentDirectories(selected);
      }
    } catch (e) {
      logError("Error selecting directory", e);
      setError(`Failed to open directory selection dialog: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [onDirectorySelect]);

  // Helper function to get directory name from path
  const getDirectoryName = (path: string) => {
    return path.split('/').pop() || path.split('\\').pop() || path;
  };

  return (
    <div className="h-full space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Project Directory</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Select a project directory to analyze
        </p>
      </div>
      
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={selectDirectory}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <FolderIcon className="mr-2 h-4 w-4" />
            {isLoading ? 'Selecting...' : selectedDir ? 'Change Folder' : 'Select Folder'}
          </Button>
          
          {selectedDir && (
            <div className={cn(
              "flex-1 p-3 bg-muted rounded border break-all text-sm",
              "transition-all duration-200 animate-fade-in"
            )}>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium mr-2">Selected:</span> 
                  <span className="font-mono">{selectedDir}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-2"
                  onClick={() => toggleFavorite(selectedDir)}
                  title={directoryHistory.favorites.includes(selectedDir) ? "Remove from favorites" : "Add to favorites"}
                >
                  {directoryHistory.favorites.includes(selectedDir) ? (
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                </Button>
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

        {/* Recent & Favorites Section */}
        {(directoryHistory.recent.length > 0 || directoryHistory.favorites.length > 0) && (
          <div className="mt-2">
            <div className="flex items-center py-1 px-2">
              <span className="font-medium">Recent & Favorites</span>
            </div>
            
            <div className="mt-2 border rounded-md p-3">
              {directoryHistory.recent.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2 flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Recent:
                  </div>
                  <div className="space-y-2">
                    {directoryHistory.recent.map((dir, index) => (
                      <div 
                        key={`recent-${index}`}
                        className="flex items-center justify-between text-sm hover:bg-muted p-2 rounded-md transition-colors"
                      >
                        <button 
                          className="flex-1 text-left truncate hover:underline"
                          onClick={() => selectDirectoryFromHistory(dir)}
                          title={dir}
                        >
                          {getDirectoryName(dir)}
                        </button>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleFavorite(dir)}
                            title={directoryHistory.favorites.includes(dir) ? "Remove from favorites" : "Add to favorites"}
                          >
                            {directoryHistory.favorites.includes(dir) ? (
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            ) : (
                              <Star className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {directoryHistory.favorites.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center">
                    <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" />
                    Favorites:
                  </div>
                  <div className="space-y-2">
                    {directoryHistory.favorites.map((dir, index) => (
                      <div 
                        key={`favorite-${index}`}
                        className="flex items-center justify-between text-sm hover:bg-muted p-2 rounded-md transition-colors"
                      >
                        <button 
                          className="flex-1 text-left truncate hover:underline"
                          onClick={() => selectDirectoryFromHistory(dir)}
                          title={dir}
                        >
                          {getDirectoryName(dir)}
                        </button>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleFavorite(dir)}
                            title="Remove from favorites"
                          >
                            <StarOff className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 