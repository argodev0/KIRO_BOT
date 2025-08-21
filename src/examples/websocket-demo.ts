/**
 * WebSocket Server Demo
 * Demonstrates the WebSocket server functionality for real-time data distribution
 */

import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from '@/services/WebSocketServer';
import { DataBroadcastService } from '@/services/DataBroadcastService';
import { WebSocketClientManager } from '@/services/WebSocketClientManager';
import { logger } from '@/utils/logger';

async function runWebSocketDemo() {
  logger.info('🚀 Starting WebSocket Server Demo...');

  // Create HTTP server
  const app = express();
  const httpServer = createServer(app);

  // Initialize WebSocket services
  const wsServer = new WebSocketServer(httpServer, {
    cors: {
      origin: "*",
      credentials: true
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100
    }
  });

  const dataBroadcastService = new DataBroadcastService(wsServer);
  const clientManager = new WebSocketClientManager();

  // Add health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      websocket: {
        server: wsServer.getServerStats(),
        clients: clientManager.getClientStats(),
        broadcast: dataBroadcastService.getStats()
      }
    });
  });

  // Start server
  const PORT = 3001;
  httpServer.listen(PORT, () => {
    logger.info(`🔌 WebSocket server running on port ${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    logger.info(`🔗 WebSocket endpoint: ws://localhost:${PORT}`);
  });

  // Simulate real-time data broadcasting
  setInterval(() => {
    // Simulate market data updates
    const marketData = {
      symbol: 'BTCUSDT',
      price: 45000 + Math.random() * 10000,
      volume: Math.random() * 1000,
      change24h: (Math.random() - 0.5) * 10,
      timestamp: Date.now()
    };

    dataBroadcastService.broadcastMarketData(marketData);
    logger.info(`📈 Broadcasted market data: ${marketData.symbol} @ $${marketData.price.toFixed(2)}`);
  }, 5000);

  // Simulate trading signals
  setInterval(() => {
    const signals = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT'];
    const directions = ['long', 'short'] as const;
    
    const signal = {
      id: `signal-${Date.now()}`,
      symbol: signals[Math.floor(Math.random() * signals.length)],
      direction: directions[Math.floor(Math.random() * directions.length)],
      confidence: 0.6 + Math.random() * 0.4,
      entryPrice: 1000 + Math.random() * 50000,
      stopLoss: 900 + Math.random() * 45000,
      takeProfit: [1100 + Math.random() * 55000, 1200 + Math.random() * 60000],
      timestamp: Date.now()
    };

    dataBroadcastService.broadcastTradingSignal(signal);
    logger.info(`🎯 Broadcasted trading signal: ${signal.symbol} ${signal.direction} (${(signal.confidence * 100).toFixed(1)}%)`);
  }, 15000);

  // Simulate system status updates
  setInterval(() => {
    const systemStatus = {
      status: 'healthy' as const,
      services: [
        {
          name: 'database',
          status: 'up' as const,
          latency: Math.floor(Math.random() * 50) + 5
        },
        {
          name: 'redis',
          status: 'up' as const,
          latency: Math.floor(Math.random() * 20) + 1
        },
        {
          name: 'exchange-api',
          status: Math.random() > 0.1 ? 'up' as const : 'degraded' as const,
          latency: Math.floor(Math.random() * 200) + 50
        }
      ],
      timestamp: Date.now()
    };

    dataBroadcastService.broadcastSystemStatus(systemStatus);
    logger.info(`🔧 Broadcasted system status: ${systemStatus.status}`);
  }, 30000);

  // Log connection statistics periodically
  setInterval(() => {
    const stats = wsServer.getServerStats();
    logger.info(`📊 WebSocket Stats: ${stats.connectedClients} clients, ${stats.totalChannels} channels`);
    
    if (stats.channelStats.length > 0) {
      stats.channelStats.forEach(channel => {
        logger.info(`   📺 ${channel.channel}: ${channel.subscribers} subscribers`);
      });
    }
  }, 60000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('🛑 Shutting down WebSocket server...');
    httpServer.close(() => {
      clientManager.shutdown();
      dataBroadcastService.cleanup();
      logger.info('✅ WebSocket server shutdown complete');
      process.exit(0);
    });
  });

  logger.info('✅ WebSocket Demo setup complete!');
  logger.info('');
  logger.info('📝 To test the WebSocket server:');
  logger.info('1. Open a WebSocket client (like wscat or a browser console)');
  logger.info('2. Connect to: ws://localhost:3001');
  logger.info('3. Send authentication: {"auth": {"token": "your-jwt-token"}}');
  logger.info('4. Subscribe to channels: {"type": "subscribe", "channels": ["market_data", "trading_signals"]}');
  logger.info('5. Watch for real-time data updates!');
  logger.info('');
  logger.info('🔑 For testing without auth, modify the WebSocketServer middleware');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runWebSocketDemo().catch(error => {
    logger.error('❌ WebSocket demo failed:', error);
    process.exit(1);
  });
}

export { runWebSocketDemo };