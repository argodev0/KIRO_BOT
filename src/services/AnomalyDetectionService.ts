import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { TradingSignal } from '../types/trading';
import { Portfolio, Position } from '../types/trading';

interface AnomalyThresholds {
  maxConsecutiveLosses: number;
  maxDrawdownPercent: number;
  maxPositionSizePercent: number;
  maxDailyTradeCount: number;
  minSignalConfidence: number;
  maxLatencyMs: number;
  maxSlippagePercent: number;
}

interface TradingAnomaly {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  value: number;
  threshold: number;
  timestamp: number;
  metadata?: any;
}

interface TradingStats {
  consecutiveLosses: number;
  dailyTradeCount: number;
  totalTrades: number;
  winRate: number;
  avgLatency: number;
  avgSlippage: number;
  lastTradeTime: number;
}

export class AnomalyDetectionService extends EventEmitter {
  private static instance: AnomalyDetectionService;
  private thresholds: AnomalyThresholds;
  private tradingStats: Map<string, TradingStats> = new Map();
  private recentTrades: Map<string, any[]> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.thresholds = {
      maxConsecutiveLosses: 5,
      maxDrawdownPercent: 10,
      maxPositionSizePercent: 20,
      maxDailyTradeCount: 100,
      minSignalConfidence: 0.6,
      maxLatencyMs: 1000,
      maxSlippagePercent: 2
    };
    this.startAnomalyMonitoring();
  }

  public static getInstance(): AnomalyDetectionService {
    if (!AnomalyDetectionService.instance) {
      AnomalyDetectionService.instance = new AnomalyDetectionService();
    }
    return AnomalyDetectionService.instance;
  }

  public analyzeSignal(signal: TradingSignal): TradingAnomaly[] {
    const anomalies: TradingAnomaly[] = [];

    // Check signal confidence
    if (signal.confidence < this.thresholds.minSignalConfidence) {
      anomalies.push({
        type: 'low_signal_confidence',
        severity: 'medium',
        description: `Signal confidence ${signal.confidence} below threshold`,
        value: signal.confidence,
        threshold: this.thresholds.minSignalConfidence,
        timestamp: Date.now(),
        metadata: { symbol: signal.symbol, direction: signal.direction }
      });
    }

    // Check for unusual price movements
    const priceAnomaly = this.detectPriceAnomaly(signal.symbol, signal.entryPrice);
    if (priceAnomaly) {
      anomalies.push(priceAnomaly);
    }

    // Check signal frequency
    const frequencyAnomaly = this.detectSignalFrequencyAnomaly(signal.symbol);
    if (frequencyAnomaly) {
      anomalies.push(frequencyAnomaly);
    }

    return anomalies;
  }

  public analyzeTradeExecution(trade: any): TradingAnomaly[] {
    const anomalies: TradingAnomaly[] = [];
    const userId = trade.userId || 'default';

    // Update trading stats
    this.updateTradingStats(userId, trade);

    // Check execution latency
    if (trade.latency > this.thresholds.maxLatencyMs) {
      anomalies.push({
        type: 'high_execution_latency',
        severity: 'high',
        description: `Trade execution latency ${trade.latency}ms exceeds threshold`,
        value: trade.latency,
        threshold: this.thresholds.maxLatencyMs,
        timestamp: Date.now(),
        metadata: { tradeId: trade.id, symbol: trade.symbol }
      });
    }

    // Check slippage
    if (trade.slippage > this.thresholds.maxSlippagePercent) {
      anomalies.push({
        type: 'high_slippage',
        severity: 'medium',
        description: `Slippage ${trade.slippage}% exceeds threshold`,
        value: trade.slippage,
        threshold: this.thresholds.maxSlippagePercent,
        timestamp: Date.now(),
        metadata: { tradeId: trade.id, symbol: trade.symbol }
      });
    }

    // Check consecutive losses
    const stats = this.tradingStats.get(userId);
    if (stats && stats.consecutiveLosses >= this.thresholds.maxConsecutiveLosses) {
      anomalies.push({
        type: 'consecutive_losses',
        severity: 'critical',
        description: `${stats.consecutiveLosses} consecutive losses detected`,
        value: stats.consecutiveLosses,
        threshold: this.thresholds.maxConsecutiveLosses,
        timestamp: Date.now(),
        metadata: { userId }
      });
    }

    // Check daily trade count
    if (stats && stats.dailyTradeCount >= this.thresholds.maxDailyTradeCount) {
      anomalies.push({
        type: 'excessive_trading',
        severity: 'high',
        description: `Daily trade count ${stats.dailyTradeCount} exceeds threshold`,
        value: stats.dailyTradeCount,
        threshold: this.thresholds.maxDailyTradeCount,
        timestamp: Date.now(),
        metadata: { userId }
      });
    }

    return anomalies;
  }

  public analyzePortfolio(portfolio: Portfolio): TradingAnomaly[] {
    const anomalies: TradingAnomaly[] = [];

    // Check drawdown
    const drawdownPercent = (portfolio.currentDrawdown / portfolio.totalBalance) * 100;
    if (drawdownPercent > this.thresholds.maxDrawdownPercent) {
      anomalies.push({
        type: 'excessive_drawdown',
        severity: 'critical',
        description: `Portfolio drawdown ${drawdownPercent.toFixed(2)}% exceeds threshold`,
        value: drawdownPercent,
        threshold: this.thresholds.maxDrawdownPercent,
        timestamp: Date.now(),
        metadata: { portfolioValue: portfolio.totalBalance }
      });
    }

    // Check position sizes
    for (const position of portfolio.positions) {
      const positionPercent = (Math.abs(position.size * position.currentPrice) / portfolio.totalBalance) * 100;
      if (positionPercent > this.thresholds.maxPositionSizePercent) {
        anomalies.push({
          type: 'oversized_position',
          severity: 'high',
          description: `Position size ${positionPercent.toFixed(2)}% exceeds threshold`,
          value: positionPercent,
          threshold: this.thresholds.maxPositionSizePercent,
          timestamp: Date.now(),
          metadata: { symbol: position.symbol, positionId: position.id }
        });
      }
    }

    // Check for correlation anomalies
    const correlationAnomaly = this.detectCorrelationAnomaly(portfolio.positions);
    if (correlationAnomaly) {
      anomalies.push(correlationAnomaly);
    }

    return anomalies;
  }

  private detectPriceAnomaly(symbol: string, currentPrice: number): TradingAnomaly | null {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const prices = this.priceHistory.get(symbol)!;
    prices.push(currentPrice);

    // Keep only last 100 prices
    if (prices.length > 100) {
      prices.shift();
    }

    if (prices.length < 10) {
      return null; // Not enough data
    }

    // Calculate price volatility
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    // Check if current price is more than 3 standard deviations from mean
    const zScore = Math.abs(currentPrice - avg) / stdDev;
    if (zScore > 3) {
      return {
        type: 'price_anomaly',
        severity: 'high',
        description: `Unusual price movement detected for ${symbol}`,
        value: zScore,
        threshold: 3,
        timestamp: Date.now(),
        metadata: { symbol, currentPrice, avgPrice: avg, stdDev }
      };
    }

    return null;
  }

  private detectSignalFrequencyAnomaly(symbol: string): TradingAnomaly | null {
    const key = `signals_${symbol}`;
    if (!this.recentTrades.has(key)) {
      this.recentTrades.set(key, []);
    }

    const signals = this.recentTrades.get(key)!;
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Remove old signals
    const recentSignals = signals.filter(signal => signal.timestamp > oneHourAgo);
    this.recentTrades.set(key, recentSignals);

    // Add current signal
    recentSignals.push({ timestamp: now });

    // Check if too many signals in short time
    if (recentSignals.length > 20) { // More than 20 signals per hour
      return {
        type: 'high_signal_frequency',
        severity: 'medium',
        description: `High signal frequency detected for ${symbol}`,
        value: recentSignals.length,
        threshold: 20,
        timestamp: Date.now(),
        metadata: { symbol }
      };
    }

    return null;
  }

  private detectCorrelationAnomaly(positions: Position[]): TradingAnomaly | null {
    if (positions.length < 2) {
      return null;
    }

    // Simple correlation check - count positions in same direction
    const longPositions = positions.filter(p => p.side === 'long').length;
    const shortPositions = positions.filter(p => p.side === 'short').length;
    const totalPositions = positions.length;

    // If more than 80% positions are in same direction
    const maxSameDirection = Math.max(longPositions, shortPositions);
    const correlationPercent = (maxSameDirection / totalPositions) * 100;

    if (correlationPercent > 80) {
      return {
        type: 'high_correlation',
        severity: 'medium',
        description: `High correlation detected: ${correlationPercent.toFixed(1)}% positions in same direction`,
        value: correlationPercent,
        threshold: 80,
        timestamp: Date.now(),
        metadata: { longPositions, shortPositions, totalPositions }
      };
    }

    return null;
  }

  private updateTradingStats(userId: string, trade: any): void {
    if (!this.tradingStats.has(userId)) {
      this.tradingStats.set(userId, {
        consecutiveLosses: 0,
        dailyTradeCount: 0,
        totalTrades: 0,
        winRate: 0,
        avgLatency: 0,
        avgSlippage: 0,
        lastTradeTime: 0
      });
    }

    const stats = this.tradingStats.get(userId)!;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Reset daily count if it's a new day
    if (stats.lastTradeTime < oneDayAgo) {
      stats.dailyTradeCount = 0;
    }

    stats.dailyTradeCount++;
    stats.totalTrades++;
    stats.lastTradeTime = now;

    // Update consecutive losses
    if (trade.pnl < 0) {
      stats.consecutiveLosses++;
    } else {
      stats.consecutiveLosses = 0;
    }

    // Update averages
    stats.avgLatency = (stats.avgLatency * (stats.totalTrades - 1) + trade.latency) / stats.totalTrades;
    stats.avgSlippage = (stats.avgSlippage * (stats.totalTrades - 1) + trade.slippage) / stats.totalTrades;
  }

  private startAnomalyMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      try {
        this.cleanupOldData();
        this.performPeriodicChecks();
      } catch (error) {
        logger.error('Error in anomaly monitoring:', error);
      }
    }, 60000); // Check every minute
  }

  private cleanupOldData(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Clean up old trade data
    for (const [key, trades] of this.recentTrades.entries()) {
      const recentTrades = trades.filter(trade => trade.timestamp > oneDayAgo);
      this.recentTrades.set(key, recentTrades);
    }
  }

  private performPeriodicChecks(): void {
    // Check for system-wide anomalies
    const totalStats = Array.from(this.tradingStats.values());
    
    if (totalStats.length > 0) {
      const avgWinRate = totalStats.reduce((sum, stats) => sum + stats.winRate, 0) / totalStats.length;
      
      if (avgWinRate < 0.3) { // Less than 30% win rate
        this.emit('anomaly_detected', {
          type: 'low_system_win_rate',
          severity: 'high',
          description: `System-wide win rate ${(avgWinRate * 100).toFixed(1)}% is critically low`,
          value: avgWinRate,
          threshold: 0.3,
          timestamp: Date.now()
        });
      }
    }
  }

  public updateThresholds(newThresholds: Partial<AnomalyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Anomaly detection thresholds updated:', this.thresholds);
  }

  public getThresholds(): AnomalyThresholds {
    return { ...this.thresholds };
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}