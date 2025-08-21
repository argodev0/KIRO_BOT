/**
 * Risk Management and Emergency Procedures E2E Tests
 * Validates all risk management controls and emergency shutdown procedures
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';

interface RiskTestScenario {
  name: string;
  setup: () => Promise<void>;
  execute: () => Promise<any>;
  validate: (result: any) => void;
  cleanup?: () => Promise<void>;
}

class RiskManagementTester {
  private baseUrl: string;
  private authToken: string;
  private testAccountId: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    this.testAccountId = 'test-account-123';
  }

  async setupTestAccount(initialBalance: number = 10000): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/test/account/setup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: this.testAccountId,
        balance: initialBalance,
        currency: 'USDT'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to setup test account');
    }
  }

  async resetAccount(): Promise<void> {
    await fetch(`${this.baseUrl}/api/test/account/reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accountId: this.testAccountId })
    });
  }

  async setRiskLimits(limits: any): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/risk/limits`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(limits)
    });

    if (!response.ok) {
      throw new Error('Failed to set risk limits');
    }
  }

  async executeTradeAttempt(tradeParams: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/trading/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tradeParams)
    });

    return {
      status: response.status,
      data: response.ok ? await response.json() : await response.text()
    };
  }

  async getAccountStatus(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/account/status`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    return response.json();
  }

  async getRiskMetrics(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/risk/metrics`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    return response.json();
  }

  async triggerEmergencyShutdown(reason: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/emergency/shutdown`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    return {
      status: response.status,
      data: response.ok ? await response.json() : await response.text()
    };
  }

  async simulateMarketCrash(crashPercentage: number): Promise<void> {
    await fetch(`${this.baseUrl}/api/test/market/crash`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ crashPercentage })
    });
  }

  async simulateExchangeOutage(exchange: string, duration: number): Promise<void> {
    await fetch(`${this.baseUrl}/api/test/exchange/outage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ exchange, duration })
    });
  }
}

describe('Risk Management and Emergency Procedures E2E Tests', () => {
  let riskTester: RiskManagementTester;
  const baseUrl = 'http://localhost:3001';
  let authToken: string;

  beforeAll(async () => {
    // Get auth token
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!'
      })
    });
    
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    
    riskTester = new RiskManagementTester(baseUrl, authToken);
  }, 30000);

  beforeEach(async () => {
    await riskTester.resetAccount();
    await riskTester.setupTestAccount(10000); // $10,000 test balance
  });

  describe('Position Size Risk Limits', () => {
    test('should enforce maximum risk per trade (3%)', async () => {
      // Set standard risk limits
      await riskTester.setRiskLimits({
        maxRiskPerTrade: 0.03, // 3%
        maxDailyLoss: 0.05,    // 5%
        maxTotalExposure: 5.0   // 5x
      });

      // Attempt to place trade exceeding 3% risk
      const oversizedTrade = {
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.01, // This should be calculated to exceed 3% risk
        price: 50000,
        stopLoss: 45000, // 10% stop loss would exceed 3% risk on account
        exchange: 'binance'
      };

      const result = await riskTester.executeTradeAttempt(oversizedTrade);

      expect(result.status).toBe(400);
      expect(result.data).toContain('risk limit exceeded');
      
      // Verify account status unchanged
      const accountStatus = await riskTester.getAccountStatus();
      expect(accountStatus.positions.length).toBe(0);
    });

    test('should allow trades within risk limits', async () => {
      await riskTester.setRiskLimits({
        maxRiskPerTrade: 0.03,
        maxDailyLoss: 0.05,
        maxTotalExposure: 5.0
      });

      // Place trade within 3% risk limit
      const validTrade = {
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.005, // Smaller size to stay within limits
        price: 50000,
        stopLoss: 49000, // 2% stop loss
        exchange: 'binance'
      };

      const result = await riskTester.executeTradeAttempt(validTrade);

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('orderId');
      
      // Verify position was created
      const accountStatus = await riskTester.getAccountStatus();
      expect(accountStatus.positions.length).toBe(1);
    });

    test('should calculate position size correctly based on stop loss', async () => {
      await riskTester.setRiskLimits({
        maxRiskPerTrade: 0.02, // 2%
        maxDailyLoss: 0.05,
        maxTotalExposure: 5.0
      });

      // Request position size calculation
      const sizeCalculationResponse = await fetch(`${baseUrl}/api/risk/calculate-size`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          entryPrice: 50000,
          stopLoss: 48000, // 4% stop loss
          riskPercentage: 0.02 // 2% risk
        })
      });

      expect(sizeCalculationResponse.status).toBe(200);
      const sizeData = await sizeCalculationResponse.json();
      
      expect(sizeData).toHaveProperty('recommendedSize');
      expect(sizeData).toHaveProperty('maxSize');
      expect(sizeData).toHaveProperty('riskAmount');
      
      // Verify calculation: risk amount should be 2% of account balance
      expect(sizeData.riskAmount).toBeCloseTo(200, 1); // $200 (2% of $10,000)
    });
  });

  describe('Daily Loss Limits', () => {
    test('should enforce maximum daily loss limit (5%)', async () => {
      await riskTester.setRiskLimits({
        maxRiskPerTrade: 0.03,
        maxDailyLoss: 0.05, // 5%
        maxTotalExposure: 5.0
      });

      // Simulate multiple losing trades to approach daily limit
      const losingTrades = [
        { symbol: 'BTCUSDT', side: 'buy', size: 0.004, price: 50000, stopLoss: 49000 },
        { symbol: 'ETHUSDT', side: 'buy', size: 0.1, price: 3000, stopLoss: 2940 },
        { symbol: 'ADAUSDT', side: 'buy', size: 1000, price: 1, stopLoss: 0.98 }
      ];

      // Execute trades and simulate losses
      for (const trade of losingTrades) {
        const result = await riskTester.executeTradeAttempt(trade);
        if (result.status === 200) {
          // Simulate trade loss by updating position
          await fetch(`${baseUrl}/api/test/position/update`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orderId: result.data.orderId,
              currentPrice: trade.stopLoss, // Simulate stop loss hit
              status: 'closed'
            })
          });
        }
      }

      // Check daily loss
      const riskMetrics = await riskTester.getRiskMetrics();
      expect(riskMetrics.dailyLoss).toBeGreaterThan(0);

      // Try to place another trade that would exceed daily limit
      const additionalTrade = {
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.01,
        price: 50000,
        stopLoss: 48000,
        exchange: 'binance'
      };

      const result = await riskTester.executeTradeAttempt(additionalTrade);
      
      if (riskMetrics.dailyLoss >= 0.05) {
        expect(result.status).toBe(400);
        expect(result.data).toContain('daily loss limit');
      }
    });

    test('should reset daily loss limits at midnight', async () => {
      // This test would require time manipulation or mocking
      // For now, we'll test the API endpoint that resets daily limits
      
      const resetResponse = await fetch(`${baseUrl}/api/test/risk/reset-daily`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(resetResponse.status).toBe(200);
      
      const riskMetrics = await riskTester.getRiskMetrics();
      expect(riskMetrics.dailyLoss).toBe(0);
      expect(riskMetrics.dailyTrades).toBe(0);
    });
  });

  describe('Total Exposure Limits', () => {
    test('should enforce maximum total exposure (5x)', async () => {
      await riskTester.setRiskLimits({
        maxRiskPerTrade: 0.03,
        maxDailyLoss: 0.10, // Higher to focus on exposure limit
        maxTotalExposure: 3.0 // 3x for easier testing
      });

      // Place multiple positions to approach exposure limit
      const trades = [
        { symbol: 'BTCUSDT', side: 'buy', size: 0.02, price: 50000 }, // $1000 exposure
        { symbol: 'ETHUSDT', side: 'buy', size: 0.5, price: 3000 },   // $1500 exposure
        { symbol: 'ADAUSDT', side: 'buy', size: 15000, price: 1 }     // $15000 exposure
      ];

      let totalExposure = 0;
      for (const trade of trades) {
        const exposure = trade.size * trade.price;
        
        if (totalExposure + exposure <= 30000) { // 3x of $10,000
          const result = await riskTester.executeTradeAttempt({
            ...trade,
            exchange: 'binance'
          });
          
          if (result.status === 200) {
            totalExposure += exposure;
          }
        } else {
          // This trade should be rejected
          const result = await riskTester.executeTradeAttempt({
            ...trade,
            exchange: 'binance'
          });
          
          expect(result.status).toBe(400);
          expect(result.data).toContain('exposure limit');
        }
      }
    });

    test('should calculate exposure correctly across multiple exchanges', async () => {
      await riskTester.setRiskLimits({
        maxRiskPerTrade: 0.05,
        maxDailyLoss: 0.10,
        maxTotalExposure: 2.0 // 2x
      });

      // Place trades on different exchanges
      const binanceTrade = {
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.01,
        price: 50000,
        exchange: 'binance'
      };

      const kucoinTrade = {
        symbol: 'ETHUSDT',
        side: 'buy',
        size: 0.3,
        price: 3000,
        exchange: 'kucoin'
      };

      // Execute trades
      const result1 = await riskTester.executeTradeAttempt(binanceTrade);
      const result2 = await riskTester.executeTradeAttempt(kucoinTrade);

      expect(result1.status).toBe(200);
      expect(result2.status).toBe(200);

      // Check total exposure calculation
      const riskMetrics = await riskTester.getRiskMetrics();
      const expectedExposure = (0.01 * 50000) + (0.3 * 3000); // $500 + $900 = $1400
      
      expect(riskMetrics.totalExposure).toBeCloseTo(expectedExposure, 0);
      expect(riskMetrics.exposureRatio).toBeCloseTo(expectedExposure / 10000, 2);
    });
  });

  describe('Emergency Shutdown Procedures', () => {
    test('should execute emergency shutdown on critical risk violation', async () => {
      // Setup positions
      await riskTester.executeTradeAttempt({
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.01,
        price: 50000,
        exchange: 'binance'
      });

      // Trigger emergency shutdown
      const shutdownResult = await riskTester.triggerEmergencyShutdown('critical_risk_violation');

      expect(shutdownResult.status).toBe(200);
      expect(shutdownResult.data).toHaveProperty('shutdownId');
      expect(shutdownResult.data).toHaveProperty('timestamp');

      // Verify all positions are closed
      const accountStatus = await riskTester.getAccountStatus();
      expect(accountStatus.emergencyMode).toBe(true);
      expect(accountStatus.positions.every((p: any) => p.status === 'closed')).toBe(true);

      // Verify no new trades can be placed
      const newTradeResult = await riskTester.executeTradeAttempt({
        symbol: 'ETHUSDT',
        side: 'buy',
        size: 0.1,
        price: 3000,
        exchange: 'binance'
      });

      expect(newTradeResult.status).toBe(403);
      expect(newTradeResult.data).toContain('emergency mode');
    });

    test('should handle exchange connectivity failures', async () => {
      // Setup position
      await riskTester.executeTradeAttempt({
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.01,
        price: 50000,
        exchange: 'binance'
      });

      // Simulate exchange outage
      await riskTester.simulateExchangeOutage('binance', 30000); // 30 seconds

      // System should detect outage and take protective measures
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for detection

      const accountStatus = await riskTester.getAccountStatus();
      expect(accountStatus.exchangeStatus.binance).toBe('disconnected');

      // Verify risk monitoring continues
      const riskMetrics = await riskTester.getRiskMetrics();
      expect(riskMetrics).toHaveProperty('exchangeConnectivity');
      expect(riskMetrics.exchangeConnectivity.binance).toBe(false);
    });

    test('should handle market crash scenarios', async () => {
      // Setup multiple positions
      const trades = [
        { symbol: 'BTCUSDT', side: 'buy', size: 0.01, price: 50000 },
        { symbol: 'ETHUSDT', side: 'buy', size: 0.3, price: 3000 },
        { symbol: 'ADAUSDT', side: 'buy', size: 1000, price: 1 }
      ];

      for (const trade of trades) {
        await riskTester.executeTradeAttempt({
          ...trade,
          exchange: 'binance'
        });
      }

      // Simulate market crash
      await riskTester.simulateMarketCrash(20); // 20% crash

      // Wait for system response
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if protective measures were taken
      const riskMetrics = await riskTester.getRiskMetrics();
      const accountStatus = await riskTester.getAccountStatus();

      // System should detect high volatility and adjust risk parameters
      expect(riskMetrics.marketVolatility).toBeGreaterThan(0.15); // High volatility detected
      
      // Check if stop losses were tightened or positions reduced
      if (accountStatus.positions.length > 0) {
        accountStatus.positions.forEach((position: any) => {
          expect(position.stopLoss).toBeDefined();
          expect(Math.abs(position.stopLoss - position.entryPrice) / position.entryPrice).toBeLessThan(0.05);
        });
      }
    });

    test('should recover from emergency mode safely', async () => {
      // Trigger emergency shutdown
      await riskTester.triggerEmergencyShutdown('test_recovery');

      // Verify emergency mode is active
      let accountStatus = await riskTester.getAccountStatus();
      expect(accountStatus.emergencyMode).toBe(true);

      // Initiate recovery
      const recoveryResponse = await fetch(`${baseUrl}/api/emergency/recover`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirmationCode: 'RECOVERY_CONFIRMED',
          resetRiskLimits: true
        })
      });

      expect(recoveryResponse.status).toBe(200);

      // Verify recovery
      accountStatus = await riskTester.getAccountStatus();
      expect(accountStatus.emergencyMode).toBe(false);

      // Verify trading can resume
      const testTrade = await riskTester.executeTradeAttempt({
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.001,
        price: 50000,
        exchange: 'binance'
      });

      expect(testTrade.status).toBe(200);
    });
  });

  describe('Drawdown Monitoring', () => {
    test('should monitor and respond to drawdown levels', async () => {
      await riskTester.setRiskLimits({
        maxRiskPerTrade: 0.03,
        maxDailyLoss: 0.10,
        maxTotalExposure: 5.0,
        maxDrawdown: 0.15 // 15% maximum drawdown
      });

      // Simulate series of losing trades to create drawdown
      const losingTrades = [
        { symbol: 'BTCUSDT', loss: 300 },
        { symbol: 'ETHUSDT', loss: 400 },
        { symbol: 'ADAUSDT', loss: 500 }
      ];

      let totalLoss = 0;
      for (const trade of losingTrades) {
        // Simulate trade execution and loss
        await fetch(`${baseUrl}/api/test/simulate-loss`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            symbol: trade.symbol,
            lossAmount: trade.loss
          })
        });
        
        totalLoss += trade.loss;
      }

      // Check drawdown calculation
      const riskMetrics = await riskTester.getRiskMetrics();
      expect(riskMetrics.currentDrawdown).toBeCloseTo(totalLoss / 10000, 2);

      // If drawdown exceeds threshold, risk limits should be tightened
      if (riskMetrics.currentDrawdown > 0.10) {
        expect(riskMetrics.adjustedRiskLimits).toBeDefined();
        expect(riskMetrics.adjustedRiskLimits.maxRiskPerTrade).toBeLessThan(0.03);
      }
    });

    test('should automatically reduce position sizes during drawdown', async () => {
      // Create initial drawdown
      await fetch(`${baseUrl}/api/test/simulate-loss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          lossAmount: 1000 // 10% drawdown
        })
      });

      // Attempt to place trade during drawdown
      const tradeAttempt = {
        symbol: 'ETHUSDT',
        side: 'buy',
        requestedSize: 0.5,
        price: 3000,
        exchange: 'binance'
      };

      const result = await riskTester.executeTradeAttempt(tradeAttempt);

      if (result.status === 200) {
        // Position size should be reduced due to drawdown
        expect(result.data.executedSize).toBeLessThan(tradeAttempt.requestedSize);
        expect(result.data.reason).toContain('drawdown adjustment');
      }
    });
  });

  describe('Correlation Risk Management', () => {
    test('should prevent over-exposure to correlated assets', async () => {
      await riskTester.setRiskLimits({
        maxRiskPerTrade: 0.05,
        maxDailyLoss: 0.10,
        maxTotalExposure: 5.0,
        maxCorrelatedExposure: 0.30 // 30% max exposure to correlated assets
      });

      // Place trades in highly correlated crypto assets
      const correlatedTrades = [
        { symbol: 'BTCUSDT', side: 'buy', size: 0.01, price: 50000 },
        { symbol: 'ETHUSDT', side: 'buy', size: 0.3, price: 3000 },
        { symbol: 'LTCUSDT', side: 'buy', size: 5, price: 200 }
      ];

      let correlatedExposure = 0;
      for (const trade of correlatedTrades) {
        const result = await riskTester.executeTradeAttempt({
          ...trade,
          exchange: 'binance'
        });

        if (result.status === 200) {
          correlatedExposure += trade.size * trade.price;
        } else if (correlatedExposure / 10000 > 0.30) {
          // Should be rejected due to correlation limits
          expect(result.status).toBe(400);
          expect(result.data).toContain('correlation');
        }
      }
    });
  });
});