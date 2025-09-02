/**
 * Enhanced Elliott Wave Analyzer
 * Advanced Elliott Wave analysis with complete wave structure identification and probability scoring
 */

import { CandleData } from '../../types/market';
import { Wave, WaveStructure, WaveTarget, WaveType, WaveDegree } from '../../types/analysis';

export interface WaveProbabilityScore {
  waveId: string;
  probability: number;
  confidence: number;
  invalidationLevel: number;
  nextTargets: WaveTarget[];
}

export interface NestedWaveAnalysis {
  parentWave: Wave;
  subWaves: Wave[];
  completeness: number;
  probability: number;
}

export interface WaveRelationshipAnalysis {
  wave1: Wave;
  wave2: Wave;
  fibonacciRatio: number;
  relationship: 'equality' | 'fibonacci' | 'extension';
  strength: number;
}

export interface ElliottWaveConfig {
  minWaveLength: number;
  maxWaveLength: number;
  fibonacciTolerance: number;
  probabilityThreshold: number;
  degreeAnalysisDepth: number;
}

export class EnhancedElliottWaveAnalyzer {
  private config: ElliottWaveConfig;
  private fibonacciRatios = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618, 2.618, 4.236];

  constructor(config: ElliottWaveConfig) {
    this.config = config;
  }

  /**
   * Calculate probability scores for each wave in the structure
   */
  async calculateWaveProbabilities(
    waves: Wave[],
    candles: CandleData[]
  ): Promise<WaveProbabilityScore[]> {
    const probabilityScores: WaveProbabilityScore[] = [];

    for (const wave of waves) {
      const probability = await this.calculateWaveProbability(wave, waves, candles);
      const confidence = await this.calculateWaveConfidence(wave, waves, candles);
      const invalidationLevel = await this.calculateWaveInvalidationLevel(wave, candles);
      const nextTargets = await this.calculateWaveTargets(wave, waves);

      probabilityScores.push({
        waveId: wave.id,
        probability,
        confidence,
        invalidationLevel,
        nextTargets,
      });
    }

    return probabilityScores;
  }

  /**
   * Perform nested wave analysis for sub-wave identification
   */
  async performNestedAnalysis(
    waves: Wave[],
    candles: CandleData[]
  ): Promise<NestedWaveAnalysis[]> {
    const nestedAnalyses: NestedWaveAnalysis[] = [];

    for (const parentWave of waves) {
      // Extract candles for this wave's timeframe
      const waveCandles = this.extractWaveCandles(parentWave, candles);
      
      if (waveCandles.length < this.config.minWaveLength) {
        continue;
      }

      // Analyze sub-waves within the parent wave
      const subWaves = await this.identifySubWaves(parentWave, waveCandles);
      const completeness = this.calculateWaveCompleteness(parentWave, subWaves);
      const probability = await this.calculateNestedWaveProbability(parentWave, subWaves, waveCandles);

      nestedAnalyses.push({
        parentWave,
        subWaves,
        completeness,
        probability,
      });
    }

    return nestedAnalyses;
  }

  /**
   * Calculate invalidation levels for each wave
   */
  async calculateInvalidationLevels(
    waves: Wave[],
    candles: CandleData[]
  ): Promise<number[]> {
    const invalidationLevels: number[] = [];

    for (const wave of waves) {
      const level = await this.calculateWaveInvalidationLevel(wave, candles);
      invalidationLevels.push(level);
    }

    return invalidationLevels;
  }

  /**
   * Analyze wave relationships and Fibonacci ratios
   */
  async analyzeWaveRelationships(waves: Wave[]): Promise<WaveRelationshipAnalysis[]> {
    const relationships: WaveRelationshipAnalysis[] = [];

    for (let i = 0; i < waves.length - 1; i++) {
      for (let j = i + 1; j < waves.length; j++) {
        const wave1 = waves[i];
        const wave2 = waves[j];
        
        const fibonacciRatio = wave2.length / wave1.length;
        const relationship = this.classifyWaveRelationship(fibonacciRatio);
        const strength = this.calculateRelationshipStrength(fibonacciRatio, relationship);

        relationships.push({
          wave1,
          wave2,
          fibonacciRatio,
          relationship,
          strength,
        });
      }
    }

    return relationships.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Validate Elliott Wave rules and patterns
   */
  async validateElliottWaveRules(waves: Wave[]): Promise<{
    isValid: boolean;
    violations: string[];
    confidence: number;
  }> {
    const violations: string[] = [];
    let validRules = 0;
    let totalRules = 0;

    // Rule 1: Wave 2 never retraces more than 100% of wave 1
    if (waves.length >= 2) {
      totalRules++;
      const wave1 = waves[0];
      const wave2 = waves[1];
      
      if (wave2.length <= wave1.length) {
        validRules++;
      } else {
        violations.push('Wave 2 retraces more than 100% of wave 1');
      }
    }

    // Rule 2: Wave 3 is never the shortest wave
    if (waves.length >= 5) {
      totalRules++;
      const wave1 = waves[0];
      const wave3 = waves[2];
      const wave5 = waves[4];
      
      if (wave3.length >= Math.min(wave1.length, wave5.length)) {
        validRules++;
      } else {
        violations.push('Wave 3 is the shortest wave');
      }
    }

    // Rule 3: Wave 4 never enters the price territory of wave 1
    if (waves.length >= 4) {
      totalRules++;
      const wave1 = waves[0];
      const wave4 = waves[3];
      
      const wave1Territory = [Math.min(wave1.startPrice, wave1.endPrice), Math.max(wave1.startPrice, wave1.endPrice)];
      const wave4Territory = [Math.min(wave4.startPrice, wave4.endPrice), Math.max(wave4.startPrice, wave4.endPrice)];
      
      const overlap = !(wave4Territory[1] < wave1Territory[0] || wave4Territory[0] > wave1Territory[1]);
      
      if (!overlap) {
        validRules++;
      } else {
        violations.push('Wave 4 enters the price territory of wave 1');
      }
    }

    // Additional Fibonacci relationship checks
    totalRules++;
    const fibonacciCompliance = this.checkFibonacciCompliance(waves);
    if (fibonacciCompliance > 0.6) {
      validRules++;
    } else {
      violations.push('Poor Fibonacci ratio compliance');
    }

    const confidence = totalRules > 0 ? validRules / totalRules : 0;
    const isValid = confidence >= this.config.probabilityThreshold && violations.length === 0;

    return {
      isValid,
      violations,
      confidence,
    };
  }

  // Private methods

  private async calculateWaveProbability(
    wave: Wave,
    allWaves: Wave[],
    candles: CandleData[]
  ): Promise<number> {
    let probability = 0.5; // Base probability

    // Fibonacci ratio compliance
    const fibonacciScore = this.calculateFibonacciScore(wave, allWaves);
    probability += fibonacciScore * 0.3;

    // Volume confirmation
    const volumeScore = await this.calculateVolumeScore(wave, candles);
    probability += volumeScore * 0.2;

    // Price action quality
    const priceActionScore = this.calculatePriceActionScore(wave, candles);
    probability += priceActionScore * 0.2;

    // Wave structure integrity
    const structureScore = this.calculateStructureScore(wave, allWaves);
    probability += structureScore * 0.3;

    return Math.min(Math.max(probability, 0), 1);
  }

  private async calculateWaveConfidence(
    wave: Wave,
    allWaves: Wave[],
    candles: CandleData[]
  ): Promise<number> {
    let confidence = 0.5;

    // Time-based confidence (longer waves are more reliable)
    const timeScore = Math.min(wave.duration / (24 * 60 * 60 * 1000), 1); // Normalize to days
    confidence += timeScore * 0.2;

    // Price movement significance
    const priceScore = Math.min(wave.length / (candles[0]?.close || 1) * 100, 1); // Normalize to percentage
    confidence += priceScore * 0.3;

    // Wave position in sequence
    const positionScore = this.calculateWavePositionScore(wave, allWaves);
    confidence += positionScore * 0.3;

    // Market context
    const contextScore = await this.calculateMarketContextScore(wave, candles);
    confidence += contextScore * 0.2;

    return Math.min(Math.max(confidence, 0), 1);
  }

  private async calculateWaveInvalidationLevel(
    wave: Wave,
    candles: CandleData[]
  ): Promise<number> {
    // Calculate ATR for context
    const atr = this.calculateATR(candles.slice(-14));
    
    switch (wave.type) {
      case 'wave_1':
        // Wave 1 invalidated if price goes below start
        return Math.min(wave.startPrice, wave.endPrice) - (atr * 0.5);
      
      case 'wave_2':
        // Wave 2 invalidated if it retraces more than 100% of wave 1
        return wave.startPrice - (atr * 0.3);
      
      case 'wave_3':
        // Wave 3 invalidated if it fails to exceed wave 1 high
        return Math.max(wave.startPrice, wave.endPrice) - (atr * 0.7);
      
      case 'wave_4':
        // Wave 4 invalidated if it enters wave 1 territory
        return Math.min(wave.startPrice, wave.endPrice) - (atr * 0.4);
      
      case 'wave_5':
        // Wave 5 invalidated if it fails to exceed wave 3 high
        return Math.max(wave.startPrice, wave.endPrice) - (atr * 0.6);
      
      default:
        return Math.min(wave.startPrice, wave.endPrice) - (atr * 0.5);
    }
  }

  private async calculateWaveTargets(
    wave: Wave,
    allWaves: Wave[]
  ): Promise<WaveTarget[]> {
    const targets: WaveTarget[] = [];

    // Fibonacci extension targets
    if (allWaves.length >= 2) {
      const referenceWave = allWaves[Math.max(0, allWaves.indexOf(wave) - 1)];
      
      for (const ratio of [1.272, 1.618, 2.618]) {
        const targetPrice = wave.startPrice + (referenceWave.length * ratio);
        const probability = this.calculateTargetProbability(ratio);
        
        targets.push({
          price: targetPrice,
          probability,
          type: 'fibonacci_extension',
          description: `${(ratio * 100).toFixed(1)}% Fibonacci extension`,
        });
      }
    }

    // Wave equality targets
    if (allWaves.length >= 3) {
      const wave1 = allWaves[0];
      const equalityTarget = wave.startPrice + wave1.length;
      
      targets.push({
        price: equalityTarget,
        probability: 0.7,
        type: 'wave_equality',
        description: 'Wave equality target',
      });
    }

    return targets.sort((a, b) => b.probability - a.probability);
  }

  private extractWaveCandles(wave: Wave, candles: CandleData[]): CandleData[] {
    return candles.filter(candle => 
      candle.timestamp >= wave.startTime && candle.timestamp <= wave.endTime
    );
  }

  private async identifySubWaves(
    parentWave: Wave,
    waveCandles: CandleData[]
  ): Promise<Wave[]> {
    if (waveCandles.length < 5) return [];

    // Find swing points within the parent wave
    const swingPoints = this.findSwingPoints(waveCandles);
    const subWaves: Wave[] = [];

    // Create sub-waves from swing points
    for (let i = 0; i < swingPoints.length - 1; i++) {
      const start = swingPoints[i];
      const end = swingPoints[i + 1];

      const subWave: Wave = {
        id: `${parentWave.id}_sub_${i + 1}`,
        type: this.determineSubWaveType(i, parentWave.type),
        degree: this.getSubDegree(parentWave.degree),
        startPrice: start.price,
        endPrice: end.price,
        startTime: start.time,
        endTime: end.time,
        length: Math.abs(end.price - start.price),
        duration: end.time - start.time,
      };

      subWaves.push(subWave);
    }

    return subWaves;
  }

  private calculateWaveCompleteness(parentWave: Wave, subWaves: Wave[]): number {
    const expectedSubWaves = this.getExpectedSubWaveCount(parentWave.type);
    return Math.min(subWaves.length / expectedSubWaves, 1);
  }

  private async calculateNestedWaveProbability(
    parentWave: Wave,
    subWaves: Wave[],
    waveCandles: CandleData[]
  ): Promise<number> {
    if (subWaves.length === 0) return 0;

    let probability = 0.5;

    // Completeness score
    const completeness = this.calculateWaveCompleteness(parentWave, subWaves);
    probability += completeness * 0.4;

    // Sub-wave quality
    const avgSubWaveQuality = subWaves.reduce((sum, subWave) => {
      return sum + this.calculatePriceActionScore(subWave, waveCandles);
    }, 0) / subWaves.length;
    
    probability += avgSubWaveQuality * 0.3;

    // Fibonacci relationships within sub-waves
    const fibonacciScore = this.checkFibonacciCompliance(subWaves);
    probability += fibonacciScore * 0.3;

    return Math.min(Math.max(probability, 0), 1);
  }

  private classifyWaveRelationship(fibonacciRatio: number): 'equality' | 'fibonacci' | 'extension' {
    if (Math.abs(fibonacciRatio - 1.0) < this.config.fibonacciTolerance) {
      return 'equality';
    }
    
    for (const ratio of this.fibonacciRatios) {
      if (Math.abs(fibonacciRatio - ratio) < this.config.fibonacciTolerance) {
        return 'fibonacci';
      }
    }
    
    return 'extension';
  }

  private calculateRelationshipStrength(
    fibonacciRatio: number,
    relationship: 'equality' | 'fibonacci' | 'extension'
  ): number {
    switch (relationship) {
      case 'equality':
        return 0.9;
      case 'fibonacci':
        // Stronger for more common Fibonacci ratios
        const commonRatios = [0.618, 1.618, 2.618];
        const isCommon = commonRatios.some(ratio => 
          Math.abs(fibonacciRatio - ratio) < this.config.fibonacciTolerance
        );
        return isCommon ? 0.8 : 0.6;
      case 'extension':
        return 0.4;
      default:
        return 0.3;
    }
  }

  private calculateFibonacciScore(wave: Wave, allWaves: Wave[]): number {
    if (allWaves.length < 2) return 0.5;

    let score = 0;
    let comparisons = 0;

    for (const otherWave of allWaves) {
      if (otherWave.id === wave.id) continue;

      const ratio = wave.length / otherWave.length;
      const relationship = this.classifyWaveRelationship(ratio);
      const strength = this.calculateRelationshipStrength(ratio, relationship);
      
      score += strength;
      comparisons++;
    }

    return comparisons > 0 ? score / comparisons : 0.5;
  }

  private async calculateVolumeScore(wave: Wave, candles: CandleData[]): Promise<number> {
    const waveCandles = this.extractWaveCandles(wave, candles);
    if (waveCandles.length === 0) return 0.5;

    const waveVolume = waveCandles.reduce((sum, c) => sum + c.volume, 0) / waveCandles.length;
    const contextCandles = candles.slice(-50);
    const contextVolume = contextCandles.reduce((sum, c) => sum + c.volume, 0) / contextCandles.length;

    const volumeRatio = waveVolume / contextVolume;
    
    // Higher volume during impulse waves, lower during corrective waves
    const isImpulseWave = ['wave_1', 'wave_3', 'wave_5'].includes(wave.type);
    
    if (isImpulseWave) {
      return Math.min(volumeRatio / 1.5, 1); // Expect higher volume
    } else {
      return Math.min(1.5 / volumeRatio, 1); // Expect lower volume
    }
  }

  private calculatePriceActionScore(wave: Wave, candles: CandleData[]): number {
    const waveCandles = this.extractWaveCandles(wave, candles);
    if (waveCandles.length < 3) return 0.5;

    let score = 0.5;

    // Check for clean price movement
    const priceDirection = wave.endPrice > wave.startPrice ? 1 : -1;
    let consistentMoves = 0;
    
    for (let i = 1; i < waveCandles.length; i++) {
      const candleDirection = waveCandles[i].close > waveCandles[i - 1].close ? 1 : -1;
      if (candleDirection === priceDirection) {
        consistentMoves++;
      }
    }

    const consistency = consistentMoves / (waveCandles.length - 1);
    score += consistency * 0.3;

    // Check for momentum (stronger moves at the beginning)
    const firstHalf = waveCandles.slice(0, Math.floor(waveCandles.length / 2));
    const secondHalf = waveCandles.slice(Math.floor(waveCandles.length / 2));
    
    const firstHalfMove = Math.abs(firstHalf[firstHalf.length - 1]?.close - firstHalf[0]?.close) || 0;
    const secondHalfMove = Math.abs(secondHalf[secondHalf.length - 1]?.close - secondHalf[0]?.close) || 0;
    
    if (firstHalfMove > secondHalfMove) {
      score += 0.2; // Good momentum pattern
    }

    return Math.min(Math.max(score, 0), 1);
  }

  private calculateStructureScore(wave: Wave, allWaves: Wave[]): number {
    let score = 0.5;

    // Check wave position in sequence
    const waveIndex = allWaves.indexOf(wave);
    const expectedPattern = this.getExpectedWavePattern(waveIndex);
    
    if (wave.type === expectedPattern) {
      score += 0.3;
    }

    // Check alternation principle (waves 2 and 4 should alternate)
    if (allWaves.length >= 4 && (wave.type === 'wave_2' || wave.type === 'wave_4')) {
      const wave2 = allWaves.find(w => w.type === 'wave_2');
      const wave4 = allWaves.find(w => w.type === 'wave_4');
      
      if (wave2 && wave4) {
        const alternation = Math.abs(wave2.duration - wave4.duration) / Math.max(wave2.duration, wave4.duration);
        if (alternation > 0.3) {
          score += 0.2; // Good alternation
        }
      }
    }

    return Math.min(Math.max(score, 0), 1);
  }

  private calculateWavePositionScore(wave: Wave, allWaves: Wave[]): number {
    const waveIndex = allWaves.indexOf(wave);
    const totalWaves = allWaves.length;
    
    // Waves in the middle of a sequence are generally more reliable
    const positionScore = 1 - Math.abs((waveIndex / totalWaves) - 0.5) * 2;
    return Math.max(positionScore, 0.3);
  }

  private async calculateMarketContextScore(wave: Wave, candles: CandleData[]): Promise<number> {
    // Simplified market context scoring
    const recentCandles = candles.slice(-20);
    const volatility = this.calculateVolatility(recentCandles);
    
    // Lower volatility generally means more reliable wave identification
    return Math.max(1 - volatility, 0.3);
  }

  private calculateTargetProbability(fibonacciRatio: number): number {
    const commonRatios = [1.272, 1.618, 2.618];
    
    if (commonRatios.includes(fibonacciRatio)) {
      return 0.8;
    } else if (fibonacciRatio === 1.0) {
      return 0.7;
    } else {
      return 0.5;
    }
  }

  private findSwingPoints(candles: CandleData[]): Array<{ price: number; time: number; type: 'high' | 'low' }> {
    const swingPoints: Array<{ price: number; time: number; type: 'high' | 'low' }> = [];
    const lookback = 3;

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
        });
      }

      if (isSwingLow) {
        swingPoints.push({
          price: current.low,
          time: current.timestamp,
          type: 'low',
        });
      }
    }

    return swingPoints.sort((a, b) => a.time - b.time);
  }

  private determineSubWaveType(index: number, parentType: WaveType): WaveType {
    // Simplified sub-wave type determination based on Elliott Wave theory
    const waveTypes: WaveType[] = ['wave_1', 'wave_2', 'wave_3', 'wave_4', 'wave_5'];
    return waveTypes[index % waveTypes.length];
  }

  private getSubDegree(parentDegree: WaveDegree): WaveDegree {
    const degrees: WaveDegree[] = [
      'subminuette', 'minuette', 'minute', 'minor', 'intermediate',
      'primary', 'cycle', 'supercycle', 'grand_supercycle'
    ];
    
    const currentIndex = degrees.indexOf(parentDegree);
    return currentIndex > 0 ? degrees[currentIndex - 1] : 'subminuette';
  }

  private getExpectedSubWaveCount(waveType: string): number {
    if (['wave_1', 'wave_3', 'wave_5'].includes(waveType)) {
      return 5; // Impulse waves have 5 sub-waves
    } else {
      return 3; // Corrective waves have 3 sub-waves
    }
  }

  private getExpectedWavePattern(index: number): string {
    const patterns = ['wave_1', 'wave_2', 'wave_3', 'wave_4', 'wave_5'];
    return patterns[index % patterns.length] || 'wave_1';
  }

  private checkFibonacciCompliance(waves: Wave[]): number {
    if (waves.length < 2) return 0.5;

    let compliantRatios = 0;
    let totalRatios = 0;

    for (let i = 0; i < waves.length - 1; i++) {
      for (let j = i + 1; j < waves.length; j++) {
        const ratio = waves[j].length / waves[i].length;
        totalRatios++;
        
        for (const fibRatio of this.fibonacciRatios) {
          if (Math.abs(ratio - fibRatio) < this.config.fibonacciTolerance) {
            compliantRatios++;
            break;
          }
        }
      }
    }

    return totalRatios > 0 ? compliantRatios / totalRatios : 0.5;
  }

  private calculateATR(candles: CandleData[]): number {
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

  private calculateVolatility(candles: CandleData[]): number {
    if (candles.length < 2) return 0;

    const returns = candles.slice(1).map((candle, i) => 
      Math.log(candle.close / candles[i].close)
    );

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ElliottWaveConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ElliottWaveConfig {
    return { ...this.config };
  }
}