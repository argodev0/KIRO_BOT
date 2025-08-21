/**
 * Analytics Service
 * Comprehensive performance analytics and reporting system
 */

import { PrismaClient } from '@prisma/client';
import {
  PerformanceAnalytics,
  TradeAnalytics,
  PatternAnalytics,
  ElliottWaveAnalytics,
  FibonacciAnalytics,
  GridAnalytics,
  AnalyticsPeriod,
  PerformanceMetrics,
  AnalyticsCalculator,
  WavePerformance,
  LevelPerformance,
  GridStrategyPerformance,
  ElliottWaveContext,
  FibonacciContext
} from '../types/analytics';
import { logger } from '../utils/logger';

export class AnalyticsService implements AnalyticsCalculator {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate comprehensive performance analytics for a user
   */
  async generatePerformanceAnalytics(
    userId: string,
    period: AnalyticsPeriod,
    startDate?: Date,
    endDate?: Date
  ): Promise<PerformanceAnalytics> {
    try {
      const { start, end } = this.getPeriodDates(period, startDate, endDate);
      
      // Get all trades for the period
      const trades = await this.getTradeAnalytics(userId, { startDate: start, endDate: end });
      
      // Calculate core performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(trades);
      
      // Get pattern-specific analytics
      const patternAnalytics = await this.calculatePatternAnalytics(userId, start, end);
      
      // Get Elliott Wave analytics
      const elliottWaveAnalytics = await this.calculateElliottWaveAnalytics(userId, start, end);
      
      // Get Fibonacci analytics
      const fibonacciAnalytics = await this.calculateFibonacciAnalytics(userId, start, end);
      
      // Get grid analytics if applicable
      const gridAnalytics = await this.calculateGridAnalytics(userId, start, end);
      
      const analytics: PerformanceAnalytics = {
        userId,
        period,
        startDate: start,
        endDate: end,
        
        // Core metrics
        totalTrades: trades.length,
        winningTrades: trades.filter(t => (t.realizedPnl || 0) > 0).length,
        losingTrades: trades.filter(t => (t.realizedPnl || 0) < 0).length,
        winRate: performanceMetrics.winRate,
        
        // Financial metrics
        totalReturn: performanceMetrics.totalReturn,
        totalReturnPercentage: performanceMetrics.annualizedReturn,
        realizedPnl: trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0),
        unrealizedPnl: await this.calculateUnrealizedPnl(userId),
        maxDrawdown: performanceMetrics.maxDrawdown,
        currentDrawdown: await this.calculateCurrentDrawdown(userId),
        
        // Risk-adjusted metrics
        sharpeRatio: performanceMetrics.sharpeRatio,
        sortinoRatio: performanceMetrics.sortinoRatio,
        calmarRatio: performanceMetrics.totalReturn / Math.abs(performanceMetrics.maxDrawdown),
        maxConsecutiveLosses: this.calculateMaxConsecutiveLosses(trades),
        maxConsecutiveWins: this.calculateMaxConsecutiveWins(trades),
        
        // Trading frequency
        averageTradesPerDay: this.calculateAverageTradesPerDay(trades, start, end),
        averageHoldingTime: this.calculateAverageHoldingTime(trades),
        
        // Specialized analytics
        patternAnalytics,
        elliottWaveAnalytics,
        fibonacciAnalytics,
        ...(gridAnalytics && { gridAnalytics }),
        
        calculatedAt: new Date()
      };

      // Store analytics in database
      await this.storePerformanceMetrics(userId, analytics);
      
      return analytics;
    } catch (error) {
      logger.error('Error generating performance analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate core performance metrics
   */
  calculatePerformanceMetrics(trades: TradeAnalytics[]): PerformanceMetrics {
    if (trades.length === 0) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0
      };
    }

    const returns = trades
      .filter(t => t.returnPercentage !== undefined)
      .map(t => t.returnPercentage!);
    
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const winningTrades = trades.filter(t => (t.realizedPnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.realizedPnl || 0) < 0);
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0));
    
    return {
      totalReturn,
      annualizedReturn: this.calculateAnnualizedReturn(returns),
      volatility: this.calculateVolatility(returns),
      sharpeRatio: this.calculateSharpeRatio(returns),
      sortinoRatio: this.calculateSortinoRatio(returns),
      maxDrawdown: this.calculateMaxDrawdown(this.getCumulativeReturns(returns)),
      winRate: this.calculateWinRate(trades),
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0
    };
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    return volatility > 0 ? (avgReturn - riskFreeRate) / volatility : 0;
  }

  /**
   * Calculate Sortino ratio
   */
  calculateSortinoRatio(returns: number[], targetReturn: number = 0): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downside = returns.filter(r => r < targetReturn);
    
    if (downside.length === 0) return Infinity;
    
    const downsideDeviation = Math.sqrt(
      downside.reduce((sum, r) => sum + Math.pow(r - targetReturn, 2), 0) / downside.length
    );
    
    return downsideDeviation > 0 ? (avgReturn - targetReturn) / downsideDeviation : 0;
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(portfolioValues: number[]): number {
    if (portfolioValues.length === 0) return 0;
    
    let maxDrawdown = 0;
    let peak = portfolioValues[0];
    
    for (const value of portfolioValues) {
      if (value > peak) {
        peak = value;
      }
      
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  /**
   * Calculate win rate
   */
  calculateWinRate(trades: TradeAnalytics[]): number {
    if (trades.length === 0) return 0;
    
    const winningTrades = trades.filter(t => (t.realizedPnl || 0) > 0).length;
    return winningTrades / trades.length;
  }

  /**
   * Calculate pattern-specific analytics
   */
  private async calculatePatternAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PatternAnalytics[]> {
    const signals = await this.prisma.tradingSignal.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
        reasoning: { not: {} as any }
      },
      include: {
        executions: true
      }
    });

    const patternMap = new Map<string, {
      total: number;
      successful: number;
      returns: number[];
      holdingTimes: number[];
      confidences: number[];
    }>();

    for (const signal of signals) {
      const reasoning = signal.reasoning as any;
      const patternType = reasoning?.pattern?.type || 'unknown';
      
      if (!patternMap.has(patternType)) {
        patternMap.set(patternType, {
          total: 0,
          successful: 0,
          returns: [],
          holdingTimes: [],
          confidences: []
        });
      }

      const pattern = patternMap.get(patternType)!;
      pattern.total++;
      pattern.confidences.push(Number(signal.confidence));

      // Calculate success based on executions
      if (signal.executions && signal.executions.length > 0) {
        const totalPnl = signal.executions.reduce((sum: number, exec: any) => sum + Number(exec.realizedPnl || 0), 0);
        if (totalPnl > 0) {
          pattern.successful++;
        }
        pattern.returns.push(totalPnl);
        
        // Calculate holding time
        if (signal.executedAt && signal.closedAt) {
          const holdingTime = (signal.closedAt.getTime() - signal.executedAt.getTime()) / (1000 * 60 * 60);
          pattern.holdingTimes.push(holdingTime);
        }
      }
    }

    return Array.from(patternMap.entries()).map(([patternType, data]) => ({
      patternType,
      totalSignals: data.total,
      successfulSignals: data.successful,
      successRate: data.total > 0 ? data.successful / data.total : 0,
      averageReturn: data.returns.length > 0 ? data.returns.reduce((sum, r) => sum + r, 0) / data.returns.length : 0,
      averageHoldingTime: data.holdingTimes.length > 0 ? data.holdingTimes.reduce((sum, h) => sum + h, 0) / data.holdingTimes.length : 0,
      confidenceDistribution: this.calculateConfidenceDistribution(data.confidences)
    }));
  }

  /**
   * Calculate Elliott Wave analytics
   */
  private async calculateElliottWaveAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ElliottWaveAnalytics> {
    const signals = await this.prisma.tradingSignal.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
        elliottWaveScore: { not: null }
      },
      include: {
        executions: true
      }
    });

    let totalWaveAnalyses = 0;
    let correctWaveIdentifications = 0;
    const impulseWaves: WavePerformance = { totalTrades: 0, successfulTrades: 0, successRate: 0, averageReturn: 0, averageAccuracy: 0 };
    const correctiveWaves: WavePerformance = { totalTrades: 0, successfulTrades: 0, successRate: 0, averageReturn: 0, averageAccuracy: 0 };
    const waveDegreeAccuracy: Record<string, number> = {};
    let waveTargetHits = 0;
    let totalWaveTargets = 0;

    for (const signal of signals) {
      totalWaveAnalyses++;
      
      const reasoning = signal.reasoning as any;
      const waveContext = reasoning?.elliottWave as ElliottWaveContext;
      
      if (waveContext) {
        // Track wave type performance
        const isSuccessful = signal.executions && signal.executions.some((exec: any) => Number(exec.realizedPnl || 0) > 0);
        // const totalReturn = signal.executions.reduce((sum, exec) => sum + Number(exec.realizedPnl || 0), 0);
        
        if (waveContext.waveType === 'impulse') {
          impulseWaves.totalTrades++;
          if (isSuccessful) impulseWaves.successfulTrades++;
        } else {
          correctiveWaves.totalTrades++;
          if (isSuccessful) correctiveWaves.successfulTrades++;
        }

        // Track wave degree accuracy
        if (waveContext.waveDegree) {
          if (!waveDegreeAccuracy[waveContext.waveDegree]) {
            waveDegreeAccuracy[waveContext.waveDegree] = 0;
          }
          if (isSuccessful) {
            waveDegreeAccuracy[waveContext.waveDegree]++;
          }
        }

        // Track wave target accuracy
        if (waveContext.waveTargets && waveContext.actualWaveCompletion !== undefined) {
          totalWaveTargets++;
          if (waveContext.actualWaveCompletion) {
            waveTargetHits++;
          }
        }
        
        // Track correct wave identifications
        if (isSuccessful) {
          correctWaveIdentifications++;
        }
      }
    }

    // Calculate success rates
    impulseWaves.successRate = impulseWaves.totalTrades > 0 ? impulseWaves.successfulTrades / impulseWaves.totalTrades : 0;
    correctiveWaves.successRate = correctiveWaves.totalTrades > 0 ? correctiveWaves.successfulTrades / correctiveWaves.totalTrades : 0;

    return {
      totalWaveAnalyses,
      correctWaveIdentifications,
      waveAccuracy: totalWaveAnalyses > 0 ? correctWaveIdentifications / totalWaveAnalyses : 0,
      impulseWavePerformance: impulseWaves,
      correctiveWavePerformance: correctiveWaves,
      waveDegreeAccuracy,
      waveTargetAccuracy: totalWaveTargets > 0 ? waveTargetHits / totalWaveTargets : 0,
      fibonacciProjectionAccuracy: 0 // TODO: Implement based on Fibonacci projections
    };
  }

  /**
   * Calculate Fibonacci analytics
   */
  private async calculateFibonacciAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FibonacciAnalytics> {
    const signals = await this.prisma.tradingSignal.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
        fibonacciScore: { not: null }
      },
      include: {
        executions: true
      }
    });

    let totalFibonacciSignals = 0;
    let successfulRetracements = 0;
    let successfulExtensions = 0;
    const retracementLevels: Record<string, LevelPerformance> = {};
    const extensionLevels: Record<string, LevelPerformance> = {};
    let confluenceZoneHits = 0;
    let totalConfluenceTests = 0;
    let goldenRatioHits = 0;
    let totalGoldenRatioTests = 0;

    for (const signal of signals) {
      totalFibonacciSignals++;
      
      const reasoning = signal.reasoning as any;
      const fibContext = reasoning?.fibonacci as FibonacciContext;
      
      if (fibContext) {
        const isSuccessful = signal.executions && signal.executions.some((exec: any) => Number(exec.realizedPnl || 0) > 0);
        const levelKey = fibContext.level.toString();
        
        if (fibContext.levelType === 'retracement') {
          if (isSuccessful) successfulRetracements++;
          
          if (!retracementLevels[levelKey]) {
            retracementLevels[levelKey] = { totalTests: 0, successfulTests: 0, accuracy: 0, averageReactionStrength: 0, averageHoldTime: 0 };
          }
          retracementLevels[levelKey].totalTests++;
          if (isSuccessful) retracementLevels[levelKey].successfulTests++;
        } else {
          if (isSuccessful) successfulExtensions++;
          
          if (!extensionLevels[levelKey]) {
            extensionLevels[levelKey] = { totalTests: 0, successfulTests: 0, accuracy: 0, averageReactionStrength: 0, averageHoldTime: 0 };
          }
          extensionLevels[levelKey].totalTests++;
          if (isSuccessful) extensionLevels[levelKey].successfulTests++;
        }

        // Track confluence zones
        if (fibContext.confluenceZone) {
          totalConfluenceTests++;
          if (isSuccessful) confluenceZoneHits++;
        }

        // Track golden ratio (0.618) performance
        if (Math.abs(fibContext.level - 0.618) < 0.001) {
          totalGoldenRatioTests++;
          if (isSuccessful) goldenRatioHits++;
        }
      }
    }

    // Calculate accuracy for each level
    Object.values(retracementLevels).forEach(level => {
      level.accuracy = level.totalTests > 0 ? level.successfulTests / level.totalTests : 0;
    });
    
    Object.values(extensionLevels).forEach(level => {
      level.accuracy = level.totalTests > 0 ? level.successfulTests / level.totalTests : 0;
    });

    return {
      totalFibonacciSignals,
      successfulRetracements,
      successfulExtensions,
      retracementLevelPerformance: retracementLevels,
      extensionLevelPerformance: extensionLevels,
      confluenceZoneAccuracy: totalConfluenceTests > 0 ? confluenceZoneHits / totalConfluenceTests : 0,
      goldenRatioPerformance: {
        totalTests: totalGoldenRatioTests,
        successfulTests: goldenRatioHits,
        accuracy: totalGoldenRatioTests > 0 ? goldenRatioHits / totalGoldenRatioTests : 0,
        averageReactionStrength: 0, // TODO: Implement based on price reaction data
        averageHoldTime: 0 // TODO: Implement based on holding time data
      },
      timeFibonacciAccuracy: 0 // TODO: Implement time-based Fibonacci analysis
    };
  }

  /**
   * Calculate grid trading analytics
   */
  private async calculateGridAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<GridAnalytics | undefined> {
    const grids = await this.prisma.grid.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate }
      }
    });

    if (grids.length === 0) return undefined;

    const activeGrids = grids.filter(g => g.status === 'ACTIVE').length;
    const completedGrids = grids.filter(g => g.status === 'CLOSED').length;
    const totalGridProfit = grids.reduce((sum, g) => sum + Number(g.totalProfit), 0);

    // Strategy-specific performance
    const strategies = ['ELLIOTT_WAVE', 'FIBONACCI', 'STANDARD'] as const;
    const strategyPerformance: Record<string, GridStrategyPerformance> = {};

    for (const strategy of strategies) {
      const strategyGrids = grids.filter(g => g.strategy === strategy);
      const successfulGrids = strategyGrids.filter(g => Number(g.totalProfit) > 0).length;
      
      strategyPerformance[strategy] = {
        totalGrids: strategyGrids.length,
        successfulGrids,
        successRate: strategyGrids.length > 0 ? successfulGrids / strategyGrids.length : 0,
        averageProfit: strategyGrids.length > 0 ? 
          strategyGrids.reduce((sum, g) => sum + Number(g.totalProfit), 0) / strategyGrids.length : 0,
        averageDuration: 0 // TODO: Calculate based on grid duration
      };
    }

    return {
      totalGrids: grids.length,
      activeGrids,
      completedGrids,
      totalGridProfit,
      averageGridProfit: grids.length > 0 ? totalGridProfit / grids.length : 0,
      gridSuccessRate: grids.length > 0 ? grids.filter(g => Number(g.totalProfit) > 0).length / grids.length : 0,
      elliottWaveGridPerformance: strategyPerformance['ELLIOTT_WAVE'],
      fibonacciGridPerformance: strategyPerformance['FIBONACCI'],
      standardGridPerformance: strategyPerformance['STANDARD'],
      averageGridDuration: 0, // TODO: Implement
      averageFillRate: 0, // TODO: Implement
      optimalSpacingAnalysis: {
        optimalSpacing: 0,
        spacingPerformanceMap: {},
        recommendedSpacing: 0
      }
    };
  }

  /**
   * Get trade analytics with filters
   */
  private async getTradeAnalytics(
    userId: string,
    filters: { startDate?: Date; endDate?: Date; symbol?: string } = {}
  ): Promise<TradeAnalytics[]> {
    const whereClause: any = {
      userId,
      ...(filters.symbol && { symbol: filters.symbol })
    };

    if (filters.startDate || filters.endDate) {
      whereClause.executedAt = {};
      if (filters.startDate) whereClause.executedAt.gte = filters.startDate;
      if (filters.endDate) whereClause.executedAt.lte = filters.endDate;
    }

    const executions = await this.prisma.tradeExecution.findMany({
      where: whereClause,
      include: {
        signal: true
      },
      orderBy: {
        executedAt: 'asc'
      }
    });

    return executions.map(exec => {
      const trade: TradeAnalytics = {
        tradeId: exec.id,
        symbol: exec.symbol,
        side: exec.side,
        entryPrice: Number(exec.price),
        quantity: Number(exec.quantity),
        realizedPnl: exec.realizedPnl ? Number(exec.realizedPnl) : undefined,
        returnPercentage: exec.realizedPnl ? (Number(exec.realizedPnl) / (Number(exec.price) * Number(exec.quantity))) * 100 : undefined,
        confidenceScore: exec.signal ? Number(exec.signal.confidence) : undefined,
        entryTime: exec.executedAt,
        // TODO: Add more context from signal reasoning
      };
      
      if (exec.signalId) {
        trade.signalId = exec.signalId;
      }
      
      return trade;
    });
  }

  // Helper methods
  private getPeriodDates(period: AnalyticsPeriod, startDate?: Date, endDate?: Date): { start: Date; end: Date } {
    const now = new Date();
    const end = endDate || now;
    let start: Date;

    switch (period) {
      case AnalyticsPeriod.DAILY:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case AnalyticsPeriod.WEEKLY:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case AnalyticsPeriod.MONTHLY:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case AnalyticsPeriod.QUARTERLY:
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case AnalyticsPeriod.YEARLY:
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case AnalyticsPeriod.ALL_TIME:
        start = new Date(0);
        break;
      default:
        start = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateAnnualizedReturn(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const periods = returns.length;
    const periodsPerYear = 252; // Trading days per year
    
    return totalReturn * (periodsPerYear / periods);
  }

  private getCumulativeReturns(returns: number[]): number[] {
    const cumulative: number[] = [];
    let sum = 0;
    
    for (const ret of returns) {
      sum += ret;
      cumulative.push(sum);
    }
    
    return cumulative;
  }

  private calculateMaxConsecutiveLosses(trades: TradeAnalytics[]): number {
    let maxLosses = 0;
    let currentLosses = 0;
    
    for (const trade of trades) {
      if ((trade.realizedPnl || 0) < 0) {
        currentLosses++;
        maxLosses = Math.max(maxLosses, currentLosses);
      } else {
        currentLosses = 0;
      }
    }
    
    return maxLosses;
  }

  private calculateMaxConsecutiveWins(trades: TradeAnalytics[]): number {
    let maxWins = 0;
    let currentWins = 0;
    
    for (const trade of trades) {
      if ((trade.realizedPnl || 0) > 0) {
        currentWins++;
        maxWins = Math.max(maxWins, currentWins);
      } else {
        currentWins = 0;
      }
    }
    
    return maxWins;
  }

  private calculateAverageTradesPerDay(trades: TradeAnalytics[], startDate: Date, endDate: Date): number {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? trades.length / days : 0;
  }

  private calculateAverageHoldingTime(trades: TradeAnalytics[]): number {
    const tradesWithHoldingTime = trades.filter(t => t.holdingTime !== undefined);
    if (tradesWithHoldingTime.length === 0) return 0;
    
    return tradesWithHoldingTime.reduce((sum, t) => sum + (t.holdingTime || 0), 0) / tradesWithHoldingTime.length;
  }

  private calculateConfidenceDistribution(confidences: number[]) {
    if (confidences.length === 0) return { low: 0, medium: 0, high: 0 };
    
    const low = confidences.filter(c => c < 40).length / confidences.length;
    const medium = confidences.filter(c => c >= 40 && c < 70).length / confidences.length;
    const high = confidences.filter(c => c >= 70).length / confidences.length;
    
    return { low, medium, high };
  }

  private async calculateUnrealizedPnl(userId: string): Promise<number> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
    
    return portfolio ? Number(portfolio.totalUnrealizedPnl) : 0;
  }

  private async calculateCurrentDrawdown(userId: string): Promise<number> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
    
    return portfolio ? Number(portfolio.currentDrawdown) : 0;
  }

  private async storePerformanceMetrics(userId: string, analytics: PerformanceAnalytics): Promise<void> {
    await this.prisma.performanceMetric.create({
      data: {
        userId,
        metricType: 'performance_analytics',
        metricValue: analytics.totalReturn,
        metadata: analytics as any,
        period: analytics.period
      }
    });
  }
}