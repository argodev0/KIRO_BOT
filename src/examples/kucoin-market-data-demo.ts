/**
 * KuCoin Market Data Service Demo
 * Demonstrates the KuCoin WebSocket service functionality with real-time data streaming
 */

import { KuCoinWebSocketService } from '../services/KuCoinWebSocketService';
import { UnifiedMarketDataService } from '../services/UnifiedMarketDataService';
import { logger } from '../utils/logger';

async function runKuCoinDemo() {
  console.log('🚀 Starting KuCoin Market Data Service Demo...\n');

  // Initialize KuCoin WebSocket service
  const kucoinService = new KuCoinWebSocketService({
    baseURL: 'https://api.kucoin.com',
    wsBaseURL: 'wss://ws-api-spot.kucoin.com',
    maxReconnectionAttempts: 5,
    reconnectionDelay: 1000,
    connectionTimeout: 10000,
    enableHeartbeat: true,
    majorTradingPairs: ['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'ADA-USDT'],
    defaultTimeframes: ['1min', '5min', '15min'],
    connectionPoolSize: 10,
  });

  // Set up event listeners
  kucoinService.on('started', () => {
    console.log('✅ KuCoin WebSocket Service started successfully');
  });

  kucoinService.on('stopped', () => {
    console.log('🛑 KuCoin WebSocket Service stopped');
  });

  kucoinService.on('streamConnected', (data) => {
    console.log(`🔗 Connected to KuCoin stream: ${data.topic}`);
  });

  kucoinService.on('streamDisconnected', (data) => {
    console.log(`🔌 Disconnected from KuCoin stream: ${data.topic} (${data.code}: ${data.reason})`);
  });

  kucoinService.on('ticker', (ticker) => {
    console.log(`📊 KuCoin Ticker - ${ticker.symbol}: $${ticker.price.toFixed(2)} (${ticker.changePercent24h.toFixed(2)}%)`);
  });

  kucoinService.on('orderbook', (orderbook) => {
    const bestBid = orderbook.bids[0];
    const bestAsk = orderbook.asks[0];
    console.log(`📈 KuCoin OrderBook - ${orderbook.symbol}: Bid $${bestBid[0].toFixed(2)} | Ask $${bestAsk[0].toFixed(2)}`);
  });

  kucoinService.on('trade', (trade) => {
    console.log(`💹 KuCoin Trade - ${trade.symbol}: ${trade.side.toUpperCase()} ${trade.quantity} @ $${trade.price.toFixed(2)}`);
  });

  kucoinService.on('candle', (candle) => {
    console.log(`🕯️ KuCoin Candle - ${candle.symbol} ${candle.timeframe}: O:$${candle.open.toFixed(2)} H:$${candle.high.toFixed(2)} L:$${candle.low.toFixed(2)} C:$${candle.close.toFixed(2)}`);
  });

  kucoinService.on('healthCheck', (data) => {
    if (data.isHealthy) {
      console.log('💚 KuCoin service health check: HEALTHY');
    } else {
      console.log('❤️ KuCoin service health check: UNHEALTHY');
    }
  });

  kucoinService.on('majorPairsSubscribed', (data) => {
    console.log(`🎯 Subscribed to ${data.totalSubscriptions} streams for ${data.pairs.length} major trading pairs`);
  });

  try {
    // Start the service
    await kucoinService.start();

    console.log('\n📡 Subscribing to individual streams...');
    
    // Subscribe to individual streams
    await kucoinService.subscribeToTicker('BTC-USDT');
    await kucoinService.subscribeToOrderBook('BTC-USDT');
    await kucoinService.subscribeToTrades('BTC-USDT');
    await kucoinService.subscribeToCandles('BTC-USDT', '1m');

    console.log('✅ Individual subscriptions completed');

    // Wait for some data
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🎯 Subscribing to major trading pairs...');
    
    // Subscribe to major trading pairs
    await kucoinService.subscribeToMajorTradingPairs();

    // Display connection statistics
    setInterval(() => {
      const stats = kucoinService.getConnectionStats();
      console.log('\n📊 Connection Statistics:');
      console.log(`   Total Connections: ${stats.totalConnections}`);
      console.log(`   Healthy Connections: ${stats.healthyConnections}`);
      console.log(`   Unhealthy Connections: ${stats.unhealthyConnections}`);
      console.log(`   Connection Pool Utilization: ${(stats.connectionPoolUtilization * 100).toFixed(1)}%`);
      console.log(`   Rate Limit Tokens Remaining: ${stats.rateLimitStatus.tokensRemaining}`);
      console.log(`   Subscriptions by Type:`, stats.subscriptionsByType);
      console.log(`   Service Health: ${kucoinService.isHealthy() ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
    }, 30000);

    // Let it run for 2 minutes
    console.log('\n⏰ Demo will run for 2 minutes...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Demo error:', error);
  } finally {
    console.log('\n🛑 Stopping KuCoin service...');
    await kucoinService.stop();
    console.log('✅ Demo completed');
  }
}

async function runUnifiedServiceDemo() {
  console.log('\n🌐 Starting Unified Market Data Service Demo...\n');

  // Initialize unified service with KuCoin only
  const unifiedService = new UnifiedMarketDataService({
    binance: { enabled: false },
    kucoin: { 
      enabled: true,
      config: {
        majorTradingPairs: ['BTC-USDT', 'ETH-USDT'],
        defaultTimeframes: ['1min', '5min'],
        connectionPoolSize: 5,
      }
    },
    defaultExchange: 'kucoin',
    aggregateData: true,
    cacheEnabled: true,
    cacheTimeout: 5000,
  });

  // Set up event listeners
  unifiedService.on('started', () => {
    console.log('✅ Unified Market Data Service started');
  });

  unifiedService.on('exchangeStarted', (exchange) => {
    console.log(`🔗 Exchange ${exchange} started`);
  });

  unifiedService.on('ticker', (data) => {
    console.log(`📊 Unified Ticker [${data.exchange}] - ${data.data.symbol}: $${data.data.price.toFixed(2)}`);
  });

  unifiedService.on('aggregatedTicker', (ticker) => {
    console.log(`🔄 Aggregated Ticker - ${ticker.symbol}: $${ticker.price.toFixed(2)} (Exchanges: ${ticker.exchanges.join(', ')})`);
    if (ticker.averagePrice) {
      console.log(`   Average Price: $${ticker.averagePrice.toFixed(2)}`);
    }
    if (ticker.priceSpread) {
      console.log(`   Price Spread: $${ticker.priceSpread.toFixed(2)}`);
    }
  });

  unifiedService.on('healthCheck', (data) => {
    console.log(`💚 Health Check [${data.exchange}]: ${data.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  });

  try {
    // Start the unified service
    await unifiedService.start();

    console.log('\n📡 Subscribing to unified streams...');
    
    // Subscribe to data through unified interface
    await unifiedService.subscribeToTicker('BTCUSDT'); // Will be normalized to BTC-USDT for KuCoin
    await unifiedService.subscribeToOrderBook('ETHUSDT'); // Will be normalized to ETH-USDT for KuCoin

    console.log('✅ Unified subscriptions completed');

    // Display statistics
    setInterval(() => {
      const stats = unifiedService.getConnectionStats();
      console.log('\n📊 Unified Service Statistics:');
      console.log(`   Enabled Exchanges: ${unifiedService.getEnabledExchanges().join(', ')}`);
      console.log(`   Total Connections: ${stats.totalConnections}`);
      console.log(`   Healthy Connections: ${stats.healthyConnections}`);
      console.log(`   Overall Health: ${stats.overallHealth ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
      
      if (stats.kucoin) {
        console.log(`   KuCoin Connections: ${stats.kucoin.totalConnections}`);
      }

      // Test cache functionality
      const cachedTicker = unifiedService.getAggregatedTicker('BTCUSDT');
      if (cachedTicker) {
        console.log(`   Cached BTC Ticker: $${cachedTicker.price.toFixed(2)}`);
      }
    }, 30000);

    // Let it run for 1 minute
    console.log('\n⏰ Unified demo will run for 1 minute...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Unified demo error:', error);
  } finally {
    console.log('\n🛑 Stopping unified service...');
    await unifiedService.stop();
    console.log('✅ Unified demo completed');
  }
}

// Main demo function
async function main() {
  try {
    console.log('🎬 KuCoin Market Data Service Demo Starting...\n');
    
    // Run KuCoin service demo
    await runKuCoinDemo();
    
    // Wait a bit between demos
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run unified service demo
    await runUnifiedServiceDemo();
    
    console.log('\n🎉 All demos completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the demo if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { runKuCoinDemo, runUnifiedServiceDemo };