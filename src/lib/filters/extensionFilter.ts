import { ExtensionFilterConfig } from '@/types/fileWatcher';

/**
 * Extracts the file extension from a path
 * @param filePath The file path
 * @returns The file extension (with dot) or empty string if no extension
 */
export function getFileExtension(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';
  const lastDotIndex = fileName.lastIndexOf('.');
  
  // If no dot or dot is the first character (hidden file), return empty string
  if (lastDotIndex <= 0) {
    return '';
  }
  
  return fileName.slice(lastDotIndex).toLowerCase();
}

/**
 * Checks if a file should be included based on its extension
 * @param filePath The file path to check
 * @param config The extension filter configuration
 * @returns True if the file should be kept (extension matches filter criteria)
 */
export function matchesExtensionFilter(
  filePath: string,
  config: ExtensionFilterConfig
): boolean {
  // If filtering is disabled, include all files
  if (!config.enabled) {
    return true;
  }
  
  // If no extensions are specified, include all files
  if (config.watchedExtensions.length === 0) {
    return true;
  }
  
  const extension = getFileExtension(filePath);
  
  // If no extension and we're in include mode, exclude the file
  // If no extension and we're in exclude mode, include the file
  if (!extension) {
    return config.mode === 'exclude';
  }
  
  const extensionMatches = config.watchedExtensions.includes(extension);
  
  // In include mode, keep files with matching extensions
  // In exclude mode, keep files with non-matching extensions
  return config.mode === 'include' ? extensionMatches : !extensionMatches;
}

/**
 * Default watched extensions for common source code files
 */
export const DEFAULT_WATCHED_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.html',
  '.css',
  '.scss',
  '.json',
  '.md',
  '.yaml',
  '.yml'
]; 