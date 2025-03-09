/**
 * Tauri API wrapper
 * 
 * This file provides a centralized place for all Tauri API calls.
 * It helps with:
 * 1. Type safety
 * 2. Error handling
 * 3. Consistent API interface
 * 4. Easier mocking for tests
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
// Import dialog plugin
import { open } from '@tauri-apps/plugin-dialog';

/**
 * Opens a file dialog to select a directory
 */
export async function selectDirectory(options?: { title?: string }): Promise<string | null> {
  try {
    // Use the dialog plugin to open a directory selection dialog
    const selected = await open({
      directory: true,
      multiple: false,
      title: options?.title || 'Select Directory'
    });
    
    // Return the selected directory or null if canceled
    return selected && typeof selected === 'string' ? selected : null;
  } catch (error) {
    console.error('Error selecting directory:', error);
    throw new Error(`Failed to select directory: ${error}`);
  }
}

/**
 * Lists directories in a given path
 */
export async function listDirectories(path: string): Promise<string[]> {
  try {
    return await invoke('list_directories', { path });
  } catch (error) {
    console.error('Error listing directories:', error);
    throw new Error(`Failed to list directories: ${error}`);
  }
}

/**
 * Finds test files in a project directory
 */
export async function findTestFiles(directory: string): Promise<any> {
  try {
    return await invoke('find_test_files', { directory });
  } catch (error) {
    console.error('Error finding test files:', error);
    throw new Error(`Failed to find test files: ${error}`);
  }
}

/**
 * Generates a test for a source file
 */
export async function generateTest(projectPath: string, filePath: string, language: string = 'typescript', testFramework?: string): Promise<any> {
  try {
    // Using camelCase parameter names as required by Tauri v2 convention
    return await invoke('generate_and_write_test', { 
      directory: projectPath, 
      sourceFile: filePath,
      language,
      testFramework
    });
  } catch (error) {
    console.error('Error generating test:', error);
    throw new Error(`Failed to generate test: ${error}`);
  }
}

/**
 * Starts watching a directory for file changes
 */
export async function startWatchingDirectory(path: string, recursive: boolean = true): Promise<string> {
  try {
    return await invoke('start_watching_directory', { path, recursive }) as string;
  } catch (error) {
    console.error('Error starting directory watcher:', error);
    throw new Error(`Failed to start directory watcher: ${error}`);
  }
}

/**
 * Stops watching a directory
 */
export async function stopWatchingDirectory(watchId: string): Promise<void> {
  try {
    await invoke('stop_watching_directory', { watchId });
  } catch (error) {
    console.error('Error stopping directory watcher:', error);
    throw new Error(`Failed to stop directory watcher: ${error}`);
  }
}

/**
 * Listens for file change events
 */
export async function listenForFileChanges(callback: (event: any) => void): Promise<() => void> {
  try {
    const unlisten = await listen('file-change', callback);
    return unlisten;
  } catch (error) {
    console.error('Error setting up file change listener:', error);
    throw new Error(`Failed to set up file change listener: ${error}`);
  }
}

/**
 * Checks if a package is installed for a specific language
 */
export async function checkPackageInstallation(language: string): Promise<boolean> {
  try {
    const result = await invoke('check_package_installation', { language });
    return !!result;
  } catch (error) {
    console.error(`Error checking package installation for ${language}:`, error);
    return false;
  }
}

/**
 * Initializes the test generation agent
 */
export async function initializeAgent(api_key: string): Promise<boolean> {
  try {
    // Use camelCase parameter name as expected by Tauri v2
    const result = await invoke('initialize_agent', { apiKey: api_key });
    return !!result;
  } catch (error) {
    console.error(`Error initializing agent:`, error);
    return false;
  }
} 