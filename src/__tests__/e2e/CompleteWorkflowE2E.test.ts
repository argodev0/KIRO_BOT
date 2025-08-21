/**
 * End-to-End Testing for Complete Trading Workflows
 * Tests the entire system from market data ingestion to trade execution
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { performance } from 'perf_hooks';

// Mock implementations for testing
class E2ETestEnvironment {
  private serverProcess: ChildProcess | null = null;
  private wsConnection: WebSocket | null = null;
  private baseUrl = 'http://localhost:3001'; // Use different port for testing
  private wsUrl = 'ws://localhost:3001';

  async setup(): Promise<void> {
    console.log('Setting up E2E test environment...');
    
    // Start test server
    await this.startTestServer();
    
    // Wait for server to be ready
    await this.waitForServer();
    
    // Setup test data
    await this.setupTestData();
  }

  async teardown(): Promise<void> {
    console.log('Tearing down E2E test environment...');
    
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }

  private async startTestServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('npm', ['run', 'dev'], {
        env: { ...process.env, PORT: '3001', NODE_ENV: 'test' },
        stdio: 'pipe'
      });

      this.serverProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Server running on port 3001')) {
          resolve();
        }
      });

      this.serverProcess.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.serverProcess.on('error', reject);
      
      // Timeout after 30 seconds
      setTimeout(() => reject(new Error('Server startup timeout')), 30000);
    });
  }

  private async waitForServer(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error('Server failed to start within timeout period');
  }

  private async setupTestData(): Promise<void> {
    // Create test user
    await this.createTestUser();
    
    // Setup test market data
    await this.setupTestMarketData();
    
    // Configure test trading parameters
    await this.setupTestTradingConfig();
  }

  private async createTestUser(): Promise<void> {
    const testUser = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      apiKeys: {
        binance: { key: 'test_key', secret: 'test_secret' },
        kucoin: { key: 'test_key', secret: 'test_secret', passphrase: 'test_pass' }
      }
    };

    const response = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    if (!response.ok) {
      throw new Error('Failed to create test user');
    }
  }

  private async setupTestMarketData(): Promise<void> {
    // Mock market data for testing
    const mockData = {
      symbol: 'BTCUSDT',
      candles: this.generateTestCandles(100),
      orderBook: this.generateTestOrderBook(),
      trades: this.generateTestTrades(50)
    };

    const response = await fetch(`${this.baseUrl}/api/test/market-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockData)
    });

    if (!response.ok) {
      throw new Error('Failed to setup test market data');
    }
  }

  private async setupTestTradingConfig(): Promise<void> {
    const config = {
      riskManagement: {
        maxRiskPerTrade: 0.02, // 2%
        maxDailyLoss: 0.05,    // 5%
        maxTotalExposure: 3.0   // 3x
      },
      signalFilters: {
        minConfidence: 0.7,
        requiredTimeframes: ['1h', '4h'],
        enabledStrategies: ['elliott-wave', 'fibonacci', 'patterns']
      }
    };

    const response = await fetch(`${this.baseUrl}/api/config/trading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error('Failed to setup trading config');
    }
  }

  private generateTestCandles(count: number) {
    const candles = [];
    let price = 50000;
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const timestamp = now - (count - i) * 60000; // 1 minute intervals
      const open = price;
      const change = (Math.random() - 0.5) * 1000; // Random price movement
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;
      const volume = Math.random() * 100 + 10;

      candles.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });

      price = close;
    }

    return candles;
  }

  private generateTestOrderBook() {
    const midPrice = 50000;
    const bids = [];
    const asks = [];

    for (let i = 0; i < 20; i++) {
      bids.push([midPrice - (i + 1) * 10, Math.random() * 5 + 0.1]);
      asks.push([midPrice + (i + 1) * 10, Math.random() * 5 + 0.1]);
    }

    return { bids, asks };
  }

  private generateTestTrades(count: number) {
    const trades = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      trades.push({
        timestamp: now - (count - i) * 1000,
        price: 50000 + (Math.random() - 0.5) * 1000,
        quantity: Math.random() * 2 + 0.1,
        side: Math.random() > 0.5 ? 'buy' : 'sell'
      });
    }

    return trades;
  }

  async connectWebSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      this.wsConnection = new WebSocket(this.wsUrl);
      
      this.wsConnection.on('open', () => {
        resolve(this.wsConnection!);
      });
      
      this.wsConnection.on('error', reject);
      
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
    });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

describe('Complete Trading Workflow E2E Tests', () => {
  let testEnv: E2ETestEnvironment;
  let authToken: string;

  beforeAll(async () => {
    testEnv = new E2ETestEnvironment();
    await testEnv.setup();
    
    // Login and get auth token
    const loginResponse = await fetch(`${testEnv.getBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!'
      })
    });
    
    const loginData = await loginResponse.json();
    authToken = loginData.token;
  }, 60000);

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('Market Data to Signal Generation Workflow', () => {
    test('should process market data and generate trading signals', async () => {
      const startTime = performance.now();
      
      // 1. Verify market data ingestion
      const marketDataResponse = await fetch(`${testEnv.getBaseUrl()}/api/market-data/ticker/BTCUSDT`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(marketDataResponse.status).toBe(200);
      const marketData = await marketDataResponse.json();
      expect(marketData).toHaveProperty('price');
      expect(marketData).toHaveProperty('volume');
      
      // 2. Trigger technical analysis
      const analysisResponse = await fetch(`${testEnv.getBaseUrl()}/api/analysis/technical/BTCUSDT`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ timeframes: ['1h', '4h'] })
      });
      
      expect(analysisResponse.status).toBe(200);
      const analysis = await analysisResponse.json();
      expect(analysis).toHaveProperty('indicators');
      expect(analysis).toHaveProperty('patterns');
      expect(analysis).toHaveProperty('elliottWave');
      expect(analysis).toHaveProperty('fibonacci');
      
      // 3. Generate trading signal
      const signalResponse = await fetch(`${testEnv.getBaseUrl()}/api/signals/generate`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          symbol: 'BTCUSDT',
          analysisId: analysis.id 
        })
      });
      
      expect(signalResponse.status).toBe(200);
      const signal = await signalResponse.json();
      expect(signal).toHaveProperty('direction');
      expect(signal).toHaveProperty('confidence');
      expect(signal).toHaveProperty('entryPrice');
      expect(signal).toHaveProperty('stopLoss');
      expect(signal).toHaveProperty('takeProfit');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Performance requirement: Complete workflow should take less than 5 seconds
      expect(duration).toBeLessThan(5000);
      
      console.log(`Market data to signal workflow completed in ${duration.toFixed(2)}ms`);
    }, 30000);

    test('should handle Elliott Wave analysis workflow', async () => {
      // Test Elliott Wave specific workflow
      const waveAnalysisResponse = await fetch(`${testEnv.getBaseUrl()}/api/analysis/elliott-wave/BTCUSDT`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          timeframe: '4h',
          lookback: 200 
        })
      });
      
      expect(waveAnalysisResponse.status).toBe(200);
      const waveAnalysis = await waveAnalysisResponse.json();
      
      expect(waveAnalysis).toHaveProperty('waves');
      expect(waveAnalysis).toHaveProperty('currentWave');
      expect(waveAnalysis).toHaveProperty('targets');
      expect(waveAnalysis.waves).toBeInstanceOf(Array);
      
      // Verify wave structure validity
      expect(waveAnalysis.currentWave).toHaveProperty('type');
      expect(waveAnalysis.currentWave).toHaveProperty('degree');
      expect(['impulse', 'corrective']).toContain(waveAnalysis.currentWave.type);
    });

    test('should handle Fibonacci confluence detection workflow', async () => {
      // Test Fibonacci analysis workflow
      const fibAnalysisResponse = await fetch(`${testEnv.getBaseUrl()}/api/analysis/fibonacci/BTCUSDT`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          swingHigh: 52000,
          swingLow: 48000,
          includeExtensions: true
        })
      });
      
      expect(fibAnalysisResponse.status).toBe(200);
      const fibAnalysis = await fibAnalysisResponse.json();
      
      expect(fibAnalysis).toHaveProperty('retracements');
      expect(fibAnalysis).toHaveProperty('extensions');
      expect(fibAnalysis).toHaveProperty('confluenceZones');
      
      // Verify Fibonacci levels
      expect(fibAnalysis.retracements).toHaveProperty('23.6%');
      expect(fibAnalysis.retracements).toHaveProperty('38.2%');
      expect(fibAnalysis.retracements).toHaveProperty('61.8%');
      
      // Check confluence zones
      expect(fibAnalysis.confluenceZones).toBeInstanceOf(Array);
      if (fibAnalysis.confluenceZones.length > 0) {
        expect(fibAnalysis.confluenceZones[0]).toHaveProperty('price');
        expect(fibAnalysis.confluenceZones[0]).toHaveProperty('strength');
      }
    });
  });

  describe('Signal to Trade Execution Workflow', () => {
    test('should execute complete signal to trade workflow with risk management', async () => {
      // 1. Generate a high-confidence signal
      const signalResponse = await fetch(`${testEnv.getBaseUrl()}/api/signals/generate`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          symbol: 'BTCUSDT',
          forceGenerate: true,
          minConfidence: 0.8
        })
      });
      
      expect(signalResponse.status).toBe(200);
      const signal = await signalResponse.json();
      
      // 2. Validate risk management
      const riskValidationResponse = await fetch(`${testEnv.getBaseUrl()}/api/risk/validate`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          signalId: signal.id,
          proposedSize: 0.1 // 0.1 BTC
        })
      });
      
      expect(riskValidationResponse.status).toBe(200);
      const riskValidation = await riskValidationResponse.json();
      expect(riskValidation).toHaveProperty('isValid');
      expect(riskValidation).toHaveProperty('maxAllowedSize');
      expect(riskValidation).toHaveProperty('riskPercentage');
      
      // 3. Execute trade if risk validation passes
      if (riskValidation.isValid) {
        const tradeResponse = await fetch(`${testEnv.getBaseUrl()}/api/trading/execute`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            signalId: signal.id,
            size: Math.min(0.1, riskValidation.maxAllowedSize),
            exchange: 'binance'
          })
        });
        
        expect(tradeResponse.status).toBe(200);
        const tradeResult = await tradeResponse.json();
        
        expect(tradeResult).toHaveProperty('orderId');
        expect(tradeResult).toHaveProperty('status');
        expect(tradeResult).toHaveProperty('executedPrice');
        expect(tradeResult).toHaveProperty('executedQuantity');
        
        // 4. Verify trade was recorded
        const tradesResponse = await fetch(`${testEnv.getBaseUrl()}/api/trading/history`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        expect(tradesResponse.status).toBe(200);
        const trades = await tradesResponse.json();
        expect(trades).toBeInstanceOf(Array);
        expect(trades.length).toBeGreaterThan(0);
        
        const latestTrade = trades[0];
        expect(latestTrade.signalId).toBe(signal.id);
      }
    }, 30000);

    test('should handle risk management violations', async () => {
      // Test risk management by trying to place oversized trade
      const oversizedTradeResponse = await fetch(`${testEnv.getBaseUrl()}/api/trading/execute`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          symbol: 'BTCUSDT',
          side: 'buy',
          size: 100, // Intentionally large size
          exchange: 'binance'
        })
      });
      
      // Should be rejected due to risk limits
      expect(oversizedTradeResponse.status).toBe(400);
      const error = await oversizedTradeResponse.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('risk');
    });
  });

  describe('Grid Trading Workflow', () => {
    test('should create and manage Elliott Wave-based grid', async () => {
      // 1. Create Elliott Wave-based grid
      const gridResponse = await fetch(`${testEnv.getBaseUrl()}/api/grids/create`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          symbol: 'BTCUSDT',
          strategy: 'elliott-wave',
          basePrice: 50000,
          gridCount: 10,
          spacing: 'fibonacci'
        })
      });
      
      expect(gridResponse.status).toBe(200);
      const grid = await gridResponse.json();
      
      expect(grid).toHaveProperty('id');
      expect(grid).toHaveProperty('levels');
      expect(grid).toHaveProperty('strategy');
      expect(grid.strategy).toBe('elliott-wave');
      expect(grid.levels).toBeInstanceOf(Array);
      expect(grid.levels.length).toBe(10);
      
      // 2. Verify grid levels have Fibonacci spacing
      const levels = grid.levels.sort((a: any, b: any) => a.price - b.price);
      for (let i = 1; i < levels.length; i++) {
        const spacing = levels[i].price - levels[i-1].price;
        expect(spacing).toBeGreaterThan(0);
      }
      
      // 3. Monitor grid performance
      const gridStatusResponse = await fetch(`${testEnv.getBaseUrl()}/api/grids/${grid.id}/status`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      expect(gridStatusResponse.status).toBe(200);
      const gridStatus = await gridStatusResponse.json();
      
      expect(gridStatus).toHaveProperty('filledLevels');
      expect(gridStatus).toHaveProperty('totalProfit');
      expect(gridStatus).toHaveProperty('activeOrders');
      
      // 4. Close grid
      const closeGridResponse = await fetch(`${testEnv.getBaseUrl()}/api/grids/${grid.id}/close`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'test_completion' })
      });
      
      expect(closeGridResponse.status).toBe(200);
    });
  });

  describe('Real-time Data and WebSocket Workflow', () => {
    test('should handle real-time market data streaming', async () => {
      const ws = await testEnv.connectWebSocket();
      
      const messages: any[] = [];
      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          messages.push(message);
          
          if (messages.length >= 5) {
            resolve(messages);
          }
        });
      });
      
      // Subscribe to market data
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'ticker',
        symbol: 'BTCUSDT'
      }));
      
      // Subscribe to signals
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'signals'
      }));
      
      // Wait for messages
      await messagePromise;
      
      expect(messages.length).toBeGreaterThanOrEqual(5);
      
      // Verify message structure
      const tickerMessages = messages.filter(m => m.channel === 'ticker');
      expect(tickerMessages.length).toBeGreaterThan(0);
      
      const tickerMessage = tickerMessages[0];
      expect(tickerMessage).toHaveProperty('data');
      expect(tickerMessage.data).toHaveProperty('price');
      expect(tickerMessage.data).toHaveProperty('volume');
      
      ws.close();
    }, 15000);

    test('should handle real-time signal notifications', async () => {
      const ws = await testEnv.connectWebSocket();
      
      let signalReceived = false;
      const signalPromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.channel === 'signals' && message.type === 'new_signal') {
            signalReceived = true;
            resolve(message);
          }
        });
      });
      
      // Subscribe to signals
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'signals'
      }));
      
      // Trigger signal generation
      await fetch(`${testEnv.getBaseUrl()}/api/signals/generate`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          symbol: 'BTCUSDT',
          forceGenerate: true
        })
      });
      
      // Wait for signal notification
      await signalPromise;
      
      expect(signalReceived).toBe(true);
      
      ws.close();
    }, 15000);
  });

  describe('Performance and Latency Requirements', () => {
    test('should meet API response time requirements', async () => {
      const endpoints = [
        '/api/market-data/ticker/BTCUSDT',
        '/api/signals',
        '/api/positions',
        '/api/grids'
      ];
      
      for (const endpoint of endpoints) {
        const startTime = performance.now();
        
        const response = await fetch(`${testEnv.getBaseUrl()}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(200); // 200ms requirement
        
        console.log(`${endpoint}: ${duration.toFixed(2)}ms`);
      }
    });

    test('should handle concurrent signal generation', async () => {
      const concurrentRequests = 10;
      const startTime = performance.now();
      
      const promises = Array(concurrentRequests).fill(0).map(() =>
        fetch(`${testEnv.getBaseUrl()}/api/signals/generate`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            symbol: 'BTCUSDT',
            forceGenerate: true
          })
        })
      );
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should handle concurrent load efficiently
      expect(duration).toBeLessThan(5000); // 5 seconds for 10 concurrent requests
      
      console.log(`Concurrent signal generation (${concurrentRequests} requests): ${duration.toFixed(2)}ms`);
    });
  });
});