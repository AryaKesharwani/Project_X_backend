import winston from 'winston';
import { loggingConfig, isDevelopment, isProduction } from './env';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: loggingConfig.level,
  format: logFormat,
  defaultMeta: { service: 'lionkey-ai-backend' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (isDevelopment) {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Production logging (JSON format only)
if (isProduction) {
  logger.add(new winston.transports.Console({
    format: logFormat,
  }));
}

// Create a stream for Morgan HTTP logging
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
