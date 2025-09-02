/**
 * Dynamic Fibonacci Analyzer
 * Advanced Fibonacci analysis with dynamic level adjustment based on market conditions
 */

import { CandleData } from '../../types/market';
import { FibonacciLevels, FibonacciLevel, ConfluenceZone, WaveStructure } from '../../types/analysis';

export interface FibonacciAdjustment {
  level: number;
  originalPrice: number;
  adjustedPrice: number;
  reason: string;
  strength: number;
}

export interface DynamicFibonacciConfig {
  levels: number[];
  confluenceDistance: number;
  dynamicAdjustment: boolean;
  timeProjections: boolean;
}

export interface FibonacciCluster {
  centerPrice: number;
  levels: FibonacciLevel[];
  strength: number;
  type: 'golden_ratio' | 'confluence' | 'standard';
}

export interface VolumeWeightedFibonacci {
  level: FibonacciLevel;
  volumeWeight: number;
  adjustedStrength: number;
}

export class DynamicFibonacciAnalyzer {
  private config: DynamicFibonacciConfig;
  private goldenRatio = 0.618;
  private inverseGoldenRatio = 1.618;

  constructor(config: DynamicFibonacciConfig) {
    this.config = config;
  }

  /**
   * Calculate dynamic adjustments for Fibonacci levels based on market conditions
   */
  async calculateDynamicAdjustments(
    fibonacciLevels: FibonacciLevels,
    candles: CandleData[],
    waveStructure?: WaveStructure
  ): Promise<FibonacciAdjustment[]> {
    if (!this.config.dynamicAdjustment) {
      return [];
    }

    const adjustments: FibonacciAdjustment[] = [];
    const allLevels = [...fibonacciLevels.retracements, ...fibonacciLevels.extensions];

    for (const level of allLevels) {
      // Volume-based adjustments
      const volumeAdjustment = await this.calculateVolumeBasedAdjustment(level, candles);
      if (volumeAdjustment) {
        adjustments.push(volumeAdjustment);
      }

      // Price action adjustments
      const priceActionAdjustment = await this.calculatePriceActionAdjustment(level, candles);
      if (priceActionAdjustment) {
        adjustments.push(priceActionAdjustment);
      }

      // Wave structure adjustments
      if (waveStructure) {
        const waveAdjustment = await this.calculateWaveStructureAdjustment(level, waveStructure, candles);
        if (waveAdjustment) {
          adjustments.push(waveAdjustment);
        }
      }

      // Market regime adjustments
      const regimeAdjustment = await this.calculateMarketRegimeAdjustment(level, candles);
      if (regimeAdjustment) {
        adjustments.push(regimeAdjustment);
      }
    }

    return adjustments.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Calculate confluence strength for Fibonacci zones
   */
  calculateConfluenceStrength(confluenceZones: ConfluenceZone[]): number {
    if (confluenceZones.length === 0) return 0;

    let totalStrength = 0;
    let fibonacciFactors = 0;

    for (const zone of confluenceZones) {
      const fibFactors = zone.factors.filter(f => f.type === 'fibonacci');
      if (fibFactors.length > 0) {
        totalStrength += zone.strength * fibFactors.length;
        fibonacciFactors += fibFactors.length;
      }
    }

    return fibonacciFactors > 0 ? totalStrength / fibonacciFactors : 0;
  }

  /**
   * Identify Fibonacci clusters and golden ratio zones
   */
  async identifyFibonacciClusters(
    fibonacciLevels: FibonacciLevels,
    candles: CandleData[]
  ): Promise<FibonacciCluster[]> {
    const clusters: FibonacciCluster[] = [];
    const allLevels = [...fibonacciLevels.retracements, ...fibonacciLevels.extensions];
    const tolerance = this.calculateDynamicTolerance(candles);

    // Group levels by proximity
    const levelGroups = this.groupLevelsByProximity(allLevels, tolerance);

    for (const group of levelGroups) {
      if (group.length >= 2) {
        const centerPrice = group.reduce((sum, level) => sum + level.price, 0) / group.length;
        const strength = this.calculateClusterStrength(group);
        const type = this.determineClusterType(group);

        clusters.push({
          centerPrice,
          levels: group,
          strength,
          type,
        });
      }
    }

    // Add golden ratio zones
    const goldenRatioZones = this.identifyGoldenRatioZones(allLevels);
    clusters.push(...goldenRatioZones);

    return clusters.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Calculate volume-weighted Fibonacci levels
   */
  async calculateVolumeWeightedFibonacci(
    fibonacciLevels: FibonacciLevels,
    candles: CandleData[]
  ): Promise<VolumeWeightedFibonacci[]> {
    const volumeWeighted: VolumeWeightedFibonacci[] = [];
    const allLevels = [...fibonacciLevels.retracements, ...fibonacciLevels.extensions];

    for (const level of allLevels) {
      const volumeWeight = await this.calculateVolumeWeight(level, candles);
      const adjustedStrength = level.strength * (1 + volumeWeight);

      volumeWeighted.push({
        level,
        volumeWeight,
        adjustedStrength: Math.min(adjustedStrength, 1.0),
      });
    }

    return volumeWeighted.sort((a, b) => b.adjustedStrength - a.adjustedStrength);
  }

  /**
   * Generate time-based Fibonacci projections
   */
  async generateTimeProjections(
    startTime: number,
    endTime: number,
    candles: CandleData[]
  ): Promise<Array<{ timestamp: number; ratio: number; description: string; strength: number }>> {
    if (!this.config.timeProjections) {
      return [];
    }

    const duration = endTime - startTime;
    const timeRatios = [0.382, 0.618, 1.0, 1.618, 2.618];
    const projections = [];

    for (const ratio of timeRatios) {
      const projectedTime = endTime + (duration * ratio);
      const strength = this.calculateTimeProjectionStrength(ratio, candles);
      
      projections.push({
        timestamp: projectedTime,
        ratio,
        description: `Time projection at ${ratio} ratio`,
        strength,
      });
    }

    return projections.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Analyze Fibonacci level interactions with price action
   */
  async analyzeFibonacciInteractions(
    fibonacciLevels: FibonacciLevels,
    candles: CandleData[]
  ): Promise<Array<{
    level: FibonacciLevel;
    interactions: number;
    bounces: number;
    breaks: number;
    strength: number;
  }>> {
    const interactions = [];
    const allLevels = [...fibonacciLevels.retracements, ...fibonacciLevels.extensions];
    const tolerance = 0.002; // 0.2% tolerance

    for (const level of allLevels) {
      let totalInteractions = 0;
      let bounces = 0;
      let breaks = 0;

      for (let i = 1; i < candles.length; i++) {
        const prevCandle = candles[i - 1];
        const currentCandle = candles[i];

        // Check if price interacted with the level
        const prevDistance = Math.abs(prevCandle.close - level.price) / level.price;
        const currentDistance = Math.abs(currentCandle.close - level.price) / level.price;

        if (prevDistance > tolerance && currentDistance <= tolerance) {
          totalInteractions++;

          // Determine if it was a bounce or break
          const nextCandles = candles.slice(i + 1, i + 4); // Look ahead 3 candles
          if (nextCandles.length > 0) {
            const avgNextPrice = nextCandles.reduce((sum, c) => sum + c.close, 0) / nextCandles.length;
            
            if (Math.abs(avgNextPrice - level.price) > tolerance) {
              if ((prevCandle.close < level.price && avgNextPrice > level.price) ||
                  (prevCandle.close > level.price && avgNextPrice < level.price)) {
                breaks++;
              } else {
                bounces++;
              }
            }
          }
        }
      }

      const strength = this.calculateInteractionStrength(totalInteractions, bounces, breaks);

      interactions.push({
        level,
        interactions: totalInteractions,
        bounces,
        breaks,
        strength,
      });
    }

    return interactions.sort((a, b) => b.strength - a.strength);
  }

  // Private methods

  private async calculateVolumeBasedAdjustment(
    level: FibonacciLevel,
    candles: CandleData[]
  ): Promise<FibonacciAdjustment | null> {
    const nearbyCandles = this.findCandlesNearLevel(level, candles, 0.005); // 0.5% tolerance
    
    if (nearbyCandles.length === 0) return null;

    const avgVolume = nearbyCandles.reduce((sum, c) => sum + c.volume, 0) / nearbyCandles.length;
    const contextVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    
    const volumeRatio = avgVolume / contextVolume;
    
    if (volumeRatio > 1.5) {
      // High volume suggests strong level, adjust slightly toward volume center
      const volumeWeightedPrice = nearbyCandles.reduce((sum, c) => 
        sum + (c.close * c.volume), 0
      ) / nearbyCandles.reduce((sum, c) => sum + c.volume, 0);

      const adjustment = (volumeWeightedPrice - level.price) * 0.3; // 30% adjustment

      return {
        level: level.ratio,
        originalPrice: level.price,
        adjustedPrice: level.price + adjustment,
        reason: `High volume concentration (${volumeRatio.toFixed(2)}x average)`,
        strength: Math.min(volumeRatio / 2, 1.0),
      };
    }

    return null;
  }

  private async calculatePriceActionAdjustment(
    level: FibonacciLevel,
    candles: CandleData[]
  ): Promise<FibonacciAdjustment | null> {
    const interactions = this.findLevelInteractions(level, candles);
    
    if (interactions.length < 2) return null;

    // Calculate average interaction price
    const avgInteractionPrice = interactions.reduce((sum, price) => sum + price, 0) / interactions.length;
    const priceDeviation = Math.abs(avgInteractionPrice - level.price);
    
    if (priceDeviation > level.price * 0.001) { // 0.1% deviation threshold
      return {
        level: level.ratio,
        originalPrice: level.price,
        adjustedPrice: avgInteractionPrice,
        reason: `Price action suggests level at ${avgInteractionPrice.toFixed(4)} (${interactions.length} interactions)`,
        strength: Math.min(interactions.length / 5, 1.0),
      };
    }

    return null;
  }

  private async calculateWaveStructureAdjustment(
    level: FibonacciLevel,
    waveStructure: WaveStructure,
    candles: CandleData[]
  ): Promise<FibonacciAdjustment | null> {
    // Check if level aligns with wave targets
    for (const target of waveStructure.nextTargets) {
      const distance = Math.abs(target.price - level.price) / level.price;
      
      if (distance < 0.01 && target.probability > 0.7) { // 1% distance, high probability target
        return {
          level: level.ratio,
          originalPrice: level.price,
          adjustedPrice: target.price,
          reason: `Elliott Wave target alignment (${target.probability.toFixed(2)} probability)`,
          strength: target.probability,
        };
      }
    }

    return null;
  }

  private async calculateMarketRegimeAdjustment(
    level: FibonacciLevel,
    candles: CandleData[]
  ): Promise<FibonacciAdjustment | null> {
    const recentCandles = candles.slice(-20);
    const volatility = this.calculateVolatility(recentCandles);
    
    // In high volatility, levels may need wider tolerance
    if (volatility > 0.3) {
      const adjustment = level.price * volatility * 0.1; // Adjust based on volatility
      
      return {
        level: level.ratio,
        originalPrice: level.price,
        adjustedPrice: level.price + (Math.random() > 0.5 ? adjustment : -adjustment),
        reason: `High volatility adjustment (${(volatility * 100).toFixed(1)}%)`,
        strength: Math.min(volatility, 1.0),
      };
    }

    return null;
  }

  private calculateDynamicTolerance(candles: CandleData[]): number {
    const recentCandles = candles.slice(-20);
    const avgPrice = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;
    const volatility = this.calculateVolatility(recentCandles);
    
    // Base tolerance adjusted by volatility
    return this.config.confluenceDistance * (1 + volatility);
  }

  private groupLevelsByProximity(
    levels: FibonacciLevel[],
    tolerance: number
  ): FibonacciLevel[][] {
    const groups: FibonacciLevel[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < levels.length; i++) {
      if (used.has(i)) continue;

      const group = [levels[i]];
      used.add(i);

      for (let j = i + 1; j < levels.length; j++) {
        if (used.has(j)) continue;

        const distance = Math.abs(levels[i].price - levels[j].price) / levels[i].price;
        if (distance <= tolerance) {
          group.push(levels[j]);
          used.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private calculateClusterStrength(levels: FibonacciLevel[]): number {
    const baseStrength = levels.reduce((sum, level) => sum + level.strength, 0);
    const countMultiplier = Math.min(levels.length / 3, 2); // Cap at 2x for count
    
    return Math.min(baseStrength * countMultiplier, 1.0);
  }

  private determineClusterType(levels: FibonacciLevel[]): 'golden_ratio' | 'confluence' | 'standard' {
    const hasGoldenRatio = levels.some(level => 
      Math.abs(level.ratio - this.goldenRatio) < 0.01 ||
      Math.abs(level.ratio - this.inverseGoldenRatio) < 0.01
    );
    
    if (hasGoldenRatio) return 'golden_ratio';
    if (levels.length >= 3) return 'confluence';
    return 'standard';
  }

  private identifyGoldenRatioZones(levels: FibonacciLevel[]): FibonacciCluster[] {
    const goldenRatioZones: FibonacciCluster[] = [];
    
    const goldenRatioLevels = levels.filter(level => 
      Math.abs(level.ratio - this.goldenRatio) < 0.01 ||
      Math.abs(level.ratio - this.inverseGoldenRatio) < 0.01
    );

    for (const level of goldenRatioLevels) {
      goldenRatioZones.push({
        centerPrice: level.price,
        levels: [level],
        strength: level.strength * 1.3, // Golden ratio bonus
        type: 'golden_ratio',
      });
    }

    return goldenRatioZones;
  }

  private async calculateVolumeWeight(
    level: FibonacciLevel,
    candles: CandleData[]
  ): Promise<number> {
    const nearbyCandles = this.findCandlesNearLevel(level, candles, 0.01); // 1% tolerance
    
    if (nearbyCandles.length === 0) return 0;

    const levelVolume = nearbyCandles.reduce((sum, c) => sum + c.volume, 0);
    const totalVolume = candles.reduce((sum, c) => sum + c.volume, 0);
    
    return Math.min(levelVolume / totalVolume * 10, 1.0); // Normalize and cap at 1.0
  }

  private calculateTimeProjectionStrength(ratio: number, candles: CandleData[]): number {
    // Golden ratio time projections are stronger
    if (Math.abs(ratio - this.goldenRatio) < 0.01 || Math.abs(ratio - this.inverseGoldenRatio) < 0.01) {
      return 0.9;
    }
    
    // 1:1 projections are also strong
    if (Math.abs(ratio - 1.0) < 0.01) {
      return 0.8;
    }
    
    // Other Fibonacci ratios
    const fibRatios = [0.382, 2.618];
    if (fibRatios.some(fib => Math.abs(ratio - fib) < 0.01)) {
      return 0.7;
    }
    
    return 0.5;
  }

  private findCandlesNearLevel(
    level: FibonacciLevel,
    candles: CandleData[],
    tolerance: number
  ): CandleData[] {
    return candles.filter(candle => {
      const distance = Math.abs(candle.close - level.price) / level.price;
      return distance <= tolerance;
    });
  }

  private findLevelInteractions(level: FibonacciLevel, candles: CandleData[]): number[] {
    const interactions: number[] = [];
    const tolerance = 0.005; // 0.5% tolerance

    for (let i = 1; i < candles.length; i++) {
      const prevCandle = candles[i - 1];
      const currentCandle = candles[i];

      // Check if price crossed the level
      const prevDistance = prevCandle.close - level.price;
      const currentDistance = currentCandle.close - level.price;

      if (Math.sign(prevDistance) !== Math.sign(currentDistance) && 
          Math.abs(currentDistance) / level.price <= tolerance) {
        interactions.push(currentCandle.close);
      }
    }

    return interactions;
  }

  private calculateInteractionStrength(
    totalInteractions: number,
    bounces: number,
    breaks: number
  ): number {
    if (totalInteractions === 0) return 0;

    const bounceRatio = bounces / totalInteractions;
    const interactionScore = Math.min(totalInteractions / 5, 1.0); // Normalize to max 5 interactions
    
    // Higher bounce ratio indicates stronger level
    return interactionScore * (0.5 + bounceRatio * 0.5);
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

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DynamicFibonacciConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): DynamicFibonacciConfig {
    return { ...this.config };
  }
}