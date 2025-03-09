import React from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface TestGenerationResult {
  file: string;
  success: boolean;
  testPath?: string;
  error?: string;
}

interface TestGenerationResultsProps {
  results: TestGenerationResult[];
}

export function TestGenerationResults({ results }: TestGenerationResultsProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 animate-fade-in">
      <h3 className="text-lg font-medium mb-2">Test Generation Results</h3>
      <div className="space-y-2">
        {results.map((result, index) => (
          <div 
            key={index} 
            className={cn(
              "p-3 rounded border",
              result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            )}
          >
            <div className="flex items-start">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-medium truncate">{result.file}</div>
                {result.success ? (
                  <div className="text-sm text-green-700">
                    Test created at: {result.testPath}
                  </div>
                ) : (
                  <div className="text-sm text-red-700">
                    Error: {result.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 