"use client";
/// <reference types="@tauri-apps/api" />
// Custom reference declarations for Tauri modules
/// <reference path="../../types/tauri.d.ts" />

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectSelector } from "../../components/ProjectSelector";
import FileWatcher from "../../components/FileWatcher";
import { Button } from "../../components/ui/button";
import Link from "next/link";
import { useAuthContext } from "../../components/auth/AuthProvider";

export default function FileWatcherPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const { isAuthenticated } = useAuthContext();

  // Load saved project on component mount
  useEffect(() => {
    const savedWatcherProject = localStorage.getItem("watcherProject");
    if (savedWatcherProject) {
      setSelectedProject(savedWatcherProject);
    }
  }, []);

  // Function to handle project selection
  const handleProjectSelect = (path: string) => {
    console.log("Project selected in file-watcher:", path);
    
    // Validate the path
    if (!path) {
      console.error("Invalid project path:", path);
      return;
    }
    
    setSelectedProject(path);
    
    // Save the selected project to localStorage
    localStorage.setItem("watcherProject", path);
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
        <ProjectSelector onProjectSelect={handleProjectSelect} initialProject={selectedProject} />
        <div className="bg-white rounded-lg shadow">
          <FileWatcher 
            initialDirectoryPath={selectedProject}
            onDirectorySelect={handleProjectSelect}
          />
        </div>
      </div>
    </div>
  );
} 