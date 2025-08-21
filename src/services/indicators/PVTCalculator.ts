/**
 * PVT (Price Volume Trend) Calculator
 * Calculates Price Volume Trend indicator which combines price and volume
 * PVT is similar to OBV but uses percentage price changes
 */

import { CandleData } from '../../types/market';

export interface PVTConfig {
  period: number; // Period for smoothing (optional)
}

export interface PVTResult {
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  trend: 'rising' | 'falling' | 'sideways';
  divergence?: 'bullish' | 'bearish' | null;
}

export class PVTCalculator {
  private config: PVTConfig;

  constructor(config: PVTConfig) {
    this.config = config;
  }

  /**
   * Calculate PVT values for candle data
   */
  async calculate(candles: CandleData[]): Promise<number[]> {
    if (candles.length < 2) {
      throw new Error('Insufficient data for PVT calculation. Need at least 2 candles');
    }

    const pvtValues: number[] = [];
    let cumulativePVT = 0;

    // First PVT value is 0
    pvtValues.push(cumulativePVT);

    // Calculate PVT for each subsequent candle
    for (let i = 1; i < candles.length; i++) {
      const currentCandle = candles[i];
      const previousCandle = candles[i - 1];

      // Calculate percentage price change
      const priceChange = (currentCandle.close - previousCandle.close) / previousCandle.close;

      // Calculate PVT increment
      const pvtIncrement = priceChange * currentCandle.volume;

      // Add to cumulative PVT
      cumulativePVT += pvtIncrement;
      pvtValues.push(cumulativePVT);
    }

    return pvtValues;
  }

  /**
   * Calculate PVT with detailed results including signals
   */
  async calculateDetailed(candles: CandleData[]): Promise<PVTResult[]> {
    const pvtValues = await this.calculate(candles);
    const results: PVTResult[] = [];

    // Calculate smoothed PVT if period is specified
    const smoothedPVT = this.config.period > 1 ? 
      this.calculateSMA(pvtValues, this.config.period) : pvtValues;

    for (let i = 0; i < pvtValues.length; i++) {
      const value = pvtValues[i];
      const smoothedValue = smoothedPVT[Math.min(i, smoothedPVT.length - 1)];
      
      const signal = this.getSignal(pvtValues, i);
      const trend = this.getTrend(pvtValues, i);
      const divergence = this.detectDivergence(candles, pvtValues, i);

      results.push({
        value: this.config.period > 1 ? smoothedValue : value,
        signal,
        trend,
        divergence,
      });
    }

    return results;
  }

  /**
   * Calculate single PVT value for real-time updates
   */
  calculateSingle(
    previousPVT: number,
    currentCandle: CandleData,
    previousCandle: CandleData
  ): number {
    const priceChange = (currentCandle.close - previousCandle.close) / previousCandle.close;
    const pvtIncrement = priceChange * currentCandle.volume;
    return previousPVT + pvtIncrement;
  }

  /**
   * Get PVT signal based on recent values
   */
  private getSignal(pvtValues: number[], currentIndex: number): 'bullish' | 'bearish' | 'neutral' {
    if (currentIndex < 5) return 'neutral';

    // const current = pvtValues[currentIndex];
    // const previous = pvtValues[currentIndex - 1];
    const lookback = Math.min(5, currentIndex);

    // Calculate recent trend
    let risingCount = 0;
    let fallingCount = 0;

    for (let i = currentIndex - lookback + 1; i <= currentIndex; i++) {
      if (pvtValues[i] > pvtValues[i - 1]) {
        risingCount++;
      } else if (pvtValues[i] < pvtValues[i - 1]) {
        fallingCount++;
      }
    }

    // Determine signal based on trend strength
    if (risingCount > fallingCount * 1.5) {
      return 'bullish';
    } else if (fallingCount > risingCount * 1.5) {
      return 'bearish';
    }

    return 'neutral';
  }

  /**
   * Get PVT trend direction
   */
  private getTrend(pvtValues: number[], currentIndex: number): 'rising' | 'falling' | 'sideways' {
    if (currentIndex < 3) return 'sideways';

    const current = pvtValues[currentIndex];
    const lookback = Math.min(10, currentIndex);
    const past = pvtValues[currentIndex - lookback];

    const change = (current - past) / Math.abs(past);

    if (change > 0.02) {
      return 'rising';
    } else if (change < -0.02) {
      return 'falling';
    }

    return 'sideways';
  }

  /**
   * Detect PVT divergence with price
   */
  private detectDivergence(
    candles: CandleData[],
    pvtValues: number[],
    currentIndex: number
  ): 'bullish' | 'bearish' | null {
    if (currentIndex < 10) return null;

    const lookback = Math.min(20, currentIndex);
    const startIndex = currentIndex - lookback;

    // Get price and PVT data for analysis
    const priceData = candles.slice(startIndex, currentIndex + 1);
    const pvtData = pvtValues.slice(startIndex, currentIndex + 1);

    if (priceData.length < 10 || pvtData.length < 10) return null;

    // Find local highs and lows
    const priceHighs = this.findLocalExtremes(priceData.map(c => c.high), 'high');
    const priceLows = this.findLocalExtremes(priceData.map(c => c.low), 'low');
    const pvtHighs = this.findLocalExtremes(pvtData, 'high');
    const pvtLows = this.findLocalExtremes(pvtData, 'low');

    // Check for bullish divergence (price makes lower low, PVT makes higher low)
    if (priceLows.length >= 2 && pvtLows.length >= 2) {
      const recentPriceLow = priceLows[priceLows.length - 1];
      const previousPriceLow = priceLows[priceLows.length - 2];
      const recentPVTLow = pvtLows[pvtLows.length - 1];
      const previousPVTLow = pvtLows[pvtLows.length - 2];

      // Check if the lows are reasonably close in time
      if (Math.abs(recentPriceLow.index - recentPVTLow.index) < 5 &&
          Math.abs(previousPriceLow.index - previousPVTLow.index) < 5) {
        if (recentPriceLow.value < previousPriceLow.value && 
            recentPVTLow.value > previousPVTLow.value) {
          return 'bullish';
        }
      }
    }

    // Check for bearish divergence (price makes higher high, PVT makes lower high)
    if (priceHighs.length >= 2 && pvtHighs.length >= 2) {
      const recentPriceHigh = priceHighs[priceHighs.length - 1];
      const previousPriceHigh = priceHighs[priceHighs.length - 2];
      const recentPVTHigh = pvtHighs[pvtHighs.length - 1];
      const previousPVTHigh = pvtHighs[pvtHighs.length - 2];

      // Check if the highs are reasonably close in time
      if (Math.abs(recentPriceHigh.index - recentPVTHigh.index) < 5 &&
          Math.abs(previousPriceHigh.index - previousPVTHigh.index) < 5) {
        if (recentPriceHigh.value > previousPriceHigh.value && 
            recentPVTHigh.value < previousPVTHigh.value) {
          return 'bearish';
        }
      }
    }

    return null;
  }

  /**
   * Get PVT interpretation
   */
  getInterpretation(
    currentPVT: number,
    previousPVT: number,
    trend: 'rising' | 'falling' | 'sideways'
  ): {
    signal: string;
    strength: 'weak' | 'moderate' | 'strong';
    description: string;
  } {
    const change = currentPVT - previousPVT;
    const changePercent = Math.abs(change) / Math.abs(previousPVT) * 100;

    let signal: string;
    let strength: 'weak' | 'moderate' | 'strong';
    let description: string;

    if (trend === 'rising') {
      if (changePercent > 5) {
        signal = 'Strong Buy';
        strength = 'strong';
        description = 'Strong volume-backed price momentum to the upside';
      } else if (changePercent > 2) {
        signal = 'Buy';
        strength = 'moderate';
        description = 'Moderate volume-backed upward momentum';
      } else {
        signal = 'Weak Buy';
        strength = 'weak';
        description = 'Slight upward momentum with volume support';
      }
    } else if (trend === 'falling') {
      if (changePercent > 5) {
        signal = 'Strong Sell';
        strength = 'strong';
        description = 'Strong volume-backed price momentum to the downside';
      } else if (changePercent > 2) {
        signal = 'Sell';
        strength = 'moderate';
        description = 'Moderate volume-backed downward momentum';
      } else {
        signal = 'Weak Sell';
        strength = 'weak';
        description = 'Slight downward momentum with volume support';
      }
    } else {
      signal = 'Neutral';
      strength = 'weak';
      description = 'No clear volume-backed directional momentum';
    }

    return { signal, strength, description };
  }

  /**
   * Calculate volume-weighted average price change
   */
  calculateVWAP(candles: CandleData[], period: number): number[] {
    if (candles.length < period) return [];

    const vwap: number[] = [];

    for (let i = period - 1; i < candles.length; i++) {
      let totalVolumePrice = 0;
      let totalVolume = 0;

      for (let j = i - period + 1; j <= i; j++) {
        const typicalPrice = (candles[j].high + candles[j].low + candles[j].close) / 3;
        totalVolumePrice += typicalPrice * candles[j].volume;
        totalVolume += candles[j].volume;
      }

      vwap.push(totalVolume > 0 ? totalVolumePrice / totalVolume : 0);
    }

    return vwap;
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(data: number[], period: number): number[] {
    if (data.length < period) return data;

    const sma: number[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j];
      }
      sma.push(sum / period);
    }

    return sma;
  }

  /**
   * Find local extremes (highs or lows) in data
   */
  private findLocalExtremes(
    data: number[],
    type: 'high' | 'low'
  ): Array<{ index: number; value: number }> {
    const extremes: Array<{ index: number; value: number }> = [];
    const minDistance = 3;

    for (let i = minDistance; i < data.length - minDistance; i++) {
      let isExtreme = true;

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
  updateConfig(newConfig: Partial<PVTConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PVTConfig {
    return { ...this.config };
  }
}