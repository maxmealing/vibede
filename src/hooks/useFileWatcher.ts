import { useState, useEffect, useCallback } from 'react';
import { FileChangeEvent, WatcherInfo } from '@/types/fileWatcher';
import { useFileFilters } from './useFileFilters';

interface UseFileWatcherProps {
  initialDirectoryPath?: string;
  onDirectorySelect?: (path: string) => void;
}

interface UseFileWatcherReturn {
  watchPath: string;
  setWatchPath: (path: string) => void;
  isRecursive: boolean;
  setIsRecursive: (recursive: boolean) => void;
  isWatching: boolean;
  currentWatchId: string;
  fileEvents: FileChangeEvent[];
  filteredEvents: FileChangeEvent[];
  activeWatchers: WatcherInfo[];
  error: string;
  isTauriAvailable: boolean;
  isLoading: boolean;
  startWatching: () => Promise<void>;
  stopWatching: (watchId?: string) => Promise<void>;
  clearEvents: () => void;
  addTestEvent: () => void;
  filterHooks: ReturnType<typeof useFileFilters>;
}

/**
 * Custom hook for managing file watching with filtering
 * @param props Configuration options
 * @returns File watcher state and functions
 */
export function useFileWatcher({
  initialDirectoryPath = '',
  onDirectorySelect
}: UseFileWatcherProps = {}): UseFileWatcherReturn {
  // State for file watcher
  const [watchPath, setWatchPath] = useState<string>(initialDirectoryPath);
  const [isRecursive, setIsRecursive] = useState<boolean>(true);
  const [isWatching, setIsWatching] = useState<boolean>(false);
  const [currentWatchId, setCurrentWatchId] = useState<string>('');
  const [fileEvents, setFileEvents] = useState<FileChangeEvent[]>([]);
  const [activeWatchers, setActiveWatchers] = useState<WatcherInfo[]>([]);
  const [error, setError] = useState<string>('');
  const [isTauriAvailable, setIsTauriAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Get filter hooks
  const filterHooks = useFileFilters();
  
  // Filtered events based on current filter configuration
  const filteredEvents = filterHooks.filterEvents ? 
    filterHooks.filterEvents(fileEvents || []) : 
    [];
  
  // Apply default filter settings on mount
  useEffect(() => {
    // Make sure directory filter is enabled to filter out build directories
    if (filterHooks.toggleFilter && !filterHooks.filterConfig?.directories?.enabled) {
      filterHooks.toggleFilter('directories', true);
    }
    
    // Disable other filters by default
    if (filterHooks.toggleFilter) {
      if (filterHooks.filterConfig?.patterns?.enabled) {
        filterHooks.toggleFilter('patterns', false);
      }
      if (filterHooks.filterConfig?.extensions?.enabled) {
        filterHooks.toggleFilter('extensions', false);
      }
      if (filterHooks.filterConfig?.eventTypes?.enabled) {
        filterHooks.toggleFilter('eventTypes', false);
      }
      if (filterHooks.filterConfig?.debounce?.enabled) {
        filterHooks.toggleFilter('debounce', false);
      }
    }
  }, [filterHooks]);
  
  // Update watchPath when initialDirectoryPath prop changes
  useEffect(() => {
    if (initialDirectoryPath) {
      setWatchPath(initialDirectoryPath);
    }
  }, [initialDirectoryPath]);
  
  // Check if Tauri is available
  useEffect(() => {
    const checkTauri = async () => {
      try {
        setIsLoading(true);
        
        // Check if we're in a Tauri environment
        const isTauri = typeof window !== 'undefined' && 
                       (window.__TAURI_IPC__ !== undefined || 
                        window.__TAURI__ !== undefined);
        
        setIsTauriAvailable(isTauri);
        
        if (isTauri) {
          // Fetch active watchers on startup
          await fetchActiveWatchers();
        }
      } catch (err) {
        console.error('Error checking Tauri availability:', err);
        setError('Failed to initialize Tauri integration.');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkTauri();
  }, []);
  
  // Setup event listeners for file changes
  useEffect(() => {
    const setupListeners = async () => {
      if (!isTauriAvailable) return;
      
      try {
        // Import Tauri event listener
        const { listen } = await import('@tauri-apps/api/event');
        
        // Debug listener for all events
        let debugUnlisten: (() => void) | undefined;
        try {
          console.log('Setting up debug listener for all events');
          debugUnlisten = await listen('*', (event: any) => {
            console.log('DEBUG - Received event:', event);
          });
          
          // We'll clean this up along with the main listener
        } catch (debugErr) {
          console.warn('Could not set up debug listener:', debugErr);
        }
        
        // Listen for file change events
        // The Rust backend emits 'file-change' events
        let unlistenFn: (() => void) | undefined;
        
        try {
          console.log('Setting up listener for file-change');
          unlistenFn = await listen('file-change', (event: any) => {
            console.log('Received file-change:', event);
            try {
              const fileEvent: FileChangeEvent = event.payload;
              console.log('Processing file event:', fileEvent);
              setFileEvents(prev => {
                console.log('Current events count:', prev.length);
                return [fileEvent, ...prev];
              });
            } catch (err) {
              console.error('Error processing file-change event:', err);
            }
          });
          console.log('Successfully set up listener for file-change');
        } catch (eventErr) {
          console.error('Failed to listen to file change events:', eventErr);
          setError('Failed to listen to file change events.');
        }
        
        // Cleanup listener on unmount
        return () => {
          if (unlistenFn) unlistenFn();
          if (debugUnlisten) debugUnlisten();
        };
      } catch (err) {
        console.error('Error setting up file change listeners:', err);
        setError('Failed to setup file change listeners.');
      }
    };
    
    setupListeners();
  }, [isTauriAvailable]);
  
  // Fetch active watchers from the backend
  const fetchActiveWatchers = useCallback(async () => {
    if (!isTauriAvailable) return;
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const watchers = await invoke<WatcherInfo[]>('list_active_watchers');
      setActiveWatchers(watchers || []);
    } catch (err) {
      console.error('Error fetching active watchers:', err);
      setError('Failed to fetch active watchers.');
    }
  }, [isTauriAvailable]);
  
  // Start watching a directory
  const startWatching = useCallback(async () => {
    if (!isTauriAvailable || !watchPath) {
      return;
    }
    
    try {
      setError('');
      const { invoke } = await import('@tauri-apps/api/core');
      
      const watchId = await invoke<string>('start_watching_directory', {
        path: watchPath,
        recursive: isRecursive
      });
      
      setCurrentWatchId(watchId);
      setIsWatching(true);
      
      // Refresh the list of active watchers
      await fetchActiveWatchers();
    } catch (err) {
      console.error('Error starting directory watch:', err);
      setError(`Failed to start watching directory: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [isTauriAvailable, watchPath, isRecursive, fetchActiveWatchers]);
  
  // Stop watching a directory
  const stopWatching = useCallback(async (watchId: string = currentWatchId) => {
    if (!isTauriAvailable || !watchId) {
      return;
    }
    
    try {
      setError('');
      const { invoke } = await import('@tauri-apps/api/core');
      
      await invoke('stop_watching_directory', { watchId });
      
      // If we're stopping the current watch, update state
      if (watchId === currentWatchId) {
        setIsWatching(false);
        setCurrentWatchId('');
      }
      
      // Refresh the list of active watchers
      await fetchActiveWatchers();
    } catch (err) {
      console.error('Error stopping directory watch:', err);
      setError(`Failed to stop watching directory: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [isTauriAvailable, currentWatchId, fetchActiveWatchers]);
  
  // Clear the events list
  const clearEvents = useCallback(() => {
    setFileEvents([]);
  }, []);
  
  // Add a test event for debugging
  const addTestEvent = useCallback(() => {
    const testEvent: FileChangeEvent = {
      path: '/test/path/file.txt',
      kind: 'modified',
      watch_id: 'test-watcher-id'
    };
    console.log('Adding test event:', testEvent);
    setFileEvents(prev => [testEvent, ...prev]);
  }, []);
  
  return {
    watchPath,
    setWatchPath,
    isRecursive,
    setIsRecursive,
    isWatching,
    currentWatchId,
    fileEvents,
    filteredEvents,
    activeWatchers,
    error,
    isTauriAvailable,
    isLoading,
    startWatching,
    stopWatching,
    clearEvents,
    addTestEvent,
    filterHooks
  };
} 