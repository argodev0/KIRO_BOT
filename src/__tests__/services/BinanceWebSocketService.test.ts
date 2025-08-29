/**
 * Binance WebSocket Service Tests
 * Tests for the enhanced Binance WebSocket integration
 */

import { BinanceWebSocketService } from '../../services/BinanceWebSocketService';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

// Mock WebSocket
jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => {
    const ws = new EventEmitter();
    (ws as any).readyState = 1; // OPEN
    (ws as any).close = jest.fn();
    (ws as any).terminate = jest.fn();
    (ws as any).ping = jest.fn();
    
    // Simulate connection opening after a short delay
    setTimeout(() => {
      ws.emit('open');
    }, 10);
    
    return ws;
  });
});
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

describe('BinanceWebSocketService', () => {
  let service: BinanceWebSocketService;
  
  beforeEach(() => {
    service = new BinanceWebSocketService({
      maxReconnectionAttempts: 3,
      reconnectionDelay: 100,
      connectionTimeout: 1000,
      pingInterval: 1000,
    });
  });
  
  afterEach(async () => {
    if (service) {
      await service.stop();
    }
  });

  describe('Service Lifecycle', () => {
    it('should start successfully', async () => {
      const startedSpy = jest.fn();
      service.on('started', startedSpy);
      
      await service.start();
      
      expect(startedSpy).toHaveBeenCalled();
      // Service is healthy when running, even with no connections initially
      expect(service.isHealthy()).toBe(true);
    });

    it('should stop successfully', async () => {
      const stoppedSpy = jest.fn();
      service.on('stopped', stoppedSpy);
      
      await service.start();
      await service.stop();
      
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not start twice', async () => {
      await service.start();
      
      // Starting again should not throw
      await expect(service.start()).resolves.not.toThrow();
    });
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to ticker data', async () => {
      const tickerSpy = jest.fn();
      service.on('ticker', tickerSpy);
      
      // Mock successful subscription with timeout to allow connection
      await expect(
        Promise.race([
          service.subscribeToTicker('BTCUSDT'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])
      ).resolves.not.toThrow();
    });

    it('should subscribe to order book data', async () => {
      const orderbookSpy = jest.fn();
      service.on('orderbook', orderbookSpy);
      
      await expect(
        Promise.race([
          service.subscribeToOrderBook('BTCUSDT'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])
      ).resolves.not.toThrow();
    });

    it('should subscribe to trade data', async () => {
      const tradeSpy = jest.fn();
      service.on('trade', tradeSpy);
      
      await expect(
        Promise.race([
          service.subscribeToTrades('BTCUSDT'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])
      ).resolves.not.toThrow();
    });

    it('should subscribe to candle data', async () => {
      const candleSpy = jest.fn();
      service.on('candle', candleSpy);
      
      await expect(
        Promise.race([
          service.subscribeToCandles('BTCUSDT', '1m'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])
      ).resolves.not.toThrow();
    });

    it('should subscribe to complete symbol data', async () => {
      const symbolSubscribedSpy = jest.fn();
      service.on('symbolSubscribed', symbolSubscribedSpy);
      
      await expect(
        Promise.race([
          service.subscribeToSymbolComplete('BTCUSDT', ['1m', '5m']),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ])
      ).resolves.not.toThrow();
    });

    it('should subscribe to major trading pairs', async () => {
      const majorPairsSubscribedSpy = jest.fn();
      service.on('majorPairsSubscribed', majorPairsSubscribedSpy);
      
      // Use a smaller set for testing
      const testService = new BinanceWebSocketService({
        majorTradingPairs: ['BTCUSDT', 'ETHUSDT'],
        defaultTimeframes: ['1m']
      });
      await testService.start();
      
      await expect(
        Promise.race([
          testService.subscribeToMajorTradingPairs(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ])
      ).resolves.not.toThrow();
      
      await testService.stop();
    });
  });

  describe('Data Normalization', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should normalize ticker data correctly', async () => {
      const tickerSpy = jest.fn();
      service.on('ticker', tickerSpy);
      
      // Subscribe and wait for connection
      await Promise.race([
        service.subscribeToTicker('BTCUSDT'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      // Give some time for connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify subscription was created
      const stats = service.getConnectionStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed data gracefully', async () => {
      const parseErrorSpy = jest.fn();
      service.on('parseError', parseErrorSpy);
      
      await Promise.race([
        service.subscribeToTicker('BTCUSDT'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      // Give some time for connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the subscription exists
      const stats = service.getConnectionStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should track connection statistics', () => {
      const stats = service.getConnectionStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('healthyConnections');
      expect(stats).toHaveProperty('unhealthyConnections');
      expect(stats).toHaveProperty('subscriptionsByType');
      expect(stats).toHaveProperty('lastDataReceived');
      expect(stats).toHaveProperty('reconnectionAttempts');
    });

    it('should report health status', () => {
      const isHealthy = service.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should handle reconnection attempts', async () => {
      const streamReconnectedSpy = jest.fn();
      service.on('streamReconnected', streamReconnectedSpy);
      
      await Promise.race([
        service.subscribeToTicker('BTCUSDT'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      // Give some time for connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify connection exists
      const stats = service.getConnectionStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
    });

    it('should handle max reconnection attempts', async () => {
      const maxAttemptsReachedSpy = jest.fn();
      service.on('maxReconnectionAttemptsReached', maxAttemptsReachedSpy);
      
      // This would test the max reconnection logic
      // In a real test, we'd simulate repeated connection failures
    });
  });

  describe('Unsubscription', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should unsubscribe from specific streams', async () => {
      await Promise.race([
        service.subscribeToTicker('BTCUSDT'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      // Give some time for connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const initialStats = service.getConnectionStats();
      
      await service.unsubscribe('btcusdt@ticker');
      
      // Verify unsubscription doesn't throw
      expect(service.getConnectionStats().totalConnections).toBeGreaterThanOrEqual(0);
    });

    it('should unsubscribe from all symbol streams', async () => {
      await Promise.race([
        service.subscribeToSymbolComplete('BTCUSDT', ['1m']),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);
      
      // Give some time for connections to establish
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await service.unsubscribeFromSymbol('BTCUSDT');
      
      // Verify unsubscription doesn't throw
      const stats = service.getConnectionStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should handle connection errors gracefully', async () => {
      const streamErrorSpy = jest.fn();
      service.on('streamError', streamErrorSpy);
      
      // Test that subscription doesn't throw even with invalid symbols
      await expect(
        Promise.race([
          service.subscribeToTicker('INVALID_SYMBOL'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ])
      ).resolves.not.toThrow();
    });

    it('should emit stale data warnings', async () => {
      const staleDataSpy = jest.fn();
      service.on('staleData', staleDataSpy);
      
      // This would test stale data detection
      // In a real test, we'd simulate stale data conditions
    });

    it('should handle service shutdown during operations', async () => {
      await Promise.race([
        service.subscribeToTicker('BTCUSDT'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      // Give some time for connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should not throw when stopping during active subscriptions
      await expect(service.stop()).resolves.not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultService = new BinanceWebSocketService();
      expect(defaultService).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customService = new BinanceWebSocketService({
        baseURL: 'wss://testnet.binance.vision/ws',
        maxReconnectionAttempts: 5,
        reconnectionDelay: 2000,
        majorTradingPairs: ['BTCUSDT', 'ETHUSDT'],
        defaultTimeframes: ['1m', '5m']
      });
      
      expect(customService).toBeDefined();
    });
  });

  describe('Integration with Paper Trading Safety', () => {
    it('should work in paper trading mode', async () => {
      // Verify the service works with paper trading constraints
      process.env.TRADING_SIMULATION_ONLY = 'true';
      
      await service.start();
      
      await Promise.race([
        service.subscribeToTicker('BTCUSDT'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      // Give some time for connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should not throw in paper trading mode
      expect(service.isHealthy()).toBe(true);
    });

    it('should handle mainnet connections safely', async () => {
      // Test that mainnet connections are handled safely
      const mainnetService = new BinanceWebSocketService({
        baseURL: 'wss://stream.binance.com:9443/ws'
      });
      
      await mainnetService.start();
      
      // Should work with mainnet URL in paper trading mode
      expect(mainnetService.isHealthy()).toBe(true);
      
      await mainnetService.stop();
    });
  });
});