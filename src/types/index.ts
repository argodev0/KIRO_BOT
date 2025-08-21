/**
 * Main Types Export
 * Central export point for all type definitions
 */

// Market data types
export * from './market';

// Trading types
export * from './trading';

// Analysis types
export * from './analysis';

// Analytics types
export * from './analytics';

// Grid trading types
export * from './grid';

// Common utility types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface WebSocketMessage<T = any> {
  type: string;
  channel?: string;
  data: T;
  timestamp: number;
}

// Configuration types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
}

export interface RabbitMQConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  vhost?: string;
}

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  apiSecret: string;
  sandbox?: boolean;
  rateLimits?: {
    requests: number;
    interval: number;
  };
}

// System types
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: number;
  uptime: number;
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  errorRate?: number;
  lastCheck: number;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Authentication types
export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Monitoring types
export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: number;
  service?: string;
  userId?: string;
  metadata?: Record<string, any>;
}