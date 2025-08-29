export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicatorResult {
  timestamp: number;
  value: number | null;
}

export interface RSIResult extends TechnicalIndicatorResult {
  value: number | null; // 0-100
}

export interface MACDResult extends TechnicalIndicatorResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface BollingerBandsResult extends TechnicalIndicatorResult {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export interface MovingAverageResult extends TechnicalIndicatorResult {
  value: number | null;
}

export class TechnicalIndicators {
  /**
   * Calculate RSI (Relative Strength Index)
   */
  static calculateRSI(candles: CandleData[], period: number = 14): RSIResult[] {
    if (candles.length < period + 1) {
      return candles.map(candle => ({
        timestamp: candle.timestamp,
        value: null
      }));
    }

    const results: RSIResult[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate initial gains and losses
    for (let i = 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate RSI for each point
    for (let i = 0; i < candles.length; i++) {
      if (i < period) {
        results.push({
          timestamp: candles[i].timestamp,
          value: null
        });
        continue;
      }

      const periodGains = gains.slice(i - period, i);
      const periodLosses = losses.slice(i - period, i);

      const avgGain = periodGains.reduce((sum, gain) => sum + gain, 0) / period;
      const avgLoss = periodLosses.reduce((sum, loss) => sum + loss, 0) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      results.push({
        timestamp: candles[i].timestamp,
        value: rsi
      });
    }

    return results;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  static calculateMACD(
    candles: CandleData[], 
    fastPeriod: number = 12, 
    slowPeriod: number = 26, 
    signalPeriod: number = 9
  ): MACDResult[] {
    if (candles.length < slowPeriod) {
      return candles.map(candle => ({
        timestamp: candle.timestamp,
        macd: null,
        signal: null,
        histogram: null
      }));
    }

    const fastEMA = this.calculateEMA(candles.map(c => c.close), fastPeriod);
    const slowEMA = this.calculateEMA(candles.map(c => c.close), slowPeriod);
    
    const macdLine: number[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (fastEMA[i] !== null && slowEMA[i] !== null) {
        macdLine.push(fastEMA[i]! - slowEMA[i]!);
      } else {
        macdLine.push(0);
      }
    }

    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    
    const results: MACDResult[] = [];
    for (let i = 0; i < candles.length; i++) {
      const macd = i >= slowPeriod - 1 ? macdLine[i] : null;
      const signal = signalLine[i];
      const histogram = macd !== null && signal !== null ? macd - signal : null;

      results.push({
        timestamp: candles[i].timestamp,
        macd,
        signal,
        histogram
      });
    }

    return results;
  }

  /**
   * Calculate Bollinger Bands
   */
  static calculateBollingerBands(
    candles: CandleData[], 
    period: number = 20, 
    standardDeviations: number = 2
  ): BollingerBandsResult[] {
    if (candles.length < period) {
      return candles.map(candle => ({
        timestamp: candle.timestamp,
        upper: null,
        middle: null,
        lower: null
      }));
    }

    const results: BollingerBandsResult[] = [];
    const closes = candles.map(c => c.close);

    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        results.push({
          timestamp: candles[i].timestamp,
          upper: null,
          middle: null,
          lower: null
        });
        continue;
      }

      const periodCloses = closes.slice(i - period + 1, i + 1);
      const sma = periodCloses.reduce((sum, close) => sum + close, 0) / period;
      
      const variance = periodCloses.reduce((sum, close) => {
        return sum + Math.pow(close - sma, 2);
      }, 0) / period;
      
      const stdDev = Math.sqrt(variance);
      
      results.push({
        timestamp: candles[i].timestamp,
        upper: sma + (standardDeviations * stdDev),
        middle: sma,
        lower: sma - (standardDeviations * stdDev)
      });
    }

    return results;
  }

  /**
   * Calculate Simple Moving Average (SMA)
   */
  static calculateSMA(candles: CandleData[], period: number): MovingAverageResult[] {
    const results: MovingAverageResult[] = [];
    const closes = candles.map(c => c.close);

    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        results.push({
          timestamp: candles[i].timestamp,
          value: null
        });
        continue;
      }

      const periodCloses = closes.slice(i - period + 1, i + 1);
      const sma = periodCloses.reduce((sum, close) => sum + close, 0) / period;

      results.push({
        timestamp: candles[i].timestamp,
        value: sma
      });
    }

    return results;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   */
  static calculateEMAResults(candles: CandleData[], period: number): MovingAverageResult[] {
    const closes = candles.map(c => c.close);
    const emaValues = this.calculateEMA(closes, period);

    return candles.map((candle, i) => ({
      timestamp: candle.timestamp,
      value: emaValues[i]
    }));
  }

  /**
   * Helper method to calculate EMA from array of values
   */
  private static calculateEMA(values: number[], period: number): (number | null)[] {
    if (values.length < period) {
      return values.map(() => null);
    }

    const results: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    
    // Calculate initial SMA for first EMA value
    let sma = 0;
    for (let i = 0; i < period; i++) {
      sma += values[i];
      results.push(null);
    }
    sma /= period;
    results[period - 1] = sma;

    // Calculate EMA for remaining values
    for (let i = period; i < values.length; i++) {
      const ema = (values[i] * multiplier) + (results[i - 1]! * (1 - multiplier));
      results.push(ema);
    }

    return results;
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   */
  static calculateVWAP(candles: CandleData[]): MovingAverageResult[] {
    const results: MovingAverageResult[] = [];
    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const tpv = typicalPrice * candle.volume;
      
      cumulativeTPV += tpv;
      cumulativeVolume += candle.volume;
      
      const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null;
      
      results.push({
        timestamp: candle.timestamp,
        value: vwap
      });
    }

    return results;
  }

  /**
   * Calculate all indicators for a given set of candles
   */
  static calculateAllIndicators(candles: CandleData[]) {
    return {
      rsi: this.calculateRSI(candles, 14),
      macd: this.calculateMACD(candles, 12, 26, 9),
      bollingerBands: this.calculateBollingerBands(candles, 20, 2),
      sma20: this.calculateSMA(candles, 20),
      sma50: this.calculateSMA(candles, 50),
      ema20: this.calculateEMAResults(candles, 20),
      ema50: this.calculateEMAResults(candles, 50),
      vwap: this.calculateVWAP(candles)
    };
  }

  /**
   * Get the latest indicator values
   */
  static getLatestIndicatorValues(candles: CandleData[]) {
    if (candles.length === 0) return null;

    const indicators = this.calculateAllIndicators(candles);
    const lastIndex = candles.length - 1;

    return {
      rsi: indicators.rsi[lastIndex]?.value,
      macd: {
        macd: indicators.macd[lastIndex]?.macd,
        signal: indicators.macd[lastIndex]?.signal,
        histogram: indicators.macd[lastIndex]?.histogram
      },
      bollingerBands: {
        upper: indicators.bollingerBands[lastIndex]?.upper,
        middle: indicators.bollingerBands[lastIndex]?.middle,
        lower: indicators.bollingerBands[lastIndex]?.lower
      },
      sma20: indicators.sma20[lastIndex]?.value,
      sma50: indicators.sma50[lastIndex]?.value,
      ema20: indicators.ema20[lastIndex]?.value,
      ema50: indicators.ema50[lastIndex]?.value,
      vwap: indicators.vwap[lastIndex]?.value
    };
  }
}

export default TechnicalIndicators;