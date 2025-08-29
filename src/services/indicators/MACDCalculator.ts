/**
 * MACD (Moving Average Convergence Divergence) Calculator
 * Calculates MACD line, signal line, and histogram with configurable periods
 */

import { CandleData } from '../../types/market';

export interface MACDConfig {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover?: 'bullish' | 'bearish' | null;
  divergence?: 'bullish' | 'bearish' | null;
}

export class MACDCalculator {
  private config: MACDConfig;

  constructor(config: MACDConfig = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }) {
    this.config = config;
  }

  /**
   * Calculate MACD values for candle data
   */
  async calculate(candles: CandleData[]): Promise<MACDResult[]> {
    if (candles.length < this.config.slowPeriod + this.config.signalPeriod) {
      throw new Error(`Insufficient data for MACD calculation. Need at least ${this.config.slowPeriod + this.config.signalPeriod} candles`);
    }

    const closePrices = candles.map(candle => candle.close);
    
    // Calculate EMAs
    const fastEMA = this.calculateEMA(closePrices, this.config.fastPeriod);
    const slowEMA = this.calculateEMA(closePrices, this.config.slowPeriod);
    
    // Calculate MACD line (align both EMAs from slowPeriod-1 index)
    const macdLine: number[] = [];
    const startIndex = this.config.slowPeriod - 1;
    
    for (let i = 0; i < slowEMA.length; i++) {
      const fastIndex = i + (this.config.slowPeriod - this.config.fastPeriod);
      if (fastIndex >= 0 && fastIndex < fastEMA.length) {
        macdLine.push(fastEMA[fastIndex] - slowEMA[i]);
      }
    }
    
    // Calculate Signal line (EMA of MACD line)
    if (macdLine.length < this.config.signalPeriod) {
      return [];
    }
    
    const signalLine = this.calculateEMA(macdLine, this.config.signalPeriod);
    
    // Calculate Histogram and results
    const results: MACDResult[] = [];
    const signalStartIndex = this.config.signalPeriod - 1;
    
    for (let i = 0; i < signalLine.length; i++) {
      const macdIndex = i + signalStartIndex;
      if (macdIndex < macdLine.length) {
        const macd = macdLine[macdIndex];
        const signal = signalLine[i];
        const histogram = macd - signal;
        
        const crossover = this.detectCrossover(macdLine, signalLine, macdIndex, signalStartIndex);
        const divergence = this.detectDivergence(candles, macdLine, macdIndex + startIndex);
        
        results.push({
          macd,
          signal,
          histogram,
          crossover,
          divergence,
        });
      }
    }

    return results;
  }

  /**
   * Calculate single MACD value for real-time updates
   */
  calculateSingle(
    prices: number[],
    previousFastEMA: number,
    previousSlowEMA: number,
    previousSignalEMA: number
  ): {
    macd: number;
    signal: number;
    histogram: number;
    fastEMA: number;
    slowEMA: number;
    signalEMA: number;
  } {
    const currentPrice = prices[prices.length - 1];
    
    // Calculate new EMAs
    const fastMultiplier = 2 / (this.config.fastPeriod + 1);
    const slowMultiplier = 2 / (this.config.slowPeriod + 1);
    const signalMultiplier = 2 / (this.config.signalPeriod + 1);
    
    const fastEMA = (currentPrice - previousFastEMA) * fastMultiplier + previousFastEMA;
    const slowEMA = (currentPrice - previousSlowEMA) * slowMultiplier + previousSlowEMA;
    
    const macd = fastEMA - slowEMA;
    const signal = (macd - previousSignalEMA) * signalMultiplier + previousSignalEMA;
    const histogram = macd - signal;
    
    return {
      macd,
      signal,
      histogram,
      fastEMA,
      slowEMA,
      signalEMA: signal,
    };
  }

  /**
   * Get MACD interpretation
   */
  getInterpretation(macdResult: MACDResult): {
    signal: string;
    strength: 'weak' | 'moderate' | 'strong';
    description: string;
  } {
    const { macd, signal, histogram, crossover } = macdResult;
    
    let signalType: string;
    let strength: 'weak' | 'moderate' | 'strong';
    let description: string;
    
    if (crossover === 'bullish') {
      signalType = 'Strong Buy';
      strength = 'strong';
      description = 'MACD bullish crossover - momentum turning positive';
    } else if (crossover === 'bearish') {
      signalType = 'Strong Sell';
      strength = 'strong';
      description = 'MACD bearish crossover - momentum turning negative';
    } else if (macd > signal && histogram > 0) {
      if (histogram > Math.abs(macd) * 0.1) {
        signalType = 'Buy';
        strength = 'moderate';
        description = 'MACD above signal line with increasing momentum';
      } else {
        signalType = 'Weak Buy';
        strength = 'weak';
        description = 'MACD above signal line but momentum weakening';
      }
    } else if (macd < signal && histogram < 0) {
      if (Math.abs(histogram) > Math.abs(macd) * 0.1) {
        signalType = 'Sell';
        strength = 'moderate';
        description = 'MACD below signal line with increasing downward momentum';
      } else {
        signalType = 'Weak Sell';
        strength = 'weak';
        description = 'MACD below signal line but downward momentum weakening';
      }
    } else if (Math.abs(macd) < 0.1 && Math.abs(signal) < 0.1) {
      signalType = 'Neutral';
      strength = 'weak';
      description = 'MACD showing mixed signals, no clear direction';
    } else {
      signalType = 'Neutral';
      strength = 'weak';
      description = 'MACD showing mixed signals, no clear direction';
    }
    
    return { signal: signalType, strength, description };
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA value is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    ema.push(sum / period);
    
    // Calculate subsequent EMA values
    for (let i = period; i < prices.length; i++) {
      const emaValue = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(emaValue);
    }
    
    return ema;
  }

  /**
   * Detect MACD crossovers
   */
  private detectCrossover(
    macdLine: number[],
    signalLine: number[],
    currentIndex: number,
    signalStartIndex: number
  ): 'bullish' | 'bearish' | null {
    if (currentIndex < signalStartIndex + 1) return null;
    
    const currentMACD = macdLine[currentIndex];
    const currentSignal = signalLine[currentIndex - signalStartIndex];
    const previousMACD = macdLine[currentIndex - 1];
    const previousSignal = signalLine[currentIndex - signalStartIndex - 1];
    
    // Bullish crossover: MACD crosses above signal line
    if (previousMACD <= previousSignal && currentMACD > currentSignal) {
      return 'bullish';
    }
    
    // Bearish crossover: MACD crosses below signal line
    if (previousMACD >= previousSignal && currentMACD < currentSignal) {
      return 'bearish';
    }
    
    return null;
  }

  /**
   * Detect MACD divergence with price
   */
  private detectDivergence(
    candles: CandleData[],
    macdLine: number[],
    currentIndex: number
  ): 'bullish' | 'bearish' | null {
    // Need at least 10 periods to detect divergence
    if (currentIndex < 10 || macdLine.length < 10) return null;
    
    const lookback = Math.min(10, currentIndex);
    const startIndex = currentIndex - lookback;
    
    // Get price and MACD data for analysis
    const priceData = candles.slice(startIndex, currentIndex + 1);
    const macdData = macdLine.slice(Math.max(0, macdLine.length - lookback - 1));
    
    if (priceData.length < 5 || macdData.length < 5) return null;
    
    // Find local highs and lows
    const priceHighs = this.findLocalExtremes(priceData.map(c => c.high), 'high');
    const priceLows = this.findLocalExtremes(priceData.map(c => c.low), 'low');
    const macdHighs = this.findLocalExtremes(macdData, 'high');
    const macdLows = this.findLocalExtremes(macdData, 'low');
    
    // Check for bullish divergence (price makes lower low, MACD makes higher low)
    if (priceLows.length >= 2 && macdLows.length >= 2) {
      const recentPriceLow = priceLows[priceLows.length - 1];
      const previousPriceLow = priceLows[priceLows.length - 2];
      const recentMACDLow = macdLows[macdLows.length - 1];
      const previousMACDLow = macdLows[macdLows.length - 2];
      
      if (recentPriceLow.value < previousPriceLow.value && 
          recentMACDLow.value > previousMACDLow.value) {
        return 'bullish';
      }
    }
    
    // Check for bearish divergence (price makes higher high, MACD makes lower high)
    if (priceHighs.length >= 2 && macdHighs.length >= 2) {
      const recentPriceHigh = priceHighs[priceHighs.length - 1];
      const previousPriceHigh = priceHighs[priceHighs.length - 2];
      const recentMACDHigh = macdHighs[macdHighs.length - 1];
      const previousMACDHigh = macdHighs[macdHighs.length - 2];
      
      if (recentPriceHigh.value > previousPriceHigh.value && 
          recentMACDHigh.value < previousMACDHigh.value) {
        return 'bearish';
      }
    }
    
    return null;
  }

  /**
   * Find local extremes (highs or lows) in data
   */
  private findLocalExtremes(
    data: number[],
    type: 'high' | 'low'
  ): Array<{ index: number; value: number }> {
    const extremes: Array<{ index: number; value: number }> = [];
    const minDistance = 3; // Minimum distance between extremes
    
    for (let i = minDistance; i < data.length - minDistance; i++) {
      let isExtreme = true;
      
      // Check if current point is higher/lower than surrounding points
      for (let j = i - minDistance; j <= i + minDistance; j++) {
        if (j === i) continue;
        
        if (type === 'high' && data[i] <= data[j]) {
          isExtreme = false;
          break;
        } else if (type === 'low' && data[i] >= data[j]) {
          isExtreme = false;
          break;
        }
      }
      
      if (isExtreme) {
        extremes.push({ index: i, value: data[i] });
      }
    }
    
    return extremes;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MACDConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): MACDConfig {
    return { ...this.config };
  }
}