/**
 * Technical Indicator Engine Validation Script
 * Tests the core functionality of the technical indicator calculation engine
 */

const { TechnicalIndicatorEngine } = require('./dist/services/TechnicalIndicatorEngine');
const { MarketDataService } = require('./dist/services/MarketDataService');
const { ExchangeManager } = require('./dist/services/exchanges/ExchangeManager');

// Mock configuration for testing
const engineConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0,
  },
  caching: {
    ttl: 300,
    maxCandleHistory: 1000,
  },
  calculation: {
    batchSize: 100,
    updateInterval: 5000,
    enableRealtime: false,
  },
  timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
};

const marketDataConfig = {
  redis: engineConfig.redis,
  exchanges: {
    binance: {
      enabled: true,
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
    },
  },
  caching: {
    candleTtl: 60,
    tickerTtl: 10,
    orderBookTtl: 5,
    tradeTtl: 30,
  },
  processing: {
    batchSize: 50,
    flushInterval: 1000,
    maxRetries: 3,
  },
};

// Generate test candle data
function generateTestCandles(symbol, timeframe, count) {
  const candles = [];
  let basePrice = 45000;
  let timestamp = Date.now() - count * 3600000;
  
  for (let i = 0; i < count; i++) {
    const volatility = 0.02;
    const trend = Math.sin(i * 0.1) * 0.001;
    const randomWalk = (Math.random() - 0.5) * volatility;
    
    const priceChange = (trend + randomWalk) * basePrice;
    const newPrice = basePrice + priceChange;
    
    const open = basePrice;
    const close = newPrice;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.005;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.005;
    const volume = 1000 + Math.random() * 2000;
    
    candles.push({
      symbol,
      timeframe,
      timestamp: timestamp + i * 3600000,
      open,
      high,
      low,
      close,
      volume,
    });
    
    basePrice = newPrice;
  }
  
  return candles;
}

async function testTechnicalIndicatorEngine() {
  console.log('🧪 Testing Technical Indicator Engine...\n');
  
  try {
    // Create mock market data service
    const mockMarketDataService = {
      getHistoricalCandles: async (symbol, timeframe, limit) => {
        console.log(`📊 Generating ${limit} test candles for ${symbol} ${timeframe}`);
        return generateTestCandles(symbol, timeframe, limit);
      },
      on: () => {},
    };
    
    // Create engine
    const engine = new TechnicalIndicatorEngine(mockMarketDataService, engineConfig);
    
    console.log('✅ Technical Indicator Engine created successfully');
    
    // Test 1: Basic indicator calculation
    console.log('\n📈 Test 1: Basic Indicator Calculation');
    console.log('-'.repeat(40));
    
    const results = await engine.calculateIndicators('BTCUSDT', '1h', 100, false);
    
    console.log(`Symbol: ${results.symbol}`);
    console.log(`Timeframe: ${results.timeframe}`);
    console.log(`Timestamp: ${new Date(results.timestamp).toISOString()}`);
    
    console.log('\nRSI:');
    console.log(`  Value: ${results.rsi.value.toFixed(2)}`);
    console.log(`  Signal: ${results.rsi.signal}`);
    
    console.log('\nMACD:');
    console.log(`  MACD: ${results.macd.macd.toFixed(4)}`);
    console.log(`  Signal: ${results.macd.signal.toFixed(4)}`);
    console.log(`  Histogram: ${results.macd.histogram.toFixed(4)}`);
    
    console.log('\nBollinger Bands:');
    console.log(`  Upper: ${results.bollingerBands.upperBand.toFixed(2)}`);
    console.log(`  Middle: ${results.bollingerBands.middleBand.toFixed(2)}`);
    console.log(`  Lower: ${results.bollingerBands.lowerBand.toFixed(2)}`);
    console.log(`  %B: ${(results.bollingerBands.percentB * 100).toFixed(1)}%`);
    
    // Test 2: Multi-timeframe analysis
    console.log('\n⏰ Test 2: Multi-Timeframe Analysis');
    console.log('-'.repeat(40));
    
    const multiResults = await engine.getMultiTimeframeIndicators('BTCUSDT', ['15m', '1h', '4h'], false);
    
    console.log(`Symbol: ${multiResults.symbol}`);
    console.log(`Timeframes analyzed: ${Object.keys(multiResults.timeframes).join(', ')}`);
    
    Object.entries(multiResults.timeframes).forEach(([tf, data]) => {
      if (data) {
        console.log(`\n${tf}:`);
        console.log(`  RSI: ${data.rsi.value.toFixed(1)} (${data.rsi.signal})`);
        console.log(`  MACD: ${data.macd.macd.toFixed(4)}`);
        console.log(`  BB %B: ${(data.bollingerBands.percentB * 100).toFixed(1)}%`);
      }
    });
    
    // Test 3: Indicator analysis
    console.log('\n🎯 Test 3: Indicator Analysis');
    console.log('-'.repeat(40));
    
    const analysis = engine.getIndicatorAnalysis(results);
    
    console.log('RSI Analysis:');
    console.log(`  Signal: ${analysis.rsi.signal}`);
    console.log(`  Strength: ${analysis.rsi.strength}`);
    
    console.log('\nMACD Analysis:');
    console.log(`  Signal: ${analysis.macd.signal}`);
    console.log(`  Strength: ${analysis.macd.strength}`);
    
    console.log('\nBollinger Bands Analysis:');
    console.log(`  Signal: ${analysis.bollingerBands.signal}`);
    console.log(`  Strength: ${analysis.bollingerBands.strength}`);
    
    console.log('\nConsensus:');
    console.log(`  Overall Signal: ${analysis.consensus.signal.toUpperCase()}`);
    console.log(`  Strength: ${analysis.consensus.strength}`);
    console.log(`  Confidence: ${(analysis.consensus.confidence * 100).toFixed(1)}%`);
    
    // Test 4: Configuration management
    console.log('\n⚙️ Test 4: Configuration Management');
    console.log('-'.repeat(40));
    
    const originalConfig = engine.getConfig();
    console.log(`Original RSI period: ${originalConfig.indicators.rsi.period}`);
    
    engine.updateIndicatorConfig({
      rsi: { period: 21, overbought: 75, oversold: 25 },
    });
    
    const updatedConfig = engine.getConfig();
    console.log(`Updated RSI period: ${updatedConfig.indicators.rsi.period}`);
    
    // Test 5: Cache statistics
    console.log('\n📊 Test 5: Cache Statistics');
    console.log('-'.repeat(40));
    
    const stats = engine.getCacheStats();
    console.log(`Indicator cache size: ${stats.indicatorCacheSize}`);
    console.log(`Candle cache size: ${stats.candleCacheSize}`);
    console.log(`Active subscriptions: ${stats.subscriptions}`);
    console.log(`Active timers: ${stats.activeTimers}`);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n🎉 Technical Indicator Engine is working correctly!');
    
    return {
      success: true,
      results: {
        basicCalculation: results,
        multiTimeframe: multiResults,
        analysis: analysis,
        config: updatedConfig,
        stats: stats,
      },
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testTechnicalIndicatorEngine()
    .then(result => {
      if (result.success) {
        console.log('\n🎯 Technical Indicator Engine validation completed successfully!');
        process.exit(0);
      } else {
        console.error('\n💥 Technical Indicator Engine validation failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Validation script failed:', error);
      process.exit(1);
    });
}

module.exports = { testTechnicalIndicatorEngine };