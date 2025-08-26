/**
 * Live Data WebSocket Server Tests
 * Tests for real-time market data streaming via WebSocket
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Client as SocketIOClient } from 'socket.io-client';
import { LiveDataWebSocketServer } from '../../services/LiveDataWebSocketServer';
import { LiveMarketDataService } from '../../services/LiveMarketDataService';

// Mock config
jest.mock('../../config/config', () => ({
  config: {
    websocket: {
      cors: {
        origin: 'http://localhost:3000',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 100,
      },
    },
  },
}));

describe('LiveDataWebSocketServer', () => {
  let httpServer: HttpServer;
  let wsServer: LiveDataWebSocketServer;
  let mockLiveDataService: jest.Mocked<LiveMarketDataService>;
  let clientSocket: SocketIOClient;
  let serverPort: number;

  beforeEach((done) => {
    // Create HTTP server
    httpServer = new HttpServer();
    
    // Mock LiveMarketDataService
    mockLiveDataService = {
      getAllMarketData: jest.fn().mockReturnValue({
        BTCUSDT: {
          symbol: 'BTCUSDT',
          timestamp: Date.now(),
          exchanges: {
            binance: {
              ticker: {
                symbol: 'BTCUSDT',
                price: 50000,
                volume: 1000,
                timestamp: Date.now(),
              },
              connectionStatus: 'connected',
              lastUpdate: Date.now(),
            },
          },
          aggregated: {
            averagePrice: 50000,
            totalVolume: 1000,
            priceSpread: 2,
            bestBid: 49999,
            bestAsk: 50001,
            confidence: 95,
          },
        },
      }),
      getMarketData: jest.fn().mockReturnValue({
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        exchanges: {
          binance: {
            ticker: {
              symbol: 'BTCUSDT',
              price: 50000,
              volume: 1000,
              timestamp: Date.now(),
            },
            connectionStatus: 'connected',
            lastUpdate: Date.now(),
          },
        },
        aggregated: {
          averagePrice: 50000,
          totalVolume: 1000,
          priceSpread: 2,
          bestBid: 49999,
          bestAsk: 50001,
          confidence: 95,
        },
      }),
      getConnectionStatus: jest.fn().mockReturnValue({
        binance: true,
        kucoin: true,
      }),
      getHealthStatus: jest.fn().mockReturnValue({
        isRunning: true,
        exchanges: { binance: true, kucoin: true },
        dataFreshness: { BTCUSDT: 1000 },
        totalSymbols: 1,
        activeConnections: 2,
      }),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    // Create WebSocket server
    wsServer = new LiveDataWebSocketServer(httpServer, mockLiveDataService);
    
    // Start HTTP server on random port
    httpServer.listen(() => {
      const address = httpServer.address();
      serverPort = typeof address === 'object' && address ? address.port : 3000;
      wsServer.start();
      done();
    });
  });

  afterEach((done) => {
    if (clientSocket) {
      clientSocket.close();
    }
    
    wsServer.stop().then(() => {
      httpServer.close(done);
    });
  });

  describe('Server Initialization', () => {
    it('should start WebSocket server successfully', () => {
      expect(wsServer).toBeDefined();
      const stats = wsServer.getStats();
      expect(stats.totalClients).toBe(0);
      expect(stats.activeSubscriptions).toBe(0);
    });

    it('should set up live data service event handlers', () => {
      expect(mockLiveDataService.on).toHaveBeenCalledWith('marketDataUpdate', expect.any(Function));
      expect(mockLiveDataService.on).toHaveBeenCalledWith('exchangeConnected', expect.any(Function));
      expect(mockLiveDataService.on).toHaveBeenCalledWith('exchangeDisconnected', expect.any(Function));
      expect(mockLiveDataService.on).toHaveBeenCalledWith('healthCheck', expect.any(Function));
    });
  });

  describe('Client Connection', () => {
    it('should handle client connections', (done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      
      clientSocket.on('connected', (data) => {
        expect(data.clientId).toBeDefined();
        expect(data.serverTime).toBeDefined();
        expect(data.availableSymbols).toBeDefined();
        expect(data.connectionStatus).toBeDefined();
        
        const stats = wsServer.getStats();
        expect(stats.totalClients).toBe(1);
        done();
      });
    });

    it('should handle client disconnections', (done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      
      clientSocket.on('connected', () => {
        clientSocket.close();
        
        setTimeout(() => {
          const stats = wsServer.getStats();
          expect(stats.totalClients).toBe(0);
          done();
        }, 100);
      });
    });
  });

  describe('Market Data Subscriptions', () => {
    beforeEach((done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      clientSocket.on('connected', () => done());
    });

    it('should handle single symbol subscription', (done) => {
      clientSocket.emit('subscribe', { symbol: 'BTCUSDT' });
      
      clientSocket.on('subscribed', (data) => {
        expect(data.symbols).toContain('BTCUSDT');
        expect(data.timestamp).toBeDefined();
        
        const stats = wsServer.getStats();
        expect(stats.symbolSubscriptions.BTCUSDT).toBe(1);
        done();
      });
    });

    it('should handle multiple symbol subscription', (done) => {
      clientSocket.emit('subscribe', { symbols: ['BTCUSDT', 'ETHUSDT'] });
      
      clientSocket.on('subscribed', (data) => {
        expect(data.symbols).toContain('BTCUSDT');
        expect(data.symbols).toContain('ETHUSDT');
        done();
      });
    });

    it('should send current market data on subscription', (done) => {
      clientSocket.emit('subscribe', { symbol: 'BTCUSDT' });
      
      clientSocket.on('marketData', (data) => {
        expect(data.type).toBe('marketData');
        expect(data.symbol).toBe('BTCUSDT');
        expect(data.data).toBeDefined();
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    it('should handle subscription to unavailable symbol', (done) => {
      mockLiveDataService.getMarketData.mockReturnValue(undefined);
      
      clientSocket.emit('subscribe', { symbol: 'INVALID' });
      
      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Symbol INVALID not available');
        done();
      });
    });
  });

  describe('Market Data Unsubscription', () => {
    beforeEach((done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      clientSocket.on('connected', () => {
        clientSocket.emit('subscribe', { symbols: ['BTCUSDT', 'ETHUSDT'] });
        clientSocket.on('subscribed', () => done());
      });
    });

    it('should handle single symbol unsubscription', (done) => {
      clientSocket.emit('unsubscribe', { symbol: 'BTCUSDT' });
      
      clientSocket.on('unsubscribed', (data) => {
        expect(data.symbols).toContain('BTCUSDT');
        expect(data.remainingSubscriptions).toContain('ETHUSDT');
        expect(data.remainingSubscriptions).not.toContain('BTCUSDT');
        done();
      });
    });

    it('should handle multiple symbol unsubscription', (done) => {
      clientSocket.emit('unsubscribe', { symbols: ['BTCUSDT', 'ETHUSDT'] });
      
      clientSocket.on('unsubscribed', (data) => {
        expect(data.symbols).toEqual(['BTCUSDT', 'ETHUSDT']);
        expect(data.remainingSubscriptions).toEqual([]);
        done();
      });
    });
  });

  describe('Market Data Requests', () => {
    beforeEach((done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      clientSocket.on('connected', () => done());
    });

    it('should handle single symbol data request', (done) => {
      clientSocket.emit('getMarketData', { symbol: 'BTCUSDT' });
      
      clientSocket.on('marketDataResponse', (data) => {
        expect(data.symbol).toBe('BTCUSDT');
        expect(data.data).toBeDefined();
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    it('should handle multiple symbol data request', (done) => {
      clientSocket.emit('getMarketData', { symbols: ['BTCUSDT', 'ETHUSDT'] });
      
      clientSocket.on('marketDataResponse', (data) => {
        expect(data.data.BTCUSDT).toBeDefined();
        expect(data.data.ETHUSDT).toBeDefined();
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    it('should handle all symbols data request', (done) => {
      clientSocket.emit('getMarketData', {});
      
      clientSocket.on('marketDataResponse', (data) => {
        expect(data.data).toBeDefined();
        expect(data.data.BTCUSDT).toBeDefined();
        expect(data.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe('Health Status', () => {
    beforeEach((done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      clientSocket.on('connected', () => done());
    });

    it('should handle health status requests', (done) => {
      clientSocket.emit('getHealthStatus');
      
      clientSocket.on('healthStatus', (data) => {
        expect(data.isRunning).toBe(true);
        expect(data.exchanges).toBeDefined();
        expect(data.totalSymbols).toBeDefined();
        expect(data.activeConnections).toBeDefined();
        done();
      });
    });
  });

  describe('Rate Limiting', () => {
    beforeEach((done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      clientSocket.on('connected', () => done());
    });

    it('should enforce rate limits', (done) => {
      let errorReceived = false;
      
      clientSocket.on('error', (error) => {
        if (error.message === 'Rate limit exceeded') {
          errorReceived = true;
        }
      });
      
      // Send many requests quickly to trigger rate limit
      for (let i = 0; i < 150; i++) {
        clientSocket.emit('getMarketData', { symbol: 'BTCUSDT' });
      }
      
      setTimeout(() => {
        expect(errorReceived).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Ping/Pong', () => {
    beforeEach((done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      clientSocket.on('connected', () => done());
    });

    it('should handle ping/pong for connection monitoring', (done) => {
      clientSocket.emit('ping');
      
      clientSocket.on('pong', (data) => {
        expect(data.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe('Market Data Broadcasting', () => {
    beforeEach((done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      clientSocket.on('connected', () => {
        clientSocket.emit('subscribe', { symbol: 'BTCUSDT' });
        clientSocket.on('subscribed', () => done());
      });
    });

    it('should broadcast market data updates to subscribed clients', (done) => {
      // Simulate market data update from live data service
      const marketDataHandler = mockLiveDataService.on.mock.calls.find(
        call => call[0] === 'marketDataUpdate'
      )?.[1];
      
      if (marketDataHandler) {
        const updateData = {
          symbol: 'BTCUSDT',
          data: {
            symbol: 'BTCUSDT',
            timestamp: Date.now(),
            aggregated: { averagePrice: 51000 },
          },
        };
        
        marketDataHandler(updateData);
      }
      
      clientSocket.on('marketData', (data) => {
        if (data.symbol === 'BTCUSDT') {
          expect(data.type).toBe('marketData');
          expect(data.data).toBeDefined();
          done();
        }
      });
    });

    it('should broadcast exchange status updates', (done) => {
      // Simulate exchange connection event
      const exchangeConnectedHandler = mockLiveDataService.on.mock.calls.find(
        call => call[0] === 'exchangeConnected'
      )?.[1];
      
      if (exchangeConnectedHandler) {
        exchangeConnectedHandler('binance');
      }
      
      clientSocket.on('exchangeStatus', (data) => {
        expect(data.type).toBe('exchangeStatus');
        expect(data.exchange).toBe('binance');
        expect(data.status).toBe('connected');
        done();
      });
    });

    it('should broadcast health check results', (done) => {
      // Simulate health check event
      const healthCheckHandler = mockLiveDataService.on.mock.calls.find(
        call => call[0] === 'healthCheck'
      )?.[1];
      
      if (healthCheckHandler) {
        healthCheckHandler({ binance: true, kucoin: false });
      }
      
      clientSocket.on('healthCheck', (data) => {
        expect(data.type).toBe('healthCheck');
        expect(data.data).toBeDefined();
        done();
      });
    });

    it('should broadcast data warnings', (done) => {
      // Simulate stale data warning
      const staleDataHandler = mockLiveDataService.on.mock.calls.find(
        call => call[0] === 'staleData'
      )?.[1];
      
      if (staleDataHandler) {
        staleDataHandler({ symbol: 'BTCUSDT', age: 120000 });
      }
      
      clientSocket.on('dataWarning', (data) => {
        expect(data.type).toBe('staleData');
        expect(data.symbol).toBe('BTCUSDT');
        expect(data.age).toBe(120000);
        done();
      });
    });
  });

  describe('Server Statistics', () => {
    it('should provide accurate server statistics', () => {
      const stats = wsServer.getStats();
      
      expect(stats).toHaveProperty('totalClients');
      expect(stats).toHaveProperty('activeSubscriptions');
      expect(stats).toHaveProperty('symbolSubscriptions');
      expect(stats).toHaveProperty('rateLimitViolations');
      
      expect(typeof stats.totalClients).toBe('number');
      expect(typeof stats.activeSubscriptions).toBe('number');
      expect(typeof stats.symbolSubscriptions).toBe('object');
      expect(typeof stats.rateLimitViolations).toBe('number');
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      clientSocket.on('connected', () => done());
    });

    it('should handle client errors gracefully', (done) => {
      // Simulate client error
      clientSocket.emit('error', new Error('Test error'));
      
      // Server should continue operating
      setTimeout(() => {
        const stats = wsServer.getStats();
        expect(stats.totalClients).toBe(1);
        done();
      }, 100);
    });

    it('should handle malformed subscription requests', (done) => {
      clientSocket.emit('subscribe', { invalidField: 'test' });
      
      // Should handle gracefully without crashing
      setTimeout(() => {
        const stats = wsServer.getStats();
        expect(stats.totalClients).toBe(1);
        done();
      }, 100);
    });
  });
});