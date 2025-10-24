import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // Connection pool settings
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  },
  
  indexing: {
    ignorePatterns: (process.env.IGNORE_PATTERNS || 'node_modules,.git,dist,build,coverage').split(','),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
    supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  }
};

logger.info({ config: { ...config, redis: { url: '***' } } }, 'Configuration loaded');

export default config;


