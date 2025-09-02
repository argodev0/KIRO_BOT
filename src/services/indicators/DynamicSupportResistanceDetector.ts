/**
 * Dynamic Support Resistance Detector
 * Advanced support/resistance detection with volume and price action confirmation
 */

import { CandleData } from '../../types/market';

export interface DynamicSRLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  volumeConfirmation: number;
  priceActionConfirmation: number;
  dynamicAdjustment: number;
  touches: number;
  lastTouch: number;
  age: number;
}

export interface VolumeConfirmation {
  level: number;
  volumeSpike: number;
  confirmation: 'strong' | 'moderate' | 'weak';
}

export interface PriceActionConfirmation {
  level: number;
  rejections: number;
  bounces: number;
  confirmation: 'strong' | 'moderate' | 'weak';
}

export interface SRCluster {
  centerPrice: number;
  levels: DynamicSRLevel[];
  combinedStrength: number;
  type: 'support' | 'resistance' | 'pivot';
}

export class DynamicSupportResistanceDetector {
  private readonly TOUCH_TOLERANCE = 0.002; // 0.2% price tolerance
  private readonly MIN_TOUCHES = 2;
  private readonly VOLUME_SPIKE_THRESHOLD = 1.5;
  private readonly CLUSTER_TOLERANCE = 0.005; // 0.5% for clustering

  /**
   * Detect dynamic support and resistance levels
   */
  async detectDynamicLevels(candles: CandleData[]): Promise<DynamicSRLevel[]> {
    if (candles.length < 20) {
      throw new Error('Insufficient data for support/resistance detection');
    }

    const levels: DynamicSRLevel[] = [];
    
    // Find swing points
    const swingPoints = this.findSwingPoints(candles);
    
    // Group swing points into potential levels
    const potentialLevels = this.groupSwingPoints(swingPoints, candles);
    
    // Analyze each potential level
    for (const potentialLevel of potentialLevels) {
      const level = await this.analyzePotentialLevel(potentialLevel, candles);
      if (level && level.touches >= this.MIN_TOUCHES) {
        levels.push(level);
      }
    }

    // Apply dynamic adjustments
    const adjustedLevels = await this.applyDynamicAdjustments(levels, candles);
    
    // Filter and rank levels
    return this.filterAndRankLevels(adjustedLevels);
  }

  /**
   * Analyze volume confirmation for support/resistance levels
   */
  async analyzeVolumeConfirmation(
    candles: CandleData[],
    levels: DynamicSRLevel[]
  ): Promise<VolumeConfirmation[]> {
    const confirmations: VolumeConfirmation[] = [];
    const avgVolume = this.calculateAverageVolume(candles);

    for (const level of levels) {
      const nearbyCandles = this.findCandlesNearLevel(level.price, candles, this.TOUCH_TOLERANCE);
      
      if (nearbyCandles.length === 0) {
        confirmations.push({
          level: level.price,
          volumeSpike: 0,
          confirmation: 'weak',
        });
        continue;
      }

      const levelVolume = nearbyCandles.reduce((sum, c) => sum + c.volume, 0) / nearbyCandles.length;
      const volumeSpike = levelVolume / avgVolume;
      
      let confirmation: 'strong' | 'moderate' | 'weak';
      if (volumeSpike >= 2.0) {
        confirmation = 'strong';
      } else if (volumeSpike >= this.VOLUME_SPIKE_THRESHOLD) {
        confirmation = 'moderate';
      } else {
        confirmation = 'weak';
      }

      confirmations.push({
        level: level.price,
        volumeSpike,
        confirmation,
      });
    }

    return confirmations;
  }

  /**
   * Analyze price action confirmation for support/resistance levels
   */
  async analyzePriceActionConfirmation(
    candles: CandleData[],
    levels: DynamicSRLevel[]
  ): Promise<PriceActionConfirmation[]> {
    const confirmations: PriceActionConfirmation[] = [];

    for (const level of levels) {
      const { rejections, bounces } = this.analyzePriceActionAtLevel(level, candles);
      
      let confirmation: 'strong' | 'moderate' | 'weak';
      const totalInteractions = rejections + bounces;
      
      if (totalInteractions >= 4 && bounces / totalInteractions >= 0.7) {
        confirmation = 'strong';
      } else if (totalInteractions >= 2 && bounces / totalInteractions >= 0.5) {
        confirmation = 'moderate';
      } else {
        confirmation = 'weak';
      }

      confirmations.push({
        level: level.price,
        rejections,
        bounces,
        confirmation,
      });
    }

    return confirmations;
  }

  /**
   * Identify support/resistance clusters
   */
  async identifySRClusters(levels: DynamicSRLevel[]): Promise<SRCluster[]> {
    const clusters: SRCluster[] = [];
    const used = new Set<number>();

    for (let i = 0; i < levels.length; i++) {
      if (used.has(i)) continue;

      const clusterLevels = [levels[i]];
      used.add(i);

      // Find nearby levels
      for (let j = i + 1; j < levels.length; j++) {
        if (used.has(j)) continue;

        const distance = Math.abs(levels[i].price - levels[j].price) / levels[i].price;
        if (distance <= this.CLUSTER_TOLERANCE) {
          clusterLevels.push(levels[j]);
          used.add(j);
        }
      }

      if (clusterLevels.length >= 2) {
        const centerPrice = clusterLevels.reduce((sum, level) => sum + level.price, 0) / clusterLevels.length;
        const combinedStrength = clusterLevels.reduce((sum, level) => sum + level.strength, 0);
        
        // Determine cluster type
        const supportLevels = clusterLevels.filter(l => l.type === 'support').length;
        const resistanceLevels = clusterLevels.filter(l => l.type === 'resistance').length;
        
        let type: 'support' | 'resistance' | 'pivot';
        if (supportLevels > resistanceLevels) {
          type = 'support';
        } else if (resistanceLevels > supportLevels) {
          type = 'resistance';
        } else {
          type = 'pivot';
        }

        clusters.push({
          centerPrice,
          levels: clusterLevels,
          combinedStrength,
          type,
        });
      }
    }

    return clusters.sort((a, b) => b.combinedStrength - a.combinedStrength);
  }

  /**
   * Calculate level strength based on multiple factors
   */
  calculateLevelStrength(
    level: DynamicSRLevel,
    volumeConfirmation: VolumeConfirmation,
    priceActionConfirmation: PriceActionConfirmation
  ): number {
    let strength = 0;

    // Base strength from touches
    strength += Math.min(level.touches / 5, 0.4); // Max 0.4 from touches

    // Volume confirmation
    switch (volumeConfirmation.confirmation) {
      case 'strong':
        strength += 0.3;
        break;
      case 'moderate':
        strength += 0.2;
        break;
      case 'weak':
        strength += 0.1;
        break;
    }

    // Price action confirmation
    switch (priceActionConfirmation.confirmation) {
      case 'strong':
        strength += 0.3;
        break;
      case 'moderate':
        strength += 0.2;
        break;
      case 'weak':
        strength += 0.1;
        break;
    }

    // Age factor (newer levels are less reliable)
    const ageFactor = Math.min(level.age / (7 * 24 * 60 * 60 * 1000), 1); // Normalize to weeks
    strength *= (0.7 + ageFactor * 0.3);

    return Math.min(strength, 1.0);
  }

  // Private methods

  private findSwingPoints(candles: CandleData[]): Array<{
    price: number;
    timestamp: number;
    type: 'high' | 'low';
    index: number;
  }> {
    const swingPoints: Array<{
      price: number;
      timestamp: number;
      type: 'high' | 'low';
      index: number;
    }> = [];
    
    const lookback = 5; // Look 5 candles back and forward

    for (let i = lookback; i < candles.length - lookback; i++) {
      const current = candles[i];
      
      // Check for swing high
      let isSwingHigh = true;
      let isSwingLow = true;

      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        
        if (candles[j].high >= current.high) {
          isSwingHigh = false;
        }
        if (candles[j].low <= current.low) {
          isSwingLow = false;
        }
      }

      if (isSwingHigh) {
        swingPoints.push({
          price: current.high,
          timestamp: current.timestamp,
          type: 'high',
          index: i,
        });
      }

      if (isSwingLow) {
        swingPoints.push({
          price: current.low,
          timestamp: current.timestamp,
          type: 'low',
          index: i,
        });
      }
    }

    return swingPoints;
  }

  private groupSwingPoints(
    swingPoints: Array<{ price: number; timestamp: number; type: 'high' | 'low'; index: number }>,
    candles: CandleData[]
  ): Array<{ price: number; type: 'support' | 'resistance'; points: typeof swingPoints }> {
    const groups: Array<{ price: number; type: 'support' | 'resistance'; points: typeof swingPoints }> = [];
    const tolerance = this.TOUCH_TOLERANCE;

    // Group swing points by price proximity
    const used = new Set<number>();

    for (let i = 0; i < swingPoints.length; i++) {
      if (used.has(i)) continue;

      const group = [swingPoints[i]];
      used.add(i);

      for (let j = i + 1; j < swingPoints.length; j++) {
        if (used.has(j)) continue;

        const distance = Math.abs(swingPoints[i].price - swingPoints[j].price) / swingPoints[i].price;
        if (distance <= tolerance) {
          group.push(swingPoints[j]);
          used.add(j);
        }
      }

      if (group.length >= this.MIN_TOUCHES) {
        const avgPrice = group.reduce((sum, point) => sum + point.price, 0) / group.length;
        
        // Determine if it's support or resistance based on point types
        const highs = group.filter(p => p.type === 'high').length;
        const lows = group.filter(p => p.type === 'low').length;
        
        const type = lows > highs ? 'support' : 'resistance';

        groups.push({
          price: avgPrice,
          type,
          points: group,
        });
      }
    }

    return groups;
  }

  private async analyzePotentialLevel(
    potentialLevel: { price: number; type: 'support' | 'resistance'; points: any[] },
    candles: CandleData[]
  ): Promise<DynamicSRLevel | null> {
    const touches = potentialLevel.points.length;
    const lastTouch = Math.max(...potentialLevel.points.map(p => p.timestamp));
    const firstTouch = Math.min(...potentialLevel.points.map(p => p.timestamp));
    const age = Date.now() - firstTouch;

    // Calculate base strength
    let strength = Math.min(touches / 5, 0.6); // Base strength from touches

    // Add recency bonus
    const recencyBonus = this.calculateRecencyBonus(lastTouch);
    strength += recencyBonus * 0.2;

    // Add consistency bonus
    const consistencyBonus = this.calculateConsistencyBonus(potentialLevel.points);
    strength += consistencyBonus * 0.2;

    return {
      price: potentialLevel.price,
      type: potentialLevel.type,
      strength,
      volumeConfirmation: 0, // Will be calculated separately
      priceActionConfirmation: 0, // Will be calculated separately
      dynamicAdjustment: 0, // Will be calculated separately
      touches,
      lastTouch,
      age,
    };
  }

  private async applyDynamicAdjustments(
    levels: DynamicSRLevel[],
    candles: CandleData[]
  ): Promise<DynamicSRLevel[]> {
    const adjustedLevels: DynamicSRLevel[] = [];

    for (const level of levels) {
      const adjustment = await this.calculateDynamicAdjustment(level, candles);
      
      adjustedLevels.push({
        ...level,
        price: level.price + adjustment.priceAdjustment,
        strength: level.strength * adjustment.strengthMultiplier,
        dynamicAdjustment: adjustment.adjustmentScore,
      });
    }

    return adjustedLevels;
  }

  private async calculateDynamicAdjustment(
    level: DynamicSRLevel,
    candles: CandleData[]
  ): Promise<{
    priceAdjustment: number;
    strengthMultiplier: number;
    adjustmentScore: number;
  }> {
    let priceAdjustment = 0;
    let strengthMultiplier = 1.0;
    let adjustmentScore = 0;

    // Volume-weighted price adjustment
    const nearbyCandles = this.findCandlesNearLevel(level.price, candles, this.TOUCH_TOLERANCE * 2);
    if (nearbyCandles.length > 0) {
      const volumeWeightedPrice = nearbyCandles.reduce((sum, c) => 
        sum + (c.close * c.volume), 0
      ) / nearbyCandles.reduce((sum, c) => sum + c.volume, 0);

      const priceDiff = volumeWeightedPrice - level.price;
      priceAdjustment = priceDiff * 0.3; // 30% adjustment toward volume-weighted price
      adjustmentScore += 0.3;
    }

    // Market volatility adjustment
    const volatility = this.calculateVolatility(candles.slice(-20));
    if (volatility > 0.02) { // 2% daily volatility threshold
      strengthMultiplier *= (1 - volatility); // Reduce strength in high volatility
      adjustmentScore += 0.2;
    }

    // Time decay adjustment
    const daysSinceLastTouch = (Date.now() - level.lastTouch) / (24 * 60 * 60 * 1000);
    if (daysSinceLastTouch > 7) {
      strengthMultiplier *= Math.max(0.5, 1 - (daysSinceLastTouch / 30)); // Decay over 30 days
      adjustmentScore += 0.1;
    }

    return {
      priceAdjustment,
      strengthMultiplier: Math.max(strengthMultiplier, 0.1),
      adjustmentScore: Math.min(adjustmentScore, 1.0),
    };
  }

  private filterAndRankLevels(levels: DynamicSRLevel[]): DynamicSRLevel[] {
    // Filter out weak levels
    const filteredLevels = levels.filter(level => level.strength >= 0.3);
    
    // Sort by strength
    return filteredLevels.sort((a, b) => b.strength - a.strength);
  }

  private findCandlesNearLevel(
    levelPrice: number,
    candles: CandleData[],
    tolerance: number
  ): CandleData[] {
    return candles.filter(candle => {
      const distance = Math.abs(candle.close - levelPrice) / levelPrice;
      return distance <= tolerance;
    });
  }

  private analyzePriceActionAtLevel(
    level: DynamicSRLevel,
    candles: CandleData[]
  ): { rejections: number; bounces: number } {
    let rejections = 0;
    let bounces = 0;
    const tolerance = this.TOUCH_TOLERANCE;

    for (let i = 1; i < candles.length - 1; i++) {
      const prevCandle = candles[i - 1];
      const currentCandle = candles[i];
      const nextCandle = candles[i + 1];

      // Check if current candle touched the level
      const touchedLevel = Math.abs(currentCandle.close - level.price) / level.price <= tolerance ||
                          Math.abs(currentCandle.high - level.price) / level.price <= tolerance ||
                          Math.abs(currentCandle.low - level.price) / level.price <= tolerance;

      if (touchedLevel) {
        // Determine if it was a bounce or rejection
        if (level.type === 'support') {
          // For support, check if price bounced up
          if (currentCandle.low <= level.price && nextCandle.close > currentCandle.close) {
            bounces++;
          } else if (currentCandle.low <= level.price && nextCandle.close < level.price) {
            rejections++;
          }
        } else {
          // For resistance, check if price bounced down
          if (currentCandle.high >= level.price && nextCandle.close < currentCandle.close) {
            bounces++;
          } else if (currentCandle.high >= level.price && nextCandle.close > level.price) {
            rejections++;
          }
        }
      }
    }

    return { rejections, bounces };
  }

  private calculateAverageVolume(candles: CandleData[]): number {
    const recentCandles = candles.slice(-20); // Last 20 candles
    return recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
  }

  private calculateRecencyBonus(lastTouch: number): number {
    const daysSinceLastTouch = (Date.now() - lastTouch) / (24 * 60 * 60 * 1000);
    
    if (daysSinceLastTouch <= 1) return 1.0;
    if (daysSinceLastTouch <= 3) return 0.8;
    if (daysSinceLastTouch <= 7) return 0.6;
    if (daysSinceLastTouch <= 14) return 0.4;
    return 0.2;
  }

  private calculateConsistencyBonus(points: any[]): number {
    if (points.length < 3) return 0.5;

    // Calculate price variance among touch points
    const prices = points.map(p => p.price);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation means more consistent level
    const consistency = 1 - Math.min(stdDev / avgPrice, 0.5); // Cap at 50% price deviation
    return consistency;
  }

  private calculateVolatility(candles: CandleData[]): number {
    if (candles.length < 2) return 0;

    const returns = candles.slice(1).map((candle, i) => 
      Math.log(candle.close / candles[i].close)
    );

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
}