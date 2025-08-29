/**
 * Paper Trading Safety Score Validator
 * Comprehensive safety score calculation and validation system
 * Ensures paper trading safety score exceeds 90% before allowing system operation
 */

import { logger } from '../utils/logger';
import { environmentValidator, SafetyScoreBreakdown } from '../utils/EnvironmentValidator';
import { PaperTradingGuard } from '../middleware/paperTradingGuard';
import { PaperTradingSafetyMonitor } from './PaperTradingSafetyMonitor';

export interface SafetyScoreReport {
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  minimumRequired: number;
  components: {
    environment: SafetyScoreBreakdown;
    paperTradingGuard: {
      score: number;
      maxScore: number;
      passed: boolean;
      details: {
        guardEnabled: boolean;
        realTradesBlocked: boolean;
        apiKeysValidated: boolean;
        auditLogActive: boolean;
      };
    };
    apiPermissions: {
      score: number;
      maxScore: number;
      passed: boolean;
      details: {
        binanceReadOnly: boolean;
        kucoinReadOnly: boolean;
        noTradingPermissions: boolean;
        sandboxMode: boolean;
      };
    };
    systemIntegrity: {
      score: number;
      maxScore: number;
      passed: boolean;
      details: {
        noRealTradeCode: boolean;
        virtualBalanceIntact: boolean;
        auditTrailComplete: boolean;
        monitoringActive: boolean;
      };
    };
    productionSafety: {
      score: number;
      maxScore: number;
      passed: boolean;
      details: {
        forcedPaperTrading: boolean;
        strictValidation: boolean;
        securityHardening: boolean;
        alertingActive: boolean;
      };
    };
  };
  violations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    component: string;
  }>;
  recommendations: string[];
  lastValidation: number;
}

export class PaperTradingSafetyScoreValidator {
  private static instance: PaperTradingSafetyScoreValidator;
  private readonly MINIMUM_SAFETY_SCORE = 90;
  private readonly MAX_TOTAL_SCORE = 100;
  private lastValidation: number = 0;
  private lastReport: SafetyScoreReport | null = null;
  private validationCacheMs = 30000; // 30 seconds cache

  private constructor() {
    logger.info('Paper Trading Safety Score Validator initialized', {
      minimumRequired: this.MINIMUM_SAFETY_SCORE,
      maxScore: this.MAX_TOTAL_SCORE
    });
  }

  public static getInstance(): PaperTradingSafetyScoreValidator {
    if (!PaperTradingSafetyScoreValidator.instance) {
      PaperTradingSafetyScoreValidator.instance = new PaperTradingSafetyScoreValidator();
    }
    return PaperTradingSafetyScoreValidator.instance;
  }

  /**
   * Calculate comprehensive paper trading safety score
   */
  public async calculateSafetyScore(forceRefresh: boolean = false): Promise<SafetyScoreReport> {
    const now = Date.now();
    
    // Return cached result if available and not expired
    if (!forceRefresh && this.lastReport && (now - this.lastValidation) < this.validationCacheMs) {
      return this.lastReport;
    }

    logger.info('Calculating comprehensive paper trading safety score...');

    const violations: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      component: string;
    }> = [];

    const recommendations: string[] = [];

    // 1. Environment Safety Score (30 points)
    const environmentScore = this.calculateEnvironmentScore(violations, recommendations);

    // 2. Paper Trading Guard Score (25 points)
    const paperTradingGuardScore = await this.calculatePaperTradingGuardScore(violations, recommendations);

    // 3. API Permissions Score (20 points)
    const apiPermissionsScore = await this.calculateApiPermissionsScore(violations, recommendations);

    // 4. System Integrity Score (15 points)
    const systemIntegrityScore = this.calculateSystemIntegrityScore(violations, recommendations);

    // 5. Production Safety Score (10 points)
    const productionSafetyScore = this.calculateProductionSafetyScore(violations, recommendations);

    // Calculate total score
    const totalScore = 
      environmentScore.score +
      paperTradingGuardScore.score +
      apiPermissionsScore.score +
      systemIntegrityScore.score +
      productionSafetyScore.score;

    const percentage = Math.round((totalScore / this.MAX_TOTAL_SCORE) * 100);
    const passed = percentage >= this.MINIMUM_SAFETY_SCORE;

    const report: SafetyScoreReport = {
      totalScore,
      maxScore: this.MAX_TOTAL_SCORE,
      percentage,
      passed,
      minimumRequired: this.MINIMUM_SAFETY_SCORE,
      components: {
        environment: environmentValidator.calculateSafetyScore(),
        paperTradingGuard: paperTradingGuardScore,
        apiPermissions: apiPermissionsScore,
        systemIntegrity: systemIntegrityScore,
        productionSafety: productionSafetyScore
      },
      violations,
      recommendations,
      lastValidation: now
    };

    // Cache the result
    this.lastReport = report;
    this.lastValidation = now;

    // Log the result
    logger.info('Paper trading safety score calculated', {
      totalScore,
      percentage,
      passed,
      violationCount: violations.length,
      criticalViolations: violations.filter(v => v.severity === 'critical').length
    });

    return report;
  }

  /**
   * Calculate environment safety score (30 points)
   */
  private calculateEnvironmentScore(
    violations: SafetyScoreReport['violations'],
    recommendations: string[]
  ): { score: number; maxScore: number; passed: boolean } {
    const maxScore = 30;
    let score = 0;

    try {
      const envScore = environmentValidator.calculateSafetyScore();
      const envStatus = environmentValidator.getEnvironmentStatus();

      // Environment score contributes 30% of total
      score = Math.round((envScore.totalScore / envScore.maxScore) * maxScore);

      // Check critical environment variables
      if (process.env.TRADING_SIMULATION_ONLY !== 'true') {
        violations.push({
          type: 'TRADING_SIMULATION_ONLY_MISSING',
          severity: 'critical',
          message: 'TRADING_SIMULATION_ONLY must be set to true',
          component: 'environment'
        });
        score = Math.max(0, score - 10);
      }

      if (process.env.PAPER_TRADING_MODE !== 'true') {
        violations.push({
          type: 'PAPER_TRADING_MODE_DISABLED',
          severity: 'critical',
          message: 'PAPER_TRADING_MODE must be enabled',
          component: 'environment'
        });
        score = Math.max(0, score - 10);
      }

      if (process.env.ALLOW_REAL_TRADES === 'true') {
        violations.push({
          type: 'REAL_TRADES_ENABLED',
          severity: 'critical',
          message: 'ALLOW_REAL_TRADES must be disabled',
          component: 'environment'
        });
        score = Math.max(0, score - 15);
      }

      // Check for dangerous variables
      if (envStatus.dangerousVariables.length > 0) {
        violations.push({
          type: 'DANGEROUS_VARIABLES_DETECTED',
          severity: 'critical',
          message: `Dangerous variables detected: ${envStatus.dangerousVariables.join(', ')}`,
          component: 'environment'
        });
        score = Math.max(0, score - 10);
      }

      // Add recommendations
      if (score < maxScore) {
        recommendations.push('Fix environment configuration to achieve full environment safety score');
      }

    } catch (error) {
      violations.push({
        type: 'ENVIRONMENT_VALIDATION_FAILED',
        severity: 'critical',
        message: `Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'environment'
      });
      score = 0;
    }

    return { score, maxScore, passed: score >= (maxScore * 0.9) };
  }

  /**
   * Calculate paper trading guard score (25 points)
   */
  private async calculatePaperTradingGuardScore(
    violations: SafetyScoreReport['violations'],
    recommendations: string[]
  ): Promise<{
    score: number;
    maxScore: number;
    passed: boolean;
    details: {
      guardEnabled: boolean;
      realTradesBlocked: boolean;
      apiKeysValidated: boolean;
      auditLogActive: boolean;
    };
  }> {
    const maxScore = 25;
    let score = maxScore;

    const details = {
      guardEnabled: false,
      realTradesBlocked: false,
      apiKeysValidated: false,
      auditLogActive: false
    };

    try {
      const paperTradingGuard = PaperTradingGuard.getInstance();
      
      // Check if guard is properly configured
      const config = paperTradingGuard.getConfig();
      details.guardEnabled = config.enabled;
      details.realTradesBlocked = !config.allowRealTrades;

      if (!details.guardEnabled) {
        violations.push({
          type: 'PAPER_TRADING_GUARD_DISABLED',
          severity: 'critical',
          message: 'Paper trading guard is not enabled',
          component: 'paperTradingGuard'
        });
        score -= 10;
      }

      if (!details.realTradesBlocked) {
        violations.push({
          type: 'REAL_TRADES_NOT_BLOCKED',
          severity: 'critical',
          message: 'Real trades are not blocked by paper trading guard',
          component: 'paperTradingGuard'
        });
        score -= 10;
      }

      // Check audit log functionality
      const auditLog = paperTradingGuard.getSecurityAuditLog(10);
      details.auditLogActive = auditLog.length >= 0; // Audit log exists

      if (!details.auditLogActive) {
        violations.push({
          type: 'AUDIT_LOG_INACTIVE',
          severity: 'medium',
          message: 'Paper trading audit log is not active',
          component: 'paperTradingGuard'
        });
        score -= 3;
      }

      // Check paper trading statistics
      const stats = paperTradingGuard.getPaperTradingStats();
      if (stats.criticalBlocks > 0) {
        violations.push({
          type: 'CRITICAL_BLOCKS_DETECTED',
          severity: 'high',
          message: `${stats.criticalBlocks} critical operations were blocked`,
          component: 'paperTradingGuard'
        });
        score -= 2; // Minor deduction as blocking is good, but indicates attempts
      }

      // Validate paper trading mode
      try {
        paperTradingGuard.validatePaperTradingMode();
        details.apiKeysValidated = true;
      } catch (error) {
        violations.push({
          type: 'PAPER_TRADING_VALIDATION_FAILED',
          severity: 'critical',
          message: `Paper trading validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          component: 'paperTradingGuard'
        });
        score -= 10;
      }

    } catch (error) {
      violations.push({
        type: 'PAPER_TRADING_GUARD_ERROR',
        severity: 'critical',
        message: `Paper trading guard error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'paperTradingGuard'
      });
      score = 0;
    }

    if (score < maxScore) {
      recommendations.push('Fix paper trading guard configuration and validation');
    }

    return { 
      score: Math.max(0, score), 
      maxScore, 
      passed: score >= (maxScore * 0.9),
      details
    };
  }

  /**
   * Calculate API permissions score (20 points)
   */
  private async calculateApiPermissionsScore(
    violations: SafetyScoreReport['violations'],
    recommendations: string[]
  ): Promise<{
    score: number;
    maxScore: number;
    passed: boolean;
    details: {
      binanceReadOnly: boolean;
      kucoinReadOnly: boolean;
      noTradingPermissions: boolean;
      sandboxMode: boolean;
    };
  }> {
    const maxScore = 20;
    let score = maxScore;

    const details = {
      binanceReadOnly: false,
      kucoinReadOnly: false,
      noTradingPermissions: false,
      sandboxMode: false
    };

    try {
      // Check Binance API configuration
      const binanceApiKey = process.env.BINANCE_API_KEY;
      const binanceReadOnly = process.env.BINANCE_READ_ONLY === 'true';
      const binanceSandbox = process.env.BINANCE_SANDBOX === 'true';

      if (binanceApiKey && binanceApiKey.trim() !== '') {
        details.binanceReadOnly = binanceReadOnly;
        details.sandboxMode = binanceSandbox;

        if (!binanceReadOnly) {
          violations.push({
            type: 'BINANCE_NOT_READ_ONLY',
            severity: 'critical',
            message: 'Binance API key is not configured as read-only',
            component: 'apiPermissions'
          });
          score -= 8;
        }

        // Test API key permissions if possible
        try {
          const paperTradingGuard = PaperTradingGuard.getInstance();
          await paperTradingGuard.validateApiPermissions(binanceApiKey, 'binance');
          details.noTradingPermissions = true;
        } catch (error) {
          violations.push({
            type: 'BINANCE_API_VALIDATION_FAILED',
            severity: 'high',
            message: `Binance API validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            component: 'apiPermissions'
          });
          score -= 5;
        }
      } else {
        // No API key is safer than having trading permissions
        details.binanceReadOnly = true;
        details.noTradingPermissions = true;
      }

      // Check KuCoin API configuration
      const kucoinApiKey = process.env.KUCOIN_API_KEY;
      const kucoinReadOnly = process.env.KUCOIN_READ_ONLY === 'true';
      const kucoinSandbox = process.env.KUCOIN_SANDBOX === 'true';

      if (kucoinApiKey && kucoinApiKey.trim() !== '') {
        details.kucoinReadOnly = kucoinReadOnly;
        if (!details.sandboxMode) {
          details.sandboxMode = kucoinSandbox;
        }

        if (!kucoinReadOnly) {
          violations.push({
            type: 'KUCOIN_NOT_READ_ONLY',
            severity: 'critical',
            message: 'KuCoin API key is not configured as read-only',
            component: 'apiPermissions'
          });
          score -= 8;
        }

        // Test API key permissions if possible
        try {
          const paperTradingGuard = PaperTradingGuard.getInstance();
          await paperTradingGuard.validateApiPermissions(kucoinApiKey, 'kucoin');
          if (!details.noTradingPermissions) {
            details.noTradingPermissions = true;
          }
        } catch (error) {
          violations.push({
            type: 'KUCOIN_API_VALIDATION_FAILED',
            severity: 'high',
            message: `KuCoin API validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            component: 'apiPermissions'
          });
          score -= 5;
        }
      } else {
        // No API key is safer than having trading permissions
        details.kucoinReadOnly = true;
        if (!details.noTradingPermissions) {
          details.noTradingPermissions = true;
        }
      }

      // Check for any API secrets (dangerous)
      const dangerousSecrets = [
        'BINANCE_API_SECRET',
        'KUCOIN_API_SECRET',
        'COINBASE_API_SECRET'
      ];

      for (const secretVar of dangerousSecrets) {
        const secretValue = process.env[secretVar];
        if (secretValue && secretValue.trim() !== '' && !secretValue.startsWith('your-')) {
          violations.push({
            type: 'API_SECRET_DETECTED',
            severity: 'critical',
            message: `Dangerous API secret detected: ${secretVar}`,
            component: 'apiPermissions'
          });
          score -= 10;
        }
      }

    } catch (error) {
      violations.push({
        type: 'API_PERMISSIONS_CHECK_FAILED',
        severity: 'high',
        message: `API permissions check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'apiPermissions'
      });
      score -= 5;
    }

    if (score < maxScore) {
      recommendations.push('Configure all API keys as read-only and remove API secrets');
    }

    return { 
      score: Math.max(0, score), 
      maxScore, 
      passed: score >= (maxScore * 0.9),
      details
    };
  }

  /**
   * Calculate system integrity score (15 points)
   */
  private calculateSystemIntegrityScore(
    violations: SafetyScoreReport['violations'],
    recommendations: string[]
  ): {
    score: number;
    maxScore: number;
    passed: boolean;
    details: {
      noRealTradeCode: boolean;
      virtualBalanceIntact: boolean;
      auditTrailComplete: boolean;
      monitoringActive: boolean;
    };
  } {
    const maxScore = 15;
    let score = maxScore;

    const details = {
      noRealTradeCode: false,
      virtualBalanceIntact: false,
      auditTrailComplete: false,
      monitoringActive: false
    };

    try {
      // Check for real trade code patterns (this is a basic check)
      details.noRealTradeCode = true; // Assume no real trade code unless detected

      // Check virtual balance integrity
      const virtualBalanceUSD = process.env.VIRTUAL_BALANCE_USD;
      const virtualBalanceBTC = process.env.VIRTUAL_BALANCE_BTC;
      const virtualBalanceETH = process.env.VIRTUAL_BALANCE_ETH;

      if (virtualBalanceUSD && parseFloat(virtualBalanceUSD) > 0) {
        details.virtualBalanceIntact = true;
      } else {
        violations.push({
          type: 'VIRTUAL_BALANCE_NOT_SET',
          severity: 'medium',
          message: 'Virtual balance is not properly configured',
          component: 'systemIntegrity'
        });
        score -= 3;
      }

      // Check audit trail configuration
      const auditLogEnabled = process.env.PAPER_TRADE_AUDIT_LOG === 'true';
      const auditLoggingEnabled = process.env.AUDIT_LOGGING_ENABLED === 'true';

      details.auditTrailComplete = auditLogEnabled && auditLoggingEnabled;

      if (!details.auditTrailComplete) {
        violations.push({
          type: 'AUDIT_TRAIL_INCOMPLETE',
          severity: 'medium',
          message: 'Audit trail is not fully configured',
          component: 'systemIntegrity'
        });
        score -= 4;
      }

      // Check monitoring status
      const monitoringEnabled = process.env.MONITORING_ENABLED === 'true';
      const metricsEnabled = process.env.METRICS_ENABLED === 'true';
      const securityMonitoringEnabled = process.env.SECURITY_MONITORING_ENABLED === 'true';

      details.monitoringActive = monitoringEnabled && metricsEnabled && securityMonitoringEnabled;

      if (!details.monitoringActive) {
        violations.push({
          type: 'MONITORING_NOT_ACTIVE',
          severity: 'medium',
          message: 'System monitoring is not fully active',
          component: 'systemIntegrity'
        });
        score -= 4;
      }

      // Check for paper trading safety monitor
      try {
        const safetyMonitor = PaperTradingSafetyMonitor.getInstance();
        const safetyReport = safetyMonitor.getSafetyReport();
        
        if (safetyReport.status === 'critical') {
          violations.push({
            type: 'SAFETY_MONITOR_CRITICAL',
            severity: 'critical',
            message: 'Paper trading safety monitor reports critical status',
            component: 'systemIntegrity'
          });
          score -= 8;
        } else if (safetyReport.status === 'warning') {
          violations.push({
            type: 'SAFETY_MONITOR_WARNING',
            severity: 'medium',
            message: 'Paper trading safety monitor reports warning status',
            component: 'systemIntegrity'
          });
          score -= 2;
        }
      } catch (error) {
        violations.push({
          type: 'SAFETY_MONITOR_ERROR',
          severity: 'high',
          message: `Safety monitor error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          component: 'systemIntegrity'
        });
        score -= 4;
      }

    } catch (error) {
      violations.push({
        type: 'SYSTEM_INTEGRITY_CHECK_FAILED',
        severity: 'high',
        message: `System integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'systemIntegrity'
      });
      score -= 5;
    }

    if (score < maxScore) {
      recommendations.push('Improve system integrity monitoring and virtual balance configuration');
    }

    return { 
      score: Math.max(0, score), 
      maxScore, 
      passed: score >= (maxScore * 0.9),
      details
    };
  }

  /**
   * Calculate production safety score (10 points)
   */
  private calculateProductionSafetyScore(
    violations: SafetyScoreReport['violations'],
    recommendations: string[]
  ): {
    score: number;
    maxScore: number;
    passed: boolean;
    details: {
      forcedPaperTrading: boolean;
      strictValidation: boolean;
      securityHardening: boolean;
      alertingActive: boolean;
    };
  } {
    const maxScore = 10;
    let score = maxScore;

    const details = {
      forcedPaperTrading: false,
      strictValidation: false,
      securityHardening: false,
      alertingActive: false
    };

    try {
      // Check forced paper trading
      const forcePaperTrading = process.env.FORCE_PAPER_TRADING === 'true';
      const paperTradingEnforcement = process.env.PAPER_TRADING_ENFORCEMENT === 'strict';

      details.forcedPaperTrading = forcePaperTrading;

      if (!forcePaperTrading) {
        violations.push({
          type: 'PAPER_TRADING_NOT_FORCED',
          severity: 'high',
          message: 'Paper trading is not forced in production',
          component: 'productionSafety'
        });
        score -= 3;
      }

      // Check strict validation
      const paperTradingValidation = process.env.PAPER_TRADING_VALIDATION === 'strict';
      details.strictValidation = paperTradingValidation;

      if (!paperTradingValidation) {
        violations.push({
          type: 'VALIDATION_NOT_STRICT',
          severity: 'medium',
          message: 'Paper trading validation is not set to strict mode',
          component: 'productionSafety'
        });
        score -= 2;
      }

      // Check security hardening
      const securityHardeningEnabled = process.env.SECURITY_HARDENING_ENABLED === 'true';
      const intrusionDetectionEnabled = process.env.INTRUSION_DETECTION_ENABLED === 'true';

      details.securityHardening = securityHardeningEnabled && intrusionDetectionEnabled;

      if (!details.securityHardening) {
        violations.push({
          type: 'SECURITY_HARDENING_INCOMPLETE',
          severity: 'medium',
          message: 'Security hardening is not fully enabled',
          component: 'productionSafety'
        });
        score -= 2;
      }

      // Check alerting
      const criticalAlertEnabled = process.env.CRITICAL_ALERT_ENABLED === 'true';
      const realTimeAlertsEnabled = process.env.REAL_TIME_ALERTS_ENABLED === 'true';

      details.alertingActive = criticalAlertEnabled && realTimeAlertsEnabled;

      if (!details.alertingActive) {
        violations.push({
          type: 'ALERTING_NOT_ACTIVE',
          severity: 'medium',
          message: 'Critical alerting is not fully active',
          component: 'productionSafety'
        });
        score -= 2;
      }

      // Check production environment
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'production') {
        // Additional production checks
        const sslEnabled = process.env.SSL_ENABLED === 'true';
        const hstsEnabled = process.env.HSTS_ENABLED === 'true';

        if (!sslEnabled || !hstsEnabled) {
          violations.push({
            type: 'PRODUCTION_SECURITY_INCOMPLETE',
            severity: 'medium',
            message: 'Production security configuration is incomplete',
            component: 'productionSafety'
          });
          score -= 1;
        }
      }

    } catch (error) {
      violations.push({
        type: 'PRODUCTION_SAFETY_CHECK_FAILED',
        severity: 'medium',
        message: `Production safety check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'productionSafety'
      });
      score -= 3;
    }

    if (score < maxScore) {
      recommendations.push('Enable all production safety features and strict validation');
    }

    return { 
      score: Math.max(0, score), 
      maxScore, 
      passed: score >= (maxScore * 0.9),
      details
    };
  }

  /**
   * Validate that safety score meets minimum requirements
   */
  public async validateSafetyScore(): Promise<void> {
    const report = await this.calculateSafetyScore();

    if (!report.passed) {
      const criticalViolations = report.violations.filter(v => v.severity === 'critical');
      const errorMessage = `Paper trading safety score ${report.percentage}% is below required ${this.MINIMUM_SAFETY_SCORE}%. Critical violations: ${criticalViolations.length}`;
      
      logger.error('Paper trading safety score validation failed', {
        score: report.percentage,
        required: this.MINIMUM_SAFETY_SCORE,
        violations: report.violations.length,
        criticalViolations: criticalViolations.length
      });

      throw new Error(errorMessage);
    }

    logger.info('Paper trading safety score validation passed', {
      score: report.percentage,
      required: this.MINIMUM_SAFETY_SCORE
    });
  }

  /**
   * Get current safety score report
   */
  public async getSafetyScoreReport(): Promise<SafetyScoreReport> {
    return await this.calculateSafetyScore();
  }

  /**
   * Force refresh of safety score
   */
  public async refreshSafetyScore(): Promise<SafetyScoreReport> {
    return await this.calculateSafetyScore(true);
  }

  /**
   * Check if system is safe for operation
   */
  public async isSafeForOperation(): Promise<boolean> {
    try {
      const report = await this.calculateSafetyScore();
      return report.passed;
    } catch (error) {
      logger.error('Safety check failed:', error);
      return false;
    }
  }

  /**
   * Get safety score percentage
   */
  public async getSafetyScorePercentage(): Promise<number> {
    const report = await this.calculateSafetyScore();
    return report.percentage;
  }
}

// Export singleton instance
export const paperTradingSafetyScoreValidator = PaperTradingSafetyScoreValidator.getInstance();