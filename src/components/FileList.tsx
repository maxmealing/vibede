import React from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface FileInfo {
  path: string;
  hasTest: boolean;
  testPath: string | null;
}

interface FileListProps {
  files: FileInfo[];
  selectedFiles: Set<string>;
  onToggleFileSelection: (filePath: string) => void;
  fileType: string;
}

export function FileList({
  files,
  selectedFiles,
  onToggleFileSelection,
  fileType
}: FileListProps) {
  if (files.length === 0) {
    return (
      <p className="text-center text-gray-500 py-4">No {fileType} files found</p>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file, i) => (
        <div 
          key={i} 
          className="flex items-center p-2 border rounded hover:bg-gray-50 transition-colors"
        >
          <input 
            type="checkbox" 
            id={`${fileType}-${i}`} 
            className="mr-3 h-4 w-4" 
            checked={selectedFiles.has(file.path)}
            onChange={() => onToggleFileSelection(file.path)}
            disabled={file.hasTest}
          />
          <label 
            htmlFor={`${fileType}-${i}`} 
            className={cn(
              "flex-1 cursor-pointer truncate",
              file.hasTest && "text-gray-500"
            )}
          >
            {file.path.split('/').pop() || file.path.split('\\').pop()}
          </label>
          {file.hasTest ? (
            <div className="flex items-center text-green-600 ml-2">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">Has test</span>
            </div>
          ) : (
            <div className="flex items-center text-yellow-600 ml-2">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">No test</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 