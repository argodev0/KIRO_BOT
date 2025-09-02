/**
 * Linear Regression Analyzer
 * Advanced linear regression analysis for trend probability calculation
 */

import { CandleData } from '../../types/market';

export interface LinearTrendLine {
  slope: number;
  intercept: number;
  correlation: number;
  startPrice: number;
  endPrice: number;
  direction: 'bullish' | 'bearish';
  strength: number;
  rSquared: number;
}

export interface TrendProbabilityAnalysis {
  continuationProbability: number;
  reversalProbability: number;
  breakoutProbability: number;
  confidence: number;
  timeHorizon: number;
}

export interface ConfidenceBand {
  upper: number;
  lower: number;
  confidence: number;
  timestamp: number;
}

export interface LinearRegressionConfig {
  period: number;
  confidenceInterval: number;
  trendProbabilityThreshold: number;
}

export interface RegressionStatistics {
  slope: number;
  intercept: number;
  correlation: number;
  rSquared: number;
  standardError: number;
  tStatistic: number;
  pValue: number;
  significance: 'high' | 'medium' | 'low';
}

export interface TrendChangePoint {
  timestamp: number;
  price: number;
  changeType: 'acceleration' | 'deceleration' | 'reversal';
  significance: number;
  confidence: number;
}

export class LinearRegressionAnalyzer {
  private config: LinearRegressionConfig;

  constructor(config: LinearRegressionConfig) {
    this.config = config;
  }

  /**
   * Calculate linear trend line using least squares regression
   */
  async calculateTrendLine(candles: CandleData[]): Promise<LinearTrendLine> {
    if (candles.length < this.config.period) {
      throw new Error(`Insufficient data for linear regression. Need at least ${this.config.period} candles`);
    }

    const recentCandles = candles.slice(-this.config.period);
    const regressionStats = this.calculateRegressionStatistics(recentCandles);
    
    const startPrice = regressionStats.intercept;
    const endPrice = regressionStats.slope * (recentCandles.length - 1) + regressionStats.intercept;
    
    const direction = regressionStats.slope > 0 ? 'bullish' : 'bearish';
    const strength = this.calculateTrendStrength(regressionStats);

    return {
      slope: regressionStats.slope,
      intercept: regressionStats.intercept,
      correlation: regressionStats.correlation,
      startPrice,
      endPrice,
      direction,
      strength,
      rSquared: regressionStats.rSquared,
    };
  }

  /**
   * Analyze trend probability for continuation, reversal, and breakout scenarios
   */
  async analyzeTrendProbability(
    candles: CandleData[],
    trendLine: LinearTrendLine
  ): Promise<TrendProbabilityAnalysis> {
    const recentCandles = candles.slice(-this.config.period);
    
    // Calculate continuation probability
    const continuationProbability = this.calculateContinuationProbability(trendLine, recentCandles);
    
    // Calculate reversal probability
    const reversalProbability = this.calculateReversalProbability(trendLine, recentCandles);
    
    // Calculate breakout probability
    const breakoutProbability = this.calculateBreakoutProbability(trendLine, recentCandles);
    
    // Calculate overall confidence
    const confidence = this.calculateProbabilityConfidence(trendLine, recentCandles);
    
    // Determine time horizon for predictions
    const timeHorizon = this.calculateTimeHorizon(trendLine, recentCandles);

    return {
      continuationProbability,
      reversalProbability,
      breakoutProbability,
      confidence,
      timeHorizon,
    };
  }

  /**
   * Calculate confidence bands around the trend line
   */
  async calculateConfidenceBands(
    candles: CandleData[],
    trendLine: LinearTrendLine
  ): Promise<ConfidenceBand[]> {
    const recentCandles = candles.slice(-this.config.period);
    const regressionStats = this.calculateRegressionStatistics(recentCandles);
    
    const confidenceBands: ConfidenceBand[] = [];
    const tValue = this.getTValue(this.config.confidenceInterval, recentCandles.length - 2);
    
    for (let i = 0; i < recentCandles.length; i++) {
      const candle = recentCandles[i];
      const predictedPrice = trendLine.slope * i + trendLine.intercept;
      
      // Calculate standard error for this point
      const standardError = this.calculatePointStandardError(i, recentCandles.length, regressionStats.standardError);
      
      // Calculate confidence interval
      const margin = tValue * standardError;
      
      confidenceBands.push({
        upper: predictedPrice + margin,
        lower: predictedPrice - margin,
        confidence: this.config.confidenceInterval,
        timestamp: candle.timestamp,
      });
    }

    return confidenceBands;
  }

  /**
   * Detect trend change points using regression analysis
   */
  async detectTrendChangePoints(candles: CandleData[]): Promise<TrendChangePoint[]> {
    const changePoints: TrendChangePoint[] = [];
    const windowSize = Math.floor(this.config.period / 2);
    
    for (let i = windowSize; i < candles.length - windowSize; i++) {
      const beforeWindow = candles.slice(i - windowSize, i);
      const afterWindow = candles.slice(i, i + windowSize);
      
      if (beforeWindow.length < 5 || afterWindow.length < 5) continue;
      
      const beforeStats = this.calculateRegressionStatistics(beforeWindow);
      const afterStats = this.calculateRegressionStatistics(afterWindow);
      
      const changePoint = this.analyzeChangePoint(
        beforeStats,
        afterStats,
        candles[i],
        i
      );
      
      if (changePoint) {
        changePoints.push(changePoint);
      }
    }

    return changePoints.sort((a, b) => b.significance - a.significance);
  }

  /**
   * Calculate regression channel with upper and lower bounds
   */
  async calculateRegressionChannel(
    candles: CandleData[],
    standardDeviations: number = 2
  ): Promise<{
    centerLine: LinearTrendLine;
    upperBound: number[];
    lowerBound: number[];
    channelWidth: number;
  }> {
    const centerLine = await this.calculateTrendLine(candles);
    const recentCandles = candles.slice(-this.config.period);
    
    // Calculate residuals
    const residuals = recentCandles.map((candle, i) => {
      const predicted = centerLine.slope * i + centerLine.intercept;
      return candle.close - predicted;
    });
    
    // Calculate standard deviation of residuals
    const residualStdDev = this.calculateStandardDeviation(residuals);
    const channelWidth = standardDeviations * residualStdDev;
    
    // Calculate bounds
    const upperBound = recentCandles.map((_, i) => {
      const predicted = centerLine.slope * i + centerLine.intercept;
      return predicted + channelWidth;
    });
    
    const lowerBound = recentCandles.map((_, i) => {
      const predicted = centerLine.slope * i + centerLine.intercept;
      return predicted - channelWidth;
    });

    return {
      centerLine,
      upperBound,
      lowerBound,
      channelWidth,
    };
  }

  /**
   * Perform multi-timeframe regression analysis
   */
  async performMultiTimeframeAnalysis(
    candlesByTimeframe: Record<string, CandleData[]>
  ): Promise<Record<string, {
    trendLine: LinearTrendLine;
    probability: TrendProbabilityAnalysis;
    consensus: number;
  }>> {
    const results: Record<string, any> = {};
    const trendDirections: string[] = [];
    
    for (const [timeframe, candles] of Object.entries(candlesByTimeframe)) {
      if (candles.length < this.config.period) continue;
      
      const trendLine = await this.calculateTrendLine(candles);
      const probability = await this.analyzeTrendProbability(candles, trendLine);
      
      results[timeframe] = {
        trendLine,
        probability,
        consensus: 0, // Will be calculated after all timeframes
      };
      
      trendDirections.push(trendLine.direction);
    }
    
    // Calculate consensus
    const consensus = this.calculateMultiTimeframeConsensus(trendDirections);
    
    // Update consensus scores
    for (const timeframe in results) {
      results[timeframe].consensus = consensus;
    }

    return results;
  }

  // Private methods

  private calculateRegressionStatistics(candles: CandleData[]): RegressionStatistics {
    const n = candles.length;
    const prices = candles.map(c => c.close);
    const x = Array.from({ length: n }, (_, i) => i);
    
    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = prices.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate sums for regression
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = prices[i] - yMean;
      
      sumXY += xDiff * yDiff;
      sumXX += xDiff * xDiff;
      sumYY += yDiff * yDiff;
    }
    
    // Calculate regression coefficients
    const slope = sumXY / sumXX;
    const intercept = yMean - slope * xMean;
    
    // Calculate correlation coefficient
    const correlation = sumXY / Math.sqrt(sumXX * sumYY);
    const rSquared = correlation * correlation;
    
    // Calculate standard error
    let sumSquaredResiduals = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * x[i] + intercept;
      const residual = prices[i] - predicted;
      sumSquaredResiduals += residual * residual;
    }
    
    const standardError = Math.sqrt(sumSquaredResiduals / (n - 2));
    
    // Calculate t-statistic for slope
    const slopeStandardError = standardError / Math.sqrt(sumXX);
    const tStatistic = slope / slopeStandardError;
    
    // Calculate p-value (simplified)
    const pValue = this.calculatePValue(tStatistic, n - 2);
    
    // Determine significance
    let significance: 'high' | 'medium' | 'low';
    if (pValue < 0.01) significance = 'high';
    else if (pValue < 0.05) significance = 'medium';
    else significance = 'low';

    return {
      slope,
      intercept,
      correlation,
      rSquared,
      standardError,
      tStatistic,
      pValue,
      significance,
    };
  }

  private calculateTrendStrength(stats: RegressionStatistics): number {
    let strength = 0;
    
    // R-squared contribution (max 0.4)
    strength += Math.min(stats.rSquared, 1.0) * 0.4;
    
    // Correlation contribution (max 0.3)
    strength += Math.abs(stats.correlation) * 0.3;
    
    // Statistical significance contribution (max 0.3)
    switch (stats.significance) {
      case 'high':
        strength += 0.3;
        break;
      case 'medium':
        strength += 0.2;
        break;
      case 'low':
        strength += 0.1;
        break;
    }

    return Math.min(strength, 1.0);
  }

  private calculateContinuationProbability(
    trendLine: LinearTrendLine,
    candles: CandleData[]
  ): number {
    let probability = 0.5; // Base probability
    
    // Strong trend line increases continuation probability
    probability += trendLine.strength * 0.3;
    
    // High R-squared increases continuation probability
    probability += trendLine.rSquared * 0.2;
    
    // Recent price action alignment
    const recentAlignment = this.calculateRecentAlignment(trendLine, candles);
    probability += recentAlignment * 0.3;
    
    return Math.min(probability, 1.0);
  }

  private calculateReversalProbability(
    trendLine: LinearTrendLine,
    candles: CandleData[]
  ): number {
    let probability = 0.2; // Base probability
    
    // Weak trend line increases reversal probability
    probability += (1 - trendLine.strength) * 0.2;
    
    // Recent divergence from trend line
    const recentDivergence = this.calculateRecentDivergence(trendLine, candles);
    probability += recentDivergence * 0.4;
    
    // Extreme trend angles increase reversal probability
    const angleExtremity = this.calculateAngleExtremity(trendLine);
    probability += angleExtremity * 0.2;
    
    return Math.min(probability, 1.0);
  }

  private calculateBreakoutProbability(
    trendLine: LinearTrendLine,
    candles: CandleData[]
  ): number {
    let probability = 0.3; // Base probability
    
    // Consolidation near trend line increases breakout probability
    const consolidation = this.calculateConsolidation(trendLine, candles);
    probability += consolidation * 0.3;
    
    // Volume patterns
    const volumePattern = this.analyzeVolumePattern(candles);
    probability += volumePattern * 0.2;
    
    return Math.min(probability, 1.0);
  }

  private calculateProbabilityConfidence(
    trendLine: LinearTrendLine,
    candles: CandleData[]
  ): number {
    let confidence = 0.5;
    
    // Statistical significance
    confidence += trendLine.strength * 0.3;
    
    // Data quality (number of points)
    const dataQuality = Math.min(candles.length / this.config.period, 1.0);
    confidence += dataQuality * 0.2;
    
    // Consistency of recent data
    const consistency = this.calculateDataConsistency(trendLine, candles);
    confidence += consistency * 0.3;
    
    return Math.min(confidence, 1.0);
  }

  private calculateTimeHorizon(trendLine: LinearTrendLine, candles: CandleData[]): number {
    // Base time horizon on trend strength and data period
    const baseHorizon = candles.length * (candles[1]?.timestamp - candles[0]?.timestamp || 3600000);
    const strengthMultiplier = 0.5 + trendLine.strength * 0.5;
    
    return baseHorizon * strengthMultiplier;
  }

  private getTValue(confidenceLevel: number, degreesOfFreedom: number): number {
    // Simplified t-value calculation (would use proper t-distribution in production)
    const alpha = 1 - confidenceLevel;
    
    if (degreesOfFreedom >= 30) {
      // Use normal approximation for large samples
      if (alpha <= 0.01) return 2.576;
      if (alpha <= 0.05) return 1.96;
      return 1.645;
    } else {
      // Simplified t-values for small samples
      if (alpha <= 0.01) return 3.0;
      if (alpha <= 0.05) return 2.5;
      return 2.0;
    }
  }

  private calculatePointStandardError(
    pointIndex: number,
    totalPoints: number,
    regressionStandardError: number
  ): number {
    const n = totalPoints;
    const xMean = (n - 1) / 2;
    const x = pointIndex;
    
    // Calculate sum of squared deviations from mean
    let sumXSquared = 0;
    for (let i = 0; i < n; i++) {
      sumXSquared += Math.pow(i - xMean, 2);
    }
    
    // Standard error for prediction at point x
    const factor = 1 + (1 / n) + Math.pow(x - xMean, 2) / sumXSquared;
    return regressionStandardError * Math.sqrt(factor);
  }

  private analyzeChangePoint(
    beforeStats: RegressionStatistics,
    afterStats: RegressionStatistics,
    candle: CandleData,
    index: number
  ): TrendChangePoint | null {
    const slopeDifference = Math.abs(afterStats.slope - beforeStats.slope);
    const avgSlope = (Math.abs(beforeStats.slope) + Math.abs(afterStats.slope)) / 2;
    
    if (avgSlope === 0) return null;
    
    const relativeChange = slopeDifference / avgSlope;
    
    if (relativeChange < 0.3) return null; // Not significant enough
    
    let changeType: 'acceleration' | 'deceleration' | 'reversal';
    
    if (Math.sign(beforeStats.slope) !== Math.sign(afterStats.slope)) {
      changeType = 'reversal';
    } else if (Math.abs(afterStats.slope) > Math.abs(beforeStats.slope)) {
      changeType = 'acceleration';
    } else {
      changeType = 'deceleration';
    }
    
    const significance = Math.min(relativeChange, 1.0);
    const confidence = Math.min((beforeStats.rSquared + afterStats.rSquared) / 2, 1.0);

    return {
      timestamp: candle.timestamp,
      price: candle.close,
      changeType,
      significance,
      confidence,
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateMultiTimeframeConsensus(directions: string[]): number {
    if (directions.length === 0) return 0;
    
    const bullishCount = directions.filter(d => d === 'bullish').length;
    const bearishCount = directions.filter(d => d === 'bearish').length;
    
    const maxCount = Math.max(bullishCount, bearishCount);
    return maxCount / directions.length;
  }

  private calculatePValue(tStatistic: number, degreesOfFreedom: number): number {
    // Simplified p-value calculation (would use proper t-distribution in production)
    const absT = Math.abs(tStatistic);
    
    if (absT > 3.0) return 0.001;
    if (absT > 2.5) return 0.01;
    if (absT > 2.0) return 0.05;
    if (absT > 1.5) return 0.1;
    return 0.2;
  }

  private calculateRecentAlignment(trendLine: LinearTrendLine, candles: CandleData[]): number {
    const recentCandles = candles.slice(-5); // Last 5 candles
    let alignedCandles = 0;
    
    for (let i = 0; i < recentCandles.length; i++) {
      const predicted = trendLine.slope * (candles.length - recentCandles.length + i) + trendLine.intercept;
      const actual = recentCandles[i].close;
      const error = Math.abs(actual - predicted) / predicted;
      
      if (error < 0.02) { // Within 2%
        alignedCandles++;
      }
    }
    
    return alignedCandles / recentCandles.length;
  }

  private calculateRecentDivergence(trendLine: LinearTrendLine, candles: CandleData[]): number {
    const recentCandles = candles.slice(-5);
    let totalDivergence = 0;
    
    for (let i = 0; i < recentCandles.length; i++) {
      const predicted = trendLine.slope * (candles.length - recentCandles.length + i) + trendLine.intercept;
      const actual = recentCandles[i].close;
      const divergence = Math.abs(actual - predicted) / predicted;
      totalDivergence += divergence;
    }
    
    return Math.min(totalDivergence / recentCandles.length, 1.0);
  }

  private calculateAngleExtremity(trendLine: LinearTrendLine): number {
    // Calculate angle in degrees
    const angle = Math.atan(trendLine.slope) * (180 / Math.PI);
    const absAngle = Math.abs(angle);
    
    // Extreme angles (>45 degrees) are more likely to reverse
    if (absAngle > 45) return Math.min((absAngle - 45) / 45, 1.0);
    return 0;
  }

  private calculateConsolidation(trendLine: LinearTrendLine, candles: CandleData[]): number {
    const recentCandles = candles.slice(-10);
    const priceRange = Math.max(...recentCandles.map(c => c.high)) - Math.min(...recentCandles.map(c => c.low));
    const avgPrice = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;
    
    const consolidationRatio = priceRange / avgPrice;
    
    // Lower ratio indicates more consolidation
    return Math.max(0, 1 - consolidationRatio * 10);
  }

  private analyzeVolumePattern(candles: CandleData[]): number {
    if (candles.length < 10) return 0.5;
    
    const recentVolume = candles.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5;
    const historicalVolume = candles.slice(-15, -5).reduce((sum, c) => sum + c.volume, 0) / 10;
    
    const volumeRatio = recentVolume / historicalVolume;
    
    // Higher recent volume suggests potential breakout
    return Math.min(volumeRatio / 2, 1.0);
  }

  private calculateDataConsistency(trendLine: LinearTrendLine, candles: CandleData[]): number {
    let consistentPoints = 0;
    const tolerance = 0.05; // 5% tolerance
    
    for (let i = 0; i < candles.length; i++) {
      const predicted = trendLine.slope * i + trendLine.intercept;
      const actual = candles[i].close;
      const error = Math.abs(actual - predicted) / predicted;
      
      if (error <= tolerance) {
        consistentPoints++;
      }
    }
    
    return consistentPoints / candles.length;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LinearRegressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): LinearRegressionConfig {
    return { ...this.config };
  }
}