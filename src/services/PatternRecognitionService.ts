/**
 * Pattern Recognition Service
 * Comprehensive candlestick pattern detection and analysis system
 */

import { CandleData, MarketContext } from '../types/market';
import { CandlestickPattern, PatternType } from '../types/analysis';
import { validateCandleData } from '../validation/market.validation';
// MarketDataService will be injected as dependency

// Temporary logger for testing
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data),
  debug: (msg: string, data?: any) => console.log(`DEBUG: ${msg}`, data),
};

export interface PatternDetectionOptions {
  minBodySize?: number;
  minWickRatio?: number;
  lookbackPeriod?: number;
  includeWeakPatterns?: boolean;
}

export interface PatternValidationResult {
  isValid: boolean;
  confidence: number;
  timeframeConsensus: number;
  invalidationLevel?: number;
  reason?: string;
}

export class PatternRecognitionService {
  private static readonly DEFAULT_OPTIONS: Required<PatternDetectionOptions> = {
    minBodySize: 0.1, // 10% of average body size
    minWickRatio: 0.5, // Minimum wick to body ratio
    lookbackPeriod: 20, // Number of candles to look back for context
    includeWeakPatterns: false,
  };

  /**
   * Detect all candlestick patterns in the given candle data
   */
  static async detectPatterns(
    candles: CandleData[],
    options: PatternDetectionOptions = {}
  ): Promise<CandlestickPattern[]> {
    if (candles.length < 3) {
      throw new Error('Minimum 3 candles required for pattern detection');
    }

    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const patterns: CandlestickPattern[] = [];

    try {
      // Validate candle data
      for (const candle of candles) {
        const { error } = validateCandleData(candle);
        if (error) {
          throw new Error(`Invalid candle data: ${error.message}`);
        }
      }

      // Calculate average body size for context
      const avgBodySize = this.calculateAverageBodySize(candles);
      
      // Detect single candle patterns
      for (let i = 1; i < candles.length - 1; i++) {
        const singlePatterns = this.detectSingleCandlePatterns(
          candles,
          i,
          avgBodySize,
          opts
        );
        patterns.push(...singlePatterns);
      }

      // Detect multi-candle patterns
      for (let i = 2; i < candles.length - 1; i++) {
        const multiPatterns = this.detectMultiCandlePatterns(
          candles,
          i,
          avgBodySize,
          opts
        );
        patterns.push(...multiPatterns);
      }

      // Filter weak patterns if requested
      const filteredPatterns = opts.includeWeakPatterns 
        ? patterns 
        : patterns.filter(p => p.strength !== 'weak');

      logger.debug('Pattern detection completed', {
        totalCandles: candles.length,
        patternsFound: filteredPatterns.length,
        patternTypes: Array.from(new Set(filteredPatterns.map(p => p.type))),
      });

      return filteredPatterns;
    } catch (error) {
      logger.error('Pattern detection failed', { error, candleCount: candles.length });
      throw error;
    }
  }

  /**
   * Score pattern strength based on market context
   */
  static scorePatternStrength(
    pattern: CandlestickPattern,
    context: MarketContext,
    candles: CandleData[]
  ): number {
    let score = pattern.confidence;

    // Volume confirmation
    const volumeScore = this.calculateVolumeScore(pattern, candles);
    score *= (1 + volumeScore * 0.2);

    // Trend alignment
    const trendScore = this.calculateTrendAlignmentScore(pattern, context);
    score *= (1 + trendScore * 0.3);

    // Support/Resistance proximity
    const srScore = this.calculateSupportResistanceScore(pattern, candles);
    score *= (1 + srScore * 0.25);

    // Market volatility adjustment
    const volatilityScore = this.calculateVolatilityScore(context);
    score *= volatilityScore;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Validate pattern across multiple timeframes
   */
  static async validatePatternAcrossTimeframes(
    pattern: CandlestickPattern,
    symbol: string,
    baseTimeframe: string,
    marketDataService?: any // Injected dependency
  ): Promise<PatternValidationResult> {
    try {
      if (!marketDataService) {
        return {
          isValid: false,
          confidence: 0,
          timeframeConsensus: 0,
          reason: 'MarketDataService not provided',
        };
      }

      const timeframes = this.getValidationTimeframes(baseTimeframe);
      const validations: { timeframe: string; hasPattern: boolean; confidence: number }[] = [];

      for (const tf of timeframes) {
        try {
          const candles = await marketDataService.getHistoricalCandles(symbol, tf, 100);
          const patterns = await this.detectPatterns(candles);
          
          const similarPattern = patterns.find((p: CandlestickPattern) => 
            p.type === pattern.type && 
            Math.abs(p.confidence - pattern.confidence) < 0.3
          );

          validations.push({
            timeframe: tf,
            hasPattern: !!similarPattern,
            confidence: similarPattern?.confidence || 0,
          });
        } catch (error) {
          logger.error(`Failed to validate pattern on ${tf}`, { error, symbol, pattern: pattern.type });
        }
      }

      const consensus = validations.filter(v => v.hasPattern).length / validations.length;
      const avgConfidence = validations.reduce((sum, v) => sum + v.confidence, 0) / validations.length;

      return {
        isValid: consensus >= 0.5,
        confidence: avgConfidence,
        timeframeConsensus: consensus,
        invalidationLevel: await this.calculateInvalidationLevel(pattern, symbol, marketDataService),
      };
    } catch (error) {
      logger.error('Multi-timeframe validation failed', { error, symbol, pattern: pattern.type });
      return {
        isValid: false,
        confidence: 0,
        timeframeConsensus: 0,
        reason: 'Validation failed due to data access error',
      };
    }
  }

  /**
   * Monitor pattern invalidation
   */
  static async monitorPatternInvalidation(
    patterns: CandlestickPattern[],
    symbol: string,
    timeframe: string,
    marketDataService?: any // Injected dependency
  ): Promise<{ invalidatedPatterns: CandlestickPattern[]; alerts: string[] }> {
    const invalidatedPatterns: CandlestickPattern[] = [];
    const alerts: string[] = [];

    try {
      if (!marketDataService) {
        return { invalidatedPatterns: [], alerts: [] };
      }

      const latestCandles = await marketDataService.getHistoricalCandles(symbol, timeframe, 10);
      const currentPrice = latestCandles[latestCandles.length - 1]?.close;

      if (!currentPrice) {
        throw new Error('Unable to get current price for invalidation monitoring');
      }

      for (const pattern of patterns) {
        const invalidationLevel = await this.calculateInvalidationLevel(pattern, symbol, marketDataService);
        
        if (this.isPatternInvalidated(pattern, currentPrice, invalidationLevel)) {
          invalidatedPatterns.push(pattern);
          alerts.push(
            `Pattern ${pattern.type} invalidated for ${symbol} at price ${currentPrice}. ` +
            `Invalidation level was ${invalidationLevel}`
          );
        }
      }

      if (invalidatedPatterns.length > 0) {
        logger.info('Pattern invalidations detected', {
          symbol,
          timeframe,
          invalidatedCount: invalidatedPatterns.length,
          patterns: invalidatedPatterns.map(p => p.type),
        });
      }

      return { invalidatedPatterns, alerts };
    } catch (error) {
      logger.error('Pattern invalidation monitoring failed', { error, symbol, timeframe });
      return { invalidatedPatterns: [], alerts: [] };
    }
  }

  // Private helper methods

  private static detectSingleCandlePatterns(
    candles: CandleData[],
    index: number,
    avgBodySize: number,
    options: Required<PatternDetectionOptions>
  ): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    const candle = candles[index];
    const prevCandle = candles[index - 1];

    // Calculate candle properties
    const bodySize = Math.abs(candle.close - candle.open);
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const totalRange = candle.high - candle.low;

    // Check for doji patterns first (they have small bodies by definition)
    const dojiPattern = this.detectDojiPatterns(candle, bodySize, totalRange, upperWick, lowerWick, index);
    if (dojiPattern) patterns.push(dojiPattern);

    // Skip other patterns if body is too small
    if (bodySize < avgBodySize * options.minBodySize) {
      return patterns;
    }

    // Hammer and Hanging Man
    const hammerPattern = this.detectHammerPattern(candle, prevCandle, bodySize, upperWick, lowerWick, totalRange, index);
    if (hammerPattern) patterns.push(hammerPattern);

    // Shooting Star and Inverted Hammer
    const shootingStarPattern = this.detectShootingStarPattern(candle, prevCandle, bodySize, upperWick, lowerWick, totalRange, index);
    if (shootingStarPattern) patterns.push(shootingStarPattern);

    // Spinning Top
    const spinningTopPattern = this.detectSpinningTopPattern(candle, bodySize, upperWick, lowerWick, totalRange, index);
    if (spinningTopPattern) patterns.push(spinningTopPattern);

    // Marubozu
    const marubozuPattern = this.detectMarubozuPattern(candle, bodySize, upperWick, lowerWick, totalRange, index);
    if (marubozuPattern) patterns.push(marubozuPattern);

    return patterns;
  }

  private static detectMultiCandlePatterns(
    candles: CandleData[],
    index: number,
    avgBodySize: number,
    _options: Required<PatternDetectionOptions>
  ): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];

    // Engulfing patterns
    const engulfingPattern = this.detectEngulfingPattern(candles, index, avgBodySize);
    if (engulfingPattern) patterns.push(engulfingPattern);

    // Harami patterns
    const haramiPattern = this.detectHaramiPattern(candles, index, avgBodySize);
    if (haramiPattern) patterns.push(haramiPattern);

    // Three-candle patterns (Morning Star, Evening Star)
    if (index >= 2) {
      const threeStarPattern = this.detectThreeStarPatterns(candles, index, avgBodySize);
      if (threeStarPattern) patterns.push(threeStarPattern);
    }

    return patterns;
  }  
// Doji pattern detection
  private static detectDojiPatterns(
    _candle: CandleData,
    bodySize: number,
    totalRange: number,
    upperWick: number,
    lowerWick: number,
    index: number
  ): CandlestickPattern | null {
    const bodyRatio = bodySize / totalRange;
    
    if (bodyRatio > 0.1) return null; // Not a doji if body is too large

    let type: PatternType;
    let confidence = 0.7;
    let description = '';

    if (upperWick > lowerWick * 2) {
      type = 'gravestone_doji';
      description = 'Gravestone Doji - potential bearish reversal';
      confidence = 0.75;
    } else if (lowerWick > upperWick * 2) {
      type = 'dragonfly_doji';
      description = 'Dragonfly Doji - potential bullish reversal';
      confidence = 0.75;
    } else if (upperWick > totalRange * 0.3 && lowerWick > totalRange * 0.3) {
      type = 'long_legged_doji';
      description = 'Long-legged Doji - market indecision';
      confidence = 0.8;
    } else {
      type = 'doji';
      description = 'Standard Doji - market indecision';
      confidence = 0.7;
    }

    return {
      type,
      confidence,
      startIndex: index,
      endIndex: index,
      direction: 'bullish', // Will be determined by context
      strength: confidence > 0.75 ? 'strong' : 'moderate',
      description,
      reliability: confidence,
    };
  }

  // Hammer pattern detection
  private static detectHammerPattern(
    _candle: CandleData,
    prevCandle: CandleData,
    bodySize: number,
    upperWick: number,
    lowerWick: number,
    totalRange: number,
    index: number
  ): CandlestickPattern | null {
    // Hammer criteria: small body, long lower wick, small upper wick
    const bodyRatio = bodySize / totalRange;
    const lowerWickRatio = lowerWick / totalRange;
    const upperWickRatio = upperWick / totalRange;

    if (bodyRatio > 0.3 || lowerWickRatio < 0.5 || upperWickRatio > 0.15) {
      return null;
    }

    const isDowntrend = prevCandle.close < prevCandle.open;
    
    let type: PatternType;
    let direction: 'bullish' | 'bearish';
    let confidence = 0.7;
    let description = '';

    if (isDowntrend) {
      type = 'hammer';
      direction = 'bullish';
      description = 'Hammer - potential bullish reversal after downtrend';
      confidence = 0.8;
    } else {
      type = 'hanging_man';
      direction = 'bearish';
      description = 'Hanging Man - potential bearish reversal after uptrend';
      confidence = 0.75;
    }

    return {
      type,
      confidence,
      startIndex: index,
      endIndex: index,
      direction,
      strength: confidence > 0.75 ? 'strong' : 'moderate',
      description,
      reliability: confidence,
    };
  }

  // Shooting Star pattern detection
  private static detectShootingStarPattern(
    _candle: CandleData,
    prevCandle: CandleData,
    bodySize: number,
    upperWick: number,
    lowerWick: number,
    totalRange: number,
    index: number
  ): CandlestickPattern | null {
    // Shooting Star criteria: small body, long upper wick, small lower wick
    const bodyRatio = bodySize / totalRange;
    const upperWickRatio = upperWick / totalRange;
    const lowerWickRatio = lowerWick / totalRange;

    if (bodyRatio > 0.3 || upperWickRatio < 0.5 || lowerWickRatio > 0.15) {
      return null;
    }

    const isUptrend = prevCandle.close > prevCandle.open;
    
    let type: PatternType;
    let direction: 'bullish' | 'bearish';
    let confidence = 0.7;
    let description = '';

    if (isUptrend) {
      type = 'shooting_star';
      direction = 'bearish';
      description = 'Shooting Star - potential bearish reversal after uptrend';
      confidence = 0.8;
    } else {
      type = 'inverted_hammer';
      direction = 'bullish';
      description = 'Inverted Hammer - potential bullish reversal after downtrend';
      confidence = 0.75;
    }

    return {
      type,
      confidence,
      startIndex: index,
      endIndex: index,
      direction,
      strength: confidence > 0.75 ? 'strong' : 'moderate',
      description,
      reliability: confidence,
    };
  }

  // Spinning Top pattern detection
  private static detectSpinningTopPattern(
    _candle: CandleData,
    bodySize: number,
    upperWick: number,
    lowerWick: number,
    totalRange: number,
    index: number
  ): CandlestickPattern | null {
    // Spinning Top criteria: small body, significant wicks on both sides
    const bodyRatio = bodySize / totalRange;
    const upperWickRatio = upperWick / totalRange;
    const lowerWickRatio = lowerWick / totalRange;

    if (bodyRatio > 0.25 || upperWickRatio < 0.2 || lowerWickRatio < 0.2) {
      return null;
    }

    return {
      type: 'spinning_top',
      confidence: 0.6,
      startIndex: index,
      endIndex: index,
      direction: 'bullish', // Neutral, direction determined by context
      strength: 'moderate',
      description: 'Spinning Top - market indecision and potential reversal',
      reliability: 0.6,
    };
  }

  // Marubozu pattern detection
  private static detectMarubozuPattern(
    candle: CandleData,
    bodySize: number,
    upperWick: number,
    lowerWick: number,
    totalRange: number,
    index: number
  ): CandlestickPattern | null {
    // Marubozu criteria: large body, minimal wicks
    const bodyRatio = bodySize / totalRange;
    const upperWickRatio = upperWick / totalRange;
    const lowerWickRatio = lowerWick / totalRange;

    if (bodyRatio < 0.8 || upperWickRatio > 0.1 || lowerWickRatio > 0.1) {
      return null;
    }

    const isBullish = candle.close > candle.open;
    
    return {
      type: isBullish ? 'marubozu_bullish' : 'marubozu_bearish',
      confidence: 0.85,
      startIndex: index,
      endIndex: index,
      direction: isBullish ? 'bullish' : 'bearish',
      strength: 'strong',
      description: `${isBullish ? 'Bullish' : 'Bearish'} Marubozu - strong ${isBullish ? 'buying' : 'selling'} pressure`,
      reliability: 0.85,
    };
  }

  // Engulfing pattern detection
  private static detectEngulfingPattern(
    candles: CandleData[],
    index: number,
    avgBodySize: number
  ): CandlestickPattern | null {
    if (index < 1) return null;

    const prevCandle = candles[index - 1];
    const currentCandle = candles[index];

    const prevBody = Math.abs(prevCandle.close - prevCandle.open);
    const currentBody = Math.abs(currentCandle.close - currentCandle.open);

    // Both candles must have significant bodies
    if (prevBody < avgBodySize * 0.3 || currentBody < avgBodySize * 0.5) {
      return null;
    }

    const prevIsBullish = prevCandle.close > prevCandle.open;
    const currentIsBullish = currentCandle.close > currentCandle.open;

    // Must be opposite colors
    if (prevIsBullish === currentIsBullish) return null;

    // Current candle must engulf previous candle
    const engulfs = currentCandle.open < Math.min(prevCandle.open, prevCandle.close) &&
                   currentCandle.close > Math.max(prevCandle.open, prevCandle.close);

    if (!engulfs) return null;

    const isBullishEngulfing = currentIsBullish;
    
    return {
      type: isBullishEngulfing ? 'engulfing_bullish' : 'engulfing_bearish',
      confidence: 0.85,
      startIndex: index - 1,
      endIndex: index,
      direction: isBullishEngulfing ? 'bullish' : 'bearish',
      strength: 'strong',
      description: `${isBullishEngulfing ? 'Bullish' : 'Bearish'} Engulfing - strong reversal signal`,
      reliability: 0.85,
    };
  }

  // Harami pattern detection
  private static detectHaramiPattern(
    candles: CandleData[],
    index: number,
    avgBodySize: number
  ): CandlestickPattern | null {
    if (index < 1) return null;

    const prevCandle = candles[index - 1];
    const currentCandle = candles[index];

    const prevBody = Math.abs(prevCandle.close - prevCandle.open);
    const currentBody = Math.abs(currentCandle.close - currentCandle.open);

    // Previous candle must have large body, current must be smaller
    if (prevBody < avgBodySize * 0.5 || currentBody > prevBody * 0.8) {
      return null;
    }

    const prevIsBullish = prevCandle.close > prevCandle.open;
    const currentIsBullish = currentCandle.close > currentCandle.open;

    // Must be opposite colors
    if (prevIsBullish === currentIsBullish) return null;

    // Current candle must be inside previous candle's body
    const isInside = currentCandle.open > Math.min(prevCandle.open, prevCandle.close) &&
                    currentCandle.close < Math.max(prevCandle.open, prevCandle.close);

    if (!isInside) return null;

    const isBullishHarami = currentIsBullish;
    
    return {
      type: isBullishHarami ? 'harami_bullish' : 'harami_bearish',
      confidence: 0.75,
      startIndex: index - 1,
      endIndex: index,
      direction: isBullishHarami ? 'bullish' : 'bearish',
      strength: 'moderate',
      description: `${isBullishHarami ? 'Bullish' : 'Bearish'} Harami - potential reversal signal`,
      reliability: 0.75,
    };
  }

  // Three Star patterns (Morning Star, Evening Star)
  private static detectThreeStarPatterns(
    candles: CandleData[],
    index: number,
    avgBodySize: number
  ): CandlestickPattern | null {
    if (index < 2) return null;

    const firstCandle = candles[index - 2];
    const middleCandle = candles[index - 1];
    const lastCandle = candles[index];

    const firstBody = Math.abs(firstCandle.close - firstCandle.open);
    const middleBody = Math.abs(middleCandle.close - middleCandle.open);
    const lastBody = Math.abs(lastCandle.close - lastCandle.open);

    // First and last candles must have significant bodies
    if (firstBody < avgBodySize * 0.5 || lastBody < avgBodySize * 0.5) {
      return null;
    }

    // Middle candle should be small (star)
    if (middleBody > avgBodySize * 0.4) return null;

    const firstIsBullish = firstCandle.close > firstCandle.open;
    const lastIsBullish = lastCandle.close > lastCandle.open;

    // First and last must be opposite colors
    if (firstIsBullish === lastIsBullish) return null;

    // Check for Morning Star (bearish -> small -> bullish)
    if (!firstIsBullish && lastIsBullish) {
      // Middle candle should gap down from first and last should gap up
      const gapDown = middleCandle.high < firstCandle.low;
      const gapUp = lastCandle.low > middleCandle.high;
      
      if (gapDown || gapUp) {
        return {
          type: 'morning_star',
          confidence: 0.9,
          startIndex: index - 2,
          endIndex: index,
          direction: 'bullish',
          strength: 'strong',
          description: 'Morning Star - strong bullish reversal pattern',
          reliability: 0.9,
        };
      }
    }

    // Check for Evening Star (bullish -> small -> bearish)
    if (firstIsBullish && !lastIsBullish) {
      // Middle candle should gap up from first and last should gap down
      const gapUp = middleCandle.low > firstCandle.high;
      const gapDown = lastCandle.high < middleCandle.low;
      
      if (gapUp || gapDown) {
        return {
          type: 'evening_star',
          confidence: 0.9,
          startIndex: index - 2,
          endIndex: index,
          direction: 'bearish',
          strength: 'strong',
          description: 'Evening Star - strong bearish reversal pattern',
          reliability: 0.9,
        };
      }
    }

    return null;
  }

  // Helper methods for pattern scoring and validation

  private static calculateAverageBodySize(candles: CandleData[]): number {
    const bodySizes = candles.map(c => Math.abs(c.close - c.open));
    return bodySizes.reduce((sum, size) => sum + size, 0) / bodySizes.length;
  }

  private static calculateVolumeScore(pattern: CandlestickPattern, candles: CandleData[]): number {
    if (pattern.endIndex >= candles.length) return 0;

    const patternCandles = candles.slice(pattern.startIndex, pattern.endIndex + 1);
    const avgVolume = candles.slice(Math.max(0, pattern.startIndex - 10), pattern.startIndex)
      .reduce((sum, c) => sum + c.volume, 0) / 10;

    const patternVolume = patternCandles.reduce((sum, c) => sum + c.volume, 0) / patternCandles.length;
    
    // Higher volume during pattern formation increases confidence
    return Math.min((patternVolume / avgVolume - 1), 1);
  }

  private static calculateTrendAlignmentScore(pattern: CandlestickPattern, context: MarketContext): number {
    // Reversal patterns score higher when against the trend
    const isReversalPattern = [
      'hammer', 'hanging_man', 'shooting_star', 'inverted_hammer',
      'engulfing_bullish', 'engulfing_bearish', 'morning_star', 'evening_star'
    ].includes(pattern.type);

    if (isReversalPattern) {
      if (context.trend === 'bullish' && pattern.direction === 'bearish') return 0.8;
      if (context.trend === 'bearish' && pattern.direction === 'bullish') return 0.8;
      return 0.2; // Lower score if reversal pattern aligns with trend
    }

    // Continuation patterns score higher when aligned with trend
    const isContinuationPattern = ['spinning_top', 'marubozu_bullish', 'marubozu_bearish'].includes(pattern.type);
    
    if (isContinuationPattern) {
      if (context.trend === 'bullish' && pattern.direction === 'bullish') return 0.7;
      if (context.trend === 'bearish' && pattern.direction === 'bearish') return 0.7;
      return 0.3;
    }

    return 0.5; // Neutral score for other patterns
  }

  private static calculateSupportResistanceScore(pattern: CandlestickPattern, candles: CandleData[]): number {
    if (pattern.endIndex >= candles.length) return 0;

    const patternPrice = candles[pattern.endIndex].close;
    const recentCandles = candles.slice(Math.max(0, pattern.startIndex - 20), pattern.startIndex);
    
    // Find nearby support/resistance levels
    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);
    
    const nearbyResistance = highs.filter(h => Math.abs(h - patternPrice) / patternPrice < 0.02);
    const nearbySupport = lows.filter(l => Math.abs(l - patternPrice) / patternPrice < 0.02);
    
    // Higher score if pattern forms near significant levels
    const proximityScore = (nearbyResistance.length + nearbySupport.length) / 10;
    return Math.min(proximityScore, 1);
  }

  private static calculateVolatilityScore(context: MarketContext): number {
    // Adjust pattern reliability based on market volatility
    switch (context.volatility) {
      case 'low': return 1.1; // Patterns more reliable in low volatility
      case 'medium': return 1.0;
      case 'high': return 0.8; // Patterns less reliable in high volatility
      default: return 1.0;
    }
  }

  private static getValidationTimeframes(baseTimeframe: string): string[] {
    const timeframeHierarchy: Record<string, string[]> = {
      '1m': ['5m', '15m'],
      '5m': ['15m', '1h'],
      '15m': ['1h', '4h'],
      '1h': ['4h', '1d'],
      '4h': ['1d', '1w'],
      '1d': ['1w'],
    };

    return timeframeHierarchy[baseTimeframe] || [];
  }

  private static async calculateInvalidationLevel(
    pattern: CandlestickPattern, 
    symbol: string, 
    marketDataService?: any
  ): Promise<number> {
    // Calculate invalidation level based on pattern type and recent price action
    try {
      if (!marketDataService) return 0;

      const candles = await marketDataService.getHistoricalCandles(symbol, '1h', 50);
      if (candles.length === 0) return 0;

      const patternCandle = candles[candles.length - 1];
      const atr = this.calculateATR(candles.slice(-14)); // 14-period ATR

      switch (pattern.type) {
        case 'hammer':
        case 'dragonfly_doji':
          return patternCandle.low - (atr * 0.5);
        
        case 'shooting_star':
        case 'gravestone_doji':
          return patternCandle.high + (atr * 0.5);
        
        case 'engulfing_bullish':
        case 'morning_star':
          return Math.min(patternCandle.low, patternCandle.open) - (atr * 0.3);
        
        case 'engulfing_bearish':
        case 'evening_star':
          return Math.max(patternCandle.high, patternCandle.open) + (atr * 0.3);
        
        default:
          return patternCandle.close - (atr * 0.5);
      }
    } catch (error) {
      logger.error('Failed to calculate invalidation level', { error, pattern: pattern.type, symbol });
      return 0;
    }
  }

  private static calculateATR(candles: CandleData[]): number {
    if (candles.length < 2) return 0;

    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }

  private static isPatternInvalidated(
    pattern: CandlestickPattern,
    currentPrice: number,
    invalidationLevel: number
  ): boolean {
    if (invalidationLevel === 0) return false;

    switch (pattern.direction) {
      case 'bullish':
        return currentPrice < invalidationLevel;
      case 'bearish':
        return currentPrice > invalidationLevel;
      default:
        return false;
    }
  }

  /**
   * Get pattern statistics for analysis
   */
  static getPatternStatistics(patterns: CandlestickPattern[]): {
    totalPatterns: number;
    byType: Record<string, number>;
    byDirection: Record<string, number>;
    byStrength: Record<string, number>;
    averageConfidence: number;
  } {
    const stats = {
      totalPatterns: patterns.length,
      byType: {} as Record<string, number>,
      byDirection: {} as Record<string, number>,
      byStrength: {} as Record<string, number>,
      averageConfidence: 0,
    };

    if (patterns.length === 0) return stats;

    // Count by type
    patterns.forEach(p => {
      stats.byType[p.type] = (stats.byType[p.type] || 0) + 1;
      stats.byDirection[p.direction] = (stats.byDirection[p.direction] || 0) + 1;
      stats.byStrength[p.strength] = (stats.byStrength[p.strength] || 0) + 1;
    });

    // Calculate average confidence
    stats.averageConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;

    return stats;
  }

  /**
   * Filter patterns by criteria
   */
  static filterPatterns(
    patterns: CandlestickPattern[],
    criteria: {
      types?: PatternType[];
      minConfidence?: number;
      direction?: 'bullish' | 'bearish';
      strength?: ('weak' | 'moderate' | 'strong')[];
    }
  ): CandlestickPattern[] {
    return patterns.filter(pattern => {
      if (criteria.types && !criteria.types.includes(pattern.type)) return false;
      if (criteria.minConfidence && pattern.confidence < criteria.minConfidence) return false;
      if (criteria.direction && pattern.direction !== criteria.direction) return false;
      if (criteria.strength && !criteria.strength.includes(pattern.strength)) return false;
      return true;
    });
  }
}