/**
 * Advanced Fibonacci and Pivot Channel System
 * Comprehensive system combining Fibonacci analysis, pivot channels, and confluence zones
 * with dynamic level adjustment and multi-timeframe analysis
 */

import { CandleData } from '../types/market';
import { FibonacciService } from './FibonacciService';
import { PivotChannelDetector } from './indicators/PivotChannelDetector';
import {
  FibonacciLevel,
  ConfluenceZone,
  ConfluenceFactor,
  VolumeProfile,
  VolumeNode
} from '../types/analysis';

export interface AdvancedFibonacciPivotConfig {
  fibonacci: {
    retracementLevels: number[];
    extensionLevels: number[];
    confluenceThreshold: number;
    dynamicAdjustment: boolean;
  };
  pivotChannels: {
    lookbackPeriod: number;
    minTouches: number;
    channelWidth: number;
    trendAnalysisDepth: number;
  };
  confluenceZones: {
    minFactors: number;
    priceTolerancePercent: number;
    volumeWeighting: boolean;
    timeframeWeighting: boolean;
  };
  multiTimeframe: {
    timeframes: string[];
    consensusThreshold: number;
    weightingScheme: 'equal' | 'higher_priority' | 'volume_weighted';
  };
  breakoutDetection: {
    volumeThreshold: number;
    priceThreshold: number;
    confirmationCandles: number;
  };
}

export interface EnhancedFibonacciLevel extends FibonacciLevel {
  volumeConfirmation: number;
  timeframeConsensus: number;
  dynamicAdjustment: number;
  priceActionConfirmation: number;
}

export interface PivotChannelBreakout {
  type: 'upper' | 'lower';
  price: number;
  timestamp: number;
  strength: number;
  target: number;
  probabilityScore: number;
  volumeConfirmation: number;
}

export interface ConfluenceAnalysis {
  zones: EnhancedConfluenceZone[];
  totalZones: number;
  strongZones: EnhancedConfluenceZone[];
  criticalLevels: number[];
  marketBias: 'bullish' | 'bearish' | 'neutral';
  confidenceScore: number;
}

export interface EnhancedConfluenceZone extends ConfluenceZone {
  volumeProfile: VolumeNode[];
  timeframeConsensus: TimeframeConsensus[];
  dynamicSupport: boolean;
  breakoutProbability: number;
  historicalSignificance: number;
}

export interface TimeframeConsensus {
  timeframe: string;
  agreement: boolean;
  strength: number;
  factors: ConfluenceFactor[];
}

export interface MultiTimeframeAnalysis {
  timeframe: string;
  fibonacciLevels: EnhancedFibonacciLevel[];
  pivotChannels: any[];
  confluenceZones: EnhancedConfluenceZone[];
  marketStructure: MarketStructure;
}

export interface MarketStructure {
  trend: 'bullish' | 'bearish' | 'sideways';
  strength: number;
  phase: 'accumulation' | 'markup' | 'distribution' | 'markdown';
  volatility: number;
  volume: 'high' | 'medium' | 'low';
}

export interface DynamicLevelAdjustment {
  originalLevel: number;
  adjustedLevel: number;
  adjustmentFactor: number;
  reason: string;
  confidence: number;
}

export class AdvancedFibonacciPivotSystem {
  private fibonacciService: FibonacciService;
  private pivotChannelDetector: PivotChannelDetector;
  private config: AdvancedFibonacciPivotConfig;

  constructor(config: AdvancedFibonacciPivotConfig) {
    this.config = config;
    this.fibonacciService = new FibonacciService();
    this.pivotChannelDetector = new PivotChannelDetector(config.pivotChannels);
  }

  /**
   * Perform comprehensive Fibonacci extension and retracement analysis
   */
  async calculateComprehensiveFibonacci(
    candles: CandleData[],
    swingHigh: number,
    swingLow: number,
    startTime: number,
    endTime: number
  ): Promise<EnhancedFibonacciLevel[]> {
    // Calculate base Fibonacci levels
    const retracements = this.fibonacciService.calculateRetracements({
      high: swingHigh,
      low: swingLow,
      startTime,
      endTime
    });

    const extensions = this.fibonacciService.calculateExtensions(
      { startPrice: swingLow, endPrice: swingHigh } as any,
      { endPrice: swingHigh } as any
    );

    const allLevels = [...retracements, ...extensions];

    // Enhance levels with additional analysis
    const enhancedLevels: EnhancedFibonacciLevel[] = [];

    for (const level of allLevels) {
      const enhanced: EnhancedFibonacciLevel = {
        ...level,
        volumeConfirmation: await this.calculateVolumeConfirmation(level.price, candles),
        timeframeConsensus: await this.calculateTimeframeConsensus(level, candles),
        dynamicAdjustment: this.calculateDynamicAdjustment(level, candles),
        priceActionConfirmation: this.calculatePriceActionConfirmation(level.price, candles)
      };

      enhancedLevels.push(enhanced);
    }

    // Apply dynamic adjustments if enabled
    if (this.config.fibonacci.dynamicAdjustment) {
      return this.applyDynamicAdjustments(enhancedLevels, candles);
    }

    return enhancedLevels.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Detect pivot channels with dynamic support/resistance levels
   */
  async detectDynamicPivotChannels(candles: CandleData[]): Promise<any[]> {
    const channels = await this.pivotChannelDetector.detectPivotChannels(candles);
    
    // Enhance channels with dynamic levels
    const enhancedChannels = [];

    for (const channel of channels) {
      const dynamicLevels = await this.calculateDynamicChannelLevels(channel, candles);
      const volumeProfile = this.calculateChannelVolumeProfile(channel, candles);
      const breakoutProbability = await this.calculateChannelBreakoutProbability(channel, candles);

      enhancedChannels.push({
        ...channel,
        dynamicLevels,
        volumeProfile,
        breakoutProbability,
        supportResistanceLevels: this.identifyChannelSRLevels(channel, candles)
      });
    }

    return enhancedChannels;
  }

  /**
   * Build comprehensive confluence zone analysis
   */
  async buildConfluenceZoneAnalysis(
    candles: CandleData[],
    fibonacciLevels: EnhancedFibonacciLevel[],
    pivotChannels: any[],
    volumeProfile?: VolumeProfile
  ): Promise<ConfluenceAnalysis> {
    const confluenceZones: EnhancedConfluenceZone[] = [];

    // Collect all significant levels
    const allLevels = this.collectAllSignificantLevels(fibonacciLevels, pivotChannels, volumeProfile);

    // Group levels by proximity
    const levelGroups = this.groupLevelsByProximity(allLevels);

    // Create confluence zones
    for (const group of levelGroups) {
      if (group.length >= this.config.confluenceZones.minFactors) {
        const zone = await this.createEnhancedConfluenceZone(group, candles, volumeProfile);
        confluenceZones.push(zone);
      }
    }

    // Sort by strength and identify critical levels
    const sortedZones = confluenceZones.sort((a, b) => b.strength - a.strength);
    const strongZones = sortedZones.filter(zone => zone.strength > 0.7);
    const criticalLevels = strongZones.map(zone => zone.priceLevel);

    // Determine market bias
    const marketBias = this.determineMarketBias(sortedZones, candles);
    const confidenceScore = this.calculateOverallConfidence(sortedZones);

    return {
      zones: sortedZones,
      totalZones: confluenceZones.length,
      strongZones,
      criticalLevels,
      marketBias,
      confidenceScore
    };
  }

  /**
   * Implement dynamic level adjustment based on price action and volume
   */
  async adjustLevelsDynamically(
    levels: EnhancedFibonacciLevel[],
    candles: CandleData[]
  ): Promise<DynamicLevelAdjustment[]> {
    const adjustments: DynamicLevelAdjustment[] = [];

    for (const level of levels) {
      const priceAction = this.analyzePriceActionAroundLevel(level.price, candles);
      const volumeAnalysis = this.analyzeVolumeAroundLevel(level.price, candles);
      const marketStructure = this.analyzeMarketStructure(candles);

      let adjustmentFactor = 0;
      let reason = '';

      // Volume-based adjustment
      if (volumeAnalysis.averageVolume > volumeAnalysis.historicalAverage * 1.5) {
        adjustmentFactor += 0.02; // 2% adjustment for high volume
        reason += 'High volume confirmation; ';
      }

      // Price action adjustment
      if (priceAction.rejections > 2) {
        adjustmentFactor += 0.01; // 1% adjustment for multiple rejections
        reason += 'Multiple price rejections; ';
      }

      // Market structure adjustment
      if (marketStructure.trend === 'bullish' && level.type === 'retracement') {
        adjustmentFactor -= 0.005; // Slight downward adjustment in bullish trend
        reason += 'Bullish trend bias; ';
      }

      if (adjustmentFactor !== 0) {
        const adjustedLevel = level.price * (1 + adjustmentFactor);
        const confidence = this.calculateAdjustmentConfidence(level, priceAction, volumeAnalysis);

        adjustments.push({
          originalLevel: level.price,
          adjustedLevel,
          adjustmentFactor,
          reason: reason.trim(),
          confidence
        });
      }
    }

    return adjustments;
  }

  /**
   * Perform multi-timeframe Fibonacci analysis
   */
  async performMultiTimeframeAnalysis(
    candlesByTimeframe: Map<string, CandleData[]>,
    swingPoints: { high: number; low: number; highTime: number; lowTime: number }
  ): Promise<MultiTimeframeAnalysis[]> {
    const analyses: MultiTimeframeAnalysis[] = [];

    for (const [timeframe, candles] of candlesByTimeframe) {
      const fibonacciLevels = await this.calculateComprehensiveFibonacci(
        candles,
        swingPoints.high,
        swingPoints.low,
        swingPoints.highTime,
        swingPoints.lowTime
      );

      const pivotChannels = await this.detectDynamicPivotChannels(candles);
      
      const confluenceAnalysis = await this.buildConfluenceZoneAnalysis(
        candles,
        fibonacciLevels,
        pivotChannels
      );

      const marketStructure = this.analyzeMarketStructure(candles);

      analyses.push({
        timeframe,
        fibonacciLevels,
        pivotChannels,
        confluenceZones: confluenceAnalysis.zones,
        marketStructure
      });
    }

    return analyses;
  }

  /**
   * Detect pivot channel breakouts with probability scoring
   */
  async detectPivotChannelBreakouts(
    candles: CandleData[],
    pivotChannels: any[]
  ): Promise<PivotChannelBreakout[]> {
    const breakouts: PivotChannelBreakout[] = [];
    const recentCandles = candles.slice(-this.config.breakoutDetection.confirmationCandles);

    for (const channel of pivotChannels) {
      for (const candle of recentCandles) {
        // Check for upper breakout
        if (candle.close > channel.upperChannel) {
          const breakout = await this.analyzeBreakout(candle, channel, 'upper', candles);
          if (breakout.probabilityScore > 0.6) {
            breakouts.push(breakout);
          }
        }

        // Check for lower breakout
        if (candle.close < channel.lowerChannel) {
          const breakout = await this.analyzeBreakout(candle, channel, 'lower', candles);
          if (breakout.probabilityScore > 0.6) {
            breakouts.push(breakout);
          }
        }
      }
    }

    return breakouts.sort((a, b) => b.probabilityScore - a.probabilityScore);
  }

  // Private helper methods

  private async calculateVolumeConfirmation(price: number, candles: CandleData[]): Promise<number> {
    const tolerance = price * 0.01; // 1% tolerance
    let volumeAtLevel = 0;
    let totalVolume = 0;

    for (const candle of candles) {
      totalVolume += candle.volume;
      
      if (Math.abs(candle.close - price) <= tolerance ||
          Math.abs(candle.high - price) <= tolerance ||
          Math.abs(candle.low - price) <= tolerance) {
        volumeAtLevel += candle.volume;
      }
    }

    return totalVolume > 0 ? volumeAtLevel / totalVolume : 0;
  }

  private async calculateTimeframeConsensus(level: FibonacciLevel, candles: CandleData[]): Promise<number> {
    // Simplified consensus calculation
    // In a real implementation, this would analyze multiple timeframes
    return 0.8; // Placeholder
  }

  private calculateDynamicAdjustment(level: FibonacciLevel, candles: CandleData[]): number {
    const recentCandles = candles.slice(-20);
    const volatility = this.calculateVolatility(recentCandles);
    
    // Adjust based on volatility
    return Math.min(volatility * 0.1, 0.05); // Max 5% adjustment
  }

  private calculatePriceActionConfirmation(price: number, candles: CandleData[]): number {
    const tolerance = price * 0.005; // 0.5% tolerance
    let confirmations = 0;

    for (const candle of candles) {
      // Check for bounces or rejections at the level
      if ((Math.abs(candle.low - price) <= tolerance && candle.close > candle.open) ||
          (Math.abs(candle.high - price) <= tolerance && candle.close < candle.open)) {
        confirmations++;
      }
    }

    return Math.min(confirmations / 10, 1.0); // Normalize to max 10 confirmations
  }

  private applyDynamicAdjustments(
    levels: EnhancedFibonacciLevel[],
    candles: CandleData[]
  ): EnhancedFibonacciLevel[] {
    return levels.map(level => {
      const adjustment = level.dynamicAdjustment;
      const adjustedPrice = level.price * (1 + adjustment);
      
      return {
        ...level,
        price: adjustedPrice,
        description: `${level.description} (Dynamically Adjusted)`
      };
    });
  }

  private async calculateDynamicChannelLevels(channel: any, candles: CandleData[]): Promise<number[]> {
    const levels: number[] = [];
    const channelHeight = channel.upperChannel - channel.lowerChannel;
    
    // Add intermediate levels based on Fibonacci ratios
    const fibRatios = [0.236, 0.382, 0.5, 0.618, 0.786];
    
    for (const ratio of fibRatios) {
      const level = channel.lowerChannel + (channelHeight * ratio);
      levels.push(level);
    }

    return levels;
  }

  private calculateChannelVolumeProfile(channel: any, candles: CandleData[]): VolumeNode[] {
    const volumeProfile: VolumeNode[] = [];
    const priceStep = (channel.upperChannel - channel.lowerChannel) / 20; // 20 price levels
    
    for (let i = 0; i < 20; i++) {
      const priceLevel = channel.lowerChannel + (i * priceStep);
      let volumeAtLevel = 0;

      for (const candle of candles) {
        if (candle.low <= priceLevel && candle.high >= priceLevel) {
          volumeAtLevel += candle.volume / (candle.high - candle.low + 1); // Distribute volume
        }
      }

      volumeProfile.push({
        price: priceLevel,
        volume: volumeAtLevel,
        percentage: 0 // Will be calculated after all levels
      });
    }

    // Calculate percentages
    const totalVolume = volumeProfile.reduce((sum, node) => sum + node.volume, 0);
    volumeProfile.forEach(node => {
      node.percentage = totalVolume > 0 ? (node.volume / totalVolume) * 100 : 0;
    });

    return volumeProfile;
  }

  private async calculateChannelBreakoutProbability(channel: any, candles: CandleData[]): Promise<number> {
    let probability = 0.3; // Base probability

    const recentCandles = candles.slice(-10);
    const currentPrice = candles[candles.length - 1].close;

    // Distance from channel boundaries
    const upperDistance = Math.abs(currentPrice - channel.upperChannel) / channel.upperChannel;
    const lowerDistance = Math.abs(currentPrice - channel.lowerChannel) / channel.lowerChannel;
    const minDistance = Math.min(upperDistance, lowerDistance);

    if (minDistance < 0.02) { // Within 2% of boundary
      probability += 0.3;
    }

    // Volume analysis
    const recentVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
    const historicalVolume = candles.slice(-50).reduce((sum, c) => sum + c.volume, 0) / 50;
    
    if (recentVolume > historicalVolume * 1.5) {
      probability += 0.2;
    }

    // Price momentum
    const momentum = this.calculateMomentum(recentCandles);
    if (Math.abs(momentum) > 0.02) { // 2% momentum
      probability += 0.2;
    }

    return Math.min(probability, 1.0);
  }

  private identifyChannelSRLevels(channel: any, candles: CandleData[]): number[] {
    const levels: number[] = [];
    
    // Add channel boundaries
    levels.push(channel.upperChannel, channel.lowerChannel);
    
    // Add center line
    levels.push(channel.centerLine);
    
    // Add quarter lines
    const quarterHeight = (channel.upperChannel - channel.lowerChannel) / 4;
    levels.push(channel.lowerChannel + quarterHeight);
    levels.push(channel.upperChannel - quarterHeight);

    return levels.sort((a, b) => b - a);
  }

  private collectAllSignificantLevels(
    fibonacciLevels: EnhancedFibonacciLevel[],
    pivotChannels: any[],
    volumeProfile?: VolumeProfile
  ): Array<{ price: number; type: string; strength: number }> {
    const levels: Array<{ price: number; type: string; strength: number }> = [];

    // Add Fibonacci levels
    fibonacciLevels.forEach(fib => {
      levels.push({
        price: fib.price,
        type: 'fibonacci',
        strength: fib.strength
      });
    });

    // Add pivot channel levels
    pivotChannels.forEach(channel => {
      levels.push(
        { price: channel.upperChannel, type: 'pivot_resistance', strength: channel.strength },
        { price: channel.lowerChannel, type: 'pivot_support', strength: channel.strength },
        { price: channel.centerLine, type: 'pivot_center', strength: channel.strength * 0.8 }
      );
    });

    // Add volume profile levels
    if (volumeProfile) {
      levels.push({ price: volumeProfile.poc, type: 'volume_poc', strength: 0.9 });
      levels.push({ price: volumeProfile.valueAreaHigh, type: 'volume_vah', strength: 0.7 });
      levels.push({ price: volumeProfile.valueAreaLow, type: 'volume_val', strength: 0.7 });
    }

    return levels;
  }

  private groupLevelsByProximity(
    levels: Array<{ price: number; type: string; strength: number }>
  ): Array<Array<{ price: number; type: string; strength: number }>> {
    const groups: Array<Array<{ price: number; type: string; strength: number }>> = [];
    const tolerance = this.config.confluenceZones.priceTolerancePercent / 100;
    const used = new Set<number>();

    for (let i = 0; i < levels.length; i++) {
      if (used.has(i)) continue;

      const group = [levels[i]];
      used.add(i);

      for (let j = i + 1; j < levels.length; j++) {
        if (used.has(j)) continue;

        const priceDiff = Math.abs(levels[i].price - levels[j].price) / levels[i].price;
        if (priceDiff <= tolerance) {
          group.push(levels[j]);
          used.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private async createEnhancedConfluenceZone(
    group: Array<{ price: number; type: string; strength: number }>,
    candles: CandleData[],
    volumeProfile?: VolumeProfile
  ): Promise<EnhancedConfluenceZone> {
    const avgPrice = group.reduce((sum, level) => sum + level.price, 0) / group.length;
    const totalStrength = group.reduce((sum, level) => sum + level.strength, 0);
    
    const factors: ConfluenceFactor[] = group.map(level => ({
      type: level.type as any,
      description: `${level.type} at ${level.price.toFixed(4)}`,
      weight: level.strength
    }));

    const volumeProfileAtLevel = this.getVolumeProfileAtLevel(avgPrice, volumeProfile);
    const timeframeConsensus = await this.calculateTimeframeConsensusForZone(avgPrice, candles);
    const dynamicSupport = this.isDynamicSupportLevel(avgPrice, candles);
    const breakoutProbability = this.calculateZoneBreakoutProbability(avgPrice, candles);
    const historicalSignificance = this.calculateHistoricalSignificance(avgPrice, candles);

    return {
      priceLevel: avgPrice,
      strength: Math.min(totalStrength / group.length, 1.0),
      factors,
      type: this.determineZoneType(avgPrice, candles),
      reliability: this.calculateZoneReliability(group, candles),
      volumeProfile: volumeProfileAtLevel,
      timeframeConsensus,
      dynamicSupport,
      breakoutProbability,
      historicalSignificance
    };
  }

  private determineMarketBias(
    zones: EnhancedConfluenceZone[],
    candles: CandleData[]
  ): 'bullish' | 'bearish' | 'neutral' {
    const currentPrice = candles[candles.length - 1].close;
    const strongZones = zones.filter(zone => zone.strength > 0.7);

    let supportZones = 0;
    let resistanceZones = 0;

    for (const zone of strongZones) {
      if (zone.priceLevel < currentPrice) {
        supportZones++;
      } else {
        resistanceZones++;
      }
    }

    if (supportZones > resistanceZones * 1.5) return 'bullish';
    if (resistanceZones > supportZones * 1.5) return 'bearish';
    return 'neutral';
  }

  private calculateOverallConfidence(zones: EnhancedConfluenceZone[]): number {
    if (zones.length === 0) return 0;

    const avgStrength = zones.reduce((sum, zone) => sum + zone.strength, 0) / zones.length;
    const strongZoneRatio = zones.filter(zone => zone.strength > 0.7).length / zones.length;
    
    return (avgStrength * 0.7) + (strongZoneRatio * 0.3);
  }

  private analyzePriceActionAroundLevel(price: number, candles: CandleData[]): any {
    const tolerance = price * 0.01; // 1% tolerance
    let rejections = 0;
    let bounces = 0;

    for (const candle of candles) {
      if (Math.abs(candle.high - price) <= tolerance && candle.close < candle.open) {
        rejections++;
      }
      if (Math.abs(candle.low - price) <= tolerance && candle.close > candle.open) {
        bounces++;
      }
    }

    return { rejections, bounces };
  }

  private analyzeVolumeAroundLevel(price: number, candles: CandleData[]): any {
    const tolerance = price * 0.01; // 1% tolerance
    let volumeAtLevel = 0;
    let candleCount = 0;

    for (const candle of candles) {
      if (candle.low <= price + tolerance && candle.high >= price - tolerance) {
        volumeAtLevel += candle.volume;
        candleCount++;
      }
    }

    const averageVolume = candleCount > 0 ? volumeAtLevel / candleCount : 0;
    const historicalAverage = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;

    return { averageVolume, historicalAverage };
  }

  private analyzeMarketStructure(candles: CandleData[]): MarketStructure {
    const recentCandles = candles.slice(-50);
    
    // Simple trend analysis
    const firstPrice = recentCandles[0].close;
    const lastPrice = recentCandles[recentCandles.length - 1].close;
    const priceChange = (lastPrice - firstPrice) / firstPrice;

    let trend: 'bullish' | 'bearish' | 'sideways';
    if (priceChange > 0.05) trend = 'bullish';
    else if (priceChange < -0.05) trend = 'bearish';
    else trend = 'sideways';

    const strength = Math.min(Math.abs(priceChange) * 10, 1.0);
    const volatility = this.calculateVolatility(recentCandles);
    
    // Simplified phase detection
    const phase = this.detectMarketPhase(recentCandles);
    
    // Volume analysis
    const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
    const historicalAvg = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
    const volumeRatio = avgVolume / historicalAvg;
    
    let volume: 'high' | 'medium' | 'low';
    if (volumeRatio > 1.3) volume = 'high';
    else if (volumeRatio > 0.7) volume = 'medium';
    else volume = 'low';

    return {
      trend,
      strength,
      phase,
      volatility,
      volume
    };
  }

  private calculateAdjustmentConfidence(
    level: EnhancedFibonacciLevel,
    priceAction: any,
    volumeAnalysis: any
  ): number {
    let confidence = 0.5;

    // Volume confirmation
    if (volumeAnalysis.averageVolume > volumeAnalysis.historicalAverage) {
      confidence += 0.2;
    }

    // Price action confirmation
    if (priceAction.rejections > 1 || priceAction.bounces > 1) {
      confidence += 0.2;
    }

    // Original level strength
    confidence += level.strength * 0.3;

    return Math.min(confidence, 1.0);
  }

  private async analyzeBreakout(
    candle: CandleData,
    channel: any,
    type: 'upper' | 'lower',
    candles: CandleData[]
  ): Promise<PivotChannelBreakout> {
    const boundary = type === 'upper' ? channel.upperChannel : channel.lowerChannel;
    const penetration = Math.abs(candle.close - boundary) / boundary;
    
    // Calculate volume confirmation
    const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const volumeConfirmation = candle.volume / avgVolume;
    
    // Calculate probability score
    let probabilityScore = 0.5;
    
    // Penetration depth
    probabilityScore += Math.min(penetration * 10, 0.3);
    
    // Volume confirmation
    if (volumeConfirmation > 1.5) probabilityScore += 0.3;
    else if (volumeConfirmation > 1.2) probabilityScore += 0.2;
    
    // Channel strength
    probabilityScore += channel.strength * 0.2;

    // Calculate target
    const channelWidth = channel.upperChannel - channel.lowerChannel;
    const target = type === 'upper' 
      ? channel.upperChannel + channelWidth 
      : channel.lowerChannel - channelWidth;

    return {
      type,
      price: candle.close,
      timestamp: candle.timestamp,
      strength: channel.strength,
      target,
      probabilityScore: Math.min(probabilityScore, 1.0),
      volumeConfirmation
    };
  }

  // Additional helper methods

  private calculateVolatility(candles: CandleData[]): number {
    if (candles.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      const return_ = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
      returns.push(return_);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateMomentum(candles: CandleData[]): number {
    if (candles.length < 2) return 0;
    
    const firstPrice = candles[0].close;
    const lastPrice = candles[candles.length - 1].close;
    
    return (lastPrice - firstPrice) / firstPrice;
  }

  private detectMarketPhase(candles: CandleData[]): 'accumulation' | 'markup' | 'distribution' | 'markdown' {
    // Simplified phase detection based on price and volume patterns
    const priceChange = this.calculateMomentum(candles);
    const volatility = this.calculateVolatility(candles);
    
    if (priceChange > 0.02 && volatility < 0.03) return 'markup';
    if (priceChange < -0.02 && volatility < 0.03) return 'markdown';
    if (Math.abs(priceChange) < 0.01 && volatility < 0.02) return 'accumulation';
    return 'distribution';
  }

  private getVolumeProfileAtLevel(price: number, volumeProfile?: VolumeProfile): VolumeNode[] {
    if (!volumeProfile) return [];
    
    const tolerance = price * 0.01; // 1% tolerance
    return volumeProfile.volumeByPrice.filter(node => 
      Math.abs(node.price - price) <= tolerance
    );
  }

  private async calculateTimeframeConsensusForZone(
    price: number,
    candles: CandleData[]
  ): Promise<TimeframeConsensus[]> {
    // Simplified implementation - would analyze multiple timeframes in practice
    return [{
      timeframe: '1h',
      agreement: true,
      strength: 0.8,
      factors: [{
        type: 'fibonacci',
        description: 'Fibonacci level confirmation',
        weight: 0.8
      }]
    }];
  }

  private isDynamicSupportLevel(price: number, candles: CandleData[]): boolean {
    const tolerance = price * 0.01;
    let supportCount = 0;

    for (const candle of candles.slice(-20)) {
      if (Math.abs(candle.low - price) <= tolerance && candle.close > candle.open) {
        supportCount++;
      }
    }

    return supportCount >= 2;
  }

  private calculateZoneBreakoutProbability(price: number, candles: CandleData[]): number {
    const currentPrice = candles[candles.length - 1].close;
    const distance = Math.abs(currentPrice - price) / price;
    
    // Closer to the level = higher breakout probability
    return Math.max(0.1, 1 - (distance * 10));
  }

  private calculateHistoricalSignificance(price: number, candles: CandleData[]): number {
    const tolerance = price * 0.02; // 2% tolerance
    let significantTouches = 0;

    for (const candle of candles) {
      if ((Math.abs(candle.high - price) <= tolerance) || 
          (Math.abs(candle.low - price) <= tolerance)) {
        significantTouches++;
      }
    }

    return Math.min(significantTouches / 10, 1.0);
  }

  private determineZoneType(price: number, candles: CandleData[]): 'support' | 'resistance' | 'reversal' {
    const currentPrice = candles[candles.length - 1].close;
    
    if (price < currentPrice) return 'support';
    if (price > currentPrice) return 'resistance';
    return 'reversal';
  }

  private calculateZoneReliability(
    group: Array<{ price: number; type: string; strength: number }>,
    candles: CandleData[]
  ): number {
    const factorCount = group.length;
    const avgStrength = group.reduce((sum, level) => sum + level.strength, 0) / factorCount;
    const diversityBonus = new Set(group.map(g => g.type)).size / 5; // Max 5 different types
    
    return Math.min((avgStrength * 0.7) + (diversityBonus * 0.3), 1.0);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AdvancedFibonacciPivotConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.pivotChannels) {
      this.pivotChannelDetector.updateConfig(newConfig.pivotChannels);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AdvancedFibonacciPivotConfig {
    return { ...this.config };
  }
}