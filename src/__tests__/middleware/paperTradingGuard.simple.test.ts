/**
 * Simple Paper Trading Guard Middleware Tests
 * Tests the core paper trading safety mechanisms
 */

import { PaperTradingGuard, PaperTradingError } from '../../middleware/paperTradingGuard';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Paper Trading Guard - Core Functionality', () => {
  let paperTradingGuard: PaperTradingGuard;

  beforeEach(() => {
    // Set safe environment variables
    process.env.TRADING_SIMULATION_ONLY = 'true';
    process.env.PAPER_TRADING_MODE = 'true';
    process.env.ALLOW_REAL_TRADES = 'false';
    process.env.NODE_ENV = 'test';

    paperTradingGuard = PaperTradingGuard.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Environment Validation', () => {
    it('should validate paper trading mode successfully with correct environment', () => {
      expect(() => paperTradingGuard.validatePaperTradingMode()).not.toThrow();
    });

    it('should throw error when TRADING_SIMULATION_ONLY is not true', () => {
      process.env.TRADING_SIMULATION_ONLY = 'false';
      
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow(PaperTradingError);
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow('TRADING_SIMULATION_ONLY must be set to true');
    });

    it('should throw error when PAPER_TRADING_MODE is not true', () => {
      process.env.PAPER_TRADING_MODE = 'false';
      
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow(PaperTradingError);
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow('PAPER_TRADING_MODE must be set to true');
    });

    it('should throw error when ALLOW_REAL_TRADES is true', () => {
      process.env.ALLOW_REAL_TRADES = 'true';
      
      expect(() => paperTradingGuard.validatePaperTradingMode()).toThrow(PaperTradingError);
    });
  });

  describe('API Permission Validation', () => {
    it('should validate empty API keys as safe', async () => {
      const result = await paperTradingGuard.validateApiPermissions('', 'binance');
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.riskLevel).toBe('low');
    });

    it('should detect suspicious API key patterns', async () => {
      await expect(paperTradingGuard.validateApiPermissions('trade-enabled-key', 'binance')).rejects.toThrow(PaperTradingError);
    });

    it('should detect withdrawal permissions in API keys', async () => {
      await expect(paperTradingGuard.validateApiPermissions('withdraw-enabled-key', 'kucoin')).rejects.toThrow(PaperTradingError);
    });
  });

  describe('Configuration Management', () => {
    it('should return correct paper trading configuration', () => {
      const config = paperTradingGuard.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);
      expect(config.initialVirtualBalance).toBeGreaterThan(0);
      expect(config.virtualTradingFee).toBeGreaterThan(0);
    });

    it('should force paper trading mode when called', () => {
      paperTradingGuard.forcePaperTradingMode();
      
      const config = paperTradingGuard.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.allowRealTrades).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide paper trading statistics', () => {
      const stats = paperTradingGuard.getPaperTradingStats();
      
      expect(stats).toHaveProperty('totalInterceptions');
      expect(stats).toHaveProperty('criticalBlocks');
      expect(stats).toHaveProperty('paperTradeConversions');
      expect(stats).toHaveProperty('unsafeOperationsBlocked');
      expect(stats).toHaveProperty('safetyScore');
      
      expect(typeof stats.safetyScore).toBe('number');
      expect(stats.safetyScore).toBeGreaterThanOrEqual(0);
      expect(stats.safetyScore).toBeLessThanOrEqual(100);
    });

    it('should export security audit log', () => {
      const exportData = paperTradingGuard.exportSecurityAuditLog();
      
      expect(exportData).toHaveProperty('exportTime');
      expect(exportData).toHaveProperty('totalEvents');
      expect(exportData).toHaveProperty('events');
      expect(exportData).toHaveProperty('summary');
      
      expect(exportData.summary.paperTradingEnabled).toBe(true);
      expect(exportData.summary.realTradesBlocked).toBe(true);
    });
  });

  describe('Security Audit Log', () => {
    it('should maintain security audit log', () => {
      const auditLog = paperTradingGuard.getSecurityAuditLog();
      
      expect(Array.isArray(auditLog)).toBe(true);
    });

    it('should limit audit log size', () => {
      const auditLog = paperTradingGuard.getSecurityAuditLog(10);
      
      expect(auditLog.length).toBeLessThanOrEqual(10);
    });
  });
});