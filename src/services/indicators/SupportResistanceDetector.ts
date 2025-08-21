/**
 * Support and Resistance Level Detector
 * Identifies key support and resistance levels using multiple methods
 */

import { CandleData } from '../../types/market';
import { SupportResistanceLevel } from '../../types/analysis';

export interface SRConfig {
  minTouches: number;
  touchTolerance: number; // Percentage tolerance for level touches
  minStrength: number;
  lookbackPeriod: number;
  volumeWeighting: boolean;
}

export class SupportResistanceDetector {
  private config: SRConfig;

  constructor(config?: Partial<SRConfig>) {
    this.config = {
      minTouches: 2,
      touchTolerance: 0.5, // 0.5%
      minStrength: 0.3,
      lookbackPeriod: 100,
      volumeWeighting: true,
      ...config,
    };
  }

  /**
   * Detect support and resistance levels
   */
  async detectLevels(candles: CandleData[]): Promise<SupportResistanceLevel[]> {
    if (candles.length < this.config.lookbackPeriod) {
      throw new Error(`Insufficient data for S/R detection. Need at least ${this.config.lookbackPeriod} candles`);
    }

    const levels: SupportResistanceLevel[] = [];

    // Method 1: Pivot point analysis
    const pivotLevels = this.detectPivotLevels(candles);
    levels.push(...pivotLevels);

    // Method 2: Horizontal level analysis
    const horizontalLevels = this.detectHorizontalLevels(candles);
    levels.push(...horizontalLevels);

    // Method 3: Volume profile levels
    if (this.config.volumeWeighting) {
      const volumeLevels = this.detectVolumeLevels(candles);
      levels.push(...volumeLevels);
    }

    // Merge and filter levels
    const mergedLevels = this.mergeLevels(levels);
    const filteredLevels = this.filterLevels(mergedLevels, candles);

    return filteredLevels.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Detect levels using pivot point analysis
   */
  private detectPivotLevels(candles: CandleData[]): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const pivotDistance = 5; // Minimum distance between pivots

    // Find pivot highs and lows
    for (let i = pivotDistance; i < candles.length - pivotDistance; i++) {
      const current = candles[i];
      let isPivotHigh = true;
      let isPivotLow = true;

      // Check if current candle is a pivot high or low
      for (let j = i - pivotDistance; j <= i + pivotDistance; j++) {
        if (j === i) continue;

        if (current.high <= candles[j].high) {
          isPivotHigh = false;
        }
        if (current.low >= candles[j].low) {
          isPivotLow = false;
        }
      }

      // Add pivot high as resistance
      if (isPivotHigh) {
        const touches = this.countTouches(candles, current.high, 'resistance', i);
        if (touches >= this.config.minTouches) {
          levels.push({
            price: current.high,
            strength: this.calculatePivotStrength(candles, i, 'high'),
            type: 'resistance',
            touches,
            lastTouch: current.timestamp,
          });
        }
      }

      // Add pivot low as support
      if (isPivotLow) {
        const touches = this.countTouches(candles, current.low, 'support', i);
        if (touches >= this.config.minTouches) {
          levels.push({
            price: current.low,
            strength: this.calculatePivotStrength(candles, i, 'low'),
            type: 'support',
            touches,
            lastTouch: current.timestamp,
          });
        }
      }
    }

    return levels;
  }

  /**
   * Detect horizontal support and resistance levels
   */
  private detectHorizontalLevels(candles: CandleData[]): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const priceRanges = this.createPriceRanges(candles);

    for (const range of priceRanges) {
      const touchData = this.analyzeHorizontalLevel(candles, range.price);
      
      if (touchData.touches >= this.config.minTouches && 
          touchData.strength >= this.config.minStrength) {
        levels.push({
          price: range.price,
          strength: touchData.strength,
          type: touchData.type,
          touches: touchData.touches,
          lastTouch: touchData.lastTouch,
        });
      }
    }

    return levels;
  }

  /**
   * Detect levels based on volume profile
   */
  private detectVolumeLevels(candles: CandleData[]): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const volumeProfile = this.calculateVolumeProfile(candles);

    // Find high volume nodes
    const sortedNodes = volumeProfile.sort((a, b) => b.volume - a.volume);
    const topNodes = sortedNodes.slice(0, Math.min(10, sortedNodes.length));

    for (const node of topNodes) {
      if (node.volume > volumeProfile.reduce((sum, n) => sum + n.volume, 0) * 0.05) {
        const touchData = this.analyzeHorizontalLevel(candles, node.price);
        
        if (touchData.touches >= 1) { // Lower threshold for volume levels
          levels.push({
            price: node.price,
            strength: Math.min(1, touchData.strength + (node.volume / 1000000)), // Volume boost
            type: touchData.type,
            touches: touchData.touches,
            lastTouch: touchData.lastTouch,
          });
        }
      }
    }

    return levels;
  }

  /**
   * Count touches of a price level
   */
  private countTouches(
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
      
      if (type === 'resistance') {
        // Check if high touched the resistance level
        if (Math.abs(candle.high - level) <= tolerance) {
          touches++;
        }
      } else {
        // Check if low touched the support level
        if (Math.abs(candle.low - level) <= tolerance) {
          touches++;
        }
      }
    }

    return touches;
  }

  /**
   * Calculate pivot strength
   */
  private calculatePivotStrength(
    candles: CandleData[],
    pivotIndex: number,
    type: 'high' | 'low'
  ): number {
    const pivot = candles[pivotIndex];
    let strength = 0.5; // Base strength

    // Volume factor
    const avgVolume = candles.slice(Math.max(0, pivotIndex - 10), pivotIndex + 10)
      .reduce((sum, c) => sum + c.volume, 0) / 20;
    
    if (pivot.volume > avgVolume * 1.5) {
      strength += 0.2;
    }

    // Price rejection factor
    const bodySize = Math.abs(pivot.close - pivot.open);
    // const totalRange = pivot.high - pivot.low;
    
    if (type === 'high') {
      const upperWick = pivot.high - Math.max(pivot.open, pivot.close);
      if (upperWick > bodySize * 2) {
        strength += 0.2; // Strong rejection at high
      }
    } else {
      const lowerWick = Math.min(pivot.open, pivot.close) - pivot.low;
      if (lowerWick > bodySize * 2) {
        strength += 0.2; // Strong rejection at low
      }
    }

    // Time factor (older levels are stronger)
    const age = candles.length - pivotIndex;
    if (age > 50) {
      strength += 0.1;
    }

    return Math.min(1, strength);
  }

  /**
   * Create price ranges for horizontal level analysis
   */
  private createPriceRanges(candles: CandleData[]): Array<{ price: number; count: number }> {
    const priceMap = new Map<number, number>();
    const priceStep = this.calculatePriceStep(candles);

    for (const candle of candles) {
      // Round prices to nearest step
      const roundedHigh = Math.round(candle.high / priceStep) * priceStep;
      const roundedLow = Math.round(candle.low / priceStep) * priceStep;
      const roundedClose = Math.round(candle.close / priceStep) * priceStep;

      priceMap.set(roundedHigh, (priceMap.get(roundedHigh) || 0) + 1);
      priceMap.set(roundedLow, (priceMap.get(roundedLow) || 0) + 1);
      priceMap.set(roundedClose, (priceMap.get(roundedClose) || 0) + 1);
    }

    return Array.from(priceMap.entries())
      .map(([price, count]) => ({ price, count }))
      .filter(range => range.count >= 3)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze horizontal level for support/resistance characteristics
   */
  private analyzeHorizontalLevel(
    candles: CandleData[],
    level: number
  ): {
    touches: number;
    strength: number;
    type: 'support' | 'resistance';
    lastTouch: number;
  } {
    const tolerance = level * (this.config.touchTolerance / 100);
    let supportTouches = 0;
    let resistanceTouches = 0;
    let lastTouch = 0;
    let totalVolume = 0;

    for (const candle of candles) {
      // Check for support touches
      if (Math.abs(candle.low - level) <= tolerance) {
        supportTouches++;
        lastTouch = Math.max(lastTouch, candle.timestamp);
        totalVolume += candle.volume;
      }

      // Check for resistance touches
      if (Math.abs(candle.high - level) <= tolerance) {
        resistanceTouches++;
        lastTouch = Math.max(lastTouch, candle.timestamp);
        totalVolume += candle.volume;
      }
    }

    const totalTouches = supportTouches + resistanceTouches;
    const type = supportTouches > resistanceTouches ? 'support' : 'resistance';
    
    // Calculate strength based on touches and volume
    let strength = Math.min(1, totalTouches / 10);
    if (this.config.volumeWeighting && totalVolume > 0) {
      const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
      const volumeFactor = Math.min(0.3, (totalVolume / avgVolume) / 100);
      strength += volumeFactor;
    }

    return {
      touches: totalTouches,
      strength: Math.min(1, strength),
      type,
      lastTouch,
    };
  }

  /**
   * Calculate volume profile
   */
  private calculateVolumeProfile(candles: CandleData[]): Array<{ price: number; volume: number }> {
    const priceStep = this.calculatePriceStep(candles);
    const volumeMap = new Map<number, number>();

    for (const candle of candles) {
      // Distribute volume across price range
      const priceRange = candle.high - candle.low;
      const steps = Math.max(1, Math.round(priceRange / priceStep));
      const volumePerStep = candle.volume / steps;

      for (let i = 0; i < steps; i++) {
        const price = candle.low + (i * priceStep);
        const roundedPrice = Math.round(price / priceStep) * priceStep;
        volumeMap.set(roundedPrice, (volumeMap.get(roundedPrice) || 0) + volumePerStep);
      }
    }

    return Array.from(volumeMap.entries())
      .map(([price, volume]) => ({ price, volume }))
      .sort((a, b) => b.volume - a.volume);
  }

  /**
   * Calculate appropriate price step for level detection
   */
  private calculatePriceStep(candles: CandleData[]): number {
    const prices = candles.map(c => c.close);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    // Use 0.1% of average price as step
    return avgPrice * 0.001;
  }

  /**
   * Merge similar levels
   */
  private mergeLevels(levels: SupportResistanceLevel[]): SupportResistanceLevel[] {
    if (levels.length === 0) return [];

    const merged: SupportResistanceLevel[] = [];
    const sorted = levels.sort((a, b) => a.price - b.price);

    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      const priceDiff = Math.abs(next.price - current.price) / current.price;

      // Merge if levels are close (within 1%)
      if (priceDiff < 0.01 && next.type === current.type) {
        // Merge levels
        current.price = (current.price * current.touches + next.price * next.touches) / 
                       (current.touches + next.touches);
        current.strength = Math.max(current.strength, next.strength);
        current.touches += next.touches;
        current.lastTouch = Math.max(current.lastTouch, next.lastTouch);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Filter levels based on strength and relevance
   */
  private filterLevels(
    levels: SupportResistanceLevel[],
    candles: CandleData[]
  ): SupportResistanceLevel[] {
    const currentPrice = candles[candles.length - 1].close;
    // const priceRange = Math.max(...candles.map(c => c.high)) - Math.min(...candles.map(c => c.low));

    return levels.filter(level => {
      // Filter by minimum strength
      if (level.strength < this.config.minStrength) return false;

      // Filter by minimum touches
      if (level.touches < this.config.minTouches) return false;

      // Filter by relevance (within reasonable distance from current price)
      const distance = Math.abs(level.price - currentPrice) / currentPrice;
      if (distance > 0.2) return false; // More than 20% away

      // Filter old levels that haven't been touched recently
      const daysSinceTouch = (Date.now() - level.lastTouch) / (1000 * 60 * 60 * 24);
      if (daysSinceTouch > 30) return false; // Older than 30 days

      return true;
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SRConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): SRConfig {
    return { ...this.config };
  }
}