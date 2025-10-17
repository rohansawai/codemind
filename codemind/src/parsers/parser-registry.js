import logger from '../config/logger.js';

/**
 * Registry for managing multiple language parsers
 * Allows easy addition of new language support
 */
class ParserRegistry {
  constructor() {
    this.parsers = [];
    this.logger = logger.child({ component: 'ParserRegistry' });
  }

  /**
   * Register a new parser
   * @param {BaseParser} parser - Parser instance
   */
  register(parser) {
    if (!parser.canParse || !parser.parse) {
      throw new Error('Parser must implement canParse() and parse() methods');
    }
    
    this.parsers.push(parser);
    this.logger.info({ parser: parser.constructor.name }, 'Parser registered');
  }

  /**
   * Get appropriate parser for a file
   * @param {string} filePath - Path to the file
   * @returns {BaseParser|null} - Parser instance or null if no parser found
   */
  getParser(filePath) {
    const parser = this.parsers.find(p => p.canParse(filePath));
    
    if (!parser) {
      this.logger.debug({ filePath }, 'No parser found for file');
      return null;
    }
    
    this.logger.debug(
      { filePath, parser: parser.constructor.name },
      'Parser found for file'
    );
    return parser;
  }

  /**
   * Get all registered parsers
   * @returns {Array<BaseParser>}
   */
  getAllParsers() {
    return [...this.parsers];
  }

  /**
   * Get supported file extensions
   * @returns {Array<string>}
   */
  getSupportedExtensions() {
    const extensions = new Set();
    
    for (const parser of this.parsers) {
      if (parser.supportedExtensions) {
        parser.supportedExtensions.forEach(ext => extensions.add(ext));
      }
    }
    
    return Array.from(extensions);
  }
}

export default ParserRegistry;


