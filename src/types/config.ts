/**
 * Configuration Types and Interfaces
 * Core data structures for bot configuration and control
 */

import { RiskParameters } from './trading';
import { GridConfig } from './grid';
import { SignalFilter } from './analysis';

// Bot configuration types
export interface BotConfig {
  id?: string;
  userId?: string;
  name: string;
  description?: string;
  isActive: boolean;
  strategy: BotStrategy;
  riskManagement: RiskManagementConfig;
  signalFilters: SignalFilterConfig;
  gridConfig?: GridConfig;
  exchanges: ExchangeConfig[];
  notifications: NotificationConfig;
  createdAt?: number;
  updatedAt?: number;
}

export interface BotStrategy {
  type: StrategyType;
  parameters: StrategyParameters;
  timeframes: string[];
  symbols: string[];
  maxConcurrentTrades: number;
  tradingHours?: TradingHours;
}

export type StrategyType = 
  | 'technical_analysis' 
  | 'elliott_wave' 
  | 'fibonacci_confluence' 
  | 'grid_trading' 
  | 'multi_strategy';

export interface StrategyParameters {
  // Technical Analysis Strategy
  technicalAnalysis?: {
    indicators: {
      rsi: { enabled: boolean; period: number; overbought: number; oversold: number };
      waveTrend: { enabled: boolean; n1: number; n2: number };
      pvt: { enabled: boolean; period: number };
    };
    patterns: {
      enabled: boolean;
      minConfidence: number;
      patternTypes: string[];
    };
    confluence: {
      minFactors: number;
      requiredIndicators: string[];
    };
  };

  // Elliott Wave Strategy
  elliottWave?: {
    enabled: boolean;
    minWaveValidity: number;
    waveTargets: boolean;
    fibonacciProjections: boolean;
    invalidationRules: boolean;
  };

  // Fibonacci Strategy
  fibonacci?: {
    enabled: boolean;
    retracementLevels: number[];
    extensionLevels: number[];
    confluenceDistance: number;
    goldenRatioEmphasis: boolean;
  };

  // Grid Trading Strategy
  gridTrading?: {
    enabled: boolean;
    strategy: 'elliott_wave' | 'fibonacci' | 'standard' | 'dynamic';
    spacing: number;
    levels: number;
    dynamicAdjustment: boolean;
  };

  // Multi-Strategy
  multiStrategy?: {
    strategies: StrategyType[];
    weights: Record<StrategyType, number>;
    consensusRequired: number;
  };
}

export interface TradingHours {
  enabled: boolean;
  timezone: string;
  sessions: TradingSession[];
}

export interface TradingSession {
  name: string;
  startTime: string; // HH:MM format
  endTime: string;
  daysOfWeek: number[]; // 0-6, Sunday = 0
}

// Risk Management Configuration
export interface RiskManagementConfig extends RiskParameters {
  emergencyStop: EmergencyStopConfig;
  positionSizing: PositionSizingConfig;
  correlationLimits: CorrelationLimitsConfig;
  drawdownProtection: DrawdownProtectionConfig;
}

export interface EmergencyStopConfig {
  enabled: boolean;
  triggers: {
    maxDailyLoss: boolean;
    maxDrawdown: boolean;
    consecutiveLosses: { enabled: boolean; count: number };
    marketVolatility: { enabled: boolean; threshold: number };
  };
  actions: {
    closeAllPositions: boolean;
    pauseTrading: boolean;
    sendNotification: boolean;
  };
}

export interface PositionSizingConfig {
  method: 'fixed' | 'percentage' | 'kelly' | 'volatility_adjusted';
  baseSize: number;
  maxSize: number;
  volatilityAdjustment: boolean;
  correlationAdjustment: boolean;
}

export interface CorrelationLimitsConfig {
  enabled: boolean;
  maxCorrelatedPositions: number;
  correlationThreshold: number;
  timeframe: string;
}

export interface DrawdownProtectionConfig {
  enabled: boolean;
  maxDrawdown: number;
  reductionSteps: DrawdownStep[];
  recoveryThreshold: number;
}

export interface DrawdownStep {
  threshold: number; // Drawdown percentage
  action: 'reduce_size' | 'pause_trading' | 'close_positions';
  parameter: number; // Reduction percentage or pause duration
}

// Signal Filter Configuration
export interface SignalFilterConfig {
  confidence: ConfidenceFilter;
  technical: TechnicalFilter;
  patterns: PatternFilter;
  confluence: ConfluenceFilter;
  timeframe: TimeframeFilter;
  volume: VolumeFilter;
}

export interface ConfidenceFilter {
  enabled: boolean;
  minConfidence: number;
  maxSignalsPerHour: number;
  cooldownPeriod: number; // minutes
}

export interface TechnicalFilter {
  enabled: boolean;
  requiredIndicators: string[];
  indicatorThresholds: Record<string, number>;
  trendAlignment: boolean;
}

export interface PatternFilter {
  enabled: boolean;
  allowedPatterns: string[];
  minPatternStrength: number;
  multiTimeframeConfirmation: boolean;
}

export interface ConfluenceFilter {
  enabled: boolean;
  minConfluenceFactors: number;
  requiredFactorTypes: string[];
  confluenceWeight: number;
}

export interface TimeframeFilter {
  enabled: boolean;
  primaryTimeframe: string;
  confirmationTimeframes: string[];
  alignmentRequired: boolean;
}

export interface VolumeFilter {
  enabled: boolean;
  minVolumeRatio: number;
  volumeTrendRequired: boolean;
  unusualVolumeDetection: boolean;
}

// Exchange Configuration
export interface ExchangeConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  testnet: boolean;
  rateLimits: {
    ordersPerSecond: number;
    requestsPerMinute: number;
  };
  fees: {
    maker: number;
    taker: number;
  };
  symbols: string[];
}

// Notification Configuration
export interface NotificationConfig {
  email: EmailNotificationConfig;
  webhook: WebhookNotificationConfig;
  inApp: InAppNotificationConfig;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  address?: string;
  events: NotificationEvent[];
}

export interface WebhookNotificationConfig {
  enabled: boolean;
  url?: string;
  events: NotificationEvent[];
  headers?: Record<string, string>;
}

export interface InAppNotificationConfig {
  enabled: boolean;
  events: NotificationEvent[];
  sound: boolean;
}

export type NotificationEvent = 
  | 'signal_generated' 
  | 'trade_executed' 
  | 'position_closed' 
  | 'risk_violation' 
  | 'emergency_stop' 
  | 'grid_level_filled' 
  | 'system_error';

// Bot Control
export interface BotControlState {
  status: BotStatus;
  lastStarted?: number;
  lastStopped?: number;
  runningTime: number;
  totalTrades: number;
  activePositions: number;
  totalProfit: number;
  currentDrawdown: number;
}

export type BotStatus = 'stopped' | 'starting' | 'running' | 'pausing' | 'paused' | 'stopping' | 'error';

export interface BotControlAction {
  action: 'start' | 'stop' | 'pause' | 'resume';
  confirmation?: boolean;
  reason?: string;
}

// Configuration Backup/Restore
export interface ConfigBackup {
  id: string;
  name: string;
  description?: string;
  config: BotConfig;
  createdAt: number;
  version: string;
}

export interface ConfigValidation {
  isValid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
}

export interface ConfigError {
  field: string;
  message: string;
  code: string;
}

export interface ConfigWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Configuration Templates
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'conservative' | 'moderate' | 'aggressive' | 'custom';
  config: Partial<BotConfig>;
  tags: string[];
}

// Real-time Configuration Updates
export interface ConfigUpdateEvent {
  type: 'config_updated' | 'validation_result' | 'bot_status_changed';
  timestamp: number;
  data: any;
}

// Configuration Monitoring
export interface ConfigMonitoring {
  configId: string;
  performance: {
    signalsGenerated: number;
    tradesExecuted: number;
    winRate: number;
    totalProfit: number;
    maxDrawdown: number;
  };
  riskMetrics: {
    currentRisk: number;
    riskViolations: number;
    emergencyStops: number;
  };
  systemHealth: {
    uptime: number;
    errors: number;
    lastError?: string;
  };
}