import pino from 'pino';

/**
 * Production-grade logger with pretty printing in development
 * Uses pino for high-performance structured logging
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined
});

export default logger;


