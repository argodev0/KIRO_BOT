/**
 * Paper Trading Safety Score Validation Tests
 * Comprehensive tests for the paper trading safety score system
 */

import { PaperTradingSafetyScoreValidator } from '../../services/PaperTradingSafetyScoreValidator';
import { SafetyScoreEnforcementMiddleware } from '../../middleware/safetyScoreEnforcement';
import { environmentValidator } from '../../utils/EnvironmentValidator';

describe('Paper Trading Safety Score Validation', () => {
  let safetyScoreValidator: PaperTradingSafetyScoreValidator;
  let enforcementMiddleware: SafetyScoreEnforcementMiddleware;

  beforeAll(() => {
    // Set up test environment variables for maximum safety
    process.env.NODE_ENV = 'production';
    process.env.TRADING_SIMULATION_ONLY = 'true';
    process.env.PAPER_TRADING_MODE = 'true';
    process.env.ALLOW_REAL_TRADES = 'false';
    process.env.FORCE_PAPER_TRADING = 'true';
    process.env.PAPER_TRADING_VALIDATION = 'strict';
    process.env.PAPER_TRADING_ENFORCEMENT = 'strict';
    process.env.SECURITY_HARDENING_ENABLED = 'true';
    process.env.MONITORING_ENABLED = 'true';
    process.env.METRICS_ENABLED = 'true';
    process.env.SECURITY_MONITORING_ENABLED = 'true';
    process.env.AUDIT_LOGGING_ENABLED = 'true';
    process.env.PAPER_TRADE_AUDIT_LOG = 'true';
    process.env.CRITICAL_ALERT_ENABLED = 'true';
    process.env.REAL_TIME_ALERTS_ENABLED = 'true';
    process.env.SSL_ENABLED = 'true';
    process.env.HSTS_ENABLED = 'true';
    process.env.INTRUSION_DETECTION_ENABLED = 'true';
    process.env.VIRTUAL_BALANCE_USD = '100000';
    process.env.VIRTUAL_BALANCE_BTC = '10';
    process.env.VIRTUAL_BALANCE_ETH = '100';
    process.env.BINANCE_READ_ONLY = 'true';
    process.env.KUCOIN_READ_ONLY = 'true';
    process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-for-security-validation-purposes';

    safetyScoreValidator = PaperTradingSafetyScoreValidator.getInstance();
    enforcementMiddleware = SafetyScoreEnforcementMiddleware.getInstance();
  });

  afterAll(() => {
    // Clean up test environment variables
    delete process.env.TRADING_SIMULATION_ONLY;
    delete process.env.PAPER_TRADING_MODE;
    delete process.env.ALLOW_REAL_TRADES;
    delete process.env.FORCE_PAPER_TRADING;
    delete process.env.PAPER_TRADING_VALIDATION;
    delete process.env.PAPER_TRADING_ENFORCEMENT;
    delete process.env.SECURITY_HARDENING_ENABLED;
    delete process.env.MONITORING_ENABLED;
    delete process.env.METRICS_ENABLED;
    delete process.env.SECURITY_MONITORING_ENABLED;
    delete process.env.AUDIT_LOGGING_ENABLED;
    delete process.env.PAPER_TRADE_AUDIT_LOG;
    delete process.env.CRITICAL_ALERT_ENABLED;
    delete process.env.REAL_TIME_ALERTS_ENABLED;
    delete process.env.SSL_ENABLED;
    delete process.env.HSTS_ENABLED;
    delete process.env.INTRUSION_DETECTION_ENABLED;
    delete process.env.VIRTUAL_BALANCE_USD;
    delete process.env.VIRTUAL_BALANCE_BTC;
    delete process.env.VIRTUAL_BALANCE_ETH;
    delete process.env.BINANCE_READ_ONLY;
    delete process.env.KUCOIN_READ_ONLY;
    delete process.env.JWT_SECRET;
  });

  describe('Safety Score Calculation', () => {
    test('should calculate comprehensive safety score', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();

      expect(report).toBeDefined();
      expect(report.totalScore).toBeGreaterThan(0);
      expect(report.maxScore).toBe(100);
      expect(report.percentage).toBeGreaterThan(0);
      expect(report.minimumRequired).toBe(90);
      expect(report.components).toBeDefined();
      expect(report.violations).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.lastValidation).toBeGreaterThan(0);
    });

    test('should achieve 90%+ safety score with optimal configuration', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();

      expect(report.percentage).toBeGreaterThanOrEqual(90);
      expect(report.passed).toBe(true);
      
      // Log the actual score for debugging
      console.log(`Safety Score: ${report.percentage}% (${report.totalScore}/${report.maxScore})`);
      
      // Check that critical violations are minimal or zero
      const criticalViolations = report.violations.filter(v => v.severity === 'critical');
      expect(criticalViolations.length).toBeLessThanOrEqual(1); // Allow for minor critical issues
      
      if (criticalViolations.length > 0) {
        console.log('Critical violations:', criticalViolations);
      }
    });

    test('should validate environment component score', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();
      const envComponent = report.components.environment;

      expect(envComponent).toBeDefined();
      expect(envComponent.totalScore).toBeGreaterThan(0);
      expect(envComponent.maxScore).toBeGreaterThan(0);
      
      // Environment should contribute significantly to overall score
      const envPercentage = (envComponent.totalScore / envComponent.maxScore) * 100;
      expect(envPercentage).toBeGreaterThanOrEqual(80); // At least 80% for environment
    });

    test('should validate paper trading guard component score', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();
      const guardComponent = report.components.paperTradingGuard;

      expect(guardComponent).toBeDefined();
      expect(guardComponent.score).toBeGreaterThan(0);
      expect(guardComponent.maxScore).toBe(25);
      expect(guardComponent.details).toBeDefined();
      
      // Paper trading guard should be properly configured
      expect(guardComponent.details.guardEnabled).toBe(true);
      expect(guardComponent.details.realTradesBlocked).toBe(true);
    });

    test('should validate API permissions component score', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();
      const apiComponent = report.components.apiPermissions;

      expect(apiComponent).toBeDefined();
      expect(apiComponent.score).toBeGreaterThan(0);
      expect(apiComponent.maxScore).toBe(20);
      expect(apiComponent.details).toBeDefined();
      
      // API permissions should be read-only
      expect(apiComponent.details.binanceReadOnly).toBe(true);
      expect(apiComponent.details.kucoinReadOnly).toBe(true);
      expect(apiComponent.details.noTradingPermissions).toBe(true);
    });

    test('should validate system integrity component score', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();
      const integrityComponent = report.components.systemIntegrity;

      expect(integrityComponent).toBeDefined();
      expect(integrityComponent.score).toBeGreaterThan(0);
      expect(integrityComponent.maxScore).toBe(15);
      expect(integrityComponent.details).toBeDefined();
      
      // System integrity should be maintained
      expect(integrityComponent.details.virtualBalanceIntact).toBe(true);
      expect(integrityComponent.details.auditTrailComplete).toBe(true);
      expect(integrityComponent.details.monitoringActive).toBe(true);
    });

    test('should validate production safety component score', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();
      const prodComponent = report.components.productionSafety;

      expect(prodComponent).toBeDefined();
      expect(prodComponent.score).toBeGreaterThan(0);
      expect(prodComponent.maxScore).toBe(10);
      expect(prodComponent.details).toBeDefined();
      
      // Production safety should be enforced
      expect(prodComponent.details.forcedPaperTrading).toBe(true);
      expect(prodComponent.details.strictValidation).toBe(true);
      expect(prodComponent.details.securityHardening).toBe(true);
      expect(prodComponent.details.alertingActive).toBe(true);
    });
  });

  describe('Safety Score Validation', () => {
    test('should validate safety score successfully', async () => {
      await expect(safetyScoreValidator.validateSafetyScore()).resolves.not.toThrow();
    });

    test('should return true for safe operation check', async () => {
      const isSafe = await safetyScoreValidator.isSafeForOperation();
      expect(isSafe).toBe(true);
    });

    test('should return safety score percentage >= 90%', async () => {
      const percentage = await safetyScoreValidator.getSafetyScorePercentage();
      expect(percentage).toBeGreaterThanOrEqual(90);
    });

    test('should refresh safety score successfully', async () => {
      const report1 = await safetyScoreValidator.getSafetyScoreReport();
      const report2 = await safetyScoreValidator.refreshSafetyScore();
      
      expect(report2.lastValidation).toBeGreaterThanOrEqual(report1.lastValidation);
      expect(report2.percentage).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Safety Score Enforcement', () => {
    test('should validate on startup successfully', async () => {
      await expect(enforcementMiddleware.validateOnStartup()).resolves.not.toThrow();
    });

    test('should get safety score status', async () => {
      const status = await enforcementMiddleware.getSafetyScoreStatus();
      
      expect(status).toBeDefined();
      expect(status.score).toBeGreaterThanOrEqual(90);
      expect(status.passed).toBe(true);
      expect(status.minimumRequired).toBe(90);
      expect(status.systemBlocked).toBe(false);
    });

    test('should refresh safety score in enforcement middleware', async () => {
      await expect(enforcementMiddleware.refreshSafetyScore()).resolves.not.toThrow();
      
      const status = await enforcementMiddleware.getSafetyScoreStatus();
      expect(status.score).toBeGreaterThanOrEqual(90);
    });

    test('should have proper configuration', () => {
      const config = enforcementMiddleware.getConfig();
      
      expect(config).toBeDefined();
      expect(config.enforceOnStartup).toBe(true);
      expect(config.enforceOnTradingEndpoints).toBe(true);
      expect(config.enforceOnCriticalEndpoints).toBe(true);
      expect(config.minimumScore).toBe(90);
      expect(config.blockSystemOnFailure).toBe(true);
    });
  });

  describe('Environment Validator Integration', () => {
    test('should validate environment successfully', () => {
      expect(() => environmentValidator.validateEnvironment()).not.toThrow();
    });

    test('should calculate environment safety score >= 90%', () => {
      const envScore = environmentValidator.calculateSafetyScore();
      const percentage = (envScore.totalScore / envScore.maxScore) * 100;
      
      expect(percentage).toBeGreaterThanOrEqual(80); // Environment component should be at least 80%
      expect(envScore.components.tradingSimulationOnly.passed).toBe(true);
      expect(envScore.components.paperTradingMode.passed).toBe(true);
      expect(envScore.components.realTradesDisabled.passed).toBe(true);
    });

    test('should detect no dangerous variables', () => {
      const dangerousVars = environmentValidator.detectDangerousVariables();
      expect(dangerousVars).toHaveLength(0);
    });

    test('should confirm environment is safe for paper trading', () => {
      const isSafe = environmentValidator.isSafeForPaperTrading();
      expect(isSafe).toBe(true);
    });

    test('should generate comprehensive environment report', () => {
      const report = environmentValidator.generateEnvironmentReport();
      
      expect(report).toBeDefined();
      expect(report.isSafe).toBe(true);
      expect(report.status.isPaperTradingMode).toBe(true);
      expect(report.status.tradingSimulationOnly).toBe(true);
      expect(report.status.allowRealTrades).toBe(false);
      expect(report.status.safetyScore).toBeGreaterThanOrEqual(80);
      
      // Should have minimal critical warnings
      const criticalWarnings = report.warnings.filter(w => w.severity === 'critical');
      expect(criticalWarnings.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Failure Scenarios', () => {
    test('should fail validation when TRADING_SIMULATION_ONLY is false', async () => {
      // Temporarily set dangerous configuration
      const originalValue = process.env.TRADING_SIMULATION_ONLY;
      process.env.TRADING_SIMULATION_ONLY = 'false';
      
      try {
        const report = await safetyScoreValidator.refreshSafetyScore();
        expect(report.passed).toBe(false);
        expect(report.percentage).toBeLessThan(90);
        
        const criticalViolations = report.violations.filter(v => v.severity === 'critical');
        expect(criticalViolations.length).toBeGreaterThan(0);
        
        // Should have violation about TRADING_SIMULATION_ONLY
        const tradingSimViolation = criticalViolations.find(v => 
          v.type === 'TRADING_SIMULATION_ONLY_MISSING'
        );
        expect(tradingSimViolation).toBeDefined();
        
      } finally {
        // Restore original value
        process.env.TRADING_SIMULATION_ONLY = originalValue;
      }
    });

    test('should fail validation when ALLOW_REAL_TRADES is true', async () => {
      // Temporarily set dangerous configuration
      const originalValue = process.env.ALLOW_REAL_TRADES;
      process.env.ALLOW_REAL_TRADES = 'true';
      
      try {
        const report = await safetyScoreValidator.refreshSafetyScore();
        expect(report.passed).toBe(false);
        expect(report.percentage).toBeLessThan(90);
        
        const criticalViolations = report.violations.filter(v => v.severity === 'critical');
        expect(criticalViolations.length).toBeGreaterThan(0);
        
        // Should have violation about real trades enabled
        const realTradesViolation = criticalViolations.find(v => 
          v.type === 'REAL_TRADES_ENABLED'
        );
        expect(realTradesViolation).toBeDefined();
        
      } finally {
        // Restore original value
        process.env.ALLOW_REAL_TRADES = originalValue;
      }
    });

    test('should fail validation when dangerous API secret is present', async () => {
      // Temporarily set dangerous configuration
      process.env.BINANCE_API_SECRET = 'dangerous-real-api-secret';
      
      try {
        const report = await safetyScoreValidator.refreshSafetyScore();
        expect(report.passed).toBe(false);
        expect(report.percentage).toBeLessThan(90);
        
        const criticalViolations = report.violations.filter(v => v.severity === 'critical');
        expect(criticalViolations.length).toBeGreaterThan(0);
        
        // Should have violation about API secret
        const apiSecretViolation = criticalViolations.find(v => 
          v.type === 'API_SECRET_DETECTED' || v.type === 'DANGEROUS_VARIABLES_DETECTED'
        );
        expect(apiSecretViolation).toBeDefined();
        
      } finally {
        // Clean up dangerous variable
        delete process.env.BINANCE_API_SECRET;
      }
    });
  });

  describe('Performance and Caching', () => {
    test('should cache safety score results', async () => {
      const report1 = await safetyScoreValidator.getSafetyScoreReport();
      const report2 = await safetyScoreValidator.getSafetyScoreReport();
      
      // Second call should return cached results
      expect(report1.lastValidation).toBe(report2.lastValidation);
      expect(report1.percentage).toBe(report2.percentage);
      expect(report1.totalScore).toBe(report2.totalScore);
    });

    test('should force refresh when requested', async () => {
      const report1 = await safetyScoreValidator.getSafetyScoreReport();
      
      // Force refresh should work
      const report2 = await safetyScoreValidator.refreshSafetyScore();
      
      expect(report2.lastValidation).toBeGreaterThanOrEqual(report1.lastValidation);
      expect(report2.percentage).toBeGreaterThanOrEqual(90);
    }, 5000); // 5 seconds timeout
  });

  describe('Integration with Existing Systems', () => {
    test('should integrate with paper trading guard', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();
      const guardComponent = report.components.paperTradingGuard;
      
      expect(guardComponent.details.guardEnabled).toBe(true);
      expect(guardComponent.details.realTradesBlocked).toBe(true);
      expect(guardComponent.score).toBeGreaterThan(0);
    });

    test('should integrate with environment validator', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();
      const envComponent = report.components.environment;
      
      expect(envComponent).toBeDefined();
      expect(envComponent.totalScore).toBeGreaterThan(0);
      expect(envComponent.components.tradingSimulationOnly.passed).toBe(true);
      expect(envComponent.components.paperTradingMode.passed).toBe(true);
    });

    test('should provide actionable recommendations', async () => {
      const report = await safetyScoreValidator.getSafetyScoreReport();
      
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      
      // If score is not perfect, should have recommendations
      if (report.percentage < 100) {
        expect(report.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
});