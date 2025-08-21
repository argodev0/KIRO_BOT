/**
 * RSI (Relative Strength Index) Calculator
 * Calculates RSI with configurable periods and provides overbought/oversold signals
 */

import { CandleData } from '../../types/market';

export interface RSIConfig {
  period: number;
  overbought: number;
  oversold: number;
}

export interface RSIResult {
  value: number;
  signal: 'overbought' | 'oversold' | 'neutral';
  divergence?: 'bullish' | 'bearish' | null;
}

export class RSICalculator {
  private config: RSIConfig;

  constructor(config: RSIConfig) {
    this.config = config;
  }

  /**
   * Calculate RSI values for candle data
   */
  async calculate(candles: CandleData[]): Promise<number[]> {
    if (candles.length < this.config.period + 1) {
      throw new Error(`Insufficient data for RSI calculation. Need at least ${this.config.period + 1} candles`);
    }

    const rsiValues: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, this.config.period).reduce((sum, gain) => sum + gain, 0) / this.config.period;
    let avgLoss = losses.slice(0, this.config.period).reduce((sum, loss) => sum + loss, 0) / this.config.period;

    // Calculate first RSI value
    const rs1 = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi1 = 100 - (100 / (1 + rs1));
    rsiValues.push(rsi1);

    // Calculate subsequent RSI values using smoothed averages
    for (let i = this.config.period; i < gains.length; i++) {
      avgGain = ((avgGain * (this.config.period - 1)) + gains[i]) / this.config.period;
      avgLoss = ((avgLoss * (this.config.period - 1)) + losses[i]) / this.config.period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    }

    return rsiValues;
  }

  /**
   * Calculate RSI with detailed results including signals
   */
  async calculateDetailed(candles: CandleData[]): Promise<RSIResult[]> {
    const rsiValues = await this.calculate(candles);
    const results: RSIResult[] = [];

    for (let i = 0; i < rsiValues.length; i++) {
      const value = rsiValues[i];
      const signal = this.getSignal(value);
      const divergence = this.detectDivergence(candles, rsiValues, i);

      results.push({
        value,
        signal,
        divergence,
      });
    }

    return results;
  }

  /**
   * Get current RSI signal
   */
  getSignal(rsiValue: number): 'overbought' | 'oversold' | 'neutral' {
    if (rsiValue >= this.config.overbought) {
      return 'overbought';
    } else if (rsiValue <= this.config.oversold) {
      return 'oversold';
    }
    return 'neutral';
  }

  /**
   * Detect RSI divergence with price
   */
  private detectDivergence(
    candles: CandleData[],
    rsiValues: number[],
    currentIndex: number
  ): 'bullish' | 'bearish' | null {
    // Need at least 10 periods to detect divergence
    if (currentIndex < 10) return null;

    const lookback = Math.min(10, currentIndex);
    const startIndex = currentIndex - lookback;

    // Get price and RSI data for analysis
    const priceData = candles.slice(startIndex + this.config.period, currentIndex + this.config.period + 1);
    const rsiData = rsiValues.slice(startIndex, currentIndex + 1);

    if (priceData.length < 5 || rsiData.length < 5) return null;

    // Find local highs and lows
    const priceHighs = this.findLocalExtremes(priceData.map(c => c.high), 'high');
    const priceLows = this.findLocalExtremes(priceData.map(c => c.low), 'low');
    const rsiHighs = this.findLocalExtremes(rsiData, 'high');
    const rsiLows = this.findLocalExtremes(rsiData, 'low');

    // Check for bullish divergence (price makes lower low, RSI makes higher low)
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const recentPriceLow = priceLows[priceLows.length - 1];
      const previousPriceLow = priceLows[priceLows.length - 2];
      const recentRSILow = rsiLows[rsiLows.length - 1];
      const previousRSILow = rsiLows[rsiLows.length - 2];

      if (recentPriceLow.value < previousPriceLow.value && 
          recentRSILow.value > previousRSILow.value) {
        return 'bullish';
      }
    }

    // Check for bearish divergence (price makes higher high, RSI makes lower high)
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const recentPriceHigh = priceHighs[priceHighs.length - 1];
      const previousPriceHigh = priceHighs[priceHighs.length - 2];
      const recentRSIHigh = rsiHighs[rsiHighs.length - 1];
      const previousRSIHigh = rsiHighs[rsiHighs.length - 2];

      if (recentPriceHigh.value > previousPriceHigh.value && 
          recentRSIHigh.value < previousRSIHigh.value) {
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
   * Calculate RSI for a single period (used for real-time updates)
   */
  calculateSingle(
    _previousRSI: number,
    previousAvgGain: number,
    previousAvgLoss: number,
    currentGain: number,
    currentLoss: number
  ): { rsi: number; avgGain: number; avgLoss: number } {
    const avgGain = ((previousAvgGain * (this.config.period - 1)) + currentGain) / this.config.period;
    const avgLoss = ((previousAvgLoss * (this.config.period - 1)) + currentLoss) / this.config.period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return { rsi, avgGain, avgLoss };
  }

  /**
   * Get RSI interpretation
   */
  getInterpretation(rsiValue: number): {
    signal: string;
    strength: 'weak' | 'moderate' | 'strong';
    description: string;
  } {
    let signal: string;
    let strength: 'weak' | 'moderate' | 'strong';
    let description: string;

    if (rsiValue >= 80) {
      signal = 'Strong Sell';
      strength = 'strong';
      description = 'Extremely overbought conditions, strong reversal likely';
    } else if (rsiValue >= this.config.overbought) {
      signal = 'Sell';
      strength = 'moderate';
      description = 'Overbought conditions, consider taking profits';
    } else if (rsiValue >= 60) {
      signal = 'Weak Sell';
      strength = 'weak';
      description = 'Slightly overbought, monitor for reversal signals';
    } else if (rsiValue >= 40) {
      signal = 'Neutral';
      strength = 'weak';
      description = 'Neutral momentum, no clear directional bias';
    } else if (rsiValue >= this.config.oversold) {
      signal = 'Buy';
      strength = 'moderate';
      description = 'Oversold conditions, potential buying opportunity';
    } else if (rsiValue >= 20) {
      signal = 'Weak Buy';
      strength = 'weak';
      description = 'Slightly oversold, watch for bounce signals';
    } else {
      signal = 'Strong Buy';
      strength = 'strong';
      description = 'Extremely oversold conditions, strong bounce likely';
    }

    return { signal, strength, description };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RSIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RSIConfig {
    return { ...this.config };
  }
}