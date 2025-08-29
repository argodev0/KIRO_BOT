/**
 * Paper Trading Safety Validation Tests
 * Comprehensive tests for paper trading safety mechanisms
 */

import { PaperTradingGuard } from '../../middleware/paperTradingGuard';
import { TradeSimulationEngine } from '../../services/TradeSimulationEngine';
import { VirtualPortfolioManager } from '../../services/VirtualPortfolioManager';
import { config } from '../../config/config';

describe('Paper Trading Safety Validation', () => {
  let paperTradingGuard: PaperTradingGuard;
  let tradeSimulationEngine: TradeSimulationEngine;
  let virtualPortfolioManager: VirtualPortfolioManager;

  beforeAll(() => {
    // Ensure test environment
    process.env.TRADING_SIMULATION_ONLY = 'true';
    process.env.PAPER_TRADING_MODE = 'true';
    process.env.NODE_ENV = 'test';
    
    paperTradingGuard = PaperTradingGuard.getInstance();
    tradeSimulationEngine = TradeSimulationEngine.getInstance();
    virtualPortfolioManager = VirtualPortfolioManager.getInstance();
  });

  describe('Environment Safety Validation', () => {
    it('should validate TRADING_SIMULATION_ONLY is true', () => {
      expect(() => {
        paperTradingGuard.validatePaperTradingMode();
      }).not.toThrow();
      
      const config = paperTradingGuard.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);
    });

    it('should detect unsafe environment variables', () => {
      // Temporarily set unsafe environment
      const originalValue = process.env.ALLOW_REAL_TRADING;
      process.env.ALLOW_REAL_TRADING = 'true';
      
      expect(() => {
        paperTradingGuard.validatePaperTradingMode();
      }).toThrow();
      
      // Restore original value
      if (originalValue !== undefined) {
        process.env.ALLOW_REAL_TRADING = originalValue;
      } else {
        delete process.env.ALLOW_REAL_TRADING;
      }
    });

    it('should calculate safety score correctly', () => {
      const stats = paperTradingGuard.getPaperTradingStats();
      
      expect(stats.safetyScore).toBeGreaterThan(90);
      expect(stats.safetyScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Real Trade Blocking', () => {
    it('should block real trading attempts', () => {
      const mockReq = {
        path: '/api/trading/order',
        method: 'POST',
        body: {
          userId: 'test-user',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001,
          realTrade: true
        },
        query: {},
        ip: '127.0.0.1'
      } as any;

      expect(() => {
        paperTradingGuard.validateTradeRequest(mockReq);
      }).toThrow();
    });

    it('should allow paper trading attempts', () => {
      const mockReq = {
        path: '/api/trading/simulate',
        method: 'POST',
        body: {
          userId: 'test-user',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001,
          isPaperTrade: true
        },
        query: {},
        ip: '127.0.0.1'
      } as any;

      expect(() => {
        paperTradingGuard.validateTradeRequest(mockReq);
      }).not.toThrow();
    });

    it('should log all paper trade attempts', () => {
      const mockReq = {
        path: '/api/trading/simulate',
        method: 'POST',
        body: {
          userId: 'test-user',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001
        },
        query: {},
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent')
      } as any;

      expect(() => {
        paperTradingGuard.logPaperTradeAttempt(mockReq);
      }).not.toThrow();
    });
  });

  describe('Trade Simulation Engine', () => {
    it('should simulate trades with realistic fees', async () => {
      const tradeRequest = {
        userId: 'test-user',
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.001,
        price: 50000
      };

      const simulatedTrade = await tradeSimulationEngine.simulateOrderExecution(tradeRequest);
      
      expect(simulatedTrade.status).toBe('filled');
      expect(simulatedTrade.executedQuantity).toBe(0.001);
      expect(simulatedTrade.executedPrice).toBeCloseTo(50000, 0);
      expect(simulatedTrade.fees).toBeGreaterThan(0);
      expect(simulatedTrade.fees).toBeLessThan(1); // Reasonable fee
    });

    it('should apply slippage simulation', async () => {
      const tradeRequest = {
        userId: 'test-user',
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.0, // Large order to trigger slippage
        price: 50000
      };

      const simulatedTrade = await tradeSimulationEngine.simulateOrderExecution(tradeRequest);
      
      expect(simulatedTrade.status).toBe('filled');
      expect(simulatedTrade.simulationDetails?.slippage).toBeGreaterThan(0);
      expect(Math.abs(simulatedTrade.executedPrice - 50000)).toBeGreaterThan(0);
    });

    it('should handle insufficient balance scenarios', async () => {
      const tradeRequest = {
        userId: 'test-user-no-balance',
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 100, // Very large order
        price: 50000
      };

      const simulatedTrade = await tradeSimulationEngine.simulateOrderExecution(tradeRequest);
      
      expect(simulatedTrade.status).toBe('rejected');
      expect(simulatedTrade.rejectReason).toContain('Insufficient');
    });
  });

  describe('Virtual Portfolio Management', () => {
    const testUserId = 'test-portfolio-user';

    beforeEach(() => {
      virtualPortfolioManager.resetUserPortfolio(testUserId);
    });

    it('should initialize virtual portfolio with default balance', () => {
      virtualPortfolioManager.initializeUserPortfolio(testUserId, 10000);
      const portfolio = virtualPortfolioManager.getPortfolioSummary(testUserId);
      
      expect(portfolio?.totalValue).toBeGreaterThan(0);
      expect(portfolio?.unrealizedPnL).toBe(0);
      expect(portfolio?.realizedPnL).toBe(0);
    });

    it('should update portfolio after simulated trades', async () => {
      virtualPortfolioManager.initializeUserPortfolio(testUserId, 10000);
      
      const tradeRequest = {
        userId: testUserId,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.001,
        price: 50000
      };

      const simulatedTrade = await tradeSimulationEngine.simulateOrderExecution(tradeRequest);
      expect(simulatedTrade.status).toBe('filled');

      // Update portfolio with trade
      virtualPortfolioManager.updatePortfolioWithTrade(testUserId, {
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 0.001,
        price: 50000,
        fee: simulatedTrade.fees,
        timestamp: Date.now()
      });

      const portfolio = virtualPortfolioManager.getPortfolioSummary(testUserId);
      expect(portfolio?.totalValue).toBeLessThan(10000); // Should be less due to fees
    });

    it('should calculate P&L correctly', async () => {
      virtualPortfolioManager.initializeUserPortfolio(testUserId, 10000);
      
      // Buy BTC
      const buyTrade = {
        userId: testUserId,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.001,
        price: 50000
      };

      const buyResult = await tradeSimulationEngine.simulateOrderExecution(buyTrade);
      virtualPortfolioManager.updatePortfolioWithTrade(testUserId, {
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 0.001,
        price: 50000,
        fee: buyResult.fees,
        timestamp: Date.now()
      });

      // Sell BTC at higher price
      const sellTrade = {
        userId: testUserId,
        symbol: 'BTCUSDT',
        side: 'sell' as const,
        type: 'market' as const,
        quantity: 0.001,
        price: 55000
      };

      const sellResult = await tradeSimulationEngine.simulateOrderExecution(sellTrade);
      virtualPortfolioManager.updatePortfolioWithTrade(testUserId, {
        symbol: 'BTCUSDT',
        side: 'sell',
        quantity: 0.001,
        price: 55000,
        fee: sellResult.fees,
        timestamp: Date.now()
      });

      const portfolio = virtualPortfolioManager.getPortfolioSummary(testUserId);
      expect(portfolio?.realizedPnL).toBeGreaterThan(0); // Should have profit
    });
  });

  describe('API Permission Validation', () => {
    it('should validate read-only API keys as safe', async () => {
      const validation = await paperTradingGuard.validateApiPermissions(
        'readonly_test_key_12345678901234567890123456789012',
        'binance'
      );
      
      expect(validation.isValid).toBe(true);
      expect(validation.riskLevel).toBe('low');
    });

    it('should reject API keys with trading permissions', async () => {
      await expect(
        paperTradingGuard.validateApiPermissions(
          'trading_key_with_permissions',
          'binance',
          'secret_with_trading_access'
        )
      ).rejects.toThrow();
    });

    it('should detect mainnet API keys as high risk', async () => {
      await expect(
        paperTradingGuard.validateApiPermissions(
          'mainnet_key_12345678901234567890123456789012',
          'binance'
        )
      ).rejects.toThrow();
    });

    it('should validate empty API keys as safe', async () => {
      const validation = await paperTradingGuard.validateApiPermissions(
        '',
        'binance'
      );
      
      expect(validation.isValid).toBe(true);
      expect(validation.riskLevel).toBe('low');
    });
  });

  describe('Safety Score Calculation', () => {
    it('should achieve safety score above 90%', () => {
      const stats = paperTradingGuard.getPaperTradingStats();
      expect(stats.safetyScore).toBeGreaterThan(90);
    });

    it('should penalize unsafe configurations', () => {
      // Temporarily set unsafe configuration
      const originalValue = process.env.ALLOW_REAL_TRADING;
      process.env.ALLOW_REAL_TRADING = 'true';

      expect(() => {
        paperTradingGuard.validatePaperTradingMode();
      }).toThrow();

      // Restore original value
      if (originalValue !== undefined) {
        process.env.ALLOW_REAL_TRADING = originalValue;
      } else {
        delete process.env.ALLOW_REAL_TRADING;
      }
    });
  });

  describe('Integration with Middleware', () => {
    it('should integrate with Express middleware stack', () => {
      const mockReq = {
        path: '/api/trading/order',
        method: 'POST',
        body: {
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001,
          realTrade: true
        },
        query: {},
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
        user: { id: 'test-user' }
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;

      const mockNext = jest.fn();

      const middleware = paperTradingGuard.interceptTradingOperations();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });
  });
});