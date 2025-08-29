import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '@/config/config';
import * as os from 'os';

// Define log levels with additional production levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
  trace: 'gray',
};

winston.addColors(colors);

// Enhanced production format with structured logging
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: 'kiro-bot',
      environment: config.env,
      hostname: os.hostname(),
      pid: process.pid,
      ...info
    };

    // Add stack trace for errors
    if ((info as any).stack) {
      (logEntry as any).stack = (info as any).stack;
    }

    // Add request context if available
    if ((info as any).requestId) {
      (logEntry as any).requestId = (info as any).requestId;
    }

    if ((info as any).userId) {
      (logEntry as any).userId = (info as any).userId;
    }

    return JSON.stringify(logEntry);
  })
);

// Development format with colors and simple output
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    let message = `${info.timestamp} ${info.level}: ${info.message}`;
    
    if (info.stack) {
      message += `\n${info.stack}`;
    }
    
    if (info.requestId) {
      message += ` [RequestId: ${info.requestId}]`;
    }
    
    return message;
  })
);

// Choose format based on environment
const logFormat = process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat;

// Define transports with enhanced configuration
const transports: winston.transport[] = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' 
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  })
);

// File transports for production
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  // Error log file
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      handleExceptions: true,
      handleRejections: true,
      json: true,
      maxSize: '50m',
      maxFiles: '30d',
      auditFile: 'logs/error-audit.json',
      format: productionFormat
    })
  );
  
  // Warning log file
  transports.push(
    new DailyRotateFile({
      filename: 'logs/warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'warn',
      json: true,
      maxSize: '50m',
      maxFiles: '30d',
      auditFile: 'logs/warn-audit.json',
      format: productionFormat
    })
  );
  
  // Combined log file
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      handleExceptions: true,
      handleRejections: true,
      json: true,
      maxSize: '100m',
      maxFiles: '30d',
      auditFile: 'logs/combined-audit.json',
      format: productionFormat
    })
  );

  // Security events log
  transports.push(
    new DailyRotateFile({
      filename: 'logs/security-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      json: true,
      maxSize: '50m',
      maxFiles: '90d', // Keep security logs longer
      auditFile: 'logs/security-audit.json',
      format: productionFormat
    })
  );

  // Trading activity log
  transports.push(
    new DailyRotateFile({
      filename: 'logs/trading-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      json: true,
      maxSize: '100m',
      maxFiles: '90d', // Keep trading logs longer for audit
      auditFile: 'logs/trading-audit.json',
      format: productionFormat
    })
  );
}

// Create logger instance with enhanced configuration
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format: logFormat,
  transports,
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test',
  defaultMeta: {
    service: 'kiro-bot',
    environment: process.env.NODE_ENV || 'development',
    hostname: os.hostname(),
    pid: process.pid
  }
});

// Enhanced logging methods for specific use cases
export const securityLogger = logger.child({ category: 'security' });
export const tradingLogger = logger.child({ category: 'trading' });
export const performanceLogger = logger.child({ category: 'performance' });
export const auditLogger = logger.child({ category: 'audit' });

// Create a stream object for Morgan HTTP request logging
export const loggerStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

// Enhanced logging utility functions
export const logWithContext = (level: string, message: string, context: any = {}) => {
  logger.log(level, message, context);
};

export const logError = (error: Error, context: any = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context
  });
};

export const logSecurityEvent = (event: string, details: any = {}) => {
  securityLogger.warn(event, {
    eventType: 'security',
    timestamp: new Date().toISOString(),
    ...details
  });
};

export const logTradingActivity = (activity: string, details: any = {}) => {
  tradingLogger.info(activity, {
    eventType: 'trading',
    timestamp: new Date().toISOString(),
    ...details
  });
};

export const logPerformanceMetric = (metric: string, value: number, details: any = {}) => {
  performanceLogger.info(metric, {
    eventType: 'performance',
    metricName: metric,
    metricValue: value,
    timestamp: new Date().toISOString(),
    ...details
  });
};

export const logAuditEvent = (event: string, details: any = {}) => {
  auditLogger.info(event, {
    eventType: 'audit',
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', {
      reason: reason,
      promise: promise,
      timestamp: new Date().toISOString()
    });
  });
}