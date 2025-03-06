"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterToggles } from "@/components/FileWatcherFilters/FilterToggles";
import { FilterStatus } from "@/components/FileWatcherFilters/FilterStatus";
import { useFileFilters } from "@/hooks/useFileFilters";
import { RepoType } from "@/types/fileWatcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";

export default function SettingsPage() {
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);
  const [detectedRepoType, setDetectedRepoType] = useState<RepoType | undefined>(undefined);
  
  const filterHooks = useFileFilters();
  
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Button variant="outline" asChild>
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
      
      <Tabs defaultValue="filters" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="filters">File Filters</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Watcher Filters</CardTitle>
              <CardDescription>
                Configure which files and events are displayed in the file watcher
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">How Filters Work</h3>
                <p className="text-sm text-blue-700">
                  Filters help you focus on relevant file changes by hiding noise from build directories, 
                  temporary files, and other non-essential changes. Enable the filters you need and click 
                  "Filter Events" on the main page to apply them.
                </p>
                <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
                  <li>Directory filters hide changes in build folders like "node_modules" and "out"</li>
                  <li>Pattern filters hide temporary files like ".DS_Store" and log files</li>
                  <li>Extension filters let you focus on specific file types</li>
                  <li>Event type filters let you focus on specific events (created, modified, deleted)</li>
                  <li>Debounce filters consolidate multiple rapid changes to the same file</li>
                </ul>
              </div>
              
              <FilterStatus 
                totalEvents={0}
                filteredEvents={0}
                activeFiltersCount={filterHooks.activeFiltersCount}
                detectedRepoType={detectedRepoType}
                onChangeRepoType={filterHooks.applyPreset}
              />
              
              <FilterToggles
                filterConfig={filterHooks.filterConfig}
                onToggleFilter={filterHooks.toggleFilter}
                onResetFilters={filterHooks.resetFilters}
                isExpanded={isFilterExpanded}
                onToggleExpand={() => setIsFilterExpanded(!isFilterExpanded)}
              />
              
              <div className="mt-4">
                <Button 
                  variant="default" 
                  onClick={filterHooks.resetFilters}
                  className="mr-2"
                >
                  Reset All Filters
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Repository Type Detection</CardTitle>
              <CardDescription>
                Automatically apply filter presets based on repository type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Available Presets</h3>
                  <div className="space-y-2">
                    {['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'go', 'rust', 'php', 'ruby'].map((type) => (
                      <Button 
                        key={type}
                        variant="outline" 
                        size="sm"
                        className="mr-2 mb-2 capitalize"
                        onClick={() => filterHooks.applyPreset(type as RepoType)}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Current Preset</h3>
                  <div className="p-2 bg-gray-100 rounded">
                    {detectedRepoType ? (
                      <span className="capitalize">{detectedRepoType}</span>
                    ) : (
                      <span className="text-gray-500">No preset selected</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <Switch id="dark-mode" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="compact-view">Compact View</Label>
                  <Switch id="compact-view" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure advanced options for the file watcher
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="debug-mode" className="block">Debug Mode</Label>
                    <p className="text-sm text-gray-500">Show additional debugging information</p>
                  </div>
                  <Switch id="debug-mode" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-refresh" className="block">Auto Refresh</Label>
                    <p className="text-sm text-gray-500">Automatically refresh the file watcher</p>
                  </div>
                  <Switch id="auto-refresh" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 