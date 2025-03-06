"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderIcon, FileIcon, FileTextIcon, ImageIcon, PackageIcon } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

// Type definitions for file information from the backend
interface FileInfo {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
}

// Props for the FileExplorer component
interface FileExplorerProps {
  directoryPath: string | null;
}

export function FileExplorer({ directoryPath }: FileExplorerProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load files whenever the directory path changes
  useEffect(() => {
    const loadFiles = async () => {
      if (!directoryPath) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<FileInfo[]>(
          'list_directory_files',
          { directoryPath }
        );
        
        setFiles(result || []);
      } catch (err) {
        console.error("Failed to load files:", err);
        setError(`Failed to load files: ${err instanceof Error ? err.message : String(err)}`);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFiles();
  }, [directoryPath]);

  // Helper to determine the icon for a file based on its name/type
  const getFileIcon = (file: FileInfo) => {
    if (file.is_directory) return <FolderIcon className="h-4 w-4 text-blue-500" />;
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'txt':
      case 'md':
      case 'json':
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'css':
      case 'html':
        return <FileTextIcon className="h-4 w-4 text-gray-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return <ImageIcon className="h-4 w-4 text-green-500" />;
      case 'zip':
      case 'rar':
      case 'tar':
      case 'gz':
        return <PackageIcon className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!directoryPath) {
    return null; // Don't render anything if no directory is selected
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Files</CardTitle>
        <CardDescription className="truncate">
          Directory: {directoryPath}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center">{error}</div>
        ) : files.length === 0 ? (
          <div className="text-center text-gray-500 p-4">No files found in this directory.</div>
        ) : (
          <Table>
            <TableCaption>List of files in {directoryPath}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.path} className="cursor-pointer hover:bg-gray-50">
                  <TableCell className="p-2">{getFileIcon(file)}</TableCell>
                  <TableCell className="font-medium">{file.name}</TableCell>
                  <TableCell className="text-right">
                    {file.is_directory ? '—' : formatFileSize(file.size)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <div className="text-sm text-gray-500">
          {files.length} items
        </div>
      </CardFooter>
    </Card>
  );
} 