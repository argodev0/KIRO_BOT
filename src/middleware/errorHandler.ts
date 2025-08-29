import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { ValidationError } from 'joi';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any[];
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: string[];
  timestamp: string;
  path?: string;
  method?: string;
  requestId?: string;
  stack?: string;
}

export const errorHandler = (
  err: AppError | ValidationError | PrismaClientKnownRequestError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Internal Server Error';
  let details: string[] = [];

  // Handle different error types
  if (err instanceof ValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.details.map(detail => detail.message);
  } else if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as PrismaClientKnownRequestError;
    statusCode = 400;
    errorCode = 'DATABASE_ERROR';
    
    switch (prismaError.code) {
      case 'P2002':
        message = 'Unique constraint violation';
        details = [`Duplicate value for field: ${prismaError.meta?.target}`];
        break;
      case 'P2025':
        statusCode = 404;
        errorCode = 'NOT_FOUND';
        message = 'Record not found';
        break;
      case 'P2003':
        message = 'Foreign key constraint violation';
        break;
      default:
        message = 'Database operation failed';
    }
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if ((err as AppError).statusCode) {
    // Custom app errors
    const appError = err as AppError;
    statusCode = appError.statusCode!;
    errorCode = appError.code || 'APPLICATION_ERROR';
    message = appError.message;
    if (appError.details) {
      details = Array.isArray(appError.details) ? appError.details : [appError.details];
    }
  } else {
    // Generic errors
    message = err.message || 'Internal Server Error';
  }

  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] as string || 
                   req.headers['request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log error details with appropriate level
  const logData = {
    error: {
      name: err.name,
      message: err.message,
      code: (err as any).code,
      statusCode,
      stack: err.stack
    },
    request: {
      id: requestId,
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type'),
        'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
        'x-forwarded-for': req.get('X-Forwarded-For'),
        'x-real-ip': req.get('X-Real-IP')
      },
      ip: req.ip,
      body: req.body && Object.keys(req.body).length > 0 ? 
            sanitizeRequestBody(req.body) : undefined
    },
    timestamp: new Date().toISOString()
  };

  // Log based on severity
  if (statusCode >= 500) {
    logger.error(`Server Error ${statusCode}: ${message}`, logData);
  } else if (statusCode >= 400) {
    logger.warn(`Client Error ${statusCode}: ${message}`, logData);
  } else {
    logger.info(`Request Error ${statusCode}: ${message}`, logData);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: errorCode,
    message: statusCode === 500 && process.env.NODE_ENV === 'production' 
             ? 'Internal Server Error' 
             : message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    requestId
  };

  // Add details if present
  if (details.length > 0) {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export const createError = (
  message: string, 
  statusCode: number = 500, 
  code?: string, 
  details?: any[]
): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  error.code = code;
  error.details = details;
  return error;
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Handle 404 errors for API routes
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`, {
    request: {
      id: requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    requestId,
    suggestions: getSuggestions(req.path)
  });
};

// Rate limit error handler
export const rateLimitHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.warn(`Rate limit exceeded: ${req.method} ${req.originalUrl}`, {
    request: {
      id: requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(429).json({
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    requestId,
    retryAfter: 900 // 15 minutes
  });
};

// Validation error helper
export const validationError = (message: string, details: string[]): AppError => {
  return createError(message, 400, 'VALIDATION_ERROR', details);
};

// Authentication error helper
export const authenticationError = (message: string = 'Authentication required'): AppError => {
  return createError(message, 401, 'UNAUTHORIZED');
};

// Authorization error helper
export const authorizationError = (message: string = 'Insufficient permissions'): AppError => {
  return createError(message, 403, 'FORBIDDEN');
};

// Not found error helper
export const notFoundError = (resource: string = 'Resource'): AppError => {
  return createError(`${resource} not found`, 404, 'NOT_FOUND');
};

// Conflict error helper
export const conflictError = (message: string): AppError => {
  return createError(message, 409, 'CONFLICT');
};

// Helper functions
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'apiSecret'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function getSuggestions(path: string): string[] {
  const suggestions: string[] = [];
  
  // Common API endpoints
  const commonEndpoints = [
    '/api/v1/health',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/trading/signals',
    '/api/v1/config',
    '/api/v1/analytics',
    '/api/docs'
  ];
  
  // Find similar endpoints
  for (const endpoint of commonEndpoints) {
    if (endpoint.includes(path.split('/').pop() || '')) {
      suggestions.push(endpoint);
    }
  }
  
  return suggestions.slice(0, 3); // Limit to 3 suggestions
}