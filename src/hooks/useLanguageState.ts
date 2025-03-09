import { useState, useEffect, useCallback } from 'react';
import { detectLanguageFromFile, getTestingRecommendations } from '../lib/agent-utils';
import { checkPackageInstallation, startWatchingDirectory, stopWatchingDirectory, listenForFileChanges } from '../lib/api/tauri';

export interface LanguageInfo {
  framework: string;
  installCommand: string;
  description: string;
  installed?: boolean;
}

export interface LanguageState {
  detectedLanguages: Map<string, LanguageInfo>;
  checkStatus: 'idle' | 'checking' | 'complete';
  recentlyInstalled: Set<string>;
  watcherId: string | null;
}

export function useLanguageState(projectPath: string | null, filesByType: any) {
  const [state, setState] = useState<LanguageState>({
    detectedLanguages: new Map(),
    checkStatus: 'idle',
    recentlyInstalled: new Set(),
    watcherId: null
  });

  // Update state with partial updates
  const updateState = useCallback((updates: Partial<LanguageState> | ((prev: LanguageState) => Partial<LanguageState>)) => {
    setState(prev => {
      if (typeof updates === 'function') {
        return { ...prev, ...updates(prev) };
      }
      return { ...prev, ...updates };
    });
  }, []);

  // Detect languages when project or files change
  useEffect(() => {
    if (projectPath && filesByType) {
      detectLanguages();
    }
  }, [projectPath, filesByType]);

  // Clean up watcher on unmount
  useEffect(() => {
    return () => {
      if (state.watcherId) {
        stopWatchingDirectory(state.watcherId)
          .catch(error => console.error('Error stopping watcher during cleanup:', error));
      }
    };
  }, [state.watcherId]);

  // Detect languages in the project
  const detectLanguages = useCallback(async () => {
    if (!projectPath) return;
    
    updateState({ checkStatus: 'checking' });
    
    const newDetectedLanguages = new Map<string, LanguageInfo>();
    
    // Get all files in the directory
    const allFiles = [
      ...filesByType.components, 
      ...filesByType.services, 
      ...filesByType.utils
    ].map((file: any) => file.path);
    
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
    
    updateState({ detectedLanguages: newDetectedLanguages });
    
    // Check if testing packages are installed for each language
    if (newDetectedLanguages.size > 0) {
      await checkAllPackages(newDetectedLanguages);
    }
    
    // Set up file watcher for the project
    if (projectPath && !state.watcherId) {
      try {
        const watcherId = await startWatchingDirectory(projectPath);
        updateState({ watcherId });
        
        // Listen for file changes
        const unlisten = await listenForFileChanges((event: any) => {
          // Handle file changes here
          console.log('File change detected:', event);
          
          // Check if any packages were installed
          checkAllPackages(state.detectedLanguages);
        });
        
        // Clean up listener when component unmounts
        return () => {
          unlisten();
          if (state.watcherId) {
            stopWatchingDirectory(state.watcherId)
              .catch(error => console.error('Error stopping watcher:', error));
          }
        };
      } catch (error) {
        console.error('Error setting up file watcher:', error);
      }
    }
    
    updateState({ checkStatus: 'complete' });
  }, [projectPath, filesByType, updateState, state.detectedLanguages, state.watcherId]);

  // Check all packages for detected languages
  const checkAllPackages = useCallback(async (languages: Map<string, LanguageInfo>) => {
    if (languages.size === 0) return;
    
    updateState({ checkStatus: 'checking' });
    
    const updatedLanguages = new Map(languages);
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
    
    updateState({ 
      detectedLanguages: updatedLanguages,
      recentlyInstalled: newlyInstalled,
      checkStatus: 'complete'
    });
    
    // Clear the animation after a few seconds
    if (newlyInstalled.size > 0) {
      setTimeout(() => {
        updateState({ recentlyInstalled: new Set() });
      }, 3000);
    }
  }, [updateState]);

  // Check a specific package
  const checkSpecificPackage = useCallback(async (language: string) => {
    if (!language || !state.detectedLanguages.has(language)) return false;
    
    try {
      const info = state.detectedLanguages.get(language)!;
      const isInstalled = await checkPackageInstallation(language);
      
      // Check if status changed from not installed to installed
      const wasNewlyInstalled = info.installed === false && isInstalled === true;
      
      // Update the language info with the new installation status
      const updatedLanguages = new Map(state.detectedLanguages);
      updatedLanguages.set(language, { ...info, installed: isInstalled });
      
      // If newly installed, add to recently installed set for animation
      if (wasNewlyInstalled) {
        const newlyInstalled = new Set(state.recentlyInstalled);
        newlyInstalled.add(language);
        
        updateState({ 
          detectedLanguages: updatedLanguages,
          recentlyInstalled: newlyInstalled
        });
        
        // Clear the animation after a few seconds
        setTimeout(() => {
          updateState((prev: LanguageState) => {
            const updated = new Set(prev.recentlyInstalled);
            updated.delete(language);
            return { recentlyInstalled: updated };
          });
        }, 3000);
      } else {
        updateState({ detectedLanguages: updatedLanguages });
      }
      
      return isInstalled;
    } catch (error) {
      console.error(`Error checking package for ${language}:`, error);
      return false;
    }
  }, [state.detectedLanguages, state.recentlyInstalled, updateState]);

  // Set watcher ID
  const setWatcherId = useCallback((id: string | null) => {
    updateState({ watcherId: id });
  }, [updateState]);

  return {
    ...state,
    updateState,
    detectLanguages,
    checkAllPackages,
    checkSpecificPackage,
    setWatcherId
  };
} 