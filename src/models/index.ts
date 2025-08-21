/**
 * Models Index
 * Central export point for all database models
 */

export { default as db } from './database';
export { TradingSignalModel } from './TradingSignal';
export { MarketDataModel } from './MarketData';
export { GridModel } from './Grid';

// Re-export Prisma types for convenience
export type {
  User,
  TradingSignal as PrismaTradingSignal,
  TradeExecution,
  Grid as PrismaGrid,
  Portfolio,
  PerformanceMetric,
  MarketData as PrismaMarketData,
  SystemMetric,
  AuditLog,
  RefreshToken,
} from '@prisma/client';