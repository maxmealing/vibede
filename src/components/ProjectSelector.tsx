import React, { useState, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { 
  FolderIcon, 
  AlertCircle, 
  Star, 
  ChevronDown,
  RefreshCw
} from "lucide-react";
import { cn } from "../lib/utils";
import { invoke } from "@tauri-apps/api/core";

// Global app error handler
const logError = (message: string, error: any) => {
  console.error(`${message}:`, error);
};

interface Project {
  name: string;
  path: string;
  isFavorite: boolean;
  lastAccessed?: number;
}

interface ProjectSelectorProps {
  onProjectSelect: (path: string) => void;
  initialProject?: string;
}

export function ProjectSelector({ onProjectSelect, initialProject }: ProjectSelectorProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(initialProject || null);
  const [baseDirectory, setBaseDirectory] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Load base directory and projects from localStorage on component mount
  useEffect(() => {
    try {
      const savedBaseDir = localStorage.getItem('baseRepositoryDirectory');
      if (savedBaseDir) {
        setBaseDirectory(savedBaseDir);
        console.log("Loaded base directory from localStorage:", savedBaseDir);
      }

      const savedProjects = localStorage.getItem('projects');
      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      }
    } catch (error) {
      logError('Failed to load projects data', error);
    }
  }, []);

  // Listen for changes to the base directory in localStorage
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'baseRepositoryDirectory' && event.newValue) {
        console.log("Base directory changed in localStorage:", event.newValue);
        setBaseDirectory(event.newValue);
      }
      
      if (event.key === 'projects' && event.newValue) {
        try {
          setProjects(JSON.parse(event.newValue));
        } catch (error) {
          logError('Failed to parse projects from localStorage', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Scan the base directory for projects when it changes
  useEffect(() => {
    if (baseDirectory) {
      console.log("Base directory changed, scanning:", baseDirectory);
      scanBaseDirectory();
    }
  }, [baseDirectory]);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('projects', JSON.stringify(projects));
    } catch (error) {
      logError('Failed to save projects', error);
    }
  }, [projects]);

  // Update selected project when initialProject prop changes
  useEffect(() => {
    if (initialProject) {
      setSelectedProject(initialProject);
    }
  }, [initialProject]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Function to scan the base directory for projects
  const scanBaseDirectory = async () => {
    if (!baseDirectory) return;

    setIsLoading(true);
    setError(null);
    
    try {
      // Call Tauri to list directories in the base directory
      const directories = await invoke<string[]>('list_directories', {
        path: baseDirectory
      }).catch(e => {
        logError("Error listing directories", e);
        throw new Error(`Failed to list directories: ${e.message || String(e)}`);
      });
      
      console.log("Found directories:", directories);
      
      // Create project objects for each directory
      const newProjects: Project[] = directories.map(dir => {
        // Extract the name from the full path
        const name = dir.split('/').pop() || dir.split('\\').pop() || dir;
        
        // The path is already the full path from the Rust command
        const path = dir;
        
        // Check if this project already exists in our list
        const existingProject = projects.find(p => p.path === path);
        
        if (existingProject) {
          return existingProject;
        }
        
        return {
          name,
          path,
          isFavorite: false,
          lastAccessed: 0
        };
      });
      
      console.log("Processed projects:", newProjects);
      setProjects(newProjects);
      
      // Save to localStorage to ensure other components can access the updated projects
      localStorage.setItem('projects', JSON.stringify(newProjects));
    } catch (e) {
      logError("Error scanning base directory", e);
      setError(`Failed to scan directory: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to select a project
  const selectProject = (path: string) => {
    console.log("Selecting project:", path);
    setSelectedProject(path);
    setIsDropdownOpen(false);
    
    // Update last accessed timestamp
    setProjects(prev => 
      prev.map(project => 
        project.path === path 
          ? { ...project, lastAccessed: Date.now() } 
          : project
      )
    );
    
    // Save selected project to localStorage
    localStorage.setItem('selectedProject', path);
    
    if (onProjectSelect) {
      onProjectSelect(path);
    }
  };

  // Function to toggle favorite status
  const toggleFavorite = (path: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent dropdown from closing
    
    setProjects(prev => 
      prev.map(project => 
        project.path === path 
          ? { ...project, isFavorite: !project.isFavorite } 
          : project
      )
    );
  };

  // Sort projects: favorites first, then by last accessed
  const sortedProjects = [...projects].sort((a, b) => {
    // Favorites first
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    
    // Then by last accessed (most recent first)
    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
  });

  // Get the selected project name
  const selectedProjectName = selectedProject 
    ? projects.find(p => p.path === selectedProject)?.name || selectedProject.split('/').pop() || selectedProject.split('\\').pop() || selectedProject
    : "Select a project";

  return (
    <div className="h-full space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold mb-1">Project</h2>
          <p className="text-sm text-muted-foreground">
            Select a project to analyze
          </p>
        </div>
        <Button 
          onClick={scanBaseDirectory}
          disabled={isLoading || !baseDirectory}
          title={!baseDirectory ? "Set base repository directory in Settings first" : "Refresh project list"}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          <span className="ml-2">Refresh</span>
        </Button>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 text-red-800 rounded border border-red-200 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {!baseDirectory && (
        <div className="p-3 bg-amber-50 text-amber-800 rounded border border-amber-200 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-amber-500" />
          <span>Please set your base repository directory in Settings first.</span>
        </div>
      )}

      {/* Project Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={!baseDirectory || projects.length === 0}
        >
          <div className="flex items-center">
            <FolderIcon className="h-4 w-4 mr-2" />
            <span className="truncate">{selectedProjectName}</span>
          </div>
          <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
        </Button>
        
        {isDropdownOpen && projects.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto animate-in fade-in-0 zoom-in-95">
            <div className="py-1">
              {sortedProjects.map((project, index) => (
                <div 
                  key={`project-${index}`}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 cursor-pointer",
                    selectedProject === project.path ? "bg-muted" : "hover:bg-muted/50",
                    project.isFavorite ? "border-l-2 border-amber-500" : ""
                  )}
                  onClick={() => selectProject(project.path)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <FolderIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                    <div className="truncate">
                      <div className="font-medium truncate">{project.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{project.path}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-2"
                    onClick={(e) => toggleFavorite(project.path, e)}
                    title={project.isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className={cn(
                      "h-4 w-4",
                      project.isFavorite ? "text-amber-500 fill-amber-500" : ""
                    )} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {projects.length === 0 && baseDirectory && !isLoading && (
        <div className="p-8 text-center border rounded-md bg-muted/50">
          <p className="text-muted-foreground mb-4">No projects found in the base directory.</p>
          <Button onClick={scanBaseDirectory}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Scan for Projects
          </Button>
        </div>
      )}
    </div>
  );
} 