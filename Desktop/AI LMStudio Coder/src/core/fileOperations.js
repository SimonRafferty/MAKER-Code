import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * FileOperations - Handles all file I/O operations
 * Provides safe file reading, writing, and editing with path validation
 */
class FileOperations {
  constructor(rootPath) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Resolve and validate a file path
   * @param {string} filePath - Relative or absolute path
   * @returns {string} - Absolute validated path
   */
  resolvePath(filePath) {
    // If absolute path, use it; otherwise resolve relative to rootPath
    const resolved = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(this.rootPath, filePath);

    // Validate that path is within rootPath (prevent directory traversal)
    if (!resolved.startsWith(this.rootPath)) {
      throw new Error(
        `Path ${filePath} is outside the project root. Access denied for security.`
      );
    }

    return resolved;
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Path to check
   * @returns {boolean} - True if file exists
   */
  fileExists(filePath) {
    try {
      const resolved = this.resolvePath(filePath);
      return existsSync(resolved);
    } catch (error) {
      return false;
    }
  }

  /**
   * Read a file
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} - File contents
   */
  async readFile(filePath) {
    try {
      const resolved = this.resolvePath(filePath);

      if (!existsSync(resolved)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = await fs.readFile(resolved, 'utf-8');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write content to a file
   * @param {string} filePath - Path to file
   * @param {string} content - Content to write
   * @returns {Promise<void>}
   */
  async writeFile(filePath, content) {
    try {
      const resolved = this.resolvePath(filePath);

      // Create directory if it doesn't exist
      const dir = path.dirname(resolved);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(resolved, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Read JSON file
   * @param {string} filePath - Path to JSON file
   * @returns {Promise<Object>} - Parsed JSON object
   */
  async readJSON(filePath) {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in file ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Write JSON file
   * @param {string} filePath - Path to JSON file
   * @param {Object} data - Object to serialize
   * @param {boolean} pretty - Whether to format JSON
   * @returns {Promise<void>}
   */
  async writeJSON(filePath, data, pretty = true) {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await this.writeFile(filePath, content);
  }
}

export default FileOperations;
