import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../lib/utils";

interface LanguageInfo {
  framework: string;
  installCommand: string;
  description: string;
  installed?: boolean;
}

interface LanguageDetectionProps {
  detectedLanguages: Map<string, LanguageInfo>;
  packageCheckStatus: 'idle' | 'checking' | 'complete';
  recentlyInstalledPackages: Set<string>;
}

export function LanguageDetection({
  detectedLanguages,
  packageCheckStatus,
  recentlyInstalledPackages
}: LanguageDetectionProps) {
  const [expandedLanguages, setExpandedLanguages] = useState<Set<string>>(new Set());
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);

  const toggleLanguageExpansion = (language: string) => {
    const newExpanded = new Set(expandedLanguages);
    if (newExpanded.has(language)) {
      newExpanded.delete(language);
    } else {
      newExpanded.add(language);
    }
    setExpandedLanguages(newExpanded);
  };

  const toggleCardCollapse = () => {
    setIsCardCollapsed(!isCardCollapsed);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Detected Languages & Testing Frameworks</CardTitle>
            <CardDescription>
              Languages detected in your project and recommended testing frameworks
            </CardDescription>
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
          <div className="flex flex-col space-y-3">
            {packageCheckStatus === 'checking' ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing project languages...</span>
              </div>
            ) : detectedLanguages.size === 0 ? (
              <div className="text-gray-500">
                No languages detected. Select a directory with source files.
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(detectedLanguages.entries()).map(([language, info]) => {
                  const isExpanded = expandedLanguages.has(language);
                  const isInstalled = info.installed === true;
                  
                  return (
                    <div 
                      key={language} 
                      className={cn(
                        "border rounded-md transition-all duration-200",
                        isInstalled 
                          ? "border-green-200 bg-green-50" 
                          : info.installed === false 
                            ? "border-amber-200 bg-amber-50"
                            : "border-gray-200",
                        isExpanded ? "p-4" : "p-2"
                      )}
                    >
                      <div 
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => toggleLanguageExpansion(language)}
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{language}</h3>
                          <Badge variant="outline" className="text-xs">{info.framework}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {info.installed === true ? (
                            <Badge variant="outline" className={cn(
                              "bg-green-100 text-green-800 border-green-200",
                              recentlyInstalledPackages.has(language) ? "transition-all duration-300 animate-pulse" : ""
                            )}>
                              <CheckCircle className="mr-1 h-3 w-3" /> Installed
                            </Badge>
                          ) : info.installed === false ? (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                              <AlertCircle className="mr-1 h-3 w-3" /> Not Installed
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Checking...
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-3 space-y-2 animate-fade-in">
                          <p className="text-sm text-gray-600">{info.description}</p>
                          <div className={cn(
                            "p-2 rounded text-sm font-mono",
                            info.installed === false ? "bg-amber-100" : "bg-gray-50"
                          )}>
                            {info.installCommand}
                          </div>
                          {info.installed === false && (
                            <div className="mt-2 text-sm text-amber-700">
                              Install the testing framework to generate tests for {language} files.
                            </div>
                          )}
                          {info.installed === true && (
                            <div className="mt-2 text-sm text-green-700">
                              Testing framework is installed and ready to use!
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
} 