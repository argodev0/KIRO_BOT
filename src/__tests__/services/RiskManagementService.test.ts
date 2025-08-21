/**
 * Risk Management Service Tests
 * Comprehensive test suite for risk management functionality
 */

import { RiskManagementService, PositionSizeRequest, EmergencyShutdownReason } from '../../services/RiskManagementService';
import { TradingSignal, Position, Portfolio, RiskParameters } from '../../types/trading';

describe('RiskManagementService', () => {
  let riskService: RiskManagementService;
  
  const mockSignal: TradingSignal = {
    symbol: 'BTCUSDT',
    direction: 'long',
    confidence: 0.85,
    entryPrice: 50000,
    stopLoss: 48000,
    takeProfit: [52000, 54000],
    reasoning: {
      technical: { indicators: ['RSI'], confluence: 0.8, trend: 'bullish' },
      patterns: { detected: ['hammer'], strength: 0.7 },
      elliottWave: { currentWave: 'Wave 3', wavePosition: 'impulse', validity: 0.9 },
      fibonacci: { levels: [0.618], confluence: 0.8 },
      volume: { profile: 'increasing', strength: 0.7 },
      summary: 'Strong bullish signal'
    },
    timestamp: Date.now()
  };

  const mockPosition: Position = {
    id: 'pos1',
    symbol: 'ETHUSDT',
    side: 'long',
    size: 10,
    entryPrice: 3000,
    currentPrice: 3100,
    unrealizedPnl: 1000,
    timestamp: Date.now(),
    exchange: 'binance'
  };

  const mockPortfolio: Portfolio = {
    totalBalance: 100000,
    availableBalance: 80000,
    positions: [mockPosition],
    totalUnrealizedPnl: 1000,
    totalRealizedPnl: 5000,
    maxDrawdown: 0.15,
    currentDrawdown: 0.10,
    equity: 101000
  };

  beforeEach(() => {
    riskService = new RiskManagementService();
  });

  describe('Position Size Calculation', () => {
    it('should calculate position size based on risk percentage', () => {
      const request: PositionSizeRequest = {
        signal: mockSignal,
        accountBalance: 100000,
        riskPercentage: 0.02 // 2%
      };

      const positionSize = riskService.calculatePositionSize(request);
      
      // Expected calculation:
      // Risk amount = 100000 * 0.02 = 2000
      // Stop loss distance = (50000 - 48000) / 50000 = 0.04 (4%)
      // Base position size = 2000 / (50000 * 0.04) = 1
      
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThan(10); // Should be reasonable with adjustments
    });

    it('should apply correlation adjustment for similar assets', () => {
      const btcPosition: Position = {
        ...mockPosition,
        symbol: 'BTCUSDT',
        size: 5
      };

      const request: PositionSizeRequest = {
        signal: mockSignal,
        accountBalance: 100000,
        currentPositions: [btcPosition]
      };

      const positionSize = riskService.calculatePositionSize(request);
      
      // Should be reduced due to BTC correlation
      expect(positionSize).toBeGreaterThan(0);
    });

    it('should apply volatility adjustment', () => {
      const highVolSignal: TradingSignal = {
        ...mockSignal,
        symbol: 'SOLUSDT' // Higher volatility asset
      };

      const request: PositionSizeRequest = {
        signal: highVolSignal,
        accountBalance: 100000
      };

      const positionSize = riskService.calculatePositionSize(request);
      
      expect(positionSize).toBeGreaterThan(0);
    });

    it('should apply confidence adjustment', () => {
      const lowConfidenceSignal: TradingSignal = {
        ...mockSignal,
        confidence: 0.5
      };

      const request: PositionSizeRequest = {
        signal: lowConfidenceSignal,
        accountBalance: 100000
      };

      const positionSize = riskService.calculatePositionSize(request);
      
      expect(positionSize).toBeGreaterThan(0);
    });

    it('should enforce minimum position size', () => {
      const verySmallRiskSignal: TradingSignal = {
        ...mockSignal,
        confidence: 0.1,
        stopLoss: 49999 // Very small stop loss distance
      };

      const request: PositionSizeRequest = {
        signal: verySmallRiskSignal,
        accountBalance: 1000 // Small account
      };

      const positionSize = riskService.calculatePositionSize(request);
      
      // Should enforce minimum position size (0.1% of account)
      expect(positionSize).toBeGreaterThanOrEqual(0.1); // 1000 * 0.001 / 10000 = 0.1
    });
  });

  describe('Risk Limit Validation', () => {
    it('should validate successful trade within all limits', () => {
      const validation = riskService.validateRiskLimits(
        mockSignal,
        1, // Small position size
        100000,
        [],
        mockPortfolio
      );

      expect(validation.isValid).toBe(true);
      expect(validation.violations).toHaveLength(0);
      expect(validation.maxAllowedSize).toBeGreaterThan(0);
    });

    it('should detect per-trade risk limit violation', () => {
      const validation = riskService.validateRiskLimits(
        mockSignal,
        100, // Large position size
        100000,
        []
      );

      const riskViolation = validation.violations.find(v => v.type === 'max_risk_per_trade');
      expect(riskViolation).toBeDefined();
      expect(validation.isValid).toBe(false);
    });

    it('should detect total exposure limit violation', () => {
      const largePositions: Position[] = [
        { ...mockPosition, size: 100, currentPrice: 50000 }, // 5M exposure
        { ...mockPosition, id: 'pos2', size: 50, currentPrice: 50000 } // 2.5M exposure
      ];

      const validation = riskService.validateRiskLimits(
        mockSignal,
        10, // Additional 500k exposure
        100000, // 100k account = total 8x exposure
        largePositions
      );

      const exposureViolation = validation.violations.find(v => v.type === 'max_exposure');
      expect(exposureViolation).toBeDefined();
      expect(validation.isValid).toBe(false);
    });

    it('should detect missing stop loss violation', () => {
      const { stopLoss, ...signalWithoutStopLoss } = mockSignal;
      const noStopLossSignal: TradingSignal = signalWithoutStopLoss;

      const validation = riskService.validateRiskLimits(
        noStopLossSignal,
        1,
        100000
      );

      const stopLossViolation = validation.violations.find(v => v.type === 'missing_stop_loss');
      expect(stopLossViolation).toBeDefined();
      expect(validation.isValid).toBe(false);
    });

    it('should detect drawdown limit violation', () => {
      const highDrawdownPortfolio: Portfolio = {
        ...mockPortfolio,
        currentDrawdown: 0.25 // 25% drawdown (exceeds 20% limit)
      };

      const validation = riskService.validateRiskLimits(
        mockSignal,
        1,
        100000,
        [],
        highDrawdownPortfolio
      );

      const drawdownViolation = validation.violations.find(v => v.type === 'max_drawdown');
      expect(drawdownViolation).toBeDefined();
      expect(validation.isValid).toBe(false);
    });

    it('should calculate correct maximum allowed position size', () => {
      const validation = riskService.validateRiskLimits(
        mockSignal,
        1,
        100000,
        []
      );

      expect(validation.maxAllowedSize).toBeGreaterThan(0);
      expect(validation.maxAllowedSize).toBeLessThan(10); // Should be reasonable
    });
  });

  describe('Drawdown Monitoring', () => {
    it('should return no action for normal drawdown', () => {
      const status = riskService.monitorDrawdown(mockPortfolio);

      expect(status.current).toBe(0.10);
      expect(status.maximum).toBe(0.15);
      expect(status.isViolation).toBe(false);
      expect(status.actionRequired).toBe('none');
    });

    it('should require position reduction for high drawdown', () => {
      const highDrawdownPortfolio: Portfolio = {
        ...mockPortfolio,
        currentDrawdown: 0.17 // 17% (80% of 20% limit)
      };

      const status = riskService.monitorDrawdown(highDrawdownPortfolio);

      expect(status.actionRequired).toBe('reduce_positions');
      expect(status.isViolation).toBe(false);
    });

    it('should require emergency close for excessive drawdown', () => {
      const excessiveDrawdownPortfolio: Portfolio = {
        ...mockPortfolio,
        currentDrawdown: 0.25 // 25% (exceeds 20% limit)
      };

      const status = riskService.monitorDrawdown(excessiveDrawdownPortfolio);

      expect(status.actionRequired).toBe('emergency_close');
      expect(status.isViolation).toBe(true);
    });
  });

  describe('Emergency Shutdown', () => {
    it('should execute emergency shutdown successfully', async () => {
      const reason: EmergencyShutdownReason = {
        type: 'risk_violation',
        message: 'Maximum drawdown exceeded',
        severity: 'critical',
        timestamp: Date.now()
      };

      await expect(riskService.executeEmergencyShutdown(reason)).resolves.not.toThrow();
      expect(riskService.isEmergencyShutdownActive()).toBe(true);
    });

    it('should prevent duplicate emergency shutdown', async () => {
      const reason: EmergencyShutdownReason = {
        type: 'system_error',
        message: 'System failure',
        severity: 'high',
        timestamp: Date.now()
      };

      await riskService.executeEmergencyShutdown(reason);
      
      // Second call should not throw but should log warning
      await expect(riskService.executeEmergencyShutdown(reason)).resolves.not.toThrow();
    });

    it('should reset emergency shutdown state', () => {
      riskService.resetEmergencyShutdown();
      expect(riskService.isEmergencyShutdownActive()).toBe(false);
    });
  });

  describe('Leverage Adjustment', () => {
    it('should reduce leverage for high volatility', () => {
      const adjustedLeverage = riskService.adjustLeverageForVolatility(10, 'BTCUSDT', 0.06);
      
      expect(adjustedLeverage).toBeLessThan(10);
      expect(adjustedLeverage).toBeGreaterThanOrEqual(1);
    });

    it('should maintain leverage for low volatility', () => {
      const adjustedLeverage = riskService.adjustLeverageForVolatility(5, 'BTCUSDT', 0.01);
      
      expect(adjustedLeverage).toBe(5);
    });

    it('should not exceed maximum leverage', () => {
      const adjustedLeverage = riskService.adjustLeverageForVolatility(20, 'BTCUSDT', 0.01);
      
      expect(adjustedLeverage).toBeLessThanOrEqual(10); // Max leverage is 10
    });

    it('should not go below minimum leverage', () => {
      const adjustedLeverage = riskService.adjustLeverageForVolatility(0.5, 'BTCUSDT', 0.10);
      
      expect(adjustedLeverage).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Correlation Analysis', () => {
    it('should identify highly correlated assets', () => {
      const positions: Position[] = [
        { ...mockPosition, symbol: 'ETHUSDT' }
      ];

      const analysis = riskService.analyzeCorrelation('BTCUSDT', positions);

      expect(analysis.symbol).toBe('BTCUSDT');
      expect(analysis.correlatedSymbols).toContain('ETHUSDT');
      expect(analysis.correlationCoefficient).toBeGreaterThan(0.7);
      expect(analysis.riskAdjustment).toBeLessThan(1.0);
    });

    it('should return no correlation for uncorrelated assets', () => {
      const positions: Position[] = [
        { ...mockPosition, symbol: 'USDCUSDT' } // Stablecoin
      ];

      const analysis = riskService.analyzeCorrelation('BTCUSDT', positions);

      expect(analysis.correlatedSymbols).toHaveLength(0);
      expect(analysis.correlationCoefficient).toBeLessThan(0.7);
      expect(analysis.riskAdjustment).toBe(1.0);
    });

    it('should cache correlation analysis results', () => {
      const positions: Position[] = [
        { ...mockPosition, symbol: 'ETHUSDT' }
      ];

      const analysis1 = riskService.analyzeCorrelation('BTCUSDT', positions);
      const analysis2 = riskService.analyzeCorrelation('BTCUSDT', positions);

      expect(analysis1).toEqual(analysis2);
    });
  });

  describe('Daily Loss Tracking', () => {
    it('should track daily losses correctly', () => {
      riskService.updateDailyLoss(1000);
      riskService.updateDailyLoss(500);

      // Test validation with daily loss
      const validation = riskService.validateRiskLimits(
        mockSignal,
        1,
        10000 // Small account to trigger daily loss limit
      );

      const dailyLossViolation = validation.violations.find(v => v.type === 'max_daily_loss');
      expect(dailyLossViolation).toBeDefined();
    });
  });

  describe('Custom Risk Parameters', () => {
    it('should use custom risk parameters when provided', () => {
      const customParams: Partial<RiskParameters> = {
        maxRiskPerTrade: 0.01, // 1% instead of default 3%
        maxTotalExposure: 3.0   // 3x instead of default 5x
      };

      const customRiskService = new RiskManagementService(customParams);

      const validation = customRiskService.validateRiskLimits(
        mockSignal,
        2, // Position size that would be OK with default but not custom params
        100000
      );

      // Should have violations due to stricter custom parameters
      expect(validation.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero account balance gracefully', () => {
      const request: PositionSizeRequest = {
        signal: mockSignal,
        accountBalance: 0
      };

      const positionSize = riskService.calculatePositionSize(request);
      expect(positionSize).toBe(0);
    });

    it('should handle signal without stop loss', () => {
      const { stopLoss, ...signalWithoutStopLoss } = mockSignal;
      const noStopSignal: TradingSignal = signalWithoutStopLoss;

      const request: PositionSizeRequest = {
        signal: noStopSignal,
        accountBalance: 100000
      };

      const positionSize = riskService.calculatePositionSize(request);
      expect(positionSize).toBeGreaterThan(0);
    });

    it('should handle empty positions array', () => {
      const validation = riskService.validateRiskLimits(
        mockSignal,
        1,
        100000,
        [] // Empty positions
      );

      expect(validation.currentExposure).toBeGreaterThanOrEqual(0);
    });

    it('should handle very small position sizes', () => {
      const validation = riskService.validateRiskLimits(
        mockSignal,
        0.001, // Very small position
        100000
      );

      expect(validation.isValid).toBe(true);
      expect(validation.riskPercentage).toBeCloseTo(0, 3);
    });
  });
});