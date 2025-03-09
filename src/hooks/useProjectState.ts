import { useState, useEffect, useCallback } from 'react';
import { listDirectories } from '../lib/api/tauri';

export interface ProjectState {
  selectedPath: string | null;
  isLoading: boolean;
  error: string | null;
  baseDirectory: string | null;
}

export function useProjectState() {
  const [state, setState] = useState<ProjectState>({
    selectedPath: null,
    isLoading: false,
    error: null,
    baseDirectory: null
  });

  // Update state with partial updates
  const updateState = useCallback((updates: Partial<ProjectState> | ((prev: ProjectState) => Partial<ProjectState>)) => {
    setState(prev => {
      if (typeof updates === 'function') {
        return { ...prev, ...updates(prev) };
      }
      return { ...prev, ...updates };
    });
  }, []);

  // Load base directory and selected project on mount
  useEffect(() => {
    try {
      const savedBaseDir = localStorage.getItem('baseRepositoryDirectory');
      if (savedBaseDir) {
        updateState({ baseDirectory: savedBaseDir });
      }

      const savedProject = localStorage.getItem('selectedProject');
      if (savedProject) {
        updateState({ selectedPath: savedProject });
      }
    } catch (error) {
      console.error('Failed to load project data from localStorage:', error);
    }
  }, [updateState]);

  // Listen for changes to the base directory in localStorage
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'baseRepositoryDirectory' && event.newValue) {
        updateState({ baseDirectory: event.newValue });
        // Trigger a scan of the new base directory
        scanBaseDirectory(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [updateState]);

  // Scan the base directory for projects
  const scanBaseDirectory = useCallback(async (directoryToScan?: string) => {
    const directory = directoryToScan || state.baseDirectory;
    if (!directory) return;

    updateState({ isLoading: true, error: null });
    
    try {
      // Call our API wrapper to list directories
      const directories = await listDirectories(directory);
      
      console.log("Found directories:", directories);
      
      // Process the directories into projects
      const projects = directories.map(dir => {
        // Extract the name from the full path
        const name = dir.split('/').pop() || dir.split('\\').pop() || dir;
        
        return {
          name,
          path: dir,
          isFavorite: false,
          lastAccessed: Date.now()
        };
      });
      
      // Save projects to localStorage
      localStorage.setItem('projects', JSON.stringify(projects));
      
      updateState({ isLoading: false });
    } catch (error) {
      console.error("Error scanning base directory:", error);
      updateState({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, [state.baseDirectory, updateState]);

  // Set the base directory
  const setBaseDirectory = useCallback((directory: string) => {
    updateState({ baseDirectory: directory });
    localStorage.setItem('baseRepositoryDirectory', directory);
    // Scan the new base directory immediately
    scanBaseDirectory(directory);
  }, [updateState, scanBaseDirectory]);

  return {
    ...state,
    updateState,
    scanBaseDirectory,
    setBaseDirectory
  };
} 