/**
 * Hummingbot Integration Types and Interfaces
 * Core data structures for Hummingbot integration
 */

import { TradingSignal, RiskParameters } from './trading';

// Hummingbot Connection Types
export interface HBConnection {
  instanceId: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastPing: number;
  apiVersion: string;
  supportedStrategies: string[];
  endpoint: string;
  authToken?: string;
  connectionAttempts: number;
  lastError?: string;
}

export interface HBConfig {
  version: string;
  instanceSettings: InstanceSettings;
  strategyConfigs: StrategyConfig[];
  exchangeSettings: ExchangeSettings;
  riskSettings: RiskSettings;
}

export interface InstanceSettings {
  instanceId: string;
  name: string;
  description?: string;
  dockerImage: string;
  dockerTag: string;
  resources: ResourceLimits;
  networking: NetworkConfig;
  environment: Record<string, string>;
}

export interface ResourceLimits {
  memory: string; // e.g., "512Mi"
  cpu: string; // e.g., "0.5"
  storage: string; // e.g., "1Gi"
}

export interface NetworkConfig {
  port: number;
  exposedPorts: number[];
  networkMode: 'bridge' | 'host' | 'none';
  dnsServers?: string[];
}

// Hummingbot Strategy Types
export interface HBStrategy {
  id?: string;
  type: HBStrategyType;
  exchange: string;
  tradingPair: string;
  parameters: Record<string, any>;
  riskLimits: RiskLimits;
  executionSettings: ExecutionSettings;
  status?: HBStrategyStatus;
  createdAt?: number;
  updatedAt?: number;
}

export type HBStrategyType = 
  | 'pure_market_making'
  | 'cross_exchange_market_making'
  | 'arbitrage'
  | 'grid_trading'
  | 'perpetual_market_making'
  | 'liquidity_mining'
  | 'spot_perpetual_arbitrage';

export type HBStrategyStatus = 
  | 'pending'
  | 'active'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'completed'
  | 'emergency_stopped';

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  stopLossPercentage?: number;
  takeProfitPercentage?: number;
  maxOpenOrders: number;
  maxSlippage: number;
}

export interface ExecutionSettings {
  orderRefreshTime: number; // seconds
  orderRefreshTolerance: number; // percentage
  filledOrderDelay: number; // seconds
  orderOptimization: boolean;
  addTransactionCosts: boolean;
  priceSource: 'current_market' | 'external_market' | 'custom';
  leverage?: number;
  paperTradingMode?: boolean;
  simulationOnly?: boolean;
  preventRealTrades?: boolean;
}

// Strategy Configuration
export interface StrategyConfig {
  strategyName: string;
  enabled: boolean;
  parameters: StrategyParameters;
  markets: MarketConfig[];
  riskManagement: StrategyRiskConfig;
}

export interface StrategyParameters {
  bidSpread: number;
  askSpread: number;
  orderAmount: number;
  orderLevels: number;
  orderRefreshTime: number;
  maxOrderAge: number;
  inventorySkewEnabled: boolean;
  inventoryTargetBasePercent: number;
  inventoryRangeMultiplier: number;
  hangingOrdersEnabled: boolean;
  hangingOrdersCancelPct: number;
  orderOptimizationEnabled: boolean;
  askOrderOptimizationDepth: number;
  bidOrderOptimizationDepth: number;
  addTransactionCosts: boolean;
  priceType: 'mid_price' | 'last_price' | 'last_own_trade_price' | 'best_bid' | 'best_ask' | 'inventory_cost';
  takeLiquidity: boolean;
  priceSource: string;
  priceBandEnabled: boolean;
  priceCeilingPct: number;
  priceFloorPct: number;
  pingPongEnabled: boolean;
  orderRefreshTolerance: number;
  filledOrderDelay: number;
  jumpOrdersEnabled: boolean;
  jumpOrdersDepth: number;
  jumpOrdersDelay: number;
}

export interface MarketConfig {
  exchange: string;
  tradingPair: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface StrategyRiskConfig {
  killSwitchEnabled: boolean;
  killSwitchRate: number;
  maxOrderAge: number;
  maxOrderRefreshTime: number;
  orderRefreshTolerance: number;
  inventorySkewEnabled: boolean;
  inventoryTargetBasePercent: number;
  inventoryRangeMultiplier: number;
}

export interface ExchangeSettings {
  exchanges: ExchangeConfig[];
  defaultExchange: string;
}

export interface ExchangeConfig {
  name: string;
  apiKey: string; // encrypted
  apiSecret: string; // encrypted
  passphrase?: string; // encrypted
  sandbox: boolean;
  rateLimit: number;
  testnet: boolean;
}

export interface RiskSettings {
  globalRiskEnabled: boolean;
  maxTotalExposure: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  emergencyStopEnabled: boolean;
  emergencyStopLoss: number;
}

// Hummingbot Instance Management
export interface HBInstance {
  id: string;
  name: string;
  status: InstanceStatus;
  strategies: ActiveStrategy[];
  resources: ResourceUsage;
  performance: InstancePerformance;
  config: HBConfig;
  dockerContainerId?: string;
  createdAt: number;
  updatedAt: number;
  lastHealthCheck: number;
}

export type InstanceStatus = 
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'unhealthy';

export interface ActiveStrategy {
  id: string;
  strategyId: string;
  instanceId: string;
  status: HBStrategyStatus;
  startTime: number;
  endTime?: number;
  performance: StrategyPerformance;
  currentOrders: number;
  totalTrades: number;
}

export interface ResourceUsage {
  cpuUsage: number; // percentage
  memoryUsage: number; // bytes
  memoryLimit: number; // bytes
  networkIn: number; // bytes
  networkOut: number; // bytes
  diskUsage: number; // bytes
  diskLimit: number; // bytes
}

export interface InstancePerformance {
  uptime: number; // seconds
  totalStrategies: number;
  activeStrategies: number;
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  averageLatency: number; // milliseconds
  errorRate: number; // percentage
}

export interface StrategyPerformance {
  totalTrades: number;
  successfulTrades: number;
  totalVolume: number;
  totalPnL: number;
  averageLatency: number;
  averageSlippage: number;
  fillRate: number;
  currentDrawdown: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  winRate: number;
}

// Strategy Execution and Monitoring
export interface StrategyExecution {
  id: string;
  strategyType: string;
  instanceId: string;
  status: HBStrategyStatus;
  startTime: number;
  endTime?: number;
  parameters: Record<string, any>;
  performance: ExecutionPerformance;
  orders: OrderExecution[];
  trades: TradeExecution[];
  errors: ExecutionError[];
}

export interface ExecutionPerformance {
  totalTrades: number;
  successfulTrades: number;
  totalVolume: number;
  totalPnL: number;
  averageLatency: number;
  averageSlippage: number;
  fillRate: number;
  maxDrawdown: number;
  currentDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
  winRate: number;
}

export interface OrderExecution {
  orderId: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  status: 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  averagePrice?: number;
  fee?: number;
  timestamp: number;
  exchange: string;
}

export interface TradeExecution {
  tradeId: string;
  orderId: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  timestamp: number;
  exchange: string;
  pnl?: number;
}

export interface ExecutionError {
  errorId: string;
  strategyId: string;
  errorType: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolvedAt?: number;
}

// Strategy Translation
export interface StrategyTranslation {
  signalId: string;
  originalSignal: TradingSignal;
  translatedStrategy: HBStrategy;
  translationMetadata: TranslationMetadata;
  confidence: number;
  estimatedPerformance?: PerformanceEstimate;
}

export interface TranslationMetadata {
  translationType: 'elliott_wave' | 'fibonacci' | 'grid' | 'market_making' | 'arbitrage';
  signalStrength: number;
  marketConditions: MarketConditions;
  riskAssessment: RiskAssessment;
  optimizationApplied: boolean;
  backtestResults?: BacktestResults;
}

export interface MarketConditions {
  volatility: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  volume: 'high' | 'medium' | 'low';
  spread: number;
  liquidity: 'high' | 'medium' | 'low';
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  maxPotentialLoss: number;
  probabilityOfSuccess: number;
  recommendedPositionSize: number;
  stopLossRecommended: boolean;
  hedgingRecommended: boolean;
}

export interface PerformanceEstimate {
  expectedReturn: number;
  expectedVolatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
}

export interface BacktestResults {
  period: {
    start: number;
    end: number;
  };
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
}

// Monitoring and Analytics
export interface StrategyMetrics {
  strategyId: string;
  instanceId: string;
  timestamp: number;
  executionLatency: number;
  fillRate: number;
  slippage: number;
  profitLoss: number;
  riskExposure: number;
  orderBookDepth: number;
  spreadTightness: number;
  inventoryBalance: number;
  activeOrders: number;
  completedTrades: number;
  errorCount: number;
}

export interface Anomaly {
  id: string;
  strategyId: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: number;
  metrics: Record<string, number>;
  threshold: number;
  actualValue: number;
  resolved: boolean;
  resolvedAt?: number;
  actionTaken?: string;
}

export type AnomalyType = 
  | 'high_latency'
  | 'low_fill_rate'
  | 'high_slippage'
  | 'unusual_pnl'
  | 'high_error_rate'
  | 'connection_issues'
  | 'resource_exhaustion'
  | 'strategy_deviation';

export interface Alert {
  id: string;
  strategyId?: string;
  instanceId?: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, any>;
}

export type AlertType = 
  | 'strategy_stopped'
  | 'high_loss'
  | 'connection_lost'
  | 'resource_limit'
  | 'anomaly_detected'
  | 'performance_degradation'
  | 'risk_limit_exceeded'
  | 'system_error';

export interface AlertCondition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: ConditionRule[];
  actions: AlertAction[];
  cooldownPeriod: number; // seconds
  lastTriggered?: number;
}

export interface ConditionRule {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  value: number;
  timeWindow: number; // seconds
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'stop_strategy' | 'pause_instance' | 'log';
  config: Record<string, any>;
  enabled: boolean;
}

// Configuration Management
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'market_making' | 'arbitrage' | 'grid' | 'custom';
  strategyType: HBStrategyType;
  defaultParameters: Record<string, any>;
  requiredParameters: string[];
  optionalParameters: string[];
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  suitableMarkets: string[];
  minimumCapital: number;
  tags: string[];
}

export interface ConfigParams {
  templateId: string;
  customParameters: Record<string, any>;
  riskOverrides?: Partial<RiskLimits>;
  exchangeOverrides?: Partial<ExchangeConfig>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  impact: 'low' | 'medium' | 'high';
}

export interface ValidationSuggestion {
  field: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
  impact: string;
}

// Deployment and Scaling
export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  hummingbotEnabled: boolean;
  instanceCount: number;
  resourceLimits: ResourceLimits;
  scalingPolicy: ScalingPolicy;
  monitoringConfig: MonitoringConfig;
  networkConfig: NetworkConfig;
  securityConfig: SecurityConfig;
}

export interface ScalingPolicy {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  scaleUpCooldown: number; // seconds
  scaleDownCooldown: number; // seconds
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

export interface MonitoringConfig {
  metricsEnabled: boolean;
  logsEnabled: boolean;
  tracingEnabled: boolean;
  alertingEnabled: boolean;
  retentionPeriod: number; // days
  samplingRate: number; // percentage
}

export interface SecurityConfig {
  tlsEnabled: boolean;
  authenticationRequired: boolean;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  auditLoggingEnabled: boolean;
  accessControlEnabled: boolean;
  firewallRules: FirewallRule[];
}

export interface FirewallRule {
  name: string;
  direction: 'inbound' | 'outbound';
  protocol: 'tcp' | 'udp' | 'icmp';
  port?: number;
  portRange?: string;
  sourceIp?: string;
  destinationIp?: string;
  action: 'allow' | 'deny';
}

// Coordination and Load Balancing
export interface CoordinationResult {
  deployments: Deployment[];
  coordination: CoordinationPlan;
  loadBalancing: LoadBalancingConfig;
}

export interface Deployment {
  id: string;
  strategyId: string;
  instanceId: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed';
  deployedAt?: number;
  error?: string;
}

export interface CoordinationPlan {
  strategies: StrategyCoordination[];
  dependencies: StrategyDependency[];
  conflictResolution: ConflictResolution[];
}

export interface StrategyCoordination {
  strategyId: string;
  coordinationType: 'independent' | 'cooperative' | 'competitive';
  priority: number;
  resourceAllocation: ResourceAllocation;
  constraints: CoordinationConstraint[];
}

export interface StrategyDependency {
  dependentStrategy: string;
  dependsOnStrategy: string;
  dependencyType: 'sequential' | 'parallel' | 'conditional';
  condition?: string;
}

export interface ConflictResolution {
  conflictType: 'resource' | 'market' | 'risk';
  strategies: string[];
  resolution: 'priority' | 'round_robin' | 'proportional' | 'custom';
  parameters: Record<string, any>;
}

export interface ResourceAllocation {
  cpuAllocation: number; // percentage
  memoryAllocation: number; // bytes
  networkBandwidth: number; // bytes/sec
  storageAllocation: number; // bytes
  priority: number;
}

export interface CoordinationConstraint {
  type: 'resource' | 'time' | 'market' | 'risk';
  constraint: string;
  value: any;
  enforced: boolean;
}

export interface LoadBalancingConfig {
  algorithm: 'round_robin' | 'least_connections' | 'weighted' | 'resource_based';
  healthCheckEnabled: boolean;
  healthCheckInterval: number; // seconds
  failoverEnabled: boolean;
  failoverThreshold: number;
  sessionAffinity: boolean;
  weights?: Record<string, number>;
}

export interface ScalingResult {
  previousCount: number;
  targetCount: number;
  actualCount: number;
  scalingActions: ScalingAction[];
  success: boolean;
  error?: string;
}

export interface ScalingAction {
  action: 'scale_up' | 'scale_down';
  instanceId: string;
  reason: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface RebalanceResult {
  rebalancedStrategies: number;
  migratedStrategies: StrategyMigration[];
  resourceOptimization: ResourceOptimization;
  success: boolean;
  error?: string;
}

export interface StrategyMigration {
  strategyId: string;
  fromInstance: string;
  toInstance: string;
  reason: string;
  success: boolean;
  migrationTime: number;
  error?: string;
}

export interface ResourceOptimization {
  cpuOptimization: number; // percentage improvement
  memoryOptimization: number; // percentage improvement
  networkOptimization: number; // percentage improvement
  costOptimization: number; // percentage improvement
}

export interface HealthStatus {
  instanceId: string;
  status: InstanceStatus;
  uptime: number;
  lastHealthCheck: number;
  healthScore: number; // 0-100
  issues: HealthIssue[];
  metrics: HealthMetrics;
}

export interface HealthIssue {
  type: 'performance' | 'connectivity' | 'resource' | 'strategy';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface HealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  errorRate: number;
  responseTime: number;
  activeConnections: number;
  queueDepth: number;
}

// Enhanced Trading Signal Integration
export interface EnhancedTradingSignal extends TradingSignal {
  hummingbotStrategy?: HBStrategy;
  executionMethod: 'direct' | 'hummingbot' | 'hybrid';
  strategyId?: string;
  instanceId?: string;
  translationMetadata?: TranslationMetadata;
  executionPreference?: ExecutionPreference;
}

export interface ExecutionPreference {
  preferredMethod: 'direct' | 'hummingbot' | 'auto';
  fallbackMethod: 'direct' | 'hummingbot' | 'none';
  requiresApproval: boolean;
  maxLatency: number; // milliseconds
  minFillRate: number; // percentage
  maxSlippage: number; // percentage
}

// Integration Status and Health
export interface HummingbotIntegration {
  enabled: boolean;
  instances: HBInstance[];
  defaultSettings: HBDefaultSettings;
  performanceMetrics: HBPerformanceMetrics;
  lastSync: number;
  connectionPool: ConnectionPoolStatus;
  globalStatus: IntegrationStatus;
}

export interface HBDefaultSettings {
  defaultStrategyType: HBStrategyType;
  defaultRiskLimits: RiskLimits;
  defaultExecutionSettings: ExecutionSettings;
  autoScalingEnabled: boolean;
  loadBalancingEnabled: boolean;
  failoverEnabled: boolean;
  monitoringEnabled: boolean;
}

export interface HBPerformanceMetrics {
  totalInstances: number;
  activeInstances: number;
  totalStrategies: number;
  activeStrategies: number;
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  averageLatency: number;
  averageFillRate: number;
  averageSlippage: number;
  errorRate: number;
  uptime: number;
}

export interface ConnectionPoolStatus {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  failedConnections: number;
  averageResponseTime: number;
  connectionErrors: number;
  lastPoolReset: number;
}

export interface IntegrationStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastHealthCheck: number;
  healthScore: number; // 0-100
  issues: IntegrationIssue[];
  recommendations: string[];
}

export interface IntegrationIssue {
  type: 'connection' | 'performance' | 'configuration' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  resolution?: string;
}

// Additional types for HummingbotManager
export interface InstanceConfig {
  name: string;
  gatewayPort: number;
  apiKey: string;
  resources?: {
    cpu: number;
    memory: number;
  };
  environmentVariables?: string[];
}

export type LoadBalancingStrategy = 'round_robin' | 'least_loaded' | 'resource_based';

export type RecoveryAction = 'restart_container' | 'restart_gateway' | 'scale_up' | 'recreate_instance';

// Safety and Emergency Shutdown Types
export interface SafetyViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  strategyId?: string;
  instanceId?: string;
  metadata?: Record<string, any>;
}

export interface EmergencyShutdownReason {
  type: 'risk_violation' | 'system_error' | 'manual' | 'security_breach';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface EmergencyShutdownPlan {
  id: string;
  reason: EmergencyShutdownReason;
  steps: ShutdownStep[];
  createdAt: number;
  estimatedDuration: number;
}

export interface ShutdownStep {
  id: string;
  name: string;
  description: string;
  priority: number;
  timeout: number;
  retryable: boolean;
  critical: boolean;
}

export interface ShutdownStepResult {
  stepId: string;
  stepName: string;
  success: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  attempts: number;
  error?: string;
}

export interface EmergencyShutdownResult {
  success: boolean;
  reason: EmergencyShutdownReason;
  startTime: number;
  endTime: number;
  duration: number;
  steps: ShutdownStepResult[];
  errors: string[];
}

export interface RiskLimitViolation {
  type: string;
  message: string;
  currentValue: number;
  maxAllowed: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Paper Trading Integration Types
export interface SimulatedOrder {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  status: 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'error';
  createdAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
  filledQuantity?: number;
  filledPrice?: number;
  isPaperTrade: boolean;
  simulationMetadata: {
    expectedLatency: number;
    expectedSlippage: number;
    fillProbability: number;
  };
  error?: string;
}

export interface SimulatedTrade {
  id: string;
  orderId: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  executedAt: Date;
  isPaperTrade: boolean;
  simulationMetadata: {
    slippage: number;
    latency: number;
    marketImpact: number;
  };
}

export interface PaperTradingConfig {
  enabled?: boolean;
  virtualBalance?: Record<string, number>;
  simulationMode?: 'full' | 'strategy_only' | 'execution_only';
  riskLimits?: {
    maxPositionSize?: number;
    maxDailyVolume?: number;
    maxConcurrentStrategies?: number;
    maxSimulatedPositionSize?: number;
    maxDailySimulatedVolume?: number;
  };
}

export interface HummingbotSimulationResult {
  executionId: string;
  simulationType: 'full' | 'strategy_only' | 'execution_only';
  success: boolean;
  duration: number;
  steps: any[];
  finalPerformance: ExecutionPerformance;
  virtualBalanceChanges: Record<string, number>;
  riskMetrics: any;
}

// Failover and Recovery Types
export interface FailoverConfig {
  initialBackoffMs: number;
  maxBackoffMs: number;
  maxRetryAttempts: number;
  healthCheckIntervalMs: number;
}

export interface RecoveryState {
  isRecovering: boolean;
  failedConnections: Set<string>;
  recoveryAttempts: Map<string, number>;
  lastRecoveryTime: number;
}

export interface ConnectionHealth {
  instanceId: string;
  isHealthy: boolean;
  lastPing: number;
  responseTime: number;
  errorCount: number;
  lastError: Error | null;
}

export interface StrategyState {
  id: string;
  status: string;
  parameters: Record<string, any>;
  performance: ExecutionPerformance;
  startTime: number;
  endTime?: number;
  lastUpdate: number;
  version: number;
}

// Connection Recovery Types
export interface ConnectionRecoveryConfig {
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  maxRetryAttempts: number;
  connectionTimeoutMs: number;
  jitterMs: number;
  maxPingAge: number;
}

export interface RecoveryAttempt {
  instanceId: string;
  startTime: number;
  attemptCount: number;
  maxAttempts: number;
  currentBackoff: number;
  lastError: Error | null;
}

export type ConnectionState = 'connected' | 'disconnected' | 'recovering' | 'failed' | 'stopped' | 'unknown';

// State Synchronization Types
export interface SynchronizationConfig {
  periodicSyncIntervalMs: number;
  pnlToleranceThreshold: number;
  tradeCountToleranceThreshold: number;
  timestampToleranceMs: number;
  parameterToleranceThreshold: number;
}

export interface StateInconsistency {
  type: 'status_mismatch' | 'pnl_mismatch' | 'trade_count_mismatch' | 'parameter_mismatch' | 'parameter_missing' | 'parameter_extra' | 'timestamp_mismatch';
  strategyId: string;
  localValue: any;
  remoteValue: any;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface SynchronizationResult {
  success: boolean;
  syncTime: number;
  strategiesSynced: number;
  inconsistenciesFound: number;
  inconsistenciesResolved: number;
  error?: Error;
  details: Array<{
    strategyId: string;
    success: boolean;
    inconsistencies: StateInconsistency[];
    error?: Error;
  }>;
}

// Data Consistency Types
export interface DataConsistencyConfig {
  periodicCheckIntervalMs: number;
  autoCorrect: boolean;
}

export interface DataInconsistency {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedData: string;
  detectedAt: number;
  expectedValue?: any;
  actualValue?: any;
}

export interface ConsistencyCheckResult {
  success: boolean;
  checkTime: number;
  strategiesChecked: number;
  inconsistenciesFound: number;
  inconsistenciesResolved: number;
  error?: Error;
  details: Array<{
    strategyId: string;
    isConsistent: boolean;
    inconsistencies: DataInconsistency[];
    checkTime: number;
    correctionApplied: boolean;
  }>;
}

export interface ConsistencyMetrics {
  totalChecks: number;
  inconsistenciesFound: number;
  inconsistenciesResolved: number;
  averageCheckTime: number;
  lastCheckTime: number;
}

// Multi-Exchange Coordination Types
export interface ArbitrageOpportunity {
  id: string;
  pair: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profitPercent: number;
  estimatedProfit: number;
  detectedAt: number;
  status: 'detected' | 'executing' | 'executed' | 'expired' | 'failed';
  volume?: number;
  minOrderSize?: number;
  maxOrderSize?: number;
  executionWindow?: number; // milliseconds
}

export interface ExchangeStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  lastPing: number;
  latency: number;
  errorCount: number;
  lastError?: string;
  supportedPairs?: string[];
  tradingFees?: Record<string, number>;
  withdrawalFees?: Record<string, number>;
  minOrderSizes?: Record<string, number>;
  maxOrderSizes?: Record<string, number>;
}

export interface PortfolioBalance {
  exchange: string;
  assets: Record<string, {
    amount: number;
    value: number;
    locked: number;
    available: number;
  }>;
  totalValue: number;
  lastUpdated: number;
}

export interface MultiExchangeConfig {
  arbitrage: ArbitrageDetectionConfig;
  failover: ExchangeFailoverConfig;
  rebalancing: PortfolioRebalancingConfig;
  coordination: StrategyCoordinationConfig;
}

export interface ArbitrageDetectionConfig {
  minProfitThreshold: number; // percentage
  maxLatencyMs: number;
  supportedPairs: string[];
  exchanges: string[];
  maxOrderSize: number;
  minOrderSize: number;
  executionTimeoutMs: number;
  priceUpdateIntervalMs: number;
}

export interface ExchangeFailoverConfig {
  primaryExchange: string;
  fallbackExchanges: string[];
  healthCheckIntervalMs: number;
  failoverThresholdMs: number;
  maxFailoverAttempts: number;
  failoverCooldownMs: number;
  autoRecoveryEnabled: boolean;
  recoveryCheckIntervalMs: number;
}

export interface PortfolioRebalancingConfig {
  enabled: boolean;
  rebalanceIntervalMs: number;
  rebalanceThreshold: number; // percentage deviation
  maxRebalanceAmount: number;
  minRebalanceAmount: number;
  targetAllocations: Record<string, number>; // asset -> percentage
  rebalancingStrategy: 'proportional' | 'threshold' | 'momentum';
}

export interface StrategyCoordinationConfig {
  maxConcurrentStrategies: number;
  strategyPriorities: Record<string, number>;
  conflictResolution: 'priority' | 'round_robin' | 'resource_based';
  resourceAllocation: {
    maxCpuPerStrategy: number;
    maxMemoryPerStrategy: number;
    maxNetworkPerStrategy: number;
  };
}

export interface CrossExchangeArbitrageStrategy {
  id: string;
  opportunity: ArbitrageOpportunity;
  buyStrategy: HBStrategy;
  sellStrategy: HBStrategy;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
  executionPlan: ArbitrageExecutionPlan;
  performance: ArbitragePerformance;
  createdAt: number;
  updatedAt: number;
}

export interface ArbitrageExecutionPlan {
  steps: ArbitrageStep[];
  estimatedDuration: number;
  riskAssessment: ArbitrageRiskAssessment;
  contingencyPlans: ContingencyPlan[];
}

export interface ArbitrageStep {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'wait';
  exchange: string;
  pair?: string;
  amount: number;
  price?: number;
  timeout: number;
  dependencies: string[];
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface ArbitrageRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  maxPotentialLoss: number;
  probabilityOfSuccess: number;
  liquidityRisk: number;
  latencyRisk: number;
  priceMovementRisk: number;
}

export interface ContingencyPlan {
  trigger: string;
  actions: string[];
  priority: number;
}

export interface ArbitragePerformance {
  actualProfit: number;
  expectedProfit: number;
  profitEfficiency: number; // actual/expected
  executionTime: number;
  slippage: number;
  fees: number;
  netProfit: number;
  roi: number;
}

export interface StrategyAdjustment {
  parameter: string;
  oldValue: any;
  newValue: any;
  reason: string;
  confidence: number;
  expectedImpact: string;
}

export interface MarketConditionIndicator {
  name: string;
  value: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  trend: 'increasing' | 'decreasing' | 'stable';
  lastUpdated: number;
}

export interface ExchangeFailoverEvent {
  id: string;
  failedExchange: string;
  fallbackExchange?: string;
  affectedStrategies: string[];
  reason: string;
  timestamp: number;
  recoveryTime?: number;
  success: boolean;
  error?: string;
}

export interface PortfolioRebalancingEvent {
  id: string;
  timestamp: number;
  targetAllocations: Record<string, number>;
  actualAllocations: Record<string, number>;
  trades: RebalancingTrade[];
  totalCost: number;
  success: boolean;
  error?: string;
}

export interface RebalancingTrade {
  exchange: string;
  pair: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  cost: number;
  executed: boolean;
  executedAt?: number;
  error?: string;
}

export interface MultiExchangeMetrics {
  totalExchanges: number;
  healthyExchanges: number;
  totalArbitrageOpportunities: number;
  executedArbitrages: number;
  totalArbitrageProfit: number;
  averageArbitrageProfit: number;
  failoverEvents: number;
  rebalancingEvents: number;
  crossExchangeVolume: number;
  averageExecutionLatency: number;
  successRate: number;
}

export interface ExchangeCoordinationStatus {
  primaryExchange: ExchangeStatus;
  fallbackExchanges: ExchangeStatus[];
  activeArbitrages: number;
  pendingRebalancing: boolean;
  lastCoordinationUpdate: number;
  coordinationHealth: 'healthy' | 'degraded' | 'failed';
}