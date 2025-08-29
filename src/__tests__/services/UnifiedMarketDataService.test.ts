/**
 * Unified Market Data Service Tests
 * Comprehensive test suite for the unified market data service
 */

import { UnifiedMarketDataService } from '../../services/UnifiedMarketDataService';
import { BinanceWebSocketService } from '../../services/BinanceWebSocketService';
import { KuCoinWebSocketService } from '../../services/KuCoinWebSocketService';
import { TickerData, OrderBookData, TradeData, CandleData } from '../../types/market';

// Mock the WebSocket services
jest.mock('../../services/BinanceWebSocketService');
jest.mock('../../services/KuCoinWebSocketService');
jest.mock('../../utils/logger');

const MockBinanceWebSocketService = BinanceWebSocketService as jest.MockedClass<typeof BinanceWebSocketService>;
const MockKuCoinWebSocketService = KuCoinWebSocketService as jest.MockedClass<typeof KuCoinWebSocketService>;

describe('UnifiedMarketDataService', () => {
  let service: UnifiedMarketDataService;
  let mockBinanceService: jest.Mocked<BinanceWebSocketService>;
  let mockKuCoinService: jest.Mocked<KuCoinWebSocketService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockBinanceService = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      subscribeToTicker: jest.fn().mockResolvedValue(undefined),
      subscribeToOrderBook: jest.fn().mockResolvedValue(undefined),
      subscribeToTrades: jest.fn().mockResolvedValue(undefined),
      subscribeToCandles: jest.fn().mockResolvedValue(undefined),
      subscribeToMajorTradingPairs: jest.fn().mockResolvedValue(undefined),
      subscribeToSymbolComplete: jest.fn().mockResolvedValue(undefined),
      unsubscribeFromSymbol: jest.fn().mockResolvedValue(undefined),
      getConnectionStats: jest.fn().mockReturnValue({
        totalConnections: 5,
        healthyConnections: 5,
        unhealthyConnections: 0,
      }),
      isHealthy: jest.fn().mockReturnValue(true),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    mockKuCoinService = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      subscribeToTicker: jest.fn().mockResolvedValue(undefined),
      subscribeToOrderBook: jest.fn().mockResolvedValue(undefined),
      subscribeToTrades: jest.fn().mockResolvedValue(undefined),
      subscribeToCandles: jest.fn().mockResolvedValue(undefined),
      subscribeToMajorTradingPairs: jest.fn().mockResolvedValue(undefined),
      subscribeToSymbolComplete: jest.fn().mockResolvedValue(undefined),
      unsubscribeFromSymbol: jest.fn().mockResolvedValue(undefined),
      getConnectionStats: jest.fn().mockReturnValue({
        totalConnections: 3,
        healthyConnections: 3,
        unhealthyConnections: 0,
      }),
      isHealthy: jest.fn().mockReturnValue(true),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    MockBinanceWebSocketService.mockImplementation(() => mockBinanceService);
    MockKuCoinWebSocketService.mockImplementation(() => mockKuCoinService);

    service = new UnifiedMarketDataService({
      binance: {
        enabled: true,
        config: { baseURL: 'wss://stream.binance.com:9443/ws' }
      },
      kucoin: {
        enabled: true,
        config: { baseURL: 'https://api.kucoin.com' }
      },
      defaultExchange: 'binance',
      aggregateData: true,
      cacheEnabled: true,
    });
  });

  afterEach(async () => {
    if (service) {
      await service.stop();
    }
  });

  describe('Service Lifecycle', () => {
    it('should start all enabled services', async () => {
      const startedSpy = jest.fn();
      service.on('started', startedSpy);

      await service.start();

      expect(mockBinanceService.start).toHaveBeenCalled();
      expect(mockKuCoinService.start).toHaveBeenCalled();
      expect(startedSpy).toHaveBeenCalled();
    });

    it('should stop all services', async () => {
      await service.start();
      
      const stoppedSpy = jest.fn();
      service.on('stopped', stoppedSpy);

      await service.stop();

      expect(mockBinanceService.stop).toHaveBeenCalled();
      expect(mockKuCoinService.stop).toHaveBeenCalled();
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should start only enabled services', async () => {
      // Clear previous mock calls
      MockBinanceWebSocketService.mockClear();
      MockKuCoinWebSocketService.mockClear();
      
      const limitedService = new UnifiedMarketDataService({
        binance: { enabled: true },
        kucoin: { enabled: false },
      });

      await limitedService.start();

      expect(MockBinanceWebSocketService).toHaveBeenCalled();
      expect(MockKuCoinWebSocketService).not.toHaveBeenCalled();

      await limitedService.stop();
    });

    it('should not start if already running', async () => {
      await service.start();
      
      // Reset call counts
      jest.clearAllMocks();
      
      await service.start();
      
      // Should not call start again
      expect(mockBinanceService.start).not.toHaveBeenCalled();
      expect(mockKuCoinService.start).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should subscribe to ticker on all enabled exchanges', async () => {
      await service.subscribeToTicker('BTCUSDT');

      expect(mockBinanceService.subscribeToTicker).toHaveBeenCalledWith('BTCUSDT');
      expect(mockKuCoinService.subscribeToTicker).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should subscribe to ticker on specific exchanges', async () => {
      await service.subscribeToTicker('BTCUSDT', ['binance']);

      expect(mockBinanceService.subscribeToTicker).toHaveBeenCalledWith('BTCUSDT');
      expect(mockKuCoinService.subscribeToTicker).not.toHaveBeenCalled();
    });

    it('should subscribe to order book on all enabled exchanges', async () => {
      await service.subscribeToOrderBook('BTCUSDT');

      expect(mockBinanceService.subscribeToOrderBook).toHaveBeenCalledWith('BTCUSDT');
      expect(mockKuCoinService.subscribeToOrderBook).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should subscribe to trades on all enabled exchanges', async () => {
      await service.subscribeToTrades('BTCUSDT');

      expect(mockBinanceService.subscribeToTrades).toHaveBeenCalledWith('BTCUSDT');
      expect(mockKuCoinService.subscribeToTrades).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should subscribe to candles on all enabled exchanges', async () => {
      await service.subscribeToCandles('BTCUSDT', '1m');

      expect(mockBinanceService.subscribeToCandles).toHaveBeenCalledWith('BTCUSDT', '1m');
      expect(mockKuCoinService.subscribeToCandles).toHaveBeenCalledWith('BTCUSDT', '1m');
    });

    it('should subscribe to major trading pairs on all exchanges', async () => {
      await service.subscribeToMajorTradingPairs();

      expect(mockBinanceService.subscribeToMajorTradingPairs).toHaveBeenCalled();
      expect(mockKuCoinService.subscribeToMajorTradingPairs).toHaveBeenCalled();
    });

    it('should subscribe to complete symbol data on all exchanges', async () => {
      await service.subscribeToSymbolComplete('BTCUSDT', ['1m', '5m']);

      expect(mockBinanceService.subscribeToSymbolComplete).toHaveBeenCalledWith('BTCUSDT', ['1m', '5m']);
      expect(mockKuCoinService.subscribeToSymbolComplete).toHaveBeenCalledWith('BTCUSDT', ['1m', '5m']);
    });

    it('should unsubscribe from symbol on all exchanges', async () => {
      await service.unsubscribeFromSymbol('BTCUSDT');

      expect(mockBinanceService.unsubscribeFromSymbol).toHaveBeenCalledWith('BTCUSDT');
      expect(mockKuCoinService.unsubscribeFromSymbol).toHaveBeenCalledWith('BTCUSDT');
    });
  });

  describe('Event Forwarding', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should forward Binance ticker events', () => {
      const tickerSpy = jest.fn();
      service.on('ticker', tickerSpy);

      const mockTicker: TickerData = {
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

      // Simulate Binance service emitting ticker
      const binanceTickerHandler = mockBinanceService.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (binanceTickerHandler) {
        binanceTickerHandler(mockTicker);
      }

      expect(tickerSpy).toHaveBeenCalledWith({
        exchange: 'binance',
        data: mockTicker
      });
    });

    it('should forward KuCoin ticker events', () => {
      const tickerSpy = jest.fn();
      service.on('ticker', tickerSpy);

      const mockTicker: TickerData = {
        symbol: 'BTC-USDT',
        exchange: 'kucoin',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49999,
        ask: 50001,
        change24h: 500,
        changePercent24h: 1.0,
      };

      // Simulate KuCoin service emitting ticker
      const kucoinTickerHandler = mockKuCoinService.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (kucoinTickerHandler) {
        kucoinTickerHandler(mockTicker);
      }

      expect(tickerSpy).toHaveBeenCalledWith({
        exchange: 'kucoin',
        data: mockTicker
      });
    });

    it('should forward connection events', () => {
      const connectedSpy = jest.fn();
      service.on('exchangeStarted', connectedSpy);

      // Simulate Binance service starting
      const binanceStartedHandler = mockBinanceService.on.mock.calls.find(
        call => call[0] === 'started'
      )?.[1];
      
      if (binanceStartedHandler) {
        binanceStartedHandler();
      }

      expect(connectedSpy).toHaveBeenCalledWith('binance');
    });
  });

  describe('Data Aggregation', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should aggregate ticker data from multiple exchanges', () => {
      const aggregatedTickerSpy = jest.fn();
      service.on('aggregatedTicker', aggregatedTickerSpy);

      const binanceTicker: TickerData = {
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

      const kucoinTicker: TickerData = {
        symbol: 'BTCUSDT', // Use same symbol for aggregation
        exchange: 'kucoin',
        price: 50100,
        volume: 800,
        timestamp: Date.now() + 1000,
        bid: 50099,
        ask: 50101,
        change24h: 600,
        changePercent24h: 1.2,
      };

      // Simulate ticker events from both exchanges
      const binanceTickerHandler = mockBinanceService.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      const kucoinTickerHandler = mockKuCoinService.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];

      if (binanceTickerHandler) {
        binanceTickerHandler(binanceTicker);
      }

      if (kucoinTickerHandler) {
        kucoinTickerHandler(kucoinTicker);
      }

      // Should be called twice - once for each exchange, then once for aggregated
      expect(aggregatedTickerSpy).toHaveBeenCalled();
      
      // Check the final aggregated call
      const lastCall = aggregatedTickerSpy.mock.calls[aggregatedTickerSpy.mock.calls.length - 1][0];
      expect(lastCall).toEqual(
        expect.objectContaining({
          exchanges: expect.arrayContaining(['binance', 'kucoin']),
          averagePrice: 50050, // (50000 + 50100) / 2
          totalVolume: 1800, // 1000 + 800
          priceSpread: 100, // 50100 - 50000
        })
      );
    });

    it('should cache aggregated data', () => {
      const binanceTicker: TickerData = {
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

      // Simulate ticker event
      const binanceTickerHandler = mockBinanceService.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (binanceTickerHandler) {
        binanceTickerHandler(binanceTicker);
      }

      // Should be able to retrieve from cache
      const cached = service.getAggregatedTicker('BTCUSDT');
      expect(cached).toBeTruthy();
      expect(cached?.symbol).toBe('BTCUSDT');
    });

    it('should return null for non-cached data', () => {
      const cached = service.getAggregatedTicker('NONEXISTENT');
      expect(cached).toBeNull();
    });
  });

  describe('Connection Statistics', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should aggregate connection statistics from all services', () => {
      const stats = service.getConnectionStats();

      expect(stats).toEqual({
        binance: {
          totalConnections: 5,
          healthyConnections: 5,
          unhealthyConnections: 0,
        },
        kucoin: {
          totalConnections: 3,
          healthyConnections: 3,
          unhealthyConnections: 0,
        },
        totalConnections: 8,
        healthyConnections: 8,
        unhealthyConnections: 0,
        overallHealth: true,
      });
    });

    it('should report unhealthy when any service is unhealthy', () => {
      mockBinanceService.isHealthy.mockReturnValue(false);

      const stats = service.getConnectionStats();

      expect(stats.overallHealth).toBe(false);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when at least one service is healthy', async () => {
      await service.start();

      expect(service.isHealthy()).toBe(true);
    });

    it('should report unhealthy when all services are unhealthy', async () => {
      mockBinanceService.isHealthy.mockReturnValue(false);
      mockKuCoinService.isHealthy.mockReturnValue(false);

      await service.start();

      expect(service.isHealthy()).toBe(false);
    });

    it('should report unhealthy when not running', () => {
      expect(service.isHealthy()).toBe(false);
    });

    it('should report healthy with only one service enabled and healthy', async () => {
      const singleService = new UnifiedMarketDataService({
        binance: { enabled: true },
        kucoin: { enabled: false },
      });

      await singleService.start();

      expect(singleService.isHealthy()).toBe(true);

      await singleService.stop();
    });
  });

  describe('Enabled Exchanges', () => {
    it('should return list of enabled exchanges', async () => {
      await service.start();

      const enabled = service.getEnabledExchanges();

      expect(enabled).toEqual(['binance', 'kucoin']);
    });

    it('should return only enabled exchanges', async () => {
      const limitedService = new UnifiedMarketDataService({
        binance: { enabled: true },
        kucoin: { enabled: false },
      });

      await limitedService.start();

      const enabled = limitedService.getEnabledExchanges();

      expect(enabled).toEqual(['binance']);

      await limitedService.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle service start failures gracefully', async () => {
      mockBinanceService.start.mockRejectedValue(new Error('Binance start failed'));

      await expect(service.start()).rejects.toThrow('Binance start failed');
    });

    it('should handle service stop failures gracefully', async () => {
      // Create a new service instance for this test
      const failingKuCoinService = {
        ...mockKuCoinService,
        stop: jest.fn().mockRejectedValue(new Error('KuCoin stop failed')),
      };
      
      MockKuCoinWebSocketService.mockImplementation(() => failingKuCoinService as any);
      
      const testService = new UnifiedMarketDataService({
        binance: { enabled: true },
        kucoin: { enabled: true },
      });
      
      await testService.start();

      // The service should propagate the error from the failing service
      await expect(testService.stop()).rejects.toThrow('KuCoin stop failed');
    });

    it('should handle subscription failures gracefully', async () => {
      await service.start();
      
      mockBinanceService.subscribeToTicker.mockRejectedValue(new Error('Subscription failed'));

      await expect(service.subscribeToTicker('BTCUSDT')).rejects.toThrow('Subscription failed');
    });
  });

  describe('Configuration Options', () => {
    it('should work with aggregation disabled', async () => {
      const noAggregationService = new UnifiedMarketDataService({
        binance: { enabled: true },
        kucoin: { enabled: true },
        aggregateData: false,
      });

      await noAggregationService.start();

      const aggregatedTickerSpy = jest.fn();
      noAggregationService.on('aggregatedTicker', aggregatedTickerSpy);

      // Simulate ticker event - should not trigger aggregation
      const binanceTickerHandler = mockBinanceService.on.mock.calls.find(
        call => call[0] === 'ticker'
      )?.[1];
      
      if (binanceTickerHandler) {
        binanceTickerHandler({
          symbol: 'BTCUSDT',
          exchange: 'binance',
          price: 50000,
          volume: 1000,
          timestamp: Date.now(),
          bid: 49999,
          ask: 50001,
          change24h: 500,
          changePercent24h: 1.0,
        });
      }

      expect(aggregatedTickerSpy).not.toHaveBeenCalled();

      await noAggregationService.stop();
    });

    it('should work with caching disabled', async () => {
      const noCacheService = new UnifiedMarketDataService({
        binance: { enabled: true },
        kucoin: { enabled: true },
        cacheEnabled: false,
      });

      await noCacheService.start();

      const cached = noCacheService.getAggregatedTicker('BTCUSDT');
      expect(cached).toBeNull();

      await noCacheService.stop();
    });
  });
});