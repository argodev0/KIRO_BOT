/**
 * Fibonacci Analysis Service
 * Implements comprehensive Fibonacci analysis including retracements, extensions,
 * time projections, and confluence zone detection
 */

import { CandleData } from '../types/market';
import {
  FibonacciLevels,
  FibonacciLevel,
  TimeFibonacci,
  ConfluenceZone,
  Wave
} from '../types/analysis';

export interface FibonacciCalculationInput {
  high: number;
  low: number;
  startTime?: number;
  endTime?: number;
}

export interface FibonacciCluster {
  priceLevel: number;
  strength: number;
  levels: FibonacciLevel[];
  type: 'golden_ratio' | 'confluence' | 'standard';
}

export class FibonacciService {
  // Standard Fibonacci ratios
  private static readonly RETRACEMENT_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786];
  private static readonly EXTENSION_LEVELS = [1.272, 1.618, 2.618];
  private static readonly TIME_RATIOS = [0.382, 0.618, 1.0, 1.618, 2.618];
  
  // Golden ratio and special levels
  private static readonly GOLDEN_RATIO = 0.618;
  private static readonly INVERSE_GOLDEN_RATIO = 1.618;
  private static readonly CONFLUENCE_TOLERANCE = 0.001; // 0.1% price tolerance for confluence

  /**
   * Calculate Fibonacci retracement levels
   */
  public calculateRetracements(input: FibonacciCalculationInput): FibonacciLevel[] {
    const { high, low } = input;
    const range = high - low;
    
    return FibonacciService.RETRACEMENT_LEVELS.map(ratio => ({
      ratio,
      price: high - (range * ratio),
      type: 'retracement' as const,
      strength: this.calculateLevelStrength(ratio),
      description: this.getLevelDescription(ratio, 'retracement')
    }));
  }

  /**
   * Calculate Fibonacci extension levels
   */
  public calculateExtensions(wave1: Wave, wave2: Wave): FibonacciLevel[] {
    const wave1Length = Math.abs(wave1.endPrice - wave1.startPrice);
    const extensionBase = wave2.endPrice;
    const direction = wave1.endPrice > wave1.startPrice ? 1 : -1;

    return FibonacciService.EXTENSION_LEVELS.map(ratio => ({
      ratio,
      price: extensionBase + (wave1Length * ratio * direction),
      type: 'extension' as const,
      strength: this.calculateLevelStrength(ratio),
      description: this.getLevelDescription(ratio, 'extension')
    }));
  }

  /**
   * Calculate time-based Fibonacci projections
   */
  public calculateTimeFibonacci(startTime: number, endTime: number): TimeFibonacci[] {
    const duration = endTime - startTime;
    
    return FibonacciService.TIME_RATIOS.map(ratio => ({
      ratio,
      timestamp: endTime + (duration * ratio),
      description: `Time projection at ${ratio} ratio (${this.formatTimeRatio(ratio)})`
    }));
  }

  /**
   * Detect confluence zones where multiple Fibonacci levels intersect
   */
  public findConfluenceZones(fibonacciLevels: FibonacciLevel[]): ConfluenceZone[] {
    const confluenceZones: ConfluenceZone[] = [];
    const tolerance = this.calculatePriceTolerance(fibonacciLevels);

    // Group levels by proximity
    const levelGroups = this.groupLevelsByProximity(fibonacciLevels, tolerance);

    for (const group of levelGroups) {
      if (group.length >= 2) { // Confluence requires at least 2 levels
        const avgPrice = group.reduce((sum, level) => sum + level.price, 0) / group.length;
        const strength = this.calculateConfluenceStrength(group);
        
        confluenceZones.push({
          priceLevel: avgPrice,
          strength,
          factors: group.map(level => ({
            type: 'fibonacci' as const,
            description: level.description,
            weight: level.strength
          })),
          type: this.determineConfluenceType(group),
          reliability: this.calculateReliability(strength, group.length)
        });
      }
    }

    return confluenceZones.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Identify golden ratio levels and special zones
   */
  public identifyGoldenRatioZones(fibonacciLevels: FibonacciLevel[]): FibonacciCluster[] {
    const clusters: FibonacciCluster[] = [];
    
    // Find golden ratio levels (0.618 and 1.618)
    const goldenRatioLevels = fibonacciLevels.filter(level => 
      Math.abs(level.ratio - FibonacciService.GOLDEN_RATIO) < 0.001 ||
      Math.abs(level.ratio - FibonacciService.INVERSE_GOLDEN_RATIO) < 0.001
    );

    for (const level of goldenRatioLevels) {
      clusters.push({
        priceLevel: level.price,
        strength: level.strength * 1.5, // Golden ratio gets extra weight
        levels: [level],
        type: 'golden_ratio'
      });
    }

    return clusters;
  }

  /**
   * Perform comprehensive Fibonacci cluster analysis
   */
  public analyzeFibonacciClusters(
    _candles: CandleData[],
    swingPoints: { high: number; low: number; highTime: number; lowTime: number }[]
  ): FibonacciCluster[] {
    const allLevels: FibonacciLevel[] = [];
    
    // Calculate Fibonacci levels for all swing point combinations
    for (let i = 0; i < swingPoints.length - 1; i++) {
      for (let j = i + 1; j < swingPoints.length; j++) {
        const point1 = swingPoints[i];
        const point2 = swingPoints[j];
        
        // Retracements
        const retracements = this.calculateRetracements({
          high: Math.max(point1.high, point2.high),
          low: Math.min(point1.low, point2.low)
        });
        
        allLevels.push(...retracements);
      }
    }

    // Group levels into clusters
    const tolerance = this.calculatePriceTolerance(allLevels);
    const levelGroups = this.groupLevelsByProximity(allLevels, tolerance);
    
    return levelGroups
      .filter(group => group.length >= 2)
      .map(group => ({
        priceLevel: group.reduce((sum, level) => sum + level.price, 0) / group.length,
        strength: this.calculateConfluenceStrength(group),
        levels: group,
        type: this.determineClusterType(group)
      }))
      .sort((a, b) => b.strength - a.strength);
  }

  /**
   * Generate complete Fibonacci analysis for a price range
   */
  public generateFibonacciAnalysis(
    high: number,
    low: number,
    startTime: number,
    endTime: number,
    additionalLevels: FibonacciLevel[] = []
  ): FibonacciLevels {
    const retracements = this.calculateRetracements({ high, low, startTime, endTime });
    const extensions = this.calculateExtensions(
      { startPrice: low, endPrice: high } as Wave,
      { endPrice: high } as Wave
    );
    const timeProjections = this.calculateTimeFibonacci(startTime, endTime);
    
    const allLevels = [...retracements, ...extensions, ...additionalLevels];
    const confluenceZones = this.findConfluenceZones(allLevels);

    return {
      retracements,
      extensions,
      timeProjections,
      confluenceZones,
      highPrice: high,
      lowPrice: low,
      swingHigh: high,
      swingLow: low
    };
  }

  // Private helper methods

  private calculateLevelStrength(ratio: number): number {
    // Golden ratio levels get highest strength
    if (Math.abs(ratio - FibonacciService.GOLDEN_RATIO) < 0.001 ||
        Math.abs(ratio - FibonacciService.INVERSE_GOLDEN_RATIO) < 0.001) {
      return 1.0;
    }
    
    // 50% retracement is also significant
    if (Math.abs(ratio - 0.5) < 0.001) {
      return 0.9;
    }
    
    // Other standard levels
    if (FibonacciService.RETRACEMENT_LEVELS.includes(ratio) ||
        FibonacciService.EXTENSION_LEVELS.includes(ratio)) {
      return 0.8;
    }
    
    return 0.6;
  }

  private getLevelDescription(ratio: number, type: 'retracement' | 'extension'): string {
    const percentage = (ratio * 100).toFixed(1);
    
    if (Math.abs(ratio - FibonacciService.GOLDEN_RATIO) < 0.001) {
      return `${percentage}% ${type} (Golden Ratio)`;
    }
    
    if (Math.abs(ratio - 0.5) < 0.001) {
      return `${percentage}% ${type} (50% Level)`;
    }
    
    return `${percentage}% ${type}`;
  }

  private formatTimeRatio(ratio: number): string {
    if (ratio === 1.0) return '1:1';
    if (Math.abs(ratio - FibonacciService.GOLDEN_RATIO) < 0.001) return 'Golden Ratio';
    if (Math.abs(ratio - FibonacciService.INVERSE_GOLDEN_RATIO) < 0.001) return 'Inverse Golden Ratio';
    return `${ratio.toFixed(3)}`;
  }

  private calculatePriceTolerance(levels: FibonacciLevel[]): number {
    if (levels.length === 0) return 0;
    
    const prices = levels.map(level => level.price);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    return avgPrice * FibonacciService.CONFLUENCE_TOLERANCE;
  }

  private groupLevelsByProximity(levels: FibonacciLevel[], tolerance: number): FibonacciLevel[][] {
    const groups: FibonacciLevel[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < levels.length; i++) {
      if (used.has(i)) continue;

      const group = [levels[i]];
      used.add(i);

      for (let j = i + 1; j < levels.length; j++) {
        if (used.has(j)) continue;

        if (Math.abs(levels[i].price - levels[j].price) <= tolerance) {
          group.push(levels[j]);
          used.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private calculateConfluenceStrength(levels: FibonacciLevel[]): number {
    const baseStrength = levels.reduce((sum, level) => sum + level.strength, 0);
    const countMultiplier = Math.min(levels.length / 3, 2); // Cap at 2x for count
    
    return Math.min(baseStrength * countMultiplier, 1.0);
  }

  private determineConfluenceType(levels: FibonacciLevel[]): 'support' | 'resistance' | 'reversal' {
    const hasRetracements = levels.some(level => level.type === 'retracement');
    const hasExtensions = levels.some(level => level.type === 'extension');
    
    if (hasRetracements && hasExtensions) return 'reversal';
    if (hasRetracements) return 'support';
    return 'resistance';
  }

  private determineClusterType(levels: FibonacciLevel[]): 'golden_ratio' | 'confluence' | 'standard' {
    const hasGoldenRatio = levels.some(level => 
      Math.abs(level.ratio - FibonacciService.GOLDEN_RATIO) < 0.001 ||
      Math.abs(level.ratio - FibonacciService.INVERSE_GOLDEN_RATIO) < 0.001
    );
    
    if (hasGoldenRatio) return 'golden_ratio';
    if (levels.length >= 3) return 'confluence';
    return 'standard';
  }

  private calculateReliability(strength: number, levelCount: number): number {
    const strengthWeight = strength * 0.7;
    const countWeight = Math.min(levelCount / 5, 1) * 0.3;
    
    return Math.min(strengthWeight + countWeight, 1.0);
  }
}