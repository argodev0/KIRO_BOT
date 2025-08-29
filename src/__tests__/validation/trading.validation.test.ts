/**
 * Trading Validation Tests
 * Unit tests for trading-related validation schemas
 */

import {
  validateTradingSignal,
  validateOrderRequest,

  validatePosition,
  validatePortfolio,
  validateRiskParameters,
  validateRiskValidation,
  validateTradeExecution,
} from '../../validation/trading.validation';

describe('Trading Validation', () => {
  describe('validateTradingSignal', () => {
    const validSignal = {
      symbol: 'BTCUSDT',
      direction: 'long',
      confidence: 0.85,
      entryPrice: 47000,
      stopLoss: 46000,
      takeProfit: [48000, 49000, 50000],
      reasoning: {
        technical: {
          indicators: ['RSI', 'MACD'],
          confluence: 0.8,
          trend: 'bullish',
        },
        patterns: {
          detected: ['hammer', 'engulfing_bullish'],
          strength: 0.7,
        },
        elliottWave: {
          currentWave: 'wave_3',
          wavePosition: 'impulse',
          validity: 0.9,
        },
        fibonacci: {
          levels: [46800, 47200],
          confluence: 0.6,
        },
        volume: {
          profile: 'increasing',
          strength: 0.8,
        },
        summary: 'Strong bullish signal with multiple confirmations',
      },
      timestamp: 1640995200000,
      technicalScore: 0.8,
      patternScore: 0.7,
      elliottWaveScore: 0.9,
      fibonacciScore: 0.6,
      volumeScore: 0.8,
    };

    it('should validate correct trading signal', () => {
      const { error } = validateTradingSignal(validSignal);
      expect(error).toBeUndefined();
    });

    it('should reject invalid stop loss for long position', () => {
      const invalidSignal = {
        ...validSignal,
        stopLoss: 48000, // Stop loss above entry for long
      };
      const { error } = validateTradingSignal(invalidSignal);
      expect(error).toBeDefined();
      expect(error?.message).toContain('Stop loss must be below entry price for long positions');
    });

    it('should reject invalid stop loss for short position', () => {
      const invalidSignal = {
        ...validSignal,
        direction: 'short',
        stopLoss: 46000, // Stop loss below entry for short
      };
      const { error } = validateTradingSignal(invalidSignal);
      expect(error).toBeDefined();
      expect(error?.message).toContain('Stop loss must be above entry price for short positions');
    });

    it('should reject invalid take profit for long position', () => {
      const invalidSignal = {
        ...validSignal,
        takeProfit: [46000], // Take profit below entry for long
      };
      const { error } = validateTradingSignal(invalidSignal);
      expect(error).toBeDefined();
      expect(error?.message).toContain('Take profit must be above entry price for long positions');
    });

    it('should reject confidence out of range', () => {
      const invalidSignal = {
        ...validSignal,
        confidence: 1.5, // Confidence > 1
      };
      const { error } = validateTradingSignal(invalidSignal);
      expect(error).toBeDefined();
    });

    it('should require reasoning object', () => {
      const { reasoning, ...incompleteSignal } = validSignal;
      const { error } = validateTradingSignal(incompleteSignal);
      expect(error).toBeDefined();
      expect(error?.message).toContain('reasoning');
    });
  });

  describe('validateOrderRequest', () => {
    const validOrder = {
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'limit',
      quantity: 0.5,
      price: 47000,
      timeInForce: 'GTC',
      exchange: 'binance',
    };

    it('should validate correct order request', () => {
      const { error } = validateOrderRequest(validOrder);
      expect(error).toBeUndefined();
    });

    it('should require price for limit orders', () => {
      const { price, ...orderWithoutPrice } = validOrder;
      const { error } = validateOrderRequest(orderWithoutPrice);
      expect(error).toBeDefined();
      expect(error?.message).toContain('price');
    });

    it('should require stopPrice for stop orders', () => {
      const stopOrder = {
        ...validOrder,
        type: 'stop',
      };
      const { error } = validateOrderRequest(stopOrder);
      expect(error).toBeDefined();
      expect(error?.message).toContain('stopPrice');
    });

    it('should allow market orders without price', () => {
      const marketOrder = {
        ...validOrder,
        type: 'market',
      };
      delete (marketOrder as any).price;
      const { error } = validateOrderRequest(marketOrder);
      expect(error).toBeUndefined();
    });
  });

  describe('validatePosition', () => {
    const validPosition = {
      id: 'pos123',
      symbol: 'BTCUSDT',
      side: 'long',
      size: 0.5,
      entryPrice: 47000,
      currentPrice: 47500,
      unrealizedPnl: 250,
      timestamp: 1640995200000,
      exchange: 'binance',
    };

    it('should validate correct position', () => {
      const { error } = validatePosition(validPosition);
      expect(error).toBeUndefined();
    });

    it('should reject negative size', () => {
      const invalidPosition = {
        ...validPosition,
        size: -0.5,
      };
      const { error } = validatePosition(invalidPosition);
      expect(error).toBeDefined();
    });
  });

  describe('validatePortfolio', () => {
    const validPortfolio = {
      totalBalance: 10000,
      availableBalance: 8000,
      positions: [],
      totalUnrealizedPnl: 250,
      totalRealizedPnl: 500,
      maxDrawdown: 0.05,
      currentDrawdown: 0.02,
      equity: 10250,
    };

    it('should validate correct portfolio', () => {
      const { error } = validatePortfolio(validPortfolio);
      expect(error).toBeUndefined();
    });

    it('should reject available balance > total balance', () => {
      const invalidPortfolio = {
        ...validPortfolio,
        availableBalance: 12000, // Greater than total balance
      };
      const { error } = validatePortfolio(invalidPortfolio);
      expect(error).toBeDefined();
      expect(error?.message).toContain('Available balance cannot exceed total balance');
    });
  });

  describe('validateRiskParameters', () => {
    const validRiskParams = {
      maxRiskPerTrade: 0.03,
      maxDailyLoss: 0.05,
      maxTotalExposure: 5,
      maxDrawdown: 0.1,
      stopLossRequired: true,
      maxLeverage: 10,
    };

    it('should validate correct risk parameters', () => {
      const { error } = validateRiskParameters(validRiskParams);
      expect(error).toBeUndefined();
    });

    it('should reject invalid percentage values', () => {
      const invalidRiskParams = {
        ...validRiskParams,
        maxRiskPerTrade: 1.5, // > 100%
      };
      const { error } = validateRiskParameters(invalidRiskParams);
      expect(error).toBeDefined();
    });
  });

  describe('validateRiskValidation', () => {
    const validRiskValidation = {
      isValid: true,
      violations: [],
      maxAllowedSize: 0.5,
      riskPercentage: 0.02,
      currentExposure: 2.5,
    };

    it('should validate correct risk validation', () => {
      const { error } = validateRiskValidation(validRiskValidation);
      expect(error).toBeUndefined();
    });

    it('should validate risk validation with violations', () => {
      const riskValidationWithViolations = {
        ...validRiskValidation,
        isValid: false,
        violations: [
          {
            type: 'max_risk_per_trade',
            message: 'Risk per trade exceeded',
            currentValue: 0.05,
            maxAllowed: 0.03,
          },
        ],
      };
      const { error } = validateRiskValidation(riskValidationWithViolations);
      expect(error).toBeUndefined();
    });
  });

  describe('validateTradeExecution', () => {
    const validExecution = {
      id: 'exec123',
      symbol: 'BTCUSDT',
      side: 'buy',
      quantity: 0.5,
      price: 47000,
      fee: 23.5,
      exchange: 'binance',
      executedAt: 1640995200000,
    };

    it('should validate correct trade execution', () => {
      const { error } = validateTradeExecution(validExecution);
      expect(error).toBeUndefined();
    });

    it('should allow optional fields to be missing', () => {
      const { fee, ...minimalExecution } = validExecution;
      const { error } = validateTradeExecution(minimalExecution);
      expect(error).toBeUndefined();
    });
  });
});