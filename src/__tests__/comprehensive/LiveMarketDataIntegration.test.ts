/**
 * Comprehensive Live Market Data Integration Tests
 * Integration tests for live market data connections with mainnet exchanges
 * Requirements: 3.1, 3.2
 */

import { LiveMarketDataService } from '../../services/LiveMarketDataService';
import { LiveDataWebSocketServer } from '../../services/LiveDataWebSocketServer';
import { BinanceExchange } from '../../services/exchanges/BinanceExchange';
import { KuCoinExchange } from '../../services/exchanges/KuCoinExchange';
import { ExchangeManager } from '../../services/exchanges/ExchangeManager';
import { Server as HttpServer } from 'http';
import WebSocket from 'ws';

// Mock external dependencies
jest.mock('../../services/exchanges/BinanceExchange');
jest.mock('../../services/exchanges/KuCoinExchange');

describe('Comprehensive Live Market Data Integration Tests', () => {
  let liveDataService: LiveMarketDataService;
  let webSocketServer: LiveDataWebSocketServer;
  let exchangeManager: ExchangeManager;
  let httpServer: HttpServer;
  let mockBinanceExchange: jest.Mocked<BinanceExchange>;
  let mockKuCoinExchange: jest.Mocked<KuCoinExchange>;

  beforeEach(() => {
    // Create HTTP server for WebSocket testing
    httpServer = new HttpServer();
    
    // Create mock exchanges
    mockBinanceExchange = new BinanceExchange({
      apiKey: 'test-binance-key',
      apiSecret: 'test-binance-secret',
      sandbox: false
    }) as jest.Mocked<BinanceExchange>;

    mockKuCoinExchange = new KuCoinExchange({
      apiKey: 'test-kucoin-key',
      apiSecret: 'test-kucoin-secret',
      passphrase: 'test-passphrase',
      sandbox: false
    }) as jest.Mocked<KuCoinExchange>;

    // Mock exchange methods
    mockBinanceExchange.connect = jest.fn().mockResolvedValue(undefined);
    mockBinanceExchange.disconnect = jest.fn().mockResolvedValue(undefined);
    mockBinanceExchange.subscribeToTicker = jest.fn().mockResolvedValue(undefined);
    mockBinanceExchange.subscribeToKlines = jest.fn().mockResolvedValue(undefined);
    mockBinanceExchange.getTickerPrice = jest.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      price: 50000,
      timestamp: Date.now()
    });
    mockBinanceExchange.validateConnection = jest.fn().mockResolvedValue(true);
    mockBinanceExchange.getConnectionStatus = jest.fn().mockReturnValue({
      isConnected: true,
      lastHeartbeat: Date.now(),
      subscriptions: ['BTCUSDT@ticker', 'BTCUSDT@kline_1m']
    });

    mockKuCoinExchange.connect = jest.fn().mockResolvedValue(undefined);
    mockKuCoinExchange.disconnect = jest.fn().mockResolvedValue(undefined);
    mockKuCoinExchange.subscribeToTicker = jest.fn().mockResolvedValue(undefined);
    mockKuCoinExchange.subscribeToKlines = jest.fn().mockResolvedValue(undefined);
    mockKuCoinExchange.getTickerPrice = jest.fn().mockResolvedValue({
      symbol: 'BTC-USDT',
      price: 50100,
      timestamp: Date.now()
    });
    mockKuCoinExchange.validateConnection = jest.fn().mockResolvedValue(true);
    mockKuCoinExchange.getConnectionStatus = jest.fn().mockReturnValue({
      isConnected: true,
      lastHeartbeat: Date.now(),
      subscriptions: ['BTC-USDT:ticker', 'BTC-USDT:kline_1m']
    });

    // Create services
    exchangeManager = new ExchangeManager();
    liveDataService = new LiveMarketDataService({
      symbols: ['BTCUSDT', 'ETHUSDT'],
      timeframes: ['1m', '5m'],
      exchanges: ['binance', 'kucoin']
    });
    
    webSocketServer = new LiveDataWebSocketServer({
      port: 8080,
      cors: {
        origin: 'http://localhost:3000',
        credentials: true
      }
    });

    // Inject mock exchanges
    (exchangeManager as any).exchanges.set('binance', mockBinanceExchange);
    (exchangeManager as any).exchanges.set('kucoin', mockKuCoinExchange);
    (liveDataService as any).exchangeManager = exchangeManager;
  });

  afterEach(async () => {
    if (liveDataService) {
      await liveDataService.stop();
    }
    if (webSocketServer) {
      await webSocketServer.stop();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  describe('Live Data Service Initialization', () => {
    test('should initialize with proper configuration', () => {
      expect(liveDataService).toBeDefined();
      
      const config = liveDataService.getConfig();
      expect(config.symbols).toContain('BTCUSDT');
      expect(config.symbols).toContain('ETHUSDT');
      expect(config.timeframes).toContain('1m');
      expect(config.timeframes).toContain('5m');
      expect(config.exchanges).toContain('binance');
      expect(config.exchanges).toContain('kucoin');
    });

    test('should validate paper trading mode before starting', async () => {
      // Mock environment validation
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PAPER_TRADING_MODE: 'true',
        ALLOW_REAL_TRADES: 'false'
      };

      await expect(liveDataService.start()).resolves.not.toThrow();

      process.env = originalEnv;
    });

    test('should reject startup if paper trading is disabled', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        PAPER_TRADING_MODE: 'false',
        ALLOW_REAL_TRADES: 'true'
      };

      await expect(liveDataService.start()).rejects.toThrow(
        'Paper trading mode must be enabled for live market data'
      );

      process.env = originalEnv;
    });
  });

  describe('Exchange Connection Management', () => {
    test('should connect to all configured exchanges', async () => {
      await liveDataService.start();

      expect(mockBinanceExchange.connect).toHaveBeenCalled();
      expect(mockKuCoinExchange.connect).toHaveBeenCalled();
    });

    test('should validate exchange connections', async () => {
      await liveDataService.start();

      expect(mockBinanceExchange.validateConnection).toHaveBeenCalled();
      expect(mockKuCoinExchange.validateConnection).toHaveBeenCalled();
    });

    test('should handle partial exchange connection failures', async () => {
      // Mock Binance connection failure
      mockBinanceExchange.connect.mockRejectedValue(new Error('Binance connection failed'));

      await liveDataService.start();

      // Should still connect to KuCoin
      expect(mockKuCoinExchange.connect).toHaveBeenCalled();
      
      const healthStatus = liveDataService.getHealthStatus();
      expect(healthStatus.exchanges.kucoin).toBe(true);
      expect(healthStatus.exchanges.binance).toBe(false);
    });

    test('should reconnect on connection loss', async () => {
      await liveDataService.start();

      // Simulate connection loss
      mockBinanceExchange.getConnectionStatus.mockReturnValue({
        isConnected: false,
        lastHeartbeat: Date.now() - 60000, // 1 minute ago
        subscriptions: []
      });

      // Trigger reconnection check
      await liveDataService.checkConnections();

      // Should attempt to reconnect
      expect(mockBinanceExchange.connect).toHaveBeenCalledTimes(2);
    });

    test('should disconnect from all exchanges on stop', async () => {
      await liveDataService.start();
      await liveDataService.stop();

      expect(mockBinanceExchange.disconnect).toHaveBeenCalled();
      expect(mockKuCoinExchange.disconnect).toHaveBeenCalled();
    });
  });

  describe('Market Data Subscription Management', () => {
    test('should subscribe to ticker data for all symbols', async () => {
      await liveDataService.start();

      expect(mockBinanceExchange.subscribeToTicker).toHaveBeenCalledWith('BTCUSDT');
      expect(mockBinanceExchange.subscribeToTicker).toHaveBeenCalledWith('ETHUSDT');
      expect(mockKuCoinExchange.subscribeToTicker).toHaveBeenCalledWith('BTC-USDT');
      expect(mockKuCoinExchange.subscribeToTicker).toHaveBeenCalledWith('ETH-USDT');
    });

    test('should subscribe to kline data for all timeframes', async () => {
      await liveDataService.start();

      expect(mockBinanceExchange.subscribeToKlines).toHaveBeenCalledWith('BTCUSDT', '1m');
      expect(mockBinanceExchange.subscribeToKlines).toHaveBeenCalledWith('BTCUSDT', '5m');
      expect(mockKuCoinExchange.subscribeToKlines).toHaveBeenCalledWith('BTC-USDT', '1min');
      expect(mockKuCoinExchange.subscribeToKlines).toHaveBeenCalledWith('BTC-USDT', '5min');
    });

    test('should handle symbol addition during runtime', async () => {
      await liveDataService.start();

      await liveDataService.addSymbol('ADAUSDT');

      expect(mockBinanceExchange.subscribeToTicker).toHaveBeenCalledWith('ADAUSDT');
      expect(mockKuCoinExchange.subscribeToTicker).toHaveBeenCalledWith('ADA-USDT');
    });

    test('should handle symbol removal during runtime', async () => {
      await liveDataService.start();

      await liveDataService.removeSymbol('ETHUSDT');

      const config = liveDataService.getConfig();
      expect(config.symbols).not.toContain('ETHUSDT');
    });
  });

  describe('Real-time Data Processing', () => {
    test('should process and normalize ticker data from multiple exchanges', async () => {
      await liveDataService.start();

      // Simulate ticker data from exchanges
      const binanceTickerData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        change24h: 2.5,
        timestamp: Date.now()
      };

      const kucoinTickerData = {
        symbol: 'BTC-USDT',
        price: 50100,
        volume: 950,
        change24h: 2.3,
        timestamp: Date.now()
      };

      // Emit ticker events
      mockBinanceExchange.emit('ticker', binanceTickerData);
      mockKuCoinExchange.emit('ticker', kucoinTickerData);

      // Allow processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      const aggregatedData = liveDataService.getAggregatedData('BTCUSDT');
      expect(aggregatedData).toBeDefined();
      expect(aggregatedData.exchanges).toHaveProperty('binance');
      expect(aggregatedData.exchanges).toHaveProperty('kucoin');
    });

    test('should process and normalize kline data from multiple exchanges', async () => {
      await liveDataService.start();

      const binanceKlineData = {
        symbol: 'BTCUSDT',
        interval: '1m',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: 49900,
        high: 50100,
        low: 49800,
        close: 50000,
        volume: 10.5
      };

      const kucoinKlineData = {
        symbol: 'BTC-USDT',
        interval: '1min',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: 49950,
        high: 50150,
        low: 49850,
        close: 50100,
        volume: 9.8
      };

      // Emit kline events
      mockBinanceExchange.emit('kline', binanceKlineData);
      mockKuCoinExchange.emit('kline', kucoinKlineData);

      // Allow processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      const klineData = liveDataService.getKlineData('BTCUSDT', '1m');
      expect(klineData).toBeDefined();
      expect(klineData.length).toBeGreaterThan(0);
    });

    test('should handle data validation and filtering', async () => {
      await liveDataService.start();

      // Simulate invalid ticker data
      const invalidTickerData = {
        symbol: 'BTCUSDT',
        price: -1000, // Invalid negative price
        volume: 'invalid', // Invalid volume type
        timestamp: 'invalid' // Invalid timestamp
      };

      // Should not crash on invalid data
      expect(() => {
        mockBinanceExchange.emit('ticker', invalidTickerData);
      }).not.toThrow();

      // Valid data should still be processed
      const validTickerData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        change24h: 2.5,
        timestamp: Date.now()
      };

      mockBinanceExchange.emit('ticker', validTickerData);

      await new Promise(resolve => setTimeout(resolve, 100));

      const aggregatedData = liveDataService.getAggregatedData('BTCUSDT');
      expect(aggregatedData).toBeDefined();
    });
  });

  describe('WebSocket Server Integration', () => {
    test('should start WebSocket server successfully', async () => {
      await webSocketServer.start(httpServer);

      const stats = webSocketServer.getStats();
      expect(stats.isRunning).toBe(true);
      expect(stats.port).toBe(8080);
    });

    test('should handle client connections', async () => {
      await webSocketServer.start(httpServer);

      // Simulate client connection
      const mockClient = {
        id: 'test-client-1',
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn(),
        close: jest.fn()
      };

      webSocketServer.addClient(mockClient as any);

      const stats = webSocketServer.getStats();
      expect(stats.totalClients).toBe(1);
    });

    test('should broadcast market data to connected clients', async () => {
      await webSocketServer.start(httpServer);

      const mockClient = {
        id: 'test-client-1',
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn(),
        close: jest.fn()
      };

      webSocketServer.addClient(mockClient as any);

      const marketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        timestamp: Date.now()
      };

      webSocketServer.broadcast('ticker', marketData);

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'ticker',
          data: marketData
        })
      );
    });

    test('should handle client subscriptions', async () => {
      await webSocketServer.start(httpServer);

      const mockClient = {
        id: 'test-client-1',
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn(),
        close: jest.fn()
      };

      webSocketServer.addClient(mockClient as any);

      // Subscribe to specific symbol
      webSocketServer.handleSubscription(mockClient as any, {
        action: 'subscribe',
        channel: 'ticker',
        symbol: 'BTCUSDT'
      });

      const stats = webSocketServer.getStats();
      expect(stats.activeSubscriptions).toBeGreaterThan(0);
    });

    test('should handle client disconnections gracefully', async () => {
      await webSocketServer.start(httpServer);

      const mockClient = {
        id: 'test-client-1',
        send: jest.fn(),
        readyState: WebSocket.CLOSED,
        on: jest.fn(),
        close: jest.fn()
      };

      webSocketServer.addClient(mockClient as any);
      webSocketServer.removeClient('test-client-1');

      const stats = webSocketServer.getStats();
      expect(stats.totalClients).toBe(0);
    });
  });

  describe('Data Aggregation and Normalization', () => {
    test('should aggregate data from multiple exchanges', async () => {
      await liveDataService.start();

      // Simulate data from both exchanges
      const binanceData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        timestamp: Date.now()
      };

      const kucoinData = {
        symbol: 'BTC-USDT',
        price: 50100,
        volume: 950,
        timestamp: Date.now()
      };

      mockBinanceExchange.emit('ticker', binanceData);
      mockKuCoinExchange.emit('ticker', kucoinData);

      await new Promise(resolve => setTimeout(resolve, 100));

      const aggregatedData = liveDataService.getAggregatedData('BTCUSDT');
      
      expect(aggregatedData.symbol).toBe('BTCUSDT');
      expect(aggregatedData.exchanges.binance.price).toBe(50000);
      expect(aggregatedData.exchanges.kucoin.price).toBe(50100);
      expect(aggregatedData.weightedAveragePrice).toBeCloseTo(50050, 0);
    });

    test('should calculate volume-weighted average prices', async () => {
      await liveDataService.start();

      const binanceData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 2000, // Higher volume
        timestamp: Date.now()
      };

      const kucoinData = {
        symbol: 'BTC-USDT',
        price: 50200,
        volume: 1000, // Lower volume
        timestamp: Date.now()
      };

      mockBinanceExchange.emit('ticker', binanceData);
      mockKuCoinExchange.emit('ticker', kucoinData);

      await new Promise(resolve => setTimeout(resolve, 100));

      const aggregatedData = liveDataService.getAggregatedData('BTCUSDT');
      
      // Should be closer to Binance price due to higher volume
      expect(aggregatedData.weightedAveragePrice).toBeLessThan(50100);
      expect(aggregatedData.weightedAveragePrice).toBeGreaterThan(50000);
    });

    test('should handle exchange-specific symbol formats', async () => {
      await liveDataService.start();

      // Binance uses BTCUSDT, KuCoin uses BTC-USDT
      const symbols = liveDataService.normalizeSymbols(['BTCUSDT', 'ETHUSDT']);
      
      expect(symbols.binance).toContain('BTCUSDT');
      expect(symbols.binance).toContain('ETHUSDT');
      expect(symbols.kucoin).toContain('BTC-USDT');
      expect(symbols.kucoin).toContain('ETH-USDT');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle exchange API errors gracefully', async () => {
      mockBinanceExchange.getTickerPrice.mockRejectedValue(new Error('API rate limit exceeded'));

      await liveDataService.start();

      // Should not crash the service
      const healthStatus = liveDataService.getHealthStatus();
      expect(healthStatus.isRunning).toBe(true);
    });

    test('should implement exponential backoff for reconnections', async () => {
      await liveDataService.start();

      // Simulate multiple connection failures
      mockBinanceExchange.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(undefined);

      await liveDataService.reconnectExchange('binance');

      // Should eventually succeed after retries
      expect(mockBinanceExchange.connect).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    test('should handle WebSocket connection errors', async () => {
      // Mock WebSocket server error
      const mockError = new Error('WebSocket server error');
      
      await webSocketServer.start(httpServer);
      
      // Simulate error
      webSocketServer.emit('error', mockError);

      // Should handle error gracefully
      const stats = webSocketServer.getStats();
      expect(stats.isRunning).toBe(true);
    });

    test('should maintain data integrity during partial failures', async () => {
      await liveDataService.start();

      // Simulate Binance failure
      mockBinanceExchange.emit('error', new Error('Binance connection lost'));

      // KuCoin data should still be processed
      const kucoinData = {
        symbol: 'BTC-USDT',
        price: 50100,
        volume: 950,
        timestamp: Date.now()
      };

      mockKuCoinExchange.emit('ticker', kucoinData);

      await new Promise(resolve => setTimeout(resolve, 100));

      const aggregatedData = liveDataService.getAggregatedData('BTCUSDT');
      expect(aggregatedData.exchanges.kucoin).toBeDefined();
    });
  });

  describe('Performance and Monitoring', () => {
    test('should provide comprehensive health status', async () => {
      await liveDataService.start();

      const healthStatus = liveDataService.getHealthStatus();

      expect(healthStatus).toHaveProperty('isRunning');
      expect(healthStatus).toHaveProperty('exchanges');
      expect(healthStatus).toHaveProperty('subscriptions');
      expect(healthStatus).toHaveProperty('dataStats');
      expect(healthStatus).toHaveProperty('uptime');
      expect(healthStatus.exchanges).toHaveProperty('binance');
      expect(healthStatus.exchanges).toHaveProperty('kucoin');
    });

    test('should track data processing metrics', async () => {
      await liveDataService.start();

      // Generate some data
      for (let i = 0; i < 10; i++) {
        mockBinanceExchange.emit('ticker', {
          symbol: 'BTCUSDT',
          price: 50000 + i,
          volume: 1000,
          timestamp: Date.now()
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = liveDataService.getMetrics();
      expect(metrics.totalMessagesProcessed).toBeGreaterThan(0);
      expect(metrics.messagesPerSecond).toBeGreaterThanOrEqual(0);
    });

    test('should handle high-frequency data efficiently', async () => {
      await liveDataService.start();

      const startTime = Date.now();

      // Simulate high-frequency ticker updates
      for (let i = 0; i < 1000; i++) {
        mockBinanceExchange.emit('ticker', {
          symbol: 'BTCUSDT',
          price: 50000 + Math.random() * 100,
          volume: 1000,
          timestamp: Date.now()
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 1000 messages in reasonable time
      expect(processingTime).toBeLessThan(2000);

      const metrics = liveDataService.getMetrics();
      expect(metrics.totalMessagesProcessed).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Configuration Management', () => {
    test('should allow runtime configuration updates', async () => {
      await liveDataService.start();

      const newConfig = {
        symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
        timeframes: ['1m', '5m', '15m'],
        exchanges: ['binance']
      };

      liveDataService.updateConfig(newConfig);

      const config = liveDataService.getConfig();
      expect(config.symbols).toContain('ADAUSDT');
      expect(config.timeframes).toContain('15m');
      expect(config.exchanges).not.toContain('kucoin');
    });

    test('should validate configuration changes', () => {
      const invalidConfig = {
        symbols: [], // Empty symbols array
        timeframes: ['invalid_timeframe'],
        exchanges: ['unsupported_exchange']
      };

      expect(() => {
        liveDataService.updateConfig(invalidConfig);
      }).toThrow('Invalid configuration');
    });
  });
});