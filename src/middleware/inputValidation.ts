import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '@/utils/logger';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

/**
 * Input validation middleware factory
 */
export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate request body
    if (schema.body && req.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `Body: ${detail.message}`));
      }
    }

    // Validate query parameters
    if (schema.query && req.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `Query: ${detail.message}`));
      }
    }

    // Validate path parameters
    if (schema.params && req.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `Params: ${detail.message}`));
      }
    }

    // Validate headers
    if (schema.headers && req.headers) {
      const { error } = schema.headers.validate(req.headers, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `Headers: ${detail.message}`));
      }
    }

    if (errors.length > 0) {
      logger.warn('Input validation failed:', { errors, path: req.path });
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: errors
      });
    }

    next();
  };
};

/**
 * SQL injection prevention middleware
 */
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
  const sqlInjectionPatterns = [
    // Basic SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\w+['"]?\s*=\s*['"]\w+['"]?)/i,
    
    // Advanced patterns
    /(\b(UNION\s+(ALL\s+)?SELECT))/i,
    /(\b(SELECT\s+.*\s+FROM\s+\w+))/i,
    /(\b(INSERT\s+INTO\s+\w+))/i,
    /(\b(UPDATE\s+\w+\s+SET))/i,
    /(\b(DELETE\s+FROM\s+\w+))/i,
    
    // Comment patterns
    /(--|\#|\/\*|\*\/)/,
    
    // Function calls
    /(\b(CONCAT|SUBSTRING|ASCII|CHAR|LOAD_FILE|INTO\s+OUTFILE))/i,
    
    // Hex and binary patterns
    /(0x[0-9a-f]+)/i,
    /(\b(BINARY|HEX|UNHEX)\b)/i,
    
    // Time-based patterns
    /(\b(SLEEP|BENCHMARK|WAITFOR\s+DELAY)\b)/i,
    
    // Information schema
    /(\b(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)\b)/i
  ];

  const checkForSQLInjection = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      return sqlInjectionPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (checkForSQLInjection(value, currentPath)) {
          logger.warn(`SQL injection attempt detected in ${currentPath}:`, value);
          return true;
        }
      }
    }
    
    return false;
  };

  // Check body, query, and params
  if (checkForSQLInjection(req.body, 'body') ||
      checkForSQLInjection(req.query, 'query') ||
      checkForSQLInjection(req.params, 'params')) {
    
    logger.warn('SQL injection attempt blocked:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid input detected'
    });
  }

  next();
};

/**
 * XSS prevention middleware
 */
export const preventXSS = (req: Request, res: Response, next: NextFunction): void => {
  const xssPatterns = [
    // Script tags
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    
    // Event handlers
    /\bon\w+\s*=\s*["'][^"']*["']/gi,
    /\bon\w+\s*=\s*[^>\s]+/gi,
    
    // JavaScript URLs
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    
    // Data URLs with scripts
    /data\s*:\s*text\/html/gi,
    
    // Style with expressions
    /style\s*=\s*["'][^"']*expression\s*\(/gi,
    
    // Meta refresh
    /<meta[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
    
    // Object and embed tags
    /<(object|embed|applet|iframe)[^>]*>/gi,
    
    // Form with external action
    /<form[^>]*action\s*=\s*["']?https?:\/\/[^"'>]+["']?[^>]*>/gi
  ];

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Check for XSS patterns
      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          logger.warn('XSS attempt detected:', value);
          throw new Error('XSS_DETECTED');
        }
      }
      
      // Basic HTML entity encoding for safety
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    return value;
  };

  try {
    // Sanitize request data
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeValue(req.params);
    }
    
    next();
  } catch (error) {
    if (error.message === 'XSS_DETECTED') {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Invalid content detected'
      });
    }
    
    logger.error('XSS prevention error:', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Request processing failed'
    });
  }
};

/**
 * Path traversal prevention middleware
 */
export const preventPathTraversal = (req: Request, res: Response, next: NextFunction): void => {
  const pathTraversalPatterns = [
    /\.\./g,
    /\.\\/g,
    /\.\/\./g,
    /%2e%2e/gi,
    /%2f/gi,
    /%5c/gi,
    /\\.\\/g,
    /\\\.\\\./g
  ];

  const checkForPathTraversal = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return pathTraversalPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (checkForPathTraversal(value)) {
          return true;
        }
      }
    }
    
    return false;
  };

  if (checkForPathTraversal(req.body) ||
      checkForPathTraversal(req.query) ||
      checkForPathTraversal(req.params) ||
      checkForPathTraversal(req.path)) {
    
    logger.warn('Path traversal attempt blocked:', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid path detected'
    });
  }

  next();
};

/**
 * Command injection prevention middleware
 */
export const preventCommandInjection = (req: Request, res: Response, next: NextFunction): void => {
  const commandInjectionPatterns = [
    // Shell metacharacters
    /[;&|`$(){}[\]]/,
    
    // Command separators
    /(\|\||&&|;|\|)/,
    
    // Redirection operators
    /(>>|<<|>|<)/,
    
    // Common commands
    /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|nslookup|dig|curl|wget|nc|telnet|ssh|ftp|scp|rsync)\b/i,
    
    // Windows commands
    /\b(dir|type|copy|del|move|ren|md|rd|cd|cls|ipconfig|tasklist|taskkill|net|sc|reg|wmic)\b/i,
    
    // Scripting
    /\b(bash|sh|cmd|powershell|python|perl|ruby|php|node)\b/i
  ];

  const checkForCommandInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return commandInjectionPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (checkForCommandInjection(value)) {
          return true;
        }
      }
    }
    
    return false;
  };

  if (checkForCommandInjection(req.body) ||
      checkForCommandInjection(req.query) ||
      checkForCommandInjection(req.params)) {
    
    logger.warn('Command injection attempt blocked:', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid input detected'
    });
  }

  next();
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),
  
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(100),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().alphanum().max(50)
  }),
  
  // Date range
  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate'))
  }),
  
  // Trading symbols
  symbol: Joi.string().pattern(/^[A-Z]{2,10}\/[A-Z]{2,10}$/).required(),
  
  // Exchange names
  exchange: Joi.string().valid('binance', 'kucoin').required(),
  
  // Amounts and prices
  amount: Joi.number().positive().precision(8).required(),
  price: Joi.number().positive().precision(8).required(),
  
  // Percentages
  percentage: Joi.number().min(0).max(100).precision(2),
  
  // API keys (basic format validation)
  apiKey: Joi.string().alphanum().min(32).max(128).required(),
  
  // Email
  email: Joi.string().email().max(255).required(),
  
  // Password (strong password requirements)
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'
    }),
  
  // IP address
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }),
  
  // User agent
  userAgent: Joi.string().max(500),
  
  // Request ID
  requestId: Joi.string().alphanum().length(16)
};

/**
 * Enhanced input sanitization middleware
 */
export const enhancedInputSanitization = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize all input recursively
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid input format'
    });
  }
};

/**
 * Advanced threat detection middleware
 */
export const advancedThreatDetection = (req: Request, res: Response, next: NextFunction): void => {
  const threats = detectAdvancedThreats(req);
  
  if (threats.length > 0) {
    logger.warn('Advanced threats detected:', {
      threats,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(400).json({
      error: 'SECURITY_VIOLATION',
      message: 'Request blocked by security system'
    });
  }
  
  next();
};

/**
 * File upload security validation
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file && !req.files) {
    return next();
  }
  
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
  
  for (const file of files) {
    if (!file) continue;
    
    // Check file size
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: 'File size exceeds 5MB limit'
      });
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/csv'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'INVALID_FILE_TYPE',
        message: 'File type not allowed'
      });
    }
    
    // Check for malicious content in filename
    if (containsMaliciousContent(file.originalname)) {
      return res.status(400).json({
        error: 'MALICIOUS_FILENAME',
        message: 'Filename contains invalid characters'
      });
    }
  }
  
  next();
};

/**
 * API key format validation
 */
export const validateApiKeyFormat = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.get('X-API-Key') || req.body?.apiKey || req.query?.apiKey;
  
  if (apiKey) {
    // Validate API key format and ensure it's read-only
    if (!isValidApiKeyFormat(apiKey)) {
      return res.status(401).json({
        error: 'INVALID_API_KEY',
        message: 'Invalid API key format'
      });
    }
    
    // Additional validation for trading permissions (should be blocked)
    if (containsTradingPermissions(apiKey)) {
      logger.error('Trading API key detected - SECURITY VIOLATION', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        error: 'TRADING_API_KEY_BLOCKED',
        message: 'Trading API keys are not allowed in paper trading mode'
      });
    }
  }
  
  next();
};

/**
 * Comprehensive input validation middleware
 */
export const comprehensiveValidation = [
  preventSQLInjection,
  preventXSS,
  preventPathTraversal,
  preventCommandInjection,
  enhancedInputSanitization,
  advancedThreatDetection,
  validateFileUpload,
  validateApiKeyFormat
];

// Helper functions
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

function sanitizeString(str: string): string {
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\0/g, '') // Remove null bytes
    .trim();
}

function detectAdvancedThreats(req: Request): string[] {
  const threats: string[] = [];
  const content = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers
  });
  
  // LDAP injection
  if (/(\(|\)|&|\||!|=|\*|<|>|~)/g.test(content)) {
    threats.push('potential_ldap_injection');
  }
  
  // NoSQL injection
  if (/(\$where|\$ne|\$gt|\$lt|\$regex|\$or|\$and)/gi.test(content)) {
    threats.push('potential_nosql_injection');
  }
  
  // XML injection
  if (/<\?xml|<!DOCTYPE|<script|<iframe/gi.test(content)) {
    threats.push('potential_xml_injection');
  }
  
  // Template injection
  if (/\{\{|\}\}|\$\{|\}|\[\[|\]\]/g.test(content)) {
    threats.push('potential_template_injection');
  }
  
  // Prototype pollution
  if (/__proto__|constructor\.prototype|prototype\./gi.test(content)) {
    threats.push('potential_prototype_pollution');
  }
  
  return threats;
}

function containsMaliciousContent(filename: string): boolean {
  const maliciousPatterns = [
    /\.\./,
    /[<>:"|?*]/,
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
    /\.(exe|bat|cmd|scr|pif|com|dll|vbs|js|jar|app)$/i
  ];
  
  return maliciousPatterns.some(pattern => pattern.test(filename));
}

function isValidApiKeyFormat(apiKey: string): boolean {
  // Basic format validation - should be alphanumeric and proper length
  return /^[a-zA-Z0-9]{32,128}$/.test(apiKey);
}

function containsTradingPermissions(apiKey: string): boolean {
  // This would integrate with exchange APIs to validate permissions
  // For now, we'll use pattern matching for common trading key indicators
  const tradingPatterns = [
    /trade/i,
    /spot/i,
    /futures/i,
    /margin/i,
    /withdraw/i
  ];
  
  return tradingPatterns.some(pattern => pattern.test(apiKey));
}