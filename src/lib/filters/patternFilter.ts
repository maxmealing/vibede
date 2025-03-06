import { PatternFilterConfig } from '@/types/fileWatcher';

/**
 * Converts a glob pattern to a regular expression
 * @param pattern The glob pattern to convert
 * @returns A RegExp object that matches the pattern
 */
export function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and ?
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${escaped}$`);
}

/**
 * Checks if a file path matches any of the ignored patterns
 * @param filePath The file path to check
 * @param config The pattern filter configuration
 * @returns True if the file should be filtered out (matches an ignored pattern)
 */
export function matchesIgnoredPattern(
  filePath: string,
  config: PatternFilterConfig
): boolean {
  // If filtering is disabled or no patterns, don't filter anything
  if (!config.enabled || config.ignoredPatterns.length === 0) {
    return false;
  }
  
  // Extract the filename from the path
  const fileName = filePath.split('/').pop() || '';
  
  // Check if the filename matches any of the ignored patterns
  return config.ignoredPatterns.some(pattern => {
    const regex = globToRegex(pattern);
    return regex.test(fileName);
  });
}

/**
 * Default ignored patterns for common temporary and system files
 */
export const DEFAULT_IGNORED_PATTERNS = [
  '*.tmp',
  '*.log',
  '.DS_Store',
  'Thumbs.db',
  '*~',
  '*.swp',
  '*.bak',
  '*.cache'
]; 