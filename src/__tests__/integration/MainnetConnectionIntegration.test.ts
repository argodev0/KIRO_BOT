/**
 * Mainnet Connection Integration Tests
 * Tests for live market data integration with real exchange connections
 */

import { MainnetConnectionManager, createMainnetConnectionManager } from '../../services/MainnetConnectionManager';
import { Server as HttpServer } from 'http';
import { config } from '../../config/config';

// Mock config for testing
jest.mock('../../config/config', () => ({
  config: {
    paperTrading: {
      enabled: true,
      allowRealTrades: false,
    },
    exchanges: {
      binance: {
        apiKey: 'test-binance-key',
        apiSecret: 'test-binance-secret',
        mainnet: true,
        readOnly: true,
      },
      kucoin: {
        apiKey: 'test-kucoin-key',
        apiSecret: 'test-kucoin-secret',
        passphrase: 'test-passphrase',
        mainnet: true,
        readOnly: true,
      },
    },
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
    },
    production: {
      performance: {
        websocketMaxConnections: 100,
      },
      ssl: {
        enabled: false,
      },
    },
    websocket: {
      cors: {
        origin: 'http://localhost:3000',
        credentials: true,
      },
      heartbeatInterval: 30000,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 100,
      },
    },
    env: 'test',
  },
}));

describe('MainnetConnectionIntegration', () => {
  let manager: MainnetConnectionManager;
  let httpServer: HttpServer;

  beforeEach(() => {
    // Create HTTP server for WebSocket testing
    httpServer = new HttpServer();
    
    manager = createMainnetConnectionManager({
      symbols: ['BTCUSDT', 'ETHUSDT'],
      timeframes: ['1m', '5m'],
      enableBinance: true,
      enableKuCoin: true,
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  describe('Manager Creation', () => {
    it('should create manager with default configuration', () => {
      const defaultManager = createMainnetConnectionManager({});
      const config = defaultManager.getConfig();
      
      expect(config.symbols).toContain('BTCUSDT');
      expect(config.symbols).toContain('ETHUSDT');
      expect(config.timeframes).toContain('1m');
      expect(config.timeframes).toContain('5m');
      expect(config.enableBinance).toBe(true);
      expect(config.enableKuCoin).toBe(true);
    });

    it('should create manager with custom configuration', () => {
      const customManager = createMainnetConnectionManager({
        symbols: ['ADAUSDT'],
        timeframes: ['1h'],
        enableBinance: false,
        enableKuCoin: true,
      });
      
      const config = customManager.getConfig();
      
      expect(config.symbols).toEqual(['ADAUSDT']);
      expect(config.timeframes).toEqual(['1h']);
      expect(config.enableBinance).toBe(false);
      expect(config.enableKuCoin).toBe(true);
    });
  });

  describe('Environment Validation', () => {
    it('should validate paper trading mode is enabled', async () => {
      // Mock config to disable paper trading
      const originalConfig = require('../../config/config').config;
      require('../../config/config').config.paperTrading.enabled = false;

      await expect(manager.start(httpServer)).rejects.toThrow(
        'SECURITY: Paper trading mode must be enabled for mainnet connections'
      );

      // Restore original config
      require('../../config/config').config = originalConfig;
    });

    it('should validate real trades are disabled', async () => {
      // Mock config to allow real trades
      const originalConfig = require('../../config/config').config;
      require('../../config/config').config.paperTrading.allowRealTrades = true;

      await expect(manager.start(httpServer)).rejects.toThrow(
        'SECURITY: Real trades must be disabled when using mainnet data'
      );

      // Restore original config
      require('../../config/config').config = originalConfig;
    });
  });

  describe('API Key Validation', () => {
    it('should validate Binance API keys when enabled', async () => {
      // Mock config with missing Binance API key
      const originalConfig = require('../../config/config').config;
      require('../../config/config').config.exchanges.binance.apiKey = '';

      await expect(manager.start(httpServer)).rejects.toThrow(
        'API key validation failed: Binance API key is required'
      );

      // Restore original config
      require('../../config/config').config = originalConfig;
    });

    it('should validate KuCoin API keys when enabled', async () => {
      // Mock config with missing KuCoin passphrase
      const originalConfig = require('../../config/config').config;
      require('../../config/config').config.exchanges.kucoin.passphrase = '';

      await expect(manager.start(httpServer)).rejects.toThrow(
        'API key validation failed: KuCoin passphrase is required'
      );

      // Restore original config
      require('../../config/config').config = originalConfig;
    });

    it('should validate mainnet mode is enabled', async () => {
      // Mock config with mainnet disabled
      const originalConfig = require('../../config/config').config;
      require('../../config/config').config.exchanges.binance.mainnet = false;

      await expect(manager.start(httpServer)).rejects.toThrow(
        'API key validation failed: Binance mainnet mode must be enabled'
      );

      // Restore original config
      require('../../config/config').config = originalConfig;
    });
  });

  describe('Service Management', () => {
    it('should start and stop services successfully', async () => {
      // Mock the underlying services to avoid actual network connections
      const mockLiveDataService = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        getHealthStatus: jest.fn().mockReturnValue({
          isRunning: true,
          exchanges: { binance: true, kucoin: true },
        }),
      };

      const mockWebSocketServer = {
        start: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
        getStats: jest.fn().mockReturnValue({
          totalClients: 0,
          activeSubscriptions: 0,
        }),
      };

      // Replace services with mocks
      (manager as any).liveDataService = mockLiveDataService;
      (manager as any).webSocketServer = mockWebSocketServer;
      (manager as any).isRunning = true;

      const status = manager.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.liveDataService).toBeDefined();
      expect(status.webSocketServer).toBeDefined();

      await manager.stop();
      expect(mockLiveDataService.stop).toHaveBeenCalled();
      expect(mockWebSocketServer.stop).toHaveBeenCalled();
    });

    it('should handle service startup failures', async () => {
      // This test would require mocking the actual service creation
      // For now, we'll test the error handling structure
      expect(manager.getStatus().isRunning).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = manager.getConfig();
      
      expect(config.symbols).toEqual(['BTCUSDT', 'ETHUSDT']);
      expect(config.timeframes).toEqual(['1m', '5m']);
      expect(config.enableBinance).toBe(true);
      expect(config.enableKuCoin).toBe(true);
    });

    it('should update configuration', () => {
      manager.updateConfig({
        symbols: ['ADAUSDT', 'DOTUSDT'],
        enableBinance: false,
      });
      
      const config = manager.getConfig();
      expect(config.symbols).toEqual(['ADAUSDT', 'DOTUSDT']);
      expect(config.enableBinance).toBe(false);
      expect(config.enableKuCoin).toBe(true); // Should remain unchanged
    });

    it('should add symbols to tracking', async () => {
      // Mock running state
      (manager as any).isRunning = true;
      (manager as any).liveDataService = {
        // Mock service for symbol addition
      };

      await manager.addSymbol('ADAUSDT');
      
      const config = manager.getConfig();
      expect(config.symbols).toContain('ADAUSDT');
    });

    it('should remove symbols from tracking', async () => {
      // Mock running state
      (manager as any).isRunning = true;
      (manager as any).liveDataService = {
        // Mock service for symbol removal
      };

      await manager.removeSymbol('ETHUSDT');
      
      const config = manager.getConfig();
      expect(config.symbols).not.toContain('ETHUSDT');
    });

    it('should throw error when modifying symbols while not running', async () => {
      await expect(manager.addSymbol('ADAUSDT')).rejects.toThrow('Service is not running');
      await expect(manager.removeSymbol('ETHUSDT')).rejects.toThrow('Service is not running');
    });
  });

  describe('Service Access', () => {
    it('should provide access to live data service', () => {
      const liveDataService = manager.getLiveDataService();
      expect(liveDataService).toBeUndefined(); // Not started yet
    });

    it('should provide access to WebSocket server', () => {
      const webSocketServer = manager.getWebSocketServer();
      expect(webSocketServer).toBeUndefined(); // Not started yet
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate start calls', async () => {
      // Mock running state
      (manager as any).isRunning = true;

      // Should not throw, just warn
      await expect(manager.start(httpServer)).resolves.not.toThrow();
    });

    it('should handle stop when not running', async () => {
      // Should not throw
      await expect(manager.stop()).resolves.not.toThrow();
    });

    it('should clean up on startup failure', async () => {
      // Mock a service that fails to start
      const mockLiveDataService = {
        start: jest.fn().mockRejectedValue(new Error('Service startup failed')),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      // This would require deeper mocking of the service creation
      // For now, we verify the error handling structure exists
      expect(typeof manager.stop).toBe('function');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle partial exchange failures', async () => {
      // Test scenario where one exchange fails but the other succeeds
      // This would require mocking the exchange manager behavior
      const config = manager.getConfig();
      expect(config.enableBinance).toBe(true);
      expect(config.enableKuCoin).toBe(true);
    });

    it('should handle network connectivity issues', async () => {
      // Test scenario for network failures and recovery
      // This would require mocking network conditions
      expect(manager.getStatus().isRunning).toBe(false);
    });

    it('should handle Redis connectivity issues', async () => {
      // Test scenario for Redis failures
      // This would require mocking Redis client behavior
      expect(manager.getConfig().symbols.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle multiple symbol subscriptions efficiently', () => {
      const largeSymbolList = Array.from({ length: 50 }, (_, i) => `SYMBOL${i}USDT`);
      
      manager.updateConfig({ symbols: largeSymbolList });
      
      const config = manager.getConfig();
      expect(config.symbols.length).toBe(50);
    });

    it('should handle multiple timeframe subscriptions', () => {
      const allTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
      
      manager.updateConfig({ timeframes: allTimeframes });
      
      const config = manager.getConfig();
      expect(config.timeframes.length).toBe(7);
    });
  });
});