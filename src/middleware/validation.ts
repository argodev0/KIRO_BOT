import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '@/utils/logger';

/**
 * Enhanced validation middleware factory with better error handling
 */
export const validate = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate request body
      if (schema.body && req.body !== undefined) {
        const { error, value, warning } = schema.body.validate(req.body, { 
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true
        });
        
        if (error) {
          errors.push(...error.details.map(d => `Body.${d.path.join('.')}: ${d.message}`));
        } else {
          req.body = value; // Use validated and sanitized value
        }
        
        if (warning) {
          warnings.push(...warning.details.map(d => `Body.${d.path.join('.')}: ${d.message}`));
        }
      }

      // Validate query parameters
      if (schema.query && Object.keys(req.query).length > 0) {
        const { error, value, warning } = schema.query.validate(req.query, { 
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true
        });
        
        if (error) {
          errors.push(...error.details.map(d => `Query.${d.path.join('.')}: ${d.message}`));
        } else {
          req.query = value; // Use validated and sanitized value
        }
        
        if (warning) {
          warnings.push(...warning.details.map(d => `Query.${d.path.join('.')}: ${d.message}`));
        }
      }

      // Validate path parameters
      if (schema.params && Object.keys(req.params).length > 0) {
        const { error, value, warning } = schema.params.validate(req.params, { 
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true
        });
        
        if (error) {
          errors.push(...error.details.map(d => `Params.${d.path.join('.')}: ${d.message}`));
        } else {
          req.params = value; // Use validated and sanitized value
        }
        
        if (warning) {
          warnings.push(...warning.details.map(d => `Params.${d.path.join('.')}: ${d.message}`));
        }
      }

      // Validate headers
      if (schema.headers) {
        const { error, warning } = schema.headers.validate(req.headers, { 
          abortEarly: false,
          allowUnknown: true // Headers can have unknown fields
        });
        
        if (error) {
          errors.push(...error.details.map(d => `Headers.${d.path.join('.')}: ${d.message}`));
        }
        
        if (warning) {
          warnings.push(...warning.details.map(d => `Headers.${d.path.join('.')}: ${d.message}`));
        }
      }

      // Log warnings if present
      if (warnings.length > 0) {
        logger.warn('Validation warnings:', {
          path: req.path,
          method: req.method,
          warnings,
          requestId: req.headers['x-request-id']
        });
      }

      if (errors.length > 0) {
        const requestId = req.headers['x-request-id'] as string || 
                         `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        logger.warn('Validation failed:', {
          path: req.path,
          method: req.method,
          errors,
          requestId,
          body: sanitizeForLogging(req.body),
          query: req.query,
          params: req.params
        });

        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
          method: req.method,
          requestId
        });
        return;
      }

      next();
    } catch (validationError) {
      logger.error('Validation middleware error:', validationError);
      
      res.status(500).json({
        error: 'VALIDATION_SYSTEM_ERROR',
        message: 'Validation system error',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
      });
    }
  };
};

/**
 * Validation middleware that only validates without modifying request
 */
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return validate({ body: schema });
};

/**
 * Query parameter validation middleware
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return validate({ query: schema });
};

/**
 * Path parameter validation middleware
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return validate({ params: schema });
};

/**
 * Header validation middleware
 */
export const validateHeaders = (schema: Joi.ObjectSchema) => {
  return validate({ headers: schema });
};

// Helper function to sanitize sensitive data for logging
function sanitizeForLogging(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = { ...obj };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'apiSecret', 'passphrase'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

// Common validation schemas
export const commonSchemas = {
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // ID parameter
  id: Joi.object({
    id: Joi.string().required()
  }),

  // Date range
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  }),

  // Symbol parameter
  symbol: Joi.object({
    symbol: Joi.string().uppercase().pattern(/^[A-Z]{2,10}$/).required()
  })
};

// Authentication validation schemas
export const authSchemas = {
  register: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
        .messages({
          'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
        }),
      firstName: Joi.string().min(1).max(50).optional(),
      lastName: Joi.string().min(1).max(50).optional()
    })
  },

  login: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
      mfaCode: Joi.string().length(6).pattern(/^\d+$/).optional()
    })
  },

  refreshToken: {
    body: Joi.object({
      refreshToken: Joi.string().required()
    })
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
        .messages({
          'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
        })
    })
  },

  passwordReset: {
    body: Joi.object({
      email: Joi.string().email().required()
    })
  },

  passwordResetConfirm: {
    body: Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
    })
  }
};

// Trading validation schemas
export const tradingSchemas = {
  executeSignal: {
    body: Joi.object({
      signalId: Joi.string().required(),
      positionSize: Joi.number().positive().optional(),
      customStopLoss: Joi.number().positive().optional(),
      customTakeProfit: Joi.array().items(Joi.number().positive()).optional()
    })
  },

  placeOrder: {
    body: Joi.object({
      symbol: Joi.string().uppercase().required(),
      side: Joi.string().valid('buy', 'sell').required(),
      type: Joi.string().valid('market', 'limit', 'stop').required(),
      quantity: Joi.number().positive().required(),
      price: Joi.number().positive().when('type', {
        is: Joi.valid('limit', 'stop'),
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      stopPrice: Joi.number().positive().when('type', {
        is: 'stop',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      exchange: Joi.string().valid('binance', 'kucoin').required()
    })
  },

  cancelOrder: {
    params: Joi.object({
      orderId: Joi.string().required()
    }),
    body: Joi.object({
      exchange: Joi.string().valid('binance', 'kucoin').required()
    })
  }
};

// Grid trading validation schemas
export const gridSchemas = {
  createGrid: {
    body: Joi.object({
      symbol: Joi.string().uppercase().required(),
      strategy: Joi.string().valid('elliott-wave', 'fibonacci', 'standard', 'dynamic').required(),
      basePrice: Joi.number().positive().required(),
      spacing: Joi.number().positive().required(),
      levels: Joi.array().items(
        Joi.object({
          price: Joi.number().positive().required(),
          quantity: Joi.number().positive().required(),
          side: Joi.string().valid('buy', 'sell').required()
        })
      ).min(2).required()
    })
  },

  updateGrid: {
    params: commonSchemas.id,
    body: Joi.object({
      status: Joi.string().valid('active', 'paused', 'closed').optional(),
      levels: Joi.array().items(
        Joi.object({
          price: Joi.number().positive().required(),
          quantity: Joi.number().positive().required(),
          side: Joi.string().valid('buy', 'sell').required()
        })
      ).optional()
    })
  }
};

// Analytics validation schemas
export const analyticsSchemas = {
  getPerformance: {
    query: Joi.object({
      ...commonSchemas.pagination.describe().keys,
      ...commonSchemas.dateRange.describe().keys,
      metricType: Joi.string().optional(),
      period: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional()
    })
  },

  exportData: {
    body: Joi.object({
      type: Joi.string().valid('trades', 'signals', 'performance', 'grids').required(),
      format: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
      ...commonSchemas.dateRange.describe().keys
    })
  }
};

// User management validation schemas
export const userSchemas = {
  updateProfile: {
    body: Joi.object({
      firstName: Joi.string().min(1).max(50).optional(),
      lastName: Joi.string().min(1).max(50).optional(),
      email: Joi.string().email().optional()
    })
  },

  updateUserRole: {
    params: commonSchemas.id,
    body: Joi.object({
      role: Joi.string().valid('USER', 'ADMIN', 'SUPER_ADMIN').required()
    })
  },

  createApiKey: {
    body: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      permissions: Joi.array().items(Joi.string()).min(1).required(),
      expiresAt: Joi.date().iso().greater('now').optional()
    })
  }
};