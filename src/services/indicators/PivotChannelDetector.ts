/**
 * Pivot Channel Detector
 * Advanced pivot point detection and channel analysis with trend identification
 */

import { CandleData } from '../../types/market';

export interface PivotChannel {
  upperChannel: number;
  lowerChannel: number;
  centerLine: number;
  strength: number;
  touches: number;
  direction: 'ascending' | 'descending' | 'horizontal';
  slope: number;
  width: number;
}

export interface TrendAnalysis {
  direction: 'bullish' | 'bearish' | 'sideways';
  strength: number;
  duration: number;
  probability: number;
  confidence: number;
}

export interface PivotPoint {
  price: number;
  timestamp: number;
  type: 'high' | 'low';
  strength: number;
  index: number;
}

export interface PivotChannelConfig {
  lookbackPeriod: number;
  minTouches: number;
  channelWidth: number;
  trendAnalysisDepth: number;
}

export interface ChannelBreakout {
  type: 'upper' | 'lower';
  price: number;
  timestamp: number;
  strength: number;
  target: number;
}

export class PivotChannelDetector {
  private config: PivotChannelConfig;

  constructor(config: PivotChannelConfig) {
    this.config = config;
  }

  /**
   * Detect pivot channels in price data
   */
  async detectPivotChannels(candles: CandleData[]): Promise<PivotChannel[]> {
    if (candles.length < this.config.lookbackPeriod) {
      throw new Error(`Insufficient data for pivot channel detection. Need at least ${this.config.lookbackPeriod} candles`);
    }

    const pivotPoints = this.findPivotPoints(candles);
    const channels = await this.identifyChannels(pivotPoints, candles);
    
    return channels
      .filter(channel => channel.touches >= this.config.minTouches)
      .sort((a, b) => b.strength - a.strength);
  }

  /**
   * Analyze trend based on pivot channels and price action
   */
  async analyzeTrend(candles: CandleData[], channels: PivotChannel[]): Promise<TrendAnalysis> {
    const recentCandles = candles.slice(-this.config.trendAnalysisDepth);
    
    // Analyze price trend
    const priceTrend = this.analyzePriceTrend(recentCandles);
    
    // Analyze channel trend
    const channelTrend = this.analyzeChannelTrend(channels);
    
    // Analyze volume trend
    const volumeTrend = this.analyzeVolumeTrend(recentCandles);
    
    // Combine analyses
    const combinedDirection = this.combineDirections([priceTrend.direction, channelTrend.direction]);
    const combinedStrength = (priceTrend.strength + channelTrend.strength + volumeTrend.strength) / 3;
    
    // Calculate trend duration
    const duration = this.calculateTrendDuration(candles, combinedDirection);
    
    // Calculate trend probability
    const probability = this.calculateTrendProbability(priceTrend, channelTrend, volumeTrend);
    
    // Calculate confidence
    const confidence = this.calculateTrendConfidence(priceTrend, channelTrend, volumeTrend, channels);

    return {
      direction: combinedDirection,
      strength: combinedStrength,
      duration,
      probability,
      confidence,
    };
  }

  /**
   * Calculate breakout probability for channels
   */
  async calculateBreakoutProbability(candles: CandleData[], channels: PivotChannel[]): Promise<number> {
    if (channels.length === 0) return 0;

    const currentPrice = candles[candles.length - 1].close;
    let totalProbability = 0;
    let channelCount = 0;

    for (const channel of channels) {
      const channelProbability = this.calculateChannelBreakoutProbability(
        channel,
        currentPrice,
        candles
      );
      
      totalProbability += channelProbability * channel.strength;
      channelCount += channel.strength;
    }

    return channelCount > 0 ? totalProbability / channelCount : 0;
  }

  /**
   * Identify potential channel breakouts
   */
  async identifyChannelBreakouts(
    candles: CandleData[],
    channels: PivotChannel[]
  ): Promise<ChannelBreakout[]> {
    const breakouts: ChannelBreakout[] = [];
    const recentCandles = candles.slice(-5); // Look at last 5 candles

    for (const channel of channels) {
      for (const candle of recentCandles) {
        // Check for upper channel breakout
        if (candle.close > channel.upperChannel) {
          const strength = this.calculateBreakoutStrength(candle, channel, 'upper', candles);
          const target = this.calculateBreakoutTarget(channel, 'upper');
          
          breakouts.push({
            type: 'upper',
            price: candle.close,
            timestamp: candle.timestamp,
            strength,
            target,
          });
        }
        
        // Check for lower channel breakout
        if (candle.close < channel.lowerChannel) {
          const strength = this.calculateBreakoutStrength(candle, channel, 'lower', candles);
          const target = this.calculateBreakoutTarget(channel, 'lower');
          
          breakouts.push({
            type: 'lower',
            price: candle.close,
            timestamp: candle.timestamp,
            strength,
            target,
          });
        }
      }
    }

    return breakouts.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Calculate pivot point strength
   */
  calculatePivotStrength(
    pivotPoint: PivotPoint,
    candles: CandleData[],
    allPivots: PivotPoint[]
  ): number {
    let strength = 0.5; // Base strength

    // Volume confirmation
    const pivotCandle = candles[pivotPoint.index];
    const avgVolume = this.calculateAverageVolume(candles, pivotPoint.index);
    const volumeRatio = pivotCandle.volume / avgVolume;
    strength += Math.min(volumeRatio / 2, 0.3); // Max 0.3 from volume

    // Price significance
    const priceRange = this.calculatePriceRange(candles, pivotPoint.index);
    const priceSignificance = Math.abs(pivotPoint.price - candles[pivotPoint.index].close) / priceRange;
    strength += Math.min(priceSignificance, 0.2); // Max 0.2 from price significance

    // Isolation (distance from other pivots)
    const isolation = this.calculatePivotIsolation(pivotPoint, allPivots);
    strength += isolation * 0.2; // Max 0.2 from isolation

    // Time persistence
    const persistence = this.calculatePivotPersistence(pivotPoint, candles);
    strength += persistence * 0.2; // Max 0.2 from persistence

    return Math.min(strength, 1.0);
  }

  // Private methods

  private findPivotPoints(candles: CandleData[]): PivotPoint[] {
    const pivotPoints: PivotPoint[] = [];
    const lookback = 5; // Look 5 candles back and forward

    for (let i = lookback; i < candles.length - lookback; i++) {
      const current = candles[i];
      
      // Check for pivot high
      let isPivotHigh = true;
      let isPivotLow = true;

      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        
        if (candles[j].high >= current.high) {
          isPivotHigh = false;
        }
        if (candles[j].low <= current.low) {
          isPivotLow = false;
        }
      }

      if (isPivotHigh) {
        pivotPoints.push({
          price: current.high,
          timestamp: current.timestamp,
          type: 'high',
          strength: 0.5, // Will be calculated later
          index: i,
        });
      }

      if (isPivotLow) {
        pivotPoints.push({
          price: current.low,
          timestamp: current.timestamp,
          type: 'low',
          strength: 0.5, // Will be calculated later
          index: i,
        });
      }
    }

    // Calculate strength for each pivot point
    for (const pivot of pivotPoints) {
      pivot.strength = this.calculatePivotStrength(pivot, candles, pivotPoints);
    }

    return pivotPoints.sort((a, b) => a.timestamp - b.timestamp);
  }

  private async identifyChannels(pivotPoints: PivotPoint[], candles: CandleData[]): Promise<PivotChannel[]> {
    const channels: PivotChannel[] = [];
    
    const highs = pivotPoints.filter(p => p.type === 'high');
    const lows = pivotPoints.filter(p => p.type === 'low');

    // Find channels by connecting pivot points
    for (let i = 0; i < highs.length - 1; i++) {
      for (let j = i + 1; j < highs.length; j++) {
        const upperLine = this.calculateTrendLine([highs[i], highs[j]]);
        
        // Find corresponding lower line
        const correspondingLows = this.findCorrespondingLows(highs[i], highs[j], lows);
        
        if (correspondingLows.length >= 2) {
          const lowerLine = this.calculateTrendLine(correspondingLows);
          
          // Check if lines are roughly parallel
          if (this.areLinesParallel(upperLine, lowerLine)) {
            const channel = this.createChannel(upperLine, lowerLine, candles, pivotPoints);
            if (channel) {
              channels.push(channel);
            }
          }
        }
      }
    }

    return this.filterAndMergeChannels(channels);
  }

  private calculateTrendLine(points: PivotPoint[]): { slope: number; intercept: number } {
    if (points.length < 2) return { slope: 0, intercept: 0 };

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.timestamp, 0);
    const sumY = points.reduce((sum, p) => sum + p.price, 0);
    const sumXY = points.reduce((sum, p) => sum + (p.timestamp * p.price), 0);
    const sumXX = points.reduce((sum, p) => sum + (p.timestamp * p.timestamp), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  private findCorrespondingLows(
    high1: PivotPoint,
    high2: PivotPoint,
    lows: PivotPoint[]
  ): PivotPoint[] {
    return lows.filter(low => 
      low.timestamp > high1.timestamp && low.timestamp < high2.timestamp
    );
  }

  private areLinesParallel(
    line1: { slope: number; intercept: number },
    line2: { slope: number; intercept: number }
  ): boolean {
    const slopeDifference = Math.abs(line1.slope - line2.slope);
    const avgSlope = (Math.abs(line1.slope) + Math.abs(line2.slope)) / 2;
    
    if (avgSlope === 0) return true; // Both horizontal
    
    return slopeDifference / avgSlope < 0.3; // Within 30% of each other
  }

  private createChannel(
    upperLine: { slope: number; intercept: number },
    lowerLine: { slope: number; intercept: number },
    candles: CandleData[],
    pivotPoints: PivotPoint[]
  ): PivotChannel | null {
    const currentTime = candles[candles.length - 1].timestamp;
    
    const upperChannel = upperLine.slope * currentTime + upperLine.intercept;
    const lowerChannel = lowerLine.slope * currentTime + lowerLine.intercept;
    const centerLine = (upperChannel + lowerChannel) / 2;
    const width = upperChannel - lowerChannel;

    // Count touches
    const touches = this.countChannelTouches(upperLine, lowerLine, candles);
    
    if (touches < this.config.minTouches) return null;

    // Calculate strength
    const strength = this.calculateChannelStrength(upperLine, lowerLine, candles, pivotPoints);
    
    // Determine direction
    const direction = this.determineChannelDirection(upperLine.slope, lowerLine.slope);

    return {
      upperChannel,
      lowerChannel,
      centerLine,
      strength,
      touches,
      direction,
      slope: (upperLine.slope + lowerLine.slope) / 2,
      width,
    };
  }

  private countChannelTouches(
    upperLine: { slope: number; intercept: number },
    lowerLine: { slope: number; intercept: number },
    candles: CandleData[]
  ): number {
    let touches = 0;
    const tolerance = 0.002; // 0.2% tolerance

    for (const candle of candles) {
      const upperPrice = upperLine.slope * candle.timestamp + upperLine.intercept;
      const lowerPrice = lowerLine.slope * candle.timestamp + lowerLine.intercept;

      // Check upper channel touch
      if (Math.abs(candle.high - upperPrice) / upperPrice <= tolerance) {
        touches++;
      }
      
      // Check lower channel touch
      if (Math.abs(candle.low - lowerPrice) / lowerPrice <= tolerance) {
        touches++;
      }
    }

    return touches;
  }

  private calculateChannelStrength(
    upperLine: { slope: number; intercept: number },
    lowerLine: { slope: number; intercept: number },
    candles: CandleData[],
    pivotPoints: PivotPoint[]
  ): number {
    let strength = 0.5;

    // Touch quality
    const touches = this.countChannelTouches(upperLine, lowerLine, candles);
    strength += Math.min(touches / 10, 0.3); // Max 0.3 from touches

    // Pivot point alignment
    const alignment = this.calculatePivotAlignment(upperLine, lowerLine, pivotPoints);
    strength += alignment * 0.3; // Max 0.3 from alignment

    // Channel consistency
    const consistency = this.calculateChannelConsistency(upperLine, lowerLine, candles);
    strength += consistency * 0.2; // Max 0.2 from consistency

    // Time span
    const timeSpan = this.calculateChannelTimeSpan(candles);
    strength += Math.min(timeSpan / (30 * 24 * 60 * 60 * 1000), 0.2); // Max 0.2 from time span (30 days)

    return Math.min(strength, 1.0);
  }

  private determineChannelDirection(upperSlope: number, lowerSlope: number): 'ascending' | 'descending' | 'horizontal' {
    const avgSlope = (upperSlope + lowerSlope) / 2;
    
    if (avgSlope > 0.001) return 'ascending';
    if (avgSlope < -0.001) return 'descending';
    return 'horizontal';
  }

  private filterAndMergeChannels(channels: PivotChannel[]): PivotChannel[] {
    // Remove overlapping channels and keep the strongest ones
    const filtered: PivotChannel[] = [];
    
    for (const channel of channels.sort((a, b) => b.strength - a.strength)) {
      const hasOverlap = filtered.some(existing => 
        this.channelsOverlap(channel, existing)
      );
      
      if (!hasOverlap) {
        filtered.push(channel);
      }
    }

    return filtered;
  }

  private channelsOverlap(channel1: PivotChannel, channel2: PivotChannel): boolean {
    const overlap1 = channel1.lowerChannel < channel2.upperChannel && channel1.upperChannel > channel2.lowerChannel;
    const overlap2 = channel2.lowerChannel < channel1.upperChannel && channel2.upperChannel > channel1.lowerChannel;
    
    return overlap1 || overlap2;
  }

  private analyzePriceTrend(candles: CandleData[]): { direction: 'bullish' | 'bearish' | 'sideways'; strength: number } {
    if (candles.length < 2) return { direction: 'sideways', strength: 0 };

    const firstPrice = candles[0].close;
    const lastPrice = candles[candles.length - 1].close;
    const priceChange = (lastPrice - firstPrice) / firstPrice;

    let direction: 'bullish' | 'bearish' | 'sideways';
    let strength: number;

    if (priceChange > 0.02) {
      direction = 'bullish';
      strength = Math.min(priceChange * 5, 1.0);
    } else if (priceChange < -0.02) {
      direction = 'bearish';
      strength = Math.min(Math.abs(priceChange) * 5, 1.0);
    } else {
      direction = 'sideways';
      strength = 0.3;
    }

    return { direction, strength };
  }

  private analyzeChannelTrend(channels: PivotChannel[]): { direction: 'bullish' | 'bearish' | 'sideways'; strength: number } {
    if (channels.length === 0) return { direction: 'sideways', strength: 0 };

    const strongestChannel = channels[0];
    
    let direction: 'bullish' | 'bearish' | 'sideways';
    switch (strongestChannel.direction) {
      case 'ascending':
        direction = 'bullish';
        break;
      case 'descending':
        direction = 'bearish';
        break;
      default:
        direction = 'sideways';
    }

    return { direction, strength: strongestChannel.strength };
  }

  private analyzeVolumeTrend(candles: CandleData[]): { strength: number } {
    if (candles.length < 10) return { strength: 0.5 };

    const firstHalf = candles.slice(0, Math.floor(candles.length / 2));
    const secondHalf = candles.slice(Math.floor(candles.length / 2));

    const firstHalfAvgVolume = firstHalf.reduce((sum, c) => sum + c.volume, 0) / firstHalf.length;
    const secondHalfAvgVolume = secondHalf.reduce((sum, c) => sum + c.volume, 0) / secondHalf.length;

    const volumeChange = (secondHalfAvgVolume - firstHalfAvgVolume) / firstHalfAvgVolume;
    
    return { strength: 0.5 + Math.min(Math.abs(volumeChange), 0.5) };
  }

  private combineDirections(directions: ('bullish' | 'bearish' | 'sideways')[]): 'bullish' | 'bearish' | 'sideways' {
    const bullishCount = directions.filter(d => d === 'bullish').length;
    const bearishCount = directions.filter(d => d === 'bearish').length;
    const sidewaysCount = directions.filter(d => d === 'sideways').length;

    if (bullishCount > bearishCount && bullishCount > sidewaysCount) return 'bullish';
    if (bearishCount > bullishCount && bearishCount > sidewaysCount) return 'bearish';
    return 'sideways';
  }

  private calculateTrendDuration(candles: CandleData[], direction: 'bullish' | 'bearish' | 'sideways'): number {
    // Simplified trend duration calculation
    let duration = 0;
    let currentTrend = direction;

    for (let i = candles.length - 1; i > 0; i--) {
      const priceChange = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
      
      let candleTrend: 'bullish' | 'bearish' | 'sideways';
      if (priceChange > 0.005) candleTrend = 'bullish';
      else if (priceChange < -0.005) candleTrend = 'bearish';
      else candleTrend = 'sideways';

      if (candleTrend === currentTrend) {
        duration += candles[i].timestamp - candles[i - 1].timestamp;
      } else {
        break;
      }
    }

    return duration;
  }

  private calculateTrendProbability(
    priceTrend: any,
    channelTrend: any,
    volumeTrend: any
  ): number {
    let probability = 0.5;

    // Agreement between price and channel trends
    if (priceTrend.direction === channelTrend.direction) {
      probability += 0.3;
    }

    // Strong volume support
    if (volumeTrend.strength > 0.7) {
      probability += 0.2;
    }

    return Math.min(probability, 1.0);
  }

  private calculateTrendConfidence(
    priceTrend: any,
    channelTrend: any,
    volumeTrend: any,
    channels: PivotChannel[]
  ): number {
    let confidence = 0.5;

    // Strength of individual components
    confidence += (priceTrend.strength + channelTrend.strength + volumeTrend.strength) / 3 * 0.4;

    // Number of confirming channels
    const confirmingChannels = channels.filter(c => 
      (c.direction === 'ascending' && priceTrend.direction === 'bullish') ||
      (c.direction === 'descending' && priceTrend.direction === 'bearish')
    ).length;
    
    confidence += Math.min(confirmingChannels / 3, 0.3);

    return Math.min(confidence, 1.0);
  }

  private calculateChannelBreakoutProbability(
    channel: PivotChannel,
    currentPrice: number,
    candles: CandleData[]
  ): number {
    let probability = 0.3; // Base probability

    // Distance from channel boundaries
    const upperDistance = Math.abs(currentPrice - channel.upperChannel) / channel.upperChannel;
    const lowerDistance = Math.abs(currentPrice - channel.lowerChannel) / channel.lowerChannel;
    const minDistance = Math.min(upperDistance, lowerDistance);

    if (minDistance < 0.01) { // Within 1% of boundary
      probability += 0.4;
    }

    // Volume confirmation
    const recentVolume = candles.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5;
    const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const volumeRatio = recentVolume / avgVolume;

    if (volumeRatio > 1.5) {
      probability += 0.3;
    }

    return Math.min(probability, 1.0);
  }

  private calculateBreakoutStrength(
    candle: CandleData,
    channel: PivotChannel,
    type: 'upper' | 'lower',
    candles: CandleData[]
  ): number {
    let strength = 0.5;

    // Volume confirmation
    const avgVolume = this.calculateAverageVolume(candles, candles.length - 1);
    const volumeRatio = candle.volume / avgVolume;
    strength += Math.min(volumeRatio / 2, 0.3);

    // Price penetration depth
    const boundary = type === 'upper' ? channel.upperChannel : channel.lowerChannel;
    const penetration = Math.abs(candle.close - boundary) / boundary;
    strength += Math.min(penetration * 10, 0.2);

    return Math.min(strength, 1.0);
  }

  private calculateBreakoutTarget(channel: PivotChannel, type: 'upper' | 'lower'): number {
    const channelWidth = channel.upperChannel - channel.lowerChannel;
    
    if (type === 'upper') {
      return channel.upperChannel + channelWidth;
    } else {
      return channel.lowerChannel - channelWidth;
    }
  }

  // Helper methods

  private calculateAverageVolume(candles: CandleData[], index: number): number {
    const start = Math.max(0, index - 20);
    const relevantCandles = candles.slice(start, index + 1);
    return relevantCandles.reduce((sum, c) => sum + c.volume, 0) / relevantCandles.length;
  }

  private calculatePriceRange(candles: CandleData[], index: number): number {
    const start = Math.max(0, index - 20);
    const relevantCandles = candles.slice(start, index + 1);
    const high = Math.max(...relevantCandles.map(c => c.high));
    const low = Math.min(...relevantCandles.map(c => c.low));
    return high - low;
  }

  private calculatePivotIsolation(pivot: PivotPoint, allPivots: PivotPoint[]): number {
    const nearbyPivots = allPivots.filter(p => 
      p !== pivot && 
      Math.abs(p.timestamp - pivot.timestamp) < 24 * 60 * 60 * 1000 && // Within 24 hours
      Math.abs(p.price - pivot.price) / pivot.price < 0.02 // Within 2% price
    );

    return Math.max(0, 1 - nearbyPivots.length / 5); // Fewer nearby pivots = higher isolation
  }

  private calculatePivotPersistence(pivot: PivotPoint, candles: CandleData[]): number {
    // Check how long the pivot level held as support/resistance
    let persistence = 0;
    const tolerance = 0.01; // 1% tolerance

    for (let i = pivot.index + 1; i < candles.length; i++) {
      const candle = candles[i];
      const distance = Math.abs(candle.close - pivot.price) / pivot.price;
      
      if (distance <= tolerance) {
        persistence += 1;
      } else if (distance > tolerance * 3) {
        break; // Level was significantly breached
      }
    }

    return Math.min(persistence / 10, 1.0); // Normalize to max 10 candles
  }

  private calculatePivotAlignment(
    upperLine: { slope: number; intercept: number },
    lowerLine: { slope: number; intercept: number },
    pivotPoints: PivotPoint[]
  ): number {
    let alignedPivots = 0;
    const tolerance = 0.02; // 2% tolerance

    for (const pivot of pivotPoints) {
      const upperPrice = upperLine.slope * pivot.timestamp + upperLine.intercept;
      const lowerPrice = lowerLine.slope * pivot.timestamp + lowerLine.intercept;

      const upperDistance = Math.abs(pivot.price - upperPrice) / upperPrice;
      const lowerDistance = Math.abs(pivot.price - lowerPrice) / lowerPrice;

      if (upperDistance <= tolerance || lowerDistance <= tolerance) {
        alignedPivots++;
      }
    }

    return Math.min(alignedPivots / pivotPoints.length, 1.0);
  }

  private calculateChannelConsistency(
    upperLine: { slope: number; intercept: number },
    lowerLine: { slope: number; intercept: number },
    candles: CandleData[]
  ): number {
    let consistentCandles = 0;

    for (const candle of candles) {
      const upperPrice = upperLine.slope * candle.timestamp + upperLine.intercept;
      const lowerPrice = lowerLine.slope * candle.timestamp + lowerLine.intercept;

      if (candle.low >= lowerPrice && candle.high <= upperPrice) {
        consistentCandles++;
      }
    }

    return consistentCandles / candles.length;
  }

  private calculateChannelTimeSpan(candles: CandleData[]): number {
    if (candles.length < 2) return 0;
    return candles[candles.length - 1].timestamp - candles[0].timestamp;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PivotChannelConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PivotChannelConfig {
    return { ...this.config };
  }
}