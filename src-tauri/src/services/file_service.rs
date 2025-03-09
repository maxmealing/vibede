use log::info;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use walkdir::WalkDir;
use std::fs;
use std::io::Write;

/// File service for handling file system operations
pub struct FileService;

impl FileService {
    /// Creates a new FileService instance
    pub fn new() -> Self {
        FileService
    }

    /// Checks if a path exists
    pub fn path_exists<P: AsRef<Path>>(&self, path: P) -> bool {
        let exists = path.as_ref().exists();
        info!(
            "Checking if path exists: {}, result: {}",
            path.as_ref().display(),
            exists
        );
        exists
    }

    /// Example method for future file operations
    pub fn get_file_info<P: AsRef<Path>>(&self, path: P) -> Result<String, String> {
        let path_ref = path.as_ref();

        if !self.path_exists(path_ref) {
            return Err(format!("Path does not exist: {}", path_ref.display()));
        }

        let metadata = match std::fs::metadata(path_ref) {
            Ok(meta) => meta,
            Err(e) => return Err(format!("Failed to get metadata: {}", e)),
        };

        let file_type = if metadata.is_dir() {
            "directory"
        } else if metadata.is_file() {
            "file"
        } else {
            "unknown"
        };

        let size = metadata.len();

        Ok(format!("Type: {}, Size: {} bytes", file_type, size))
    }
    
    /// Finds source files and their corresponding test files in a directory
    /// Returns a mapping where:
    /// - Key: Source file path (relative to the directory)
    /// - Value: Option<String> - Some(test_file_path) if test exists, None if not
    pub fn find_test_files<P: AsRef<Path>>(
        &self, 
        directory_path: P, 
        include_dirs: Option<Vec<String>>
    ) -> Result<HashMap<String, Option<String>>, String> {
        let dir_path = directory_path.as_ref();
        if !self.path_exists(dir_path) {
            return Err(format!("Directory does not exist: {}", dir_path.display()));
        }
        
        if !dir_path.is_dir() {
            return Err(format!("Path is not a directory: {}", dir_path.display()));
        }
        
        let base_path = dir_path.to_path_buf();
        info!("Analyzing test files in directory: {}", base_path.display());
        
        // Map where key is source file path and value is Option<test_file_path>
        let mut file_test_map = HashMap::new();
        let mut all_test_files = Vec::new();
        
        // First pass: collect all relevant files
        for entry in WalkDir::new(&base_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let full_path = entry.path().to_path_buf();
            let relative_path = self.get_relative_path(&full_path, &base_path);
            
            // If include_dirs is specified, check if the file is in one of those directories
            if let Some(ref dirs) = include_dirs {
                let path_str = relative_path.as_str();
                let in_included_dir = dirs.iter().any(|dir| path_str.starts_with(dir));
                if !in_included_dir {
                    continue; // Skip this file as it's not in an included directory
                }
            }
            
            if self.is_test_file(&relative_path) {
                all_test_files.push(relative_path.clone());
            } else if self.is_source_file(&relative_path) {
                file_test_map.insert(relative_path, None);
            }
        }
        
        // Second pass: match test files to their source files
        for test_path in all_test_files {
            if let Some(source_path) = self.find_corresponding_source_file(&test_path, &file_test_map.keys().cloned().collect()) {
                if let Some(entry) = file_test_map.get_mut(&source_path) {
                    *entry = Some(test_path);
                }
            }
        }
        
        Ok(file_test_map)
    }
    
    // Helper method to determine if a file is a test file based on naming conventions
    fn is_test_file(&self, path: &str) -> bool {
        let file_name = Path::new(path).file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
            
        path.contains("/test/") || 
        path.contains("/tests/") || 
        path.contains("/spec/") || 
        path.contains("/specs/") || 
        file_name.starts_with("test_") || 
        file_name.ends_with(".test.ts") || 
        file_name.ends_with(".test.js") || 
        file_name.ends_with(".test.tsx") || 
        file_name.ends_with(".test.jsx") || 
        file_name.ends_with("_test.go") || 
        file_name.ends_with("_test.py") || 
        file_name.ends_with("Test.java") || 
        file_name.ends_with("Tests.cs") || 
        file_name.ends_with(".spec.ts") || 
        file_name.ends_with(".spec.js") || 
        file_name.ends_with("_spec.rb") ||
        // Rust test files are often in a tests directory or have test_ prefix for test modules
        (path.ends_with(".rs") && (path.contains("/tests/") || file_name.starts_with("test_")))
    }
    
    // Helper method to determine if a file is a source file we might want to test
    fn is_source_file(&self, path: &str) -> bool {
        let extensions = [".js", ".ts", ".tsx", ".jsx", ".py", ".go", ".java", ".cs", 
                          ".rs", ".rb", ".php", ".c", ".cpp", ".h", ".hpp", ".swift"];
        
        // Common directories to exclude
        let excluded_dirs = [
            "node_modules/", ".git/", "vendor/", "dist/", "build/", 
            ".next/", "out/", "target/", "bin/", "obj/", 
            "coverage/", ".vscode/", ".idea/", ".vs/", 
            "public/", "assets/", "static/", "images/", 
            "third_party/", "third-party/", "external/", "externals/",
            "packages/", "deps/", "dependencies/"
        ];
        
        // Check if file has a supported extension
        if let Some(ext) = Path::new(path).extension().and_then(|e| e.to_str()) {
            // Exclude files that are in excluded directories
            for excluded_dir in &excluded_dirs {
                if path.contains(excluded_dir) {
                    return false;
                }
            }
            
            // Check if it's a source file with a supported extension
            return extensions.iter().any(|&supported_ext| supported_ext == format!(".{}", ext));
        }
        
        false
    }
    
    // Helper method to find the source file that corresponds to a test file
    fn find_corresponding_source_file(&self, test_path: &str, source_files: &Vec<String>) -> Option<String> {
        // Extract the base name without test indicators
        let test_file_name = Path::new(test_path).file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        // Try different test naming patterns to derive the source file name
        let possible_src_names = self.derive_source_file_names(test_file_name);
        
        // Look for a source file with a matching path structure
        for source_path in source_files {
            let source_file_name = Path::new(source_path).file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            
            // Check if the source file name matches any of our derived names
            if possible_src_names.iter().any(|name| name == source_file_name) {
                // Additional check: paths should be similar except for test indicators
                let test_dir = Path::new(test_path).parent().and_then(|p| p.to_str()).unwrap_or("");
                let source_dir = Path::new(source_path).parent().and_then(|p| p.to_str()).unwrap_or("");
                
                // Special case for test directories
                if test_dir.ends_with("/test") || test_dir.ends_with("/tests") || 
                   test_dir.ends_with("/spec") || test_dir.ends_with("/specs") {
                    let parent_dir = Path::new(test_dir).parent().and_then(|p| p.to_str()).unwrap_or("");
                    if source_dir.starts_with(parent_dir) {
                        return Some(source_path.clone());
                    }
                } 
                // Special case for parallel test directories
                else if (test_dir.replace("/test/", "/") == source_dir.replace("/src/", "/")) ||
                        (test_dir.replace("/tests/", "/") == source_dir.replace("/src/", "/")) ||
                        (test_dir.replace("/spec/", "/") == source_dir.replace("/src/", "/")) ||
                        (test_dir.replace("/specs/", "/") == source_dir.replace("/src/", "/")) {
                    return Some(source_path.clone());
                }
                // Direct match in the same directory
                else if test_dir == source_dir {
                    return Some(source_path.clone());
                }
            }
        }
        
        None
    }
    
    // Helper method to derive possible source file names from a test file name
    fn derive_source_file_names(&self, test_file_name: &str) -> Vec<String> {
        let mut possible_names = Vec::new();
        
        // Handle different test file naming conventions
        if test_file_name.starts_with("test_") {
            possible_names.push(test_file_name[5..].to_string()); // test_file.py -> file.py
        }
        
        if test_file_name.ends_with(".test.ts") {
            let base = &test_file_name[0..test_file_name.len() - 8];
            possible_names.push(format!("{}.ts", base)); // file.test.ts -> file.ts
        }
        
        if test_file_name.ends_with(".test.js") {
            let base = &test_file_name[0..test_file_name.len() - 8];
            possible_names.push(format!("{}.js", base)); // file.test.js -> file.js
        }
        
        if test_file_name.ends_with(".test.tsx") {
            let base = &test_file_name[0..test_file_name.len() - 9];
            possible_names.push(format!("{}.tsx", base)); // file.test.tsx -> file.tsx
        }
        
        if test_file_name.ends_with(".test.jsx") {
            let base = &test_file_name[0..test_file_name.len() - 9];
            possible_names.push(format!("{}.jsx", base)); // file.test.jsx -> file.jsx
        }
        
        if test_file_name.ends_with("_test.go") {
            let base = &test_file_name[0..test_file_name.len() - 8];
            possible_names.push(format!("{}.go", base)); // file_test.go -> file.go
        }
        
        if test_file_name.ends_with("Test.java") {
            let base = &test_file_name[0..test_file_name.len() - 9];
            possible_names.push(format!("{}.java", base)); // FileTest.java -> File.java
        }
        
        if test_file_name.ends_with(".spec.ts") {
            let base = &test_file_name[0..test_file_name.len() - 8];
            possible_names.push(format!("{}.ts", base)); // file.spec.ts -> file.ts
        }
        
        if test_file_name.ends_with(".spec.js") {
            let base = &test_file_name[0..test_file_name.len() - 8];
            possible_names.push(format!("{}.js", base)); // file.spec.js -> file.js
        }
        
        if test_file_name.ends_with("_spec.rb") {
            let base = &test_file_name[0..test_file_name.len() - 8];
            possible_names.push(format!("{}.rb", base)); // file_spec.rb -> file.rb
        }
        
        // For Rust, test files often have the same name as the source file but are in a tests directory
        // or they might have a test_ prefix
        if test_file_name.ends_with(".rs") {
            if test_file_name.starts_with("test_") {
                let base = &test_file_name[5..];
                possible_names.push(base.to_string()); // test_file.rs -> file.rs
            } else {
                // The test file might have the same name as the source file
                possible_names.push(test_file_name.to_string());
            }
        }
        
        possible_names
    }
    
    // Helper method to get a path relative to the base directory
    fn get_relative_path(&self, full_path: &PathBuf, base_path: &PathBuf) -> String {
        full_path.strip_prefix(base_path)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|_| full_path.to_string_lossy().into_owned())
    }

    /// Writes test content to a file
    /// If the test file doesn't exist, it will be created
    /// If the test file exists, it will be overwritten
    pub fn write_test_file<P: AsRef<Path>>(&self, base_dir: P, source_file: &str, test_content: &str) -> Result<String, String> {
        let base_dir = base_dir.as_ref();
        if !self.path_exists(base_dir) {
            return Err(format!("Base directory does not exist: {}", base_dir.display()));
        }
        
        // Determine the test file path based on the source file
        let test_file_path = self.derive_test_file_path(source_file)?;
        
        // Create the full path by joining the base directory and test file path
        let full_test_path = base_dir.join(&test_file_path);
        
        // Ensure the directory exists
        if let Some(parent) = full_test_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
            }
        }
        
        // Write the test content to the file
        let mut file = fs::File::create(&full_test_path)
            .map_err(|e| format!("Failed to create test file: {}", e))?;
        
        file.write_all(test_content.as_bytes())
            .map_err(|e| format!("Failed to write test content: {}", e))?;
        
        info!("Successfully wrote test file: {}", full_test_path.display());
        
        Ok(test_file_path)
    }
    
    /// Derives the test file path based on the source file path
    fn derive_test_file_path(&self, source_file: &str) -> Result<String, String> {
        let path = Path::new(source_file);
        
        // Get the file name and extension
        let file_stem = path.file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| format!("Invalid source file name: {}", source_file))?;
            
        let extension = path.extension()
            .and_then(|s| s.to_str())
            .ok_or_else(|| format!("Source file has no extension: {}", source_file))?;
            
        // Get the directory part of the path
        let parent = path.parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
            
        // Determine the test file name based on the file extension
        let test_file_name = match extension {
            "ts" => format!("{}.test.ts", file_stem),
            "js" => format!("{}.test.js", file_stem),
            "tsx" => format!("{}.test.tsx", file_stem),
            "jsx" => format!("{}.test.jsx", file_stem),
            "py" => format!("test_{}.py", file_stem),
            "go" => format!("{}_test.go", file_stem),
            "java" => format!("{}Test.java", file_stem),
            "cs" => format!("{}Tests.cs", file_stem),
            "rb" => format!("{}_spec.rb", file_stem),
            "rs" => format!("{}_test.rs", file_stem), // Rust tests typically use _test suffix in tests directory
            _ => format!("{}.test.{}", file_stem, extension) // Default to .test.ext pattern
        };
        
        // Language-specific test directory handling
        match extension {
            "rs" => {
                // Rust tests are typically in a tests directory at the module level
                let rust_test_dir = if parent.is_empty() {
                    "tests".to_string()
                } else {
                    format!("{}/tests", parent)
                };
                
                Ok(format!("{}/{}", rust_test_dir, test_file_name))
            },
            "py" => {
                // Python tests might be in tests folder or in the same directory
                let test_dir = if parent.is_empty() {
                    "tests".to_string()
                } else if parent.ends_with("/tests") || parent.ends_with("/test") {
                    // Already in a test directory
                    parent
                } else {
                    format!("{}/tests", parent)
                };
                
                Ok(format!("{}/{}", test_dir, test_file_name))
            },
            "ts" | "js" | "tsx" | "jsx" => {
                // JavaScript/TypeScript tests often follow the pattern of being in the same directory or in a __tests__ directory
                let test_dir = if parent.is_empty() {
                    "__tests__".to_string()
                } else if parent.contains("/__tests__") || parent.contains("/tests") || parent.contains("/test") {
                    // Already in a test directory
                    parent
                } else {
                    format!("{}/__tests__", parent)
                };
                
                Ok(format!("{}/{}", test_dir, test_file_name))
            },
            _ => {
                // Generic approach for other languages
                let test_dir = if parent.is_empty() {
                    "tests".to_string()
                } else if parent.ends_with("/tests") || parent.ends_with("/test") {
                    // Already in a test directory
                    parent
                } else {
                    format!("{}/tests", parent)
                };
                
                Ok(format!("{}/{}", test_dir, test_file_name))
            }
        }
    }
}
