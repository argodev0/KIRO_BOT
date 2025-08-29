/**
 * Bollinger Bands Calculator
 * Calculates Bollinger Bands with configurable period and standard deviation multiplier
 */

import { CandleData } from '../../types/market';

export interface BollingerBandsConfig {
  period: number;
  standardDeviations: number;
}

export interface BollingerBandsResult {
  upperBand: number;
  middleBand: number; // Simple Moving Average
  lowerBand: number;
  bandwidth: number;
  percentB: number;
  squeeze?: boolean;
  breakout?: 'upper' | 'lower' | null;
}

export class BollingerBandsCalculator {
  private config: BollingerBandsConfig;

  constructor(config: BollingerBandsConfig = { period: 20, standardDeviations: 2 }) {
    this.config = config;
  }

  /**
   * Calculate Bollinger Bands for candle data
   */
  async calculate(candles: CandleData[]): Promise<BollingerBandsResult[]> {
    if (candles.length < this.config.period) {
      throw new Error(`Insufficient data for Bollinger Bands calculation. Need at least ${this.config.period} candles`);
    }

    const closePrices = candles.map(candle => candle.close);
    const results: BollingerBandsResult[] = [];

    for (let i = this.config.period - 1; i < closePrices.length; i++) {
      const periodPrices = closePrices.slice(i - this.config.period + 1, i + 1);
      
      // Calculate Simple Moving Average (Middle Band)
      const sma = periodPrices.reduce((sum, price) => sum + price, 0) / this.config.period;
      
      // Calculate Standard Deviation
      const variance = periodPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / this.config.period;
      const standardDeviation = Math.sqrt(variance);
      
      // Calculate Bollinger Bands
      const upperBand = sma + (this.config.standardDeviations * standardDeviation);
      const lowerBand = sma - (this.config.standardDeviations * standardDeviation);
      
      // Calculate %B (Percent B)
      const currentPrice = closePrices[i];
      const percentB = (currentPrice - lowerBand) / (upperBand - lowerBand);
      
      // Calculate Bandwidth
      const bandwidth = (upperBand - lowerBand) / sma;
      
      // Detect squeeze and breakouts
      const squeeze = this.detectSqueeze(results, bandwidth);
      const breakout = this.detectBreakout(currentPrice, upperBand, lowerBand, results);
      
      results.push({
        upperBand,
        middleBand: sma,
        lowerBand,
        bandwidth,
        percentB,
        squeeze,
        breakout,
      });
    }

    return results;
  }

  /**
   * Calculate single Bollinger Bands value for real-time updates
   */
  calculateSingle(prices: number[]): BollingerBandsResult {
    if (prices.length < this.config.period) {
      throw new Error(`Insufficient data for Bollinger Bands calculation. Need at least ${this.config.period} prices`);
    }

    const periodPrices = prices.slice(-this.config.period);
    
    // Calculate Simple Moving Average (Middle Band)
    const sma = periodPrices.reduce((sum, price) => sum + price, 0) / this.config.period;
    
    // Calculate Standard Deviation
    const variance = periodPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / this.config.period;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate Bollinger Bands
    const upperBand = sma + (this.config.standardDeviations * standardDeviation);
    const lowerBand = sma - (this.config.standardDeviations * standardDeviation);
    
    // Calculate %B (Percent B)
    const currentPrice = prices[prices.length - 1];
    const percentB = (currentPrice - lowerBand) / (upperBand - lowerBand);
    
    // Calculate Bandwidth
    const bandwidth = (upperBand - lowerBand) / sma;
    
    return {
      upperBand,
      middleBand: sma,
      lowerBand,
      bandwidth,
      percentB,
      squeeze: false, // Would need historical data to determine
      breakout: null, // Would need historical data to determine
    };
  }

  /**
   * Get Bollinger Bands interpretation
   */
  getInterpretation(bbResult: BollingerBandsResult): {
    signal: string;
    strength: 'weak' | 'moderate' | 'strong';
    description: string;
  } {
    const { percentB, bandwidth, squeeze, breakout } = bbResult;
    
    let signal: string;
    let strength: 'weak' | 'moderate' | 'strong';
    let description: string;
    
    if (breakout === 'upper') {
      signal = 'Strong Buy';
      strength = 'strong';
      description = 'Price breaking above upper Bollinger Band - strong upward momentum';
    } else if (breakout === 'lower') {
      signal = 'Strong Sell';
      strength = 'strong';
      description = 'Price breaking below lower Bollinger Band - strong downward momentum';
    } else if (squeeze) {
      signal = 'Neutral';
      strength = 'moderate';
      description = 'Bollinger Band squeeze detected - expect volatility expansion';
    } else if (percentB >= 0.8) {
      signal = 'Sell';
      strength = 'moderate';
      description = 'Price near upper band - potential overbought condition';
    } else if (percentB <= 0.2) {
      signal = 'Buy';
      strength = 'moderate';
      description = 'Price near lower band - potential oversold condition';
    } else if (percentB > 0.5 && bandwidth > 0.1) {
      signal = 'Weak Buy';
      strength = 'weak';
      description = 'Price above middle band with normal volatility';
    } else if (percentB < 0.5 && bandwidth > 0.1) {
      signal = 'Weak Sell';
      strength = 'weak';
      description = 'Price below middle band with normal volatility';
    } else {
      signal = 'Neutral';
      strength = 'weak';
      description = 'Price consolidating around middle band';
    }
    
    return { signal, strength, description };
  }

  /**
   * Detect Bollinger Band squeeze
   */
  private detectSqueeze(previousResults: BollingerBandsResult[], currentBandwidth: number): boolean {
    if (previousResults.length < 20) return false;
    
    // Get average bandwidth over last 20 periods
    const recentBandwidths = previousResults.slice(-20).map(r => r.bandwidth);
    const avgBandwidth = recentBandwidths.reduce((sum, bw) => sum + bw, 0) / recentBandwidths.length;
    
    // Squeeze detected if current bandwidth is significantly below average
    return currentBandwidth < avgBandwidth * 0.7;
  }

  /**
   * Detect Bollinger Band breakouts
   */
  private detectBreakout(
    currentPrice: number,
    upperBand: number,
    lowerBand: number,
    previousResults: BollingerBandsResult[]
  ): 'upper' | 'lower' | null {
    if (previousResults.length === 0) return null;
    
    const previousResult = previousResults[previousResults.length - 1];
    
    // Check for breakout above upper band
    if (currentPrice > upperBand && previousResult.percentB <= 1.0) {
      return 'upper';
    }
    
    // Check for breakout below lower band
    if (currentPrice < lowerBand && previousResult.percentB >= 0.0) {
      return 'lower';
    }
    
    return null;
  }

  /**
   * Calculate Bollinger Band Width
   */
  calculateBandWidth(upperBand: number, lowerBand: number, middleBand: number): number {
    return (upperBand - lowerBand) / middleBand;
  }

  /**
   * Calculate %B (Percent B)
   */
  calculatePercentB(price: number, upperBand: number, lowerBand: number): number {
    return (price - lowerBand) / (upperBand - lowerBand);
  }

  /**
   * Detect mean reversion opportunities
   */
  detectMeanReversion(results: BollingerBandsResult[]): {
    signal: 'buy' | 'sell' | 'neutral';
    confidence: number;
    reasoning: string;
  } {
    if (results.length < 3) {
      return { signal: 'neutral', confidence: 0, reasoning: 'Insufficient data' };
    }
    
    const latest = results[results.length - 1];
    const previous = results[results.length - 2];
    
    // Strong mean reversion signal when price touches bands and starts reversing
    if (latest.percentB <= 0.05 && previous.percentB <= 0.1) {
      return {
        signal: 'buy',
        confidence: 0.8,
        reasoning: 'Price touching lower band - mean reversion opportunity'
      };
    }
    
    if (latest.percentB >= 0.95 && previous.percentB >= 0.9) {
      return {
        signal: 'sell',
        confidence: 0.8,
        reasoning: 'Price touching upper band - mean reversion opportunity'
      };
    }
    
    // Moderate mean reversion when price is in extreme zones
    if (latest.percentB <= 0.2) {
      return {
        signal: 'buy',
        confidence: 0.6,
        reasoning: 'Price in lower 20% of bands - potential bounce'
      };
    }
    
    if (latest.percentB >= 0.8) {
      return {
        signal: 'sell',
        confidence: 0.6,
        reasoning: 'Price in upper 20% of bands - potential pullback'
      };
    }
    
    return { signal: 'neutral', confidence: 0.3, reasoning: 'Price in normal range' };
  }

  /**
   * Analyze volatility expansion/contraction
   */
  analyzeVolatility(results: BollingerBandsResult[]): {
    trend: 'expanding' | 'contracting' | 'stable';
    rate: number;
    significance: 'low' | 'moderate' | 'high';
  } {
    if (results.length < 10) {
      return { trend: 'stable', rate: 0, significance: 'low' };
    }
    
    const recent = results.slice(-5).map(r => r.bandwidth);
    const older = results.slice(-10, -5).map(r => r.bandwidth);
    
    const recentAvg = recent.reduce((sum, bw) => sum + bw, 0) / recent.length;
    const olderAvg = older.reduce((sum, bw) => sum + bw, 0) / older.length;
    
    const rate = (recentAvg - olderAvg) / olderAvg;
    
    let trend: 'expanding' | 'contracting' | 'stable';
    let significance: 'low' | 'moderate' | 'high';
    
    if (Math.abs(rate) < 0.05) {
      trend = 'stable';
      significance = 'low';
    } else if (rate > 0.05) {
      trend = 'expanding';
      significance = rate > 0.2 ? 'high' : rate > 0.1 ? 'moderate' : 'low';
    } else {
      trend = 'contracting';
      significance = rate < -0.2 ? 'high' : rate < -0.1 ? 'moderate' : 'low';
    }
    
    return { trend, rate, significance };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BollingerBandsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): BollingerBandsConfig {
    return { ...this.config };
  }
}