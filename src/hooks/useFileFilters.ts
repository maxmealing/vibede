import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FilterConfig, 
  FilterType, 
  FileChangeEvent, 
  RecentChange,
  RepoType
} from '@/types/fileWatcher';
import { 
  loadFilterConfig, 
  saveFilterConfig, 
  applyRepoTypePreset, 
  resetFilterConfig,
  toggleFilter as toggleFilterUtil,
  DEFAULT_FILTER_CONFIG
} from '@/lib/storage/filterSettings';
import { applyAllFilters, filterEvents as filterEventsUtil } from '@/lib/filters/combinedFilter';
import { detectRepoTypeAsync } from '@/lib/filters/repoTypeDetector';

/**
 * Custom hook for managing file watcher filters
 * @returns Filter state and functions for managing filters
 */
export function useFileFilters() {
  // State for filter configuration
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  
  // State for tracking recent changes (for debouncing)
  const [recentChanges] = useState<Map<string, RecentChange>>(new Map());
  
  // Load saved filter configuration on mount
  useEffect(() => {
    const savedConfig = loadFilterConfig();
    setFilterConfig(savedConfig);
  }, []);
  
  // Save filter configuration when it changes
  useEffect(() => {
    saveFilterConfig(filterConfig);
  }, [filterConfig]);
  
  // Clean up old entries from the recent changes map periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      if (filterConfig.debounce.enabled) {
        // Keep entries for 10x the debounce window for safety
        const now = Date.now();
        const maxAge = filterConfig.debounce.timeWindowMs * 10;
        
        for (const [key, { timestamp }] of recentChanges.entries()) {
          if (now - timestamp > maxAge) {
            recentChanges.delete(key);
          }
        }
      }
    }, 30000); // Run cleanup every 30 seconds
    
    return () => clearInterval(cleanupInterval);
  }, [filterConfig.debounce, recentChanges]);
  
  /**
   * Updates the pattern filter configuration
   * @param patterns New patterns to use
   */
  const updatePatterns = useCallback((patterns: string[]) => {
    setFilterConfig(prev => ({
      ...prev,
      patterns: {
        ...prev.patterns,
        ignoredPatterns: patterns
      }
    }));
  }, []);
  
  /**
   * Updates the directory filter configuration
   * @param directories New directories to use
   */
  const updateDirectories = useCallback((directories: string[]) => {
    setFilterConfig(prev => ({
      ...prev,
      directories: {
        ...prev.directories,
        ignoredDirectories: directories
      }
    }));
  }, []);
  
  /**
   * Updates the event type filter configuration
   * @param eventTypes New event types to use
   */
  const updateEventTypes = useCallback((eventTypes: string[]) => {
    setFilterConfig(prev => ({
      ...prev,
      eventTypes: {
        ...prev.eventTypes,
        allowedTypes: eventTypes
      }
    }));
  }, []);
  
  /**
   * Updates the extension filter configuration
   * @param extensions New extensions to use
   */
  const updateExtensions = useCallback((extensions: string[]) => {
    setFilterConfig(prev => ({
      ...prev,
      extensions: {
        ...prev.extensions,
        watchedExtensions: extensions
      }
    }));
  }, []);
  
  /**
   * Updates the extension filter mode
   * @param mode New mode to use ('include' or 'exclude')
   */
  const updateExtensionMode = useCallback((mode: 'include' | 'exclude') => {
    setFilterConfig(prev => ({
      ...prev,
      extensions: {
        ...prev.extensions,
        mode
      }
    }));
  }, []);
  
  /**
   * Updates the debounce time window
   * @param timeWindowMs New time window in milliseconds
   */
  const updateDebounceTime = useCallback((timeWindowMs: number) => {
    setFilterConfig(prev => ({
      ...prev,
      debounce: {
        ...prev.debounce,
        timeWindowMs
      }
    }));
  }, []);
  
  /**
   * Toggles a filter on or off
   * @param filterType The filter type to toggle
   * @param enabled Whether the filter should be enabled or disabled
   */
  const toggleFilter = useCallback((filterType: FilterType, enabled: boolean) => {
    setFilterConfig(prev => toggleFilterUtil(prev, filterType, enabled));
  }, []);
  
  /**
   * Applies a repository type preset
   * @param repoType The repository type preset to apply
   */
  const applyPreset = useCallback((repoType: RepoType) => {
    setFilterConfig(prev => applyRepoTypePreset(prev, repoType));
  }, []);
  
  /**
   * Auto-detects and applies the repository type preset
   * @param directoryPath The directory to analyze
   */
  const autoDetectAndApplyPreset = useCallback(async (directoryPath: string) => {
    if (!directoryPath) return null;
    
    try {
      console.log('Attempting to detect repository type for:', directoryPath);
      const detectedType = await detectRepoTypeAsync(directoryPath);
      console.log('Detected repository type:', detectedType);
      
      if (detectedType !== 'generic') {
        applyPreset(detectedType);
        return detectedType;
      }
    } catch (error) {
      console.error('Error auto-detecting repository type:', error);
    }
    
    return null;
  }, [applyPreset]);
  
  /**
   * Resets the filter configuration to default
   */
  const resetFilters = useCallback(() => {
    setFilterConfig(resetFilterConfig());
    recentChanges.clear();
  }, [recentChanges]);
  
  /**
   * Determines if a file change event should be shown based on all filters
   * @param event The file change event to check
   * @returns True if the event should be shown, false if it should be filtered out
   */
  const shouldShowEvent = useCallback((event: FileChangeEvent): boolean => {
    return applyAllFilters(event, filterConfig, recentChanges);
  }, [filterConfig, recentChanges]);
  
  /**
   * Filter a list of events
   * @param events List of events to filter
   * @returns Filtered list of events
   */
  const filterEvents = useCallback((events: FileChangeEvent[]): FileChangeEvent[] => {
    return filterEventsUtil(events, filterConfig, recentChanges);
  }, [filterConfig, recentChanges]);
  
  // Memoize the active filters count for UI display
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterConfig.patterns.enabled) count++;
    if (filterConfig.directories.enabled) count++;
    if (filterConfig.eventTypes.enabled) count++;
    if (filterConfig.extensions.enabled) count++;
    if (filterConfig.debounce.enabled) count++;
    return count;
  }, [filterConfig]);
  
  return {
    // Filter configuration
    filterConfig,
    activeFiltersCount,
    
    // Filter updaters
    updatePatterns,
    updateDirectories,
    updateEventTypes,
    updateExtensions,
    updateExtensionMode,
    updateDebounceTime,
    toggleFilter,
    
    // Preset management
    applyPreset,
    autoDetectAndApplyPreset,
    resetFilters,
    
    // Filter application
    shouldShowEvent,
    filterEvents
  };
} 