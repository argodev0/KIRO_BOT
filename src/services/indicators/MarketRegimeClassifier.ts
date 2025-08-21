/**
 * Market Regime Classifier
 * Classifies market conditions as trending, ranging, breakout, or reversal
 */

import { CandleData } from '../../types/market';
import { MarketRegime } from '../../types/analysis';

export interface RegimeConfig {
  trendThreshold: number;
  volatilityPeriod: number;
  volumePeriod: number;
  adxPeriod: number;
  lookbackPeriod: number;
}

export class MarketRegimeClassifier {
  private config: RegimeConfig;

  constructor(config?: Partial<RegimeConfig>) {
    this.config = {
      trendThreshold: 25, // ADX threshold for trending market
      volatilityPeriod: 20,
      volumePeriod: 20,
      adxPeriod: 14,
      lookbackPeriod: 50,
      ...config,
    };
  }

  /**
   * Classify market regime
   */
  async classify(candles: CandleData[]): Promise<MarketRegime> {
    if (candles.length < this.config.lookbackPeriod) {
      throw new Error(`Insufficient data for regime classification. Need at least ${this.config.lookbackPeriod} candles`);
    }

    // Calculate various metrics
    const adx = this.calculateADX(candles);
    const volatility = this.calculateVolatility(candles);
    const volumeProfile = this.analyzeVolume(candles);
    const priceAction = this.analyzePriceAction(candles);
    const trendStrength = this.calculateTrendStrength(candles);

    // Get latest values
    const currentADX = adx[adx.length - 1] || 0;
    const currentVolatility = volatility[volatility.length - 1] || 0;

    // Classify regime based on multiple factors
    const regime = this.determineRegime(
      currentADX,
      currentVolatility,
      volumeProfile,
      priceAction,
      trendStrength
    );

    return {
      type: regime.type,
      strength: regime.strength,
      duration: this.calculateRegimeDuration(candles, regime.type),
      volatility: this.classifyVolatility(currentVolatility),
      volume: volumeProfile.classification,
      confidence: regime.confidence,
    };
  }

  /**
   * Calculate ADX (Average Directional Index)
   */
  private calculateADX(candles: CandleData[]): number[] {
    if (candles.length < this.config.adxPeriod + 1) return [];

    const trueRanges: number[] = [];
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];

    // Calculate True Range and Directional Movements
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      // True Range
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );
      trueRanges.push(tr);

      // Directional Movements
      const plusDM = current.high - previous.high > previous.low - current.low ? 
                     Math.max(current.high - previous.high, 0) : 0;
      const minusDM = previous.low - current.low > current.high - previous.high ? 
                      Math.max(previous.low - current.low, 0) : 0;

      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    // Calculate smoothed values
    const smoothedTR = this.calculateSmoothedAverage(trueRanges, this.config.adxPeriod);
    const smoothedPlusDM = this.calculateSmoothedAverage(plusDMs, this.config.adxPeriod);
    const smoothedMinusDM = this.calculateSmoothedAverage(minusDMs, this.config.adxPeriod);

    // Calculate DI+ and DI-
    const plusDI = smoothedPlusDM.map((dm, i) => 
      smoothedTR[i] !== 0 ? (dm / smoothedTR[i]) * 100 : 0
    );
    const minusDI = smoothedMinusDM.map((dm, i) => 
      smoothedTR[i] !== 0 ? (dm / smoothedTR[i]) * 100 : 0
    );

    // Calculate DX
    const dx = plusDI.map((pdi, i) => {
      const mdi = minusDI[i];
      const sum = pdi + mdi;
      return sum !== 0 ? Math.abs(pdi - mdi) / sum * 100 : 0;
    });

    // Calculate ADX (smoothed DX)
    return this.calculateSmoothedAverage(dx, this.config.adxPeriod);
  }

  /**
   * Calculate volatility using ATR
   */
  private calculateVolatility(candles: CandleData[]): number[] {
    if (candles.length < this.config.volatilityPeriod + 1) return [];

    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );
      trueRanges.push(tr);
    }

    // Calculate ATR (Average True Range)
    const atr: number[] = [];
    for (let i = this.config.volatilityPeriod - 1; i < trueRanges.length; i++) {
      const sum = trueRanges.slice(i - this.config.volatilityPeriod + 1, i + 1)
        .reduce((acc, tr) => acc + tr, 0);
      atr.push(sum / this.config.volatilityPeriod);
    }

    return atr;
  }

  /**
   * Analyze volume characteristics
   */
  private analyzeVolume(candles: CandleData[]): {
    trend: 'increasing' | 'decreasing' | 'stable';
    classification: 'low' | 'medium' | 'high';
    strength: number;
  } {
    const recentCandles = candles.slice(-this.config.volumePeriod);
    const volumes = recentCandles.map(c => c.volume);
    
    // Calculate volume trend
    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    const volumeChange = (secondAvg - firstAvg) / firstAvg;
    
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (volumeChange > 0.1) trend = 'increasing';
    else if (volumeChange < -0.1) trend = 'decreasing';
    else trend = 'stable';

    // Calculate volume classification
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const recentVolume = volumes[volumes.length - 1];
    
    let classification: 'low' | 'medium' | 'high';
    if (recentVolume > avgVolume * 1.5) classification = 'high';
    else if (recentVolume < avgVolume * 0.7) classification = 'low';
    else classification = 'medium';

    const strength = Math.min(1, Math.abs(volumeChange));

    return { trend, classification, strength };
  }

  /**
   * Analyze price action patterns
   */
  private analyzePriceAction(candles: CandleData[]): {
    pattern: 'consolidation' | 'breakout' | 'trending' | 'reversal';
    strength: number;
  } {
    const recentCandles = candles.slice(-20);
    
    // Calculate price range
    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const priceRange = maxHigh - minLow;
    
    // Calculate average candle body size
    const bodySizes = recentCandles.map(c => Math.abs(c.close - c.open));
    const avgBodySize = bodySizes.reduce((sum, size) => sum + size, 0) / bodySizes.length;
    
    // Analyze recent price movement
    const priceChange = (recentCandles[recentCandles.length - 1].close - recentCandles[0].close) / recentCandles[0].close;
    
    let pattern: 'consolidation' | 'breakout' | 'trending' | 'reversal';
    let strength = 0;

    if (Math.abs(priceChange) < 0.02 && avgBodySize < priceRange * 0.1) {
      pattern = 'consolidation';
      strength = 0.3;
    } else if (Math.abs(priceChange) > 0.05 && avgBodySize > priceRange * 0.2) {
      pattern = 'breakout';
      strength = 0.8;
    } else if (Math.abs(priceChange) > 0.03) {
      pattern = 'trending';
      strength = 0.6;
    } else {
      pattern = 'reversal';
      strength = 0.4;
    }

    return { pattern, strength };
  }

  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(candles: CandleData[]): number {
    const recentCandles = candles.slice(-this.config.lookbackPeriod);
    
    // Calculate linear regression slope
    const closes = recentCandles.map(c => c.close);
    const n = closes.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = closes.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * closes[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgPrice = sumY / n;
    
    // Normalize slope relative to price
    return Math.abs(slope) / avgPrice * 100;
  }

  /**
   * Determine market regime based on all factors
   */
  private determineRegime(
    adx: number,
    volatility: number,
    volumeProfile: any,
    priceAction: any,
    trendStrength: number
  ): { type: 'trending' | 'ranging' | 'breakout' | 'reversal'; strength: number; confidence: number } {
    let type: 'trending' | 'ranging' | 'breakout' | 'reversal';
    let strength = 0;
    let confidence = 0;

    // Primary classification based on ADX and trend strength
    if (adx > this.config.trendThreshold && trendStrength > 2) {
      type = 'trending';
      strength = Math.min(1, (adx - this.config.trendThreshold) / 50 + trendStrength / 10);
      confidence = 0.8;
    } else if (priceAction.pattern === 'breakout' && volumeProfile.classification === 'high') {
      type = 'breakout';
      strength = priceAction.strength;
      confidence = 0.7;
    } else if (priceAction.pattern === 'reversal' || (adx < 20 && volatility > 0.02)) {
      type = 'reversal';
      strength = Math.min(1, volatility * 50);
      confidence = 0.6;
    } else {
      type = 'ranging';
      strength = Math.max(0, 1 - trendStrength / 5);
      confidence = 0.5;
    }

    // Adjust confidence based on volume
    if (volumeProfile.classification === 'high') {
      confidence += 0.1;
    } else if (volumeProfile.classification === 'low') {
      confidence -= 0.1;
    }

    return {
      type,
      strength: Math.max(0, Math.min(1, strength)),
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  }

  /**
   * Calculate how long the current regime has been in place
   */
  private calculateRegimeDuration(
    candles: CandleData[],
    _currentRegime: 'trending' | 'ranging' | 'breakout' | 'reversal'
  ): number {
    // Simplified duration calculation
    // In a real implementation, you'd track regime changes over time
    const recentCandles = candles.slice(-20);
    return recentCandles.length; // Return number of periods
  }

  /**
   * Classify volatility level
   */
  private classifyVolatility(volatility: number): 'low' | 'medium' | 'high' {
    if (volatility > 0.03) return 'high';
    if (volatility > 0.015) return 'medium';
    return 'low';
  }

  /**
   * Calculate smoothed average (Wilder's smoothing)
   */
  private calculateSmoothedAverage(data: number[], period: number): number[] {
    if (data.length < period) return [];

    const smoothed: number[] = [];
    
    // First value is simple average
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    smoothed.push(sum / period);

    // Subsequent values use Wilder's smoothing
    for (let i = period; i < data.length; i++) {
      const newValue = (smoothed[smoothed.length - 1] * (period - 1) + data[i]) / period;
      smoothed.push(newValue);
    }

    return smoothed;
  }

  /**
   * Get regime interpretation
   */
  getInterpretation(regime: MarketRegime): {
    description: string;
    tradingAdvice: string;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    let description: string;
    let tradingAdvice: string;
    let riskLevel: 'low' | 'medium' | 'high';

    switch (regime.type) {
      case 'trending':
        description = `Strong ${regime.strength > 0.7 ? 'trending' : 'moderate trending'} market with clear directional bias`;
        tradingAdvice = 'Follow the trend, use trend-following strategies, avoid counter-trend trades';
        riskLevel = regime.strength > 0.7 ? 'low' : 'medium';
        break;

      case 'ranging':
        description = `Sideways market with price oscillating between support and resistance levels`;
        tradingAdvice = 'Use range-bound strategies, buy support, sell resistance, avoid breakout trades';
        riskLevel = 'medium';
        break;

      case 'breakout':
        description = `Breakout conditions with potential for significant price movement`;
        tradingAdvice = 'Look for breakout opportunities, use momentum strategies, manage risk carefully';
        riskLevel = 'high';
        break;

      case 'reversal':
        description = `Potential reversal conditions with changing market dynamics`;
        tradingAdvice = 'Exercise caution, wait for confirmation, consider contrarian strategies';
        riskLevel = 'high';
        break;

      default:
        description = 'Uncertain market conditions';
        tradingAdvice = 'Exercise caution and wait for clearer signals';
        riskLevel = 'high';
    }

    return { description, tradingAdvice, riskLevel };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RegimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RegimeConfig {
    return { ...this.config };
  }
}