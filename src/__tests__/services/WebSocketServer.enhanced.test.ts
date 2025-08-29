/**
 * Enhanced WebSocket Server Tests
 * Tests for the improved WebSocket server functionality
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from '@/services/WebSocketServer';
import { WebSocketConnectionManager } from '@/services/WebSocketConnectionManager';
import { WebSocketAuthService } from '@/services/WebSocketAuthService';
import { config } from '@/config/config';

describe('Enhanced WebSocket Server', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let connectionManager: WebSocketConnectionManager;
  let authService: WebSocketAuthService;
  let clientSocket: Socket;
  let port: number;

  beforeAll((done) => {
    httpServer = createServer();
    wsServer = new WebSocketServer(httpServer);
    connectionManager = new WebSocketConnectionManager();
    authService = new WebSocketAuthService();
    
    httpServer.listen(() => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    wsServer.shutdown().then(() => {
      connectionManager.shutdown().then(() => {
        authService.shutdown();
        httpServer.close(done);
      });
    });
  });

  beforeEach(() => {
    if (clientSocket) {
      clientSocket.close();
    }
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.close();
    }
  });

  describe('Connection Management', () => {
    test('should accept authenticated connections', (done) => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });

      clientSocket.on('connected', (data) => {
        expect(data.type).toBe('connection');
        expect(data.data.userId).toBe('test-user');
        expect(data.data.capabilities).toBeDefined();
        expect(data.data.paperTradingMode).toBe(config.paperTrading.enabled);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    test('should accept anonymous connections when allowed', (done) => {
      clientSocket = Client(`http://localhost:${port}`);

      clientSocket.on('connected', (data) => {
        expect(data.type).toBe('connection');
        expect(data.data.userId).toBeUndefined();
        expect(data.data.capabilities).toBeDefined();
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    test('should reject invalid tokens', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' }
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid authentication token');
        done();
      });
    });

    test('should enforce connection limits', async () => {
      const connections: Socket[] = [];
      const maxConnections = 5; // Set a low limit for testing
      
      // Create connection manager with low limits
      const testConnectionManager = new WebSocketConnectionManager({
        maxConnections: maxConnections
      });

      try {
        // Create connections up to the limit
        for (let i = 0; i < maxConnections + 2; i++) {
          const socket = io(`http://localhost:${port}`);
          connections.push(socket);
        }

        // Wait a bit for connections to be processed
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should have rejected some connections
        const connectedCount = connections.filter(s => s.connected).length;
        expect(connectedCount).toBeLessThanOrEqual(maxConnections);
      } finally {
        // Clean up
        connections.forEach(socket => socket.close());
        await testConnectionManager.shutdown();
      }
    });
  });

  describe('Channel Subscriptions', () => {
    beforeEach((done) => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });

      clientSocket.on('connected', () => {
        done();
      });
    });

    test('should handle channel subscriptions', (done) => {
      const channels = ['market_data', 'price_updates'];

      clientSocket.emit('subscribe', { channels });

      clientSocket.on('subscription_confirmed', (data) => {
        expect(data.type).toBe('subscription_confirmed');
        expect(data.data.subscribed).toEqual(expect.arrayContaining(channels));
        expect(data.data.totalSubscriptions).toBeGreaterThan(0);
        done();
      });
    });

    test('should handle channel unsubscriptions', (done) => {
      const channels = ['market_data'];

      // First subscribe
      clientSocket.emit('subscribe', { channels });

      clientSocket.on('subscription_confirmed', () => {
        // Then unsubscribe
        clientSocket.emit('unsubscribe', { channels });
      });

      clientSocket.on('unsubscription_confirmed', (data) => {
        expect(data.type).toBe('unsubscription_confirmed');
        expect(data.data.unsubscribed).toEqual(channels);
        done();
      });
    });

    test('should validate channel permissions', (done) => {
      const unauthorizedChannels = ['admin_alerts', 'system_metrics'];

      clientSocket.emit('subscribe', { channels: unauthorizedChannels });

      clientSocket.on('subscription_confirmed', (data) => {
        // Should not subscribe to unauthorized channels
        expect(data.data.subscribed).not.toEqual(expect.arrayContaining(unauthorizedChannels));
        done();
      });
    });

    test('should enforce subscription limits', (done) => {
      // Try to subscribe to many channels
      const manyChannels = Array.from({ length: 60 }, (_, i) => `channel_${i}`);

      clientSocket.emit('subscribe', { channels: manyChannels });

      clientSocket.on('subscription_confirmed', (data) => {
        // Should have some failed subscriptions due to limits
        expect(data.data.failed.length).toBeGreaterThan(0);
        expect(data.data.totalSubscriptions).toBeLessThanOrEqual(50);
        done();
      });
    });
  });

  describe('Rate Limiting', () => {
    beforeEach((done) => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });

      clientSocket.on('connected', () => {
        done();
      });
    });

    test('should enforce rate limits', (done) => {
      let errorReceived = false;

      clientSocket.on('error', (error) => {
        if (error.type === 'rate_limit_exceeded') {
          errorReceived = true;
          expect(error.message).toContain('Rate limit exceeded');
          done();
        }
      });

      // Send many messages quickly to trigger rate limit
      for (let i = 0; i < 150; i++) {
        clientSocket.emit('ping');
      }

      // If no rate limit error after 1 second, fail the test
      setTimeout(() => {
        if (!errorReceived) {
          done(new Error('Rate limit was not enforced'));
        }
      }, 1000);
    });
  });

  describe('Real-time Data Broadcasting', () => {
    let client1: Socket;
    let client2: Socket;

    beforeEach((done) => {
      const token1 = jwt.sign(
        { userId: 'user1', email: 'user1@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      const token2 = jwt.sign(
        { userId: 'user2', email: 'user2@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      client1 = Client(`http://localhost:${port}`, { auth: { token: token1 } });
      client2 = Client(`http://localhost:${port}`, { auth: { token: token2 } });

      let connectedCount = 0;
      const onConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          done();
        }
      };

      client1.on('connected', onConnected);
      client2.on('connected', onConnected);
    });

    afterEach(() => {
      if (client1) client1.close();
      if (client2) client2.close();
    });

    test('should broadcast to specific channels', (done) => {
      const testChannel = 'market_data';
      const testMessage = {
        type: 'price_update',
        data: { symbol: 'BTCUSDT', price: 50000 },
        timestamp: Date.now()
      };

      // Subscribe both clients to the channel
      client1.emit('subscribe', { channels: [testChannel] });
      client2.emit('subscribe', { channels: [testChannel] });

      let receivedCount = 0;
      const onMessage = (message: any) => {
        if (message.type === 'price_update') {
          expect(message.data.symbol).toBe('BTCUSDT');
          expect(message.data.price).toBe(50000);
          receivedCount++;
          
          if (receivedCount === 2) {
            done();
          }
        }
      };

      client1.on('message', onMessage);
      client2.on('message', onMessage);

      // Wait for subscriptions to be processed
      setTimeout(() => {
        wsServer.broadcastToChannel(testChannel, testMessage);
      }, 100);
    });

    test('should broadcast to specific users', (done) => {
      const testMessage = {
        type: 'user_notification',
        data: { message: 'Hello user1' },
        timestamp: Date.now()
      };

      client1.on('message', (message) => {
        if (message.type === 'user_notification') {
          expect(message.data.message).toBe('Hello user1');
          done();
        }
      });

      client2.on('message', (message) => {
        if (message.type === 'user_notification') {
          done(new Error('Message should not be received by user2'));
        }
      });

      // Wait for connections to be established
      setTimeout(() => {
        wsServer.broadcastToUser('user1', testMessage);
      }, 100);
    });

    test('should broadcast to all clients', (done) => {
      const testMessage = {
        type: 'system_announcement',
        data: { message: 'System maintenance in 5 minutes' },
        timestamp: Date.now()
      };

      let receivedCount = 0;
      const onMessage = (message: any) => {
        if (message.type === 'system_announcement') {
          expect(message.data.message).toBe('System maintenance in 5 minutes');
          receivedCount++;
          
          if (receivedCount === 2) {
            done();
          }
        }
      };

      client1.on('message', onMessage);
      client2.on('message', onMessage);

      // Wait for connections to be established
      setTimeout(() => {
        wsServer.broadcastToAll(testMessage);
      }, 100);
    });
  });

  describe('Connection Health and Monitoring', () => {
    test('should respond to ping/pong', (done) => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });

      clientSocket.on('connected', () => {
        clientSocket.emit('ping');
      });

      clientSocket.on('pong', (data) => {
        expect(data.timestamp).toBeDefined();
        expect(data.serverTime).toBeDefined();
        done();
      });
    });

    test('should provide server statistics', () => {
      const stats = wsServer.getServerStats();
      
      expect(stats).toHaveProperty('server');
      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('channels');
      expect(stats).toHaveProperty('performance');
      
      expect(stats.server.maxConnections).toBeDefined();
      expect(stats.connections.total).toBeGreaterThanOrEqual(0);
      expect(stats.channels.total).toBeGreaterThanOrEqual(0);
    });

    test('should provide health status', () => {
      const health = wsServer.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('websocket');
      expect(health).toHaveProperty('memory');
      expect(health).toHaveProperty('timestamp');
      
      expect(['healthy', 'shutting_down']).toContain(health.status);
    });
  });

  describe('Paper Trading Integration', () => {
    beforeEach((done) => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });

      clientSocket.on('connected', () => {
        done();
      });
    });

    test('should handle portfolio requests in paper trading mode', (done) => {
      clientSocket.emit('requestPortfolio');

      clientSocket.on('message', (message) => {
        if (message.type === 'portfolio_response') {
          expect(message.data.paperTradingMode).toBe(true);
          expect(message.data.userId).toBe('test-user');
          expect(message.data.virtualBalance).toBeDefined();
          done();
        }
      });
    });

    test('should include paper trading status in connection data', (done) => {
      clientSocket.on('connected', (data) => {
        expect(data.data.paperTradingMode).toBe(config.paperTrading.enabled);
        done();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', (done) => {
      // Try to connect with malformed data
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: null }
      });

      clientSocket.on('connect_error', (error) => {
        expect(error).toBeDefined();
        done();
      });
    });

    test('should emit error events for invalid messages', (done) => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });

      clientSocket.on('connected', () => {
        // Send invalid message
        clientSocket.emit('invalidEvent', { invalid: 'data' });
      });

      // The server should handle this gracefully without crashing
      setTimeout(() => {
        expect(clientSocket.connected).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Security Features', () => {
    test('should validate user permissions for admin channels', (done) => {
      const token = jwt.sign(
        { userId: 'regular-user', email: 'user@example.com', role: 'user' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });

      clientSocket.on('connected', () => {
        clientSocket.emit('subscribe', { channels: ['admin_alerts'] });
      });

      clientSocket.on('subscription_confirmed', (data) => {
        // Regular user should not be able to subscribe to admin channels
        expect(data.data.subscribed).not.toContain('admin_alerts');
        expect(data.data.failed).toContain('admin_alerts');
        done();
      });
    });

    test('should allow admin users to access admin channels', (done) => {
      const adminToken = jwt.sign(
        { userId: 'admin-user', email: 'admin@example.com', role: 'admin' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: adminToken }
      });

      clientSocket.on('connected', () => {
        clientSocket.emit('subscribe', { channels: ['admin_alerts'] });
      });

      clientSocket.on('subscription_confirmed', (data) => {
        // Admin user should be able to subscribe to admin channels
        expect(data.data.subscribed).toContain('admin_alerts');
        done();
      });
    });
  });
});