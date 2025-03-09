import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { FileList } from "../components/FileList";
import { TestGenerationResults } from "../components/TestGenerationResults";
import { cn } from "../lib/utils";

interface FileInfo {
  path: string;
  hasTest: boolean;
  testPath: string | null;
}

interface FilesByType {
  components: FileInfo[];
  services: FileInfo[];
  utils: FileInfo[];
}

interface Stats {
  total: number;
  withTests: number;
  withoutTests: number;
}

interface TestGenerationResult {
  file: string;
  success: boolean;
  testPath?: string;
  error?: string;
}

interface TestFileAnalysisProps {
  filesByType: FilesByType;
  stats: Stats;
  selectedFiles: Set<string>;
  onToggleFileSelection: (filePath: string) => void;
  onGenerateTests: () => void;
  isGeneratingTests: boolean;
  testGenerationResults: TestGenerationResult[];
  showResults: boolean;
}

export function TestFileAnalysis({
  filesByType,
  stats,
  selectedFiles,
  onToggleFileSelection,
  onGenerateTests,
  isGeneratingTests,
  testGenerationResults,
  showResults
}: TestFileAnalysisProps) {
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);

  const toggleCardCollapse = () => {
    setIsCardCollapsed(!isCardCollapsed);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Test File Analysis</CardTitle>
            <CardDescription>
              Files in your project and their test coverage status.
            </CardDescription>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="bg-green-50">
                {stats.withTests} files with tests
              </Badge>
              <Badge variant="outline" className="bg-yellow-50">
                {stats.withoutTests} files without tests
              </Badge>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0" 
            onClick={toggleCardCollapse}
          >
            {isCardCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {!isCardCollapsed && (
        <CardContent>
          <Tabs defaultValue="components">
            <TabsList className="mb-4">
              <TabsTrigger value="components">Components ({filesByType.components.length})</TabsTrigger>
              <TabsTrigger value="services">Services ({filesByType.services.length})</TabsTrigger>
              <TabsTrigger value="utils">Utilities ({filesByType.utils.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="components" className="space-y-4">
              <FileList 
                files={filesByType.components}
                selectedFiles={selectedFiles}
                onToggleFileSelection={onToggleFileSelection}
                fileType="component"
              />
            </TabsContent>
            
            <TabsContent value="services" className="space-y-4">
              <FileList 
                files={filesByType.services}
                selectedFiles={selectedFiles}
                onToggleFileSelection={onToggleFileSelection}
                fileType="service"
              />
            </TabsContent>
            
            <TabsContent value="utils" className="space-y-4">
              <FileList 
                files={filesByType.utils}
                selectedFiles={selectedFiles}
                onToggleFileSelection={onToggleFileSelection}
                fileType="util"
              />
            </TabsContent>
          </Tabs>
          
          <div className="mt-6">
            <Button 
              disabled={selectedFiles.size === 0 || isGeneratingTests} 
              onClick={onGenerateTests}
              className="w-full"
            >
              {isGeneratingTests ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Tests...
                </>
              ) : (
                `Generate Tests for ${selectedFiles.size} Selected ${selectedFiles.size === 1 ? 'File' : 'Files'}`
              )}
            </Button>
          </div>
          
          {showResults && testGenerationResults.length > 0 && (
            <TestGenerationResults results={testGenerationResults} />
          )}
        </CardContent>
      )}
    </Card>
  );
} 