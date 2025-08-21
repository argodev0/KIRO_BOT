/**
 * Signal Generation Demo
 * Demonstrates the multi-dimensional signal generation engine
 */

import { SignalEngine } from '../services/SignalEngine';
import { TechnicalAnalysisService } from '../services/TechnicalAnalysisService';
import { PatternRecognitionService } from '../services/PatternRecognitionService';
import { ElliottWaveService } from '../services/ElliottWaveService';
import { FibonacciService } from '../services/FibonacciService';
import { CandleData } from '../types/market';
import { AnalysisResults } from '../types/analysis';

// Demo logger
const logger = {
  info: (msg: string, data?: any) => console.log(`INFO: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg: string, data?: any) => console.error(`ERROR: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  warn: (msg: string, data?: any) => console.warn(`WARN: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
};

/**
 * Generate sample market data for demonstration
 */
function generateSampleCandles(symbol: string, count: number = 100): CandleData[] {
  const candles: CandleData[] = [];
  let basePrice = 50000;
  const startTime = Date.now() - (count * 3600000); // 1 hour intervals

  for (let i = 0; i < count; i++) {
    // Simulate price movement with some trend and volatility
    const trend = Math.sin(i / 20) * 0.001; // Slow trend component
    const volatility = (Math.random() - 0.5) * 0.02; // Random volatility
    const priceChange = trend + volatility;
    
    basePrice *= (1 + priceChange);
    
    const open = basePrice;
    const high = open * (1 + Math.random() * 0.01);
    const low = open * (1 - Math.random() * 0.01);
    const close = low + (high - low) * Math.random();
    const volume = 1000 + Math.random() * 2000;

    candles.push({
      symbol,
      timeframe: '1h',
      timestamp: startTime + (i * 3600000),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
}

/**
 * Perform comprehensive analysis on candle data
 */
async function performComprehensiveAnalysis(candles: CandleData[]): Promise<AnalysisResults> {
  const symbol = candles[0].symbol;
  
  // Initialize services
  const technicalService = new TechnicalAnalysisService();
  const elliottWaveService = new ElliottWaveService();
  const fibonacciService = new FibonacciService();

  logger.info('Performing comprehensive analysis', { symbol, candleCount: candles.length });

  // Technical analysis
  const technical = await technicalService.getCurrentIndicators(candles);
  logger.info('Technical analysis completed', {
    rsi: technical.rsi,
    trend: technical.trend,
    momentum: technical.momentum,
  });

  // Pattern recognition
  const patterns = await PatternRecognitionService.detectPatterns(candles);
  logger.info('Pattern recognition completed', {
    patternsFound: patterns.length,
    types: patterns.map(p => p.type),
  });

  // Elliott Wave analysis
  const elliottWave = await elliottWaveService.analyzeWaveStructure(candles);
  logger.info('Elliott Wave analysis completed', {
    waveCount: elliottWave.waveCount,
    currentWave: elliottWave.currentWave.type,
    validity: elliottWave.validity,
  });

  // Fibonacci analysis
  const high = Math.max(...candles.map(c => c.high));
  const low = Math.min(...candles.map(c => c.low));
  const fibonacci = fibonacciService.generateFibonacciAnalysis(
    high,
    low,
    candles[0].timestamp,
    candles[candles.length - 1].timestamp
  );
  logger.info('Fibonacci analysis completed', {
    confluenceZones: fibonacci.confluenceZones.length,
    retracementLevels: fibonacci.retracements.length,
  });

  // Market regime classification
  const marketRegime = await technicalService.classifyMarketRegime(candles);
  logger.info('Market regime classified', {
    type: marketRegime.type,
    strength: marketRegime.strength,
    confidence: marketRegime.confidence,
  });

  // Create volume profile (simplified)
  const volumeProfile = {
    volumeByPrice: [
      { price: (high + low) / 2, volume: 1000, percentage: 0.5 },
    ],
    poc: (high + low) / 2,
    valueAreaHigh: high * 0.95,
    valueAreaLow: low * 1.05,
    volumeTrend: 'increasing' as const,
    volumeStrength: 0.7,
  };

  return {
    symbol,
    timeframe: '1h',
    timestamp: Date.now(),
    technical,
    patterns,
    elliottWave,
    fibonacci,
    confluence: fibonacci.confluenceZones,
    marketRegime,
    volumeProfile,
  };
}

/**
 * Demonstrate signal generation with different configurations
 */
async function demonstrateSignalGeneration() {
  logger.info('=== Signal Generation Demo ===');

  // Generate sample data
  const symbol = 'BTCUSDT';
  const candles = generateSampleCandles(symbol, 100);
  logger.info('Generated sample candles', { symbol, count: candles.length });

  // Perform comprehensive analysis
  const analysisResults = await performComprehensiveAnalysis(candles);

  // Test 1: Default signal engine
  logger.info('\n--- Test 1: Default Configuration ---');
  const defaultEngine = new SignalEngine();
  const defaultSignal = await defaultEngine.generateSignal(symbol, analysisResults, candles);
  
  if (defaultSignal) {
    logger.info('Signal generated with default configuration', {
      direction: defaultSignal.direction,
      confidence: defaultSignal.confidence,
      entryPrice: defaultSignal.entryPrice,
      stopLoss: defaultSignal.stopLoss,
      takeProfit: defaultSignal.takeProfit,
      reasoning: defaultSignal.reasoning.summary,
    });
  } else {
    logger.info('No signal generated with default configuration');
  }

  // Test 2: Technical analysis focused
  logger.info('\n--- Test 2: Technical Analysis Focused ---');
  const technicalEngine = new SignalEngine({
    weights: {
      technical: 0.6,
      patterns: 0.1,
      elliottWave: 0.1,
      fibonacci: 0.1,
      volume: 0.1,
    },
    minConfidence: 0.5,
  });
  
  const technicalSignal = await technicalEngine.generateSignal(symbol, analysisResults, candles);
  
  if (technicalSignal) {
    logger.info('Signal generated with technical focus', {
      direction: technicalSignal.direction,
      confidence: technicalSignal.confidence,
      technicalScore: technicalSignal.technicalScore,
    });
  } else {
    logger.info('No signal generated with technical focus');
  }

  // Test 3: Elliott Wave focused
  logger.info('\n--- Test 3: Elliott Wave Focused ---');
  const waveEngine = new SignalEngine({
    weights: {
      technical: 0.2,
      patterns: 0.1,
      elliottWave: 0.5,
      fibonacci: 0.15,
      volume: 0.05,
    },
    minConfidence: 0.4,
  });
  
  const waveSignal = await waveEngine.generateSignal(symbol, analysisResults, candles);
  
  if (waveSignal) {
    logger.info('Signal generated with Elliott Wave focus', {
      direction: waveSignal.direction,
      confidence: waveSignal.confidence,
      elliottWaveScore: waveSignal.elliottWaveScore,
      currentWave: waveSignal.reasoning.elliottWave.currentWave,
    });
  } else {
    logger.info('No signal generated with Elliott Wave focus');
  }

  // Test 4: Signal filtering
  logger.info('\n--- Test 4: Signal Filtering ---');
  const signals = [defaultSignal, technicalSignal, waveSignal].filter(s => s !== null);
  
  if (signals.length > 0) {
    const highConfidenceFilter = [{
      minConfidence: 0.7,
      minConfluence: 0.6,
    }];
    
    const filteredSignals = defaultEngine.filterSignals(signals, highConfidenceFilter);
    logger.info('Filtered signals', {
      originalCount: signals.length,
      filteredCount: filteredSignals.length,
      filteredSignals: filteredSignals.map(s => ({
        direction: s.direction,
        confidence: s.confidence,
      })),
    });
  }

  // Test 5: Signal invalidation monitoring
  logger.info('\n--- Test 5: Signal Invalidation Monitoring ---');
  if (signals.length > 0) {
    // Simulate price movement that would invalidate signals
    const currentPrices = {
      [symbol]: candles[candles.length - 1].close * 0.95, // 5% drop
    };
    
    const invalidationAlerts = await defaultEngine.monitorSignalInvalidation(signals, currentPrices);
    
    if (invalidationAlerts.length > 0) {
      logger.info('Signal invalidation alerts', {
        alertCount: invalidationAlerts.length,
        alerts: invalidationAlerts.map(alert => ({
          symbol: alert.symbol,
          reason: alert.reason,
          currentPrice: alert.currentPrice,
        })),
      });
    } else {
      logger.info('No signal invalidations detected');
    }
  }

  // Test 6: Multi-timeframe validation
  logger.info('\n--- Test 6: Multi-timeframe Validation ---');
  if (defaultSignal) {
    // Create mock multi-timeframe analysis
    const multiTimeframeAnalysis = {
      symbol,
      timestamp: Date.now(),
      timeframes: {
        '15m': analysisResults,
        '1h': analysisResults,
        '4h': analysisResults,
      },
      consensus: {
        direction: defaultSignal.direction === 'long' ? 'bullish' as const : 'bearish' as const,
        strength: 0.8,
        confluence: 0.7,
      },
    };
    
    const validation = await defaultEngine.validateSignalAcrossTimeframes(
      defaultSignal,
      multiTimeframeAnalysis
    );
    
    logger.info('Multi-timeframe validation result', {
      isValid: validation.isValid,
      timeframeAlignment: validation.timeframeAlignment,
      adjustedConfidence: validation.confidence,
      warnings: validation.warnings,
    });
  }

  logger.info('\n=== Demo Complete ===');
}

/**
 * Demonstrate signal engine configuration updates
 */
async function demonstrateConfigurationUpdates() {
  logger.info('\n=== Configuration Update Demo ===');

  const engine = new SignalEngine();
  
  // Update weights
  logger.info('Updating signal engine weights');
  engine.updateConfiguration({
    weights: {
      technical: 0.4,
      patterns: 0.3,
      elliottWave: 0.2,
      fibonacci: 0.1,
      volume: 0.0,
    },
    minConfidence: 0.8,
  });

  // Update other options
  logger.info('Updating other configuration options');
  engine.updateConfiguration({
    requireStopLoss: false,
    maxSignalsPerSymbol: 5,
    timeframeConsensus: false,
  });

  logger.info('Configuration updates completed');
}

/**
 * Main demo function
 */
async function runDemo() {
  try {
    await demonstrateSignalGeneration();
    await demonstrateConfigurationUpdates();
  } catch (error) {
    logger.error('Demo failed', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export {
  generateSampleCandles,
  performComprehensiveAnalysis,
  demonstrateSignalGeneration,
  demonstrateConfigurationUpdates,
  runDemo,
};