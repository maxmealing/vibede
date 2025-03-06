import { FilterConfig, FileChangeEvent, RecentChange } from '@/types/fileWatcher';
import { matchesIgnoredPattern } from './patternFilter';
import { isInIgnoredDirectory } from './directoryFilter';
import { isAllowedEventType } from './eventTypeFilter';
import { matchesExtensionFilter } from './extensionFilter';
import { shouldDebounceEvent } from './debounceFilter';

/**
 * Applies all filters to determine if an event should be shown
 * @param event The file change event to check
 * @param config The filter configuration
 * @param recentChanges Map of recent changes for debouncing
 * @returns True if the event should be shown, false if it should be filtered out
 */
export function applyAllFilters(
  event: FileChangeEvent,
  config: FilterConfig,
  recentChanges: Map<string, RecentChange>
): boolean {
  const { path, kind } = event;
  
  // Apply pattern filter
  if (matchesIgnoredPattern(path, config.patterns)) {
    return false;
  }
  
  // Apply directory filter
  if (isInIgnoredDirectory(path, config.directories)) {
    return false;
  }
  
  // Apply event type filter
  if (!isAllowedEventType(kind, config.eventTypes)) {
    return false;
  }
  
  // Apply extension filter
  if (!matchesExtensionFilter(path, config.extensions)) {
    return false;
  }
  
  // Apply debounce filter
  if (shouldDebounceEvent(event, recentChanges, config.debounce)) {
    return false;
  }
  
  // If it passes all filters, show the event
  return true;
}

/**
 * Filter a list of events using all filters
 * @param events List of events to filter
 * @param config The filter configuration
 * @param recentChanges Map of recent changes for debouncing
 * @returns Filtered list of events
 */
export function filterEvents(
  events: FileChangeEvent[],
  config: FilterConfig,
  recentChanges: Map<string, RecentChange>
): FileChangeEvent[] {
  return events.filter(event => applyAllFilters(event, config, recentChanges));
} 