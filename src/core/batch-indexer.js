import logger from '../config/logger.js';

/**
 * Batch operations for Redis to improve performance
 * Groups operations into pipelines for faster execution
 */
class BatchIndexer {
  constructor(redisStore) {
    this.redis = redisStore;
    this.logger = logger.child({ component: 'BatchIndexer' });
  }

  /**
   * Index multiple functions in a single pipeline
   * Much faster than individual operations
   * 
   * @param {Array} functions - Array of {name, metadata, calls}
   * @returns {Promise<Object>} - Results
   */
  async batchIndexFunctions(functions) {
    if (!functions || functions.length === 0) {
      return { indexed: 0, errors: 0 };
    }

    const startTime = Date.now();
    const pipeline = this.redis.client.pipeline();

    // Add all operations to pipeline
    for (const fn of functions) {
      // Set function metadata
      pipeline.hset(`function:${fn.name}`, {
        file: fn.metadata.file,
        line: fn.metadata.line,
        endLine: fn.metadata.endLine || fn.metadata.line,
        params: JSON.stringify(fn.metadata.params || []),
        isAsync: fn.metadata.isAsync ? '1' : '0',
        isExported: fn.metadata.isExported ? '1' : '0',
        type: fn.metadata.type || 'function',
        lastIndexed: Date.now(),
      });

      // Add call relationships
      if (fn.calls && fn.calls.length > 0) {
        for (const calledFunction of fn.calls) {
          pipeline.sadd(`function:${fn.name}:calls`, calledFunction);
          pipeline.sadd(`function:${calledFunction}:called_by`, fn.name);
        }
      }
    }

    // Execute all at once
    try {
      await pipeline.exec();
      const duration = Date.now() - startTime;
      
      this.logger.info(
        { functionCount: functions.length, duration },
        'Batch indexed functions'
      );

      return { indexed: functions.length, errors: 0 };
    } catch (error) {
      this.logger.error(
        { error: error.message, functionCount: functions.length },
        'Batch indexing failed'
      );
      return { indexed: 0, errors: functions.length };
    }
  }

  /**
   * Delete data for multiple files in batch
   * @param {Array<string>} filePaths - Files to delete
   */
  async batchDeleteFiles(filePaths) {
    if (!filePaths || filePaths.length === 0) {
      return;
    }

    const pipeline = this.redis.client.pipeline();
    
    for (const filePath of filePaths) {
      // Get functions in this file (would need pre-fetch, so skip for now)
      // This is a simplified version
      pipeline.hdel('file:metadata', filePath);
      pipeline.del(`file:${filePath}:meta`);
    }

    await pipeline.exec();
    
    this.logger.info(
      { fileCount: filePaths.length },
      'Batch deleted file data'
    );
  }

  /**
   * Get multiple functions in one pipeline (faster queries)
   * @param {Array<string>} functionNames - Functions to fetch
   * @returns {Promise<Object>} - Map of function name to metadata
   */
  async batchGetFunctions(functionNames) {
    if (!functionNames || functionNames.length === 0) {
      return {};
    }

    const pipeline = this.redis.client.pipeline();
    
    for (const name of functionNames) {
      pipeline.hgetall(`function:${name}`);
      pipeline.smembers(`function:${name}:calls`);
      pipeline.smembers(`function:${name}:called_by`);
    }

    const results = await pipeline.exec();
    const functions = {};

    // Parse results (groups of 3: metadata, calls, calledBy)
    for (let i = 0; i < functionNames.length; i++) {
      const name = functionNames[i];
      const metadataIndex = i * 3;
      
      const metadata = results[metadataIndex][1];
      const calls = results[metadataIndex + 1][1];
      const calledBy = results[metadataIndex + 2][1];

      if (metadata && Object.keys(metadata).length > 0) {
        functions[name] = {
          ...metadata,
          calls,
          calledBy,
        };
      }
    }

    this.logger.debug(
      { requested: functionNames.length, found: Object.keys(functions).length },
      'Batch fetched functions'
    );

    return functions;
  }
}

export default BatchIndexer;

