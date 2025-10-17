import logger from '../config/logger.js';

/**
 * Abstract base class for language parsers
 * All language-specific parsers must extend this class
 */
class BaseParser {
  constructor(config = {}) {
    this.config = config;
    this.logger = logger.child({ parser: this.constructor.name });
  }

  /**
   * Determine if this parser can handle the given file
   * @param {string} filePath - Path to the file
   * @returns {boolean} - True if parser can handle this file
   */
  canParse(filePath) {
    throw new Error('Must implement canParse() method');
  }

  /**
   * Parse a file and extract code structure
   * @param {string} filePath - Path to the file
   * @param {string} content - File content
   * @returns {Promise<ParseResult>} - Extracted code structure
   * 
   * ParseResult: {
   *   functions: Array<{
   *     name: string,
   *     line: number,
   *     endLine: number,
   *     params: Array<string>,
   *     calls: Array<string>,
   *     isAsync: boolean,
   *     isExported: boolean
   *   }>,
   *   classes: Array<any>,  // For future use
   *   imports: Array<any>   // For future use
   * }
   */
  async parse(filePath, content) {
    throw new Error('Must implement parse() method');
  }

  /**
   * Validate parse result structure
   * @param {ParseResult} result
   * @returns {boolean}
   */
  validateResult(result) {
    if (!result || typeof result !== 'object') {
      this.logger.warn({ result }, 'Invalid parse result: not an object');
      return false;
    }

    if (!Array.isArray(result.functions)) {
      this.logger.warn('Invalid parse result: functions is not an array');
      return false;
    }

    return true;
  }
}

export default BaseParser;


