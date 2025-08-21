/**
 * Analysis Types and Interfaces
 * Core data structures for technical analysis, patterns, and indicators
 */

import { CandleData } from './market';

// Technical analysis results
export interface AnalysisResults {
  symbol: string;
  timeframe: string;
  timestamp: number;
  technical: TechnicalIndicators;
  patterns: CandlestickPattern[];
  elliottWave: WaveStructure;
  fibonacci: FibonacciLevels;
  confluence: ConfluenceZone[];
  marketRegime: MarketRegime;
  volumeProfile: VolumeProfile;
}

// Technical indicators
export interface TechnicalIndicators {
  rsi: number;
  waveTrend: WaveTrendData;
  pvt: number;
  supportLevels: number[];
  resistanceLevels: number[];
  trend: 'bullish' | 'bearish' | 'sideways';
  momentum: 'strong' | 'weak' | 'neutral';
  volatility: number;
}

export interface WaveTrendData {
  wt1: number;
  wt2: number;
  signal: 'buy' | 'sell' | 'neutral';
  divergence?: 'bullish' | 'bearish' | null;
}

// Candlestick patterns
export interface CandlestickPattern {
  type: PatternType;
  confidence: number;
  startIndex: number;
  endIndex: number;
  direction: 'bullish' | 'bearish';
  strength: 'weak' | 'moderate' | 'strong';
  description: string;
  reliability: number;
}

export type PatternType = 
  // Reversal patterns
  | 'doji' | 'hammer' | 'hanging_man' | 'shooting_star' | 'inverted_hammer'
  | 'engulfing_bullish' | 'engulfing_bearish' | 'harami_bullish' | 'harami_bearish'
  | 'morning_star' | 'evening_star' | 'piercing_line' | 'dark_cloud_cover'
  // Continuation patterns
  | 'spinning_top' | 'marubozu_bullish' | 'marubozu_bearish'
  | 'three_white_soldiers' | 'three_black_crows'
  // Indecision patterns
  | 'long_legged_doji' | 'dragonfly_doji' | 'gravestone_doji';

// Elliott Wave analysis
export interface WaveStructure {
  waves: Wave[];
  currentWave: Wave;
  waveCount: number;
  degree: WaveDegree;
  validity: number;
  nextTargets: WaveTarget[];
  invalidationLevel: number;
}

export interface Wave {
  id: string;
  type: WaveType;
  degree: WaveDegree;
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
  length: number;
  duration: number;
  fibonacciRatio?: number;
}

export type WaveType = 
  // Impulse waves
  | 'wave_1' | 'wave_2' | 'wave_3' | 'wave_4' | 'wave_5'
  // Corrective waves
  | 'wave_a' | 'wave_b' | 'wave_c'
  // Complex corrections
  | 'wave_w' | 'wave_x' | 'wave_y' | 'wave_z';

export type WaveDegree = 
  | 'subminuette' | 'minuette' | 'minute' | 'minor' | 'intermediate' 
  | 'primary' | 'cycle' | 'supercycle' | 'grand_supercycle';

export interface WaveTarget {
  price: number;
  probability: number;
  type: 'fibonacci_extension' | 'fibonacci_retracement' | 'wave_equality' | 'channel_projection';
  description: string;
}

// Fibonacci analysis
export interface FibonacciLevels {
  retracements: FibonacciLevel[];
  extensions: FibonacciLevel[];
  timeProjections: TimeFibonacci[];
  confluenceZones: ConfluenceZone[];
  highPrice: number;
  lowPrice: number;
  swingHigh: number;
  swingLow: number;
}

export interface FibonacciLevel {
  ratio: number;
  price: number;
  type: 'retracement' | 'extension';
  strength: number;
  description: string;
}

export interface TimeFibonacci {
  ratio: number;
  timestamp: number;
  description: string;
}

export interface ConfluenceZone {
  priceLevel: number;
  strength: number;
  factors: ConfluenceFactor[];
  type: 'support' | 'resistance' | 'reversal';
  reliability: number;
}

export interface ConfluenceFactor {
  type: 'fibonacci' | 'support_resistance' | 'elliott_wave' | 'pattern' | 'indicator';
  description: string;
  weight: number;
}

// Support and Resistance levels
export interface SupportResistanceLevel {
  price: number;
  strength: number;
  type: 'support' | 'resistance';
  touches: number;
  lastTouch: number;
}

// Market regime analysis
export interface MarketRegime {
  type: 'trending' | 'ranging' | 'breakout' | 'reversal';
  strength: number;
  duration: number;
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'medium' | 'high';
  confidence: number;
}

// Volume analysis
export interface VolumeProfile {
  volumeByPrice: VolumeNode[];
  poc: number; // Point of Control
  valueAreaHigh: number;
  valueAreaLow: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  volumeStrength: number;
}

export interface VolumeNode {
  price: number;
  volume: number;
  percentage: number;
}

// Multi-timeframe analysis
export interface MultiTimeframeAnalysis {
  symbol: string;
  timestamp: number;
  timeframes: {
    [key: string]: AnalysisResults;
  };
  consensus: {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    confluence: number;
  };
}

// Signal generation
export interface SignalFilter {
  minConfidence: number;
  requiredPatterns?: PatternType[];
  requiredIndicators?: string[];
  minConfluence: number;
  timeframes?: string[];
}

// Analysis configuration
export interface AnalysisConfig {
  indicators: {
    rsi: { period: number; overbought: number; oversold: number };
    waveTrend: { n1: number; n2: number };
    pvt: { period: number };
  };
  patterns: {
    minBodySize: number;
    minWickRatio: number;
    lookbackPeriod: number;
  };
  elliottWave: {
    minWaveLength: number;
    maxWaveLength: number;
    fibonacciTolerance: number;
  };
  fibonacci: {
    levels: number[];
    confluenceDistance: number;
  };
}