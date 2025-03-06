import { DebounceFilterConfig, FileChangeEvent, RecentChange } from '@/types/fileWatcher';

/**
 * Creates a key for the debounce map based on the event
 * @param event The file change event
 * @returns A unique key for the event
 */
export function createDebounceKey(event: FileChangeEvent): string {
  return `${event.path}:${event.kind}`;
}

/**
 * Checks if an event should be debounced (filtered out due to recent similar events)
 * @param event The file change event to check
 * @param recentChanges Map of recent changes for debouncing
 * @param config The debounce filter configuration
 * @returns True if the event should be kept (not debounced)
 */
export function shouldDebounceEvent(
  event: FileChangeEvent,
  recentChanges: Map<string, RecentChange>,
  config: DebounceFilterConfig
): boolean {
  // If debouncing is disabled, don't debounce anything
  if (!config.enabled) {
    return false;
  }
  
  const now = Date.now();
  const key = createDebounceKey(event);
  const lastChange = recentChanges.get(key);
  
  // If we've seen this event recently, debounce it
  if (lastChange && (now - lastChange.timestamp) < config.timeWindowMs) {
    return true; // Should be debounced (filtered out)
  }
  
  // Update the recent changes map with this event
  recentChanges.set(key, {
    timestamp: now,
    event
  });
  
  return false; // Should not be debounced (keep the event)
}

/**
 * Cleans up old entries from the recent changes map
 * @param recentChanges Map of recent changes
 * @param maxAgeMs Maximum age of entries to keep
 */
export function cleanupRecentChanges(
  recentChanges: Map<string, RecentChange>,
  maxAgeMs: number
): void {
  const now = Date.now();
  
  for (const [key, { timestamp }] of recentChanges.entries()) {
    if (now - timestamp > maxAgeMs) {
      recentChanges.delete(key);
    }
  }
}

/**
 * Default debounce time window in milliseconds
 */
export const DEFAULT_DEBOUNCE_TIME_MS = 300; 