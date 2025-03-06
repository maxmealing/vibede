// Types for file watcher filtering system

// Pattern-based filtering
export interface PatternFilterConfig {
  enabled: boolean;
  ignoredPatterns: string[];
}

// Directory-based filtering
export interface DirectoryFilterConfig {
  enabled: boolean;
  ignoredDirectories: string[];
}

// Event type filtering
export interface EventTypeFilterConfig {
  enabled: boolean;
  allowedTypes: string[];
}

// Extension-based filtering
export interface ExtensionFilterConfig {
  enabled: boolean;
  watchedExtensions: string[];
  mode: 'include' | 'exclude'; // include = only watch these, exclude = watch all except these
}

// Debounce filtering
export interface DebounceFilterConfig {
  enabled: boolean;
  timeWindowMs: number;
}

// Repository type presets
export type RepoType = 'javascript' | 'typescript' | 'python' | 'java' | 'csharp' | 'cpp' | 'go' | 'rust' | 'php' | 'ruby' | 'generic';

// Combined filter configuration
export interface FilterConfig {
  patterns: PatternFilterConfig;
  directories: DirectoryFilterConfig;
  eventTypes: EventTypeFilterConfig;
  extensions: ExtensionFilterConfig;
  debounce: DebounceFilterConfig;
  activePreset?: RepoType;
}

// Filter type identifiers
export type FilterType = 'patterns' | 'directories' | 'eventTypes' | 'extensions' | 'debounce';

// Event data from file system
export interface FileChangeEvent {
  path: string;
  kind: string;
  watch_id: string;
}

// Information about an active watcher
export interface WatcherInfo {
  id: string;
  path: string;
}

// Recent change tracking for debouncing
export interface RecentChange {
  timestamp: number;
  event: FileChangeEvent;
} 