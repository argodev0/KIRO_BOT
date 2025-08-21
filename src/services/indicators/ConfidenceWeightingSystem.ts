/**
 * Confidence Weighting System
 * Advanced confidence calculation and weighting for technical analysis components
 */

import { CandleData } from '../../types/market';
import { TechnicalIndicators, MarketRegime, ConfluenceZone } from '../../types/analysis';
import { IndicatorScore, CorrelationMatrix } from './TechnicalIndicatorScoringMatrix';
import { AdaptiveThresholds, MarketConditions } from './AdaptiveThresholdManager';

export interface ConfidenceWeights {
  technical: number;
  patterns: number;
  volume: number;
  timeframe: number;
  correlation: number;
  market_regime: number;
  volatility: number;
  liquidity: number;
}

export interface ConfidenceFactors {
  technicalConfidence: number;
  patternConfidence: number;
  volumeConfidence: number;
  timeframeConfidence: number;
  correlationConfidence: number;
  marketRegimeConfidence: number;
  volatilityConfidence: number;
  liquidityConfidence: number;
}

export interface WeightedConfidence {
  overallConfidence: number;
  factors: ConfidenceFactors;
  weights: ConfidenceWeights;
  adjustments: ConfidenceAdjustment[];
  reliability: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ConfidenceAdjustment {
  factor: string;
  originalValue: number;
  adjustedValue: number;
  reason: string;
  impact: number;
}

export interface ConfidenceConfig {
  baseWeights: ConfidenceWeights;
  adaptiveWeighting: boolean;
  volatilityAdjustment: boolean;
  timeDecay: boolean;
  correlationBoost: boolean;
  minConfidenceThreshold: number;
  maxConfidenceThreshold: number;
  decayRate: number;
  boostThreshold: number;
}

export class ConfidenceWeightingSystem {
  private config: ConfidenceConfig;
  private historicalPerformance: Map<string, number[]> = new Map();

  constructor(config?: Partial<ConfidenceConfig>) {
    this.config = {
      baseWeights: {
        technical: 0.25,
        patterns: 0.20,
        volume: 0.15,
        timeframe: 0.10,
        correlation: 0.10,
        market_regime: 0.10,
        volatility: 0.05,
        liquidity: 0.05,
      },
      adaptiveWeighting: true,
      volatilityAdjustment: true,
      timeDecay: true,
      correlationBoost: true,
      minConfidenceThreshold: 0.3,
      maxConfidenceThreshold: 0.95,
      decayRate: 0.05,
      boostThreshold: 0.7,
      ...config,
    };
  }

  /**
   * Calculate weighted confidence for technical analysis
   */
  async calculateWeightedConfidence(
    candles: CandleData[],
    indicators: TechnicalIndicators,
    indicatorScores: IndicatorScore[],
    correlationMatrix: CorrelationMatrix,
    marketConditions: MarketConditions,
    confluenceZones: ConfluenceZone[],
    thresholds: AdaptiveThresholds
  ): Promise<WeightedConfidence> {
    // Calculate individual confidence factors
    const factors = await this.calculateConfidenceFactors(
      candles,
      indicators,
      indicatorScores,
      correlationMatrix,
      marketConditions,
      confluenceZones,
      thresholds
    );

    // Get adaptive weights
    const weights = await this.calculateAdaptiveWeights(
      factors,
      marketConditions,
      correlationMatrix
    );

    // Apply adjustments
    const { adjustedFactors, adjustments } = await this.applyConfidenceAdjustments(
      factors,
      marketConditions,
      candles
    );

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(adjustedFactors, weights);

    // Calculate reliability and risk level
    const reliability = this.calculateReliability(adjustedFactors, correlationMatrix);
    const riskLevel = this.assessRiskLevel(overallConfidence, marketConditions, adjustedFactors);

    return {
      overallConfidence: Math.max(
        this.config.minConfidenceThreshold,
        Math.min(this.config.maxConfidenceThreshold, overallConfidence)
      ),
      factors: adjustedFactors,
      weights,
      adjustments,
      reliability,
      riskLevel,
    };
  }

  /**
   * Calculate individual confidence factors
   */
  private async calculateConfidenceFactors(
    candles: CandleData[],
    indicators: TechnicalIndicators,
    indicatorScores: IndicatorScore[],
    correlationMatrix: CorrelationMatrix,
    marketConditions: MarketConditions,
    confluenceZones: ConfluenceZone[],
    thresholds: AdaptiveThresholds
  ): Promise<ConfidenceFactors> {
    // Technical indicator confidence
    const technicalConfidence = this.calculateTechnicalConfidence(
      indicatorScores,
      thresholds
    );

    // Pattern confidence (simplified - would integrate with pattern recognition)
    const patternConfidence = this.calculatePatternConfidence(
      candles,
      confluenceZones
    );

    // Volume confidence
    const volumeConfidence = this.calculateVolumeConfidence(
      candles,
      marketConditions
    );

    // Timeframe confidence (multi-timeframe alignment)
    const timeframeConfidence = this.calculateTimeframeConfidence(
      indicators,
      marketConditions
    );

    // Correlation confidence
    const correlationConfidence = this.calculateCorrelationConfidence(
      correlationMatrix
    );

    // Market regime confidence
    const marketRegimeConfidence = this.calculateMarketRegimeConfidence(
      marketConditions.regime
    );

    // Volatility confidence
    const volatilityConfidence = this.calculateVolatilityConfidence(
      marketConditions.volatility,
      candles
    );

    // Liquidity confidence
    const liquidityConfidence = this.calculateLiquidityConfidence(
      candles,
      marketConditions
    );

    return {
      technicalConfidence,
      patternConfidence,
      volumeConfidence,
      timeframeConfidence,
      correlationConfidence,
      marketRegimeConfidence,
      volatilityConfidence,
      liquidityConfidence,
    };
  }

  /**
   * Calculate technical indicator confidence
   */
  private calculateTechnicalConfidence(
    indicatorScores: IndicatorScore[],
    thresholds: AdaptiveThresholds
  ): number {
    if (indicatorScores.length === 0) return 0.3;

    let totalConfidence = 0;
    let totalWeight = 0;

    for (const score of indicatorScores) {
      let confidence = score.confidence;
      
      // Adjust confidence based on signal strength
      if (score.strength === 'strong') {
        confidence *= 1.2;
      } else if (score.strength === 'weak') {
        confidence *= 0.8;
      }

      // Adjust confidence based on score magnitude
      confidence *= (0.5 + score.score * 0.5);

      // Weight by indicator importance
      const weight = this.getIndicatorWeight(score.indicator);
      totalConfidence += confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.min(1, totalConfidence / totalWeight) : 0.3;
  }

  /**
   * Calculate pattern confidence
   */
  private calculatePatternConfidence(
    candles: CandleData[],
    confluenceZones: ConfluenceZone[]
  ): number {
    if (confluenceZones.length === 0) return 0.4;

    // Calculate confidence based on confluence zones
    let maxConfluence = 0;
    let avgReliability = 0;

    for (const zone of confluenceZones) {
      maxConfluence = Math.max(maxConfluence, zone.strength);
      avgReliability += zone.reliability;
    }

    avgReliability /= confluenceZones.length;

    // Boost confidence for multiple confluence zones
    const confluenceBoost = Math.min(0.2, confluenceZones.length * 0.05);
    
    return Math.min(1, (maxConfluence + avgReliability) / 2 + confluenceBoost);
  }

  /**
   * Calculate volume confidence
   */
  private calculateVolumeConfidence(
    candles: CandleData[],
    marketConditions: MarketConditions
  ): number {
    if (candles.length < 10) return 0.4;

    const recentCandles = candles.slice(-10);
    const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
    const currentVolume = recentCandles[recentCandles.length - 1].volume;

    // Volume spike confidence
    const volumeRatio = currentVolume / avgVolume;
    let confidence = Math.min(1, volumeRatio / 2);

    // Adjust for market conditions
    if (marketConditions.volumeProfile === 'high') {
      confidence *= 1.2;
    } else if (marketConditions.volumeProfile === 'low') {
      confidence *= 0.8;
    }

    // Volume trend consistency
    const volumeTrend = this.calculateVolumeTrend(recentCandles);
    if (Math.abs(volumeTrend) > 0.1) {
      confidence *= 1.1;
    }

    return Math.min(1, confidence);
  }

  /**
   * Calculate timeframe confidence
   */
  private calculateTimeframeConfidence(
    indicators: TechnicalIndicators,
    marketConditions: MarketConditions
  ): number {
    // Simplified timeframe confidence - would need multi-timeframe data
    let confidence = 0.6;

    // Boost confidence if trend is strong
    if (indicators.trend !== 'sideways') {
      confidence += 0.2;
    }

    // Boost confidence if momentum aligns with trend
    if (
      (indicators.trend === 'bullish' && indicators.momentum !== 'weak') ||
      (indicators.trend === 'bearish' && indicators.momentum !== 'weak')
    ) {
      confidence += 0.1;
    }

    // Adjust for market regime
    if (marketConditions.regime.type === 'trending') {
      confidence *= 1.1;
    } else if (marketConditions.regime.type === 'ranging') {
      confidence *= 0.9;
    }

    return Math.min(1, confidence);
  }

  /**
   * Calculate correlation confidence
   */
  private calculateCorrelationConfidence(correlationMatrix: CorrelationMatrix): number {
    if (correlationMatrix.pairs.length === 0) return 0.5;

    // Higher confidence when indicators are well-correlated
    const strongCorrelations = correlationMatrix.strongCorrelations.length;
    const totalPairs = correlationMatrix.pairs.length;
    
    const correlationRatio = strongCorrelations / totalPairs;
    const avgCorrelation = correlationMatrix.averageCorrelation;

    // Base confidence from correlation strength
    let confidence = avgCorrelation * 0.7 + correlationRatio * 0.3;

    // Boost for agreement among indicators
    const agreementCount = correlationMatrix.pairs.filter(p => p.agreement).length;
    const agreementRatio = agreementCount / totalPairs;
    confidence *= (0.8 + agreementRatio * 0.2);

    return Math.min(1, confidence);
  }

  /**
   * Calculate market regime confidence
   */
  private calculateMarketRegimeConfidence(regime: MarketRegime): number {
    let confidence = regime.confidence;

    // Adjust based on regime type
    switch (regime.type) {
      case 'trending':
        confidence *= 1.1; // Higher confidence in trending markets
        break;
      case 'ranging':
        confidence *= 0.9; // Lower confidence in ranging markets
        break;
      case 'breakout':
        confidence *= 1.2; // Higher confidence during breakouts
        break;
      case 'reversal':
        confidence *= 0.8; // Lower confidence during reversals
        break;
    }

    // Adjust based on regime strength
    confidence *= (0.7 + regime.strength * 0.3);

    return Math.min(1, confidence);
  }

  /**
   * Calculate volatility confidence
   */
  private calculateVolatilityConfidence(
    volatility: number,
    candles: CandleData[]
  ): number {
    // Moderate volatility gives highest confidence
    let confidence = 1 - Math.abs(volatility - 0.2) / 0.3;
    confidence = Math.max(0.2, Math.min(1, confidence));

    // Adjust for volatility stability
    if (candles.length >= 20) {
      const volatilityStability = this.calculateVolatilityStability(candles);
      confidence *= (0.8 + volatilityStability * 0.2);
    }

    return confidence;
  }

  /**
   * Calculate liquidity confidence
   */
  private calculateLiquidityConfidence(
    candles: CandleData[],
    marketConditions: MarketConditions
  ): number {
    let confidence = 0.6;

    // Adjust based on volume profile
    switch (marketConditions.volumeProfile) {
      case 'high':
        confidence = 0.8;
        break;
      case 'medium':
        confidence = 0.6;
        break;
      case 'low':
        confidence = 0.4;
        break;
    }

    // Adjust based on market session
    if (marketConditions.marketSession === 'active') {
      confidence *= 1.1;
    } else if (marketConditions.marketSession === 'quiet') {
      confidence *= 0.9;
    }

    // Adjust based on spread (simplified - would need bid/ask data)
    const avgRange = candles.slice(-10).reduce((sum, c) => sum + (c.high - c.low), 0) / 10;
    const avgPrice = candles.slice(-10).reduce((sum, c) => sum + c.close, 0) / 10;
    const spreadRatio = avgRange / avgPrice;
    
    if (spreadRatio < 0.01) {
      confidence *= 1.1; // Tight spreads = good liquidity
    } else if (spreadRatio > 0.03) {
      confidence *= 0.9; // Wide spreads = poor liquidity
    }

    return Math.min(1, confidence);
  }

  /**
   * Calculate adaptive weights based on market conditions
   */
  private async calculateAdaptiveWeights(
    factors: ConfidenceFactors,
    marketConditions: MarketConditions,
    correlationMatrix: CorrelationMatrix
  ): Promise<ConfidenceWeights> {
    let weights = { ...this.config.baseWeights };

    if (!this.config.adaptiveWeighting) {
      return weights;
    }

    // Adjust weights based on market regime
    switch (marketConditions.regime.type) {
      case 'trending':
        weights.technical *= 1.2;
        weights.timeframe *= 1.3;
        weights.patterns *= 0.9;
        break;
      case 'ranging':
        weights.patterns *= 1.2;
        weights.volume *= 1.1;
        weights.technical *= 0.9;
        break;
      case 'breakout':
        weights.volume *= 1.4;
        weights.volatility *= 1.3;
        weights.patterns *= 1.1;
        break;
      case 'reversal':
        weights.patterns *= 1.3;
        weights.correlation *= 1.2;
        weights.technical *= 1.1;
        break;
    }

    // Adjust weights based on correlation strength
    if (correlationMatrix.averageCorrelation > 0.7) {
      weights.correlation *= 1.3;
      weights.technical *= 1.1;
    } else if (correlationMatrix.averageCorrelation < 0.3) {
      weights.correlation *= 0.7;
      weights.patterns *= 1.1;
    }

    // Adjust weights based on volatility
    if (marketConditions.volatility > 0.4) {
      weights.volatility *= 1.4;
      weights.volume *= 1.2;
      weights.technical *= 0.9;
    } else if (marketConditions.volatility < 0.1) {
      weights.patterns *= 1.2;
      weights.timeframe *= 1.1;
      weights.volatility *= 0.8;
    }

    // Normalize weights to sum to 1
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    for (const key in weights) {
      weights[key] /= totalWeight;
    }

    return weights;
  }

  /**
   * Apply confidence adjustments
   */
  private async applyConfidenceAdjustments(
    factors: ConfidenceFactors,
    marketConditions: MarketConditions,
    candles: CandleData[]
  ): Promise<{ adjustedFactors: ConfidenceFactors; adjustments: ConfidenceAdjustment[] }> {
    const adjustedFactors = { ...factors };
    const adjustments: ConfidenceAdjustment[] = [];

    // Time decay adjustment
    if (this.config.timeDecay) {
      const timeDecayFactor = this.calculateTimeDecayFactor(candles);
      for (const key in adjustedFactors) {
        const original = adjustedFactors[key];
        adjustedFactors[key] *= timeDecayFactor;
        
        if (Math.abs(adjustedFactors[key] - original) > 0.01) {
          adjustments.push({
            factor: key,
            originalValue: original,
            adjustedValue: adjustedFactors[key],
            reason: 'Time decay adjustment',
            impact: adjustedFactors[key] - original,
          });
        }
      }
    }

    // Volatility adjustment
    if (this.config.volatilityAdjustment) {
      const volatilityAdjustment = this.calculateVolatilityAdjustment(marketConditions.volatility);
      
      adjustedFactors.technicalConfidence *= volatilityAdjustment;
      adjustedFactors.patternConfidence *= volatilityAdjustment;
      
      adjustments.push({
        factor: 'volatility_adjustment',
        originalValue: 1,
        adjustedValue: volatilityAdjustment,
        reason: `Volatility adjustment for ${marketConditions.volatility.toFixed(3)}`,
        impact: volatilityAdjustment - 1,
      });
    }

    // Historical performance adjustment
    const performanceAdjustment = await this.calculatePerformanceAdjustment();
    if (performanceAdjustment !== 1) {
      for (const key in adjustedFactors) {
        adjustedFactors[key] *= performanceAdjustment;
      }
      
      adjustments.push({
        factor: 'historical_performance',
        originalValue: 1,
        adjustedValue: performanceAdjustment,
        reason: 'Historical performance adjustment',
        impact: performanceAdjustment - 1,
      });
    }

    return { adjustedFactors, adjustments };
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    factors: ConfidenceFactors,
    weights: ConfidenceWeights
  ): number {
    return (
      factors.technicalConfidence * weights.technical +
      factors.patternConfidence * weights.patterns +
      factors.volumeConfidence * weights.volume +
      factors.timeframeConfidence * weights.timeframe +
      factors.correlationConfidence * weights.correlation +
      factors.marketRegimeConfidence * weights.market_regime +
      factors.volatilityConfidence * weights.volatility +
      factors.liquidityConfidence * weights.liquidity
    );
  }

  /**
   * Calculate reliability score
   */
  private calculateReliability(
    factors: ConfidenceFactors,
    correlationMatrix: CorrelationMatrix
  ): number {
    // Base reliability from factor consistency
    const factorValues = Object.values(factors);
    const avgFactor = factorValues.reduce((sum, f) => sum + f, 0) / factorValues.length;
    const factorVariance = factorValues.reduce((sum, f) => sum + Math.pow(f - avgFactor, 2), 0) / factorValues.length;
    const factorConsistency = 1 - Math.min(1, factorVariance);

    // Correlation reliability
    const correlationReliability = correlationMatrix.averageCorrelation;

    // Combined reliability
    return (factorConsistency * 0.6 + correlationReliability * 0.4);
  }

  /**
   * Assess risk level
   */
  private assessRiskLevel(
    confidence: number,
    marketConditions: MarketConditions,
    factors: ConfidenceFactors
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Confidence-based risk
    if (confidence < 0.4) riskScore += 3;
    else if (confidence < 0.6) riskScore += 2;
    else if (confidence < 0.8) riskScore += 1;

    // Volatility-based risk
    if (marketConditions.volatility > 0.5) riskScore += 2;
    else if (marketConditions.volatility > 0.3) riskScore += 1;

    // Market regime risk
    if (marketConditions.regime.type === 'breakout') riskScore += 2;
    else if (marketConditions.regime.type === 'reversal') riskScore += 1;

    // Factor consistency risk
    const factorValues = Object.values(factors);
    const minFactor = Math.min(...factorValues);
    const maxFactor = Math.max(...factorValues);
    if (maxFactor - minFactor > 0.5) riskScore += 1;

    // Determine risk level
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  // Helper methods

  private getIndicatorWeight(indicator: string): number {
    const weights = {
      'RSI': 0.25,
      'WaveTrend': 0.30,
      'PVT': 0.20,
      'Momentum': 0.15,
      'Trend': 0.20,
      'Volume': 0.15,
    };
    return weights[indicator] || 0.1;
  }

  private calculateVolumeTrend(candles: CandleData[]): number {
    if (candles.length < 2) return 0;
    
    const volumes = candles.map(c => c.volume);
    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    return (secondAvg - firstAvg) / firstAvg;
  }

  private calculateVolatilityStability(candles: CandleData[]): number {
    if (candles.length < 10) return 0.5;
    
    const returns = candles.slice(1).map((c, i) => Math.log(c.close / candles[i].close));
    const volatilities = [];
    
    for (let i = 5; i < returns.length - 5; i++) {
      const window = returns.slice(i - 5, i + 5);
      const mean = window.reduce((sum, r) => sum + r, 0) / window.length;
      const variance = window.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / window.length;
      volatilities.push(Math.sqrt(variance));
    }
    
    if (volatilities.length < 2) return 0.5;
    
    const avgVol = volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length;
    const volVariance = volatilities.reduce((sum, v) => sum + Math.pow(v - avgVol, 2), 0) / volatilities.length;
    
    return Math.max(0, 1 - volVariance / (avgVol * avgVol));
  }

  private calculateTimeDecayFactor(candles: CandleData[]): number {
    if (candles.length === 0) return 1;
    
    const latestTime = candles[candles.length - 1].timestamp;
    const currentTime = Date.now();
    const timeDiff = (currentTime - latestTime) / (1000 * 60); // Minutes
    
    // Decay confidence based on data age
    return Math.max(0.5, 1 - (timeDiff * this.config.decayRate / 60));
  }

  private calculateVolatilityAdjustment(volatility: number): number {
    // Optimal volatility around 0.2, adjust confidence accordingly
    const optimalVol = 0.2;
    const deviation = Math.abs(volatility - optimalVol);
    return Math.max(0.7, 1 - deviation * 2);
  }

  private async calculatePerformanceAdjustment(): Promise<number> {
    // Simplified performance adjustment - would track actual signal performance
    const recentPerformance = this.historicalPerformance.get('overall') || [0.6];
    const avgPerformance = recentPerformance.reduce((sum, p) => sum + p, 0) / recentPerformance.length;
    
    // Adjust confidence based on recent performance
    if (avgPerformance > 0.7) return 1.1;
    if (avgPerformance < 0.4) return 0.9;
    return 1.0;
  }

  /**
   * Update historical performance data
   */
  updatePerformance(category: string, performance: number): void {
    if (!this.historicalPerformance.has(category)) {
      this.historicalPerformance.set(category, []);
    }
    
    const performances = this.historicalPerformance.get(category)!;
    performances.push(performance);
    
    // Keep only recent performance data
    if (performances.length > 50) {
      performances.splice(0, performances.length - 50);
    }
  }

  /**
   * Get confidence statistics
   */
  getConfidenceStatistics(): {
    averageConfidence: number;
    confidenceStability: number;
    riskDistribution: Record<string, number>;
    factorImportance: Record<string, number>;
  } {
    // This would track confidence over time - simplified implementation
    return {
      averageConfidence: 0.65,
      confidenceStability: 0.8,
      riskDistribution: { low: 0.4, medium: 0.4, high: 0.2 },
      factorImportance: {
        technical: 0.25,
        patterns: 0.20,
        volume: 0.15,
        correlation: 0.15,
        timeframe: 0.10,
        market_regime: 0.10,
        volatility: 0.03,
        liquidity: 0.02,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConfidenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfidenceConfig {
    return { ...this.config };
  }
}