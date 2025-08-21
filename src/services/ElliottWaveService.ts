/**
 * Elliott Wave Analysis Service
 * Implements Elliott Wave theory for market analysis and wave structure identification
 */

import { CandleData } from '../types/market';
import {
  WaveStructure,
  Wave,
  WaveType,
  WaveDegree,
  WaveTarget,
  AnalysisConfig,
} from '../types/analysis';
import { validateCandleData } from '../validation/market.validation';

// Temporary logger for testing
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data),
  debug: (msg: string, data?: any) => console.log(`DEBUG: ${msg}`, data),
};

export interface WaveIdentificationResult {
  waves: Wave[];
  confidence: number;
  invalidationLevel: number;
}

export interface WaveRelationship {
  wave1: Wave;
  wave2: Wave;
  ratio: number;
  relationship: 'equality' | 'fibonacci' | 'extension';
  confidence: number;
}

export interface NestedWaveAnalysis {
  parentWave: Wave;
  subWaves: Wave[];
  degree: WaveDegree;
  completeness: number;
}

export class ElliottWaveService {
  private config: AnalysisConfig['elliottWave'];
  private fibonacciRatios: number[] = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618, 2.618];

  constructor(config?: Partial<AnalysisConfig['elliottWave']>) {
    this.config = {
      minWaveLength: 5,
      maxWaveLength: 100,
      fibonacciTolerance: 0.05,
      ...config,
    };
  }

  /**
   * Analyze wave structure in price data
   */
  async analyzeWaveStructure(candles: CandleData[]): Promise<WaveStructure> {
    try {
      this.validateInput(candles);

      // Find swing points (peaks and troughs)
      const swingPoints = this.findSwingPoints(candles);
      
      // Identify potential wave structures
      const waveIdentification = await this.identifyWaves(swingPoints, candles);
      
      // Classify wave degrees
      const classifiedWaves = this.classifyWaveDegrees(waveIdentification.waves);
      
      // Determine current wave
      const currentWave = this.getCurrentWave(classifiedWaves, candles);
      
      // Calculate wave targets
      const nextTargets = await this.calculateWaveTargets(classifiedWaves, currentWave);
      
      // Determine overall degree
      const overallDegree = this.determineOverallDegree(classifiedWaves);
      
      const waveStructure: WaveStructure = {
        waves: classifiedWaves,
        currentWave,
        waveCount: classifiedWaves.length,
        degree: overallDegree,
        validity: waveIdentification.confidence,
        nextTargets,
        invalidationLevel: waveIdentification.invalidationLevel,
      };

      logger.debug('Elliott Wave analysis completed', {
        symbol: candles[0]?.symbol,
        waveCount: classifiedWaves.length,
        currentWave: currentWave.type,
        validity: waveIdentification.confidence,
      });

      return waveStructure;
    } catch (error) {
      logger.error('Failed to analyze wave structure', { error });
      throw error;
    }
  }

  /**
   * Classify wave degree based on wave characteristics
   */
  classifyWaveDegree(wave: Wave): WaveDegree {
    const duration = wave.endTime - wave.startTime;
    
    // Duration-based classification (in milliseconds)
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    if (duration < hourMs) {
      return 'subminuette';
    } else if (duration < 4 * hourMs) {
      return 'minuette';
    } else if (duration < dayMs) {
      return 'minute';
    } else if (duration < 3 * dayMs) {
      return 'minor';
    } else if (duration < weekMs) {
      return 'intermediate';
    } else if (duration < monthMs) {
      return 'primary';
    } else if (duration < 12 * monthMs) {
      return 'cycle';
    } else if (duration < 5 * 12 * monthMs) {
      return 'supercycle';
    } else {
      return 'grand_supercycle';
    }
  }

  /**
   * Calculate wave targets based on Fibonacci extensions
   */
  async calculateWaveTargets(waves: Wave[], currentWave: Wave): Promise<WaveTarget[]> {
    try {
      const targets: WaveTarget[] = [];

      if (waves.length < 2) {
        return targets;
      }

      // Get reference waves for calculations
      const referenceWaves = this.getReferenceWaves(waves, currentWave);
      
      // Calculate Fibonacci extension targets
      for (const refWave of referenceWaves) {
        const fibTargets = this.calculateFibonacciExtensions(refWave, currentWave);
        targets.push(...fibTargets);
      }

      // Calculate wave equality targets
      const equalityTargets = this.calculateWaveEqualityTargets(waves, currentWave);
      targets.push(...equalityTargets);

      // Sort by probability and remove duplicates
      return this.consolidateTargets(targets);
    } catch (error) {
      logger.error('Failed to calculate wave targets', { error });
      return [];
    }
  }

  /**
   * Validate wave structure against Elliott Wave rules
   */
  validateWaveStructure(structure: WaveStructure): boolean {
    try {
      const { waves } = structure;
      
      if (waves.length === 0) return false;

      // Check for basic Elliott Wave rules
      const correctiveWaves = waves.filter(w => this.isCorrectiveWave(w.type));

      // Rule 1: Wave 2 never retraces more than 100% of wave 1
      if (!this.validateWave2Retracement(waves)) return false;

      // Rule 2: Wave 3 is never the shortest wave
      if (!this.validateWave3Length(waves)) return false;

      // Rule 3: Wave 4 never enters the price territory of wave 1
      if (!this.validateWave4Territory(waves)) return false;

      // Additional validation for corrective waves
      if (!this.validateCorrectiveWaves(correctiveWaves)) return false;

      return true;
    } catch (error) {
      logger.error('Failed to validate wave structure', { error });
      return false;
    }
  }

  /**
   * Perform nested wave analysis for sub-wave identification
   */
  async analyzeNestedWaves(parentWave: Wave, _candles: CandleData[]): Promise<NestedWaveAnalysis> {
    try {
      // Extract candles for the parent wave timeframe
      const waveCandles = this.extractWaveCandles(parentWave, _candles);
      
      if (waveCandles.length < this.config.minWaveLength) {
        return {
          parentWave,
          subWaves: [],
          degree: this.getSubDegree(parentWave.degree),
          completeness: 0,
        };
      }

      // Analyze sub-wave structure
      const subWaveStructure = await this.analyzeWaveStructure(waveCandles);
      
      // Adjust sub-wave degrees
      const adjustedSubWaves = subWaveStructure.waves.map(wave => ({
        ...wave,
        degree: this.getSubDegree(parentWave.degree),
      }));

      // Calculate completeness based on expected sub-wave count
      const expectedSubWaves = this.getExpectedSubWaveCount(parentWave.type);
      const completeness = Math.min(adjustedSubWaves.length / expectedSubWaves, 1);

      return {
        parentWave,
        subWaves: adjustedSubWaves,
        degree: this.getSubDegree(parentWave.degree),
        completeness,
      };
    } catch (error) {
      logger.error('Failed to analyze nested waves', { error });
      return {
        parentWave,
        subWaves: [],
        degree: this.getSubDegree(parentWave.degree),
        completeness: 0,
      };
    }
  }

  /**
   * Monitor wave invalidation conditions
   */
  monitorWaveInvalidation(structure: WaveStructure, currentPrice: number): {
    isInvalidated: boolean;
    invalidatedWaves: Wave[];
    reason: string;
  } {
    try {
      const invalidatedWaves: Wave[] = [];
      let reason = '';

      // Check if current price violates invalidation level (only for bearish breaks)
      if (structure.invalidationLevel > 0 && currentPrice <= structure.invalidationLevel) {
        // Only invalidate if this represents a significant break of the wave structure
        const lowestWavePrice = Math.min(...structure.waves.map(w => Math.min(w.startPrice, w.endPrice)));
        if (currentPrice < lowestWavePrice * 0.95) { // 5% buffer
          invalidatedWaves.push(...structure.waves);
          reason = `Price ${currentPrice} broke invalidation level ${structure.invalidationLevel}`;
          
          return {
            isInvalidated: true,
            invalidatedWaves,
            reason,
          };
        }
      }

      // Check individual wave invalidation rules
      for (const wave of structure.waves) {
        if (this.isWaveInvalidated(wave, currentPrice, structure)) {
          invalidatedWaves.push(wave);
        }
      }

      if (invalidatedWaves.length > 0) {
        reason = `${invalidatedWaves.length} wave(s) invalidated by current price action`;
      }

      return {
        isInvalidated: invalidatedWaves.length > 0,
        invalidatedWaves,
        reason,
      };
    } catch (error) {
      logger.error('Failed to monitor wave invalidation', { error });
      return {
        isInvalidated: false,
        invalidatedWaves: [],
        reason: 'Error monitoring invalidation',
      };
    }
  }

  /**
   * Find swing points (peaks and troughs) in price data
   */
  private findSwingPoints(candles: CandleData[]): Array<{ price: number; time: number; type: 'high' | 'low'; index: number }> {
    const swingPoints: Array<{ price: number; time: number; type: 'high' | 'low'; index: number }> = [];
    const lookback = Math.min(3, Math.floor(candles.length / 10)); // Adaptive lookback

    for (let i = lookback; i < candles.length - lookback; i++) {
      const current = candles[i];
      
      // Check for swing high
      let isSwingHigh = true;
      let isSwingLow = true;

      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        
        if (candles[j].high >= current.high) {
          isSwingHigh = false;
        }
        if (candles[j].low <= current.low) {
          isSwingLow = false;
        }
      }

      if (isSwingHigh) {
        swingPoints.push({
          price: current.high,
          time: current.timestamp,
          type: 'high',
          index: i,
        });
      }

      if (isSwingLow) {
        swingPoints.push({
          price: current.low,
          time: current.timestamp,
          type: 'low',
          index: i,
        });
      }
    }

    // Ensure we have alternating highs and lows
    const filteredPoints = this.filterAlternatingSwings(swingPoints);
    return filteredPoints.sort((a, b) => a.time - b.time);
  }

  /**
   * Filter swing points to ensure alternating highs and lows
   */
  private filterAlternatingSwings(
    swingPoints: Array<{ price: number; time: number; type: 'high' | 'low'; index: number }>
  ): Array<{ price: number; time: number; type: 'high' | 'low'; index: number }> {
    if (swingPoints.length <= 1) return swingPoints;

    const filtered: Array<{ price: number; time: number; type: 'high' | 'low'; index: number }> = [swingPoints[0]];
    
    for (let i = 1; i < swingPoints.length; i++) {
      const current = swingPoints[i];
      const last = filtered[filtered.length - 1];
      
      // Only add if it's different type than the last one
      if (current.type !== last.type) {
        filtered.push(current);
      } else {
        // If same type, keep the more extreme one
        if (current.type === 'high' && current.price > last.price) {
          filtered[filtered.length - 1] = current;
        } else if (current.type === 'low' && current.price < last.price) {
          filtered[filtered.length - 1] = current;
        }
      }
    }
    
    return filtered;
  }

  /**
   * Identify waves from swing points
   */
  private async identifyWaves(
    swingPoints: Array<{ price: number; time: number; type: 'high' | 'low'; index: number }>,
    _candles: CandleData[]
  ): Promise<WaveIdentificationResult> {
    const waves: Wave[] = [];
    let confidence = 0;
    let invalidationLevel = 0;

    if (swingPoints.length < 4) {
      return { waves, confidence, invalidationLevel };
    }

    // Create waves from consecutive swing points
    for (let i = 0; i < swingPoints.length - 1; i++) {
      const start = swingPoints[i];
      const end = swingPoints[i + 1];

      const wave: Wave = {
        id: `wave_${i + 1}`,
        type: this.determineWaveType(i, start.type === 'low'),
        degree: 'minor', // Will be classified later
        startPrice: start.price,
        endPrice: end.price,
        startTime: start.time,
        endTime: end.time,
        length: Math.abs(end.price - start.price),
        duration: end.time - start.time,
      };

      // Calculate Fibonacci ratio if possible
      if (i > 0) {
        const prevWave = waves[i - 1];
        wave.fibonacciRatio = this.calculateFibonacciRatio(wave, prevWave);
      }

      waves.push(wave);
    }

    // Calculate confidence based on wave relationships
    confidence = this.calculateWaveConfidence(waves);
    
    // Set invalidation level (typically below wave 1 low for bullish structure)
    if (waves.length > 0) {
      const wave1 = waves[0];
      invalidationLevel = wave1.startPrice - (wave1.length * 0.1);
    }

    return { waves, confidence, invalidationLevel };
  }

  /**
   * Determine wave type based on position and direction
   */
  private determineWaveType(index: number, _isUpWave: boolean): WaveType {
    // Determine if we're in an impulse or corrective pattern
    // For simplicity, assume first 5 waves are impulse, then corrective
    if (index < 5) {
      // Impulse pattern: 1(up), 2(down), 3(up), 4(down), 5(up)
      switch (index) {
        case 0: return 'wave_1';
        case 1: return 'wave_2';
        case 2: return 'wave_3';
        case 3: return 'wave_4';
        case 4: return 'wave_5';
        default: return 'wave_1';
      }
    } else {
      // Corrective pattern: A, B, C
      const corrPosition = (index - 5) % 3;
      switch (corrPosition) {
        case 0: return 'wave_a';
        case 1: return 'wave_b';
        case 2: return 'wave_c';
        default: return 'wave_a';
      }
    }
  }

  /**
   * Calculate Fibonacci ratio between two waves
   */
  private calculateFibonacciRatio(wave1: Wave, wave2: Wave): number {
    if (wave2.length === 0) return 1;
    return wave1.length / wave2.length;
  }

  /**
   * Calculate wave confidence based on Elliott Wave rules
   */
  private calculateWaveConfidence(waves: Wave[]): number {
    if (waves.length === 0) return 0;

    let confidence = 0.5; // Base confidence
    let validRules = 0;
    let totalRules = 0;

    // Check Fibonacci relationships
    for (let i = 1; i < waves.length; i++) {
      const ratio = waves[i].fibonacciRatio || 1;
      totalRules++;
      
      if (this.isValidFibonacciRatio(ratio)) {
        validRules++;
      }
    }

    // Check wave alternation
    if (waves.length >= 4) {
      totalRules++;
      if (this.checkWaveAlternation(waves)) {
        validRules++;
      }
    }

    // Check wave 3 extension
    if (waves.length >= 3) {
      totalRules++;
      if (this.isWave3Extended(waves)) {
        validRules++;
      }
    }

    if (totalRules > 0) {
      confidence = 0.3 + (validRules / totalRules) * 0.7;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Check if ratio matches Fibonacci levels
   */
  private isValidFibonacciRatio(ratio: number): boolean {
    return this.fibonacciRatios.some(fibRatio => 
      Math.abs(ratio - fibRatio) <= this.config.fibonacciTolerance
    );
  }

  /**
   * Check wave alternation principle
   */
  private checkWaveAlternation(waves: Wave[]): boolean {
    // Wave 2 and 4 should alternate in character
    if (waves.length < 4) return true;
    
    const wave2Duration = waves[1].duration;
    const wave4Duration = waves[3].duration;
    
    // Simple alternation check - different durations
    return Math.abs(wave2Duration - wave4Duration) / Math.max(wave2Duration, wave4Duration) > 0.3;
  }

  /**
   * Check if wave 3 is extended
   */
  private isWave3Extended(waves: Wave[]): boolean {
    if (waves.length < 3) return false;
    
    const wave1Length = waves[0].length;
    const wave3Length = waves[2].length;
    
    return wave3Length > wave1Length * 1.618;
  }

  /**
   * Classify wave degrees for all waves
   */
  private classifyWaveDegrees(waves: Wave[]): Wave[] {
    return waves.map(wave => ({
      ...wave,
      degree: this.classifyWaveDegree(wave),
    }));
  }

  /**
   * Get current wave based on latest price action
   */
  private getCurrentWave(waves: Wave[], candles: CandleData[]): Wave {
    if (waves.length === 0) {
      // Create a default current wave
      const latestCandle = candles[candles.length - 1];
      return {
        id: 'current_wave',
        type: 'wave_1',
        degree: 'minor',
        startPrice: latestCandle.open,
        endPrice: latestCandle.close,
        startTime: latestCandle.timestamp,
        endTime: latestCandle.timestamp,
        length: Math.abs(latestCandle.close - latestCandle.open),
        duration: 0,
      };
    }

    return waves[waves.length - 1];
  }

  /**
   * Determine overall degree of wave structure
   */
  private determineOverallDegree(waves: Wave[]): WaveDegree {
    if (waves.length === 0) return 'minor';
    
    // Use the most common degree or the highest degree
    const degrees = waves.map(w => w.degree);
    const degreeCount = degrees.reduce((acc, degree) => {
      acc[degree] = (acc[degree] || 0) + 1;
      return acc;
    }, {} as Record<WaveDegree, number>);

    return Object.entries(degreeCount)
      .sort(([,a], [,b]) => b - a)[0][0] as WaveDegree;
  }

  /**
   * Get reference waves for target calculations
   */
  private getReferenceWaves(waves: Wave[], _currentWave: Wave): Wave[] {
    // Return the last few waves for reference
    return waves.slice(-3);
  }

  /**
   * Calculate Fibonacci extension targets
   */
  private calculateFibonacciExtensions(referenceWave: Wave, currentWave: Wave): WaveTarget[] {
    const targets: WaveTarget[] = [];
    const baseLength = referenceWave.length;
    
    // Common Fibonacci extension levels
    const extensions = [1.272, 1.618, 2.618];
    
    for (const extension of extensions) {
      const targetPrice = currentWave.startPrice + (baseLength * extension);
      const probability = this.calculateTargetProbability(extension);
      
      targets.push({
        price: targetPrice,
        probability,
        type: 'fibonacci_extension',
        description: `${extension * 100}% Fibonacci extension of wave ${referenceWave.id}`,
      });
    }

    return targets;
  }

  /**
   * Calculate wave equality targets
   */
  private calculateWaveEqualityTargets(waves: Wave[], currentWave: Wave): WaveTarget[] {
    const targets: WaveTarget[] = [];
    
    if (waves.length < 2) return targets;

    // Wave equality (1:1 ratio)
    const referenceWave = waves[waves.length - 2];
    const equalityTarget = currentWave.startPrice + referenceWave.length;
    
    targets.push({
      price: equalityTarget,
      probability: 0.6,
      type: 'wave_equality',
      description: `Wave equality target based on ${referenceWave.id}`,
    });

    return targets;
  }

  /**
   * Calculate target probability based on Fibonacci level
   */
  private calculateTargetProbability(fibLevel: number): number {
    // Higher probability for common Fibonacci levels
    const commonLevels = [0.618, 1.0, 1.618];
    
    if (commonLevels.includes(fibLevel)) {
      return 0.8;
    } else if (fibLevel === 1.272 || fibLevel === 2.618) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  /**
   * Consolidate and sort targets
   */
  private consolidateTargets(targets: WaveTarget[]): WaveTarget[] {
    // Remove duplicates and sort by probability
    const uniqueTargets = targets.filter((target, index, self) => 
      index === self.findIndex(t => Math.abs(t.price - target.price) < 0.01)
    );

    return uniqueTargets
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10); // Limit to top 10 targets
  }

  /**
   * Validate input data
   */
  private validateInput(candles: CandleData[]): void {
    if (!candles || candles.length === 0) {
      throw new Error('No candle data provided');
    }

    if (candles.length < this.config.minWaveLength) {
      throw new Error(`Insufficient data: need at least ${this.config.minWaveLength} candles`);
    }

    // Validate first candle
    const { error } = validateCandleData(candles[0]);
    if (error) {
      throw new Error(`Invalid candle data: ${error.message}`);
    }
  }

  /**
   * Elliott Wave rule validations
   */
  private validateWave2Retracement(waves: Wave[]): boolean {
    if (waves.length < 2) return true;
    
    const wave1 = waves[0];
    const wave2 = waves[1];
    
    // Wave 2 should not retrace more than 100% of wave 1
    return wave2.length <= wave1.length;
  }

  private validateWave3Length(waves: Wave[]): boolean {
    if (waves.length < 3) return true;
    
    const wave1 = waves[0];
    const wave3 = waves[2];
    const wave5 = waves.length > 4 ? waves[4] : null;
    
    // Wave 3 should not be the shortest
    if (wave5) {
      return wave3.length >= Math.min(wave1.length, wave5.length);
    } else {
      return wave3.length >= wave1.length;
    }
  }

  private validateWave4Territory(waves: Wave[]): boolean {
    if (waves.length < 4) return true;
    
    const wave1 = waves[0];
    const wave4 = waves[3];
    
    // Wave 4 should not enter wave 1 territory
    if (wave1.endPrice > wave1.startPrice) { // Bullish wave 1
      return wave4.endPrice > wave1.endPrice;
    } else { // Bearish wave 1
      return wave4.endPrice < wave1.endPrice;
    }
  }

  private validateCorrectiveWaves(correctiveWaves: Wave[]): boolean {
    // Basic validation for corrective wave patterns
    return correctiveWaves.length <= 3; // Simple A-B-C correction
  }

  private isImpulseWave(type: WaveType): boolean {
    return ['wave_1', 'wave_2', 'wave_3', 'wave_4', 'wave_5'].includes(type);
  }

  private isCorrectiveWave(type: WaveType): boolean {
    return ['wave_a', 'wave_b', 'wave_c', 'wave_w', 'wave_x', 'wave_y', 'wave_z'].includes(type);
  }

  private extractWaveCandles(wave: Wave, candles: CandleData[]): CandleData[] {
    return candles.filter(candle => 
      candle.timestamp >= wave.startTime && candle.timestamp <= wave.endTime
    );
  }

  private getSubDegree(parentDegree: WaveDegree): WaveDegree {
    const degrees: WaveDegree[] = [
      'subminuette', 'minuette', 'minute', 'minor', 'intermediate',
      'primary', 'cycle', 'supercycle', 'grand_supercycle'
    ];
    
    const currentIndex = degrees.indexOf(parentDegree);
    return currentIndex > 0 ? degrees[currentIndex - 1] : 'subminuette';
  }

  private getExpectedSubWaveCount(waveType: WaveType): number {
    if (this.isImpulseWave(waveType)) {
      return 5; // Impulse waves have 5 sub-waves
    } else {
      return 3; // Corrective waves typically have 3 sub-waves
    }
  }

  private isWaveInvalidated(wave: Wave, currentPrice: number, structure: WaveStructure): boolean {
    // Check specific invalidation rules for each wave type
    switch (wave.type) {
      case 'wave_1':
        // Wave 1 invalidated if price goes below start
        return currentPrice < Math.min(wave.startPrice, wave.endPrice);
      
      case 'wave_2':
        // Wave 2 invalidated if it retraces more than 100% of wave 1
        const wave1 = structure.waves.find(w => w.type === 'wave_1');
        if (wave1) {
          return Math.abs(currentPrice - wave1.startPrice) > wave1.length;
        }
        return false;
      
      case 'wave_3':
        // Wave 3 invalidated if it becomes shorter than wave 1
        const refWave1 = structure.waves.find(w => w.type === 'wave_1');
        if (refWave1) {
          return wave.length < refWave1.length;
        }
        return false;
      
      default:
        return false;
    }
  }
}