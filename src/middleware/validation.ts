import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '@/utils/logger';

/**
 * Validation middleware factory
 */
export const validate = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate path parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(`Params: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate headers
    if (schema.headers) {
      const { error } = schema.headers.validate(req.headers);
      if (error) {
        errors.push(`Headers: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    if (errors.length > 0) {
      logger.warn('Validation failed:', {
        path: req.path,
        method: req.method,
        errors,
        body: req.body,
        query: req.query,
        params: req.params
      });

      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors
      });
      return;
    }

    next();
  };
};

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