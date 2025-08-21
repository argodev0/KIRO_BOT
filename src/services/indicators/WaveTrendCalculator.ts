/**
 * Wave Trend Calculator
 * Calculates Wave Trend indicator with configurable parameters
 * Wave Trend is a momentum oscillator that helps identify trend changes
 */

import { CandleData } from '../../types/market';
import { WaveTrendData } from '../../types/analysis';

export interface WaveTrendConfig {
  n1: number; // Channel length
  n2: number; // Average length
}

export class WaveTrendCalculator {
  private config: WaveTrendConfig;

  constructor(config: WaveTrendConfig) {
    this.config = config;
  }

  /**
   * Calculate Wave Trend values for candle data
   */
  async calculate(candles: CandleData[]): Promise<WaveTrendData[]> {
    if (candles.length < Math.max(this.config.n1, this.config.n2) + 10) {
      throw new Error(`Insufficient data for Wave Trend calculation. Need at least ${Math.max(this.config.n1, this.config.n2) + 10} candles`);
    }

    const results: WaveTrendData[] = [];
    
    // Calculate typical price (HLC/3)
    const typicalPrices = candles.map(candle => (candle.high + candle.low + candle.close) / 3);
    
    // Calculate EMA of typical price
    const emaTypical = this.calculateEMA(typicalPrices, this.config.n1);
    
    // Calculate absolute difference between typical price and its EMA
    const absDiff = typicalPrices.map((price, i) => 
      i < emaTypical.length ? Math.abs(price - emaTypical[i]) : 0
    );
    
    // Calculate EMA of absolute difference
    const emaAbsDiff = this.calculateEMA(absDiff.slice(typicalPrices.length - emaTypical.length), this.config.n1);
    
    // Calculate CI (Commodity Index)
    const ci: number[] = [];
    for (let i = 0; i < emaTypical.length && i < emaAbsDiff.length; i++) {
      const typicalIndex = typicalPrices.length - emaTypical.length + i;
      if (emaAbsDiff[i] !== 0) {
        ci.push((typicalPrices[typicalIndex] - emaTypical[i]) / (0.015 * emaAbsDiff[i]));
      } else {
        ci.push(0);
      }
    }
    
    // Calculate Wave Trend 1 (EMA of CI)
    const wt1 = this.calculateEMA(ci, this.config.n2);
    
    // Calculate Wave Trend 2 (SMA of WT1)
    const wt2 = this.calculateSMA(wt1, 4);
    
    // Generate signals and results
    for (let i = 0; i < Math.min(wt1.length, wt2.length); i++) {
      const wt1Value = wt1[i];
      const wt2Value = wt2[i];
      
      // Determine signal
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      if (i > 0) {
        const prevWt1 = wt1[i - 1];
        const prevWt2 = wt2[i - 1];
        
        // Buy signal: WT1 crosses above WT2 from oversold area
        if (wt1Value > wt2Value && prevWt1 <= prevWt2 && wt1Value < -50) {
          signal = 'buy';
        }
        // Sell signal: WT1 crosses below WT2 from overbought area
        else if (wt1Value < wt2Value && prevWt1 >= prevWt2 && wt1Value > 50) {
          signal = 'sell';
        }
      }
      
      // Detect divergence
      const divergence = this.detectDivergence(candles, wt1, i);
      
      results.push({
        wt1: wt1Value,
        wt2: wt2Value,
        signal,
        divergence,
      });
    }

    return results;
  }

  /**
   * Calculate single Wave Trend value for real-time updates
   */
  async calculateSingle(
    candles: CandleData[],
    previousWT1: number,
    previousWT2: number
  ): Promise<WaveTrendData> {
    if (candles.length < Math.max(this.config.n1, this.config.n2) + 10) {
      return { wt1: previousWT1, wt2: previousWT2, signal: 'neutral' };
    }

    // Get recent results
    const results = await this.calculate(candles);
    return results[results.length - 1] || { wt1: previousWT1, wt2: previousWT2, signal: 'neutral' };
  }

  /**
   * Get Wave Trend interpretation
   */
  getInterpretation(wt1: number, wt2: number): {
    signal: string;
    strength: 'weak' | 'moderate' | 'strong';
    description: string;
    zone: 'overbought' | 'oversold' | 'neutral';
  } {
    let signal: string;
    let strength: 'weak' | 'moderate' | 'strong';
    let description: string;
    let zone: 'overbought' | 'oversold' | 'neutral';

    // Determine zone
    if (wt1 > 60) {
      zone = 'overbought';
    } else if (wt1 < -60) {
      zone = 'oversold';
    } else {
      zone = 'neutral';
    }

    // Determine signal based on WT1 and WT2 relationship
    const crossover = wt1 - wt2;
    
    if (crossover > 10 && zone === 'oversold') {
      signal = 'Strong Buy';
      strength = 'strong';
      description = 'Strong bullish momentum from oversold levels';
    } else if (crossover > 5 && wt1 < -20) {
      signal = 'Buy';
      strength = 'moderate';
      description = 'Bullish momentum building';
    } else if (crossover > 0) {
      signal = 'Weak Buy';
      strength = 'weak';
      description = 'Slight bullish bias';
    } else if (crossover < -10 && zone === 'overbought') {
      signal = 'Strong Sell';
      strength = 'strong';
      description = 'Strong bearish momentum from overbought levels';
    } else if (crossover < -5 && wt1 > 20) {
      signal = 'Sell';
      strength = 'moderate';
      description = 'Bearish momentum building';
    } else if (crossover < 0) {
      signal = 'Weak Sell';
      strength = 'weak';
      description = 'Slight bearish bias';
    } else {
      signal = 'Neutral';
      strength = 'weak';
      description = 'No clear directional bias';
    }

    return { signal, strength, description, zone };
  }

  /**
   * Detect Wave Trend divergence with price
   */
  private detectDivergence(
    candles: CandleData[],
    wt1Values: number[],
    currentIndex: number
  ): 'bullish' | 'bearish' | null {
    if (currentIndex < 10 || wt1Values.length < 10) return null;

    const lookback = Math.min(10, currentIndex);
    const startIndex = Math.max(0, currentIndex - lookback);

    // Get price and WT1 data for analysis
    const priceData = candles.slice(candles.length - wt1Values.length + startIndex, candles.length - wt1Values.length + currentIndex + 1);
    const wtData = wt1Values.slice(startIndex, currentIndex + 1);

    if (priceData.length < 5 || wtData.length < 5) return null;

    // Find local highs and lows
    const priceHighs = this.findLocalExtremes(priceData.map(c => c.high), 'high');
    const priceLows = this.findLocalExtremes(priceData.map(c => c.low), 'low');
    const wtHighs = this.findLocalExtremes(wtData, 'high');
    const wtLows = this.findLocalExtremes(wtData, 'low');

    // Check for bullish divergence (price makes lower low, WT1 makes higher low)
    if (priceLows.length >= 2 && wtLows.length >= 2) {
      const recentPriceLow = priceLows[priceLows.length - 1];
      const previousPriceLow = priceLows[priceLows.length - 2];
      const recentWTLow = wtLows[wtLows.length - 1];
      const previousWTLow = wtLows[wtLows.length - 2];

      if (recentPriceLow.value < previousPriceLow.value && 
          recentWTLow.value > previousWTLow.value) {
        return 'bullish';
      }
    }

    // Check for bearish divergence (price makes higher high, WT1 makes lower high)
    if (priceHighs.length >= 2 && wtHighs.length >= 2) {
      const recentPriceHigh = priceHighs[priceHighs.length - 1];
      const previousPriceHigh = priceHighs[priceHighs.length - 2];
      const recentWTHigh = wtHighs[wtHighs.length - 1];
      const previousWTHigh = wtHighs[wtHighs.length - 2];

      if (recentPriceHigh.value > previousPriceHigh.value && 
          recentWTHigh.value < previousWTHigh.value) {
        return 'bearish';
      }
    }

    return null;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(data: number[], period: number): number[] {
    if (data.length < period) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA value is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    ema.push(sum / period);

    // Calculate subsequent EMA values
    for (let i = period; i < data.length; i++) {
      const emaValue = (data[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
      ema.push(emaValue);
    }

    return ema;
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(data: number[], period: number): number[] {
    if (data.length < period) return [];

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
    const minDistance = 2;

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
  updateConfig(newConfig: Partial<WaveTrendConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): WaveTrendConfig {
    return { ...this.config };
  }
}