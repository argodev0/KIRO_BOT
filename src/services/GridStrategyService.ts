/**
 * Grid Strategy Service
 * Advanced grid trading system with Elliott Wave and Fibonacci integration
 */

import { 
  Grid, 
  GridLevel, 
  GridConfig, 
  GridCalculationResult, 
  GridMonitoringData, 
  GridPerformance,
  GridRiskAssessment,
  GridEvent,
  GridEventType,
  GridOptimizationResult,
  GridOptimizationParams,
  WaveContext,
  ElliottWaveGridConfig,
  FibonacciGridConfig,
  DynamicGridConfig
} from '../types/grid';
import { CandleData } from '../types/market';
import { WaveStructure, FibonacciLevels } from '../types/analysis';
import { ElliottWaveService } from './ElliottWaveService';

import { GridModel } from '../models/Grid';

// Temporary logger for testing
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data),
  debug: (msg: string, data?: any) => console.log(`DEBUG: ${msg}`, data),
  warn: (msg: string, data?: any) => console.warn(`WARN: ${msg}`, data),
};

export interface GridInvalidationResult {
  isInvalidated: boolean;
  reason: string;
  invalidatedLevels: GridLevel[];
  recommendedAction: 'close' | 'adjust' | 'pause';
}

export interface GridAdjustmentResult {
  adjustedLevels: GridLevel[];
  removedLevels: GridLevel[];
  addedLevels: GridLevel[];
  reason: string;
}

export class GridStrategyService {
  private elliottWaveService: ElliottWaveService;
  private gridEvents: Map<string, GridEvent[]> = new Map();

  constructor() {
    this.elliottWaveService = new ElliottWaveService();
  }

  /**
   * Calculate Elliott Wave-based grid levels
   */
  async calculateElliottWaveGrid(
    config: GridConfig & { elliottWaveConfig: ElliottWaveGridConfig }
  ): Promise<GridCalculationResult> {
    try {
      const { elliottWaveConfig, basePrice, riskParameters } = config;
      const { waveAnalysis, longWaves, shortWaves, waveTargets } = elliottWaveConfig;

      const levels: GridLevel[] = [];
      const currentWave = waveAnalysis.currentWave;
      
      // Determine grid direction based on current wave
      const isLongGrid = longWaves.includes(currentWave.type);
      const isShortGrid = shortWaves.includes(currentWave.type);

      if (!isLongGrid && !isShortGrid) {
        throw new Error(`Current wave ${currentWave.type} not configured for grid trading`);
      }

      // Calculate grid levels based on wave structure
      const waveContext: WaveContext = {
        currentWave: currentWave.type,
        waveType: this.isImpulseWave(currentWave.type) ? 'impulse' : 'corrective',
        wavePosition: this.getWavePosition(currentWave.type),
        expectedDirection: isLongGrid ? 'up' : 'down'
      };

      // Use wave targets for grid level calculation
      const gridSpacing = this.calculateWaveBasedSpacing(waveAnalysis, basePrice || currentWave.endPrice);
      const levelCount = Math.min(waveTargets.length + 2, riskParameters.maxLevels);

      for (let i = 0; i < levelCount; i++) {
        const price = isLongGrid 
          ? (basePrice || currentWave.endPrice) + (gridSpacing * i)
          : (basePrice || currentWave.endPrice) - (gridSpacing * i);

        levels.push({
          price,
          quantity: config.quantity || this.calculateDefaultQuantity(price, riskParameters),
          side: isLongGrid ? 'buy' : 'sell',
          filled: false,
          waveContext
        });
      }

      return this.buildCalculationResult(levels, riskParameters, config.symbol);
    } catch (error) {
      logger.error('Failed to calculate Elliott Wave grid', { error, config });
      throw error;
    }
  }

  /**
   * Calculate Fibonacci-based grid levels using golden ratio proportions
   */
  async calculateFibonacciGrid(
    config: GridConfig & { fibonacciConfig: FibonacciGridConfig }
  ): Promise<GridCalculationResult> {
    try {
      const { fibonacciConfig, basePrice, riskParameters } = config;
      const { fibonacciLevels, useRetracements, useExtensions, goldenRatioEmphasis } = fibonacciConfig;

      const levels: GridLevel[] = [];
      const referencePrice = basePrice || fibonacciLevels.swingHigh;

      // Use Fibonacci levels for grid spacing
      let targetLevels = [];
      
      if (useRetracements) {
        targetLevels.push(...fibonacciLevels.retracements);
      }
      
      if (useExtensions) {
        targetLevels.push(...fibonacciLevels.extensions);
      }

      // Emphasize golden ratio levels if configured
      if (goldenRatioEmphasis) {
        targetLevels = this.emphasizeGoldenRatioLevels(targetLevels);
      }

      // Sort levels by price
      targetLevels.sort((a, b) => a.price - b.price);

      // Create grid levels at Fibonacci prices
      for (const fibLevel of targetLevels.slice(0, riskParameters.maxLevels)) {
        const isAboveReference = fibLevel.price > referencePrice;
        
        levels.push({
          price: fibLevel.price,
          quantity: config.quantity || this.calculateFibonacciQuantity(fibLevel, riskParameters),
          side: isAboveReference ? 'sell' : 'buy',
          filled: false,
          fibonacciLevel: fibLevel.ratio
        });
      }

      return this.buildCalculationResult(levels, riskParameters, config.symbol);
    } catch (error) {
      logger.error('Failed to calculate Fibonacci grid', { error, config });
      throw error;
    }
  }

  /**
   * Build dynamic grid that adjusts based on market conditions
   */
  async calculateDynamicGrid(
    config: GridConfig & { dynamicConfig: DynamicGridConfig },
    marketData: CandleData[]
  ): Promise<GridCalculationResult> {
    try {
      const { dynamicConfig, basePrice, riskParameters } = config;
      const { volatilityAdjustment, volumeAdjustment, trendAdjustment } = dynamicConfig;

      const levels: GridLevel[] = [];
      const currentPrice = basePrice || marketData[marketData.length - 1].close;

      // Calculate dynamic spacing based on market conditions
      let spacing = config.spacing || this.calculateDefaultSpacing(currentPrice);

      if (volatilityAdjustment) {
        const volatility = this.calculateVolatility(marketData);
        spacing *= (1 + volatility);
      }

      if (volumeAdjustment) {
        const volumeMultiplier = this.calculateVolumeMultiplier(marketData);
        spacing *= volumeMultiplier;
      }

      if (trendAdjustment) {
        const trendStrength = this.calculateTrendStrength(marketData);
        spacing *= (1 + Math.abs(trendStrength) * 0.5);
      }

      // Create symmetric grid around current price
      const levelCount = riskParameters.maxLevels;
      const halfLevels = Math.floor(levelCount / 2);

      // Buy levels below current price
      for (let i = 1; i <= halfLevels; i++) {
        levels.push({
          price: currentPrice - (spacing * i),
          quantity: config.quantity || this.calculateDefaultQuantity(currentPrice - (spacing * i), riskParameters),
          side: 'buy',
          filled: false
        });
      }

      // Sell levels above current price
      for (let i = 1; i <= halfLevels; i++) {
        levels.push({
          price: currentPrice + (spacing * i),
          quantity: config.quantity || this.calculateDefaultQuantity(currentPrice + (spacing * i), riskParameters),
          side: 'sell',
          filled: false
        });
      }

      return this.buildCalculationResult(levels, riskParameters, config.symbol);
    } catch (error) {
      logger.error('Failed to calculate dynamic grid', { error, config });
      throw error;
    }
  }

  /**
   * Adjust grid levels based on market conditions
   */
  async adjustGridLevels(
    gridId: string,
    marketConditions: {
      currentPrice: number;
      waveStructure?: WaveStructure;
      fibonacciLevels?: FibonacciLevels;
      volatility?: number;
    }
  ): Promise<GridAdjustmentResult> {
    try {
      const grid = await GridModel.findById(gridId);
      if (!grid) {
        throw new Error(`Grid ${gridId} not found`);
      }

      const { currentPrice, waveStructure, fibonacciLevels } = marketConditions;
      const currentLevels = [...grid.levels];
      const adjustedLevels: GridLevel[] = [];
      const removedLevels: GridLevel[] = [];
      const addedLevels: GridLevel[] = [];

      // Adjust based on strategy type
      switch (grid.strategy) {
        case 'elliott_wave':
          if (waveStructure) {
            const waveAdjustment = await this.adjustForWaveStructure(currentLevels, waveStructure, currentPrice);
            adjustedLevels.push(...waveAdjustment.adjusted);
            removedLevels.push(...waveAdjustment.removed);
            addedLevels.push(...waveAdjustment.added);
          }
          break;

        case 'fibonacci':
          if (fibonacciLevels) {
            const fibAdjustment = this.adjustForFibonacciLevels(currentLevels, fibonacciLevels, currentPrice);
            adjustedLevels.push(...fibAdjustment.adjusted);
            removedLevels.push(...fibAdjustment.removed);
            addedLevels.push(...fibAdjustment.added);
          }
          break;

        case 'dynamic':
          const dynamicAdjustment = this.adjustForMarketConditions(currentLevels, marketConditions);
          adjustedLevels.push(...dynamicAdjustment.adjusted);
          removedLevels.push(...dynamicAdjustment.removed);
          addedLevels.push(...dynamicAdjustment.added);
          break;

        default:
          // No adjustment for standard grids
          adjustedLevels.push(...currentLevels);
      }

      // Update grid in database
      await GridModel.updateLevels(gridId, adjustedLevels);

      // Log adjustment event
      await this.logGridEvent(gridId, 'rebalance_executed', {
        adjustedCount: adjustedLevels.length,
        removedCount: removedLevels.length,
        addedCount: addedLevels.length,
        currentPrice
      });

      return {
        adjustedLevels,
        removedLevels,
        addedLevels,
        reason: `Grid adjusted for ${grid.strategy} strategy based on market conditions`
      };
    } catch (error) {
      logger.error('Failed to adjust grid levels', { error, gridId });
      throw error;
    }
  }

  /**
   * Monitor grid performance and profit/loss tracking
   */
  async monitorGridPerformance(gridId: string, currentPrice: number): Promise<GridMonitoringData> {
    try {
      const grid = await GridModel.findById(gridId);
      if (!grid) {
        throw new Error(`Grid ${gridId} not found`);
      }

      const filledLevels = grid.levels.filter(level => level.filled);
      const activeLevels = grid.levels.filter(level => !level.filled);
      
      // Calculate unrealized P&L
      const unrealizedPnl = this.calculateUnrealizedPnL(filledLevels, currentPrice);
      
      // Calculate realized P&L from completed trades
      const realizedPnl = grid.totalProfit;

      // Calculate performance metrics
      const performance = this.calculateGridPerformance(grid, filledLevels);

      // Calculate risk metrics
      const riskMetrics = this.calculateRiskMetrics(grid, currentPrice);

      return {
        gridId,
        currentPrice,
        activeLevels: activeLevels.length,
        filledLevels: filledLevels.length,
        pendingOrders: activeLevels.filter(level => level.orderId).length,
        unrealizedPnl,
        realizedPnl,
        performance,
        riskMetrics
      };
    } catch (error) {
      logger.error('Failed to monitor grid performance', { error, gridId });
      throw error;
    }
  }

  /**
   * Check for grid invalidation conditions
   */
  async checkGridInvalidation(
    gridId: string,
    currentPrice: number,
    waveStructure?: WaveStructure
  ): Promise<GridInvalidationResult> {
    try {
      const grid = await GridModel.findById(gridId);
      if (!grid) {
        throw new Error(`Grid ${gridId} not found`);
      }

      let isInvalidated = false;
      let reason = '';
      const invalidatedLevels: GridLevel[] = [];
      let recommendedAction: 'close' | 'adjust' | 'pause' = 'adjust';

      // Check strategy-specific invalidation conditions
      switch (grid.strategy) {
        case 'elliott_wave':
          if (waveStructure) {
            const waveInvalidation = this.checkWaveInvalidation(grid, waveStructure, currentPrice);
            if (waveInvalidation.isInvalidated) {
              isInvalidated = true;
              reason = waveInvalidation.reason;
              invalidatedLevels.push(...waveInvalidation.levels);
              recommendedAction = 'close';
            }
          }
          break;

        case 'fibonacci':
          const fibInvalidation = this.checkFibonacciInvalidation(grid, currentPrice);
          if (fibInvalidation.isInvalidated) {
            isInvalidated = true;
            reason = fibInvalidation.reason;
            invalidatedLevels.push(...fibInvalidation.levels);
            recommendedAction = 'adjust';
          }
          break;

        default:
          // Check general risk-based invalidation
          const riskInvalidation = this.checkRiskInvalidation(grid, currentPrice);
          if (riskInvalidation.isInvalidated) {
            isInvalidated = true;
            reason = riskInvalidation.reason;
            recommendedAction = 'pause';
          }
      }

      if (isInvalidated) {
        await this.logGridEvent(gridId, 'invalidation_triggered', {
          reason,
          currentPrice,
          invalidatedLevels: invalidatedLevels.length
        });
      }

      return {
        isInvalidated,
        reason,
        invalidatedLevels,
        recommendedAction
      };
    } catch (error) {
      logger.error('Failed to check grid invalidation', { error, gridId });
      return {
        isInvalidated: false,
        reason: 'Error checking invalidation',
        invalidatedLevels: [],
        recommendedAction: 'pause'
      };
    }
  }

  /**
   * Optimize grid parameters based on historical performance
   */
  async optimizeGridParameters(params: GridOptimizationParams): Promise<GridOptimizationResult> {
    try {
      // This is a simplified optimization - in production, this would use more sophisticated algorithms
      const { strategy, optimizationMetric } = params;

      // Get historical grids for analysis
      const historicalGrids = await GridModel.findByStrategy(strategy, { status: 'closed', limit: 100 });
      
      if (historicalGrids.length < 10) {
        throw new Error('Insufficient historical data for optimization');
      }

      // Analyze performance patterns
      const performanceData = historicalGrids.map(grid => ({
        spacing: grid.spacing,
        levels: grid.levels.length,
        profit: grid.totalProfit,
        performance: grid.metadata?.performance
      })).filter(data => data.performance);

      // Find optimal parameters based on metric
      const optimal = this.findOptimalParameters(performanceData, optimizationMetric);

      return {
        optimalSpacing: optimal.spacing,
        optimalLevels: optimal.levels,
        optimalQuantity: optimal.quantity,
        expectedReturn: optimal.expectedReturn,
        expectedRisk: optimal.expectedRisk,
        backtestResults: optimal.backtestResults
      };
    } catch (error) {
      logger.error('Failed to optimize grid parameters', { error, params });
      throw error;
    }
  }

  // Private helper methods

  private isImpulseWave(waveType: string): boolean {
    return ['wave_1', 'wave_2', 'wave_3', 'wave_4', 'wave_5'].includes(waveType);
  }

  private getWavePosition(waveType: string): number {
    const waveMap: Record<string, number> = {
      'wave_1': 1, 'wave_2': 2, 'wave_3': 3, 'wave_4': 4, 'wave_5': 5,
      'wave_a': 1, 'wave_b': 2, 'wave_c': 3
    };
    return waveMap[waveType] || 1;
  }

  private calculateWaveBasedSpacing(waveStructure: WaveStructure, _basePrice: number): number {
    // Use average wave length for spacing calculation
    const avgWaveLength = waveStructure.waves.reduce((sum, wave) => sum + wave.length, 0) / waveStructure.waves.length;
    return avgWaveLength * 0.1; // 10% of average wave length
  }

  private calculateDefaultQuantity(price: number, riskParams: any): number {
    // Simple quantity calculation based on risk parameters
    const maxExposure = riskParams.maxExposure || 10000;
    return Math.min(maxExposure / price * 0.1, 1); // 10% of max exposure per level
  }

  private emphasizeGoldenRatioLevels(levels: any[]): any[] {
    // Increase weight for golden ratio levels (0.618, 1.618)
    return levels.map(level => ({
      ...level,
      strength: (level.ratio === 0.618 || level.ratio === 1.618) ? level.strength * 1.5 : level.strength
    }));
  }

  private calculateFibonacciQuantity(fibLevel: any, riskParams: any): number {
    // Adjust quantity based on Fibonacci level strength
    const baseQuantity = this.calculateDefaultQuantity(fibLevel.price, riskParams);
    return baseQuantity * (fibLevel.strength || 1);
  }

  private calculateDefaultSpacing(price: number): number {
    // Default spacing as percentage of price
    return price * 0.02; // 2% spacing
  }

  private calculateVolatility(candles: CandleData[]): number {
    if (candles.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      returns.push(Math.log(candles[i].close / candles[i - 1].close));
    }
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateVolumeMultiplier(candles: CandleData[]): number {
    if (candles.length < 10) return 1;
    
    const recentVolume = candles.slice(-5).reduce((sum, candle) => sum + candle.volume, 0) / 5;
    const avgVolume = candles.reduce((sum, candle) => sum + candle.volume, 0) / candles.length;
    
    return Math.min(recentVolume / avgVolume, 2); // Cap at 2x
  }

  private calculateTrendStrength(candles: CandleData[]): number {
    if (candles.length < 10) return 0;
    
    const firstPrice = candles[0].close;
    const lastPrice = candles[candles.length - 1].close;
    
    return (lastPrice - firstPrice) / firstPrice;
  }

  private buildCalculationResult(
    levels: GridLevel[], 
    riskParams: any, 
    _symbol: string
  ): GridCalculationResult {
    const totalQuantity = levels.reduce((sum, level) => sum + level.quantity, 0);
    const requiredBalance = levels.reduce((sum, level) => sum + (level.price * level.quantity), 0);
    const estimatedProfit = this.estimateGridProfit(levels);
    const riskAssessment = this.assessGridRisk(levels, riskParams);

    return {
      levels,
      totalLevels: levels.length,
      totalQuantity,
      requiredBalance,
      estimatedProfit,
      riskAssessment
    };
  }

  private estimateGridProfit(levels: GridLevel[]): number {
    // Simple profit estimation based on grid spacing
    if (levels.length < 2) return 0;
    
    const avgSpacing = levels.slice(1).reduce((sum, level, index) => {
      return sum + Math.abs(level.price - levels[index].price);
    }, 0) / (levels.length - 1);
    
    return avgSpacing * levels.length * 0.5; // Rough estimate
  }

  private assessGridRisk(levels: GridLevel[], riskParams: any): GridRiskAssessment {
    const prices = levels.map(level => level.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    const maxPossibleLoss = (maxPrice - minPrice) * 0.5; // Simplified calculation
    const maxExposure = levels.reduce((sum, level) => sum + (level.price * level.quantity), 0);
    const breakEvenPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    let recommendation: 'safe' | 'moderate' | 'risky' | 'dangerous' = 'safe';
    if (maxExposure > (riskParams.maxExposure || 10000) * 0.8) recommendation = 'risky';
    if (maxExposure > (riskParams.maxExposure || 10000)) recommendation = 'dangerous';
    else if (maxExposure > (riskParams.maxExposure || 10000) * 0.5) recommendation = 'moderate';

    return {
      maxPossibleLoss,
      maxExposure,
      breakEvenPrice,
      liquidationRisk: 0.1, // Simplified
      recommendation
    };
  }

  private async adjustForWaveStructure(
    currentLevels: GridLevel[], 
    _waveStructure: WaveStructure, 
    currentPrice: number
  ): Promise<{ adjusted: GridLevel[]; removed: GridLevel[]; added: GridLevel[] }> {
    // Simplified wave-based adjustment
    const adjusted = currentLevels.filter(level => 
      Math.abs(level.price - currentPrice) / currentPrice < 0.1 // Keep levels within 10%
    );
    
    const removed = currentLevels.filter(level => !adjusted.includes(level));
    const added: GridLevel[] = []; // Would add new levels based on wave targets
    
    return { adjusted, removed, added };
  }

  private adjustForFibonacciLevels(
    currentLevels: GridLevel[], 
    fibonacciLevels: FibonacciLevels, 
    _currentPrice: number
  ): { adjusted: GridLevel[]; removed: GridLevel[]; added: GridLevel[] } {
    // Simplified Fibonacci-based adjustment
    const adjusted = currentLevels.map(level => ({
      ...level,
      // Adjust to nearest Fibonacci level if close
      price: this.adjustToNearestFibLevel(level.price, fibonacciLevels)
    }));
    
    return { adjusted, removed: [], added: [] };
  }

  private adjustForMarketConditions(
    currentLevels: GridLevel[], 
    conditions: any
  ): { adjusted: GridLevel[]; removed: GridLevel[]; added: GridLevel[] } {
    // Simplified market condition adjustment
    const volatilityMultiplier = 1 + (conditions.volatility || 0);
    
    const adjusted = currentLevels.map(level => ({
      ...level,
      quantity: level.quantity * volatilityMultiplier
    }));
    
    return { adjusted, removed: [], added: [] };
  }

  private adjustToNearestFibLevel(price: number, fibLevels: FibonacciLevels): number {
    const allLevels = [...fibLevels.retracements, ...fibLevels.extensions];
    const nearest = allLevels.reduce((closest, level) => 
      Math.abs(level.price - price) < Math.abs(closest.price - price) ? level : closest
    );
    
    // Only adjust if very close (within 1%)
    return Math.abs(nearest.price - price) / price < 0.01 ? nearest.price : price;
  }

  private calculateUnrealizedPnL(filledLevels: GridLevel[], currentPrice: number): number {
    return filledLevels.reduce((pnl, level) => {
      const direction = level.side === 'buy' ? 1 : -1;
      return pnl + ((currentPrice - level.price) * level.quantity * direction);
    }, 0);
  }

  private calculateGridPerformance(grid: Grid, filledLevels: GridLevel[]): GridPerformance {
    const totalTrades = filledLevels.length;
    const winningTrades = filledLevels.filter(level => (level.profit || 0) > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const totalFees = totalTrades * 0.001; // Simplified fee calculation
    const netProfit = grid.totalProfit - totalFees;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalProfit: grid.totalProfit,
      totalFees,
      netProfit,
      maxDrawdown: 0, // Would calculate from trade history
      sharpeRatio: 0 // Would calculate from returns
    };
  }

  private calculateRiskMetrics(grid: Grid, _currentPrice: number): any {
    const totalExposure = grid.levels.reduce((sum, level) => 
      sum + (level.price * level.quantity), 0
    );
    
    return {
      currentExposure: totalExposure,
      maxExposureReached: totalExposure,
      drawdown: 0,
      marginUtilization: 0.5,
      liquidationDistance: 0.2
    };
  }

  private checkWaveInvalidation(grid: Grid, waveStructure: WaveStructure, currentPrice: number): {
    isInvalidated: boolean;
    reason: string;
    levels: GridLevel[];
  } {
    // Check if wave structure has been invalidated
    const invalidation = this.elliottWaveService.monitorWaveInvalidation(waveStructure, currentPrice);
    
    if (invalidation.isInvalidated) {
      return {
        isInvalidated: true,
        reason: `Elliott Wave invalidation: ${invalidation.reason}`,
        levels: grid.levels.filter(level => level.waveContext)
      };
    }
    
    return { isInvalidated: false, reason: '', levels: [] };
  }

  private checkFibonacciInvalidation(grid: Grid, currentPrice: number): {
    isInvalidated: boolean;
    reason: string;
    levels: GridLevel[];
  } {
    // Check if price has moved significantly away from Fibonacci levels
    const fibLevels = grid.levels.filter(level => level.fibonacciLevel);
    const nearestFibLevel = fibLevels.reduce((closest, level) => 
      Math.abs(level.price - currentPrice) < Math.abs(closest.price - currentPrice) ? level : closest
    );
    
    if (nearestFibLevel && Math.abs(nearestFibLevel.price - currentPrice) / currentPrice > 0.1) {
      return {
        isInvalidated: true,
        reason: 'Price moved too far from Fibonacci levels',
        levels: fibLevels
      };
    }
    
    return { isInvalidated: false, reason: '', levels: [] };
  }

  private checkRiskInvalidation(grid: Grid, currentPrice: number): {
    isInvalidated: boolean;
    reason: string;
  } {
    // Check general risk conditions
    const unrealizedPnL = this.calculateUnrealizedPnL(
      grid.levels.filter(level => level.filled), 
      currentPrice
    );
    
    const maxDrawdown = grid.metadata?.riskParameters?.maxDrawdown || 0.1;
    const totalValue = grid.levels.reduce((sum, level) => sum + (level.price * level.quantity), 0);
    
    if (Math.abs(unrealizedPnL) / totalValue > maxDrawdown) {
      return {
        isInvalidated: true,
        reason: `Maximum drawdown exceeded: ${Math.abs(unrealizedPnL) / totalValue * 100}%`
      };
    }
    
    return { isInvalidated: false, reason: '' };
  }

  private findOptimalParameters(performanceData: any[], metric: string): any {
    // Simplified optimization - would use more sophisticated algorithms in production
    const sorted = performanceData.sort((a, b) => {
      switch (metric) {
        case 'profit':
          return b.profit - a.profit;
        case 'sharpe_ratio':
          return (b.performance?.sharpeRatio || 0) - (a.performance?.sharpeRatio || 0);
        case 'win_rate':
          return (b.performance?.winRate || 0) - (a.performance?.winRate || 0);
        default:
          return b.profit - a.profit;
      }
    });
    
    const best = sorted[0];
    
    return {
      spacing: best.spacing,
      levels: best.levels,
      quantity: 1, // Simplified
      expectedReturn: best.profit,
      expectedRisk: 0.1,
      backtestResults: {
        totalTrades: best.performance?.totalTrades || 0,
        winRate: best.performance?.winRate || 0,
        totalProfit: best.profit,
        maxDrawdown: best.performance?.maxDrawdown || 0,
        sharpeRatio: best.performance?.sharpeRatio || 0,
        calmarRatio: 0,
        profitFactor: 1
      }
    };
  }

  private async logGridEvent(gridId: string, type: GridEventType, data: any): Promise<void> {
    const event: GridEvent = {
      gridId,
      type,
      timestamp: Date.now(),
      data,
      description: this.getEventDescription(type, data)
    };
    
    if (!this.gridEvents.has(gridId)) {
      this.gridEvents.set(gridId, []);
    }
    
    this.gridEvents.get(gridId)!.push(event);
    
    logger.info(`Grid event: ${type}`, { gridId, data });
  }

  private getEventDescription(type: GridEventType, data: any): string {
    switch (type) {
      case 'rebalance_executed':
        return `Grid rebalanced: ${data.adjustedCount} levels adjusted`;
      case 'invalidation_triggered':
        return `Grid invalidated: ${data.reason}`;
      case 'level_filled':
        return `Grid level filled at ${data.price}`;
      default:
        return `Grid event: ${type}`;
    }
  }
}