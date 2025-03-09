use crate::services::file_service::FileService;
use crate::services::AgentService;
use std::path::PathBuf;
use std::collections::HashMap;
use tauri::State;
use std::fs;
use log::info;
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct FileAnalysisResult {
    pub source_files: HashMap<String, Option<String>>,
    pub file_count: usize,
    pub test_count: usize,
}

#[tauri::command]
pub async fn find_test_files(
    directory: String, 
    include_dirs: Option<Vec<String>>
) -> Result<FileAnalysisResult, String> {
    info!("Finding test files in directory: {}", directory);
    let file_service = FileService::new();
    
    // Convert directory string to PathBuf
    let dir_path = PathBuf::from(directory);
    if !file_service.path_exists(&dir_path) {
        return Err("Directory does not exist".to_string());
    }

    // Call the find_test_files method from FileService
    match file_service.find_test_files(&dir_path, include_dirs) {
        Ok(test_files_map) => {
            // Count how many files have tests
            let test_count = test_files_map.values().filter(|v| v.is_some()).count();
            let file_count = test_files_map.len();
            
            info!("Found {} files, {} with tests", file_count, test_count);
            
            Ok(FileAnalysisResult {
                source_files: test_files_map,
                file_count,
                test_count,
            })
        },
        Err(e) => Err(format!("Failed to analyze test files: {}", e))
    }
}

// In Tauri v2, we need to use normal function parameters - the renaming is handled by Tauri itself
#[tauri::command]
pub async fn generate_and_write_test(
    directory: String,
    source_file: String,
    language: String,
    test_framework: Option<String>,
    agent_service: State<'_, AgentService>,
) -> Result<String, String> {
    let file_service = FileService::new();
    info!("Generating test for {} in {} with language {}", source_file, directory, language);
    
    // Convert directory string to PathBuf
    let dir_path = if directory.is_empty() {
        // Fall back to current working directory if no directory is provided
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current working directory: {}", e))?
    } else {
        PathBuf::from(&directory)
    };
    
    if !file_service.path_exists(&dir_path) {
        return Err(format!("Directory does not exist: {}", dir_path.display()));
    }
    
    // Read the source file content
    let full_source_path = dir_path.join(&source_file);
    let source_code = fs::read_to_string(&full_source_path)
        .map_err(|e| format!("Failed to read source file: {}", e))?;
    
    // Generate test code using the agent
    let test_response = agent_service.generate_tests(source_code, language, test_framework).await?;
    
    // Write the test file
    let test_file_path = file_service.write_test_file(&dir_path, &source_file, &test_response.content)?;
    
    Ok(test_file_path)
} 