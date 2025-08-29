/**
 * Binance WebSocket Service Simple Tests
 * Basic tests for the Binance WebSocket integration without complex mocking
 */

import { BinanceWebSocketService } from '../../services/BinanceWebSocketService';

describe('BinanceWebSocketService - Simple Tests', () => {
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

  describe('Service Configuration', () => {
    it('should create service with default configuration', () => {
      const defaultService = new BinanceWebSocketService();
      expect(defaultService).toBeDefined();
      expect(defaultService.isHealthy()).toBe(false); // Not started yet
    });

    it('should create service with custom configuration', () => {
      const customService = new BinanceWebSocketService({
        baseURL: 'wss://testnet.binance.vision/ws',
        maxReconnectionAttempts: 5,
        reconnectionDelay: 2000,
        majorTradingPairs: ['BTCUSDT', 'ETHUSDT'],
        defaultTimeframes: ['1m', '5m']
      });
      
      expect(customService).toBeDefined();
      expect(customService.isHealthy()).toBe(false); // Not started yet
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop successfully', async () => {
      const startedSpy = jest.fn();
      const stoppedSpy = jest.fn();
      
      service.on('started', startedSpy);
      service.on('stopped', stoppedSpy);
      
      await service.start();
      expect(startedSpy).toHaveBeenCalled();
      
      await service.stop();
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not start twice', async () => {
      await service.start();
      
      // Starting again should not throw
      await expect(service.start()).resolves.not.toThrow();
      
      await service.stop();
    });

    it('should handle stop when not started', async () => {
      // Should not throw when stopping a service that wasn't started
      await expect(service.stop()).resolves.not.toThrow();
    });
  });

  describe('Connection Statistics', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should provide connection statistics', () => {
      const stats = service.getConnectionStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('healthyConnections');
      expect(stats).toHaveProperty('unhealthyConnections');
      expect(stats).toHaveProperty('subscriptionsByType');
      expect(stats).toHaveProperty('lastDataReceived');
      expect(stats).toHaveProperty('reconnectionAttempts');
      
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.healthyConnections).toBe('number');
      expect(typeof stats.unhealthyConnections).toBe('number');
      expect(typeof stats.subscriptionsByType).toBe('object');
      expect(typeof stats.lastDataReceived).toBe('object');
      expect(typeof stats.reconnectionAttempts).toBe('object');
    });

    it('should report health status', () => {
      const isHealthy = service.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should have correct initial statistics', () => {
      const stats = service.getConnectionStats();
      
      expect(stats.totalConnections).toBe(0);
      expect(stats.healthyConnections).toBe(0);
      expect(stats.unhealthyConnections).toBe(0);
      expect(Object.keys(stats.subscriptionsByType)).toContain('ticker');
      expect(Object.keys(stats.subscriptionsByType)).toContain('depth');
      expect(Object.keys(stats.subscriptionsByType)).toContain('trade');
      expect(Object.keys(stats.subscriptionsByType)).toContain('kline');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should emit started event', async () => {
      const newService = new BinanceWebSocketService();
      const startedSpy = jest.fn();
      
      newService.on('started', startedSpy);
      await newService.start();
      
      expect(startedSpy).toHaveBeenCalled();
      
      await newService.stop();
    });

    it('should emit stopped event', async () => {
      const stoppedSpy = jest.fn();
      
      service.on('stopped', stoppedSpy);
      await service.stop();
      
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should handle multiple event listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      service.on('started', listener1);
      service.on('started', listener2);
      
      const newService = new BinanceWebSocketService();
      newService.on('started', listener1);
      newService.on('started', listener2);
      
      await newService.start();
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      
      await newService.stop();
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid configuration gracefully', () => {
      const invalidService = new BinanceWebSocketService({
        maxReconnectionAttempts: -1, // Invalid
        reconnectionDelay: -1000, // Invalid
        connectionTimeout: 0, // Invalid
      });
      
      expect(invalidService).toBeDefined();
      // Service should still be created but with corrected values
    });

    it('should use reasonable defaults', () => {
      const service = new BinanceWebSocketService();
      const stats = service.getConnectionStats();
      
      // Should have default subscription types
      expect(stats.subscriptionsByType).toHaveProperty('ticker');
      expect(stats.subscriptionsByType).toHaveProperty('depth');
      expect(stats.subscriptionsByType).toHaveProperty('trade');
      expect(stats.subscriptionsByType).toHaveProperty('kline');
    });
  });

  describe('Paper Trading Safety Integration', () => {
    it('should work with paper trading environment variables', async () => {
      // Set paper trading environment
      const originalEnv = process.env.TRADING_SIMULATION_ONLY;
      process.env.TRADING_SIMULATION_ONLY = 'true';
      
      try {
        const paperTradingService = new BinanceWebSocketService();
        await paperTradingService.start();
        
        // Should start successfully in paper trading mode
        expect(paperTradingService.isHealthy()).toBe(true);
        
        await paperTradingService.stop();
      } finally {
        // Restore original environment
        if (originalEnv !== undefined) {
          process.env.TRADING_SIMULATION_ONLY = originalEnv;
        } else {
          delete process.env.TRADING_SIMULATION_ONLY;
        }
      }
    });

    it('should handle mainnet URL configuration safely', () => {
      const mainnetService = new BinanceWebSocketService({
        baseURL: 'wss://stream.binance.com:9443/ws' // Mainnet URL
      });
      
      expect(mainnetService).toBeDefined();
      // Service should be created successfully even with mainnet URL
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const errorSpy = jest.fn();
      service.on('error', errorSpy);
      
      await service.start();
      
      // Service should handle internal errors without crashing
      expect(service.isHealthy()).toBe(true);
    });

    it('should handle multiple start/stop cycles', async () => {
      // Multiple start/stop cycles should not cause issues
      await service.start();
      await service.stop();
      
      await service.start();
      await service.stop();
      
      await service.start();
      await service.stop();
      
      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on stop', async () => {
      await service.start();
      
      const initialStats = service.getConnectionStats();
      
      await service.stop();
      
      // After stopping, connections should be cleaned up
      const finalStats = service.getConnectionStats();
      expect(finalStats.totalConnections).toBe(0);
      expect(finalStats.healthyConnections).toBe(0);
      expect(finalStats.unhealthyConnections).toBe(0);
    });

    it('should handle rapid start/stop cycles', async () => {
      // Rapid start/stop should not cause memory leaks or errors
      for (let i = 0; i < 5; i++) {
        await service.start();
        await service.stop();
      }
      
      expect(service.getConnectionStats().totalConnections).toBe(0);
    });
  });

  describe('Subscription Methods Exist', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should have all required subscription methods', () => {
      expect(typeof service.subscribeToTicker).toBe('function');
      expect(typeof service.subscribeToOrderBook).toBe('function');
      expect(typeof service.subscribeToTrades).toBe('function');
      expect(typeof service.subscribeToCandles).toBe('function');
      expect(typeof service.subscribeToMajorTradingPairs).toBe('function');
      expect(typeof service.subscribeToSymbolComplete).toBe('function');
    });

    it('should have all required unsubscription methods', () => {
      expect(typeof service.unsubscribe).toBe('function');
      expect(typeof service.unsubscribeFromSymbol).toBe('function');
    });

    it('should have utility methods', () => {
      expect(typeof service.getConnectionStats).toBe('function');
      expect(typeof service.isHealthy).toBe('function');
    });
  });
});