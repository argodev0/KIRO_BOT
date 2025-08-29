/**
 * Binance WebSocket Integration Demo
 * Demonstrates the enhanced Binance WebSocket integration with automatic reconnection,
 * real-time price data subscription, error handling, and data normalization
 */

import { BinanceWebSocketService } from '../services/BinanceWebSocketService';
import { logger } from '../utils/logger';

async function demonstrateBinanceWebSocketIntegration() {
  console.log('🚀 Starting Binance WebSocket Integration Demo...\n');

  // Initialize the service with custom configuration
  const binanceWS = new BinanceWebSocketService({
    baseURL: 'wss://stream.binance.com:9443/ws', // Mainnet URL
    maxReconnectionAttempts: 5,
    reconnectionDelay: 1000,
    pingInterval: 180000, // 3 minutes
    connectionTimeout: 10000, // 10 seconds
    enableHeartbeat: true,
    majorTradingPairs: [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT'
    ],
    defaultTimeframes: ['1m', '5m', '15m', '1h']
  });

  // Set up event listeners for monitoring
  setupEventListeners(binanceWS);

  try {
    // Start the service
    console.log('📡 Starting Binance WebSocket Service...');
    await binanceWS.start();
    console.log('✅ Service started successfully\n');

    // Demo 1: Subscribe to individual ticker data
    console.log('📊 Demo 1: Individual Ticker Subscription');
    await binanceWS.subscribeToTicker('BTCUSDT');
    console.log('✅ Subscribed to BTCUSDT ticker\n');

    // Wait a bit to see some data
    await sleep(3000);

    // Demo 2: Subscribe to order book data
    console.log('📈 Demo 2: Order Book Subscription');
    await binanceWS.subscribeToOrderBook('ETHUSDT', 20);
    console.log('✅ Subscribed to ETHUSDT order book\n');

    await sleep(2000);

    // Demo 3: Subscribe to trade data
    console.log('💱 Demo 3: Trade Data Subscription');
    await binanceWS.subscribeToTrades('BNBUSDT');
    console.log('✅ Subscribed to BNBUSDT trades\n');

    await sleep(2000);

    // Demo 4: Subscribe to candle data
    console.log('🕯️ Demo 4: Candle Data Subscription');
    await binanceWS.subscribeToCandles('ADAUSDT', '1m');
    await binanceWS.subscribeToCandles('ADAUSDT', '5m');
    console.log('✅ Subscribed to ADAUSDT candles (1m, 5m)\n');

    await sleep(3000);

    // Demo 5: Complete symbol subscription
    console.log('🎯 Demo 5: Complete Symbol Subscription');
    await binanceWS.subscribeToSymbolComplete('XRPUSDT', ['1m', '15m']);
    console.log('✅ Complete subscription for XRPUSDT\n');

    await sleep(3000);

    // Demo 6: Major trading pairs subscription
    console.log('🌟 Demo 6: Major Trading Pairs Subscription');
    await binanceWS.subscribeToMajorTradingPairs();
    console.log('✅ Subscribed to all major trading pairs\n');

    await sleep(5000);

    // Demo 7: Connection statistics
    console.log('📊 Demo 7: Connection Statistics');
    const stats = binanceWS.getConnectionStats();
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
    console.log(`  Health Status: ${binanceWS.isHealthy() ? '✅ Healthy' : '❌ Unhealthy'}\n`);

    // Demo 8: Let it run for a while to demonstrate data flow
    console.log('⏱️ Demo 8: Real-time Data Flow (30 seconds)');
    console.log('Monitoring real-time data... (watch the console for updates)\n');
    
    await sleep(30000);

    // Demo 9: Unsubscription
    console.log('🔌 Demo 9: Unsubscription');
    await binanceWS.unsubscribeFromSymbol('BTCUSDT');
    console.log('✅ Unsubscribed from BTCUSDT\n');

    await sleep(2000);

    // Final statistics
    const finalStats = binanceWS.getConnectionStats();
    console.log('📊 Final Statistics:');
    console.log(`  Active Connections: ${finalStats.totalConnections}`);
    console.log(`  Health Status: ${binanceWS.isHealthy() ? '✅ Healthy' : '❌ Unhealthy'}\n`);

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean shutdown
    console.log('🛑 Shutting down service...');
    await binanceWS.stop();
    console.log('✅ Service stopped successfully');
    console.log('\n🎉 Binance WebSocket Integration Demo completed!');
  }
}

function setupEventListeners(binanceWS: BinanceWebSocketService) {
  // Service lifecycle events
  binanceWS.on('started', () => {
    console.log('🟢 Service started');
  });

  binanceWS.on('stopped', () => {
    console.log('🔴 Service stopped');
  });

  // Connection events
  binanceWS.on('streamConnected', ({ stream, timestamp }) => {
    console.log(`🔗 Stream connected: ${stream} at ${new Date(timestamp).toISOString()}`);
  });

  binanceWS.on('streamDisconnected', ({ stream, code, reason, timestamp }) => {
    console.log(`🔌 Stream disconnected: ${stream} (${code}: ${reason}) at ${new Date(timestamp).toISOString()}`);
  });

  binanceWS.on('streamReconnected', ({ stream, attempts }) => {
    console.log(`🔄 Stream reconnected: ${stream} after ${attempts} attempts`);
  });

  binanceWS.on('streamError', ({ stream, error, timestamp }) => {
    console.log(`❌ Stream error: ${stream} - ${error} at ${new Date(timestamp).toISOString()}`);
  });

  // Data events (limited logging to avoid spam)
  let tickerCount = 0;
  let orderbookCount = 0;
  let tradeCount = 0;
  let candleCount = 0;

  binanceWS.on('ticker', (ticker) => {
    tickerCount++;
    if (tickerCount % 10 === 0) { // Log every 10th ticker update
      console.log(`📊 Ticker Update #${tickerCount}: ${ticker.symbol} = $${ticker.price} (${ticker.changePercent24h > 0 ? '+' : ''}${ticker.changePercent24h.toFixed(2)}%)`);
    }
  });

  binanceWS.on('orderbook', (orderbook) => {
    orderbookCount++;
    if (orderbookCount % 20 === 0) { // Log every 20th orderbook update
      const bestBid = orderbook.bids[0]?.[0] || 0;
      const bestAsk = orderbook.asks[0]?.[0] || 0;
      console.log(`📈 OrderBook Update #${orderbookCount}: ${orderbook.symbol} Bid: $${bestBid}, Ask: $${bestAsk}`);
    }
  });

  binanceWS.on('trade', (trade) => {
    tradeCount++;
    if (tradeCount % 5 === 0) { // Log every 5th trade
      console.log(`💱 Trade #${tradeCount}: ${trade.symbol} ${trade.side.toUpperCase()} ${trade.quantity} @ $${trade.price}`);
    }
  });

  binanceWS.on('candle', (candle) => {
    candleCount++;
    if (candleCount % 15 === 0) { // Log every 15th candle
      console.log(`🕯️ Candle #${candleCount}: ${candle.symbol} ${candle.timeframe} O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`);
    }
  });

  // Subscription events
  binanceWS.on('symbolSubscribed', ({ symbol, timeframes, timestamp }) => {
    console.log(`🎯 Complete subscription for ${symbol} with timeframes: ${timeframes.join(', ')} at ${new Date(timestamp).toISOString()}`);
  });

  binanceWS.on('majorPairsSubscribed', ({ pairs, timeframes, totalSubscriptions, timestamp }) => {
    console.log(`🌟 Major pairs subscribed: ${pairs.length} pairs, ${timeframes.length} timeframes, ${totalSubscriptions} total subscriptions at ${new Date(timestamp).toISOString()}`);
  });

  // Health monitoring
  binanceWS.on('healthCheck', ({ isHealthy, stats, timestamp }) => {
    if (!isHealthy) {
      console.log(`⚠️ Health check failed at ${new Date(timestamp).toISOString()}: ${stats.unhealthyConnections}/${stats.totalConnections} connections unhealthy`);
    }
  });

  binanceWS.on('staleData', ({ stream, age }) => {
    console.log(`⚠️ Stale data detected for ${stream}: ${Math.round(age / 1000)}s old`);
  });

  binanceWS.on('heartbeat', ({ stream, timestamp }) => {
    // Heartbeat events are too frequent for logging, but we could track them
  });

  // Error events
  binanceWS.on('parseError', ({ stream, error }) => {
    console.log(`❌ Parse error on ${stream}: ${error}`);
  });

  binanceWS.on('maxReconnectionAttemptsReached', ({ stream }) => {
    console.log(`❌ Max reconnection attempts reached for ${stream}`);
  });

  // Data received events (for monitoring)
  let dataReceivedCount = 0;
  binanceWS.on('dataReceived', ({ stream, dataType, timestamp }) => {
    dataReceivedCount++;
    if (dataReceivedCount % 100 === 0) { // Log every 100th data event
      console.log(`📡 Data received #${dataReceivedCount}: ${dataType} from ${stream} at ${new Date(timestamp).toISOString()}`);
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateBinanceWebSocketIntegration().catch(console.error);
}

export { demonstrateBinanceWebSocketIntegration };