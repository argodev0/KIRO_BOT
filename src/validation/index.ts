/**
 * Validation Index
 * Central export point for all validation schemas and functions
 */

// Market data validation
export * from './market.validation';

// Trading validation
export * from './trading.validation';

// Analysis validation
export * from './analysis.validation';

// Grid trading validation
export * from './grid.validation';

// Common validation schemas
import Joi from 'joi';

// API response validation
export const apiResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.any().optional(),
  error: Joi.string().optional(),
  message: Joi.string().optional(),
  timestamp: Joi.number().integer().positive().required()
});

export const paginatedResponseSchema = Joi.object({
  data: Joi.array().required(),
  total: Joi.number().integer().min(0).required(),
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(1000).required(),
  hasNext: Joi.boolean().required(),
  hasPrev: Joi.boolean().required()
});

export const webSocketMessageSchema = Joi.object({
  type: Joi.string().required().min(1).max(50),
  channel: Joi.string().optional().min(1).max(100),
  data: Joi.any().required(),
  timestamp: Joi.number().integer().positive().required()
});

// Configuration validation
export const databaseConfigSchema = Joi.object({
  host: Joi.string().required().min(1).max(255),
  port: Joi.number().integer().min(1).max(65535).required(),
  database: Joi.string().required().min(1).max(100),
  username: Joi.string().required().min(1).max(100),
  password: Joi.string().required().min(1),
  ssl: Joi.boolean().optional(),
  maxConnections: Joi.number().integer().min(1).max(1000).optional()
});

export const redisConfigSchema = Joi.object({
  host: Joi.string().required().min(1).max(255),
  port: Joi.number().integer().min(1).max(65535).required(),
  password: Joi.string().optional().min(1),
  database: Joi.number().integer().min(0).max(15).optional(),
  keyPrefix: Joi.string().optional().max(50)
});

export const rabbitMQConfigSchema = Joi.object({
  host: Joi.string().required().min(1).max(255),
  port: Joi.number().integer().min(1).max(65535).required(),
  username: Joi.string().required().min(1).max(100),
  password: Joi.string().required().min(1),
  vhost: Joi.string().optional().max(100)
});

export const exchangeConfigSchema = Joi.object({
  name: Joi.string().required().min(2).max(50),
  apiKey: Joi.string().required().min(10),
  apiSecret: Joi.string().required().min(10),
  sandbox: Joi.boolean().optional(),
  rateLimits: Joi.object({
    requests: Joi.number().integer().min(1).required(),
    interval: Joi.number().integer().min(1000).required()
  }).optional()
});

// System validation
export const systemHealthSchema = Joi.object({
  status: Joi.string().required().valid('healthy', 'degraded', 'unhealthy'),
  services: Joi.array().items(Joi.object({
    name: Joi.string().required().min(1).max(100),
    status: Joi.string().required().valid('up', 'down', 'degraded'),
    latency: Joi.number().min(0).optional(),
    errorRate: Joi.number().min(0).max(1).optional(),
    lastCheck: Joi.number().integer().positive().required()
  })).required(),
  timestamp: Joi.number().integer().positive().required(),
  uptime: Joi.number().min(0).required()
});

export const appErrorSchema = Joi.object({
  code: Joi.string().required().min(1).max(100),
  message: Joi.string().required().min(1).max(1000),
  details: Joi.any().optional(),
  timestamp: Joi.number().integer().positive().required(),
  stack: Joi.string().optional()
});

export const validationErrorSchema = Joi.object({
  field: Joi.string().required().min(1).max(100),
  message: Joi.string().required().min(1).max(500),
  value: Joi.any().optional()
});

// Authentication validation
export const authUserSchema = Joi.object({
  id: Joi.string().required(),
  email: Joi.string().email().required(),
  role: Joi.string().required().valid('user', 'admin', 'super_admin'),
  isActive: Joi.boolean().required(),
  isVerified: Joi.boolean().required(),
  lastLoginAt: Joi.number().integer().positive().optional()
});

export const jwtPayloadSchema = Joi.object({
  userId: Joi.string().required(),
  email: Joi.string().email().required(),
  role: Joi.string().required(),
  iat: Joi.number().integer().positive().required(),
  exp: Joi.number().integer().positive().required()
});

// Monitoring validation
export const metricDataSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  value: Joi.number().required(),
  labels: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  timestamp: Joi.number().integer().positive().required()
});

export const logEntrySchema = Joi.object({
  level: Joi.string().required().valid('error', 'warn', 'info', 'debug'),
  message: Joi.string().required().min(1).max(10000),
  timestamp: Joi.number().integer().positive().required(),
  service: Joi.string().optional().max(100),
  userId: Joi.string().optional(),
  metadata: Joi.object().optional()
});

// Common validation functions
export const validateApiResponse = (data: any) => {
  return apiResponseSchema.validate(data);
};

export const validatePaginatedResponse = (data: any) => {
  return paginatedResponseSchema.validate(data);
};

export const validateWebSocketMessage = (data: any) => {
  return webSocketMessageSchema.validate(data);
};

export const validateDatabaseConfig = (data: any) => {
  return databaseConfigSchema.validate(data);
};

export const validateRedisConfig = (data: any) => {
  return redisConfigSchema.validate(data);
};

export const validateRabbitMQConfig = (data: any) => {
  return rabbitMQConfigSchema.validate(data);
};

export const validateExchangeConfig = (data: any) => {
  return exchangeConfigSchema.validate(data);
};

export const validateSystemHealth = (data: any) => {
  return systemHealthSchema.validate(data);
};

export const validateAppError = (data: any) => {
  return appErrorSchema.validate(data);
};

export const validateValidationError = (data: any) => {
  return validationErrorSchema.validate(data);
};

export const validateAuthUser = (data: any) => {
  return authUserSchema.validate(data);
};

export const validateJWTPayload = (data: any) => {
  return jwtPayloadSchema.validate(data);
};

export const validateMetricData = (data: any) => {
  return metricDataSchema.validate(data);
};

export const validateLogEntry = (data: any) => {
  return logEntrySchema.validate(data);
};