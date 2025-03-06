import { DirectoryFilterConfig } from '@/types/fileWatcher';

/**
 * Normalizes a file path to use forward slashes and no trailing slash
 * @param path The path to normalize
 * @returns The normalized path
 */
export function normalizePath(path: string): string {
  // Replace backslashes with forward slashes
  let normalized = path.replace(/\\/g, '/');
  
  // Remove trailing slash if present
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * Checks if a file path is in or under any of the ignored directories
 * @param filePath The file path to check
 * @param config The directory filter configuration
 * @returns True if the file should be filtered out (is in an ignored directory)
 */
export function isInIgnoredDirectory(
  filePath: string,
  config: DirectoryFilterConfig
): boolean {
  // If filtering is disabled or no directories, don't filter anything
  if (!config.enabled || config.ignoredDirectories.length === 0) {
    return false;
  }
  
  const normalizedPath = normalizePath(filePath);
  
  return config.ignoredDirectories.some(dir => {
    // Check if the path contains the directory
    // We need to check for exact directory matches to avoid partial name matches
    // e.g. "/foo/bar" should match "/foo/bar/baz" but not "/foo/barbell"
    const normalizedDir = normalizePath(dir);
    
    // Check if the path is exactly the directory
    if (normalizedPath === normalizedDir) {
      return true;
    }
    
    // Check if the path is under the directory
    // The +1 is to account for the trailing slash
    if (normalizedPath.startsWith(normalizedDir + '/')) {
      return true;
    }
    
    return false;
  });
}

/**
 * Default ignored directories for common build and dependency directories
 */
export const DEFAULT_IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.cache',
  'tmp',
  'temp'
]; 