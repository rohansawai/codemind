import logger from '../config/logger.js';

/**
 * Indexes function definitions and call relationships into Redis
 * Handles function metadata and call graph storage
 */
class FunctionIndexer {
  constructor(redisStore) {
    this.redis = redisStore;
    this.logger = logger.child({ component: 'FunctionIndexer' });
  }

  /**
   * Index all functions from a parsed file
   * @param {string} filePath - Path to the file
   * @param {Array<Object>} functions - Array of function metadata
   */
  async index(filePath, functions) {
    if (!functions || functions.length === 0) {
      this.logger.debug({ filePath }, 'No functions to index');
      return { indexed: 0, errors: 0 };
    }

    const startTime = Date.now();
    let indexed = 0;
    let errors = 0;

    this.logger.info(
      { filePath, functionCount: functions.length },
      'Indexing functions'
    );

    for (const fn of functions) {
      try {
        await this.indexFunction(filePath, fn);
        indexed++;
      } catch (error) {
        this.logger.error(
          { error: error.message, filePath, functionName: fn.name },
          'Failed to index function'
        );
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    this.logger.info(
      { filePath, indexed, errors, duration },
      'Functions indexed'
    );

    return { indexed, errors };
  }

  /**
   * Index a single function
   * @param {string} filePath - Path to the file
   * @param {Object} fn - Function metadata
   */
  async indexFunction(filePath, fn) {
    // Store function metadata
    await this.redis.setFunction(fn.name, {
      file: filePath,
      line: fn.line,
      endLine: fn.endLine,
      params: fn.params || [],
      isAsync: fn.isAsync || false,
      isExported: fn.isExported || false,
      type: fn.type || 'function',
    });

    // Store call relationships
    if (fn.calls && fn.calls.length > 0) {
      for (const calledFunction of fn.calls) {
        await this.redis.addFunctionCall(fn.name, calledFunction);
      }

      this.logger.debug(
        { functionName: fn.name, callCount: fn.calls.length },
        'Function calls indexed'
      );
    }
  }

  /**
   * Get function information with call graph
   * @param {string} functionName - Function name
   * @returns {Promise<Object|null>} - Function info with calls and callers
   */
  async getFunctionInfo(functionName) {
    const metadata = await this.redis.getFunction(functionName);
    
    if (!metadata) {
      this.logger.debug({ functionName }, 'Function not found');
      return null;
    }

    const calls = await this.redis.getFunctionCalls(functionName);
    const calledBy = await this.redis.getFunctionCallers(functionName);

    return {
      ...metadata,
      name: functionName,
      calls,
      calledBy,
    };
  }

  /**
   * Trace all dependencies of a function (recursive)
   * @param {string} functionName - Function name
   * @param {number} maxDepth - Maximum recursion depth
   * @returns {Promise<Object>} - Dependency tree
   */
  async traceDependencies(functionName, maxDepth = 5) {
    const visited = new Set();
    const result = {
      function: functionName,
      dependencies: [],
      depth: 0,
    };

    await this._traceDependenciesRecursive(functionName, result, visited, 0, maxDepth);

    this.logger.info(
      { functionName, totalDependencies: visited.size, maxDepth },
      'Dependencies traced'
    );

    return result;
  }

  /**
   * Recursive helper for tracing dependencies
   */
  async _traceDependenciesRecursive(functionName, node, visited, depth, maxDepth) {
    if (depth >= maxDepth || visited.has(functionName)) {
      return;
    }

    visited.add(functionName);
    const calls = await this.redis.getFunctionCalls(functionName);

    for (const calledFunction of calls) {
      const childNode = {
        function: calledFunction,
        dependencies: [],
        depth: depth + 1,
      };

      node.dependencies.push(childNode);

      await this._traceDependenciesRecursive(
        calledFunction,
        childNode,
        visited,
        depth + 1,
        maxDepth
      );
    }
  }

  /**
   * Find all functions that would be affected if a function changes
   * (reverse dependency trace)
   * @param {string} functionName - Function name
   * @param {number} maxDepth - Maximum recursion depth
   * @returns {Promise<Array<string>>} - List of affected functions
   */
  async findAffectedFunctions(functionName, maxDepth = 5) {
    const affected = new Set();
    await this._findAffectedRecursive(functionName, affected, 0, maxDepth);

    const result = Array.from(affected);
    
    this.logger.info(
      { functionName, affectedCount: result.length, maxDepth },
      'Affected functions found'
    );

    return result;
  }

  /**
   * Recursive helper for finding affected functions
   */
  async _findAffectedRecursive(functionName, affected, depth, maxDepth) {
    if (depth >= maxDepth || affected.has(functionName)) {
      return;
    }

    const callers = await this.redis.getFunctionCallers(functionName);

    for (const caller of callers) {
      affected.add(caller);
      await this._findAffectedRecursive(caller, affected, depth + 1, maxDepth);
    }
  }
}

export default FunctionIndexer;


