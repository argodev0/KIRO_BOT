/**
 * Analytics Validation Schemas
 * Validation rules for analytics API endpoints
 */

import Joi from 'joi';

const periodSchema = Joi.string().valid(
  'daily',
  'weekly', 
  'monthly',
  'quarterly',
  'yearly',
  'all_time',
  'custom'
).default('monthly');

const dateSchema = Joi.date().iso();

const chartTypeSchema = Joi.string().valid(
  'line',
  'bar',
  'pie',
  'doughnut',
  'scatter',
  'area',
  'candlestick',
  'heatmap'
).default('line');

const reportTypeSchema = Joi.string().valid(
  'performance_summary',
  'pattern_analysis',
  'elliott_wave_analysis',
  'fibonacci_analysis',
  'grid_analysis',
  'risk_analysis',
  'portfolio_analysis'
).required();

const formatSchema = Joi.string().valid('json', 'pdf', 'csv').default('json');

export const analyticsValidation = {
  /**
   * Validation for getting performance analytics
   */
  getPerformanceAnalytics: {
    query: Joi.object({
      period: periodSchema,
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    }).custom((value, helpers) => {
      if (value.period === 'custom') {
        if (!value.startDate || !value.endDate) {
          return helpers.error('any.required', { 
            message: 'startDate and endDate are required when period is custom' 
          });
        }
        if (new Date(value.startDate) >= new Date(value.endDate)) {
          return helpers.error('any.invalid', { 
            message: 'startDate must be before endDate' 
          });
        }
      }
      return value;
    })
  },

  /**
   * Validation for getting pattern analytics
   */
  getPatternAnalytics: {
    query: Joi.object({
      period: periodSchema,
      patternType: Joi.string().optional(),
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    })
  },

  /**
   * Validation for getting Elliott Wave analytics
   */
  getElliottWaveAnalytics: {
    query: Joi.object({
      period: periodSchema,
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    })
  },

  /**
   * Validation for getting Fibonacci analytics
   */
  getFibonacciAnalytics: {
    query: Joi.object({
      period: periodSchema,
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    })
  },

  /**
   * Validation for getting grid analytics
   */
  getGridAnalytics: {
    query: Joi.object({
      period: periodSchema,
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    })
  },

  /**
   * Validation for getting portfolio performance
   */
  getPortfolioPerformance: {
    query: Joi.object({
      period: periodSchema,
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    })
  },

  /**
   * Validation for getting performance charts
   */
  getPerformanceCharts: {
    query: Joi.object({
      chartType: chartTypeSchema,
      period: periodSchema,
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    })
  },

  /**
   * Validation for getting trade execution analytics
   */
  getTradeExecutionAnalytics: {
    query: Joi.object({
      symbol: Joi.string().uppercase().optional(),
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
      limit: Joi.number().integer().min(1).max(1000).default(100),
      offset: Joi.number().integer().min(0).default(0)
    }).custom((value, helpers) => {
      if (value.startDate && value.endDate) {
        if (new Date(value.startDate) >= new Date(value.endDate)) {
          return helpers.error('any.invalid', { 
            message: 'startDate must be before endDate' 
          });
        }
      }
      return value;
    })
  },

  /**
   * Validation for getting risk metrics
   */
  getRiskMetrics: {
    query: Joi.object({
      period: periodSchema,
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    })
  },

  /**
   * Validation for getting performance comparison
   */
  getPerformanceComparison: {
    query: Joi.object({
      comparePeriods: Joi.alternatives().try(
        Joi.array().items(Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
        Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly')
      ).default(['monthly', 'quarterly']),
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional()
    })
  },

  /**
   * Validation for generating reports
   */
  generateReport: {
    body: Joi.object({
      reportType: reportTypeSchema,
      period: periodSchema,
      format: formatSchema,
      startDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      endDate: dateSchema.when('period', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    }).custom((value, helpers) => {
      if (value.period === 'custom') {
        if (!value.startDate || !value.endDate) {
          return helpers.error('any.required', { 
            message: 'startDate and endDate are required when period is custom' 
          });
        }
        if (new Date(value.startDate) >= new Date(value.endDate)) {
          return helpers.error('any.invalid', { 
            message: 'startDate must be before endDate' 
          });
        }
      }
      return value;
    })
  },

  /**
   * Validation for analytics filters
   */
  analyticsFilters: {
    query: Joi.object({
      symbol: Joi.string().uppercase().optional(),
      patternType: Joi.string().optional(),
      minConfidence: Joi.number().min(0).max(100).optional(),
      maxConfidence: Joi.number().min(0).max(100).optional(),
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
      limit: Joi.number().integer().min(1).max(1000).default(100),
      offset: Joi.number().integer().min(0).default(0),
      sortBy: Joi.string().valid(
        'timestamp',
        'symbol',
        'confidence',
        'return',
        'pnl'
      ).default('timestamp'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    }).custom((value, helpers) => {
      if (value.minConfidence && value.maxConfidence) {
        if (value.minConfidence >= value.maxConfidence) {
          return helpers.error('any.invalid', { 
            message: 'minConfidence must be less than maxConfidence' 
          });
        }
      }
      if (value.startDate && value.endDate) {
        if (new Date(value.startDate) >= new Date(value.endDate)) {
          return helpers.error('any.invalid', { 
            message: 'startDate must be before endDate' 
          });
        }
      }
      return value;
    })
  },

  /**
   * Validation for performance metrics calculation
   */
  calculateMetrics: {
    body: Joi.object({
      trades: Joi.array().items(
        Joi.object({
          entryPrice: Joi.number().positive().required(),
          exitPrice: Joi.number().positive().optional(),
          quantity: Joi.number().positive().required(),
          side: Joi.string().valid('BUY', 'SELL').required(),
          entryTime: dateSchema.required(),
          exitTime: dateSchema.optional(),
          realizedPnl: Joi.number().optional(),
          fees: Joi.number().min(0).optional()
        })
      ).min(1).required(),
      riskFreeRate: Joi.number().min(0).max(1).default(0.02),
      benchmarkReturns: Joi.array().items(Joi.number()).optional()
    })
  },

  /**
   * Validation for custom analytics queries
   */
  customAnalytics: {
    body: Joi.object({
      metrics: Joi.array().items(
        Joi.string().valid(
          'total_return',
          'win_rate',
          'sharpe_ratio',
          'sortino_ratio',
          'max_drawdown',
          'calmar_ratio',
          'profit_factor',
          'average_trade',
          'volatility',
          'beta'
        )
      ).min(1).required(),
      groupBy: Joi.string().valid(
        'symbol',
        'pattern',
        'strategy',
        'timeframe',
        'day_of_week',
        'hour_of_day'
      ).optional(),
      filters: Joi.object({
        symbols: Joi.array().items(Joi.string().uppercase()).optional(),
        patterns: Joi.array().items(Joi.string()).optional(),
        strategies: Joi.array().items(Joi.string()).optional(),
        minConfidence: Joi.number().min(0).max(100).optional(),
        maxConfidence: Joi.number().min(0).max(100).optional(),
        startDate: dateSchema.optional(),
        endDate: dateSchema.optional()
      }).optional()
    })
  }
};

/**
 * Common validation helpers
 */
export const analyticsHelpers = {
  /**
   * Validate date range
   */
  validateDateRange: (startDate: string, endDate: string): boolean => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start < end && start <= new Date() && end <= new Date();
  },

  /**
   * Validate confidence range
   */
  validateConfidenceRange: (min?: number, max?: number): boolean => {
    if (min === undefined && max === undefined) return true;
    if (min !== undefined && (min < 0 || min > 100)) return false;
    if (max !== undefined && (max < 0 || max > 100)) return false;
    if (min !== undefined && max !== undefined && min >= max) return false;
    return true;
  },

  /**
   * Validate pagination parameters
   */
  validatePagination: (limit: number, offset: number): boolean => {
    return limit > 0 && limit <= 1000 && offset >= 0;
  },

  /**
   * Sanitize symbol input
   */
  sanitizeSymbol: (symbol: string): string => {
    return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  },

  /**
   * Validate period with custom dates
   */
  validatePeriodWithDates: (period: string, startDate?: string, endDate?: string): boolean => {
    if (period === 'custom') {
      return startDate !== undefined && endDate !== undefined;
    }
    return true;
  }
};