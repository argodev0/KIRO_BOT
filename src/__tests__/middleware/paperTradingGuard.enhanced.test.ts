/**
 * Enhanced Paper Trading Guard Middleware Tests
 * Tests the comprehensive paper trading safety mechanisms
 */

import { Request, Response, NextFunction } from 'express';
import { PaperTradingGuard, PaperTradingError, PAPER_TRADING_ERRORS } from '../../middleware/paperTradingGuard';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Enhanced Paper Trading Guard Middleware', () => {
  let paperTradingGuard: PaperTradingGuard;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset environment variables
    process.env.TRADING_SIMULATION_ONLY = 'true';
    process.env.PAPER_TRADING_MODE = 'true';
    process.env.ALLOW_REAL_TRADES = 'false';
    process.env.NODE_ENV = 'production';

    paperTradingGuard = PaperTradingGuard.getInstance();
    
    mockReq = {
      path: '/api/trading/order',
      method: 'POST',
      body: {},
      query: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
      sessionID: 'test-session'
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Environment Variable Validation', () => {
    it('should pass validation when all required environment variables are set correctly', () => {
      expect(() => paperTradingGuard.validatePaperTradingMode()).not.toThrow();
    });

    it('should throw critical error when TRADING_SIMULATION_ONLY is not true', () => {
      process.env.TRADING_SIMULATION_ONLY = 'false';
      
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow(PaperTradingError);
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow('TRADING_SIMULATION_ONLY must be set to true');
    });

    it('should throw critical error when TRADING_SIMULATION_ONLY is missing', () => {
      delete process.env.TRADING_SIMULATION_ONLY;
      
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow(PaperTradingError);
    });

    it('should throw critical error when PAPER_TRADING_MODE is not true', () => {
      process.env.PAPER_TRADING_MODE = 'false';
      
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow(PaperTradingError);
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow('PAPER_TRADING_MODE must be set to true');
    });

    it('should throw critical error when ALLOW_REAL_TRADES is true', () => {
      process.env.ALLOW_REAL_TRADES = 'true';
      
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow(PaperTradingError);
    });
  });

  describe('Trading Request Interception', () => {
    it('should intercept trading endpoints and convert to paper trades', () => {
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).isPaperTrade).toBe(true);
      expect((mockReq as any).paperTradingMode).toBe(true);
      expect((mockReq as any).virtualTrade).toBe(true);
      expect((mockReq as any).simulationOnly).toBe(true);
    });

    it('should add paper trading markers to request body', () => {
      mockReq.body = { symbol: 'BTCUSDT', amount: 100 };
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.body.isPaperTrade).toBe(true);
      expect(mockReq.body.paperTradingMode).toBe(true);
      expect(mockReq.body.virtualTrade).toBe(true);
      expect(mockReq.body.simulationOnly).toBe(true);
      expect(mockReq.body.realTrade).toBe(false);
      expect(mockReq.body.tradingMode).toBe('PAPER_ONLY');
    });

    it('should not interfere with non-trading endpoints', () => {
      mockReq.path = '/api/user/profile';
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).isPaperTrade).toBeUndefined();
    });
  });

  describe('Real Money Operation Blocking', () => {
    it('should block withdrawal operations', () => {
      mockReq.path = '/api/withdraw';
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'REAL_MONEY_OPERATION',
          riskLevel: 'critical'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block transfer operations', () => {
      mockReq.path = '/api/transfer';
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block operations with real money indicators in body', () => {
      mockReq.body = { type: 'real_trade', amount: 100 };
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Trade Request Validation', () => {
    it('should validate trade requests and detect real money indicators', () => {
      mockReq.body = { symbol: 'BTCUSDT', amount: 100, mode: 'live_trade' };
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'REAL_MONEY_INDICATOR_IN_BODY',
          riskLevel: 'critical'
        })
      );
    });

    it('should block trades exceeding virtual limits', () => {
      mockReq.body = { symbol: 'BTCUSDT', amount: 200000 }; // Exceeds 100k limit
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VIRTUAL_TRADE_LIMIT_EXCEEDED',
          riskLevel: 'high'
        })
      );
    });

    it('should allow valid virtual trades within limits', () => {
      mockReq.body = { symbol: 'BTCUSDT', amount: 1000 };
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.isPaperTrade).toBe(true);
    });
  });

  describe('Unsafe Operation Detection', () => {
    it('should detect and block unsafe operation patterns', () => {
      mockReq.body = { action: 'execute_real_trade', symbol: 'BTCUSDT' };
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UNSAFE_OPERATION_BLOCKED',
          riskLevel: 'critical'
        })
      );
    });

    it('should detect unsafe patterns in query parameters', () => {
      mockReq.query = { mode: 'place_live_order' };
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Comprehensive Logging', () => {
    it('should log all paper trade attempts with comprehensive details', () => {
      mockReq.body = { symbol: 'BTCUSDT', amount: 100 };
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const auditLog = paperTradingGuard.getSecurityAuditLog();
      const paperTradeLog = auditLog.find(log => log.event === 'paper_trade_attempt_logged');
      
      expect(paperTradeLog).toBeDefined();
      expect(paperTradeLog?.details).toMatchObject({
        path: '/api/trading/order',
        method: 'POST',
        ip: '127.0.0.1'
      });
    });

    it('should maintain security audit log with proper risk levels', () => {
      const middleware = paperTradingGuard.interceptTradingOperations();
      
      // Trigger a critical error
      mockReq.body = { action: 'withdraw_funds' };
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const auditLog = paperTradingGuard.getSecurityAuditLog();
      const criticalEvents = auditLog.filter(log => log.riskLevel === 'critical');
      
      expect(criticalEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive paper trading statistics', () => {
      const stats = paperTradingGuard.getPaperTradingStats();
      
      expect(stats).toMatchObject({
        totalInterceptions: expect.any(Number),
        criticalBlocks: expect.any(Number),
        paperTradeConversions: expect.any(Number),
        unsafeOperationsBlocked: expect.any(Number),
        lastValidationTime: expect.any(Number),
        safetyScore: expect.any(Number)
      });
      
      expect(stats.safetyScore).toBeGreaterThanOrEqual(0);
      expect(stats.safetyScore).toBeLessThanOrEqual(100);
    });

    it('should export security audit log for analysis', () => {
      const exportData = paperTradingGuard.exportSecurityAuditLog();
      
      expect(exportData).toMatchObject({
        exportTime: expect.any(Number),
        totalEvents: expect.any(Number),
        criticalEvents: expect.any(Number),
        events: expect.any(Array),
        summary: {
          paperTradingEnabled: true,
          realTradesBlocked: true,
          safetyScore: expect.any(Number),
          lastValidation: expect.any(Number)
        }
      });
    });
  });

  describe('API Permission Validation', () => {
    it('should validate API permissions and detect trading capabilities', async () => {
      const result = await paperTradingGuard.validateApiPermissions('test-key-with-trade-permissions', 'binance');
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.riskLevel).toBe('low');
    });

    it('should throw error for API keys with suspicious permissions', async () => {
      await expect(paperTradingGuard.validateApiPermissions('trade-enabled-key', 'binance')).rejects.toThrow(PaperTradingError);
    });

    it('should allow empty API keys (safer option)', async () => {
      const result = await paperTradingGuard.validateApiPermissions('', 'binance');
      
      expect(result.isValid).toBe(true);
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('Configuration Management', () => {
    it('should return current paper trading configuration', () => {
      const config = paperTradingGuard.getConfig();
      
      expect(config).toMatchObject({
        enabled: true,
        allowRealTrades: false,
        initialVirtualBalance: expect.any(Number),
        maxVirtualLeverage: expect.any(Number),
        virtualTradingFee: expect.any(Number),
        slippageSimulation: expect.any(Boolean)
      });
    });

    it('should force paper trading mode and prevent disabling', () => {
      paperTradingGuard.forcePaperTradingMode();
      
      const config = paperTradingGuard.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);
    });
  });
});