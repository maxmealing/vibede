"use client";
/// <reference types="@tauri-apps/api" />
// Custom reference declarations for Tauri modules
/// <reference path="../types/tauri.d.ts" />

import { useState } from "react";
import { FolderSelector } from "./components/folder-selector";
import FileWatcher from "../components/FileWatcher";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  const [selectedDirectory, setSelectedDirectory] = useState<string>("");

  // Function to handle directory selection
  const handleDirectorySelect = (path: string) => {
    console.log("Directory selected:", path);
    setSelectedDirectory(path);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">VibeDE File Watcher</h1>
        <Button variant="outline" asChild>
          <Link href="/settings">Settings</Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <FolderSelector onDirectorySelect={handleDirectorySelect} />
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