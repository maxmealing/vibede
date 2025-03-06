'use client';

import { FC } from 'react';
import { FilterType, FilterConfig } from '@/types/fileWatcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FilterTogglesProps {
  filterConfig: FilterConfig;
  onToggleFilter: (filterType: FilterType, enabled: boolean) => void;
  onResetFilters: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const filterLabels: Record<FilterType, string> = {
  patterns: 'Ignore Common Temp Files',
  directories: 'Ignore Build Directories',
  eventTypes: 'Filter by Event Type',
  extensions: 'Filter by File Extension',
  debounce: 'Debounce Rapid Changes'
};

const filterDescriptions: Record<FilterType, string> = {
  patterns: 'Hides temporary files like .DS_Store, logs, and backups',
  directories: 'Hides changes in build, dist, and dependency directories',
  eventTypes: 'Only shows specific event types (create, modify, delete)',
  extensions: 'Only shows files with specific extensions',
  debounce: 'Consolidates multiple rapid changes to the same file'
};

export const FilterToggles: FC<FilterTogglesProps> = ({
  filterConfig = {
    patterns: { enabled: false, ignoredPatterns: [] },
    directories: { enabled: false, ignoredDirectories: [] },
    eventTypes: { enabled: false, allowedTypes: [] },
    extensions: { enabled: false, watchedExtensions: [], mode: 'include' },
    debounce: { enabled: false, timeWindowMs: 300 }
  },
  onToggleFilter = () => {},
  onResetFilters = () => {},
  isExpanded = false,
  onToggleExpand = () => {}
}) => {
  return (
    <Card className="mb-4">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Filter Settings</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onToggleExpand}
          className="h-8 px-2"
        >
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="space-y-3">
            {(Object.keys(filterLabels) as FilterType[]).map((filterType, index) => {
              const isEnabled = filterConfig && 
                                filterConfig[filterType] && 
                                filterConfig[filterType].enabled;
              
              return (
                <div key={`filter-${filterType}-${index}`} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{filterLabels[filterType]}</div>
                    <div className="text-xs text-gray-500">{filterDescriptions[filterType]}</div>
                  </div>
                  
                  <div className="relative inline-block w-10 h-5 mr-2">
                    <input
                      type="checkbox"
                      id={`toggle-${filterType}-${index}`}
                      className="sr-only"
                      checked={!!isEnabled}
                      onChange={() => onToggleFilter(filterType, !isEnabled)}
                    />
                    <label
                      htmlFor={`toggle-${filterType}-${index}`}
                      className={`absolute inset-0 rounded-full cursor-pointer transition-colors duration-200 ${
                        isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            
            <div className="pt-2 flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onResetFilters}
              >
                Reset to Defaults
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}; 