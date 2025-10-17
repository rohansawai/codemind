import ora from 'ora';
import chalk from 'chalk';
import logger from '../config/logger.js';
import RedisStore from './redis-store.js';
import FileWalker from './walker.js';
import ParserRegistry from '../parsers/parser-registry.js';
import JavaScriptParser from '../parsers/javascript-parser.js';
import FunctionIndexer from '../indexers/function-indexer.js';

/**
 * Main codebase indexer
 * Orchestrates file walking, parsing, and indexing
 */
class CodebaseIndexer {
  constructor(config) {
    this.config = config;
    this.logger = logger.child({ component: 'CodebaseIndexer' });
    
    // Initialize components
    this.redis = new RedisStore(config.redis);
    this.walker = new FileWalker(config.indexing);
    this.parserRegistry = new ParserRegistry();
    this.functionIndexer = new FunctionIndexer(this.redis);
    
    // Register parsers
    this.parserRegistry.register(new JavaScriptParser());
    
    this.logger.info('CodebaseIndexer initialized');
  }

  /**
   * Connect to Redis
   */
  async connect() {
    await this.redis.connect();
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    await this.redis.disconnect();
  }

  /**
   * Index a codebase
   * @param {string} rootPath - Root directory to index
   * @param {Object} options - Indexing options
   * @returns {Promise<Object>} - Indexing results
   */
  async indexCodebase(rootPath, options = {}) {
    const startTime = Date.now();
    const spinner = ora('Starting codebase indexing...').start();

    try {
      this.logger.info({ rootPath, options }, 'Starting codebase indexing');

      // Get supported extensions
      const extensions = options.extensions || this.config.indexing.supportedExtensions;
      
      // Walk directory to find files
      spinner.text = 'Discovering files...';
      const files = await this.walker.walk(rootPath, extensions);
      
      if (files.length === 0) {
        spinner.warn(chalk.yellow('No files found to index'));
        return {
          filesProcessed: 0,
          filesSkipped: 0,
          functionsIndexed: 0,
          errors: 0,
          duration: Date.now() - startTime,
        };
      }

      spinner.text = `Found ${files.length} files, starting indexing...`;
      this.logger.info({ fileCount: files.length }, 'Files discovered');

      // Index each file
      let filesProcessed = 0;
      let filesSkipped = 0;
      let totalFunctionsIndexed = 0;
      let totalErrors = 0;

      for (const file of files) {
        try {
          const relativePath = this.walker.getRelativePath(rootPath, file);
          spinner.text = `Indexing: ${relativePath} (${filesProcessed + filesSkipped + 1}/${files.length})`;

          const result = await this.indexFile(file, options);
          
          if (result.skipped) {
            filesSkipped++;
          } else {
            filesProcessed++;
            totalFunctionsIndexed += result.functionsIndexed;
            totalErrors += result.errors;
          }

        } catch (error) {
          this.logger.error(
            { error: error.message, file },
            'Failed to index file'
          );
          totalErrors++;
        }
      }

      const duration = Date.now() - startTime;
      const stats = await this.redis.getStats();

      spinner.succeed(
        chalk.green(
          `✓ Indexed ${filesProcessed} files, ${totalFunctionsIndexed} functions in ${(duration / 1000).toFixed(2)}s`
        )
      );

      const results = {
        filesProcessed,
        filesSkipped,
        functionsIndexed: totalFunctionsIndexed,
        errors: totalErrors,
        duration,
        stats,
      };

      this.logger.info(results, 'Codebase indexing complete');
      return results;

    } catch (error) {
      spinner.fail(chalk.red(`✗ Indexing failed: ${error.message}`));
      this.logger.error({ error: error.message, stack: error.stack }, 'Indexing failed');
      throw error;
    }
  }

  /**
   * Index a single file
   * @param {string} filePath - Path to the file
   * @param {Object} options - Indexing options
   * @returns {Promise<Object>} - Indexing result
   */
  async indexFile(filePath, options = {}) {
    // Get appropriate parser
    const parser = this.parserRegistry.getParser(filePath);
    
    if (!parser) {
      this.logger.debug({ filePath }, 'No parser available for file');
      return { skipped: true, functionsIndexed: 0, errors: 0 };
    }

    // Read file content
    const content = await this.walker.readFile(filePath);

    // Check if file needs re-indexing
    if (!options.force && !(await this.redis.shouldReindex(filePath, content))) {
      this.logger.debug({ filePath }, 'File unchanged, skipping');
      return { skipped: true, functionsIndexed: 0, errors: 0 };
    }

    // Delete old data if re-indexing
    if (!options.skipDelete) {
      await this.redis.deleteFileData(filePath);
    }

    // Parse file
    const parseResult = await parser.parse(filePath, content);

    if (!parser.validateResult(parseResult)) {
      this.logger.warn({ filePath }, 'Invalid parse result');
      return { skipped: false, functionsIndexed: 0, errors: 1 };
    }

    // Index functions
    const { indexed, errors } = await this.functionIndexer.index(
      filePath,
      parseResult.functions
    );

    // Update file hash
    const hash = this.redis.getContentHash(content);
    await this.redis.setFileHash(filePath, hash);

    return {
      skipped: false,
      functionsIndexed: indexed,
      errors,
    };
  }

  /**
   * Query function information
   * @param {string} functionName - Function name
   * @returns {Promise<Object|null>} - Function info
   */
  async queryFunction(functionName) {
    return await this.functionIndexer.getFunctionInfo(functionName);
  }

  /**
   * Trace function dependencies
   * @param {string} functionName - Function name
   * @param {number} maxDepth - Maximum depth
   * @returns {Promise<Object>} - Dependency tree
   */
  async traceDependencies(functionName, maxDepth = 5) {
    return await this.functionIndexer.traceDependencies(functionName, maxDepth);
  }

  /**
   * Find affected functions
   * @param {string} functionName - Function name
   * @param {number} maxDepth - Maximum depth
   * @returns {Promise<Array<string>>} - Affected functions
   */
  async findAffected(functionName, maxDepth = 5) {
    return await this.functionIndexer.findAffectedFunctions(functionName, maxDepth);
  }

  /**
   * Get all indexed functions
   * @returns {Promise<Array<string>>} - All function names
   */
  async getAllFunctions() {
    const allFunctions = [];
    let cursor = '0';

    do {
      const result = await this.redis.getAllFunctions(cursor, 100);
      allFunctions.push(...result.functions);
      cursor = result.cursor;
    } while (cursor !== '0');

    return allFunctions;
  }

  /**
   * Get indexing statistics
   * @returns {Promise<Object>} - Statistics
   */
  async getStats() {
    return await this.redis.getStats();
  }
}

export default CodebaseIndexer;


