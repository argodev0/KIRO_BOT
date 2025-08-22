/**
 * Paper Trading Safety Tests
 * Comprehensive tests to ensure paper trading safety mechanisms work correctly
 */

import { PaperTradingGuard, PaperTradingError, PAPER_TRADING_ERRORS } from '../middleware/paperTradingGuard';
import { VirtualPortfolioManager } from '../services/VirtualPortfolioManager';
import { TradeSimulationEngine } from '../services/TradeSimulationEngine';
import { ApiPermissionValidator, ApiPermissionValidationError } from '../utils/ApiPermissionValidator';
import { EnvironmentValidator, EnvironmentValidationError } from '../utils/EnvironmentValidator';
import { Request, Response } from 'express';

describe('Paper Trading Safety Infrastructure', () => {
  let paperTradingGuard: PaperTradingGuard;
  let virtualPortfolioManager: VirtualPortfolioManager;
  let tradeSimulationEngine: TradeSimulationEngine;
  let apiPermissionValidator: ApiPermissionValidator;
  let environmentValidator: EnvironmentValidator;

  beforeEach(() => {
    paperTradingGuard = PaperTradingGuard.getInstance();
    virtualPortfolioManager = VirtualPortfolioManager.getInstance();
    tradeSimulationEngine = TradeSimulationEngine.getInstance();
    apiPermissionValidator = ApiPermissionValidator.getInstance();
    environmentValidator = EnvironmentValidator.getInstance();
  });

  describe('PaperTradingGuard', () => {
    describe('Paper Trading Mode Validation', () => {
      test('should validate paper trading mode is enabled', () => {
        expect(() => paperTradingGuard.validatePaperTradingMode()).not.toThrow();
      });

      test('should throw error if paper trading mode is disabled', () => {
        // Mock disabled paper trading mode
        const guard = new (PaperTradingGuard as any)();
        guard.paperTradingConfig.enabled = false;

        expect(() => guard.validatePaperTradingMode()).toThrow(PaperTradingError);
        expect(() => guard.validatePaperTradingMode()).toThrow(PAPER_TRADING_ERRORS.PAPER_MODE_DISABLED);
      });

      test('should throw error if real trades are allowed', () => {
        const guard = new (PaperTradingGuard as any)();
        guard.paperTradingConfig.allowRealTrades = true;

        expect(() => guard.validatePaperTradingMode()).toThrow(PaperTradingError);
        expect(() => guard.validatePaperTradingMode()).toThrow(PAPER_TRADING_ERRORS.REAL_TRADE_ATTEMPTED);
      });
    });

    describe('Trading Operation Interception', () => {
      test('should intercept trading endpoints', () => {
        const mockReq = {
          path: '/api/trading/orders',
          method: 'POST',
          body: { symbol: 'BTCUSDT', side: 'buy', quantity: 0.001 },
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('test-agent')
        } as unknown as Request;

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as unknown as Response;

        const mockNext = jest.fn();

        const middleware = paperTradingGuard.interceptTradingOperations();
        middleware(mockReq, mockRes, mockNext);

        expect((mockReq as any).isPaperTrade).toBe(true);
        expect((mockReq as any).paperTradingMode).toBe(true);
        expect(mockNext).toHaveBeenCalled();
      });

      test('should block real money operations', () => {
        const mockReq = {
          path: '/api/withdraw',
          method: 'POST',
          body: { amount: 1000, currency: 'USDT' },
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('test-agent')
        } as unknown as Request;

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as unknown as Response;

        const mockNext = jest.fn();

        const middleware = paperTradingGuard.interceptTradingOperations();
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'REAL_MONEY_OPERATION',
            riskLevel: 'critical'
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('API Key Permission Validation', () => {
      test('should validate read-only API keys', () => {
        const result = paperTradingGuard.validateApiPermissions('readonly_key_123', 'binance');
        
        expect(result.isValid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.riskLevel).toBe('low');
      });

      test('should reject API keys with trading permissions', () => {
        expect(() => {
          paperTradingGuard.validateApiPermissions('trading_key_with_trade_permissions', 'binance');
        }).toThrow(PaperTradingError);
      });

      test('should reject API keys with withdrawal permissions', () => {
        expect(() => {
          paperTradingGuard.validateApiPermissions('withdraw_key_with_withdraw_permissions', 'binance');
        }).toThrow(PaperTradingError);
      });
    });

    describe('Security Audit Logging', () => {
      test('should log security events', () => {
        const initialLogLength = paperTradingGuard.getSecurityAuditLog().length;
        
        paperTradingGuard.validatePaperTradingMode();
        
        const newLogLength = paperTradingGuard.getSecurityAuditLog().length;
        expect(newLogLength).toBeGreaterThan(initialLogLength);
      });

      test('should maintain audit log size limit', () => {
        // Generate many log entries
        for (let i = 0; i < 1100; i++) {
          try {
            paperTradingGuard.validateApiPermissions(`test_key_${i}`, 'test');
          } catch (error) {
            // Expected to fail, we just want to generate log entries
          }
        }

        const auditLog = paperTradingGuard.getSecurityAuditLog();
        expect(auditLog.length).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('VirtualPortfolioManager', () => {
    const testUserId = 'test_user_123';

    beforeEach(async () => {
      // Reset portfolio for clean tests
      virtualPortfolioManager.resetUserPortfolio(testUserId);
    });

    describe('Portfolio Initialization', () => {
      test('should initialize virtual portfolio with default balance', async () => {
        const balance = await virtualPortfolioManager.initializeUserPortfolio(testUserId);
        
        expect(balance.userId).toBe(testUserId);
        expect(balance.totalBalance).toBe(10000); // Default $10,000
        expect(balance.availableBalance).toBe(10000);
        expect(balance.lockedBalance).toBe(0);
        expect(balance.currency).toBe('USDT');
      });

      test('should not reinitialize existing portfolio', async () => {
        await virtualPortfolioManager.initializeUserPortfolio(testUserId);
        const balance1 = virtualPortfolioManager.getVirtualBalance(testUserId);
        
        await virtualPortfolioManager.initializeUserPortfolio(testUserId);
        const balance2 = virtualPortfolioManager.getVirtualBalance(testUserId);
        
        expect(balance1?.lastUpdated).toEqual(balance2?.lastUpdated);
      });
    });

    describe('Simulated Trade Execution', () => {
      test('should execute buy trade and update balance', async () => {
        await virtualPortfolioManager.initializeUserPortfolio(testUserId);
        
        const trade = await virtualPortfolioManager.executeSimulatedTrade(
          testUserId,
          'BTCUSDT',
          'BUY',
          0.001,
          50000
        );

        expect(trade.isPaperTrade).toBe(true);
        expect(trade.symbol).toBe('BTCUSDT');
        expect(trade.side).toBe('BUY');
        expect(trade.quantity).toBe(0.001);
        expect(trade.price).toBeGreaterThan(0);
        expect(trade.fee).toBeGreaterThan(0);

        const balance = virtualPortfolioManager.getVirtualBalance(testUserId);
        expect(balance?.availableBalance).toBeLessThan(10000);
      });

      test('should execute sell trade and update balance', async () => {
        await virtualPortfolioManager.initializeUserPortfolio(testUserId);
        
        // First buy some BTC
        await virtualPortfolioManager.executeSimulatedTrade(testUserId, 'BTCUSDT', 'BUY', 0.001, 50000);
        
        // Then sell it
        const sellTrade = await virtualPortfolioManager.executeSimulatedTrade(
          testUserId,
          'BTCUSDT',
          'SELL',
          0.001,
          51000
        );

        expect(sellTrade.isPaperTrade).toBe(true);
        expect(sellTrade.side).toBe('SELL');
        
        const balance = virtualPortfolioManager.getVirtualBalance(testUserId);
        expect(balance?.availableBalance).toBeGreaterThan(9950); // Should have made profit minus fees
      });

      test('should reject trade with insufficient balance', async () => {
        await virtualPortfolioManager.initializeUserPortfolio(testUserId);
        
        await expect(
          virtualPortfolioManager.executeSimulatedTrade(testUserId, 'BTCUSDT', 'BUY', 1, 50000)
        ).rejects.toThrow('Insufficient virtual balance');
      });
    });

    describe('Portfolio Summary', () => {
      test('should generate comprehensive portfolio summary', async () => {
        await virtualPortfolioManager.initializeUserPortfolio(testUserId);
        await virtualPortfolioManager.executeSimulatedTrade(testUserId, 'BTCUSDT', 'BUY', 0.001, 50000);
        
        const summary = virtualPortfolioManager.getPortfolioSummary(testUserId);
        
        expect(summary).toBeDefined();
        expect(summary?.isPaperPortfolio).toBe(true);
        expect(summary?.userId).toBe(testUserId);
        expect(summary?.positions.length).toBeGreaterThan(0);
        expect(summary?.tradeHistory.length).toBeGreaterThan(0);
        expect(summary?.performance).toBeDefined();
      });
    });
  });

  describe('TradeSimulationEngine', () => {
    describe('Order Simulation', () => {
      test('should simulate market order execution', async () => {
        const orderRequest = {
          symbol: 'BTCUSDT',
          side: 'buy' as const,
          type: 'market' as const,
          quantity: 0.001,
          exchange: 'binance'
        };

        const result = await tradeSimulationEngine.simulateOrderExecution(orderRequest);

        expect(result.isPaperTrade).toBe(true);
        expect(result.status).toBe('filled');
        expect(result.simulationDetails).toBeDefined();
        expect(result.simulationDetails.slippage).toBeGreaterThanOrEqual(0);
        expect(result.simulationDetails.fee).toBeGreaterThan(0);
      });

      test('should simulate limit order execution', async () => {
        const orderRequest = {
          symbol: 'BTCUSDT',
          side: 'buy' as const,
          type: 'limit' as const,
          quantity: 0.001,
          price: 50000,
          exchange: 'binance'
        };

        const result = await tradeSimulationEngine.simulateOrderExecution(orderRequest);

        expect(result.isPaperTrade).toBe(true);
        expect(result.simulationDetails.originalPrice).toBe(50000);
        expect(result.simulationDetails.slippagePercent).toBeGreaterThanOrEqual(0);
      });

      test('should apply realistic slippage and fees', async () => {
        const orderRequest = {
          symbol: 'BTCUSDT',
          side: 'buy' as const,
          type: 'market' as const,
          quantity: 0.1, // Larger order for more slippage
          exchange: 'binance'
        };

        const result = await tradeSimulationEngine.simulateOrderExecution(orderRequest);

        expect(result.simulationDetails.slippage).toBeGreaterThan(0);
        expect(result.simulationDetails.fee).toBeGreaterThan(0);
        expect(result.simulationDetails.marketImpact).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Order Management', () => {
      test('should cancel simulated orders', async () => {
        const orderRequest = {
          symbol: 'BTCUSDT',
          side: 'buy' as const,
          type: 'limit' as const,
          quantity: 0.001,
          price: 45000, // Below market for testing
          exchange: 'binance'
        };

        const result = await tradeSimulationEngine.simulateOrderExecution(orderRequest);
        const cancelled = tradeSimulationEngine.cancelSimulatedOrder(result.orderId);

        expect(cancelled).toBe(true);
        
        const order = tradeSimulationEngine.getSimulatedOrder(result.orderId);
        expect(order?.status).toBe('cancelled');
      });

      test('should not cancel filled orders', async () => {
        const orderRequest = {
          symbol: 'BTCUSDT',
          side: 'buy' as const,
          type: 'market' as const,
          quantity: 0.001,
          exchange: 'binance'
        };

        const result = await tradeSimulationEngine.simulateOrderExecution(orderRequest);
        const cancelled = tradeSimulationEngine.cancelSimulatedOrder(result.orderId);

        expect(cancelled).toBe(false); // Cannot cancel filled orders
      });
    });

    describe('Simulation Statistics', () => {
      test('should provide simulation statistics', async () => {
        // Execute a few orders
        for (let i = 0; i < 3; i++) {
          await tradeSimulationEngine.simulateOrderExecution({
            symbol: 'BTCUSDT',
            side: 'buy',
            type: 'market',
            quantity: 0.001,
            exchange: 'binance'
          });
        }

        const stats = tradeSimulationEngine.getSimulationStats();

        expect(stats.totalOrders).toBeGreaterThanOrEqual(3);
        expect(stats.filledOrders).toBeGreaterThan(0);
        expect(stats.averageSlippage).toBeGreaterThanOrEqual(0);
        expect(stats.averageFee).toBeGreaterThan(0);
      });
    });
  });

  describe('ApiPermissionValidator', () => {
    describe('API Key Validation', () => {
      test('should validate safe API keys', async () => {
        const apiInfo = {
          exchange: 'binance',
          apiKey: 'readonly_key_12345',
          sandbox: true,
          testConnection: false
        };

        const result = await apiPermissionValidator.validateApiKey(apiInfo);

        expect(result.isValid).toBe(true);
        expect(result.isReadOnly).toBe(true);
        expect(result.riskLevel).toBe('low');
      });

      test('should reject dangerous API keys', async () => {
        const apiInfo = {
          exchange: 'binance',
          apiKey: 'trading_key_with_trade_permissions',
          sandbox: false,
          testConnection: false
        };

        await expect(
          apiPermissionValidator.validateApiKey(apiInfo)
        ).rejects.toThrow(ApiPermissionValidationError);
      });

      test('should detect withdrawal permissions', async () => {
        const apiInfo = {
          exchange: 'binance',
          apiKey: 'withdraw_key_with_withdraw_access',
          sandbox: false,
          testConnection: false
        };

        await expect(
          apiPermissionValidator.validateApiKey(apiInfo)
        ).rejects.toThrow(ApiPermissionValidationError);
      });

      test('should handle KuCoin passphrase validation', async () => {
        const apiInfo = {
          exchange: 'kucoin',
          apiKey: 'kucoin_key_123',
          passphrase: 'trading_passphrase',
          sandbox: false,
          testConnection: false
        };

        await expect(
          apiPermissionValidator.validateApiKey(apiInfo)
        ).rejects.toThrow(ApiPermissionValidationError);
      });
    });

    describe('Validation Caching', () => {
      test('should cache validation results', async () => {
        const apiInfo = {
          exchange: 'binance',
          apiKey: 'test_key_for_caching',
          sandbox: true,
          testConnection: false
        };

        const result1 = await apiPermissionValidator.validateApiKey(apiInfo);
        const result2 = await apiPermissionValidator.validateApiKey(apiInfo);

        expect(result1).toEqual(result2);
      });

      test('should provide cache statistics', () => {
        const stats = apiPermissionValidator.getCacheStats();
        
        expect(stats).toHaveProperty('size');
        expect(stats).toHaveProperty('entries');
        expect(Array.isArray(stats.entries)).toBe(true);
      });
    });
  });

  describe('EnvironmentValidator', () => {
    describe('Environment Validation', () => {
      test('should validate paper trading environment', () => {
        // Mock environment variables for testing
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          PAPER_TRADING_MODE: 'true',
          ALLOW_REAL_TRADES: 'false',
          NODE_ENV: 'test'
        };

        expect(() => environmentValidator.validateEnvironment()).not.toThrow();

        process.env = originalEnv;
      });

      test('should reject unsafe environment configuration', () => {
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          PAPER_TRADING_MODE: 'false',
          ALLOW_REAL_TRADES: 'true',
          NODE_ENV: 'production'
        };

        expect(() => environmentValidator.validateEnvironment()).toThrow(EnvironmentValidationError);

        process.env = originalEnv;
      });

      test('should validate production safety settings', () => {
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          NODE_ENV: 'production',
          PAPER_TRADING_MODE: 'true',
          ALLOW_REAL_TRADES: 'false',
          JWT_SECRET: 'very_secure_secret_key_for_production_use_only'
        };

        expect(() => environmentValidator.validateEnvironment()).not.toThrow();

        process.env = originalEnv;
      });
    });

    describe('Environment Status', () => {
      test('should provide environment status', () => {
        const status = environmentValidator.getEnvironmentStatus();

        expect(status).toHaveProperty('isPaperTradingMode');
        expect(status).toHaveProperty('allowRealTrades');
        expect(status).toHaveProperty('environment');
        expect(status).toHaveProperty('isProduction');
        expect(status).toHaveProperty('configuredExchanges');
        expect(Array.isArray(status.configuredExchanges)).toBe(true);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should enforce paper trading across all components', async () => {
      const testUserId = 'integration_test_user';
      
      // Initialize virtual portfolio
      await virtualPortfolioManager.initializeUserPortfolio(testUserId);
      
      // Simulate order execution
      const orderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0.001,
        exchange: 'binance'
      };
      
      const simulatedOrder = await tradeSimulationEngine.simulateOrderExecution(orderRequest);
      
      // Execute trade in virtual portfolio
      const trade = await virtualPortfolioManager.executeSimulatedTrade(
        testUserId,
        simulatedOrder.symbol,
        simulatedOrder.side === 'buy' ? 'BUY' : 'SELL',
        simulatedOrder.quantity,
        simulatedOrder.price || 50000,
        simulatedOrder.orderId
      );

      // Verify all components marked as paper trading
      expect(simulatedOrder.isPaperTrade).toBe(true);
      expect(trade.isPaperTrade).toBe(true);
      
      const portfolio = virtualPortfolioManager.getPortfolioSummary(testUserId);
      expect(portfolio?.isPaperPortfolio).toBe(true);
    });

    test('should maintain security audit trail', async () => {
      // Trigger various security events
      paperTradingGuard.validatePaperTradingMode();
      
      try {
        await apiPermissionValidator.validateApiKey({
          exchange: 'test',
          apiKey: 'dangerous_trading_key',
          sandbox: false
        });
      } catch (error) {
        // Expected to fail
      }

      // Check audit logs
      const securityLog = paperTradingGuard.getSecurityAuditLog();
      expect(securityLog.length).toBeGreaterThan(0);
      
      const recentEvents = securityLog.filter(
        event => Date.now() - event.timestamp < 10000 // Last 10 seconds
      );
      expect(recentEvents.length).toBeGreaterThan(0);
    });

    test('should block all real money operations', () => {
      const dangerousOperations = [
        '/api/withdraw',
        '/api/transfer',
        '/api/futures/trade',
        '/api/margin/borrow'
      ];

      dangerousOperations.forEach(path => {
        const mockReq = {
          path,
          method: 'POST',
          body: {},
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('test-agent')
        } as unknown as Request;

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as unknown as Response;

        const mockNext = jest.fn();

        const middleware = paperTradingGuard.interceptTradingOperations();
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });
});