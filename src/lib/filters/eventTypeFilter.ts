import { EventTypeFilterConfig } from '@/types/fileWatcher';

/**
 * Normalizes an event type to a standard format
 * @param eventType The event type to normalize
 * @returns The normalized event type
 */
export function normalizeEventType(eventType: string): string {
  // Convert to lowercase
  const lowerType = eventType.toLowerCase();
  
  // Map common event type variations to standard names
  const typeMap: Record<string, string> = {
    'create': 'created',
    'add': 'created',
    'added': 'created',
    'new': 'created',
    
    'modify': 'modified',
    'change': 'modified',
    'changed': 'modified',
    'update': 'modified',
    'updated': 'modified',
    
    'delete': 'removed',
    'remove': 'removed',
    'deleted': 'removed',
    'unlink': 'removed',
    
    'rename': 'renamed',
    'moved': 'renamed',
    'move': 'renamed',
    
    'access': 'accessed',
    'accessed': 'accessed'
  };
  
  return typeMap[lowerType] || lowerType;
}

/**
 * Checks if an event type is allowed by the filter configuration
 * @param eventType The event type to check
 * @param config The event type filter configuration
 * @returns True if the event should be kept (event type is allowed)
 */
export function isAllowedEventType(
  eventType: string,
  config: EventTypeFilterConfig
): boolean {
  // If filtering is disabled, allow all event types
  if (!config.enabled) {
    return true;
  }
  
  // If no allowed types are specified, allow all event types
  if (config.allowedTypes.length === 0) {
    return true;
  }
  
  const normalizedType = normalizeEventType(eventType);
  
  // Check if the normalized event type is in the allowed types
  return config.allowedTypes.includes(normalizedType);
}

/**
 * Default allowed event types
 */
export const DEFAULT_ALLOWED_EVENT_TYPES = [
  'created',
  'modified',
  'removed'
]; 