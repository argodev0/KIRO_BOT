import { createServer } from 'http';
import express from 'express';
import Client from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from '@/services/WebSocketServer';
import { DataBroadcastService } from '@/services/DataBroadcastService';
import { WebSocketClientManager } from '@/services/WebSocketClientManager';
import { config } from '@/config/config';

describe('WebSocket Integration Tests', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let dataBroadcastService: DataBroadcastService;
  let clientManager: WebSocketClientManager;
  let clientSocket: any;
  let port: number;

  beforeAll((done) => {
    const app = express();
    httpServer = createServer(app);
    
    // Find available port
    httpServer.listen(0, () => {
      port = httpServer.address()?.port;
      
      // Initialize WebSocket services
      wsServer = new WebSocketServer(httpServer);
      dataBroadcastService = new DataBroadcastService(wsServer);
      clientManager = new WebSocketClientManager();
      
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    
    clientManager.shutdown();
    dataBroadcastService.cleanup();
    httpServer.close(done);
  });

  beforeEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should reject connection without token', (done) => {
      clientSocket = Client(`http://localhost:${port}`);
      
      clientSocket.on('connect_error', (error: any) => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: 'invalid-token'
        }
      });
      
      clientSocket.on('connect_error', (error: any) => {
        expect(error.message).toContain('Invalid authentication token');
        done();
      });
    });

    it('should accept connection with valid token', (done) => {
      const token = jwt.sign(
        { userId: 'test-user-1', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error: any) => {
        done(error);
      });
    });
  });

  describe('Channel Subscriptions', () => {
    let token: string;

    beforeEach(() => {
      token = jwt.sign(
        { userId: 'test-user-1', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
    });

    it('should allow subscription to authorized channels', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { channels: ['market_data', 'trading_signals'] });
      });

      clientSocket.on('subscription_confirmed', (data: any) => {
        expect(data.data.channels).toContain('market_data');
        expect(data.data.channels).toContain('trading_signals');
        done();
      });
    });

    it('should reject subscription to unauthorized channels', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { channels: ['admin_alerts', 'system_metrics'] });
      });

      clientSocket.on('subscription_confirmed', (data: any) => {
        expect(data.data.channels).not.toContain('admin_alerts');
        expect(data.data.channels).not.toContain('system_metrics');
        done();
      });
    });

    it('should allow admin to subscribe to admin channels', (done) => {
      const adminToken = jwt.sign(
        { userId: 'admin-user', email: 'admin@example.com', role: 'admin' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: adminToken }
      });
      
      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { channels: ['admin_alerts', 'system_metrics'] });
      });

      clientSocket.on('subscription_confirmed', (data: any) => {
        expect(data.data.channels).toContain('admin_alerts');
        expect(data.data.channels).toContain('system_metrics');
        done();
      });
    });
  });

  describe('Data Broadcasting', () => {
    let token: string;

    beforeEach((done) => {
      token = jwt.sign(
        { userId: 'test-user-1', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { channels: ['market_data'] });
      });

      clientSocket.on('subscription_confirmed', () => {
        done();
      });
    });

    it('should receive market data updates', (done) => {
      const marketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        change24h: 2.5,
        timestamp: Date.now()
      };

      clientSocket.on('message', (message: any) => {
        if (message.type === 'market_data_update') {
          expect(message.data.symbol).toBe('BTCUSDT');
          expect(message.data.price).toBe(50000);
          done();
        }
      });

      // Simulate market data broadcast
      setTimeout(() => {
        dataBroadcastService.broadcastMarketData(marketData);
      }, 100);
    });

    it('should receive trading signals', (done) => {
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

      clientSocket.emit('subscribe', { channels: ['trading_signals'] });

      clientSocket.on('message', (message: any) => {
        if (message.type === 'trading_signal') {
          expect(message.data.symbol).toBe('ETHUSDT');
          expect(message.data.direction).toBe('long');
          expect(message.data.confidence).toBe(0.85);
          done();
        }
      });

      setTimeout(() => {
        dataBroadcastService.broadcastTradingSignal(signal);
      }, 100);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', (done) => {
      const token = jwt.sign(
        { userId: 'test-user-rate-limit', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      let connectAttempts = 0;
      let rateLimitHit = false;

      clientSocket.on('connect', () => {
        connectAttempts++;
        // Rapidly send many requests to trigger rate limit
        for (let i = 0; i < 150; i++) {
          clientSocket.emit('subscribe', { channels: ['market_data'] });
        }
      });

      clientSocket.on('connect_error', (error: any) => {
        if (error.message.includes('Rate limit exceeded')) {
          rateLimitHit = true;
          expect(rateLimitHit).toBe(true);
          done();
        }
      });

      // If no rate limit is hit within 2 seconds, fail the test
      setTimeout(() => {
        if (!rateLimitHit) {
          done(new Error('Rate limit was not enforced'));
        }
      }, 2000);
    });
  });

  describe('Connection Management', () => {
    it('should handle ping/pong correctly', (done) => {
      const token = jwt.sign(
        { userId: 'test-user-ping', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        clientSocket.emit('ping');
      });

      clientSocket.on('pong', (data: any) => {
        expect(data.timestamp).toBeDefined();
        expect(typeof data.timestamp).toBe('number');
        done();
      });
    });

    it('should track client statistics', (done) => {
      const token = jwt.sign(
        { userId: 'test-user-stats', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        const stats = wsServer.getServerStats();
        expect(stats.connections.total).toBeGreaterThan(0);
        done();
      });
    });
  });

  describe('User-Specific Channels', () => {
    it('should allow users to subscribe to their own channels', (done) => {
      const token = jwt.sign(
        { userId: 'test-user-specific', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { 
          channels: ['user_test-user-specific_trades', 'user_test-user-specific_positions'] 
        });
      });

      clientSocket.on('subscription_confirmed', (data: any) => {
        expect(data.data.channels).toContain('user_test-user-specific_trades');
        expect(data.data.channels).toContain('user_test-user-specific_positions');
        done();
      });
    });

    it('should prevent users from subscribing to other users channels', (done) => {
      const token = jwt.sign(
        { userId: 'test-user-1', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { 
          channels: ['user_other-user_trades'] 
        });
      });

      clientSocket.on('subscription_confirmed', (data: any) => {
        expect(data.data.channels).not.toContain('user_other-user_trades');
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed subscription requests', (done) => {
      const token = jwt.sign(
        { userId: 'test-user-error', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        // Send malformed subscription request
        clientSocket.emit('subscribe', { invalid: 'data' });
        
        // Should still be connected after malformed request
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      });
    });
  });
});