/**
 * Technical Indicator Scoring Matrix
 * Comprehensive scoring system for individual technical indicators with correlation analysis
 */

import { CandleData } from '../../types/market';
import { TechnicalIndicators, WaveTrendData } from '../../types/analysis';

export interface IndicatorScore {
  indicator: string;
  score: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number;
  reasoning: string[];
}

export interface IndicatorMatrix {
  timestamp: number;
  symbol: string;
  scores: IndicatorScore[];
  correlationMatrix: CorrelationMatrix;
  overallScore: number;
  dominantSignal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  divergences: Divergence[];
}

export interface CorrelationMatrix {
  pairs: CorrelationPair[];
  averageCorrelation: number;
  strongCorrelations: CorrelationPair[];
  weakCorrelations: CorrelationPair[];
}

export interface CorrelationPair {
  indicator1: string;
  indicator2: string;
  correlation: number;
  strength: 'weak' | 'moderate' | 'strong';
  agreement: boolean;
}

export interface Divergence {
  indicator: string;
  type: 'bullish' | 'bearish';
  strength: number;
  priceAction: 'higher_highs' | 'lower_lows' | 'higher_lows' | 'lower_highs';
  indicatorAction: 'rising' | 'falling' | 'flat';
}

export interface ScoringConfig {
  weights: {
    rsi: number;
    waveTrend: number;
    pvt: number;
    momentum: number;
    trend: number;
    volume: number;
  };
  thresholds: {
    rsi: { oversold: number; overbought: number; neutral: [number, number] };
    waveTrend: { strong: number; moderate: number };
    pvt: { bullish: number; bearish: number };
    correlation: { strong: number; moderate: number };
  };
  divergenceSettings: {
    lookbackPeriod: number;
    minDivergenceStrength: number;
    confirmationPeriod: number;
  };
}

export class TechnicalIndicatorScoringMatrix {
  private config: ScoringConfig;

  constructor(config?: Partial<ScoringConfig>) {
    this.config = {
      weights: {
        rsi: 0.20,
        waveTrend: 0.25,
        pvt: 0.15,
        momentum: 0.15,
        trend: 0.15,
        volume: 0.10,
      },
      thresholds: {
        rsi: { oversold: 30, overbought: 70, neutral: [40, 60] },
        waveTrend: { strong: 60, moderate: 40 },
        pvt: { bullish: 0.1, bearish: -0.1 },
        correlation: { strong: 0.7, moderate: 0.4 },
      },
      divergenceSettings: {
        lookbackPeriod: 20,
        minDivergenceStrength: 0.6,
        confirmationPeriod: 3,
      },
      ...config,
    };
  }

  /**
   * Calculate comprehensive indicator scoring matrix
   */
  async calculateScoringMatrix(
    candles: CandleData[],
    indicators: TechnicalIndicators,
    historicalIndicators: TechnicalIndicators[]
  ): Promise<IndicatorMatrix> {
    // Calculate individual indicator scores
    const scores = await this.calculateIndividualScores(candles, indicators, historicalIndicators);

    // Calculate correlation matrix
    const correlationMatrix = await this.calculateCorrelationMatrix(historicalIndicators);

    // Detect divergences
    const divergences = await this.detectDivergences(candles, historicalIndicators);

    // Calculate overall score and dominant signal
    const { overallScore, dominantSignal, confidence } = this.calculateOverallScore(scores, correlationMatrix);

    return {
      timestamp: Date.now(),
      symbol: candles[0]?.symbol || 'UNKNOWN',
      scores,
      correlationMatrix,
      overallScore,
      dominantSignal,
      confidence,
      divergences,
    };
  }

  /**
   * Calculate individual indicator scores
   */
  private async calculateIndividualScores(
    candles: CandleData[],
    current: TechnicalIndicators,
    historical: TechnicalIndicators[]
  ): Promise<IndicatorScore[]> {
    const scores: IndicatorScore[] = [];

    // RSI Score
    scores.push(await this.calculateRSIScore(current.rsi, historical));

    // Wave Trend Score
    scores.push(await this.calculateWaveTrendScore(current.waveTrend, historical));

    // PVT Score
    scores.push(await this.calculatePVTScore(current.pvt, historical));

    // Momentum Score
    scores.push(await this.calculateMomentumScore(current.momentum, historical));

    // Trend Score
    scores.push(await this.calculateTrendScore(current.trend, candles));

    // Volume Score
    scores.push(await this.calculateVolumeScore(candles));

    return scores;
  }

  /**
   * Calculate RSI score with adaptive thresholds
   */
  private async calculateRSIScore(
    currentRSI: number,
    historical: TechnicalIndicators[]
  ): Promise<IndicatorScore> {
    const reasoning: string[] = [];
    let score = 0;
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';

    // Adaptive thresholds based on recent RSI behavior
    const recentRSI = historical.slice(-20).map(h => h.rsi);
    const avgRSI = recentRSI.reduce((sum, rsi) => sum + rsi, 0) / recentRSI.length;
    const rsiVolatility = this.calculateStandardDeviation(recentRSI);

    // Adjust thresholds based on volatility
    const oversoldThreshold = Math.max(20, this.config.thresholds.rsi.oversold - rsiVolatility * 10);
    const overboughtThreshold = Math.min(80, this.config.thresholds.rsi.overbought + rsiVolatility * 10);

    // Calculate score based on RSI position
    if (currentRSI <= oversoldThreshold) {
      signal = 'bullish';
      score = 0.8 + (oversoldThreshold - currentRSI) / oversoldThreshold * 0.2;
      strength = currentRSI < 20 ? 'strong' : 'moderate';
      reasoning.push(`RSI oversold at ${currentRSI.toFixed(1)} (threshold: ${oversoldThreshold.toFixed(1)})`);
    } else if (currentRSI >= overboughtThreshold) {
      signal = 'bearish';
      score = 0.8 + (currentRSI - overboughtThreshold) / (100 - overboughtThreshold) * 0.2;
      strength = currentRSI > 80 ? 'strong' : 'moderate';
      reasoning.push(`RSI overbought at ${currentRSI.toFixed(1)} (threshold: ${overboughtThreshold.toFixed(1)})`);
    } else {
      // Neutral zone - check for momentum
      const rsiMomentum = this.calculateRSIMomentum(recentRSI);
      if (Math.abs(rsiMomentum) > 5) {
        signal = rsiMomentum > 0 ? 'bullish' : 'bearish';
        score = Math.min(0.6, Math.abs(rsiMomentum) / 10);
        strength = 'weak';
        reasoning.push(`RSI momentum: ${rsiMomentum > 0 ? 'rising' : 'falling'} (${rsiMomentum.toFixed(1)})`);
      } else {
        score = 0.3;
        reasoning.push(`RSI neutral at ${currentRSI.toFixed(1)}`);
      }
    }

    // Check for RSI divergence
    const divergence = this.checkRSIDivergence(historical);
    if (divergence) {
      score *= 1.2; // Boost score for divergence
      reasoning.push(`RSI ${divergence} divergence detected`);
    }

    return {
      indicator: 'RSI',
      score: Math.min(1, score),
      signal,
      strength,
      confidence: this.calculateConfidence(score, rsiVolatility),
      reasoning,
    };
  }

  /**
   * Calculate Wave Trend score
   */
  private async calculateWaveTrendScore(
    currentWT: WaveTrendData,
    historical: TechnicalIndicators[]
  ): Promise<IndicatorScore> {
    const reasoning: string[] = [];
    let score = 0;
    let signal: 'bullish' | 'bearish' | 'neutral' = currentWT.signal;
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';

    // Calculate Wave Trend momentum
    const wtDifference = Math.abs(currentWT.wt1 - currentWT.wt2);
    const wtPosition = (currentWT.wt1 + currentWT.wt2) / 2;

    // Score based on signal strength
    if (currentWT.signal === 'buy') {
      score = 0.7 + Math.min(0.3, wtDifference / 100);
      strength = wtDifference > this.config.thresholds.waveTrend.strong ? 'strong' : 
                wtDifference > this.config.thresholds.waveTrend.moderate ? 'moderate' : 'weak';
      reasoning.push(`Wave Trend buy signal (WT1: ${currentWT.wt1.toFixed(1)}, WT2: ${currentWT.wt2.toFixed(1)})`);
    } else if (currentWT.signal === 'sell') {
      score = 0.7 + Math.min(0.3, wtDifference / 100);
      strength = wtDifference > this.config.thresholds.waveTrend.strong ? 'strong' : 
                wtDifference > this.config.thresholds.waveTrend.moderate ? 'moderate' : 'weak';
      reasoning.push(`Wave Trend sell signal (WT1: ${currentWT.wt1.toFixed(1)}, WT2: ${currentWT.wt2.toFixed(1)})`);
    } else {
      // Neutral - check for potential signals
      if (wtDifference < 10) {
        score = 0.2;
        reasoning.push('Wave Trend lines converging - potential signal forming');
      } else {
        score = 0.4;
        reasoning.push(`Wave Trend neutral (difference: ${wtDifference.toFixed(1)})`);
      }
    }

    // Check for Wave Trend divergence
    if (currentWT.divergence) {
      score *= 1.3;
      signal = currentWT.divergence === 'bullish' ? 'bullish' : 'bearish';
      reasoning.push(`Wave Trend ${currentWT.divergence} divergence`);
    }

    // Extreme levels adjustment
    if (Math.abs(wtPosition) > 60) {
      const extremeBonus = (Math.abs(wtPosition) - 60) / 40 * 0.2;
      score += extremeBonus;
      reasoning.push(`Wave Trend at extreme level (${wtPosition.toFixed(1)})`);
    }

    return {
      indicator: 'WaveTrend',
      score: Math.min(1, score),
      signal,
      strength,
      confidence: this.calculateWTConfidence(currentWT, historical),
      reasoning,
    };
  }

  /**
   * Calculate PVT (Price Volume Trend) score
   */
  private async calculatePVTScore(
    currentPVT: number,
    historical: TechnicalIndicators[]
  ): Promise<IndicatorScore> {
    const reasoning: string[] = [];
    let score = 0;
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';

    // Calculate PVT momentum
    const recentPVT = historical.slice(-10).map(h => h.pvt);
    const pvtMomentum = this.calculateMomentum(recentPVT);
    const pvtTrend = this.calculateTrend(recentPVT);

    // Score based on PVT trend and momentum
    if (pvtTrend > this.config.thresholds.pvt.bullish) {
      signal = 'bullish';
      score = 0.6 + Math.min(0.4, pvtTrend / 0.5);
      strength = pvtTrend > 0.3 ? 'strong' : pvtTrend > 0.15 ? 'moderate' : 'weak';
      reasoning.push(`PVT trending up (trend: ${(pvtTrend * 100).toFixed(1)}%)`);
    } else if (pvtTrend < this.config.thresholds.pvt.bearish) {
      signal = 'bearish';
      score = 0.6 + Math.min(0.4, Math.abs(pvtTrend) / 0.5);
      strength = pvtTrend < -0.3 ? 'strong' : pvtTrend < -0.15 ? 'moderate' : 'weak';
      reasoning.push(`PVT trending down (trend: ${(pvtTrend * 100).toFixed(1)}%)`);
    } else {
      score = 0.3;
      reasoning.push(`PVT neutral (trend: ${(pvtTrend * 100).toFixed(1)}%)`);
    }

    // Momentum adjustment
    if (Math.abs(pvtMomentum) > 0.1) {
      const momentumBonus = Math.min(0.2, Math.abs(pvtMomentum) / 0.5);
      score += momentumBonus;
      reasoning.push(`Strong PVT momentum (${(pvtMomentum * 100).toFixed(1)}%)`);
    }

    return {
      indicator: 'PVT',
      score: Math.min(1, score),
      signal,
      strength,
      confidence: this.calculatePVTConfidence(recentPVT),
      reasoning,
    };
  }

  /**
   * Calculate momentum score
   */
  private async calculateMomentumScore(
    momentum: 'strong' | 'weak' | 'neutral',
    historical: TechnicalIndicators[]
  ): Promise<IndicatorScore> {
    const reasoning: string[] = [];
    let score = 0;
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let strength: 'weak' | 'moderate' | 'strong' = momentum;

    // Analyze momentum persistence
    const recentMomentum = historical.slice(-5).map(h => h.momentum);
    const momentumConsistency = this.calculateConsistency(recentMomentum);

    switch (momentum) {
      case 'strong':
        score = 0.8 + (momentumConsistency * 0.2);
        signal = 'bullish'; // Assuming strong momentum is bullish
        reasoning.push(`Strong momentum with ${(momentumConsistency * 100).toFixed(0)}% consistency`);
        break;
      case 'weak':
        score = 0.3;
        reasoning.push('Weak momentum - low conviction signals');
        break;
      case 'neutral':
        score = 0.5;
        reasoning.push('Neutral momentum - market indecision');
        break;
    }

    return {
      indicator: 'Momentum',
      score,
      signal,
      strength,
      confidence: momentumConsistency,
      reasoning,
    };
  }

  /**
   * Calculate trend score
   */
  private async calculateTrendScore(
    trend: 'bullish' | 'bearish' | 'sideways',
    candles: CandleData[]
  ): Promise<IndicatorScore> {
    const reasoning: string[] = [];
    let score = 0;
    let signal: 'bullish' | 'bearish' | 'neutral' = trend === 'sideways' ? 'neutral' : trend;
    let strength: 'weak' | 'moderate' | 'strong' = 'moderate';

    // Calculate trend strength based on price action
    const trendStrength = this.calculateTrendStrength(candles);
    const trendConsistency = this.calculateTrendConsistency(candles);

    switch (trend) {
      case 'bullish':
        score = 0.7 + (trendStrength * 0.3);
        strength = trendStrength > 0.7 ? 'strong' : trendStrength > 0.4 ? 'moderate' : 'weak';
        reasoning.push(`Bullish trend (strength: ${(trendStrength * 100).toFixed(0)}%)`);
        break;
      case 'bearish':
        score = 0.7 + (trendStrength * 0.3);
        strength = trendStrength > 0.7 ? 'strong' : trendStrength > 0.4 ? 'moderate' : 'weak';
        reasoning.push(`Bearish trend (strength: ${(trendStrength * 100).toFixed(0)}%)`);
        break;
      case 'sideways':
        score = 0.2;
        reasoning.push('Sideways trend - range-bound market');
        break;
    }

    // Consistency bonus
    score *= (0.7 + trendConsistency * 0.3);

    return {
      indicator: 'Trend',
      score: Math.min(1, score),
      signal,
      strength,
      confidence: trendConsistency,
      reasoning,
    };
  }

  /**
   * Calculate volume score
   */
  private async calculateVolumeScore(candles: CandleData[]): Promise<IndicatorScore> {
    const reasoning: string[] = [];
    let score = 0;
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';

    if (candles.length < 20) {
      return {
        indicator: 'Volume',
        score: 0.3,
        signal: 'neutral',
        strength: 'weak',
        confidence: 0.3,
        reasoning: ['Insufficient volume data'],
      };
    }

    const recentCandles = candles.slice(-10);
    const avgVolume = candles.slice(-20, -10).reduce((sum, c) => sum + c.volume, 0) / 10;
    const currentVolume = recentCandles[recentCandles.length - 1].volume;

    // Volume trend analysis
    const volumeTrend = this.calculateVolumeTrend(recentCandles);
    const volumeSpike = currentVolume / avgVolume;

    // Price-volume relationship
    const priceVolumeCorrelation = this.calculatePriceVolumeCorrelation(recentCandles);

    // Score based on volume characteristics
    if (volumeSpike > 1.5) {
      score = 0.6 + Math.min(0.4, (volumeSpike - 1.5) / 2);
      strength = volumeSpike > 2.5 ? 'strong' : volumeSpike > 2 ? 'moderate' : 'weak';
      
      // Determine signal based on price action
      const priceChange = (recentCandles[recentCandles.length - 1].close - recentCandles[0].close) / recentCandles[0].close;
      signal = priceChange > 0 ? 'bullish' : 'bearish';
      
      reasoning.push(`Volume spike: ${volumeSpike.toFixed(1)}x average`);
    } else if (volumeTrend > 0.1) {
      score = 0.5 + Math.min(0.3, volumeTrend / 0.3);
      signal = 'bullish';
      reasoning.push(`Increasing volume trend (${(volumeTrend * 100).toFixed(1)}%)`);
    } else if (volumeTrend < -0.1) {
      score = 0.4;
      signal = 'bearish';
      reasoning.push(`Decreasing volume trend (${(volumeTrend * 100).toFixed(1)}%)`);
    } else {
      score = 0.3;
      reasoning.push('Normal volume levels');
    }

    // Price-volume correlation adjustment
    if (Math.abs(priceVolumeCorrelation) > 0.5) {
      score *= (1 + Math.abs(priceVolumeCorrelation) * 0.2);
      reasoning.push(`Price-volume correlation: ${priceVolumeCorrelation.toFixed(2)}`);
    }

    return {
      indicator: 'Volume',
      score: Math.min(1, score),
      signal,
      strength,
      confidence: Math.min(1, volumeSpike / 3),
      reasoning,
    };
  }

  /**
   * Calculate correlation matrix between indicators
   */
  private async calculateCorrelationMatrix(historical: TechnicalIndicators[]): Promise<CorrelationMatrix> {
    if (historical.length < 10) {
      return {
        pairs: [],
        averageCorrelation: 0,
        strongCorrelations: [],
        weakCorrelations: [],
      };
    }

    const indicators = {
      rsi: historical.map(h => h.rsi),
      wt1: historical.map(h => h.waveTrend.wt1),
      wt2: historical.map(h => h.waveTrend.wt2),
      pvt: historical.map(h => h.pvt),
      volatility: historical.map(h => h.volatility),
    };

    const pairs: CorrelationPair[] = [];
    const indicatorNames = Object.keys(indicators);

    // Calculate correlations between all pairs
    for (let i = 0; i < indicatorNames.length; i++) {
      for (let j = i + 1; j < indicatorNames.length; j++) {
        const name1 = indicatorNames[i];
        const name2 = indicatorNames[j];
        const correlation = this.calculateCorrelation(indicators[name1], indicators[name2]);
        
        const pair: CorrelationPair = {
          indicator1: name1,
          indicator2: name2,
          correlation,
          strength: Math.abs(correlation) > this.config.thresholds.correlation.strong ? 'strong' :
                   Math.abs(correlation) > this.config.thresholds.correlation.moderate ? 'moderate' : 'weak',
          agreement: correlation > 0,
        };
        
        pairs.push(pair);
      }
    }

    const averageCorrelation = pairs.reduce((sum, p) => sum + Math.abs(p.correlation), 0) / pairs.length;
    const strongCorrelations = pairs.filter(p => p.strength === 'strong');
    const weakCorrelations = pairs.filter(p => p.strength === 'weak');

    return {
      pairs,
      averageCorrelation,
      strongCorrelations,
      weakCorrelations,
    };
  }

  /**
   * Detect divergences between price and indicators
   */
  private async detectDivergences(
    candles: CandleData[],
    historical: TechnicalIndicators[]
  ): Promise<Divergence[]> {
    const divergences: Divergence[] = [];
    const lookback = this.config.divergenceSettings.lookbackPeriod;

    if (candles.length < lookback || historical.length < lookback) {
      return divergences;
    }

    const recentCandles = candles.slice(-lookback);
    const recentIndicators = historical.slice(-lookback);

    // Check RSI divergence
    const rsiDivergence = this.checkIndicatorDivergence(
      recentCandles.map(c => c.close),
      recentIndicators.map(h => h.rsi),
      'RSI'
    );
    if (rsiDivergence) divergences.push(rsiDivergence);

    // Check Wave Trend divergence
    const wtDivergence = this.checkIndicatorDivergence(
      recentCandles.map(c => c.close),
      recentIndicators.map(h => h.waveTrend.wt1),
      'WaveTrend'
    );
    if (wtDivergence) divergences.push(wtDivergence);

    // Check PVT divergence
    const pvtDivergence = this.checkIndicatorDivergence(
      recentCandles.map(c => c.close),
      recentIndicators.map(h => h.pvt),
      'PVT'
    );
    if (pvtDivergence) divergences.push(pvtDivergence);

    return divergences.filter(d => d.strength >= this.config.divergenceSettings.minDivergenceStrength);
  }

  /**
   * Calculate overall score and dominant signal
   */
  private calculateOverallScore(
    scores: IndicatorScore[],
    correlationMatrix: CorrelationMatrix
  ): { overallScore: number; dominantSignal: 'bullish' | 'bearish' | 'neutral'; confidence: number } {
    let weightedScore = 0;
    let bullishWeight = 0;
    let bearishWeight = 0;
    let totalWeight = 0;

    // Calculate weighted scores
    for (const score of scores) {
      const weight = this.config.weights[score.indicator.toLowerCase()] || 0.1;
      weightedScore += score.score * weight;
      totalWeight += weight;

      if (score.signal === 'bullish') {
        bullishWeight += score.score * weight;
      } else if (score.signal === 'bearish') {
        bearishWeight += score.score * weight;
      }
    }

    const overallScore = weightedScore / totalWeight;
    
    // Determine dominant signal
    let dominantSignal: 'bullish' | 'bearish' | 'neutral';
    if (bullishWeight > bearishWeight * 1.2) {
      dominantSignal = 'bullish';
    } else if (bearishWeight > bullishWeight * 1.2) {
      dominantSignal = 'bearish';
    } else {
      dominantSignal = 'neutral';
    }

    // Calculate confidence based on correlation and agreement
    const agreementRatio = correlationMatrix.strongCorrelations.length / Math.max(1, correlationMatrix.pairs.length);
    const confidence = Math.min(1, overallScore * (0.7 + agreementRatio * 0.3));

    return { overallScore, dominantSignal, confidence };
  }

  // Helper methods for calculations

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateRSIMomentum(rsiValues: number[]): number {
    if (rsiValues.length < 3) return 0;
    const recent = rsiValues.slice(-3);
    return (recent[2] - recent[0]) / 2;
  }

  private checkRSIDivergence(historical: TechnicalIndicators[]): 'bullish' | 'bearish' | null {
    // Simplified divergence check - would need more sophisticated implementation
    if (historical.length < 10) return null;
    
    const recent = historical.slice(-5);
    const rsiTrend = (recent[4].rsi - recent[0].rsi) / 5;
    
    // This is a simplified check - real implementation would compare price highs/lows with RSI highs/lows
    if (Math.abs(rsiTrend) > 5) {
      return rsiTrend > 0 ? 'bullish' : 'bearish';
    }
    
    return null;
  }

  private calculateConfidence(score: number, volatility: number): number {
    return Math.min(1, score * (1 - volatility / 100));
  }

  private calculateWTConfidence(current: WaveTrendData, historical: TechnicalIndicators[]): number {
    const wtDifference = Math.abs(current.wt1 - current.wt2);
    const baseConfidence = Math.min(1, wtDifference / 100);
    
    // Boost confidence if signal is consistent
    if (historical.length >= 3) {
      const recentSignals = historical.slice(-3).map(h => h.waveTrend.signal);
      const consistency = recentSignals.filter(s => s === current.signal).length / 3;
      return baseConfidence * (0.7 + consistency * 0.3);
    }
    
    return baseConfidence;
  }

  private calculatePVTConfidence(pvtValues: number[]): number {
    if (pvtValues.length < 5) return 0.5;
    
    const trend = this.calculateTrend(pvtValues);
    return Math.min(1, Math.abs(trend) * 2);
  }

  private calculateMomentum(values: number[]): number {
    if (values.length < 2) return 0;
    return (values[values.length - 1] - values[0]) / values.length;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateConsistency(values: string[]): number {
    if (values.length === 0) return 0;
    
    const counts = values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const maxCount = Math.max(...Object.values(counts));
    return maxCount / values.length;
  }

  private calculateTrendStrength(candles: CandleData[]): number {
    if (candles.length < 10) return 0;
    
    const prices = candles.map(c => c.close);
    const trend = this.calculateTrend(prices);
    const volatility = this.calculateStandardDeviation(prices.slice(1).map((p, i) => Math.log(p / prices[i])));
    
    return Math.min(1, Math.abs(trend) / volatility);
  }

  private calculateTrendConsistency(candles: CandleData[]): number {
    if (candles.length < 5) return 0;
    
    let consistentMoves = 0;
    const totalMoves = candles.length - 1;
    
    for (let i = 1; i < candles.length; i++) {
      const currentMove = candles[i].close > candles[i - 1].close;
      const overallTrend = candles[candles.length - 1].close > candles[0].close;
      
      if (currentMove === overallTrend) {
        consistentMoves++;
      }
    }
    
    return consistentMoves / totalMoves;
  }

  private calculateVolumeTrend(candles: CandleData[]): number {
    const volumes = candles.map(c => c.volume);
    return this.calculateTrend(volumes);
  }

  private calculatePriceVolumeCorrelation(candles: CandleData[]): number {
    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    return this.calculateCorrelation(prices, volumes);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private checkIndicatorDivergence(
    prices: number[],
    indicatorValues: number[],
    indicatorName: string
  ): Divergence | null {
    if (prices.length < 10 || indicatorValues.length < 10) return null;
    
    // Find recent highs and lows
    const priceHigh = Math.max(...prices.slice(-5));
    const priceLow = Math.min(...prices.slice(-5));
    const indicatorHigh = Math.max(...indicatorValues.slice(-5));
    const indicatorLow = Math.min(...indicatorValues.slice(-5));
    
    const priceHighIndex = prices.lastIndexOf(priceHigh);
    const priceLowIndex = prices.lastIndexOf(priceLow);
    const indicatorHighIndex = indicatorValues.lastIndexOf(indicatorHigh);
    const indicatorLowIndex = indicatorValues.lastIndexOf(indicatorLow);
    
    // Check for bullish divergence (price makes lower low, indicator makes higher low)
    if (priceLowIndex > priceHighIndex && indicatorLowIndex < indicatorHighIndex) {
      const strength = Math.abs(indicatorHighIndex - indicatorLowIndex) / prices.length;
      if (strength >= this.config.divergenceSettings.minDivergenceStrength) {
        return {
          indicator: indicatorName,
          type: 'bullish',
          strength,
          priceAction: 'lower_lows',
          indicatorAction: 'rising',
        };
      }
    }
    
    // Check for bearish divergence (price makes higher high, indicator makes lower high)
    if (priceHighIndex > priceLowIndex && indicatorHighIndex < indicatorLowIndex) {
      const strength = Math.abs(indicatorHighIndex - indicatorLowIndex) / prices.length;
      if (strength >= this.config.divergenceSettings.minDivergenceStrength) {
        return {
          indicator: indicatorName,
          type: 'bearish',
          strength,
          priceAction: 'higher_highs',
          indicatorAction: 'falling',
        };
      }
    }
    
    return null;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }
}