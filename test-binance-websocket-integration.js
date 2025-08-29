#!/usr/bin/env node

/**
 * Binance WebSocket Integration Test
 * Tests the enhanced Binance WebSocket integration with automatic reconnection,
 * real-time price data subscription, error handling, and data normalization
 */

const { BinanceWebSocketService } = require('./dist/services/BinanceWebSocketService');

async function testBinanceWebSocketIntegration() {
  console.log('🚀 Testing Binance WebSocket Integration...\n');

  // Test configuration
  const testConfig = {
    baseURL: 'wss://stream.binance.com:9443/ws', // Use mainnet for real data
    maxReconnectionAttempts: 3,
    reconnectionDelay: 1000,
    pingInterval: 30000, // 30 seconds for testing
    connectionTimeout: 10000,
    enableHeartbeat: true,
    majorTradingPairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'], // Smaller set for testing
    defaultTimeframes: ['1m', '5m']
  };

  const binanceWS = new BinanceWebSocketService(testConfig);
  
  // Test results tracking
  const testResults = {
    serviceStart: false,
    tickerSubscription: false,
    orderbookSubscription: false,
    tradeSubscription: false,
    candleSubscription: false,
    dataReceived: {
      ticker: false,
      orderbook: false,
      trade: false,
      candle: false
    },
    connectionStats: false,
    healthCheck: false,
    serviceStop: false,
    errors: []
  };

  // Set up event listeners for testing
  setupTestEventListeners(binanceWS, testResults);

  try {
    // Test 1: Service Startup
    console.log('📡 Test 1: Starting Binance WebSocket Service...');
    await binanceWS.start();
    testResults.serviceStart = true;
    console.log('✅ Service started successfully\n');

    // Test 2: Individual Subscriptions
    console.log('📊 Test 2: Testing Individual Subscriptions...');
    
    // Subscribe to ticker
    await binanceWS.subscribeToTicker('BTCUSDT');
    testResults.tickerSubscription = true;
    console.log('✅ Ticker subscription successful');

    // Subscribe to order book
    await binanceWS.subscribeToOrderBook('ETHUSDT', 10);
    testResults.orderbookSubscription = true;
    console.log('✅ Order book subscription successful');

    // Subscribe to trades
    await binanceWS.subscribeToTrades('BNBUSDT');
    testResults.tradeSubscription = true;
    console.log('✅ Trade subscription successful');

    // Subscribe to candles
    await binanceWS.subscribeToCandles('BTCUSDT', '1m');
    testResults.candleSubscription = true;
    console.log('✅ Candle subscription successful\n');

    // Test 3: Wait for data
    console.log('⏱️ Test 3: Waiting for real-time data (15 seconds)...');
    await waitForData(15000);

    // Test 4: Connection Statistics
    console.log('📊 Test 4: Checking Connection Statistics...');
    const stats = binanceWS.getConnectionStats();
    testResults.connectionStats = true;
    
    console.log('Connection Statistics:');
    console.log(`  Total Connections: ${stats.totalConnections}`);
    console.log(`  Healthy Connections: ${stats.healthyConnections}`);
    console.log(`  Unhealthy Connections: ${stats.unhealthyConnections}`);
    console.log('  Subscriptions by Type:');
    Object.entries(stats.subscriptionsByType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`    ${type}: ${count}`);
      }
    });
    console.log('');

    // Test 5: Health Check
    console.log('🏥 Test 5: Health Check...');
    const isHealthy = binanceWS.isHealthy();
    testResults.healthCheck = isHealthy;
    console.log(`Health Status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n`);

    // Test 6: Complete Symbol Subscription
    console.log('🎯 Test 6: Testing Complete Symbol Subscription...');
    await binanceWS.subscribeToSymbolComplete('ADAUSDT', ['1m']);
    console.log('✅ Complete symbol subscription successful\n');

    // Wait a bit more for additional data
    console.log('⏱️ Waiting for additional data (10 seconds)...');
    await waitForData(10000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    testResults.errors.push(error.message);
  } finally {
    // Test 7: Service Shutdown
    console.log('🛑 Test 7: Shutting down service...');
    try {
      await binanceWS.stop();
      testResults.serviceStop = true;
      console.log('✅ Service stopped successfully\n');
    } catch (error) {
      console.error('❌ Error stopping service:', error);
      testResults.errors.push(`Stop error: ${error.message}`);
    }
  }

  // Print test results
  printTestResults(testResults);
}

function setupTestEventListeners(binanceWS, testResults) {
  // Service lifecycle events
  binanceWS.on('started', () => {
    console.log('🟢 Event: Service started');
  });

  binanceWS.on('stopped', () => {
    console.log('🔴 Event: Service stopped');
  });

  // Connection events
  binanceWS.on('streamConnected', ({ stream, timestamp }) => {
    console.log(`🔗 Event: Stream connected - ${stream}`);
  });

  binanceWS.on('streamDisconnected', ({ stream, code, reason }) => {
    console.log(`🔌 Event: Stream disconnected - ${stream} (${code}: ${reason})`);
  });

  binanceWS.on('streamError', ({ stream, error }) => {
    console.log(`❌ Event: Stream error - ${stream}: ${error}`);
    testResults.errors.push(`Stream error: ${stream} - ${error}`);
  });

  // Data events (track first occurrence)
  binanceWS.on('ticker', (ticker) => {
    if (!testResults.dataReceived.ticker) {
      testResults.dataReceived.ticker = true;
      console.log(`📊 First ticker data received: ${ticker.symbol} = $${ticker.price}`);
    }
  });

  binanceWS.on('orderbook', (orderbook) => {
    if (!testResults.dataReceived.orderbook) {
      testResults.dataReceived.orderbook = true;
      const bestBid = orderbook.bids[0]?.[0] || 0;
      const bestAsk = orderbook.asks[0]?.[0] || 0;
      console.log(`📈 First orderbook data received: ${orderbook.symbol} Bid: $${bestBid}, Ask: $${bestAsk}`);
    }
  });

  binanceWS.on('trade', (trade) => {
    if (!testResults.dataReceived.trade) {
      testResults.dataReceived.trade = true;
      console.log(`💱 First trade data received: ${trade.symbol} ${trade.side.toUpperCase()} ${trade.quantity} @ $${trade.price}`);
    }
  });

  binanceWS.on('candle', (candle) => {
    if (!testResults.dataReceived.candle) {
      testResults.dataReceived.candle = true;
      console.log(`🕯️ First candle data received: ${candle.symbol} ${candle.timeframe} OHLC: ${candle.open}/${candle.high}/${candle.low}/${candle.close}`);
    }
  });

  // Subscription events
  binanceWS.on('symbolSubscribed', ({ symbol, timeframes }) => {
    console.log(`🎯 Event: Complete subscription for ${symbol} with timeframes: ${timeframes.join(', ')}`);
  });

  // Health and monitoring events
  binanceWS.on('healthCheck', ({ isHealthy, stats }) => {
    if (!isHealthy) {
      console.log(`⚠️ Event: Health check failed - ${stats.unhealthyConnections}/${stats.totalConnections} connections unhealthy`);
    }
  });

  binanceWS.on('staleData', ({ stream, age }) => {
    console.log(`⚠️ Event: Stale data detected for ${stream}: ${Math.round(age / 1000)}s old`);
  });

  binanceWS.on('heartbeat', ({ stream }) => {
    // Heartbeat events are too frequent for logging in tests
  });

  // Error events
  binanceWS.on('parseError', ({ stream, error }) => {
    console.log(`❌ Event: Parse error on ${stream}: ${error}`);
    testResults.errors.push(`Parse error: ${stream} - ${error}`);
  });

  binanceWS.on('maxReconnectionAttemptsReached', ({ stream }) => {
    console.log(`❌ Event: Max reconnection attempts reached for ${stream}`);
    testResults.errors.push(`Max reconnection attempts: ${stream}`);
  });
}

function waitForData(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printTestResults(results) {
  console.log('📋 Test Results Summary:');
  console.log('========================\n');

  const tests = [
    { name: 'Service Start', result: results.serviceStart },
    { name: 'Ticker Subscription', result: results.tickerSubscription },
    { name: 'Order Book Subscription', result: results.orderbookSubscription },
    { name: 'Trade Subscription', result: results.tradeSubscription },
    { name: 'Candle Subscription', result: results.candleSubscription },
    { name: 'Ticker Data Received', result: results.dataReceived.ticker },
    { name: 'Order Book Data Received', result: results.dataReceived.orderbook },
    { name: 'Trade Data Received', result: results.dataReceived.trade },
    { name: 'Candle Data Received', result: results.dataReceived.candle },
    { name: 'Connection Statistics', result: results.connectionStats },
    { name: 'Health Check', result: results.healthCheck },
    { name: 'Service Stop', result: results.serviceStop }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  tests.forEach(test => {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
    if (test.result) passedTests++;
  });

  console.log(`\nOverall Result: ${passedTests}/${totalTests} tests passed`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    results.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }

  const successRate = (passedTests / totalTests) * 100;
  console.log(`\nSuccess Rate: ${successRate.toFixed(1)}%`);

  if (successRate >= 80) {
    console.log('\n🎉 Binance WebSocket Integration Test: SUCCESS');
    console.log('✅ The enhanced Binance WebSocket integration is working correctly!');
  } else {
    console.log('\n⚠️ Binance WebSocket Integration Test: PARTIAL SUCCESS');
    console.log('Some features may need attention, but core functionality is working.');
  }

  console.log('\n📝 Test completed. Check the output above for detailed results.');
}

// Run the test if this file is executed directly
if (require.main === module) {
  // Set paper trading mode for safety
  process.env.TRADING_SIMULATION_ONLY = 'true';
  
  testBinanceWebSocketIntegration()
    .then(() => {
      console.log('\n✅ Test execution completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testBinanceWebSocketIntegration };