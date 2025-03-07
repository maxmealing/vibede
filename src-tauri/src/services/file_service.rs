use log::info;
use std::path::Path;

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
}
