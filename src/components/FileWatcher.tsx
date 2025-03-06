'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { FilterStatus, FilterToggles } from '@/components/FileWatcherFilters';
import { RepoType, FilterType, FilterConfig } from '@/types/fileWatcher';

// Add type declaration for Tauri window property
declare global {
  interface Window {
    __TAURI_IPC__?: unknown;
    __TAURI__?: {
      invoke: (cmd: string, args?: any) => Promise<any>;
    };
  }
}

interface FileChangeEvent {
  path: string;
  kind: string;
  watch_id: string;
}

interface WatcherInfo {
  id: string;
  path: string;
}

type WatcherTuple = [string, string];

interface FileWatcherProps {
  // Pre-selected directory path
  initialDirectoryPath?: string;
  // Optional callback when a directory is selected
  onDirectorySelect?: (path: string) => void;
}

// Default empty filter hooks object with the correct shape
const emptyFilterHooks = {
  filterConfig: {
    patterns: { enabled: false, ignoredPatterns: [] },
    directories: { enabled: false, ignoredDirectories: [] },
    eventTypes: { enabled: false, allowedTypes: [] },
    extensions: { enabled: false, watchedExtensions: [], mode: 'include' as const },
    debounce: { enabled: false, timeWindowMs: 300 }
  },
  activeFiltersCount: 0,
  updatePatterns: () => {},
  updateDirectories: () => {},
  updateEventTypes: () => {},
  updateExtensions: () => {},
  updateExtensionMode: () => {},
  updateDebounceTime: () => {},
  toggleFilter: (filterType: FilterType, enabled: boolean) => {},
  applyPreset: (repoType: RepoType) => {},
  autoDetectAndApplyPreset: async (directoryPath: string) => null as any,
  resetFilters: () => {},
  shouldShowEvent: () => false,
  filterEvents: () => []
};

export default function FileWatcher({ 
  initialDirectoryPath = '', 
  onDirectorySelect 
}: FileWatcherProps) {
  // Use our custom hook for file watching with filtering
  const {
    watchPath,
    setWatchPath,
    isRecursive,
    setIsRecursive,
    isWatching,
    currentWatchId,
    fileEvents = [],
    filteredEvents = [],
    activeWatchers = [],
    error = '',
    isTauriAvailable = false,
    isLoading = true,
    startWatching = async () => {},
    stopWatching = async () => {},
    clearEvents = () => {},
    addTestEvent = () => {},
    filterHooks = emptyFilterHooks
  } = useFileWatcher({ initialDirectoryPath, onDirectorySelect }) || {};

  // State for filter UI
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);
  const [detectedRepoType, setDetectedRepoType] = useState<RepoType | undefined>(undefined);
  const [showAllEvents, setShowAllEvents] = useState<boolean>(false);
  
  // Events to display (either filtered or all)
  const displayEvents = showAllEvents ? fileEvents : filteredEvents;

  // Count events from the "out" folder
  const outFolderEvents = useMemo(() => {
    return fileEvents.filter(event => {
      const normalizedPath = event.path.replace(/\\/g, '/');
      return normalizedPath.includes('/out/') || normalizedPath.startsWith('out/') || normalizedPath === 'out';
    }).length;
  }, [fileEvents]);

  // Auto-detect repository type when watch path changes
  useEffect(() => {
    const detectRepo = async () => {
      if (watchPath && filterHooks.autoDetectAndApplyPreset) {
        const detected = await filterHooks.autoDetectAndApplyPreset(watchPath);
        if (detected) {
          setDetectedRepoType(detected);
        }
      }
    };
    
    detectRepo();
  }, [watchPath, filterHooks.autoDetectAndApplyPreset]);
  
  // Handle repository type change
  const handleRepoTypeChange = (repoType: RepoType) => {
    if (filterHooks.applyPreset) {
      filterHooks.applyPreset(repoType);
      setDetectedRepoType(repoType);
    }
  };

  // Function to trigger a test event from Tauri
  const triggerTauriTestEvent = async () => {
    if (isTauriAvailable && window.__TAURI__?.invoke) {
      try {
        await window.__TAURI__.invoke('trigger_test_event');
      } catch (err) {
        console.error('Error triggering test event:', err);
      }
    } else {
      console.warn('Tauri is not available to trigger test event');
    }
  };

  if (!isTauriAvailable) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>File Watcher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
            <p>Tauri is not available. This component requires Tauri to function properly.</p>
            <p>Make sure you're running this application in a Tauri environment.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!watchPath) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>File Watcher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
            <p>Please select a directory in the Directory Selection panel to start watching for file changes.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>File Watcher</CardTitle>
        {watchPath && (
          <CardDescription className="truncate">
            Watching: {watchPath}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
            <button 
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={() => {/* No need to set error state as it's managed by the hook */}}
            >
              <span className="sr-only">Dismiss</span>
              <span className="text-xl">&times;</span>
            </button>
          </div>
        )}
        
        {/* Statistics Section */}
        <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <div>
              <span className="font-medium">Total events:</span> {fileEvents?.length || 0}
            </div>
            <div>
              <span className="font-medium">Filtered events:</span> {filteredEvents?.length || 0}
            </div>
            <div>
              <span className="font-medium">Displayed events:</span> {displayEvents?.length || 0}
            </div>
            <div>
              <span className="font-medium">Active filters:</span> {filterHooks?.activeFiltersCount || 0}
            </div>
            <div className="text-red-600">
              <span className="font-medium">Events from "out" folder:</span> {outFolderEvents}
            </div>
          </div>
          
          {fileEvents?.length !== filteredEvents?.length && (
            <div className="mt-2 text-blue-600 text-xs">
              {fileEvents?.length - filteredEvents?.length} events are being filtered out by the current filter settings.
            </div>
          )}
          
          {fileEvents?.length === 0 && (
            <div className="mt-2 text-orange-600 text-xs">
              No events received yet. Try making changes to files in the watched directory.
            </div>
          )}
        </div>
        
        {/* Watcher Controls */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center space-x-2 mb-2">
            <input
              type="checkbox"
              id="recursive-checkbox"
              checked={isRecursive}
              onChange={(e) => setIsRecursive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="recursive-checkbox">
              Watch Recursively (include subdirectories)
            </label>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {!isWatching ? (
              <Button 
                onClick={startWatching}
                disabled={!watchPath || isLoading}
              >
                {isLoading ? 'Loading...' : 'Start Watching'}
              </Button>
            ) : (
              <Button 
                variant="destructive"
                onClick={() => stopWatching(currentWatchId)}
                disabled={isLoading}
              >
                Stop Watching
              </Button>
            )}
            
            <Button 
              variant="outline"
              onClick={clearEvents}
              disabled={isLoading || fileEvents.length === 0}
            >
              Clear Events
            </Button>
            
            <Button 
              variant="outline"
              onClick={addTestEvent}
            >
              Add Test Event
            </Button>
            
            <Button 
              variant="outline"
              onClick={triggerTauriTestEvent}
            >
              Trigger Tauri Event
            </Button>
          </div>
        </div>
        
        {/* File Events Table */}
        <div className="border rounded-md">
          <div className="p-2 bg-blue-50 border-b flex justify-between items-center">
            <div className="font-medium">
              File Events
              {fileEvents.length > 0 && (
                <span className="ml-2 text-sm font-normal text-blue-600">
                  ({fileEvents.length} events)
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open('/settings', '_blank');
              }}
              className="text-xs"
            >
              Filter Settings
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Path</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Watcher ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayEvents && displayEvents.map((event, index) => (
                <TableRow key={`event-${event.watch_id || ''}-${index}`}>
                  <TableCell className="truncate max-w-xs">{event.path || 'Unknown path'}</TableCell>
                  <TableCell>{event.kind || 'Unknown event'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {event.watch_id ? `${event.watch_id.substring(0, 8)}...` : 'Unknown ID'}
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Add a placeholder row if no events */}
              {(!displayEvents || displayEvents.length === 0) && (
                <TableRow key="no-events">
                  <TableCell colSpan={3} className="text-center text-gray-500 py-4">
                    No file events yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
} 