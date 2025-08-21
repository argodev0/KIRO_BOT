/**
 * Basic Signal Engine Demo
 * Simple demonstration of the signal generation engine without database dependencies
 */

import { SignalEngine } from '../services/SignalEngine';
import { CandleData } from '../types/market';
import { AnalysisResults, TechnicalIndicators, WaveStructure, FibonacciLevels, VolumeProfile } from '../types/analysis';

// Demo logger
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  warn: (msg: string, data?: any) => console.warn(`WARN: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
};

/**
 * Create mock analysis results for demonstration
 */
function createMockAnalysisResults(scenario: 'bullish' | 'bearish' | 'neutral'): AnalysisResults {
  const technical: TechnicalIndicators = {
    rsi: scenario === 'bullish' ? 25 : scenario === 'bearish' ? 75 : 50,
    waveTrend: {
      wt1: scenario === 'bullish' ? -60 : scenario === 'bearish' ? 60 : 0,
      wt2: scenario === 'bullish' ? -50 : scenario === 'bearish' ? 50 : 0,
      signal: scenario === 'bullish' ? 'buy' : scenario === 'bearish' ? 'sell' : 'neutral',
    },
    pvt: scenario === 'bullish' ? 1000 : scenario === 'bearish' ? -1000 : 0,
    supportLevels: [49000, 48000],
    resistanceLevels: [51000, 52000],
    trend: scenario === 'bullish' ? 'bullish' : scenario === 'bearish' ? 'bearish' : 'sideways',
    momentum: scenario === 'neutral' ? 'weak' : 'strong',
    volatility: 0.02,
  };

  const patterns = scenario === 'neutral' ? [] : [
    {
      type: scenario === 'bullish' ? 'hammer' as const : 'shooting_star' as const,
      confidence: 0.8,
      startIndex: 10,
      endIndex: 10,
      direction: scenario === 'bullish' ? 'bullish' as const : 'bearish' as const,
      strength: 'strong' as const,
      description: `${scenario === 'bullish' ? 'Hammer' : 'Shooting star'} pattern`,
      reliability: 0.8,
    },
  ];

  const elliottWave: WaveStructure = {
    waves: [],
    currentWave: {
      id: scenario === 'bullish' ? 'wave_3' : 'wave_a',
      type: scenario === 'bullish' ? 'wave_3' : 'wave_a',
      degree: 'minor',
      startPrice: 48000,
      endPrice: 52000,
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      length: 4000,
      duration: 3600000,
    },
    waveCount: scenario === 'bullish' ? 3 : 1,
    degree: 'minor',
    validity: scenario === 'neutral' ? 0.3 : 0.8,
    nextTargets: scenario === 'neutral' ? [] : [
      {
        price: scenario === 'bullish' ? 55000 : 45000,
        probability: 0.8,
        type: 'fibonacci_extension',
        description: '1.618 extension',
      },
    ],
    invalidationLevel: scenario === 'bullish' ? 47000 : 53000,
  };

  const fibonacci: FibonacciLevels = {
    retracements: [
      { ratio: 0.618, price: 49200, type: 'retracement', strength: 0.8, description: '61.8% retracement' },
    ],
    extensions: [
      { ratio: 1.618, price: 54400, type: 'extension', strength: 0.8, description: '161.8% extension' },
    ],
    timeProjections: [],
    confluenceZones: scenario === 'neutral' ? [] : [
      {
        priceLevel: scenario === 'bullish' ? 55000 : 45000,
        strength: 0.9,
        factors: [
          { type: 'fibonacci', description: '161.8% extension', weight: 0.9 },
        ],
        type: scenario === 'bullish' ? 'resistance' : 'support',
        reliability: 0.9,
      },
    ],
    highPrice: 52000,
    lowPrice: 48000,
    swingHigh: 52000,
    swingLow: 48000,
  };

  const volumeProfile: VolumeProfile = {
    volumeByPrice: [
      { price: 50000, volume: 1000, percentage: 0.5 },
      { price: 50500, volume: 800, percentage: 0.3 },
      { price: 49500, volume: 400, percentage: 0.2 },
    ],
    poc: 50000,
    valueAreaHigh: 50500,
    valueAreaLow: 49500,
    volumeTrend: scenario === 'bullish' ? 'increasing' : scenario === 'bearish' ? 'decreasing' : 'stable',
    volumeStrength: scenario === 'neutral' ? 0.3 : 0.7,
  };

  return {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    timestamp: Date.now(),
    technical,
    patterns,
    elliottWave,
    fibonacci,
    confluence: fibonacci.confluenceZones,
    marketRegime: {
      type: scenario === 'neutral' ? 'ranging' : 'trending',
      strength: scenario === 'neutral' ? 0.4 : 0.8,
      duration: 1000,
      volatility: 'medium',
      volume: 'medium',
      confidence: scenario === 'neutral' ? 0.5 : 0.8,
    },
    volumeProfile,
  };
}

/**
 * Create mock candle data
 */
function createMockCandles(): CandleData[] {
  const candles: CandleData[] = [];
  let basePrice = 50000;
  
  for (let i = 0; i < 20; i++) {
    const price = basePrice + (Math.random() - 0.5) * 1000;
    candles.push({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: Date.now() - (20 - i) * 3600000,
      open: price,
      high: price + Math.random() * 500,
      low: price - Math.random() * 500,
      close: price + (Math.random() - 0.5) * 200,
      volume: 1000 + Math.random() * 500,
    });
  }
  
  return candles;
}

/**
 * Main demo function
 */
async function runBasicDemo() {
  logger.info('=== Signal Engine Basic Demo ===');

  const symbol = 'BTCUSDT';
  const candles = createMockCandles();

  // Test 1: Bullish scenario
  logger.info('\n--- Test 1: Bullish Scenario ---');
  const bullishAnalysis = createMockAnalysisResults('bullish');
  const defaultEngine = new SignalEngine();
  
  const bullishSignal = await defaultEngine.generateSignal(symbol, bullishAnalysis, candles);
  
  if (bullishSignal) {
    logger.info('Bullish signal generated', {
      direction: bullishSignal.direction,
      confidence: bullishSignal.confidence.toFixed(3),
      entryPrice: bullishSignal.entryPrice,
      stopLoss: bullishSignal.stopLoss,
      takeProfit: bullishSignal.takeProfit,
      componentScores: {
        technical: bullishSignal.technicalScore?.toFixed(3),
        pattern: bullishSignal.patternScore?.toFixed(3),
        elliottWave: bullishSignal.elliottWaveScore?.toFixed(3),
        fibonacci: bullishSignal.fibonacciScore?.toFixed(3),
        volume: bullishSignal.volumeScore?.toFixed(3),
      },
      reasoning: bullishSignal.reasoning.summary,
    });
  } else {
    logger.info('No bullish signal generated');
  }

  // Test 2: Bearish scenario
  logger.info('\n--- Test 2: Bearish Scenario ---');
  const bearishAnalysis = createMockAnalysisResults('bearish');
  
  const bearishSignal = await defaultEngine.generateSignal(symbol, bearishAnalysis, candles);
  
  if (bearishSignal) {
    logger.info('Bearish signal generated', {
      direction: bearishSignal.direction,
      confidence: bearishSignal.confidence.toFixed(3),
      entryPrice: bearishSignal.entryPrice,
      stopLoss: bearishSignal.stopLoss,
      takeProfit: bearishSignal.takeProfit,
      componentScores: {
        technical: bearishSignal.technicalScore?.toFixed(3),
        pattern: bearishSignal.patternScore?.toFixed(3),
        elliottWave: bearishSignal.elliottWaveScore?.toFixed(3),
        fibonacci: bearishSignal.fibonacciScore?.toFixed(3),
        volume: bearishSignal.volumeScore?.toFixed(3),
      },
      reasoning: bearishSignal.reasoning.summary,
    });
  } else {
    logger.info('No bearish signal generated');
  }

  // Test 3: Neutral scenario (should not generate signal)
  logger.info('\n--- Test 3: Neutral Scenario ---');
  const neutralAnalysis = createMockAnalysisResults('neutral');
  
  const neutralSignal = await defaultEngine.generateSignal(symbol, neutralAnalysis, candles);
  
  if (neutralSignal) {
    logger.info('Neutral signal generated (unexpected)', {
      direction: neutralSignal.direction,
      confidence: neutralSignal.confidence.toFixed(3),
    });
  } else {
    logger.info('No signal generated for neutral scenario (expected)');
  }

  // Test 4: Custom weights
  logger.info('\n--- Test 4: Custom Weights (Technical Focus) ---');
  const technicalEngine = new SignalEngine({
    weights: {
      technical: 0.7,
      patterns: 0.1,
      elliottWave: 0.1,
      fibonacci: 0.05,
      volume: 0.05,
    },
    minConfidence: 0.5,
  });
  
  const technicalSignal = await technicalEngine.generateSignal(symbol, bullishAnalysis, candles);
  
  if (technicalSignal) {
    logger.info('Technical-focused signal generated', {
      direction: technicalSignal.direction,
      confidence: technicalSignal.confidence.toFixed(3),
      technicalScore: technicalSignal.technicalScore?.toFixed(3),
      reasoning: technicalSignal.reasoning.summary,
    });
  } else {
    logger.info('No technical-focused signal generated');
  }

  // Test 5: Signal filtering
  logger.info('\n--- Test 5: Signal Filtering ---');
  const signals = [bullishSignal, bearishSignal, technicalSignal].filter(s => s !== null);
  
  if (signals.length > 0) {
    logger.info('Original signals', {
      count: signals.length,
      signals: signals.map(s => ({
        direction: s.direction,
        confidence: s.confidence.toFixed(3),
      })),
    });

    const highConfidenceFilter = [{
      minConfidence: 0.7,
      minConfluence: 0,
    }];
    
    const filteredSignals = defaultEngine.filterSignals(signals, highConfidenceFilter);
    logger.info('Filtered signals (min confidence 0.7)', {
      count: filteredSignals.length,
      signals: filteredSignals.map(s => ({
        direction: s.direction,
        confidence: s.confidence.toFixed(3),
      })),
    });
  }

  // Test 6: Configuration updates
  logger.info('\n--- Test 6: Configuration Updates ---');
  defaultEngine.updateConfiguration({
    weights: {
      technical: 0.4,
      patterns: 0.3,
      elliottWave: 0.2,
      fibonacci: 0.1,
      volume: 0.0,
    },
    minConfidence: 0.8,
  });
  logger.info('Configuration updated successfully');

  logger.info('\n=== Demo Complete ===');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runBasicDemo().catch(console.error);
}

export { runBasicDemo, createMockAnalysisResults, createMockCandles };