import { BotConfig, ConfigValidation, ConfigError, ConfigWarning } from '@/types/config';
import { api } from './api';

export class ConfigValidationService {
  private static validationCache = new Map<string, ConfigValidation>();
  private static validationTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Validate configuration with debouncing and caching
   */
  static async validateConfig(
    config: BotConfig,
    debounceMs: number = 500
  ): Promise<ConfigValidation> {
    const configHash = this.hashConfig(config);
    
    // Check cache first
    if (this.validationCache.has(configHash)) {
      return this.validationCache.get(configHash)!;
    }

    // Clear existing timeout for this config
    const existingTimeout = this.validationTimeouts.get(configHash);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        try {
          const validation = await this.performValidation(config);
          this.validationCache.set(configHash, validation);
          
          // Clean up timeout
          this.validationTimeouts.delete(configHash);
          
          resolve(validation);
        } catch (error) {
          console.error('Validation error:', error);
          resolve({
            isValid: false,
            errors: [{ field: 'general', message: 'Validation service error', code: 'SERVICE_ERROR' }],
            warnings: []
          });
        }
      }, debounceMs);

      this.validationTimeouts.set(configHash, timeout);
    });
  }

  /**
   * Perform real-time validation
   */
  private static async performValidation(config: BotConfig): Promise<ConfigValidation> {
    try {
      const response = await api.post('/config/validate', config);
      const serverValidation = response.data.data;

      // Add client-side paper trading specific validations
      const paperTradingValidation = this.validatePaperTradingConfig(config);
      
      return {
        isValid: serverValidation.isValid && paperTradingValidation.isValid,
        errors: [...serverValidation.errors, ...paperTradingValidation.errors],
        warnings: [...serverValidation.warnings, ...paperTradingValidation.warnings]
      };
    } catch (error) {
      console.error('Server validation failed:', error);
      
      // Fallback to client-side validation only
      return this.validatePaperTradingConfig(config);
    }
  }

  /**
   * Client-side paper trading specific validation
   */
  private static validatePaperTradingConfig(config: BotConfig): ConfigValidation {
    const errors: ConfigError[] = [];
    const warnings: ConfigWarning[] = [];

    // Basic validation
    if (!config.name || config.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Configuration name is required',
        code: 'REQUIRED'
      });
    }

    if (config.name && config.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Configuration name must be less than 100 characters',
        code: 'MAX_LENGTH'
      });
    }

    // Strategy validation
    if (!config.strategy) {
      errors.push({
        field: 'strategy',
        message: 'Strategy configuration is required',
        code: 'REQUIRED'
      });
    } else {
      if (!config.strategy.symbols || config.strategy.symbols.length === 0) {
        errors.push({
          field: 'strategy.symbols',
          message: 'At least one trading symbol must be specified',
          code: 'REQUIRED'
        });
      }

      if (!config.strategy.timeframes || config.strategy.timeframes.length === 0) {
        errors.push({
          field: 'strategy.timeframes',
          message: 'At least one timeframe must be specified',
          code: 'REQUIRED'
        });
      }

      if (config.strategy.maxConcurrentTrades > 20) {
        warnings.push({
          field: 'strategy.maxConcurrentTrades',
          message: 'High number of concurrent trades may impact performance',
          suggestion: 'Consider reducing to 10 or fewer for paper trading'
        });
      }

      if (config.strategy.maxConcurrentTrades < 1) {
        errors.push({
          field: 'strategy.maxConcurrentTrades',
          message: 'Must allow at least 1 concurrent trade',
          code: 'MIN_VALUE'
        });
      }
    }

    // Risk management validation
    if (!config.riskManagement) {
      errors.push({
        field: 'riskManagement',
        message: 'Risk management configuration is required',
        code: 'REQUIRED'
      });
    } else {
      if (config.riskManagement.maxRiskPerTrade > 10) {
        warnings.push({
          field: 'riskManagement.maxRiskPerTrade',
          message: 'High risk per trade for paper trading learning',
          suggestion: 'Consider 1-3% for safer paper trading practice'
        });
      }

      if (config.riskManagement.maxRiskPerTrade > 20) {
        errors.push({
          field: 'riskManagement.maxRiskPerTrade',
          message: 'Risk per trade cannot exceed 20%',
          code: 'MAX_VALUE'
        });
      }

      if (config.riskManagement.maxDailyLoss > 25) {
        errors.push({
          field: 'riskManagement.maxDailyLoss',
          message: 'Daily loss limit cannot exceed 25%',
          code: 'MAX_VALUE'
        });
      }

      if (config.riskManagement.maxDailyLoss > 15) {
        warnings.push({
          field: 'riskManagement.maxDailyLoss',
          message: 'High daily loss limit for paper trading',
          suggestion: 'Consider 5-10% for better risk management practice'
        });
      }
    }

    // Exchange validation
    if (!config.exchanges || config.exchanges.length === 0) {
      errors.push({
        field: 'exchanges',
        message: 'At least one exchange must be configured',
        code: 'REQUIRED'
      });
    } else {
      config.exchanges.forEach((exchange, index) => {
        if (!exchange.name) {
          errors.push({
            field: `exchanges[${index}].name`,
            message: 'Exchange name is required',
            code: 'REQUIRED'
          });
        }

        // Paper trading specific checks
        if (!exchange.testnet) {
          warnings.push({
            field: `exchanges[${index}].testnet`,
            message: 'Production exchange detected',
            suggestion: 'Ensure API keys are read-only for paper trading safety'
          });
        }

        if (exchange.apiKey && !exchange.testnet) {
          warnings.push({
            field: `exchanges[${index}].apiKey`,
            message: 'Production API key detected',
            suggestion: 'Verify this is a read-only key for paper trading'
          });
        }
      });
    }

    // Paper trading specific warnings
    if (config.strategy?.symbols && config.strategy.symbols.length > 10) {
      warnings.push({
        field: 'strategy.symbols',
        message: 'Many symbols selected for paper trading',
        suggestion: 'Start with 2-5 symbols to better analyze performance'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate specific field
   */
  static validateField(config: BotConfig, fieldPath: string): ConfigValidation {
    const fullValidation = this.validatePaperTradingConfig(config);
    
    const fieldErrors = fullValidation.errors.filter(error => 
      error.field === fieldPath || error.field.startsWith(fieldPath + '.')
    );
    
    const fieldWarnings = fullValidation.warnings.filter(warning => 
      warning.field === fieldPath || warning.field.startsWith(fieldPath + '.')
    );

    return {
      isValid: fieldErrors.length === 0,
      errors: fieldErrors,
      warnings: fieldWarnings
    };
  }

  /**
   * Get paper trading safety score
   */
  static getPaperTradingSafetyScore(config: BotConfig): number {
    let score = 100;
    const validation = this.validatePaperTradingConfig(config);

    // Deduct points for errors
    score -= validation.errors.length * 20;

    // Deduct points for warnings
    score -= validation.warnings.length * 5;

    // Additional safety checks
    if (config.riskManagement) {
      if (config.riskManagement.maxRiskPerTrade > 5) score -= 10;
      if (config.riskManagement.maxDailyLoss > 10) score -= 10;
      if (!config.riskManagement.emergencyStop?.enabled) score -= 15;
    }

    // Check for testnet usage
    if (config.exchanges?.some(ex => !ex.testnet)) score -= 20;

    // Ensure minimum score
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get validation summary
   */
  static getValidationSummary(validation: ConfigValidation): string {
    if (validation.isValid) {
      return 'Configuration is valid and ready for paper trading';
    }

    const errorCount = validation.errors.length;
    const warningCount = validation.warnings.length;

    if (errorCount > 0 && warningCount > 0) {
      return `${errorCount} error(s) and ${warningCount} warning(s) found`;
    } else if (errorCount > 0) {
      return `${errorCount} error(s) found`;
    } else {
      return `${warningCount} warning(s) found`;
    }
  }

  /**
   * Clear validation cache
   */
  static clearCache(): void {
    this.validationCache.clear();
    
    // Clear any pending timeouts
    this.validationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.validationTimeouts.clear();
  }

  /**
   * Generate hash for configuration caching
   */
  private static hashConfig(config: BotConfig): string {
    // Simple hash based on stringified config
    const configStr = JSON.stringify(config, Object.keys(config).sort());
    let hash = 0;
    
    for (let i = 0; i < configStr.length; i++) {
      const char = configStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }
}

export default ConfigValidationService;