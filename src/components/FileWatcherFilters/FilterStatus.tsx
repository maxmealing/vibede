'use client';

import { FC } from 'react';
import { RepoType } from '@/types/fileWatcher';
import { Card, CardContent } from '@/components/ui/card';

interface FilterStatusProps {
  totalEvents: number;
  filteredEvents: number;
  activeFiltersCount: number;
  detectedRepoType?: RepoType;
  onChangeRepoType?: (repoType: RepoType) => void;
}

const repoTypeLabels: Record<RepoType, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C/C++',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  ruby: 'Ruby',
  generic: 'Generic'
};

export const FilterStatus: FC<FilterStatusProps> = ({
  totalEvents = 0,
  filteredEvents = 0,
  activeFiltersCount = 0,
  detectedRepoType,
  onChangeRepoType
}) => {
  const filteredOutCount = totalEvents - filteredEvents;
  
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm">
          <span className="font-medium">
            Showing {filteredEvents} of {totalEvents} events
          </span>
          {filteredOutCount > 0 && (
            <span className="text-gray-500 ml-1">
              ({filteredOutCount} filtered out)
            </span>
          )}
        </div>
        
        <div className="text-sm">
          <span className="text-gray-500 mr-1">Filters:</span>
          <span className={`font-medium ${activeFiltersCount > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
            {activeFiltersCount} active
          </span>
        </div>
      </div>
      
      {detectedRepoType && detectedRepoType !== 'generic' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3 text-sm flex justify-between items-center">
            <div>
              <span className="font-medium text-blue-700">
                {repoTypeLabels[detectedRepoType]} repository detected!
              </span>
              <span className="text-blue-600 ml-1">
                Filters optimized automatically.
              </span>
            </div>
            
            {onChangeRepoType && (
              <select 
                className="text-xs bg-white border border-blue-300 rounded px-2 py-1"
                value={detectedRepoType}
                onChange={(e) => onChangeRepoType(e.target.value as RepoType)}
                aria-label="Change repository type"
              >
                {Object.entries(repoTypeLabels).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 