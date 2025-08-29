/**
 * Enhanced Support and Resistance Level Detector
 * Advanced S/R detection with strength scoring and liquidity grab detection
 */

import { CandleData } from '../../types/market';
import { SupportResistanceLevel } from '../../types/analysis';

export interface EnhancedSRLevel extends SupportResistanceLevel {
  strengthScore: number;
  liquidityGrab: boolean;
  reversalPotential: number;
  volumeConfirmation: number;
  timeStrength: number;
  priceActionStrength: number;
}

export interface LiquidityGrab {
  timestamp: number;
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  reversalConfirmed: boolean;
  volumeSpike: number;
}

export interface EnhancedSRConfig {
  minTouches: number;
  touchTolerance: number;
  minStrength: number;
  lookbackPeriod: number;
  volumeWeighting: boolean;
  liquidityGrabThreshold: number;
  reversalConfirmationPeriod: number;
  strengthScoreWeights: {
    touches: number;
    volume: number;
    time: number;
    priceAction: number;
    rejection: number;
  };
}

export class EnhancedSupportResistanceDetector {
  private config: EnhancedSRConfig;

  constructor(config?: Partial<EnhancedSRConfig>) {
    this.config = {
      minTouches: 2,
      touchTolerance: 0.5,
      minStrength: 0.3,
      lookbackPeriod: 100,
      volumeWeighting: true,
      liquidityGrabThreshold: 1.5,
      reversalConfirmationPeriod: 5,
      strengthScoreWeights: {
        touches: 0.25,
        volume: 0.20,
        time: 0.15,
        priceAction: 0.20,
        rejection: 0.20,
      },
      ...config,
    };
  }

  /**
   * Detect enhanced support and resistance levels with strength scoring
   */
  async detectEnhancedLevels(candles: CandleData[]): Promise<EnhancedSRLevel[]> {
    if (candles.length < this.config.lookbackPeriod) {
      throw new Error(`Insufficient data for enhanced S/R detection. Need at least ${this.config.lookbackPeriod} candles`);
    }

    const levels: EnhancedSRLevel[] = [];

    // Method 1: Enhanced pivot point analysis
    const pivotLevels = await this.detectEnhancedPivotLevels(candles);
    levels.push(...pivotLevels);

    // Method 2: Dynamic horizontal levels with strength scoring
    const horizontalLevels = await this.detectDynamicHorizontalLevels(candles);
    levels.push(...horizontalLevels);

    // Method 3: Volume-weighted levels with liquidity analysis
    const volumeLevels = await this.detectVolumeWeightedLevels(candles);
    levels.push(...volumeLevels);

    // Merge and enhance levels
    const mergedLevels = this.mergeSimilarLevels(levels);
    const enhancedLevels = await this.enhanceLevelsWithScoring(mergedLevels, candles);

    return enhancedLevels
      .filter(level => level.strengthScore >= this.config.minStrength)
      .sort((a, b) => b.strengthScore - a.strengthScore);
  }

  /**
   * Detect liquidity grabs and potential reversals
   */
  async detectLiquidityGrabs(candles: CandleData[]): Promise<LiquidityGrab[]> {
    const grabs: LiquidityGrab[] = [];
    const levels = await this.detectEnhancedLevels(candles);

    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      // Check for liquidity grabs at support/resistance levels
      for (const level of levels) {
        const grab = this.analyzeLiquidityGrab(candles, i, level, current, previous);
        if (grab) {
          grabs.push(grab);
        }
      }
    }

    return grabs.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Calculate dynamic strength score for S/R levels
   */
  calculateDynamicStrengthScore(
    level: SupportResistanceLevel,
    candles: CandleData[],
    marketVolatility: number
  ): number {
    const weights = this.config.strengthScoreWeights;
    let score = 0;

    // Touch frequency score (adjusted for volatility)
    const touchScore = Math.min(1, level.touches / (5 + marketVolatility * 2));
    score += touchScore * weights.touches;

    // Volume confirmation score
    const volumeScore = this.calculateVolumeConfirmation(level, candles);
    score += volumeScore * weights.volume;

    // Time persistence score
    const timeScore = this.calculateTimeStrength(level, candles);
    score += timeScore * weights.time;

    // Price action strength score
    const priceActionScore = this.calculatePriceActionStrength(level, candles);
    score += priceActionScore * weights.priceAction;

    // Rejection strength score
    const rejectionScore = this.calculateRejectionStrength(level, candles);
    score += rejectionScore * weights.rejection;

    return Math.min(1, score);
  }

  /**
   * Detect enhanced pivot levels with advanced scoring
   */
  private async detectEnhancedPivotLevels(candles: CandleData[]): Promise<EnhancedSRLevel[]> {
    const levels: EnhancedSRLevel[] = [];
    const pivotDistance = 5;

    for (let i = pivotDistance; i < candles.length - pivotDistance; i++) {
      const current = candles[i];
      let isPivotHigh = true;
      let isPivotLow = true;

      // Enhanced pivot detection with volume confirmation
      for (let j = i - pivotDistance; j <= i + pivotDistance; j++) {
        if (j === i) continue;

        if (current.high <= candles[j].high) {
          isPivotHigh = false;
        }
        if (current.low >= candles[j].low) {
          isPivotLow = false;
        }
      }

      // Add enhanced pivot high as resistance
      if (isPivotHigh) {
        const touches = this.countEnhancedTouches(candles, current.high, 'resistance', i);
        if (touches >= this.config.minTouches) {
          const enhancedLevel = await this.createEnhancedLevel(
            current.high,
            'resistance',
            touches,
            current.timestamp,
            candles,
            i
          );
          levels.push(enhancedLevel);
        }
      }

      // Add enhanced pivot low as support
      if (isPivotLow) {
        const touches = this.countEnhancedTouches(candles, current.low, 'support', i);
        if (touches >= this.config.minTouches) {
          const enhancedLevel = await this.createEnhancedLevel(
            current.low,
            'support',
            touches,
            current.timestamp,
            candles,
            i
          );
          levels.push(enhancedLevel);
        }
      }
    }

    return levels;
  }

  /**
   * Detect dynamic horizontal levels with adaptive thresholds
   */
  private async detectDynamicHorizontalLevels(candles: CandleData[]): Promise<EnhancedSRLevel[]> {
    const levels: EnhancedSRLevel[] = [];
    const volatility = this.calculateMarketVolatility(candles);
    const adaptiveTolerance = this.config.touchTolerance * (1 + volatility);

    // Create price clusters with adaptive tolerance
    const priceClusters = this.createAdaptivePriceClusters(candles, adaptiveTolerance);

    for (const cluster of priceClusters) {
      if (cluster.touches >= this.config.minTouches) {
        const enhancedLevel = await this.createEnhancedLevel(
          cluster.price,
          cluster.type,
          cluster.touches,
          cluster.lastTouch,
          candles
        );
        levels.push(enhancedLevel);
      }
    }

    return levels;
  }

  /**
   * Detect volume-weighted levels with liquidity analysis
   */
  private async detectVolumeWeightedLevels(candles: CandleData[]): Promise<EnhancedSRLevel[]> {
    const levels: EnhancedSRLevel[] = [];
    const volumeProfile = this.calculateEnhancedVolumeProfile(candles);

    // Identify high-volume nodes with liquidity significance
    const significantNodes = volumeProfile.filter(node => 
      node.volume > this.calculateVolumeThreshold(candles) &&
      node.liquiditySignificance > 0.5
    );

    for (const node of significantNodes) {
      const touchData = this.analyzeEnhancedLevel(candles, node.price);
      
      if (touchData.touches >= 1) {
        const enhancedLevel = await this.createEnhancedLevel(
          node.price,
          touchData.type,
          touchData.touches,
          touchData.lastTouch,
          candles
        );
        
        // Boost strength for high-volume levels
        enhancedLevel.strengthScore *= (1 + node.liquiditySignificance * 0.3);
        enhancedLevel.volumeConfirmation = node.liquiditySignificance;
        
        levels.push(enhancedLevel);
      }
    }

    return levels;
  }

  /**
   * Analyze potential liquidity grab at a level
   */
  private analyzeLiquidityGrab(
    candles: CandleData[],
    currentIndex: number,
    level: EnhancedSRLevel,
    current: CandleData,
    previous: CandleData
  ): LiquidityGrab | null {
    const tolerance = level.price * (this.config.touchTolerance / 100);
    
    // Check for liquidity grab conditions
    let isLiquidityGrab = false;
    let volumeSpike = 0;

    if (level.type === 'support') {
      // Support liquidity grab: price breaks below support then quickly recovers
      const brokeSupport = current.low < (level.price - tolerance) && 
                          previous.low >= (level.price - tolerance);
      const quickRecovery = current.close > level.price;
      
      if (brokeSupport && quickRecovery) {
        isLiquidityGrab = true;
        volumeSpike = this.calculateVolumeSpike(candles, currentIndex);
      }
    } else {
      // Resistance liquidity grab: price breaks above resistance then quickly falls
      const brokeResistance = current.high > (level.price + tolerance) && 
                             previous.high <= (level.price + tolerance);
      const quickRejection = current.close < level.price;
      
      if (brokeResistance && quickRejection) {
        isLiquidityGrab = true;
        volumeSpike = this.calculateVolumeSpike(candles, currentIndex);
      }
    }

    if (!isLiquidityGrab) return null;

    // Confirm reversal in subsequent candles
    const reversalConfirmed = this.confirmReversal(candles, currentIndex, level);

    return {
      timestamp: current.timestamp,
      price: level.price,
      type: level.type,
      strength: Math.min(1, volumeSpike * level.strengthScore),
      reversalConfirmed,
      volumeSpike,
    };
  }

  /**
   * Create enhanced S/R level with comprehensive scoring
   */
  private async createEnhancedLevel(
    price: number,
    type: 'support' | 'resistance',
    touches: number,
    lastTouch: number,
    candles: CandleData[],
    _pivotIndex?: number
  ): Promise<EnhancedSRLevel> {
    const baseLevel: SupportResistanceLevel = {
      price,
      strength: 0.5,
      type,
      touches,
      lastTouch,
    };

    const marketVolatility = this.calculateMarketVolatility(candles);
    const strengthScore = this.calculateDynamicStrengthScore(baseLevel, candles, marketVolatility);
    const volumeConfirmation = this.calculateVolumeConfirmation(baseLevel, candles);
    const timeStrength = this.calculateTimeStrength(baseLevel, candles);
    const priceActionStrength = this.calculatePriceActionStrength(baseLevel, candles);
    const reversalPotential = this.calculateReversalPotential(baseLevel, candles);
    const liquidityGrab = await this.hasRecentLiquidityGrab(baseLevel, candles);

    return {
      ...baseLevel,
      strength: strengthScore,
      strengthScore,
      liquidityGrab,
      reversalPotential,
      volumeConfirmation,
      timeStrength,
      priceActionStrength,
    };
  }

  /**
   * Calculate volume confirmation score
   */
  private calculateVolumeConfirmation(level: SupportResistanceLevel, candles: CandleData[]): number {
    const tolerance = level.price * (this.config.touchTolerance / 100);
    let totalVolume = 0;
    let touchVolume = 0;
    let touchCount = 0;

    for (const candle of candles) {
      totalVolume += candle.volume;
      
      const touchedLevel = (level.type === 'support' && Math.abs(candle.low - level.price) <= tolerance) ||
                          (level.type === 'resistance' && Math.abs(candle.high - level.price) <= tolerance);
      
      if (touchedLevel) {
        touchVolume += candle.volume;
        touchCount++;
      }
    }

    if (touchCount === 0) return 0;

    const avgVolume = totalVolume / candles.length;
    const avgTouchVolume = touchVolume / touchCount;
    
    return Math.min(1, avgTouchVolume / avgVolume);
  }

  /**
   * Calculate time-based strength score
   */
  private calculateTimeStrength(level: SupportResistanceLevel, _candles: CandleData[]): number {
    const currentTime = Date.now();
    const levelAge = (currentTime - level.lastTouch) / (1000 * 60 * 60 * 24); // Days
    
    // Levels are stronger if they've persisted over time but not too old
    if (levelAge < 1) return 0.3; // Too recent
    if (levelAge > 30) return 0.1; // Too old
    
    // Peak strength around 7-14 days
    if (levelAge >= 7 && levelAge <= 14) return 1.0;
    if (levelAge >= 3 && levelAge <= 21) return 0.8;
    
    return 0.5;
  }

  /**
   * Calculate price action strength at the level
   */
  private calculatePriceActionStrength(level: SupportResistanceLevel, candles: CandleData[]): number {
    const tolerance = level.price * (this.config.touchTolerance / 100);
    let rejectionStrength = 0;
    let touchCount = 0;

    for (const candle of candles) {
      const touchedLevel = (level.type === 'support' && Math.abs(candle.low - level.price) <= tolerance) ||
                          (level.type === 'resistance' && Math.abs(candle.high - level.price) <= tolerance);
      
      if (touchedLevel) {
        touchCount++;
        
        // Calculate rejection strength based on wick size
        const bodySize = Math.abs(candle.close - candle.open);
        
        if (level.type === 'support') {
          const lowerWick = Math.min(candle.open, candle.close) - candle.low;
          const rejectionRatio = bodySize > 0 ? lowerWick / bodySize : 1;
          rejectionStrength += Math.min(1, rejectionRatio);
        } else {
          const upperWick = candle.high - Math.max(candle.open, candle.close);
          const rejectionRatio = bodySize > 0 ? upperWick / bodySize : 1;
          rejectionStrength += Math.min(1, rejectionRatio);
        }
      }
    }

    return touchCount > 0 ? rejectionStrength / touchCount : 0;
  }

  /**
   * Calculate rejection strength score
   */
  private calculateRejectionStrength(level: SupportResistanceLevel, candles: CandleData[]): number {
    // This is similar to price action strength but focuses specifically on rejection patterns
    return this.calculatePriceActionStrength(level, candles);
  }

  /**
   * Calculate reversal potential at the level
   */
  private calculateReversalPotential(level: SupportResistanceLevel, candles: CandleData[]): number {
    const recentCandles = candles.slice(-10);
    const currentPrice = candles[candles.length - 1].close;
    const distanceToLevel = Math.abs(currentPrice - level.price) / level.price;
    
    // Higher potential when price is closer to the level
    let potential = Math.max(0, 1 - (distanceToLevel * 10));
    
    // Boost potential based on recent price action toward the level
    const priceMovement = this.analyzePriceMovementTowardLevel(recentCandles, level);
    potential *= (1 + priceMovement * 0.5);
    
    return Math.min(1, potential);
  }

  /**
   * Check for recent liquidity grabs at the level
   */
  private async hasRecentLiquidityGrab(level: SupportResistanceLevel, candles: CandleData[]): Promise<boolean> {
    const recentCandles = candles.slice(-20); // Check last 20 candles
    const grabs = await this.detectLiquidityGrabs(recentCandles);
    
    return grabs.some(grab => 
      Math.abs(grab.price - level.price) / level.price < 0.01 && // Within 1%
      grab.type === level.type
    );
  }

  /**
   * Enhanced touch counting with volume weighting
   */
  private countEnhancedTouches(
    candles: CandleData[],
    level: number,
    type: 'support' | 'resistance',
    excludeIndex?: number
  ): number {
    let touches = 0;
    const tolerance = level * (this.config.touchTolerance / 100);

    for (let i = 0; i < candles.length; i++) {
      if (excludeIndex !== undefined && i === excludeIndex) continue;

      const candle = candles[i];
      let touchedLevel = false;
      
      if (type === 'resistance') {
        touchedLevel = Math.abs(candle.high - level) <= tolerance;
      } else {
        touchedLevel = Math.abs(candle.low - level) <= tolerance;
      }

      if (touchedLevel) {
        // Weight touches by volume (higher volume = stronger touch)
        const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
        const volumeWeight = Math.min(2, candle.volume / avgVolume);
        touches += volumeWeight;
      }
    }

    return Math.round(touches);
  }

  /**
   * Calculate market volatility for adaptive thresholds
   */
  private calculateMarketVolatility(candles: CandleData[]): number {
    if (candles.length < 20) return 0.5;

    const returns = candles.slice(1).map((candle, i) => 
      Math.log(candle.close / candles[i].close)
    );

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  /**
   * Create adaptive price clusters based on market conditions
   */
  private createAdaptivePriceClusters(candles: CandleData[], _tolerance: number): Array<{
    price: number;
    touches: number;
    type: 'support' | 'resistance';
    lastTouch: number;
  }> {
    const clusters: Map<number, {
      touches: number;
      supportTouches: number;
      resistanceTouches: number;
      lastTouch: number;
    }> = new Map();

    const priceStep = this.calculateAdaptivePriceStep(candles);

    for (const candle of candles) {
      const roundedHigh = Math.round(candle.high / priceStep) * priceStep;
      const roundedLow = Math.round(candle.low / priceStep) * priceStep;

      // Update high cluster
      const highCluster = clusters.get(roundedHigh) || {
        touches: 0,
        supportTouches: 0,
        resistanceTouches: 0,
        lastTouch: 0,
      };
      highCluster.touches++;
      highCluster.resistanceTouches++;
      highCluster.lastTouch = Math.max(highCluster.lastTouch, candle.timestamp);
      clusters.set(roundedHigh, highCluster);

      // Update low cluster
      const lowCluster = clusters.get(roundedLow) || {
        touches: 0,
        supportTouches: 0,
        resistanceTouches: 0,
        lastTouch: 0,
      };
      lowCluster.touches++;
      lowCluster.supportTouches++;
      lowCluster.lastTouch = Math.max(lowCluster.lastTouch, candle.timestamp);
      clusters.set(roundedLow, lowCluster);
    }

    return Array.from(clusters.entries())
      .map(([price, data]) => ({
        price,
        touches: data.touches,
        type: data.supportTouches > data.resistanceTouches ? 'support' as const : 'resistance' as const,
        lastTouch: data.lastTouch,
      }))
      .filter(cluster => cluster.touches >= 2);
  }

  /**
   * Calculate enhanced volume profile with liquidity significance
   */
  private calculateEnhancedVolumeProfile(candles: CandleData[]): Array<{
    price: number;
    volume: number;
    liquiditySignificance: number;
  }> {
    const priceStep = this.calculateAdaptivePriceStep(candles);
    const volumeMap = new Map<number, { volume: number; occurrences: number }>();

    for (const candle of candles) {
      const priceRange = candle.high - candle.low;
      const steps = Math.max(1, Math.round(priceRange / priceStep));
      const volumePerStep = candle.volume / steps;

      for (let i = 0; i < steps; i++) {
        const price = candle.low + (i * priceStep);
        const roundedPrice = Math.round(price / priceStep) * priceStep;
        
        const existing = volumeMap.get(roundedPrice) || { volume: 0, occurrences: 0 };
        existing.volume += volumePerStep;
        existing.occurrences++;
        volumeMap.set(roundedPrice, existing);
      }
    }

    const totalVolume = Array.from(volumeMap.values()).reduce((sum, data) => sum + data.volume, 0);

    return Array.from(volumeMap.entries())
      .map(([price, data]) => ({
        price,
        volume: data.volume,
        liquiditySignificance: (data.volume / totalVolume) * Math.log(data.occurrences + 1),
      }))
      .sort((a, b) => b.liquiditySignificance - a.liquiditySignificance);
  }

  /**
   * Calculate adaptive price step based on market conditions
   */
  private calculateAdaptivePriceStep(candles: CandleData[]): number {
    const prices = candles.map(c => c.close);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const volatility = this.calculateMarketVolatility(candles);
    
    // Adjust step size based on volatility
    const baseStep = avgPrice * 0.001;
    return baseStep * (1 + volatility * 0.5);
  }

  /**
   * Calculate volume threshold for significant nodes
   */
  private calculateVolumeThreshold(candles: CandleData[]): number {
    const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
    const volumeStdDev = Math.sqrt(
      candles.reduce((sum, c) => sum + Math.pow(c.volume - avgVolume, 2), 0) / candles.length
    );
    
    return avgVolume + volumeStdDev;
  }

  /**
   * Analyze enhanced level characteristics
   */
  private analyzeEnhancedLevel(candles: CandleData[], level: number): {
    touches: number;
    type: 'support' | 'resistance';
    lastTouch: number;
  } {
    const tolerance = level * (this.config.touchTolerance / 100);
    let supportTouches = 0;
    let resistanceTouches = 0;
    let lastTouch = 0;

    for (const candle of candles) {
      if (Math.abs(candle.low - level) <= tolerance) {
        supportTouches++;
        lastTouch = Math.max(lastTouch, candle.timestamp);
      }
      if (Math.abs(candle.high - level) <= tolerance) {
        resistanceTouches++;
        lastTouch = Math.max(lastTouch, candle.timestamp);
      }
    }

    return {
      touches: supportTouches + resistanceTouches,
      type: supportTouches > resistanceTouches ? 'support' : 'resistance',
      lastTouch,
    };
  }

  /**
   * Calculate volume spike at specific index
   */
  private calculateVolumeSpike(candles: CandleData[], index: number): number {
    if (index < 10) return 0;

    const current = candles[index];
    const avgVolume = candles.slice(index - 10, index).reduce((sum, c) => sum + c.volume, 0) / 10;
    
    return avgVolume > 0 ? current.volume / avgVolume : 1;
  }

  /**
   * Confirm reversal after liquidity grab
   */
  private confirmReversal(candles: CandleData[], grabIndex: number, level: EnhancedSRLevel): boolean {
    const confirmationPeriod = this.config.reversalConfirmationPeriod;
    const endIndex = Math.min(grabIndex + confirmationPeriod, candles.length - 1);
    
    if (endIndex <= grabIndex) return false;

    const confirmationCandles = candles.slice(grabIndex + 1, endIndex + 1);
    
    if (level.type === 'support') {
      // For support, look for price staying above the level
      return confirmationCandles.every(candle => candle.close > level.price);
    } else {
      // For resistance, look for price staying below the level
      return confirmationCandles.every(candle => candle.close < level.price);
    }
  }

  /**
   * Analyze price movement toward a level
   */
  private analyzePriceMovementTowardLevel(candles: CandleData[], level: SupportResistanceLevel): number {
    if (candles.length < 2) return 0;

    const startPrice = candles[0].close;
    const endPrice = candles[candles.length - 1].close;
    
    const startDistance = Math.abs(startPrice - level.price);
    const endDistance = Math.abs(endPrice - level.price);
    
    // Return positive value if moving toward level, negative if moving away
    return startDistance > 0 ? (startDistance - endDistance) / startDistance : 0;
  }

  /**
   * Merge similar levels with enhanced logic
   */
  private mergeSimilarLevels(levels: EnhancedSRLevel[]): EnhancedSRLevel[] {
    if (levels.length === 0) return [];

    const merged: EnhancedSRLevel[] = [];
    const sorted = levels.sort((a, b) => a.price - b.price);

    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      const priceDiff = Math.abs(next.price - current.price) / current.price;

      if (priceDiff < 0.01 && next.type === current.type) {
        // Merge levels with weighted average
        const totalWeight = current.strengthScore + next.strengthScore;
        current.price = (current.price * current.strengthScore + next.price * next.strengthScore) / totalWeight;
        current.strengthScore = Math.max(current.strengthScore, next.strengthScore);
        current.touches += next.touches;
        current.lastTouch = Math.max(current.lastTouch, next.lastTouch);
        current.volumeConfirmation = Math.max(current.volumeConfirmation, next.volumeConfirmation);
        current.liquidityGrab = current.liquidityGrab || next.liquidityGrab;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Enhance levels with comprehensive scoring
   */
  private async enhanceLevelsWithScoring(levels: EnhancedSRLevel[], candles: CandleData[]): Promise<EnhancedSRLevel[]> {
    const marketVolatility = this.calculateMarketVolatility(candles);

    return levels.map(level => {
      const enhancedScore = this.calculateDynamicStrengthScore(level, candles, marketVolatility);
      return {
        ...level,
        strengthScore: enhancedScore,
        strength: enhancedScore,
      };
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EnhancedSRConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): EnhancedSRConfig {
    return { ...this.config };
  }
}