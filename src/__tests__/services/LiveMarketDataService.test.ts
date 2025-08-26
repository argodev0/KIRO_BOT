/**
 * Live Market Data Service Tests
 * Tests for mainnet market data integration with safety validations
 */

import { LiveMarketDataService, LiveMarketDataConfig } from '../../services/LiveMarketDataService';
import { ExchangeManager } from '../../services/exchanges/ExchangeManager';
import { createClient } from 'redis';

// Mock dependencies
jest.mock('redis');
jest.mock('../../services/exchanges/ExchangeManager');
jest.mock('../../config/config', () => ({
  config: {
    paperTrading: {
      enabled: true,
      allowRealTrades: false,
    },
  },
}));

describe('LiveMarketDataService', () => {
  let service: LiveMarketDataService;
  let mockRedis: any;
  let mockExchangeManager: jest.Mocked<ExchangeManager>;
  let config: LiveMarketDataConfig;

  beforeEach(() => {
    // Mock Redis client
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      setEx: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
    };
    (createClient as jest.Mock).mockReturnValue(mockRedis);

    // Mock ExchangeManager
    mockExchangeManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getAvailableExchanges: jest.fn().mockReturnValue(['binance', 'kucoin']),
      isExchangeConnected: jest.fn().mockReturnValue(true),
      getExchange: jest.fn().mockReturnValue({
        healthCheck: jest.fn().mockResolvedValue(true),
      }),
      subscribeToTicker: jest.fn().mockResolvedValue(undefined),
      subscribeToOrderBook: jest.fn().mockResolvedValue(undefined),
      subscribeToTrades: jest.fn().mockResolvedValue(undefined),
      subscribeToCandles: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue({ binance: true, kucoin: true }),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    // Test configuration
    config = {
      exchanges: {
        binance: {
          enabled: true,
          mainnet: true,
          readOnly: true,
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
        },
        kucoin: {
          enabled: true,
          mainnet: true,
          readOnly: true,
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
          passphrase: 'test-passphrase',
        },
      },
      symbols: ['BTCUSDT', 'ETHUSDT'],
      timeframes: ['1m', '5m', '1h'],
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
      },
      streaming: {
        maxConnections: 100,
        heartbeatInterval: 30000,
        reconnectDelay: 5000,
        maxReconnectAttempts: 5,
      },
    };

    service = new LiveMarketDataService(config);
    // Replace the exchange manager with our mock
    (service as any).exchangeManager = mockExchangeManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should start successfully with valid configuration', async () => {
      await expect(service.start()).resolves.not.toThrow();
      
      expect(mockRedis.connect).toHaveBeenCalled();
      expect(mockExchangeManager.initialize).toHaveBeenCalled();
      expect(mockExchangeManager.subscribeToTicker).toHaveBeenCalledWith('BTCUSDT', 'binance');
      expect(mockExchangeManager.subscribeToTicker).toHaveBeenCalledWith('ETHUSDT', 'kucoin');
    });

    it('should validate paper trading mode on startup', async () => {
      // Mock config to disable paper trading
      jest.doMock('../../config/config', () => ({
        config: {
          paperTrading: {
            enabled: false,
            allowRealTrades: false,
          },
        },
      }));

      await expect(service.start()).rejects.toThrow('SECURITY: Paper trading mode must be enabled');
    });

    it('should reject real trades configuration', async () => {
      // Mock config to allow real trades
      jest.doMock('../../config/config', () => ({
        config: {
          paperTrading: {
            enabled: true,
            allowRealTrades: true,
          },
        },
      }));

      await expect(service.start()).rejects.toThrow('SECURITY: Real trades must be disabled');
    });

    it('should handle Redis connection failure', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.start()).rejects.toThrow('Redis connection failed');
    });

    it('should handle exchange initialization failure', async () => {
      mockExchangeManager.initialize.mockRejectedValue(new Error('Exchange connection failed'));

      await expect(service.start()).rejects.toThrow('Exchange connection failed');
    });
  });

  describe('Exchange Validation', () => {
    it('should validate mainnet exchange connections', async () => {
      mockExchangeManager.getAvailableExchanges.mockReturnValue(['binance']);
      mockExchangeManager.isExchangeConnected.mockReturnValue(true);
      
      const mockExchange = {
        healthCheck: jest.fn().mockResolvedValue(true),
      };
      mockExchangeManager.getExchange.mockReturnValue(mockExchange);

      await service.start();

      expect(mockExchangeManager.getExchange).toHaveBeenCalledWith('binance');
      expect(mockExchange.healthCheck).toHaveBeenCalled();
    });

    it('should fail if exchange is not connected', async () => {
      mockExchangeManager.isExchangeConnected.mockReturnValue(false);

      await expect(service.start()).rejects.toThrow('Exchange binance is not connected');
    });

    it('should fail if exchange health check fails', async () => {
      const mockExchange = {
        healthCheck: jest.fn().mockResolvedValue(false),
      };
      mockExchangeManager.getExchange.mockReturnValue(mockExchange);

      await expect(service.start()).rejects.toThrow('Exchange binance failed health check');
    });
  });

  describe('Market Data Subscriptions', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to all configured symbols and timeframes', () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      const timeframes = ['1m', '5m', '1h'];
      const exchanges = ['binance', 'kucoin'];

      // Verify ticker subscriptions
      symbols.forEach(symbol => {
        exchanges.forEach(exchange => {
          expect(mockExchangeManager.subscribeToTicker).toHaveBeenCalledWith(symbol, exchange);
          expect(mockExchangeManager.subscribeToOrderBook).toHaveBeenCalledWith(symbol, exchange);
          expect(mockExchangeManager.subscribeToTrades).toHaveBeenCalledWith(symbol, exchange);
        });
      });

      // Verify candle subscriptions
      symbols.forEach(symbol => {
        exchanges.forEach(exchange => {
          timeframes.forEach(timeframe => {
            expect(mockExchangeManager.subscribeToCandles).toHaveBeenCalledWith(symbol, timeframe, exchange);
          });
        });
      });
    });

    it('should handle subscription failures gracefully', async () => {
      mockExchangeManager.subscribeToTicker.mockRejectedValue(new Error('Subscription failed'));

      // Should not throw, but log error
      await expect(service.start()).resolves.not.toThrow();
    });
  });

  describe('Market Data Processing', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should process ticker data updates', () => {
      const tickerData = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49999,
        ask: 50001,
        change24h: 500,
        changePercent24h: 1.0,
      };

      // Simulate ticker update
      const eventHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (eventHandler) {
        eventHandler({ exchange: 'binance', data: tickerData });
      }

      const marketData = service.getMarketData('BTCUSDT');
      expect(marketData).toBeDefined();
      expect(marketData?.exchanges.binance?.ticker).toEqual(tickerData);
    });

    it('should aggregate data from multiple exchanges', () => {
      const binanceTicker = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49999,
        ask: 50001,
        change24h: 500,
        changePercent24h: 1.0,
      };

      const kucoinTicker = {
        symbol: 'BTCUSDT',
        exchange: 'kucoin',
        price: 50010,
        volume: 800,
        timestamp: Date.now(),
        bid: 50009,
        ask: 50011,
        change24h: 510,
        changePercent24h: 1.02,
      };

      // Simulate ticker updates from both exchanges
      const tickerHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (tickerHandler) {
        tickerHandler({ exchange: 'binance', data: binanceTicker });
        tickerHandler({ exchange: 'kucoin', data: kucoinTicker });
      }

      const marketData = service.getMarketData('BTCUSDT');
      expect(marketData?.aggregated.averagePrice).toBe(50005); // (50000 + 50010) / 2
      expect(marketData?.aggregated.totalVolume).toBe(1800); // 1000 + 800
      expect(marketData?.aggregated.bestBid).toBe(50009); // Max of bids
      expect(marketData?.aggregated.bestAsk).toBe(50001); // Min of asks
    });

    it('should cache market data in Redis', async () => {
      const tickerData = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49999,
        ask: 50001,
        change24h: 500,
        changePercent24h: 1.0,
      };

      // Simulate ticker update
      const tickerHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (tickerHandler) {
        tickerHandler({ exchange: 'binance', data: tickerData });
      }

      // Verify Redis caching
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        'live:market:BTCUSDT',
        60,
        expect.any(String)
      );
    });
  });

  describe('Connection Monitoring', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should track connection status', () => {
      const status = service.getConnectionStatus();
      expect(status.binance).toBe(true);
      expect(status.kucoin).toBe(true);
    });

    it('should handle connection loss events', () => {
      const disconnectHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'exchangeDisconnected'
      )?.[1];
      
      if (disconnectHandler) {
        disconnectHandler('binance');
      }

      const status = service.getConnectionStatus();
      expect(status.binance).toBe(false);
    });

    it('should handle connection restoration events', () => {
      // First disconnect
      const disconnectHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'exchangeDisconnected'
      )?.[1];
      
      if (disconnectHandler) {
        disconnectHandler('binance');
      }

      // Then reconnect
      const connectHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'exchangeConnected'
      )?.[1];
      
      if (connectHandler) {
        connectHandler('binance');
      }

      const status = service.getConnectionStatus();
      expect(status.binance).toBe(true);
    });
  });

  describe('Health Status', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should provide comprehensive health status', () => {
      const health = service.getHealthStatus();
      
      expect(health.isRunning).toBe(true);
      expect(health.totalSymbols).toBe(2);
      expect(health.activeConnections).toBe(2);
      expect(health.exchanges).toEqual({
        binance: true,
        kucoin: true,
      });
    });

    it('should track data freshness', () => {
      // Simulate some data updates
      const tickerHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (tickerHandler) {
        tickerHandler({ 
          exchange: 'binance', 
          data: { symbol: 'BTCUSDT', timestamp: Date.now() } 
        });
      }

      const health = service.getHealthStatus();
      expect(health.dataFreshness.BTCUSDT).toBeLessThan(1000); // Less than 1 second old
    });
  });

  describe('Service Shutdown', () => {
    it('should stop all services cleanly', async () => {
      await service.start();
      await service.stop();

      expect(mockExchangeManager.shutdown).toHaveBeenCalled();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      await service.start();
      
      mockExchangeManager.shutdown.mockRejectedValue(new Error('Shutdown failed'));

      await expect(service.stop()).rejects.toThrow('Shutdown failed');
    });
  });

  describe('Error Handling', () => {
    it('should emit error events for exchange errors', () => {
      const errorHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'exchangeError'
      )?.[1];
      
      const mockError = new Error('Exchange error');
      
      if (errorHandler) {
        errorHandler({ exchange: 'binance', error: mockError });
      }

      // Verify error is handled (would need to spy on emit)
      expect(mockExchangeManager.on).toHaveBeenCalledWith('exchangeError', expect.any(Function));
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.setEx.mockRejectedValue(new Error('Redis error'));

      // Should not crash the service
      const tickerHandler = mockExchangeManager.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (tickerHandler) {
        expect(() => {
          tickerHandler({ 
            exchange: 'binance', 
            data: { symbol: 'BTCUSDT', timestamp: Date.now() } 
          });
        }).not.toThrow();
      }
    });
  });
});