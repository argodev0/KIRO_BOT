import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '@/services/AuditLogService';
import { logger } from '@/utils/logger';

export interface AuditLoggingOptions {
  excludePaths?: string[];
  excludeMethods?: string[];
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  sensitiveFields?: string[];
}

const defaultOptions: AuditLoggingOptions = {
  excludePaths: ['/health', '/metrics', '/favicon.ico'],
  excludeMethods: ['OPTIONS'],
  logRequestBody: false,
  logResponseBody: false,
  sensitiveFields: ['password', 'token', 'secret', 'key', 'apiKey']
};

/**
 * Middleware for automatic audit logging of HTTP requests
 */
export function auditLoggingMiddleware(options: AuditLoggingOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Skip excluded paths and methods
    if (config.excludePaths?.includes(req.path) || 
        config.excludeMethods?.includes(req.method)) {
      return next();
    }

    // Generate request ID if not present
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = generateRequestId();
    }

    // Store original end function
    const originalEnd = res.end;
    let responseBody: any;

    // Override res.end to capture response
    res.end = function(chunk?: any, encoding?: any) {
      if (chunk && config.logResponseBody) {
        responseBody = chunk;
      }
      
      const duration = Date.now() - startTime;
      
      // Log the request completion
      logRequestCompletion(req, res, duration, responseBody, config);
      
      // Call original end function
      originalEnd.call(this, chunk, encoding);
    };

    // Log request start
    logRequestStart(req, config);
    
    next();
  };
}

/**
 * Log request start
 */
function logRequestStart(req: Request, config: AuditLoggingOptions) {
  try {
    const requestBody = config.logRequestBody ? sanitizeObject(req.body, config.sensitiveFields) : undefined;
    
    auditLogService.logApiAccessEvent(
      'api_request_start',
      req.path,
      req,
      true,
      0, // Status not known yet
      `${req.method} ${req.path} started`
    );

    logger.info('HTTP Request Started', {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'],
      userId: (req as any).user?.id,
      ip: req.ip,
      body: requestBody
    });
  } catch (error) {
    logger.error('Failed to log request start', { error: error.message });
  }
}

/**
 * Log request completion
 */
function logRequestCompletion(
  req: Request, 
  res: Response, 
  duration: number, 
  responseBody: any,
  config: AuditLoggingOptions
) {
  try {
    const success = res.statusCode < 400;
    const sanitizedResponseBody = config.logResponseBody ? 
      sanitizeObject(responseBody, config.sensitiveFields) : undefined;

    auditLogService.logApiAccessEvent(
      'api_request_complete',
      req.path,
      req,
      success,
      res.statusCode,
      success ? 'Request completed successfully' : 'Request failed'
    );

    // Log performance metrics
    logger.info('HTTP Request Completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId: req.headers['x-request-id'],
      userId: (req as any).user?.id,
      ip: req.ip,
      success,
      responseBody: sanitizedResponseBody,
      performance: {
        metricName: 'http_request_duration',
        metricValue: duration,
        unit: 'ms',
        endpoint: req.path,
        method: req.method
      }
    });

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow HTTP Request Detected', {
        method: req.method,
        path: req.path,
        duration,
        requestId: req.headers['x-request-id'],
        threshold: 5000
      });
    }

    // Log error responses
    if (!success) {
      logger.error('HTTP Request Failed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        requestId: req.headers['x-request-id'],
        userId: (req as any).user?.id,
        ip: req.ip
      });
    }
  } catch (error) {
    logger.error('Failed to log request completion', { error: error.message });
  }
}

/**
 * Middleware specifically for trading operations
 */
export function tradingAuditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to trading-related endpoints
    if (!req.path.includes('/api/trading') && !req.path.includes('/api/orders')) {
      return next();
    }

    const originalEnd = res.end;
    
    res.end = function(chunk?: any) {
      const success = res.statusCode < 400;
      
      // Extract trading details from request/response
      const tradingDetails = extractTradingDetails(req, chunk);
      
      if (tradingDetails) {
        auditLogService.logTradingOperation(
          getTradingAction(req.method, req.path),
          tradingDetails.symbol || 'UNKNOWN',
          tradingDetails.exchange || 'UNKNOWN',
          req,
          success,
          {
            orderType: tradingDetails.orderType,
            quantity: tradingDetails.quantity,
            price: tradingDetails.price,
            orderId: tradingDetails.orderId,
            tradeId: tradingDetails.tradeId,
            strategy: tradingDetails.strategy,
            paperTrade: tradingDetails.paperTrade !== false // Default to true for safety
          },
          success ? undefined : `Request failed with status ${res.statusCode}`
        );
      }
      
      originalEnd.call(this, chunk);
    };

    next();
  };
}

/**
 * Middleware for configuration change auditing
 */
export function configurationAuditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to configuration endpoints
    if (!req.path.includes('/api/config') && !req.path.includes('/api/settings')) {
      return next();
    }

    // Store original configuration for comparison
    (req as any).originalConfig = { ...req.body };

    const originalEnd = res.end;
    
    res.end = function(chunk?: any) {
      const success = res.statusCode < 400;
      
      if (success && (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST')) {
        const configType = getConfigurationType(req.path);
        const configKey = req.params.key || req.path.split('/').pop() || 'unknown';
        
        auditLogService.logConfigurationChange(
          configType,
          configKey,
          (req as any).originalConfig,
          req.body,
          req,
          success,
          success ? undefined : `Configuration change failed with status ${res.statusCode}`
        );
      }
      
      originalEnd.call(this, chunk);
    };

    next();
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize object by removing sensitive fields
 */
function sanitizeObject(obj: any, sensitiveFields: string[] = []): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeObject(sanitized[key], sensitiveFields);
    }
  }
  
  return sanitized;
}

/**
 * Extract trading details from request/response
 */
function extractTradingDetails(req: Request, responseBody?: any): any {
  const body = req.body || {};
  const query = req.query || {};
  
  // Try to parse response body if it's a string
  let parsedResponse;
  try {
    parsedResponse = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
  } catch {
    parsedResponse = {};
  }

  return {
    symbol: body.symbol || query.symbol || parsedResponse?.symbol,
    exchange: body.exchange || query.exchange || parsedResponse?.exchange,
    orderType: body.type || body.orderType || parsedResponse?.type,
    quantity: body.quantity || body.amount || parsedResponse?.quantity,
    price: body.price || parsedResponse?.price,
    orderId: body.orderId || parsedResponse?.orderId || parsedResponse?.id,
    tradeId: parsedResponse?.tradeId,
    strategy: body.strategy || parsedResponse?.strategy,
    paperTrade: body.paperTrade !== false && parsedResponse?.paperTrade !== false
  };
}

/**
 * Get trading action based on HTTP method and path
 */
function getTradingAction(method: string, path: string): any {
  if (path.includes('/orders')) {
    switch (method) {
      case 'POST': return 'order_create';
      case 'DELETE': return 'order_cancel';
      case 'PUT':
      case 'PATCH': return 'order_modify';
      default: return 'order_query';
    }
  }
  
  if (path.includes('/trades')) {
    return 'trade_execute';
  }
  
  if (path.includes('/signals')) {
    return 'signal_generate';
  }
  
  return 'trading_operation';
}

/**
 * Get configuration type based on path
 */
function getConfigurationType(path: string): any {
  if (path.includes('/bot')) return 'bot_settings';
  if (path.includes('/api-key')) return 'api_keys';
  if (path.includes('/trading')) return 'trading_parameters';
  if (path.includes('/security')) return 'security_settings';
  if (path.includes('/environment')) return 'environment';
  return 'bot_settings';
}