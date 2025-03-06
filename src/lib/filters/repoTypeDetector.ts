import { RepoType } from '@/types/fileWatcher';

interface RepoTypeSignature {
  files: string[];
  directories: string[];
}

/**
 * Signatures for detecting repository types
 */
const REPO_TYPE_SIGNATURES: Record<RepoType, RepoTypeSignature> = {
  javascript: {
    files: ['package.json', 'package-lock.json', 'yarn.lock', 'node_modules'],
    directories: ['node_modules']
  },
  typescript: {
    files: ['tsconfig.json', 'package.json', 'node_modules'],
    directories: ['node_modules']
  },
  python: {
    files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
    directories: ['__pycache__', '.venv', 'venv']
  },
  java: {
    files: ['pom.xml', 'build.gradle', 'gradlew', '.classpath'],
    directories: ['target', 'build', '.gradle']
  },
  csharp: {
    files: ['.sln', '.csproj', 'packages.config'],
    directories: ['bin', 'obj', 'packages']
  },
  cpp: {
    files: ['CMakeLists.txt', 'Makefile', '.vcxproj'],
    directories: ['build', 'bin', 'lib']
  },
  go: {
    files: ['go.mod', 'go.sum', 'main.go'],
    directories: ['vendor', 'pkg']
  },
  rust: {
    files: ['Cargo.toml', 'Cargo.lock'],
    directories: ['target', 'src']
  },
  php: {
    files: ['composer.json', 'composer.lock', 'artisan'],
    directories: ['vendor', 'app']
  },
  ruby: {
    files: ['Gemfile', 'Rakefile', 'config.ru'],
    directories: ['vendor', 'lib', 'app']
  },
  generic: {
    files: [],
    directories: []
  }
};

/**
 * Detects the repository type based on files and directories present
 * @param filesPresent List of files present in the repository
 * @param directoriesPresent List of directories present in the repository
 * @returns The detected repository type
 */
export function detectRepoType(
  filesPresent: string[],
  directoriesPresent: string[]
): RepoType {
  // Convert to lowercase and get just the filenames (no paths)
  const normalizedFiles = filesPresent.map(f => {
    const parts = f.toLowerCase().split('/');
    return parts[parts.length - 1];
  });
  
  // Convert to lowercase and get just the directory names (no paths)
  const normalizedDirs = directoriesPresent.map(d => {
    const parts = d.toLowerCase().split('/');
    return parts[parts.length - 1];
  });
  
  // Score each repo type based on matching files and directories
  const scores: Record<RepoType, number> = {
    javascript: 0,
    typescript: 0,
    python: 0,
    java: 0,
    csharp: 0,
    cpp: 0,
    go: 0,
    rust: 0,
    php: 0,
    ruby: 0,
    generic: 0
  };
  
  // Calculate scores
  for (const [repoType, signature] of Object.entries(REPO_TYPE_SIGNATURES) as [RepoType, RepoTypeSignature][]) {
    // Score for matching files
    for (const file of signature.files) {
      if (normalizedFiles.includes(file.toLowerCase())) {
        scores[repoType] += 1;
      }
    }
    
    // Score for matching directories
    for (const dir of signature.directories) {
      if (normalizedDirs.includes(dir.toLowerCase())) {
        scores[repoType] += 1;
      }
    }
  }
  
  // Find the repo type with the highest score
  let bestMatch: RepoType = 'generic';
  let highestScore = 0;
  
  for (const [repoType, score] of Object.entries(scores) as [RepoType, number][]) {
    if (score > highestScore) {
      highestScore = score;
      bestMatch = repoType;
    }
  }
  
  // Special case: TypeScript is a superset of JavaScript
  // If both have the same score, prefer TypeScript if tsconfig.json is present
  if (scores.javascript === scores.typescript && scores.typescript > 0) {
    if (normalizedFiles.includes('tsconfig.json')) {
      bestMatch = 'typescript';
    }
  }
  
  return bestMatch;
}

/**
 * Asynchronously detects the repository type using Tauri file system API
 * @param directoryPath The directory to check
 * @returns The detected repository type
 */
export async function detectRepoTypeAsync(directoryPath: string): Promise<RepoType> {
  try {
    // Import Tauri API
    const { invoke } = await import('@tauri-apps/api/core');
    
    // Check if the list_directory_files command exists by trying to invoke it
    try {
      // Get files in the repository (non-recursive, just check top level)
      const files = await invoke<string[]>('list_directory_files', {
        directoryPath,
        recursive: false // Just check top level files for detection
      });
      
      if (!files || !Array.isArray(files)) {
        console.warn('list_directory_files did not return an array');
        return 'generic';
      }
      
      // Extract filenames and directory names from paths
      const fileNames: string[] = [];
      const directoryNames: string[] = [];
      
      // Simple heuristic: assume paths ending with / or without extension are directories
      for (const path of files) {
        const fileName = path.split('/').pop() || '';
        
        // Skip hidden files
        if (fileName.startsWith('.')) continue;
        
        if (fileName.includes('.')) {
          fileNames.push(fileName);
        } else {
          directoryNames.push(fileName);
        }
      }
      
      // Use common directory names to help with detection
      if (directoryNames.includes('node_modules')) {
        // Check if it's TypeScript by looking for tsconfig.json
        if (fileNames.includes('tsconfig.json')) {
          return 'typescript';
        }
        return 'javascript';
      }
      
      if (directoryNames.includes('__pycache__') || directoryNames.includes('venv')) {
        return 'python';
      }
      
      if (directoryNames.includes('target') && fileNames.includes('Cargo.toml')) {
        return 'rust';
      }
      
      // Check for specific files
      if (fileNames.includes('package.json')) {
        // Check if it's TypeScript by looking for tsconfig.json
        if (fileNames.includes('tsconfig.json')) {
          return 'typescript';
        }
        return 'javascript';
      }
      
      if (fileNames.includes('requirements.txt') || fileNames.includes('setup.py')) {
        return 'python';
      }
      
      if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle')) {
        return 'java';
      }
      
      if (fileNames.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) {
        return 'csharp';
      }
      
      if (fileNames.includes('CMakeLists.txt') || fileNames.some(f => f.endsWith('.vcxproj'))) {
        return 'cpp';
      }
      
      if (fileNames.includes('go.mod')) {
        return 'go';
      }
      
      if (fileNames.includes('composer.json')) {
        return 'php';
      }
      
      if (fileNames.includes('Gemfile')) {
        return 'ruby';
      }
      
    } catch (cmdError) {
      console.warn('list_directory_files command not available:', cmdError);
      // If the command doesn't exist, fall back to a simple detection based on the directory name
      const dirName = directoryPath.split('/').pop()?.toLowerCase() || '';
      
      if (dirName.includes('node') || dirName.includes('js') || dirName.includes('javascript')) {
        return 'javascript';
      }
      
      if (dirName.includes('ts') || dirName.includes('typescript')) {
        return 'typescript';
      }
      
      if (dirName.includes('py') || dirName.includes('python')) {
        return 'python';
      }
      
      if (dirName.includes('java')) {
        return 'java';
      }
      
      if (dirName.includes('cs') || dirName.includes('csharp') || dirName.includes('dotnet')) {
        return 'csharp';
      }
      
      if (dirName.includes('cpp') || dirName.includes('c++')) {
        return 'cpp';
      }
      
      if (dirName.includes('go') || dirName.includes('golang')) {
        return 'go';
      }
      
      if (dirName.includes('rust') || dirName.includes('rs')) {
        return 'rust';
      }
      
      if (dirName.includes('php')) {
        return 'php';
      }
      
      if (dirName.includes('ruby') || dirName.includes('rb')) {
        return 'ruby';
      }
    }
    
    return 'generic';
  } catch (error) {
    console.error('Error detecting repository type:', error);
    return 'generic';
  }
} 