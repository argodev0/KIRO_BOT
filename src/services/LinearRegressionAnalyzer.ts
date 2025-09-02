import { LinearRegressionAnalysis, VolatilityMetrics } from '../types/quickTrade';

export class LinearRegressionAnalyzer {
  private historicalData: number[][] = [];
  private maxHistoryLength: number = 1000;

  constructor() {}

  async analyzeRegression(priceData: number[], timeframe: number = 20): Promise<LinearRegressionAnalysis> {
    try {
      if (priceData.length < timeframe) {
        return this.getDefaultAnalysis();
      }

      // Use the most recent data points for analysis
      const recentData = priceData.slice(-timeframe);
      const x = Array.from({length: recentData.length}, (_, i) => i);
      const y = recentData;

      // Calculate linear regression
      const regression = this.calculateLinearRegression(x, y);
      
      // Calculate trend strength and directional bias
      const trendStrength = this.calculateTrendStrength(regression.rSquared, regression.slope);
      const directionalBias = this.determineDirectionalBias(regression.slope, trendStrength);
      const trendProbability = this.calculateTrendProbability(regression.rSquared, trendStrength);

      // Calculate support and resistance levels
      const supportResistance = this.calculateSupportResistance(recentData, regression);

      return {
        slope: regression.slope,
        intercept: regression.intercept,
        rSquared: regression.rSquared,
        trendStrength,
        directionalBias,
        trendProbability,
        supportLevel: supportResistance.support,
        resistanceLevel: supportResistance.resistance
      };
    } catch (error) {
      console.error('Linear regression analysis failed:', error);
      return this.getDefaultAnalysis();
    }
  }

  private calculateLinearRegression(x: number[], y: number[]): {
    slope: number;
    intercept: number;
    rSquared: number;
  } {
    const n = x.length;
    if (n < 2) {
      return { slope: 0, intercept: 0, rSquared: 0 };
    }

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const denominator = n * sumXX - sumX * sumX;
    if (Math.abs(denominator) < 1e-10) {
      return { slope: 0, intercept: sumY / n, rSquared: 0 };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = y.reduce((sum, val, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);

    const rSquared = ssTotal > 0 ? Math.max(0, Math.min(1, 1 - (ssResidual / ssTotal))) : 0;

    return { 
      slope: isFinite(slope) ? slope : 0, 
      intercept: isFinite(intercept) ? intercept : 0, 
      rSquared: isFinite(rSquared) ? rSquared : 0 
    };
  }

  private calculateTrendStrength(rSquared: number, slope: number): number {
    // Combine R-squared and slope magnitude to determine trend strength
    const slopeStrength = Math.min(1, Math.abs(slope) * 1000); // Normalize slope
    const combinedStrength = (rSquared * 0.7) + (slopeStrength * 0.3);
    
    return Math.max(0, Math.min(1, combinedStrength));
  }

  private determineDirectionalBias(slope: number, trendStrength: number): 'bullish' | 'bearish' | 'neutral' {
    const threshold = 0.3;
    
    if (trendStrength < threshold) {
      return 'neutral';
    }
    
    return slope > 0 ? 'bullish' : 'bearish';
  }

  private calculateTrendProbability(rSquared: number, trendStrength: number): number {
    // Calculate probability that the trend will continue
    const baseProb = 0.5;
    const rSquaredBonus = rSquared * 0.3;
    const strengthBonus = trendStrength * 0.2;
    
    return Math.max(0, Math.min(1, baseProb + rSquaredBonus + strengthBonus));
  }

  private calculateSupportResistance(data: number[], regression: {slope: number; intercept: number}): {
    support: number;
    resistance: number;
  } {
    if (data.length === 0) {
      return { support: 0, resistance: 0 };
    }
    
    const currentPrice = data[data.length - 1];
    const trendLine = regression.slope * (data.length - 1) + regression.intercept;
    
    // Calculate standard deviation of residuals
    const residuals = data.map((price, i) => price - (regression.slope * i + regression.intercept));
    const stdDev = this.calculateStandardDeviation(residuals);
    
    // Support and resistance based on trend line +/- standard deviation
    const support = Math.max(0, Math.min(currentPrice, trendLine - stdDev));
    const resistance = Math.max(currentPrice, trendLine + stdDev);
    
    return { support, resistance };
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  async analyzeMultiTimeframe(priceData: number[]): Promise<{
    short: LinearRegressionAnalysis;
    medium: LinearRegressionAnalysis;
    long: LinearRegressionAnalysis;
    consensus: 'bullish' | 'bearish' | 'neutral';
  }> {
    try {
      const [shortTerm, mediumTerm, longTerm] = await Promise.all([
        this.analyzeRegression(priceData, 10),
        this.analyzeRegression(priceData, 20),
        this.analyzeRegression(priceData, 50)
      ]);

      const consensus = this.determineConsensus([shortTerm, mediumTerm, longTerm]);

      return {
        short: shortTerm,
        medium: mediumTerm,
        long: longTerm,
        consensus
      };
    } catch (error) {
      console.error('Multi-timeframe analysis failed:', error);
      const defaultAnalysis = this.getDefaultAnalysis();
      return {
        short: defaultAnalysis,
        medium: defaultAnalysis,
        long: defaultAnalysis,
        consensus: 'neutral'
      };
    }
  }

  private determineConsensus(analyses: LinearRegressionAnalysis[]): 'bullish' | 'bearish' | 'neutral' {
    const bullishCount = analyses.filter(a => a.directionalBias === 'bullish').length;
    const bearishCount = analyses.filter(a => a.directionalBias === 'bearish').length;
    
    if (bullishCount > bearishCount) {
      return 'bullish';
    } else if (bearishCount > bullishCount) {
      return 'bearish';
    } else {
      return 'neutral';
    }
  }

  calculateVolatilityMetrics(priceData: number[]): VolatilityMetrics {
    try {
      if (priceData.length < 20) {
        return this.getDefaultVolatilityMetrics();
      }

      const returns = this.calculateReturns(priceData);
      const currentVolatility = this.calculateVolatility(returns.slice(-10));
      const historicalVolatility = this.calculateVolatility(returns);
      const volatilityRatio = historicalVolatility > 0 ? currentVolatility / historicalVolatility : 1;
      
      const volatilityTrend = this.determineVolatilityTrend(returns);
      const atr = this.calculateATR(priceData);
      const bollingerBandWidth = this.calculateBollingerBandWidth(priceData);

      return {
        currentVolatility,
        historicalVolatility,
        volatilityRatio,
        volatilityTrend,
        atr,
        bollingerBandWidth
      };
    } catch (error) {
      console.error('Volatility metrics calculation failed:', error);
      return this.getDefaultVolatilityMetrics();
    }
  }

  private calculateReturns(prices: number[]): number[] {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private determineVolatilityTrend(returns: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (returns.length < 20) return 'stable';
    
    const recentVol = this.calculateVolatility(returns.slice(-10));
    const historicalVol = this.calculateVolatility(returns.slice(-20, -10));
    
    const threshold = 0.1;
    const ratio = historicalVol > 0 ? recentVol / historicalVol : 1;
    
    if (ratio > 1 + threshold) {
      return 'increasing';
    } else if (ratio < 1 - threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  private calculateATR(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 0;
    
    const trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i];
      const low = prices[i];
      const prevClose = prices[i-1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    // Simple moving average of true ranges
    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
  }

  private calculateBollingerBandWidth(prices: number[], period: number = 20): number {
    if (prices.length < period) return 0;
    
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    const stdDev = this.calculateStandardDeviation(recentPrices.map(p => p - sma));
    
    const upperBand = sma + (2 * stdDev);
    const lowerBand = sma - (2 * stdDev);
    
    return sma > 0 ? (upperBand - lowerBand) / sma : 0;
  }

  private getDefaultAnalysis(): LinearRegressionAnalysis {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      trendStrength: 0,
      directionalBias: 'neutral',
      trendProbability: 0.5,
      supportLevel: 0,
      resistanceLevel: 0
    };
  }

  private getDefaultVolatilityMetrics(): VolatilityMetrics {
    return {
      currentVolatility: 0.02,
      historicalVolatility: 0.02,
      volatilityRatio: 1,
      volatilityTrend: 'stable',
      atr: 0,
      bollingerBandWidth: 0
    };
  }

  addHistoricalData(data: number[]): void {
    this.historicalData.push(data);
    if (this.historicalData.length > this.maxHistoryLength) {
      this.historicalData = this.historicalData.slice(-this.maxHistoryLength);
    }
  }

  getHistoricalAccuracy(): number {
    // Placeholder for historical accuracy calculation
    return 0.72;
  }
}