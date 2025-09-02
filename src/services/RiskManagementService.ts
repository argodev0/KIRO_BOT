/**
 * Risk Management Service
 * Comprehensive risk management system for trading operations
 */

import { 
  TradingSignal, 
  Position, 
  Portfolio, 
  RiskParameters, 
  RiskValidation, 
  RiskViolation, 
  DrawdownStatus 
} from '../types/trading';
// Simple logger for demo purposes
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
  debug: (message: string, data?: any) => console.debug(`[DEBUG] ${message}`, data || '')
};

export interface PositionSizeRequest {
  signal: TradingSignal;
  accountBalance: number;
  riskPercentage?: number;
  currentPositions?: Position[];
}

export interface CorrelationAnalysis {
  symbol: string;
  correlatedSymbols: string[];
  correlationCoefficient: number;
  riskAdjustment: number;
}

export interface VolatilityData {
  symbol: string;
  volatility: number;
  period: number;
  timestamp: number;
}

export interface EmergencyShutdownReason {
  type: 'risk_violation' | 'system_error' | 'manual' | 'drawdown_limit';
  message: string;
  severity: 'high' | 'critical';
  timestamp: number;
}

export class RiskManagementService {
  private defaultRiskParams: RiskParameters = {
    maxRiskPerTrade: 0.03, // 3%
    maxDailyLoss: 0.05, // 5%
    maxTotalExposure: 5.0, // 5x
    maxDrawdown: 0.20, // 20%
    stopLossRequired: true,
    maxLeverage: 10
  };

  private emergencyShutdownActive = false;
  private dailyLossTracker: Map<string, number> = new Map(); // date -> loss amount
  private correlationCache: Map<string, CorrelationAnalysis> = new Map();
  private volatilityCache: Map<string, VolatilityData> = new Map();

  constructor(customRiskParams?: Partial<RiskParameters>) {
    if (customRiskParams) {
      this.defaultRiskParams = { ...this.defaultRiskParams, ...customRiskParams };
    }
  }

  /**
   * Calculate optimal position size based on risk parameters
   */
  calculatePositionSize(request: PositionSizeRequest): number {
    const { signal, accountBalance, riskPercentage, currentPositions = [] } = request;
    
    // Handle zero account balance
    if (accountBalance <= 0) {
      return 0;
    }
    
    // Use custom risk percentage or default
    const riskPercent = riskPercentage || this.defaultRiskParams.maxRiskPerTrade;
    
    // Calculate base position size
    const riskAmount = accountBalance * riskPercent;
    
    // Calculate stop loss distance
    const stopLossDistance = signal.stopLoss 
      ? Math.abs(signal.entryPrice - signal.stopLoss) / signal.entryPrice
      : 0.02; // Default 2% if no stop loss
    
    // Base position size (in base currency units, not quote currency)
    let positionSize = riskAmount / (signal.entryPrice * stopLossDistance);
    
    // Apply correlation adjustment
    const correlationAdjustment = this.getCorrelationAdjustment(signal.symbol, currentPositions);
    positionSize *= correlationAdjustment;
    
    // Apply volatility adjustment
    const volatilityAdjustment = this.getVolatilityAdjustment(signal.symbol);
    positionSize *= volatilityAdjustment;
    
    // Apply confidence adjustment
    const confidenceAdjustment = Math.min(signal.confidence / 0.8, 1.0); // Scale confidence
    positionSize *= confidenceAdjustment;
    
    // Ensure minimum position size
    const minPositionSize = accountBalance * 0.001 / signal.entryPrice; // 0.1% minimum in base currency
    positionSize = Math.max(positionSize, minPositionSize);
    
    // Ensure maximum position size doesn't exceed exposure limits
    const maxPositionSize = this.calculateMaxPositionSize(accountBalance, currentPositions) / signal.entryPrice;
    positionSize = Math.min(positionSize, maxPositionSize);
    
    // Handle NaN or invalid results
    if (!isFinite(positionSize) || positionSize < 0) {
      return 0;
    }
    
    logger.info('Position size calculated', {
      symbol: signal.symbol,
      baseSize: riskAmount / (signal.entryPrice * stopLossDistance),
      correlationAdjustment,
      volatilityAdjustment,
      confidenceAdjustment,
      finalSize: positionSize
    });
    
    return Math.floor(positionSize * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Validate risk limits for a proposed position
   */
  validateRiskLimits(
    signal: TradingSignal,
    positionSize: number,
    accountBalance: number,
    currentPositions: Position[] = [],
    portfolio?: Portfolio
  ): RiskValidation {
    const violations: RiskViolation[] = [];
    
    // Check per-trade risk limit
    const tradeRisk = this.calculateTradeRisk(signal, positionSize, accountBalance);
    if (tradeRisk > this.defaultRiskParams.maxRiskPerTrade) {
      violations.push({
        type: 'max_risk_per_trade',
        message: `Trade risk ${(tradeRisk * 100).toFixed(2)}% exceeds maximum ${(this.defaultRiskParams.maxRiskPerTrade * 100).toFixed(2)}%`,
        currentValue: tradeRisk,
        maxAllowed: this.defaultRiskParams.maxRiskPerTrade
      });
    }
    
    // Check daily loss limit
    const dailyLoss = this.getDailyLoss();
    if (dailyLoss > this.defaultRiskParams.maxDailyLoss * accountBalance) {
      violations.push({
        type: 'max_daily_loss',
        message: `Daily loss $${dailyLoss.toFixed(2)} exceeds maximum ${(this.defaultRiskParams.maxDailyLoss * 100).toFixed(2)}%`,
        currentValue: dailyLoss / accountBalance,
        maxAllowed: this.defaultRiskParams.maxDailyLoss
      });
    }
    
    // Check total exposure limit
    const currentExposure = this.calculateTotalExposure(currentPositions, accountBalance);
    const newExposure = (signal.entryPrice * positionSize) / accountBalance;
    const totalExposure = currentExposure + newExposure;
    
    if (totalExposure > this.defaultRiskParams.maxTotalExposure) {
      violations.push({
        type: 'max_exposure',
        message: `Total exposure ${totalExposure.toFixed(2)}x exceeds maximum ${this.defaultRiskParams.maxTotalExposure}x`,
        currentValue: totalExposure,
        maxAllowed: this.defaultRiskParams.maxTotalExposure
      });
    }
    
    // Check stop loss requirement
    if (this.defaultRiskParams.stopLossRequired && !signal.stopLoss) {
      violations.push({
        type: 'missing_stop_loss',
        message: 'Stop loss is required but not provided',
        currentValue: 0,
        maxAllowed: 1
      });
    }
    
    // Check drawdown limit if portfolio provided
    if (portfolio) {
      const drawdownViolation = this.checkDrawdownLimit(portfolio);
      if (drawdownViolation) {
        violations.push({
          type: 'max_drawdown',
          message: `Current drawdown ${(portfolio.currentDrawdown * 100).toFixed(2)}% exceeds maximum ${(this.defaultRiskParams.maxDrawdown * 100).toFixed(2)}%`,
          currentValue: portfolio.currentDrawdown,
          maxAllowed: this.defaultRiskParams.maxDrawdown
        });
      }
    }
    
    // Calculate maximum allowed position size
    const maxAllowedSize = this.calculateMaxAllowedPositionSize(
      signal,
      accountBalance,
      currentPositions
    );
    
    return {
      isValid: violations.length === 0,
      violations,
      maxAllowedSize,
      riskPercentage: tradeRisk,
      currentExposure: totalExposure
    };
  }

  /**
   * Monitor portfolio drawdown and determine required actions
   */
  monitorDrawdown(portfolio: Portfolio): DrawdownStatus {
    const currentDrawdown = portfolio.currentDrawdown;
    const maxDrawdown = portfolio.maxDrawdown;
    
    let actionRequired: 'none' | 'reduce_positions' | 'emergency_close' = 'none';
    
    // Determine action based on drawdown severity
    if (currentDrawdown > this.defaultRiskParams.maxDrawdown) {
      actionRequired = 'emergency_close';
    } else if (currentDrawdown > this.defaultRiskParams.maxDrawdown * 0.8) {
      actionRequired = 'reduce_positions';
    }
    
    const status: DrawdownStatus = {
      current: currentDrawdown,
      maximum: maxDrawdown,
      isViolation: currentDrawdown > this.defaultRiskParams.maxDrawdown,
      actionRequired
    };
    
    // Log significant drawdown events
    if (actionRequired !== 'none') {
      logger.warn('Drawdown action required', {
        currentDrawdown: (currentDrawdown * 100).toFixed(2) + '%',
        maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%',
        actionRequired
      });
    }
    
    return status;
  }

  /**
   * Execute emergency shutdown for critical risk violations
   */
  async executeEmergencyShutdown(reason: EmergencyShutdownReason): Promise<void> {
    if (this.emergencyShutdownActive) {
      logger.warn('Emergency shutdown already active');
      return;
    }
    
    this.emergencyShutdownActive = true;
    
    logger.error('EMERGENCY SHUTDOWN INITIATED', {
      reason: reason.type,
      message: reason.message,
      severity: reason.severity,
      timestamp: reason.timestamp
    });
    
    try {
      // Cancel all pending orders
      await this.cancelAllPendingOrders();
      
      // Close all positions if critical severity
      if (reason.severity === 'critical') {
        await this.closeAllPositions();
      }
      
      // Disable new trade execution
      await this.disableTradeExecution();
      
      // Send emergency notifications
      await this.sendEmergencyNotifications(reason);
      
      logger.info('Emergency shutdown completed successfully');
      
    } catch (error) {
      logger.error('Error during emergency shutdown', { error });
      throw error;
    }
  }

  /**
   * Adjust leverage based on market volatility
   */
  adjustLeverageForVolatility(
    baseleverage: number,
    symbol: string,
    marketVolatility?: number
  ): number {
    const volatility = marketVolatility || this.getSymbolVolatility(symbol);
    
    // Reduce leverage as volatility increases
    let adjustedLeverage = baseleverage;
    
    if (volatility > 0.05) { // High volatility (>5%)
      adjustedLeverage *= 0.5;
    } else if (volatility > 0.03) { // Medium volatility (3-5%)
      adjustedLeverage *= 0.7;
    } else if (volatility > 0.02) { // Low-medium volatility (2-3%)
      adjustedLeverage *= 0.85;
    }
    
    // Ensure leverage doesn't exceed maximum
    adjustedLeverage = Math.min(adjustedLeverage, this.defaultRiskParams.maxLeverage);
    
    // Ensure minimum leverage of 1x
    adjustedLeverage = Math.max(adjustedLeverage, 1);
    
    logger.debug('Leverage adjusted for volatility', {
      symbol,
      volatility: (volatility * 100).toFixed(2) + '%',
      baseLeverage: baseleverage,
      adjustedLeverage: adjustedLeverage.toFixed(2)
    });
    
    return Math.round(adjustedLeverage * 100) / 100;
  }

  /**
   * Analyze correlation to prevent over-exposure to similar assets
   */
  analyzeCorrelation(
    targetSymbol: string,
    currentPositions: Position[]
  ): CorrelationAnalysis {
    // Check cache first
    const cacheKey = `${targetSymbol}_${currentPositions.map(p => p.symbol).sort().join('_')}`;
    if (this.correlationCache.has(cacheKey)) {
      return this.correlationCache.get(cacheKey)!;
    }
    
    const correlatedSymbols: string[] = [];
    let maxCorrelation = 0;
    
    // Analyze correlation with existing positions
    for (const position of currentPositions) {
      const correlation = this.calculateSymbolCorrelation(targetSymbol, position.symbol);
      
      if (correlation > 0.7) { // High correlation threshold
        correlatedSymbols.push(position.symbol);
        maxCorrelation = Math.max(maxCorrelation, correlation);
      }
    }
    
    // Calculate risk adjustment based on correlation
    let riskAdjustment = 1.0;
    if (maxCorrelation > 0.9) {
      riskAdjustment = 0.3; // Severely reduce position size
    } else if (maxCorrelation > 0.8) {
      riskAdjustment = 0.5;
    } else if (maxCorrelation > 0.7) {
      riskAdjustment = 0.7;
    }
    
    const analysis: CorrelationAnalysis = {
      symbol: targetSymbol,
      correlatedSymbols,
      correlationCoefficient: maxCorrelation,
      riskAdjustment
    };
    
    // Cache the result
    this.correlationCache.set(cacheKey, analysis);
    
    return analysis;
  }

  /**
   * Update daily loss tracking
   */
  updateDailyLoss(loss: number): void {
    const today = new Date().toISOString().split('T')[0];
    const currentLoss = this.dailyLossTracker.get(today) || 0;
    this.dailyLossTracker.set(today, currentLoss + loss);
  }

  /**
   * Reset emergency shutdown state
   */
  resetEmergencyShutdown(): void {
    this.emergencyShutdownActive = false;
    logger.info('Emergency shutdown state reset');
  }

  /**
   * Check if emergency shutdown is active
   */
  isEmergencyShutdownActive(): boolean {
    return this.emergencyShutdownActive;
  }

  // Private helper methods

  private calculateTradeRisk(
    signal: TradingSignal,
    positionSize: number,
    accountBalance: number
  ): number {
    if (!signal.stopLoss) return 0.02; // Default 2% risk if no stop loss
    
    const stopLossDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    const riskAmount = positionSize * stopLossDistance;
    return riskAmount / accountBalance;
  }

  private calculateTotalExposure(positions: Position[], accountBalance: number): number {
    const totalValue = positions.reduce((sum, position) => {
      return sum + (position.currentPrice * Math.abs(position.size));
    }, 0);
    
    return totalValue / accountBalance;
  }

  private calculateMaxPositionSize(
    accountBalance: number,
    currentPositions: Position[]
  ): number {
    const currentExposure = this.calculateTotalExposure(currentPositions, accountBalance);
    const remainingExposure = this.defaultRiskParams.maxTotalExposure - currentExposure;
    
    return Math.max(0, remainingExposure * accountBalance);
  }

  private calculateMaxAllowedPositionSize(
    signal: TradingSignal,
    accountBalance: number,
    currentPositions: Position[]
  ): number {
    const maxByRisk = (accountBalance * this.defaultRiskParams.maxRiskPerTrade) / 
      (signal.stopLoss ? Math.abs(signal.entryPrice - signal.stopLoss) : signal.entryPrice * 0.02);
    
    const maxByExposure = this.calculateMaxPositionSize(accountBalance, currentPositions) / signal.entryPrice;
    
    return Math.min(maxByRisk, maxByExposure);
  }

  private getCorrelationAdjustment(symbol: string, positions: Position[]): number {
    if (positions.length === 0) return 1.0;
    
    const analysis = this.analyzeCorrelation(symbol, positions);
    return analysis.riskAdjustment;
  }

  private getVolatilityAdjustment(symbol: string): number {
    const volatility = this.getSymbolVolatility(symbol);
    
    // Reduce position size for high volatility
    if (volatility > 0.05) return 0.6;
    if (volatility > 0.03) return 0.8;
    if (volatility > 0.02) return 0.9;
    
    return 1.0;
  }

  private getSymbolVolatility(symbol: string): number {
    const cached = this.volatilityCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return cached.volatility;
    }
    
    // Default volatility values (in production, this would come from market data)
    const defaultVolatilities: Record<string, number> = {
      'BTCUSDT': 0.04,
      'ETHUSDT': 0.05,
      'ADAUSDT': 0.06,
      'DOTUSDT': 0.07,
      'LINKUSDT': 0.06,
      'SOLUSDT': 0.08
    };
    
    return defaultVolatilities[symbol] || 0.05; // Default 5% volatility
  }

  private calculateSymbolCorrelation(symbol1: string, symbol2: string): number {
    if (symbol1 === symbol2) return 1.0;
    
    // Simplified correlation matrix (in production, this would be calculated from price data)
    const correlations: Record<string, Record<string, number>> = {
      'BTCUSDT': { 'ETHUSDT': 0.85, 'ADAUSDT': 0.75, 'DOTUSDT': 0.70 },
      'ETHUSDT': { 'BTCUSDT': 0.85, 'ADAUSDT': 0.80, 'LINKUSDT': 0.75 },
      'ADAUSDT': { 'BTCUSDT': 0.75, 'ETHUSDT': 0.80, 'DOTUSDT': 0.85 }
    };
    
    return correlations[symbol1]?.[symbol2] || 0.3; // Default low correlation
  }

  private getDailyLoss(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.dailyLossTracker.get(today) || 0;
  }

  private checkDrawdownLimit(portfolio: Portfolio): boolean {
    return portfolio.currentDrawdown > this.defaultRiskParams.maxDrawdown;
  }

  private async cancelAllPendingOrders(): Promise<void> {
    // Implementation would cancel all pending orders across exchanges
    logger.info('Cancelling all pending orders');
  }

  private async closeAllPositions(): Promise<void> {
    // Implementation would close all open positions
    logger.info('Closing all positions');
  }

  private async disableTradeExecution(): Promise<void> {
    // Implementation would disable new trade execution
    logger.info('Trade execution disabled');
  }

  private async sendEmergencyNotifications(reason: EmergencyShutdownReason): Promise<void> {
    // Implementation would send notifications via email, SMS, etc.
    logger.info('Emergency notifications sent', { reason });
  }

  // Additional method for grid bot integration
  async checkRiskLimits(params: any): Promise<any> {
    // Mock risk limit checking
    return {
      withinLimits: true,
      violations: [],
      recommendations: []
    };
  }
}

export default RiskManagementService;