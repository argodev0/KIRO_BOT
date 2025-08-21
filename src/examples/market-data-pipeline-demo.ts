/**
 * Market Data Pipeline Demo
 * Demonstrates the complete market data ingestion and processing pipeline
 */

import { DataProcessingPipeline, PipelineConfig } from '../services/DataProcessingPipeline';
import { ExchangeManager } from '../services/exchanges/ExchangeManager';
import { CandleData, TickerData, OrderBookData, TradeData } from '../types/market';

// Mock configuration for demo purposes
const config: PipelineConfig = {
  marketData: {
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
    },
    exchanges: {
      binance: {
        enabled: true,
        symbols: ['BTCUSDT', 'ETHUSDT'],
        timeframes: ['1m', '5m', '15m', '1h'],
      },
    },
    caching: {
      candleTtl: 3600,
      tickerTtl: 60,
      orderBookTtl: 30,
      tradeTtl: 300,
    },
    processing: {
      batchSize: 100,
      flushInterval: 5000,
      maxRetries: 3,
    },
  },
  processing: {
    batchSize: 50,
    processingInterval: 1000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  quality: {
    minValidationRate: 95,
    maxErrorRate: 5,
    alertThresholds: {
      dataLag: 10000,
      validationFailures: 10,
      processingErrors: 5,
    },
  },
};

async function demonstrateMarketDataPipeline() {
  console.log('🚀 Starting Market Data Pipeline Demo...\n');

  // Create exchange manager (mocked for demo)
  const exchangeManager = new ExchangeManager({
    exchanges: {
      binance: {
        enabled: true,
        apiKey: 'demo-key',
        apiSecret: 'demo-secret',
        sandbox: true,
      },
    },
  });

  // Create pipeline
  const pipeline = new DataProcessingPipeline(exchangeManager, config);

  // Set up event listeners
  pipeline.on('started', () => {
    console.log('✅ Pipeline started successfully');
  });

  pipeline.on('dataProcessed', (event) => {
    console.log(`📊 Processed ${event.type} data for ${event.data.symbol}`);
  });

  pipeline.on('validationError', (event) => {
    console.log(`❌ Validation error for ${event.type}: ${event.data.symbol}`);
  });

  pipeline.on('aggregatedCandle', (candle) => {
    console.log(`📈 Aggregated ${candle.timeframe} candle for ${candle.symbol}: ${candle.close}`);
  });

  try {
    // Start the pipeline (this would normally connect to real exchanges)
    // await pipeline.start();

    console.log('📋 Demo Data Processing:\n');

    // Simulate processing various types of market data
    const sampleData = generateSampleMarketData();

    for (const item of sampleData) {
      const result = await pipeline.processMarketData(item.data, item.type);
      console.log(`${result ? '✅' : '❌'} ${item.type.toUpperCase()}: ${item.data.symbol} - ${result ? 'Valid' : 'Invalid'}`);
    }

    // Display metrics
    console.log('\n📊 Pipeline Metrics:');
    const metrics = pipeline.getMetrics();
    console.log(`- Processed Candles: ${metrics.processed.candles}`);
    console.log(`- Processed Tickers: ${metrics.processed.tickers}`);
    console.log(`- Processed Order Books: ${metrics.processed.orderBooks}`);
    console.log(`- Processed Trades: ${metrics.processed.trades}`);
    console.log(`- Validation Errors: ${metrics.errors.validation}`);
    console.log(`- Processing Errors: ${metrics.errors.processing}`);
    console.log(`- Validation Rate: ${metrics.quality.validationRate.toFixed(2)}%`);
    console.log(`- Error Rate: ${metrics.quality.errorRate.toFixed(2)}%`);

    // Demonstrate bulk processing
    console.log('\n📦 Bulk Processing Demo:');
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    const timeframes = ['1m', '5m'] as const;
    const startTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    const endTime = Date.now();

    // This would normally fetch from exchanges
    console.log(`Simulating bulk fetch for ${symbols.length} symbols, ${timeframes.length} timeframes...`);

    // Health check
    console.log('\n🏥 Health Check:');
    const health = await pipeline.healthCheck();
    console.log(`Status: ${health.status}`);
    console.log('Checks:', health.checks);

    // Data quality report
    console.log('\n📋 Data Quality Report:');
    // This would normally assess real data quality
    console.log('Simulating quality assessment...');
    console.log('- Completeness: 95.5%');
    console.log('- Consistency: 98.2%');
    console.log('- Freshness: 92.1%');
    console.log('- Overall Score: 95.3%');

    console.log('\n✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean up
    await pipeline.stop();
    console.log('🛑 Pipeline stopped');
  }
}

function generateSampleMarketData(): Array<{ data: any; type: string }> {
  const now = Date.now();
  
  return [
    // Valid candle data
    {
      type: 'candle',
      data: {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: now,
        open: 50000,
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      } as CandleData,
    },
    
    // Invalid candle data (negative price)
    {
      type: 'candle',
      data: {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: now,
        open: -50000, // Invalid
        high: 50100,
        low: 49900,
        close: 50050,
        volume: 1.5,
        exchange: 'binance',
      } as CandleData,
    },
    
    // Valid ticker data
    {
      type: 'ticker',
      data: {
        symbol: 'ETHUSDT',
        exchange: 'binance',
        price: 3000,
        volume: 500,
        timestamp: now,
        bid: 2995,
        ask: 3005,
      } as TickerData,
    },
    
    // Invalid ticker data (crossed market)
    {
      type: 'ticker',
      data: {
        symbol: 'ETHUSDT',
        exchange: 'binance',
        price: 3000,
        volume: 500,
        timestamp: now,
        bid: 3010, // Bid higher than ask
        ask: 3005,
      } as TickerData,
    },
    
    // Valid order book data
    {
      type: 'orderbook',
      data: {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        timestamp: now,
        bids: [
          [49995, 1.5],
          [49990, 2.0],
        ],
        asks: [
          [50005, 1.2],
          [50010, 1.8],
        ],
      } as OrderBookData,
    },
    
    // Valid trade data
    {
      type: 'trade',
      data: {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        timestamp: now,
        price: 50000,
        quantity: 1.5,
        side: 'buy',
        tradeId: '12345',
      } as TradeData,
    },
    
    // More valid candles for aggregation demo
    {
      type: 'candle',
      data: {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: now + 60000,
        open: 50050,
        high: 50150,
        low: 49950,
        close: 50100,
        volume: 1.8,
        exchange: 'binance',
      } as CandleData,
    },
    
    {
      type: 'candle',
      data: {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: now + 120000,
        open: 50100,
        high: 50200,
        low: 50000,
        close: 50150,
        volume: 2.1,
        exchange: 'binance',
      } as CandleData,
    },
  ];
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateMarketDataPipeline().catch(console.error);
}

export { demonstrateMarketDataPipeline };