import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger.js';

/**
 * File system walker with configurable ignore patterns
 * Uses glob for efficient file discovery
 */
class FileWalker {
  constructor(config) {
    this.config = config;
    this.logger = logger.child({ component: 'FileWalker' });
  }

  /**
   * Walk directory and find all supported files
   * @param {string} rootPath - Root directory to walk
   * @param {Array<string>} extensions - File extensions to include (e.g., ['.js', '.ts'])
   * @returns {Promise<Array<string>>} - Array of file paths
   */
  async walk(rootPath, extensions) {
    const startTime = Date.now();
    this.logger.info({ rootPath, extensions }, 'Starting directory walk');

    try {
      // Build glob pattern for extensions
      const extPattern = extensions.length === 1
        ? `**/*${extensions[0]}`
        : `**/*{${extensions.join(',')}}`;

      // Build ignore patterns
      const ignore = this.config.ignorePatterns.map(pattern => {
        // Ensure patterns work correctly with glob
        if (!pattern.startsWith('**/')) {
          return `**/${pattern}/**`;
        }
        return pattern;
      });

      this.logger.debug({ pattern: extPattern, ignore }, 'Glob configuration');

      // Find all matching files
      const files = await glob(extPattern, {
        cwd: rootPath,
        absolute: true,
        ignore,
        nodir: true,
        dot: false, // Don't include hidden files
      });

      // Filter by file size
      const validFiles = await this.filterBySize(files);

      const duration = Date.now() - startTime;
      this.logger.info(
        { 
          rootPath, 
          filesFound: validFiles.length, 
          filesFiltered: files.length - validFiles.length,
          duration 
        },
        'Directory walk complete'
      );

      return validFiles;

    } catch (error) {
      this.logger.error(
        { error: error.message, rootPath },
        'Failed to walk directory'
      );
      throw error;
    }
  }

  /**
   * Filter files by size
   * @param {Array<string>} files - Array of file paths
   * @returns {Promise<Array<string>>} - Filtered file paths
   */
  async filterBySize(files) {
    const maxSizeBytes = this.config.maxFileSizeMB * 1024 * 1024;
    const validFiles = [];

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        
        if (stats.size > maxSizeBytes) {
          this.logger.warn(
            { file, sizeMB: (stats.size / 1024 / 1024).toFixed(2) },
            'File exceeds size limit, skipping'
          );
          continue;
        }

        validFiles.push(file);
      } catch (error) {
        this.logger.warn(
          { file, error: error.message },
          'Failed to stat file, skipping'
        );
      }
    }

    return validFiles;
  }

  /**
   * Read file content
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} - File content
   */
  async readFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      this.logger.error(
        { error: error.message, filePath },
        'Failed to read file'
      );
      throw error;
    }
  }

  /**
   * Get relative path from root
   * @param {string} rootPath - Root directory
   * @param {string} filePath - Absolute file path
   * @returns {string} - Relative path
   */
  getRelativePath(rootPath, filePath) {
    return path.relative(rootPath, filePath);
  }
}

export default FileWalker;


