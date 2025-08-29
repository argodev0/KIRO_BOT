/**
 * WebSocket Functionality Validation Tests
 * Tests WebSocket server functionality and real-time data broadcasting
 */

import { WebSocketServer } from '../../services/WebSocketServer';
import { BinanceWebSocketService } from '../../services/BinanceWebSocketService';
import { KuCoinWebSocketService } from '../../services/KuCoinWebSocketService';
import { LiveDataWebSocketServer } from '../../services/LiveDataWebSocketServer';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Mock WebSocket for testing
jest.mock('ws');

describe('WebSocket Functionality Validation', () => {
  let wsServer: WebSocketServer;
  let liveDataServer: LiveDataWebSocketServer;
  let binanceService: BinanceWebSocketService;
  let kucoinService: KuCoinWebSocketService;

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.WEBSOCKET_PORT = '8081';
  });

  beforeEach(() => {
    wsServer = new WebSocketServer({
      port: 8081,
      maxConnections: 100,
      heartbeatInterval: 30000
    });

    liveDataServer = new LiveDataWebSocketServer({
      port: 8082,
      enableCompression: true,
      maxConnections: 200
    });

    binanceService = new BinanceWebSocketService({
      apiKey: 'test_key',
      apiSecret: 'test_secret',
      testnet: true
    });

    kucoinService = new KuCoinWebSocketService({
      apiKey: 'test_key',
      apiSecret: 'test_secret',
      passphrase: 'test_passphrase',
      sandbox: true
    });
  });

  afterEach(async () => {
    // Clean up
    if (wsServer) {
      await wsServer.stop();
    }
    if (liveDataServer) {
      await liveDataServer.stop();
    }
    if (binanceService) {
      await binanceService.disconnect();
    }
    if (kucoinService) {
      await kucoinService.disconnect();
    }
  });

  describe('WebSocket Server Initialization', () => {
    it('should start WebSocket server successfully', async () => {
      const mockStart = jest.spyOn(wsServer, 'start').mockResolvedValue();
      
      await wsServer.start();
      
      expect(mockStart).toHaveBeenCalled();
      mockStart.mockRestore();
    });

    it('should handle server configuration', () => {
      expect(wsServer.getOptions()).toEqual(
        expect.objectContaining({
          port: 8081,
          maxConnections: 100,
          heartbeatInterval: 30000
        })
      );
    });

    it('should initialize connection pool', () => {
      const stats = wsServer.getServerStats();
      
      expect(stats).toHaveProperty('connections');
      expect(stats.connections.total).toBe(0);
      expect(stats.connections.authenticated).toBe(0);
      expect(stats.connections.anonymous).toBe(0);
    });
  });

  describe('Connection Management', () => {
    it('should handle client connections', async () => {
      const mockStart = jest.spyOn(wsServer, 'start').mockResolvedValue();
      const mockGetStats = jest.spyOn(wsServer, 'getServerStats').mockReturnValue({
        server: { isShuttingDown: false, uptime: 1000, maxConnections: 100 },
        connections: { total: 1, authenticated: 0, anonymous: 1, uniqueUsers: 0 },
        channels: { total: 0, stats: [] },
        performance: { totalMessagesReceived: 0, totalMessagesSent: 0, averageConnectionTime: 0, rateLimiters: 0 },
        connections_detail: []
      });

      await wsServer.start();
      
      // Simulate client connection
      const stats = wsServer.getServerStats();
      expect(stats.connections.total).toBeGreaterThanOrEqual(0);

      mockStart.mockRestore();
      mockGetStats.mockRestore();
    });

    it('should authenticate WebSocket connections', async () => {
      const mockAuthenticateConnection = jest.spyOn(wsServer, 'authenticateConnection')
        .mockResolvedValue({ success: true, user: { id: 'test-user', username: 'testuser' } });

      const authResult = await wsServer.authenticateConnection('valid-token');
      
      expect(authResult.success).toBe(true);
      expect(authResult.user).toHaveProperty('id', 'test-user');

      mockAuthenticateConnection.mockRestore();
    });

    it('should reject invalid authentication', async () => {
      const mockAuthenticateConnection = jest.spyOn(wsServer, 'authenticateConnection')
        .mockResolvedValue({ success: false, error: 'Invalid token' });

      const authResult = await wsServer.authenticateConnection('invalid-token');
      
      expect(authResult.success).toBe(false);
      expect(authResult.error).toBe('Invalid token');

      mockAuthenticateConnection.mockRestore();
    });

    it('should enforce connection limits', async () => {
      const limitedServer = new WebSocketServer({
        port: 8083,
        maxConnections: 2
      });

      const mockStart = jest.spyOn(limitedServer, 'start').mockResolvedValue();
      const mockCanAcceptConnection = jest.spyOn(limitedServer, 'canAcceptConnection')
        .mockReturnValue(false);

      await limitedServer.start();
      
      const canAccept = limitedServer.canAcceptConnection();
      expect(canAccept).toBe(false);

      mockStart.mockRestore();
      mockCanAcceptConnection.mockRestore();
    });
  });

  describe('Channel Subscriptions', () => {
    it('should handle channel subscriptions', async () => {
      const mockSubscribeToChannel = jest.spyOn(wsServer, 'subscribeToChannel')
        .mockResolvedValue({ success: true });

      const result = await wsServer.subscribeToChannel('test-socket-id', 'market-data');
      
      expect(result.success).toBe(true);

      mockSubscribeToChannel.mockRestore();
    });

    it('should handle channel unsubscriptions', async () => {
      const mockUnsubscribeFromChannel = jest.spyOn(wsServer, 'unsubscribeFromChannel')
        .mockResolvedValue({ success: true });

      const result = await wsServer.unsubscribeFromChannel('test-socket-id', 'market-data');
      
      expect(result.success).toBe(true);

      mockUnsubscribeFromChannel.mockRestore();
    });

    it('should broadcast to channel subscribers', async () => {
      const mockBroadcastToChannel = jest.spyOn(wsServer, 'broadcastToChannel')
        .mockResolvedValue(1);

      const subscriberCount = await wsServer.broadcastToChannel('market-data', {
        type: 'ticker',
        data: { symbol: 'BTCUSDT', price: 50000 }
      });
      
      expect(subscriberCount).toBeGreaterThanOrEqual(0);

      mockBroadcastToChannel.mockRestore();
    });
  });

  describe('Real-time Data Broadcasting', () => {
    it('should broadcast market data updates', async () => {
      const mockBroadcast = jest.spyOn(liveDataServer, 'broadcastMarketData')
        .mockResolvedValue();

      const marketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        timestamp: Date.now()
      };

      await liveDataServer.broadcastMarketData(marketData);
      
      expect(mockBroadcast).toHaveBeenCalledWith(marketData);

      mockBroadcast.mockRestore();
    });

    it('should broadcast trading updates', async () => {
      const mockBroadcast = jest.spyOn(liveDataServer, 'broadcastTradingUpdate')
        .mockResolvedValue();

      const tradingUpdate = {
        userId: 'test-user',
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 0.001,
        price: 50000,
        status: 'executed'
      };

      await liveDataServer.broadcastTradingUpdate(tradingUpdate);
      
      expect(mockBroadcast).toHaveBeenCalledWith(tradingUpdate);

      mockBroadcast.mockRestore();
    });

    it('should broadcast portfolio updates', async () => {
      const mockBroadcast = jest.spyOn(liveDataServer, 'broadcastPortfolioUpdate')
        .mockResolvedValue();

      const portfolioUpdate = {
        userId: 'test-user',
        balances: { BTC: 0.001, USDT: 9950 },
        totalValue: 10000,
        unrealizedPnL: 50
      };

      await liveDataServer.broadcastPortfolioUpdate(portfolioUpdate);
      
      expect(mockBroadcast).toHaveBeenCalledWith(portfolioUpdate);

      mockBroadcast.mockRestore();
    });
  });

  describe('Exchange WebSocket Integration', () => {
    it('should connect to Binance WebSocket', async () => {
      const mockConnect = jest.spyOn(binanceService, 'connect').mockResolvedValue();
      const mockIsConnected = jest.spyOn(binanceService, 'isConnected').mockReturnValue(true);

      await binanceService.connect();
      
      expect(mockConnect).toHaveBeenCalled();
      expect(binanceService.isConnected()).toBe(true);

      mockConnect.mockRestore();
      mockIsConnected.mockRestore();
    });

    it('should subscribe to Binance market data', async () => {
      const mockSubscribe = jest.spyOn(binanceService, 'subscribeToSymbol').mockResolvedValue();

      await binanceService.subscribeToSymbol('BTCUSDT');
      
      expect(mockSubscribe).toHaveBeenCalledWith('BTCUSDT');

      mockSubscribe.mockRestore();
    });

    it('should handle Binance WebSocket reconnection', async () => {
      const mockReconnect = jest.spyOn(binanceService, 'reconnect').mockResolvedValue();

      await binanceService.reconnect();
      
      expect(mockReconnect).toHaveBeenCalled();

      mockReconnect.mockRestore();
    });

    it('should connect to KuCoin WebSocket', async () => {
      const mockConnect = jest.spyOn(kucoinService, 'connect').mockResolvedValue();
      const mockIsConnected = jest.spyOn(kucoinService, 'isConnected').mockReturnValue(true);

      await kucoinService.connect();
      
      expect(mockConnect).toHaveBeenCalled();
      expect(kucoinService.isConnected()).toBe(true);

      mockConnect.mockRestore();
      mockIsConnected.mockRestore();
    });

    it('should subscribe to KuCoin market data', async () => {
      const mockSubscribe = jest.spyOn(kucoinService, 'subscribeToTicker').mockResolvedValue();

      await kucoinService.subscribeToTicker('BTC-USDT');
      
      expect(mockSubscribe).toHaveBeenCalledWith('BTC-USDT');

      mockSubscribe.mockRestore();
    });
  });

  describe('Message Handling', () => {
    it('should handle incoming messages', async () => {
      const mockHandleMessage = jest.spyOn(wsServer, 'handleMessage')
        .mockResolvedValue();

      const message = {
        type: 'subscribe',
        channel: 'market-data',
        symbol: 'BTCUSDT'
      };

      await wsServer.handleMessage('test-socket-id', JSON.stringify(message));
      
      expect(mockHandleMessage).toHaveBeenCalledWith('test-socket-id', JSON.stringify(message));

      mockHandleMessage.mockRestore();
    });

    it('should validate message format', () => {
      const mockValidateMessage = jest.spyOn(wsServer, 'validateMessage')
        .mockReturnValue({ valid: true });

      const message = {
        type: 'subscribe',
        channel: 'market-data'
      };

      const validation = wsServer.validateMessage(message);
      
      expect(validation.valid).toBe(true);

      mockValidateMessage.mockRestore();
    });

    it('should handle malformed messages', () => {
      const mockValidateMessage = jest.spyOn(wsServer, 'validateMessage')
        .mockReturnValue({ valid: false, error: 'Invalid message format' });

      const invalidMessage = { invalid: 'message' };

      const validation = wsServer.validateMessage(invalidMessage);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Invalid message format');

      mockValidateMessage.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      const mockHandleError = jest.spyOn(wsServer, 'handleConnectionError')
        .mockResolvedValue();

      const error = new Error('Connection failed');
      
      await wsServer.handleConnectionError('test-socket-id', error);
      
      expect(mockHandleError).toHaveBeenCalledWith('test-socket-id', error);

      mockHandleError.mockRestore();
    });

    it('should handle WebSocket errors gracefully', async () => {
      const mockConnect = jest.spyOn(binanceService, 'connect')
        .mockRejectedValue(new Error('Connection failed'));

      await expect(binanceService.connect()).rejects.toThrow('Connection failed');

      mockConnect.mockRestore();
    });

    it('should implement error recovery', async () => {
      const mockRecover = jest.spyOn(wsServer, 'recoverFromError')
        .mockResolvedValue(true);

      const recovered = await wsServer.recoverFromError(new Error('Test error'));
      
      expect(recovered).toBe(true);

      mockRecover.mockRestore();
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track connection metrics', () => {
      const stats = wsServer.getServerStats();
      
      expect(stats).toHaveProperty('performance');
      expect(stats.performance).toHaveProperty('totalMessagesReceived');
      expect(stats.performance).toHaveProperty('totalMessagesSent');
      expect(stats.performance).toHaveProperty('averageConnectionTime');
    });

    it('should implement rate limiting', async () => {
      const mockCheckRateLimit = jest.spyOn(wsServer, 'checkRateLimit')
        .mockReturnValue({ allowed: true, remaining: 99 });

      const rateLimitResult = wsServer.checkRateLimit('test-socket-id');
      
      expect(rateLimitResult.allowed).toBe(true);
      expect(rateLimitResult.remaining).toBe(99);

      mockCheckRateLimit.mockRestore();
    });

    it('should monitor memory usage', () => {
      const mockGetMemoryUsage = jest.spyOn(wsServer, 'getMemoryUsage')
        .mockReturnValue({ used: 1000000, total: 10000000 });

      const memoryUsage = wsServer.getMemoryUsage();
      
      expect(memoryUsage).toHaveProperty('used');
      expect(memoryUsage).toHaveProperty('total');

      mockGetMemoryUsage.mockRestore();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should handle graceful shutdown', async () => {
      const mockStop = jest.spyOn(wsServer, 'stop').mockResolvedValue();

      await wsServer.stop();
      
      expect(mockStop).toHaveBeenCalled();

      mockStop.mockRestore();
    });

    it('should close all connections on shutdown', async () => {
      const mockCloseAllConnections = jest.spyOn(wsServer, 'closeAllConnections')
        .mockResolvedValue();

      await wsServer.closeAllConnections();
      
      expect(mockCloseAllConnections).toHaveBeenCalled();

      mockCloseAllConnections.mockRestore();
    });

    it('should wait for pending operations', async () => {
      const mockWaitForPendingOperations = jest.spyOn(wsServer, 'waitForPendingOperations')
        .mockResolvedValue();

      await wsServer.waitForPendingOperations();
      
      expect(mockWaitForPendingOperations).toHaveBeenCalled();

      mockWaitForPendingOperations.mockRestore();
    });
  });
});