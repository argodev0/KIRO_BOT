import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from '@/services/WebSocketServer';
import { DataBroadcastService } from '@/services/DataBroadcastService';
import { WebSocketClientManager } from '@/services/WebSocketClientManager';

describe('WebSocket Services Unit Tests', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let dataBroadcastService: DataBroadcastService;
  let clientManager: WebSocketClientManager;

  beforeAll(() => {
    const app = express();
    httpServer = createServer(app);
    
    // Initialize WebSocket services
    wsServer = new WebSocketServer(httpServer);
    dataBroadcastService = new DataBroadcastService(wsServer);
    clientManager = new WebSocketClientManager();
  });

  afterAll(() => {
    if (httpServer) {
      httpServer.close();
    }
    clientManager.shutdown();
    dataBroadcastService.cleanup();
  });

  describe('WebSocketServer', () => {
    it('should initialize correctly', () => {
      expect(wsServer).toBeDefined();
      expect(typeof wsServer.getServerStats).toBe('function');
      expect(typeof wsServer.broadcastToChannel).toBe('function');
      expect(typeof wsServer.broadcastToUser).toBe('function');
      expect(typeof wsServer.broadcastToAll).toBe('function');
    });

    it('should return server stats', () => {
      const stats = wsServer.getServerStats();
      expect(stats).toHaveProperty('connectedClients');
      expect(stats).toHaveProperty('totalChannels');
      expect(stats).toHaveProperty('channelStats');
      expect(typeof stats.connectedClients).toBe('number');
      expect(typeof stats.totalChannels).toBe('number');
      expect(Array.isArray(stats.channelStats)).toBe(true);
    });

    it('should have correct methods for broadcasting', () => {
      expect(typeof wsServer.broadcastToChannel).toBe('function');
      expect(typeof wsServer.broadcastToUser).toBe('function');
      expect(typeof wsServer.broadcastToAll).toBe('function');
      expect(typeof wsServer.getConnectedClientsCount).toBe('function');
      expect(typeof wsServer.getChannelSubscriptionsCount).toBe('function');
    });
  });

  describe('DataBroadcastService', () => {
    it('should initialize correctly', () => {
      expect(dataBroadcastService).toBeDefined();
      expect(typeof dataBroadcastService.broadcastMarketData).toBe('function');
      expect(typeof dataBroadcastService.broadcastTradingSignal).toBe('function');
      expect(typeof dataBroadcastService.broadcastTradeExecution).toBe('function');
      expect(typeof dataBroadcastService.broadcastPositionUpdate).toBe('function');
      expect(typeof dataBroadcastService.broadcastSystemStatus).toBe('function');
    });

    it('should have all required broadcasting methods', () => {
      const methods = [
        'broadcastMarketData',
        'broadcastTradingSignal',
        'broadcastTradeExecution',
        'broadcastPositionUpdate',
        'broadcastSystemStatus',
        'broadcastUserAlert',
        'broadcastRiskAlert',
        'broadcastGridUpdate',
        'broadcastPerformanceMetrics',
        'broadcastBatch',
        'broadcastConnectionHealth'
      ];

      methods.forEach(method => {
        expect(typeof (dataBroadcastService as any)[method]).toBe('function');
      });
    });

    it('should return service stats', () => {
      const stats = dataBroadcastService.getStats();
      expect(stats).toHaveProperty('activeThrottlers');
      expect(stats).toHaveProperty('cachedDataEntries');
      expect(stats).toHaveProperty('wsServerStats');
      expect(typeof stats.activeThrottlers).toBe('number');
      expect(typeof stats.cachedDataEntries).toBe('number');
    });
  });

  describe('WebSocketClientManager', () => {
    it('should initialize correctly', () => {
      expect(clientManager).toBeDefined();
      expect(typeof clientManager.getClientStats).toBe('function');
      expect(typeof clientManager.getAvailableChannels).toBe('function');
      expect(typeof clientManager.validateChannelAccess).toBe('function');
    });

    it('should return client stats', () => {
      const stats = clientManager.getClientStats();
      expect(stats).toHaveProperty('totalClients');
      expect(stats).toHaveProperty('authenticatedClients');
      expect(stats).toHaveProperty('anonymousClients');
      expect(stats).toHaveProperty('channelDistribution');
      expect(typeof stats.totalClients).toBe('number');
      expect(typeof stats.authenticatedClients).toBe('number');
      expect(typeof stats.anonymousClients).toBe('number');
      expect(Array.isArray(stats.channelDistribution)).toBe(true);
    });

    it('should validate channel access correctly', () => {
      // Test public channel access
      expect(clientManager.validateChannelAccess('system_status')).toBe(true);
      
      // Test authenticated channel access
      expect(clientManager.validateChannelAccess('market_data', 'user123')).toBe(true);
      expect(clientManager.validateChannelAccess('market_data')).toBe(false);
      
      // Test admin channel access
      expect(clientManager.validateChannelAccess('admin_alerts', 'user123', 'admin')).toBe(true);
      expect(clientManager.validateChannelAccess('admin_alerts', 'user123', 'user')).toBe(false);
      
      // Test user-specific channel access
      expect(clientManager.validateChannelAccess('user_123_trades', '123')).toBe(true);
      expect(clientManager.validateChannelAccess('user_123_trades', '456')).toBe(false);
      expect(clientManager.validateChannelAccess('user_123_trades', '456', 'admin')).toBe(true);
    });

    it('should return available channels for different user types', () => {
      // Anonymous user
      const anonymousChannels = clientManager.getAvailableChannels();
      expect(anonymousChannels.length).toBeGreaterThan(0);
      expect(anonymousChannels.some(ch => ch.name === 'system_status')).toBe(true);
      expect(anonymousChannels.some(ch => ch.requiresAuth)).toBe(false);

      // Regular user
      const userChannels = clientManager.getAvailableChannels('user123', 'user');
      expect(userChannels.length).toBeGreaterThan(anonymousChannels.length);
      expect(userChannels.some(ch => ch.name === 'market_data')).toBe(true);
      expect(userChannels.some(ch => ch.name === 'user_user123_trades')).toBe(true);
      expect(userChannels.some(ch => ch.adminOnly)).toBe(false);

      // Admin user
      const adminChannels = clientManager.getAvailableChannels('admin123', 'admin');
      expect(adminChannels.length).toBeGreaterThan(userChannels.length);
      expect(adminChannels.some(ch => ch.name === 'admin_alerts')).toBe(true);
      expect(adminChannels.some(ch => ch.adminOnly)).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should have all services properly integrated', () => {
      // Test that services can work together
      expect(wsServer).toBeDefined();
      expect(dataBroadcastService).toBeDefined();
      expect(clientManager).toBeDefined();

      // Test that DataBroadcastService has reference to WebSocketServer
      const broadcastStats = dataBroadcastService.getStats();
      expect(broadcastStats.wsServerStats).toBeDefined();
    });

    it('should handle market data broadcasting', () => {
      const marketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        change24h: 2.5,
        timestamp: Date.now()
      };

      // This should not throw an error
      expect(() => {
        dataBroadcastService.broadcastMarketData(marketData);
      }).not.toThrow();
    });

    it('should handle trading signal broadcasting', () => {
      const signal = {
        id: 'signal-1',
        symbol: 'ETHUSDT',
        direction: 'long' as const,
        confidence: 0.85,
        entryPrice: 3000,
        stopLoss: 2900,
        takeProfit: [3100, 3200],
        timestamp: Date.now()
      };

      // This should not throw an error
      expect(() => {
        dataBroadcastService.broadcastTradingSignal(signal);
      }).not.toThrow();
    });

    it('should handle system status broadcasting', () => {
      const systemStatus = {
        status: 'healthy' as const,
        services: [
          {
            name: 'database',
            status: 'up' as const,
            latency: 10
          },
          {
            name: 'redis',
            status: 'up' as const,
            latency: 5
          }
        ],
        timestamp: Date.now()
      };

      // This should not throw an error
      expect(() => {
        dataBroadcastService.broadcastSystemStatus(systemStatus);
      }).not.toThrow();
    });
  });
});