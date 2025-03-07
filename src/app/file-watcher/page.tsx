"use client";
/// <reference types="@tauri-apps/api" />
// Custom reference declarations for Tauri modules
/// <reference path="../../types/tauri.d.ts" />

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderSelector } from "../components/folder-selector";
import FileWatcher from "../../components/FileWatcher";
import { Button } from "../../components/ui/button";
import Link from "next/link";
import { useAuthContext } from "../../components/auth/AuthProvider";

export default function FileWatcherPage() {
  const [selectedDirectory, setSelectedDirectory] = useState<string>("");
  const { isAuthenticated } = useAuthContext();

  // Load saved directory on component mount
  useEffect(() => {
    const savedWatcherDirectory = localStorage.getItem("watcherDirectory");
    if (savedWatcherDirectory) {
      setSelectedDirectory(savedWatcherDirectory);
    }
  }, []);

  // Function to handle directory selection
  const handleDirectorySelect = (path: string) => {
    console.log("Directory selected:", path);
    setSelectedDirectory(path);
    
    // Save the selected directory to localStorage
    localStorage.setItem("watcherDirectory", path);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">File Watcher</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <FolderSelector onDirectorySelect={handleDirectorySelect} initialDirectory={selectedDirectory} />
        <div className="bg-white rounded-lg shadow">
          <FileWatcher 
            initialDirectoryPath={selectedDirectory}
            onDirectorySelect={handleDirectorySelect}
          />
        </div>
      </div>
    </div>
  );
} 