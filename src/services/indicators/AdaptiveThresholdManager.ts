/**
 * Adaptive Threshold Manager
 * Dynamically adjusts technical analysis thresholds based on market volatility and conditions
 */

import { CandleData } from '../../types/market';
import { TechnicalIndicators, MarketRegime } from '../../types/analysis';

export interface AdaptiveThresholds {
  rsi: {
    oversold: number;
    overbought: number;
    neutral: [number, number];
  };
  waveTrend: {
    buyThreshold: number;
    sellThreshold: number;
    extremeLevel: number;
  };
  volume: {
    spikeThreshold: number;
    lowVolumeThreshold: number;
  };
  volatility: {
    lowVolatility: number;
    highVolatility: number;
  };
  confidence: {
    minConfidence: number;
    strongConfidence: number;
  };
}

export interface MarketConditions {
  volatility: number;
  regime: MarketRegime;
  trendStrength: number;
  volumeProfile: 'low' | 'medium' | 'high';
  timeOfDay?: 'asian' | 'london' | 'newyork' | 'overlap';
  marketSession?: 'active' | 'quiet';
}

export interface ThresholdAdjustment {
  indicator: string;
  originalValue: number;
  adjustedValue: number;
  adjustmentFactor: number;
  reason: string;
}

export interface AdaptiveConfig {
  volatilityWindow: number;
  adaptationSpeed: number; // How quickly thresholds adapt (0-1)
  maxAdjustment: number; // Maximum adjustment percentage
  minDataPoints: number;
  sessionAdjustments: {
    asian: number;
    london: number;
    newyork: number;
    overlap: number;
  };
  regimeAdjustments: {
    trending: number;
    ranging: number;
    breakout: number;
    reversal: number;
  };
}

export class AdaptiveThresholdManager {
  private config: AdaptiveConfig;
  private baseThresholds: AdaptiveThresholds;
  private currentThresholds: AdaptiveThresholds;
  private adjustmentHistory: ThresholdAdjustment[] = [];

  constructor(
    baseThresholds: AdaptiveThresholds,
    config?: Partial<AdaptiveConfig>
  ) {
    this.baseThresholds = { ...baseThresholds };
    this.currentThresholds = { ...baseThresholds };
    
    this.config = {
      volatilityWindow: 20,
      adaptationSpeed: 0.3,
      maxAdjustment: 0.5, // 50% max adjustment
      minDataPoints: 10,
      sessionAdjustments: {
        asian: 0.8,    // Lower volatility, tighter thresholds
        london: 1.2,   // Higher volatility, wider thresholds
        newyork: 1.1,  // Moderate adjustment
        overlap: 1.3,  // Highest volatility periods
      },
      regimeAdjustments: {
        trending: 1.1,   // Slightly wider thresholds in trends
        ranging: 0.9,    // Tighter thresholds in ranges
        breakout: 1.4,   // Much wider thresholds during breakouts
        reversal: 0.8,   // Tighter thresholds for reversal detection
      },
      ...config,
    };
  }

  /**
   * Update thresholds based on current market conditions
   */
  async updateThresholds(
    candles: CandleData[],
    indicators: TechnicalIndicators[],
    marketConditions: MarketConditions
  ): Promise<AdaptiveThresholds> {
    if (candles.length < this.config.minDataPoints) {
      return this.currentThresholds;
    }

    const adjustments: ThresholdAdjustment[] = [];

    // Calculate market volatility
    const volatility = this.calculateRollingVolatility(candles);
    
    // Update RSI thresholds
    const rsiAdjustments = await this.adjustRSIThresholds(
      indicators,
      volatility,
      marketConditions
    );
    adjustments.push(...rsiAdjustments);

    // Update Wave Trend thresholds
    const wtAdjustments = await this.adjustWaveTrendThresholds(
      indicators,
      volatility,
      marketConditions
    );
    adjustments.push(...wtAdjustments);

    // Update Volume thresholds
    const volumeAdjustments = await this.adjustVolumeThresholds(
      candles,
      volatility,
      marketConditions
    );
    adjustments.push(...volumeAdjustments);

    // Update Volatility thresholds
    const volatilityAdjustments = await this.adjustVolatilityThresholds(
      volatility,
      marketConditions
    );
    adjustments.push(...volatilityAdjustments);

    // Update Confidence thresholds
    const confidenceAdjustments = await this.adjustConfidenceThresholds(
      marketConditions,
      volatility
    );
    adjustments.push(...confidenceAdjustments);

    // Store adjustment history
    this.adjustmentHistory.push(...adjustments);
    
    // Keep only recent adjustments
    if (this.adjustmentHistory.length > 100) {
      this.adjustmentHistory = this.adjustmentHistory.slice(-100);
    }

    return this.currentThresholds;
  }

  /**
   * Adjust RSI thresholds based on market conditions
   */
  private async adjustRSIThresholds(
    indicators: TechnicalIndicators[],
    volatility: number,
    conditions: MarketConditions
  ): Promise<ThresholdAdjustment[]> {
    const adjustments: ThresholdAdjustment[] = [];
    
    if (indicators.length < this.config.minDataPoints) {
      return adjustments;
    }

    // Calculate RSI distribution
    const rsiValues = indicators.slice(-this.config.volatilityWindow).map(i => i.rsi);
    const rsiMean = rsiValues.reduce((sum, val) => sum + val, 0) / rsiValues.length;
    const rsiStdDev = Math.sqrt(
      rsiValues.reduce((sum, val) => sum + Math.pow(val - rsiMean, 2), 0) / rsiValues.length
    );

    // Base adjustments
    let volatilityFactor = 1 + (volatility - 0.2) * 0.5; // Adjust based on volatility
    let regimeFactor = this.config.regimeAdjustments[conditions.regime.type];
    let sessionFactor = conditions.timeOfDay ? this.config.sessionAdjustments[conditions.timeOfDay] : 1;

    // Combine factors
    const totalFactor = volatilityFactor * regimeFactor * sessionFactor;
    const clampedFactor = Math.max(
      1 - this.config.maxAdjustment,
      Math.min(1 + this.config.maxAdjustment, totalFactor)
    );

    // Adjust oversold threshold
    const originalOversold = this.baseThresholds.rsi.oversold;
    const adjustedOversold = Math.max(
      15,
      Math.min(40, originalOversold * (2 - clampedFactor))
    );
    
    if (Math.abs(adjustedOversold - this.currentThresholds.rsi.oversold) > 1) {
      this.currentThresholds.rsi.oversold = this.smoothAdjustment(
        this.currentThresholds.rsi.oversold,
        adjustedOversold
      );
      
      adjustments.push({
        indicator: 'RSI_Oversold',
        originalValue: originalOversold,
        adjustedValue: this.currentThresholds.rsi.oversold,
        adjustmentFactor: clampedFactor,
        reason: `Volatility: ${volatility.toFixed(3)}, Regime: ${conditions.regime.type}, Session: ${conditions.timeOfDay || 'unknown'}`,
      });
    }

    // Adjust overbought threshold
    const originalOverbought = this.baseThresholds.rsi.overbought;
    const adjustedOverbought = Math.max(
      60,
      Math.min(85, originalOverbought * clampedFactor)
    );
    
    if (Math.abs(adjustedOverbought - this.currentThresholds.rsi.overbought) > 1) {
      this.currentThresholds.rsi.overbought = this.smoothAdjustment(
        this.currentThresholds.rsi.overbought,
        adjustedOverbought
      );
      
      adjustments.push({
        indicator: 'RSI_Overbought',
        originalValue: originalOverbought,
        adjustedValue: this.currentThresholds.rsi.overbought,
        adjustmentFactor: clampedFactor,
        reason: `Volatility: ${volatility.toFixed(3)}, Regime: ${conditions.regime.type}`,
      });
    }

    // Adjust neutral zone based on RSI distribution
    const neutralExpansion = Math.min(10, rsiStdDev * 0.5);
    this.currentThresholds.rsi.neutral = [
      Math.max(35, 50 - neutralExpansion),
      Math.min(65, 50 + neutralExpansion),
    ];

    return adjustments;
  }

  /**
   * Adjust Wave Trend thresholds
   */
  private async adjustWaveTrendThresholds(
    indicators: TechnicalIndicators[],
    volatility: number,
    conditions: MarketConditions
  ): Promise<ThresholdAdjustment[]> {
    const adjustments: ThresholdAdjustment[] = [];
    
    if (indicators.length < this.config.minDataPoints) {
      return adjustments;
    }

    // Calculate Wave Trend statistics
    const wt1Values = indicators.slice(-this.config.volatilityWindow).map(i => i.waveTrend.wt1);
    const wt2Values = indicators.slice(-this.config.volatilityWindow).map(i => i.waveTrend.wt2);
    
    const wt1Range = Math.max(...wt1Values) - Math.min(...wt1Values);
    const wt2Range = Math.max(...wt2Values) - Math.min(...wt2Values);
    const avgRange = (wt1Range + wt2Range) / 2;

    // Adjust thresholds based on Wave Trend range and volatility
    let adjustmentFactor = 1 + (volatility - 0.2) * 0.3;
    adjustmentFactor *= this.config.regimeAdjustments[conditions.regime.type];
    
    if (conditions.timeOfDay) {
      adjustmentFactor *= this.config.sessionAdjustments[conditions.timeOfDay];
    }

    // Clamp adjustment
    adjustmentFactor = Math.max(
      1 - this.config.maxAdjustment,
      Math.min(1 + this.config.maxAdjustment, adjustmentFactor)
    );

    // Adjust buy threshold
    const originalBuyThreshold = this.baseThresholds.waveTrend.buyThreshold;
    const adjustedBuyThreshold = originalBuyThreshold * adjustmentFactor;
    
    this.currentThresholds.waveTrend.buyThreshold = this.smoothAdjustment(
      this.currentThresholds.waveTrend.buyThreshold,
      adjustedBuyThreshold
    );

    // Adjust sell threshold
    const originalSellThreshold = this.baseThresholds.waveTrend.sellThreshold;
    const adjustedSellThreshold = originalSellThreshold * adjustmentFactor;
    
    this.currentThresholds.waveTrend.sellThreshold = this.smoothAdjustment(
      this.currentThresholds.waveTrend.sellThreshold,
      adjustedSellThreshold
    );

    // Adjust extreme level based on recent range
    const extremeAdjustment = Math.min(1.5, avgRange / 100);
    this.currentThresholds.waveTrend.extremeLevel = this.baseThresholds.waveTrend.extremeLevel * (1 + extremeAdjustment);

    adjustments.push({
      indicator: 'WaveTrend_Thresholds',
      originalValue: originalBuyThreshold,
      adjustedValue: this.currentThresholds.waveTrend.buyThreshold,
      adjustmentFactor,
      reason: `Range adaptation: ${avgRange.toFixed(1)}, Volatility: ${volatility.toFixed(3)}`,
    });

    return adjustments;
  }

  /**
   * Adjust volume thresholds
   */
  private async adjustVolumeThresholds(
    candles: CandleData[],
    volatility: number,
    conditions: MarketConditions
  ): Promise<ThresholdAdjustment[]> {
    const adjustments: ThresholdAdjustment[] = [];
    
    if (candles.length < this.config.volatilityWindow) {
      return adjustments;
    }

    // Calculate volume statistics
    const recentVolumes = candles.slice(-this.config.volatilityWindow).map(c => c.volume);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const volumeStdDev = Math.sqrt(
      recentVolumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / recentVolumes.length
    );

    // Adjust spike threshold based on volume volatility
    const volumeVolatility = volumeStdDev / avgVolume;
    let spikeAdjustment = 1 + volumeVolatility * 0.5;
    
    // Session adjustments
    if (conditions.timeOfDay) {
      spikeAdjustment *= this.config.sessionAdjustments[conditions.timeOfDay];
    }

    // Market regime adjustments
    spikeAdjustment *= this.config.regimeAdjustments[conditions.regime.type];

    const originalSpikeThreshold = this.baseThresholds.volume.spikeThreshold;
    const adjustedSpikeThreshold = originalSpikeThreshold * spikeAdjustment;
    
    this.currentThresholds.volume.spikeThreshold = this.smoothAdjustment(
      this.currentThresholds.volume.spikeThreshold,
      adjustedSpikeThreshold
    );

    // Adjust low volume threshold
    const lowVolumeAdjustment = 1 - volumeVolatility * 0.3;
    const adjustedLowVolumeThreshold = this.baseThresholds.volume.lowVolumeThreshold * lowVolumeAdjustment;
    
    this.currentThresholds.volume.lowVolumeThreshold = this.smoothAdjustment(
      this.currentThresholds.volume.lowVolumeThreshold,
      adjustedLowVolumeThreshold
    );

    adjustments.push({
      indicator: 'Volume_Spike',
      originalValue: originalSpikeThreshold,
      adjustedValue: this.currentThresholds.volume.spikeThreshold,
      adjustmentFactor: spikeAdjustment,
      reason: `Volume volatility: ${(volumeVolatility * 100).toFixed(1)}%, Session: ${conditions.timeOfDay || 'unknown'}`,
    });

    return adjustments;
  }

  /**
   * Adjust volatility thresholds
   */
  private async adjustVolatilityThresholds(
    currentVolatility: number,
    conditions: MarketConditions
  ): Promise<ThresholdAdjustment[]> {
    const adjustments: ThresholdAdjustment[] = [];

    // Adaptive volatility thresholds based on recent market behavior
    const volatilityTrend = this.calculateVolatilityTrend();
    
    // Adjust low volatility threshold
    let lowVolAdjustment = 1;
    if (volatilityTrend > 0.1) {
      lowVolAdjustment = 1.2; // Raise threshold when volatility is increasing
    } else if (volatilityTrend < -0.1) {
      lowVolAdjustment = 0.8; // Lower threshold when volatility is decreasing
    }

    const originalLowVol = this.baseThresholds.volatility.lowVolatility;
    const adjustedLowVol = originalLowVol * lowVolAdjustment;
    
    this.currentThresholds.volatility.lowVolatility = this.smoothAdjustment(
      this.currentThresholds.volatility.lowVolatility,
      adjustedLowVol
    );

    // Adjust high volatility threshold
    let highVolAdjustment = 1;
    if (conditions.regime.type === 'breakout') {
      highVolAdjustment = 1.3; // Higher threshold during breakouts
    } else if (conditions.regime.type === 'ranging') {
      highVolAdjustment = 0.8; // Lower threshold in ranging markets
    }

    const originalHighVol = this.baseThresholds.volatility.highVolatility;
    const adjustedHighVol = originalHighVol * highVolAdjustment;
    
    this.currentThresholds.volatility.highVolatility = this.smoothAdjustment(
      this.currentThresholds.volatility.highVolatility,
      adjustedHighVol
    );

    adjustments.push({
      indicator: 'Volatility_Thresholds',
      originalValue: originalLowVol,
      adjustedValue: this.currentThresholds.volatility.lowVolatility,
      adjustmentFactor: lowVolAdjustment,
      reason: `Volatility trend: ${(volatilityTrend * 100).toFixed(1)}%, Regime: ${conditions.regime.type}`,
    });

    return adjustments;
  }

  /**
   * Adjust confidence thresholds
   */
  private async adjustConfidenceThresholds(
    conditions: MarketConditions,
    volatility: number
  ): Promise<ThresholdAdjustment[]> {
    const adjustments: ThresholdAdjustment[] = [];

    // Adjust confidence requirements based on market conditions
    let confidenceAdjustment = 1;

    // Higher confidence required in volatile markets
    if (volatility > 0.4) {
      confidenceAdjustment = 1.2;
    } else if (volatility < 0.1) {
      confidenceAdjustment = 0.9;
    }

    // Regime-based adjustments
    switch (conditions.regime.type) {
      case 'trending':
        confidenceAdjustment *= 0.9; // Lower confidence needed in strong trends
        break;
      case 'ranging':
        confidenceAdjustment *= 1.1; // Higher confidence needed in ranges
        break;
      case 'breakout':
        confidenceAdjustment *= 1.3; // Much higher confidence needed for breakouts
        break;
      case 'reversal':
        confidenceAdjustment *= 1.2; // Higher confidence for reversals
        break;
    }

    // Session adjustments
    if (conditions.timeOfDay === 'overlap') {
      confidenceAdjustment *= 0.9; // Lower confidence needed during high-liquidity periods
    } else if (conditions.timeOfDay === 'asian') {
      confidenceAdjustment *= 1.1; // Higher confidence needed during low-liquidity periods
    }

    const originalMinConfidence = this.baseThresholds.confidence.minConfidence;
    const adjustedMinConfidence = Math.min(0.9, originalMinConfidence * confidenceAdjustment);
    
    this.currentThresholds.confidence.minConfidence = this.smoothAdjustment(
      this.currentThresholds.confidence.minConfidence,
      adjustedMinConfidence
    );

    const originalStrongConfidence = this.baseThresholds.confidence.strongConfidence;
    const adjustedStrongConfidence = Math.min(0.95, originalStrongConfidence * confidenceAdjustment);
    
    this.currentThresholds.confidence.strongConfidence = this.smoothAdjustment(
      this.currentThresholds.confidence.strongConfidence,
      adjustedStrongConfidence
    );

    adjustments.push({
      indicator: 'Confidence_Thresholds',
      originalValue: originalMinConfidence,
      adjustedValue: this.currentThresholds.confidence.minConfidence,
      adjustmentFactor: confidenceAdjustment,
      reason: `Volatility: ${volatility.toFixed(3)}, Regime: ${conditions.regime.type}, Session: ${conditions.timeOfDay || 'unknown'}`,
    });

    return adjustments;
  }

  /**
   * Calculate rolling volatility
   */
  private calculateRollingVolatility(candles: CandleData[]): number {
    if (candles.length < this.config.volatilityWindow) {
      return 0.2; // Default volatility
    }

    const recentCandles = candles.slice(-this.config.volatilityWindow);
    const returns = recentCandles.slice(1).map((candle, i) => 
      Math.log(candle.close / recentCandles[i].close)
    );

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  /**
   * Calculate volatility trend
   */
  private calculateVolatilityTrend(): number {
    if (this.adjustmentHistory.length < 5) {
      return 0;
    }

    const recentVolatilityAdjustments = this.adjustmentHistory
      .filter(adj => adj.indicator.includes('Volatility'))
      .slice(-5)
      .map(adj => adj.adjustmentFactor);

    if (recentVolatilityAdjustments.length < 2) {
      return 0;
    }

    const first = recentVolatilityAdjustments[0];
    const last = recentVolatilityAdjustments[recentVolatilityAdjustments.length - 1];
    
    return (last - first) / recentVolatilityAdjustments.length;
  }

  /**
   * Smooth threshold adjustments to prevent oscillation
   */
  private smoothAdjustment(current: number, target: number): number {
    const maxChange = Math.abs(current) * 0.1; // Max 10% change per update
    const change = target - current;
    const clampedChange = Math.max(-maxChange, Math.min(maxChange, change));
    
    return current + (clampedChange * this.config.adaptationSpeed);
  }

  /**
   * Get current thresholds
   */
  getCurrentThresholds(): AdaptiveThresholds {
    return { ...this.currentThresholds };
  }

  /**
   * Get base thresholds
   */
  getBaseThresholds(): AdaptiveThresholds {
    return { ...this.baseThresholds };
  }

  /**
   * Get adjustment history
   */
  getAdjustmentHistory(): ThresholdAdjustment[] {
    return [...this.adjustmentHistory];
  }

  /**
   * Reset thresholds to base values
   */
  resetThresholds(): void {
    this.currentThresholds = { ...this.baseThresholds };
    this.adjustmentHistory = [];
  }

  /**
   * Get threshold effectiveness metrics
   */
  getEffectivenessMetrics(): {
    totalAdjustments: number;
    averageAdjustment: number;
    mostAdjustedIndicator: string;
    stabilityScore: number;
  } {
    if (this.adjustmentHistory.length === 0) {
      return {
        totalAdjustments: 0,
        averageAdjustment: 0,
        mostAdjustedIndicator: 'none',
        stabilityScore: 1,
      };
    }

    const totalAdjustments = this.adjustmentHistory.length;
    const averageAdjustment = this.adjustmentHistory.reduce(
      (sum, adj) => sum + Math.abs(adj.adjustmentFactor - 1), 0
    ) / totalAdjustments;

    // Find most adjusted indicator
    const indicatorCounts = this.adjustmentHistory.reduce((counts, adj) => {
      counts[adj.indicator] = (counts[adj.indicator] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const mostAdjustedIndicator = Object.entries(indicatorCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';

    // Calculate stability score (lower is more stable)
    const recentAdjustments = this.adjustmentHistory.slice(-20);
    const adjustmentVariance = recentAdjustments.length > 1 ? 
      this.calculateVariance(recentAdjustments.map(adj => adj.adjustmentFactor)) : 0;
    const stabilityScore = Math.max(0, 1 - adjustmentVariance);

    return {
      totalAdjustments,
      averageAdjustment,
      mostAdjustedIndicator,
      stabilityScore,
    };
  }

  /**
   * Calculate variance of values
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AdaptiveConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AdaptiveConfig {
    return { ...this.config };
  }
}