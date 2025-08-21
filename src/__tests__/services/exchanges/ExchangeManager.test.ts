/**
 * Exchange Manager Tests
 * Unit tests for exchange management functionality
 */

import { ExchangeManager, ExchangeManagerConfig } from '../../../services/exchanges/ExchangeManager';
import { BinanceExchange } from '../../../services/exchanges/BinanceExchange';
import { KuCoinExchange } from '../../../services/exchanges/KuCoinExchange';

// Mock the exchange classes
jest.mock('../../../services/exchanges/BinanceExchange');
jest.mock('../../../services/exchanges/KuCoinExchange');

describe('ExchangeManager', () => {
  const mockConfig: ExchangeManagerConfig = {
    exchanges: {
      binance: {
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        enabled: true,
        testnet: true,
      },
      kucoin: {
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        passphrase: 'test-passphrase',
        enabled: true,
        sandbox: true,
      },
    },
    defaultExchange: 'binance',
  };

  let exchangeManager: ExchangeManager;
  let mockBinanceExchange: jest.Mocked<BinanceExchange>;
  let mockKuCoinExchange: jest.Mocked<KuCoinExchange>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockBinanceExchange = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      healthCheck: jest.fn().mockResolvedValue(true),
      getTicker: jest.fn(),
      getOrderBook: jest.fn(),
      getCandles: jest.fn(),
      getRecentTrades: jest.fn(),
      subscribeToTicker: jest.fn(),
      subscribeToOrderBook: jest.fn(),
      subscribeToTrades: jest.fn(),
      subscribeToCandles: jest.fn(),
      placeOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getOrder: jest.fn(),
      getOpenOrders: jest.fn(),
      getOrderHistory: jest.fn(),
      getBalance: jest.fn(),
      getPositions: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    mockKuCoinExchange = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      healthCheck: jest.fn().mockResolvedValue(true),
      getTicker: jest.fn(),
      getOrderBook: jest.fn(),
      getCandles: jest.fn(),
      getRecentTrades: jest.fn(),
      subscribeToTicker: jest.fn(),
      subscribeToOrderBook: jest.fn(),
      subscribeToTrades: jest.fn(),
      subscribeToCandles: jest.fn(),
      placeOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getOrder: jest.fn(),
      getOpenOrders: jest.fn(),
      getOrderHistory: jest.fn(),
      getBalance: jest.fn(),
      getPositions: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    // Mock the constructors
    (BinanceExchange as jest.MockedClass<typeof BinanceExchange>).mockImplementation(() => mockBinanceExchange);
    (KuCoinExchange as jest.MockedClass<typeof KuCoinExchange>).mockImplementation(() => mockKuCoinExchange);

    exchangeManager = new ExchangeManager(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize all enabled exchanges', async () => {
      await exchangeManager.initialize();

      expect(BinanceExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
          enabled: true,
          testnet: true,
        })
      );

      expect(KuCoinExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
          apiSecret: 'test-api-secret',
          passphrase: 'test-passphrase',
          enabled: true,
          sandbox: true,
        })
      );

      expect(mockBinanceExchange.connect).toHaveBeenCalled();
      expect(mockKuCoinExchange.connect).toHaveBeenCalled();
    });

    it('should only initialize enabled exchanges', async () => {
      const configWithDisabledExchange: ExchangeManagerConfig = {
        ...mockConfig,
        exchanges: {
          ...mockConfig.exchanges,
          kucoin: {
            ...mockConfig.exchanges.kucoin!,
            enabled: false,
          },
        },
      };

      const manager = new ExchangeManager(configWithDisabledExchange);
      await manager.initialize();

      expect(BinanceExchange).toHaveBeenCalled();
      expect(KuCoinExchange).not.toHaveBeenCalled();
    });
  });

  describe('exchange management', () => {
    beforeEach(async () => {
      await exchangeManager.initialize();
    });

    it('should return available exchanges', () => {
      const exchanges = exchangeManager.getAvailableExchanges();
      expect(exchanges).toContain('binance');
      expect(exchanges).toContain('kucoin');
    });

    it('should return exchange instance', () => {
      const binanceExchange = exchangeManager.getExchange('binance');
      expect(binanceExchange).toBe(mockBinanceExchange);
    });

    it('should check exchange connection status', () => {
      const isConnected = exchangeManager.isExchangeConnected('binance');
      expect(isConnected).toBe(true);
      expect(mockBinanceExchange.isConnected).toHaveBeenCalled();
    });

    it('should shutdown all exchanges', async () => {
      await exchangeManager.shutdown();

      expect(mockBinanceExchange.disconnect).toHaveBeenCalled();
      expect(mockKuCoinExchange.disconnect).toHaveBeenCalled();
    });
  });

  describe('market data operations', () => {
    beforeEach(async () => {
      await exchangeManager.initialize();
    });

    it('should get ticker from default exchange', async () => {
      const mockTicker = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49999,
        ask: 50001,
      };

      mockBinanceExchange.getTicker.mockResolvedValue(mockTicker);

      const ticker = await exchangeManager.getTicker('BTCUSDT');
      
      expect(mockBinanceExchange.getTicker).toHaveBeenCalledWith('BTCUSDT');
      expect(ticker).toEqual(mockTicker);
    });

    it('should get ticker from specific exchange', async () => {
      const mockTicker = {
        symbol: 'BTCUSDT',
        exchange: 'kucoin',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49999,
        ask: 50001,
      };

      mockKuCoinExchange.getTicker.mockResolvedValue(mockTicker);

      const ticker = await exchangeManager.getTicker('BTCUSDT', 'kucoin');
      
      expect(mockKuCoinExchange.getTicker).toHaveBeenCalledWith('BTCUSDT');
      expect(ticker).toEqual(mockTicker);
    });

    it('should get candles from exchange', async () => {
      const mockCandles = [
        {
          symbol: 'BTCUSDT',
          timeframe: '1h' as const,
          timestamp: Date.now(),
          open: 50000,
          high: 51000,
          low: 49000,
          close: 50500,
          volume: 100,
        },
      ];

      mockBinanceExchange.getCandles.mockResolvedValue(mockCandles);

      const candles = await exchangeManager.getCandles('BTCUSDT', '1h', 100);
      
      expect(mockBinanceExchange.getCandles).toHaveBeenCalledWith('BTCUSDT', '1h', 100, undefined, undefined);
      expect(candles).toEqual(mockCandles);
    });
  });

  describe('trading operations', () => {
    beforeEach(async () => {
      await exchangeManager.initialize();
    });

    it('should place order on default exchange', async () => {
      const mockOrder = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 0.001,
        price: 50000,
        exchange: 'binance',
      };

      const mockResponse = {
        orderId: 'order123',
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 0.001,
        price: 50000,
        status: 'new' as const,
        timestamp: Date.now(),
        exchange: 'binance',
      };

      mockBinanceExchange.placeOrder.mockResolvedValue(mockResponse);

      const result = await exchangeManager.placeOrder(mockOrder);
      
      expect(mockBinanceExchange.placeOrder).toHaveBeenCalledWith(mockOrder);
      expect(result).toEqual(mockResponse);
    });

    it('should get balance from exchange', async () => {
      const mockBalance = {
        BTC: 1.5,
        USDT: 10000,
        ETH: 5.2,
      };

      mockBinanceExchange.getBalance.mockResolvedValue(mockBalance);

      const balance = await exchangeManager.getBalance();
      
      expect(mockBinanceExchange.getBalance).toHaveBeenCalled();
      expect(balance).toEqual(mockBalance);
    });
  });

  describe('multi-exchange operations', () => {
    beforeEach(async () => {
      await exchangeManager.initialize();
    });

    it('should get ticker from all exchanges', async () => {
      const binanceTicker = {
        symbol: 'BTCUSDT',
        exchange: 'binance',
        price: 50000,
        volume: 1000,
        timestamp: Date.now(),
        bid: 49999,
        ask: 50001,
      };

      const kucoinTicker = {
        symbol: 'BTCUSDT',
        exchange: 'kucoin',
        price: 50010,
        volume: 800,
        timestamp: Date.now(),
        bid: 50009,
        ask: 50011,
      };

      mockBinanceExchange.getTicker.mockResolvedValue(binanceTicker);
      mockKuCoinExchange.getTicker.mockResolvedValue(kucoinTicker);

      const tickers = await exchangeManager.getTickerFromAllExchanges('BTCUSDT');
      
      expect(tickers.binance).toEqual(binanceTicker);
      expect(tickers.kucoin).toEqual(kucoinTicker);
    });

    it('should perform health check on all exchanges', async () => {
      mockBinanceExchange.healthCheck.mockResolvedValue(true);
      mockKuCoinExchange.healthCheck.mockResolvedValue(false);

      const healthStatus = await exchangeManager.healthCheck();
      
      expect(healthStatus.binance).toBe(true);
      expect(healthStatus.kucoin).toBe(false);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await exchangeManager.initialize();
    });

    it('should throw error for unavailable exchange', async () => {
      await expect(
        exchangeManager.getTicker('BTCUSDT', 'nonexistent' as any)
      ).rejects.toThrow('Exchange nonexistent is not available or not connected');
    });

    it('should handle exchange connection failures gracefully', async () => {
      mockBinanceExchange.connect.mockRejectedValue(new Error('Connection failed'));
      
      const manager = new ExchangeManager(mockConfig);
      
      await expect(manager.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await exchangeManager.initialize();
    });

    it('should return exchange statistics', () => {
      const stats = exchangeManager.getStatistics();
      
      expect(stats.binance).toEqual({
        connected: true,
        subscriptions: 0,
      });
      
      expect(stats.kucoin).toEqual({
        connected: true,
        subscriptions: 0,
      });
    });
  });
});