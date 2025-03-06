import { FilterConfig, FilterType, RepoType } from '@/types/fileWatcher';
import { DEFAULT_IGNORED_PATTERNS } from '../filters/patternFilter';
import { DEFAULT_IGNORED_DIRECTORIES } from '../filters/directoryFilter';
import { DEFAULT_ALLOWED_EVENT_TYPES } from '../filters/eventTypeFilter';
import { DEFAULT_WATCHED_EXTENSIONS } from '../filters/extensionFilter';
import { DEFAULT_DEBOUNCE_TIME_MS } from '../filters/debounceFilter';

// Storage keys
const STORAGE_KEY_PREFIX = 'fileWatcher';
const FILTER_CONFIG_KEY = `${STORAGE_KEY_PREFIX}.filterConfig`;

/**
 * Default filter configuration
 */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  patterns: {
    enabled: false,
    ignoredPatterns: DEFAULT_IGNORED_PATTERNS
  },
  directories: {
    enabled: true,
    ignoredDirectories: DEFAULT_IGNORED_DIRECTORIES
  },
  eventTypes: {
    enabled: false,
    allowedTypes: DEFAULT_ALLOWED_EVENT_TYPES
  },
  extensions: {
    enabled: false,
    watchedExtensions: DEFAULT_WATCHED_EXTENSIONS,
    mode: 'include'
  },
  debounce: {
    enabled: false,
    timeWindowMs: DEFAULT_DEBOUNCE_TIME_MS
  }
};

/**
 * Repository type presets for different types of projects
 */
export const REPO_TYPE_PRESETS: Record<RepoType, Partial<FilterConfig>> = {
  javascript: {
    directories: {
      enabled: true,
      ignoredDirectories: ['node_modules', 'dist', 'build', 'coverage', '.cache']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.js', '.jsx', '.json', '.html', '.css', '.scss'],
      mode: 'include'
    }
  },
  typescript: {
    directories: {
      enabled: true,
      ignoredDirectories: ['node_modules', 'dist', 'build', 'coverage', '.cache']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.scss'],
      mode: 'include'
    }
  },
  python: {
    directories: {
      enabled: true,
      ignoredDirectories: ['__pycache__', '.venv', 'venv', 'dist', 'build', '.pytest_cache']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.py', '.ipynb', '.json', '.yml', '.yaml'],
      mode: 'include'
    }
  },
  java: {
    directories: {
      enabled: true,
      ignoredDirectories: ['target', 'build', '.gradle', 'out', 'bin']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.java', '.kt', '.xml', '.properties', '.gradle'],
      mode: 'include'
    }
  },
  csharp: {
    directories: {
      enabled: true,
      ignoredDirectories: ['bin', 'obj', 'packages', '.vs']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.cs', '.csproj', '.sln', '.xaml', '.config', '.json'],
      mode: 'include'
    }
  },
  cpp: {
    directories: {
      enabled: true,
      ignoredDirectories: ['build', 'bin', 'lib', 'obj', '.vs']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.c', '.cpp', '.h', '.hpp', '.cc', '.cxx', '.cmake', '.txt'],
      mode: 'include'
    }
  },
  go: {
    directories: {
      enabled: true,
      ignoredDirectories: ['vendor', 'bin', 'pkg']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.go', '.mod', '.sum', '.proto'],
      mode: 'include'
    }
  },
  rust: {
    directories: {
      enabled: true,
      ignoredDirectories: ['target', 'dist', 'build']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.rs', '.toml', '.lock'],
      mode: 'include'
    }
  },
  php: {
    directories: {
      enabled: true,
      ignoredDirectories: ['vendor', 'node_modules', 'public/build', 'storage']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.php', '.blade.php', '.twig', '.json', '.yml'],
      mode: 'include'
    }
  },
  ruby: {
    directories: {
      enabled: true,
      ignoredDirectories: ['vendor', 'tmp', 'log', 'public/assets']
    },
    extensions: {
      enabled: true,
      watchedExtensions: ['.rb', '.erb', '.rake', '.yml', '.json'],
      mode: 'include'
    }
  },
  generic: DEFAULT_FILTER_CONFIG
};

/**
 * Saves the filter configuration to localStorage
 * @param config The filter configuration to save
 */
export function saveFilterConfig(config: FilterConfig): void {
  try {
    localStorage.setItem(FILTER_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save filter configuration:', error);
  }
}

/**
 * Loads the filter configuration from localStorage
 * @returns The loaded filter configuration or the default if none exists
 */
export function loadFilterConfig(): FilterConfig {
  try {
    const savedConfig = localStorage.getItem(FILTER_CONFIG_KEY);
    if (savedConfig) {
      return JSON.parse(savedConfig) as FilterConfig;
    }
  } catch (error) {
    console.error('Failed to load filter configuration:', error);
  }
  
  return DEFAULT_FILTER_CONFIG;
}

/**
 * Applies a repository type preset to the current filter configuration
 * @param config The current filter configuration
 * @param repoType The repository type preset to apply
 * @returns The updated filter configuration
 */
export function applyRepoTypePreset(config: FilterConfig, repoType: RepoType): FilterConfig {
  const preset = REPO_TYPE_PRESETS[repoType];
  
  // Create a deep copy of the current config
  const newConfig = JSON.parse(JSON.stringify(config)) as FilterConfig;
  
  // Apply the preset
  if (preset.patterns) {
    newConfig.patterns = { ...newConfig.patterns, ...preset.patterns };
  }
  
  if (preset.directories) {
    newConfig.directories = { ...newConfig.directories, ...preset.directories };
  }
  
  if (preset.eventTypes) {
    newConfig.eventTypes = { ...newConfig.eventTypes, ...preset.eventTypes };
  }
  
  if (preset.extensions) {
    newConfig.extensions = { ...newConfig.extensions, ...preset.extensions };
  }
  
  if (preset.debounce) {
    newConfig.debounce = { ...newConfig.debounce, ...preset.debounce };
  }
  
  // Set the active preset
  newConfig.activePreset = repoType;
  
  return newConfig;
}

/**
 * Resets the filter configuration to the default
 * @returns The default filter configuration
 */
export function resetFilterConfig(): FilterConfig {
  return DEFAULT_FILTER_CONFIG;
}

/**
 * Toggles a filter type on or off
 * @param config The current filter configuration
 * @param filterType The filter type to toggle
 * @param enabled Whether the filter should be enabled or disabled
 * @returns The updated filter configuration
 */
export function toggleFilter(
  config: FilterConfig,
  filterType: FilterType,
  enabled: boolean
): FilterConfig {
  const newConfig = { ...config };
  
  switch (filterType) {
    case 'patterns':
      newConfig.patterns = { ...newConfig.patterns, enabled };
      break;
    case 'directories':
      newConfig.directories = { ...newConfig.directories, enabled };
      break;
    case 'eventTypes':
      newConfig.eventTypes = { ...newConfig.eventTypes, enabled };
      break;
    case 'extensions':
      newConfig.extensions = { ...newConfig.extensions, enabled };
      break;
    case 'debounce':
      newConfig.debounce = { ...newConfig.debounce, enabled };
      break;
  }
  
  return newConfig;
} 