import Redis from 'ioredis';
import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * Redis storage layer with connection pooling and error handling
 * Handles all Redis operations with proper retry logic
 */
class RedisStore {
  constructor(config) {
    this.config = config;
    this.logger = logger.child({ component: 'RedisStore' });
    this.client = null;
    this.connected = false;
  }

  /**
   * Connect to Redis with retry logic
   */
  async connect() {
    try {
      this.client = new Redis(this.config.url, {
        maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
        enableReadyCheck: this.config.enableReadyCheck !== false,
        lazyConnect: false,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          this.logger.warn({ attempt: times, delay }, 'Retrying Redis connection');
          return delay;
        },
      });

      // Event handlers
      this.client.on('error', (err) => {
        this.logger.error({ error: err.message }, 'Redis error');
      });

      this.client.on('connect', () => {
        this.logger.info('Connected to Redis');
        this.connected = true;
      });

      this.client.on('ready', () => {
        this.logger.info('Redis client ready');
      });

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed');
        this.connected = false;
      });

      // Wait for connection
      await this.client.ping();
      this.logger.info({ url: this.config.url }, 'Redis connection established');
      
      return this.client;

    } catch (error) {
      this.logger.error(
        { error: error.message, url: this.config.url },
        'Failed to connect to Redis'
      );
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.logger.info('Disconnected from Redis');
    }
  }

  /**
   * Get MD5 hash of file content
   * @param {string} content - File content
   * @returns {string} - MD5 hash
   */
  getContentHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Get stored hash for a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<string|null>} - Stored hash or null
   */
  async getFileHash(filePath) {
    try {
      const hash = await this.client.hget('file:metadata', filePath);
      return hash;
    } catch (error) {
      this.logger.error({ error: error.message, filePath }, 'Failed to get file hash');
      return null;
    }
  }

  /**
   * Set hash for a file
   * @param {string} filePath - Path to the file
   * @param {string} hash - Content hash
   */
  async setFileHash(filePath, hash) {
    try {
      await this.client.hset('file:metadata', filePath, hash);
      await this.client.hset(`file:${filePath}:meta`, 'lastIndexed', Date.now());
      this.logger.debug({ filePath, hash }, 'File hash updated');
    } catch (error) {
      this.logger.error({ error: error.message, filePath }, 'Failed to set file hash');
      throw error;
    }
  }

  /**
   * Check if file needs re-indexing based on content hash
   * @param {string} filePath - Path to the file
   * @param {string} content - Current file content
   * @returns {Promise<boolean>} - True if file should be re-indexed
   */
  async shouldReindex(filePath, content) {
    const currentHash = this.getContentHash(content);
    const storedHash = await this.getFileHash(filePath);
    
    if (!storedHash) {
      this.logger.debug({ filePath }, 'File not indexed yet');
      return true;
    }

    const needsReindex = currentHash !== storedHash;
    this.logger.debug(
      { filePath, currentHash, storedHash, needsReindex },
      'Checked if file needs reindexing'
    );
    
    return needsReindex;
  }

  /**
   * Store function metadata
   * @param {string} functionName - Function name
   * @param {Object} metadata - Function metadata
   */
  async setFunction(functionName, metadata) {
    try {
      await this.client.hset(`function:${functionName}`, {
        file: metadata.file,
        line: metadata.line,
        endLine: metadata.endLine || metadata.line,
        params: JSON.stringify(metadata.params || []),
        isAsync: metadata.isAsync ? '1' : '0',
        isExported: metadata.isExported ? '1' : '0',
        type: metadata.type || 'function',
        lastIndexed: Date.now(),
      });
      
      this.logger.debug({ functionName, file: metadata.file }, 'Function metadata stored');
    } catch (error) {
      this.logger.error(
        { error: error.message, functionName },
        'Failed to store function metadata'
      );
      throw error;
    }
  }

  /**
   * Get function metadata
   * @param {string} functionName - Function name
   * @returns {Promise<Object|null>} - Function metadata or null
   */
  async getFunction(functionName) {
    try {
      const data = await this.client.hgetall(`function:${functionName}`);
      
      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        file: data.file,
        line: parseInt(data.line, 10),
        endLine: parseInt(data.endLine, 10),
        params: JSON.parse(data.params || '[]'),
        isAsync: data.isAsync === '1',
        isExported: data.isExported === '1',
        type: data.type,
        lastIndexed: parseInt(data.lastIndexed, 10),
      };
    } catch (error) {
      this.logger.error(
        { error: error.message, functionName },
        'Failed to get function metadata'
      );
      return null;
    }
  }

  /**
   * Add a function call relationship
   * @param {string} callerFunction - Function that makes the call
   * @param {string} calledFunction - Function being called
   */
  async addFunctionCall(callerFunction, calledFunction) {
    try {
      // Store: function A calls B
      await this.client.sadd(`function:${callerFunction}:calls`, calledFunction);
      
      // Store reverse: function B is called by A
      await this.client.sadd(`function:${calledFunction}:called_by`, callerFunction);
      
      this.logger.debug(
        { caller: callerFunction, called: calledFunction },
        'Function call relationship stored'
      );
    } catch (error) {
      this.logger.error(
        { error: error.message, caller: callerFunction, called: calledFunction },
        'Failed to store function call'
      );
      throw error;
    }
  }

  /**
   * Get functions called by a function
   * @param {string} functionName - Function name
   * @returns {Promise<Array<string>>} - Array of called function names
   */
  async getFunctionCalls(functionName) {
    try {
      const calls = await this.client.smembers(`function:${functionName}:calls`);
      return calls;
    } catch (error) {
      this.logger.error(
        { error: error.message, functionName },
        'Failed to get function calls'
      );
      return [];
    }
  }

  /**
   * Get functions that call a function
   * @param {string} functionName - Function name
   * @returns {Promise<Array<string>>} - Array of caller function names
   */
  async getFunctionCallers(functionName) {
    try {
      const callers = await this.client.smembers(`function:${functionName}:called_by`);
      return callers;
    } catch (error) {
      this.logger.error(
        { error: error.message, functionName },
        'Failed to get function callers'
      );
      return [];
    }
  }

  /**
   * Delete all data for a file (for re-indexing)
   * @param {string} filePath - Path to the file
   */
  async deleteFileData(filePath) {
    try {
      // Get all functions in this file
      const cursor = '0';
      const pattern = 'function:*';
      const functions = [];

      // Scan for all function keys
      let scanCursor = cursor;
      do {
        const [nextCursor, keys] = await this.client.scan(
          scanCursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        
        for (const key of keys) {
          if (key.includes(':')) continue; // Skip relationship keys
          
          const metadata = await this.getFunction(key.replace('function:', ''));
          if (metadata && metadata.file === filePath) {
            functions.push(key.replace('function:', ''));
          }
        }
        
        scanCursor = nextCursor;
      } while (scanCursor !== '0');

      // Delete function metadata and relationships
      for (const functionName of functions) {
        await this.client.del(`function:${functionName}`);
        await this.client.del(`function:${functionName}:calls`);
        await this.client.del(`function:${functionName}:called_by`);
      }

      // Delete file metadata
      await this.client.hdel('file:metadata', filePath);
      await this.client.del(`file:${filePath}:meta`);

      this.logger.info(
        { filePath, functionsDeleted: functions.length },
        'File data deleted'
      );
    } catch (error) {
      this.logger.error(
        { error: error.message, filePath },
        'Failed to delete file data'
      );
      throw error;
    }
  }

  /**
   * Get all indexed functions (with pagination)
   * @param {string} cursor - Scan cursor (use '0' to start)
   * @param {number} count - Number of keys to return per scan
   * @returns {Promise<{cursor: string, functions: Array<string>}>}
   */
  async getAllFunctions(cursor = '0', count = 100) {
    try {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        'function:*',
        'COUNT',
        count
      );

      // Filter out relationship keys (those with :calls or :called_by)
      const functionKeys = keys.filter(key => !key.includes(':calls') && !key.includes(':called_by'));
      const functions = functionKeys.map(key => key.replace('function:', ''));

      return {
        cursor: nextCursor,
        functions,
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get all functions');
      return { cursor: '0', functions: [] };
    }
  }

  /**
   * Get statistics about indexed code
   * @returns {Promise<Object>} - Statistics
   */
  async getStats() {
    try {
      const fileCount = await this.client.hlen('file:metadata');
      
      // Count functions (approximate using SCAN)
      let functionCount = 0;
      let scanCursor = '0';
      
      do {
        const [nextCursor, keys] = await this.client.scan(
          scanCursor,
          'MATCH',
          'function:*',
          'COUNT',
          100
        );
        
        // Only count base function keys (not relationship keys)
        functionCount += keys.filter(k => !k.includes(':calls') && !k.includes(':called_by')).length;
        scanCursor = nextCursor;
      } while (scanCursor !== '0');

      const stats = {
        filesIndexed: fileCount,
        functionsIndexed: functionCount,
        timestamp: Date.now(),
      };

      this.logger.info(stats, 'Retrieved stats');
      return stats;

    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get stats');
      return { filesIndexed: 0, functionsIndexed: 0, timestamp: Date.now() };
    }
  }
}

export default RedisStore;


