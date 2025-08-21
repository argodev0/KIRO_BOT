/**
 * Multi-Dimensional Signal Generation Engine
 * Aggregates analysis from multiple sources and generates weighted trading signals
 */

import { CandleData } from '../types/market';
import {
  AnalysisResults,
  TechnicalIndicators,
  CandlestickPattern,
  WaveStructure,
  FibonacciLevels,
  SignalFilter,
  MultiTimeframeAnalysis,
  VolumeProfile,
} from '../types/analysis';
import {
  TradingSignal,
  SignalReasoning,
} from '../types/trading';
// Import TradingSignalModel conditionally to avoid database dependency issues
let TradingSignalModel: any = null;
try {
  TradingSignalModel = require('../models/TradingSignal').TradingSignalModel;
} catch (error) {
  // Database model not available, will work without persistence
}
import { validateTradingSignal } from '../validation/trading.validation';

// Temporary logger for testing
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data),
  debug: (msg: string, data?: any) => console.log(`DEBUG: ${msg}`, data),
  warn: (msg: string, data?: any) => console.warn(`WARN: ${msg}`, data),
};

export interface SignalWeights {
  technical: number;    // 30%
  patterns: number;     // 20%
  elliottWave: number;  // 25%
  fibonacci: number;    // 20%
  volume: number;       // 5%
}

export interface SignalGenerationOptions {
  weights?: Partial<SignalWeights>;
  minConfidence?: number;
  requireStopLoss?: boolean;
  maxSignalsPerSymbol?: number;
  timeframeConsensus?: boolean;
}

export interface SignalValidationResult {
  isValid: boolean;
  confidence: number;
  timeframeAlignment: number;
  invalidationPrice?: number;
  warnings: string[];
}

export interface SignalInvalidationAlert {
  signalId: string;
  symbol: string;
  reason: string;
  currentPrice: number;
  invalidationLevel: number;
  timestamp: number;
}

export class SignalEngine {
  private static readonly DEFAULT_WEIGHTS: SignalWeights = {
    technical: 0.30,
    patterns: 0.20,
    elliottWave: 0.25,
    fibonacci: 0.20,
    volume: 0.05,
  };

  private static readonly DEFAULT_OPTIONS: Required<SignalGenerationOptions> = {
    weights: SignalEngine.DEFAULT_WEIGHTS,
    minConfidence: 0.6,
    requireStopLoss: true,
    maxSignalsPerSymbol: 3,
    timeframeConsensus: true,
  };

  private weights: SignalWeights;
  private options: Required<SignalGenerationOptions>;

  constructor(options?: SignalGenerationOptions) {
    this.options = { ...SignalEngine.DEFAULT_OPTIONS, ...options };
    this.weights = { ...SignalEngine.DEFAULT_WEIGHTS, ...this.options.weights };
    
    // Normalize weights to ensure they sum to 1
    this.normalizeWeights();
  }

  /**
   * Generate trading signal from comprehensive analysis results
   */
  async generateSignal(
    symbol: string,
    analysisResults: AnalysisResults,
    candles: CandleData[],
    userId?: string
  ): Promise<TradingSignal | null> {
    try {
      logger.debug('Generating signal', { symbol, timestamp: analysisResults.timestamp });

      // Calculate individual component scores
      const technicalScore = this.calculateTechnicalScore(analysisResults.technical);
      const patternScore = this.calculatePatternScore(analysisResults.patterns);
      const elliottWaveScore = this.calculateElliottWaveScore(analysisResults.elliottWave);
      const fibonacciScore = this.calculateFibonacciScore(analysisResults.fibonacci);
      const volumeScore = this.calculateVolumeScore(analysisResults.volumeProfile);

      // Calculate weighted confidence
      const confidence = this.calculateWeightedConfidence({
        technicalScore,
        patternScore,
        elliottWaveScore,
        fibonacciScore,
        volumeScore,
      });

      // Check minimum confidence threshold
      if (confidence < this.options.minConfidence) {
        logger.debug('Signal confidence below threshold', {
          symbol,
          confidence,
          minRequired: this.options.minConfidence,
        });
        return null;
      }

      // Determine signal direction
      const direction = this.determineSignalDirection(analysisResults);
      if (!direction) {
        logger.debug('Unable to determine clear signal direction', { symbol });
        return null;
      }

      // Calculate entry price and targets
      const currentPrice = candles[candles.length - 1].close;
      const { entryPrice, stopLoss, takeProfit } = this.calculatePriceTargets(
        direction,
        currentPrice,
        analysisResults
      );

      // Generate signal reasoning
      const reasoning = this.generateSignalReasoning(analysisResults, {
        technicalScore,
        patternScore,
        elliottWaveScore,
        fibonacciScore,
        volumeScore,
      });

      // Create trading signal
      const signal: TradingSignal = {
        symbol,
        direction,
        confidence,
        entryPrice,
        takeProfit,
        reasoning,
        timestamp: Date.now(),
        status: 'pending',
        technicalScore,
        patternScore,
        elliottWaveScore,
        fibonacciScore,
        volumeScore,
      };

      // Add stopLoss only if it's defined
      if (stopLoss !== undefined) {
        signal.stopLoss = stopLoss;
      }

      // Validate signal
      const { error } = validateTradingSignal(signal);
      if (error) {
        logger.error('Generated signal failed validation', { error, signal });
        return null;
      }

      // Persist signal if userId provided and TradingSignalModel is available
      if (userId && TradingSignalModel) {
        try {
          const persistedSignal = await TradingSignalModel.create({ ...signal, userId });
          logger.info('Signal generated and persisted', {
            signalId: persistedSignal.id,
            symbol,
            direction,
            confidence,
          });
          return persistedSignal;
        } catch (error) {
          logger.warn('Failed to persist signal, returning in-memory signal', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      logger.info('Signal generated', { symbol, direction, confidence });
      return signal;
    } catch (error) {
      logger.error('Failed to generate signal', { error, symbol });
      throw error;
    }
  }

  /**
   * Calculate signal confidence based on confluence of multiple factors
   */
  calculateConfidence(signal: TradingSignal): number {
    const scores = {
      technicalScore: signal.technicalScore || 0,
      patternScore: signal.patternScore || 0,
      elliottWaveScore: signal.elliottWaveScore || 0,
      fibonacciScore: signal.fibonacciScore || 0,
      volumeScore: signal.volumeScore || 0,
    };

    return this.calculateWeightedConfidence(scores);
  }

  /**
   * Filter signals based on quality criteria
   */
  filterSignals(signals: TradingSignal[], filters: SignalFilter[]): TradingSignal[] {
    return signals.filter(signal => {
      return filters.every(filter => this.applySignalFilter(signal, filter));
    });
  }

  /**
   * Validate signal consistency across timeframes
   */
  async validateSignalAcrossTimeframes(
    signal: TradingSignal,
    multiTimeframeAnalysis: MultiTimeframeAnalysis
  ): Promise<SignalValidationResult> {
    try {
      const timeframes = Object.keys(multiTimeframeAnalysis.timeframes);
      const alignedTimeframes: string[] = [];
      const warnings: string[] = [];

      for (const timeframe of timeframes) {
        const analysis = multiTimeframeAnalysis.timeframes[timeframe];
        const timeframeDirection = this.determineSignalDirection(analysis);

        if (timeframeDirection === signal.direction) {
          alignedTimeframes.push(timeframe);
        } else if (timeframeDirection) {
          warnings.push(`Timeframe ${timeframe} suggests ${timeframeDirection} direction`);
        }
      }

      const timeframeAlignment = alignedTimeframes.length / timeframes.length;
      const isValid = timeframeAlignment >= 0.6; // At least 60% alignment

      // Calculate invalidation price
      const invalidationPrice = this.calculateInvalidationPrice(signal, multiTimeframeAnalysis);

      return {
        isValid,
        confidence: signal.confidence * timeframeAlignment,
        timeframeAlignment,
        invalidationPrice,
        warnings,
      };
    } catch (error) {
      logger.error('Failed to validate signal across timeframes', { error, signal: signal.symbol });
      return {
        isValid: false,
        confidence: 0,
        timeframeAlignment: 0,
        warnings: ['Validation failed due to error'],
      };
    }
  }

  /**
   * Monitor signals for invalidation conditions
   */
  async monitorSignalInvalidation(
    signals: TradingSignal[],
    currentPrices: Record<string, number>
  ): Promise<SignalInvalidationAlert[]> {
    const alerts: SignalInvalidationAlert[] = [];

    for (const signal of signals) {
      const currentPrice = currentPrices[signal.symbol];
      if (!currentPrice) continue;

      const invalidationCheck = this.checkSignalInvalidation(signal, currentPrice);
      if (invalidationCheck.isInvalidated) {
        alerts.push({
          signalId: signal.id || 'unknown',
          symbol: signal.symbol,
          reason: invalidationCheck.reason,
          currentPrice,
          invalidationLevel: invalidationCheck.level,
          timestamp: Date.now(),
        });

        // Update signal status if it has an ID and TradingSignalModel is available
        if (signal.id && TradingSignalModel) {
          try {
            await TradingSignalModel.updateStatus(signal.id, 'cancelled');
          } catch (error) {
            logger.error('Failed to update invalidated signal status', { error, signalId: signal.id });
          }
        }
      }
    }

    if (alerts.length > 0) {
      logger.warn('Signal invalidations detected', {
        count: alerts.length,
        symbols: alerts.map(a => a.symbol),
      });
    }

    return alerts;
  }

  /**
   * Get signals by confidence range
   */
  async getSignalsByConfidence(
    minConfidence: number,
    maxConfidence: number = 1.0,
    limit: number = 100
  ): Promise<TradingSignal[]> {
    try {
      if (!TradingSignalModel) {
        logger.warn('TradingSignalModel not available, returning empty array');
        return [];
      }
      return await TradingSignalModel.findByConfidenceRange(minConfidence, maxConfidence, limit);
    } catch (error) {
      logger.error('Failed to get signals by confidence', { error, minConfidence, maxConfidence });
      return [];
    }
  }

  /**
   * Update signal engine configuration
   */
  updateConfiguration(options: SignalGenerationOptions): void {
    this.options = { ...this.options, ...options };
    if (options.weights) {
      this.weights = { ...this.weights, ...options.weights };
      this.normalizeWeights();
    }

    logger.info('Signal engine configuration updated', {
      weights: this.weights,
      options: this.options,
    });
  }

  // Private helper methods

  private calculateTechnicalScore(technical: TechnicalIndicators): number {
    let score = 0;
    let factors = 0;

    // RSI contribution
    if (technical.rsi <= 30) {
      score += 0.8; // Oversold - bullish
    } else if (technical.rsi >= 70) {
      score += 0.2; // Overbought - bearish signal but lower score
    } else if (technical.rsi >= 40 && technical.rsi <= 60) {
      score += 0.6; // Neutral zone
    } else {
      score += 0.4;
    }
    factors++;

    // Wave Trend contribution
    if (technical.waveTrend.signal === 'buy') {
      score += 0.8;
    } else if (technical.waveTrend.signal === 'sell') {
      score += 0.3; // Bearish but lower weight
    } else {
      score += 0.5;
    }
    factors++;

    // Trend alignment
    if (technical.trend === 'bullish') {
      score += 0.7;
    } else if (technical.trend === 'bearish') {
      score += 0.3;
    } else {
      score += 0.5;
    }
    factors++;

    // Momentum contribution
    if (technical.momentum === 'strong') {
      score += 0.8;
    } else if (technical.momentum === 'weak') {
      score += 0.4;
    } else {
      score += 0.6;
    }
    factors++;

    return factors > 0 ? score / factors : 0.5;
  }

  private calculatePatternScore(patterns: CandlestickPattern[]): number {
    if (patterns.length === 0) return 0.5;

    // Get the most recent and strongest patterns
    const recentPatterns = patterns
      .filter(p => p.confidence >= 0.6)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Top 3 patterns

    if (recentPatterns.length === 0) return 0.5;

    // Calculate weighted average of pattern confidences
    const totalWeight = recentPatterns.reduce((sum, p) => sum + this.getPatternWeight(p), 0);
    const weightedScore = recentPatterns.reduce((sum, p) => {
      const weight = this.getPatternWeight(p);
      return sum + (p.confidence * weight);
    }, 0);

    return totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  }

  private calculateElliottWaveScore(waveStructure: WaveStructure): number {
    if (!waveStructure || waveStructure.waves.length === 0) return 0.5;

    let score = waveStructure.validity; // Base score from wave validity

    // Bonus for being in favorable wave positions
    const currentWaveType = waveStructure.currentWave.type;
    if (['wave_1', 'wave_3', 'wave_5'].includes(currentWaveType)) {
      score += 0.2; // Bullish impulse waves
    } else if (['wave_a', 'wave_c'].includes(currentWaveType)) {
      score += 0.1; // Corrective waves have some value
    }

    // Bonus for high-probability targets
    const highProbTargets = waveStructure.nextTargets.filter(t => t.probability > 0.7);
    if (highProbTargets.length > 0) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private calculateFibonacciScore(fibonacci: FibonacciLevels): number {
    if (!fibonacci || fibonacci.confluenceZones.length === 0) return 0.5;

    // Score based on confluence zones strength
    const strongZones = fibonacci.confluenceZones.filter(z => z.strength > 0.7);
    const avgStrength = fibonacci.confluenceZones.reduce((sum, z) => sum + z.strength, 0) / 
                       fibonacci.confluenceZones.length;

    let score = avgStrength;

    // Bonus for multiple strong confluence zones
    if (strongZones.length >= 2) {
      score += 0.1;
    }

    // Bonus for golden ratio levels
    const hasGoldenRatio = fibonacci.retracements.some(r => 
      Math.abs(r.ratio - 0.618) < 0.01 || Math.abs(r.ratio - 1.618) < 0.01
    );
    if (hasGoldenRatio) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private calculateVolumeScore(volumeProfile: VolumeProfile): number {
    if (!volumeProfile) return 0.5;

    let score = 0.5; // Base score

    // Volume trend contribution
    if (volumeProfile.volumeTrend === 'increasing') {
      score += 0.3;
    } else if (volumeProfile.volumeTrend === 'decreasing') {
      score -= 0.2;
    }

    // Volume strength contribution
    score += volumeProfile.volumeStrength * 0.2;

    return Math.max(0, Math.min(score, 1.0));
  }

  private calculateWeightedConfidence(scores: {
    technicalScore: number;
    patternScore: number;
    elliottWaveScore: number;
    fibonacciScore: number;
    volumeScore: number;
  }): number {
    return (
      scores.technicalScore * this.weights.technical +
      scores.patternScore * this.weights.patterns +
      scores.elliottWaveScore * this.weights.elliottWave +
      scores.fibonacciScore * this.weights.fibonacci +
      scores.volumeScore * this.weights.volume
    );
  }

  private determineSignalDirection(analysisResults: AnalysisResults): 'long' | 'short' | null {
    const signals: Array<'bullish' | 'bearish' | 'neutral'> = [];

    // Technical analysis signal
    if (analysisResults.technical.trend === 'bullish' && analysisResults.technical.rsi < 70) {
      signals.push('bullish');
    } else if (analysisResults.technical.trend === 'bearish' && analysisResults.technical.rsi > 30) {
      signals.push('bearish');
    } else {
      signals.push('neutral');
    }

    // Pattern signals
    const bullishPatterns = analysisResults.patterns.filter(p => p.direction === 'bullish' && p.confidence > 0.6);
    const bearishPatterns = analysisResults.patterns.filter(p => p.direction === 'bearish' && p.confidence > 0.6);
    
    if (bullishPatterns.length > bearishPatterns.length) {
      signals.push('bullish');
    } else if (bearishPatterns.length > bullishPatterns.length) {
      signals.push('bearish');
    } else {
      signals.push('neutral');
    }

    // Elliott Wave signal
    const currentWave = analysisResults.elliottWave?.currentWave?.type;
    if (currentWave && ['wave_1', 'wave_3', 'wave_5'].includes(currentWave)) {
      signals.push('bullish');
    } else if (currentWave && ['wave_2', 'wave_4', 'wave_a', 'wave_c'].includes(currentWave)) {
      signals.push('bearish');
    } else {
      signals.push('neutral');
    }

    // Count signals
    const bullishCount = signals.filter(s => s === 'bullish').length;
    const bearishCount = signals.filter(s => s === 'bearish').length;

    // Require at least 2/3 consensus
    if (bullishCount >= 2 && bullishCount > bearishCount) {
      return 'long';
    } else if (bearishCount >= 2 && bearishCount > bullishCount) {
      return 'short';
    }

    return null; // No clear direction
  }

  private calculatePriceTargets(
    direction: 'long' | 'short',
    currentPrice: number,
    analysisResults: AnalysisResults
  ): { entryPrice: number; stopLoss?: number; takeProfit: number[] } {
    const entryPrice = currentPrice;
    const atr = this.estimateATR(currentPrice); // Simplified ATR estimation

    let stopLoss: number | undefined;
    let takeProfit: number[] = [];

    if (direction === 'long') {
      // Long position targets
      stopLoss = currentPrice - (atr * 2);
      takeProfit = [
        currentPrice + (atr * 2),   // First target: 2 ATR
        currentPrice + (atr * 3.5), // Second target: 3.5 ATR
        currentPrice + (atr * 5),   // Third target: 5 ATR
      ];

      // Adjust based on Fibonacci levels
      const fibLevels = analysisResults.fibonacci?.extensions || [];
      if (fibLevels.length > 0) {
        const nearbyTargets = fibLevels
          .filter(level => level.price > currentPrice && level.price < currentPrice * 1.1)
          .sort((a, b) => a.price - b.price);
        
        if (nearbyTargets.length > 0) {
          takeProfit[0] = nearbyTargets[0].price;
        }
      }
    } else {
      // Short position targets
      stopLoss = currentPrice + (atr * 2);
      takeProfit = [
        currentPrice - (atr * 2),   // First target: 2 ATR
        currentPrice - (atr * 3.5), // Second target: 3.5 ATR
        currentPrice - (atr * 5),   // Third target: 5 ATR
      ];

      // Adjust based on Fibonacci levels
      const fibLevels = analysisResults.fibonacci?.retracements || [];
      if (fibLevels.length > 0) {
        const nearbyTargets = fibLevels
          .filter(level => level.price < currentPrice && level.price > currentPrice * 0.9)
          .sort((a, b) => b.price - a.price);
        
        if (nearbyTargets.length > 0) {
          takeProfit[0] = nearbyTargets[0].price;
        }
      }
    }

    return { entryPrice, stopLoss, takeProfit };
  }

  private generateSignalReasoning(
    analysisResults: AnalysisResults,
    scores: {
      technicalScore: number;
      patternScore: number;
      elliottWaveScore: number;
      fibonacciScore: number;
      volumeScore: number;
    }
  ): SignalReasoning {
    const technical = analysisResults.technical;
    const patterns = analysisResults.patterns.filter(p => p.confidence > 0.6);
    const elliottWave = analysisResults.elliottWave;
    const fibonacci = analysisResults.fibonacci;
    const volume = analysisResults.volumeProfile;

    // Generate summary
    const strongFactors: string[] = [];
    if (scores.technicalScore > 0.7) strongFactors.push('Technical Analysis');
    if (scores.patternScore > 0.7) strongFactors.push('Candlestick Patterns');
    if (scores.elliottWaveScore > 0.7) strongFactors.push('Elliott Wave');
    if (scores.fibonacciScore > 0.7) strongFactors.push('Fibonacci Levels');
    if (scores.volumeScore > 0.7) strongFactors.push('Volume Profile');

    const summary = strongFactors.length > 0
      ? `Strong confluence detected in: ${strongFactors.join(', ')}`
      : 'Moderate signal strength with mixed indicators';

    return {
      technical: {
        indicators: [
          `RSI: ${technical.rsi.toFixed(1)}`,
          `Wave Trend: ${technical.waveTrend.signal}`,
          `Trend: ${technical.trend}`,
        ],
        confluence: scores.technicalScore,
        trend: technical.trend,
      },
      patterns: {
        detected: patterns.map(p => p.type),
        strength: scores.patternScore,
      },
      elliottWave: {
        currentWave: elliottWave?.currentWave?.type || 'unknown',
        wavePosition: `Wave ${elliottWave?.waveCount || 0} of structure`,
        validity: elliottWave?.validity || 0,
      },
      fibonacci: {
        levels: fibonacci?.confluenceZones?.map(z => z.priceLevel) || [],
        confluence: scores.fibonacciScore,
      },
      volume: {
        profile: volume?.volumeTrend || 'unknown',
        strength: scores.volumeScore,
      },
      summary,
    };
  }

  private getPatternWeight(pattern: CandlestickPattern): number {
    // Weight patterns based on their reliability and type
    const reliabilityWeight = pattern.reliability || pattern.confidence;
    
    // Strong reversal patterns get higher weight
    const strongPatterns = [
      'engulfing_bullish', 'engulfing_bearish',
      'morning_star', 'evening_star',
      'hammer', 'shooting_star'
    ];
    
    const typeWeight = strongPatterns.includes(pattern.type) ? 1.2 : 1.0;
    
    return reliabilityWeight * typeWeight;
  }

  private applySignalFilter(signal: TradingSignal, filter: SignalFilter): boolean {
    // Confidence filter
    if (signal.confidence < filter.minConfidence) {
      return false;
    }

    // Required patterns filter
    if (filter.requiredPatterns && filter.requiredPatterns.length > 0) {
      const signalPatterns = signal.reasoning.patterns.detected;
      const hasRequiredPattern = filter.requiredPatterns.some(required => 
        signalPatterns.includes(required)
      );
      if (!hasRequiredPattern) {
        return false;
      }
    }

    // Required indicators filter
    if (filter.requiredIndicators && filter.requiredIndicators.length > 0) {
      const signalIndicators = signal.reasoning.technical.indicators;
      const hasRequiredIndicator = filter.requiredIndicators.some(required =>
        signalIndicators.some(indicator => indicator.toLowerCase().includes(required.toLowerCase()))
      );
      if (!hasRequiredIndicator) {
        return false;
      }
    }

    // Confluence filter
    if (filter.minConfluence) {
      const avgConfluence = (
        signal.reasoning.technical.confluence +
        signal.reasoning.fibonacci.confluence
      ) / 2;
      if (avgConfluence < filter.minConfluence) {
        return false;
      }
    }

    return true;
  }

  private calculateInvalidationPrice(
    signal: TradingSignal,
    _multiTimeframeAnalysis: MultiTimeframeAnalysis
  ): number {
    const atr = this.estimateATR(signal.entryPrice);
    
    if (signal.direction === 'long') {
      return signal.stopLoss || (signal.entryPrice - atr * 2);
    } else {
      return signal.stopLoss || (signal.entryPrice + atr * 2);
    }
  }

  private checkSignalInvalidation(
    signal: TradingSignal,
    currentPrice: number
  ): { isInvalidated: boolean; reason: string; level: number } {
    const invalidationLevel = signal.stopLoss || this.calculateInvalidationPrice(signal, {} as any);
    
    if (signal.direction === 'long' && currentPrice <= invalidationLevel) {
      return {
        isInvalidated: true,
        reason: 'Price broke below stop loss level',
        level: invalidationLevel,
      };
    }
    
    if (signal.direction === 'short' && currentPrice >= invalidationLevel) {
      return {
        isInvalidated: true,
        reason: 'Price broke above stop loss level',
        level: invalidationLevel,
      };
    }

    return {
      isInvalidated: false,
      reason: '',
      level: invalidationLevel,
    };
  }

  private estimateATR(price: number): number {
    // Simplified ATR estimation - in real implementation, this would use actual ATR calculation
    return price * 0.02; // 2% of price as rough ATR estimate
  }

  private normalizeWeights(): void {
    const total = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
    if (total !== 1.0) {
      Object.keys(this.weights).forEach(key => {
        this.weights[key as keyof SignalWeights] /= total;
      });
    }
  }
}