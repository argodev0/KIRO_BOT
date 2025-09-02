import { PerpetualFuturesManager, PerpetualFuturesConfig, PerpetualPosition, FundingRateData, LeverageOptimization, PositionCorrelation } from '../../services/PerpetualFuturesManager';
import { TechnicalAnalysisService } from '../../services/TechnicalAnalysisService';
import { RiskManagementService } from '../../services/RiskManagementService';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';

// Mock dependencies
jest.mock('../../services/TechnicalAnalysisService');
jest.mock('../../services/RiskManagementService');
jest.mock('../../services/HummingbotBridgeService');

describe('PerpetualFuturesManager', () => {
  let perpetualManager: PerpetualFuturesManager;
  let mockTechnicalAnalysis: jest.Mocked<TechnicalAnalysisService>;
  let mockRiskManagement: jest.Mocked<RiskManagementService>;
  let mockHummingbotBridge: jest.Mocked<HummingbotBridgeService>;
  let mockConfig: PerpetualFuturesConfig;

  beforeEach(() => {
    mockTechnicalAnalysis = new TechnicalAnalysisService({}) as jest.Mocked<TechnicalAnalysisService>;
    mockRiskManagement = new RiskManagementService({}) as jest.Mocked<RiskManagementService>;
    mockHummingbotBridge = new HummingbotBridgeService({}) as jest.Mocked<HummingbotBridgeService>;

    mockConfig = {
      symbol: 'BTCUSDT',
      leverage: 10,
      maxLeverage: 20,
      minLeverage: 1,
      positionMode: 'hedge',
      marginType: 'isolated',
      fundingRateThreshold: 0.005,
      leverageOptimization: {
        enabled: true,
        targetVolatility: 0.03,
        riskAdjustment: 0.8,
        rebalanceFrequency: 60
      },
      riskLimits: {
        maxPositionSize: 1.0,
        maxNotionalValue: 50000,
        maxDailyLoss: 1000,
        liquidationBuffer: 0.1
      }
    };

    perpetualManager = new PerpetualFuturesManager(
      mockConfig,
      mockTechnicalAnalysis,
      mockRiskManagement,
      mockHummingbotBridge
    );

    // Setup default mocks
    mockHummingbotBridge.getInstances.mockResolvedValue([
      {
        id: 'test-instance-1',
        name: 'Test Instance',
        status: 'running',
        containerId: 'container-123',
        config: {},
        strategies: [],
        resources: {
          cpuUsage: 50,
          memoryUsage: 1024,
          memoryLimit: 2048,
          networkIn: 100,
          networkOut: 100,
          diskUsage: 50,
          diskLimit: 100
        },
        performance: {
          uptime: 3600,
          totalStrategies: 1,
          activeStrategies: 1,
          totalTrades: 10,
          totalVolume: 1000,
          totalPnL: 100,
          averageLatency: 100,
          errorRate: 0
        },
        createdAt: Date.now(),
        lastHealthCheck: Date.now(),
        updatedAt: Date.now()
      }
    ]);

    mockHummingbotBridge.setLeverage.mockResolvedValue();
    mockHummingbotBridge.setPositionMode.mockResolvedValue();
    mockHummingbotBridge.setMarginType.mockResolvedValue();
    mockHummingbotBridge.getPositions.mockResolvedValue([]);
    mockHummingbotBridge.getFundingRate.mockResolvedValue({
      fundingRate: 0.0001,
      nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
      predictedRate: 0.0001,
      historicalRates: [0.0001, 0.0002, 0.0001, -0.0001, 0.0003]
    });
    mockHummingbotBridge.placeOrder.mockResolvedValue('order-123');

    mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
      slope: 0.5,
      intercept: 49000,
      rSquared: 0.85,
      predictedValue: 50000,
      trendStrength: 0.7,
      volatility: 0.02
    });

    mockTechnicalAnalysis.getPriceHistory.mockResolvedValue([
      48000, 48500, 49000, 49500, 50000, 50500, 51000, 50800, 50600, 50400
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', async () => {
      await perpetualManager.initialize();

      expect(mockHummingbotBridge.setLeverage).toHaveBeenCalledWith('test-instance-1', 'BTCUSDT', 10);
      expect(mockHummingbotBridge.setPositionMode).toHaveBeenCalledWith('test-instance-1', 'hedge');
      expect(mockHummingbotBridge.setMarginType).toHaveBeenCalledWith('test-instance-1', 'BTCUSDT', 'isolated');
    });

    it('should validate configuration on initialization', async () => {
      const invalidConfig = { ...mockConfig, leverage: 25, maxLeverage: 20 };
      const invalidManager = new PerpetualFuturesManager(
        invalidConfig,
        mockTechnicalAnalysis,
        mockRiskManagement,
        mockHummingbotBridge
      );

      await expect(invalidManager.initialize()).rejects.toThrow('Leverage must be between 1 and 20');
    });

    it('should reject invalid liquidation buffer', async () => {
      const invalidConfig = { 
        ...mockConfig, 
        riskLimits: { ...mockConfig.riskLimits, liquidationBuffer: 0.6 }
      };
      const invalidManager = new PerpetualFuturesManager(
        invalidConfig,
        mockTechnicalAnalysis,
        mockRiskManagement,
        mockHummingbotBridge
      );

      await expect(invalidManager.initialize()).rejects.toThrow('Liquidation buffer must be between 5% and 50%');
    });

    it('should reject invalid funding rate threshold', async () => {
      const invalidConfig = { ...mockConfig, fundingRateThreshold: 0.02 };
      const invalidManager = new PerpetualFuturesManager(
        invalidConfig,
        mockTechnicalAnalysis,
        mockRiskManagement,
        mockHummingbotBridge
      );

      await expect(invalidManager.initialize()).rejects.toThrow('Funding rate threshold must be between 0.1% and 1%');
    });
  });

  describe('position monitoring', () => {
    beforeEach(async () => {
      await perpetualManager.initialize();
    });

    it('should update positions from Hummingbot instances', async () => {
      const mockPositions = [
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.5,
          entryPrice: 50000,
          markPrice: 51000,
          liquidationPrice: 45000,
          unrealizedPnl: 500,
          realizedPnl: 0,
          leverage: 10,
          margin: 2500,
          marginRatio: 0.25,
          createdAt: new Date()
        }
      ];

      mockHummingbotBridge.getPositions.mockResolvedValue(mockPositions);

      const positionsUpdatedSpy = jest.fn();
      perpetualManager.on('positionsUpdated', positionsUpdatedSpy);

      // Wait for position update
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(positionsUpdatedSpy).toHaveBeenCalledWith({
        positions: expect.arrayContaining([
          expect.objectContaining({
            symbol: 'BTCUSDT',
            side: 'long',
            size: 0.5,
            unrealizedPnl: 500
          })
        ])
      });

      const positions = perpetualManager.getPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('BTCUSDT');
    });

    it('should detect risk limit violations', async () => {
      const mockPositions = [
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 1.5, // Exceeds maxPositionSize
          entryPrice: 50000,
          markPrice: 51000,
          liquidationPrice: 45000,
          unrealizedPnl: 1500,
          realizedPnl: 0,
          leverage: 10,
          margin: 7500,
          marginRatio: 0.25,
          createdAt: new Date()
        }
      ];

      mockHummingbotBridge.getPositions.mockResolvedValue(mockPositions);

      const riskViolationSpy = jest.fn();
      perpetualManager.on('riskViolation', riskViolationSpy);

      // Wait for risk check
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(riskViolationSpy).toHaveBeenCalledWith({
        type: 'position_size_exceeded',
        position: expect.objectContaining({ size: 1.5 }),
        limit: 1.0
      });
    });

    it('should detect liquidation risk', async () => {
      const mockPositions = [
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.5,
          entryPrice: 50000,
          markPrice: 46000, // Close to liquidation price
          liquidationPrice: 45000,
          unrealizedPnl: -2000,
          realizedPnl: 0,
          leverage: 10,
          margin: 2500,
          marginRatio: 0.08, // Low margin ratio
          createdAt: new Date()
        }
      ];

      mockHummingbotBridge.getPositions.mockResolvedValue(mockPositions);

      const liquidationRiskSpy = jest.fn();
      perpetualManager.on('liquidationRisk', liquidationRiskSpy);

      // Wait for liquidation risk check
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(liquidationRiskSpy).toHaveBeenCalledWith({
        position: expect.objectContaining({ markPrice: 46000 }),
        distance: expect.any(Number),
        buffer: 0.1
      });
    });
  });

  describe('funding rate management', () => {
    beforeEach(async () => {
      await perpetualManager.initialize();
    });

    it('should update funding rates', async () => {
      const fundingRateUpdatedSpy = jest.fn();
      perpetualManager.on('fundingRateUpdated', fundingRateUpdatedSpy);

      // Wait for funding rate update
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(fundingRateUpdatedSpy).toHaveBeenCalledWith({
        fundingData: expect.objectContaining({
          symbol: 'BTCUSDT',
          fundingRate: 0.0001,
          trend: expect.any(String)
        })
      });

      const fundingRates = perpetualManager.getFundingRates();
      expect(fundingRates).toHaveLength(1);
      expect(fundingRates[0].symbol).toBe('BTCUSDT');
    });

    it('should optimize positions based on high funding rates', async () => {
      // Mock high funding rate
      mockHummingbotBridge.getFundingRate.mockResolvedValue({
        fundingRate: 0.008, // High funding rate
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
        predictedRate: 0.008,
        historicalRates: [0.005, 0.006, 0.007, 0.008, 0.008]
      });

      // Mock a long position that would pay high funding
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.5,
          entryPrice: 50000,
          markPrice: 50000,
          liquidationPrice: 45000,
          unrealizedPnl: 0,
          realizedPnl: 0,
          leverage: 10,
          margin: 2500,
          marginRatio: 0.2,
          createdAt: new Date()
        }
      ]);

      const fundingOptimizationSpy = jest.fn();
      perpetualManager.on('fundingOptimization', fundingOptimizationSpy);

      // Wait for funding optimization
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(fundingOptimizationSpy).toHaveBeenCalledWith({
        action: 'position_reduced',
        position: expect.objectContaining({ side: 'long' }),
        fundingRate: 0.008,
        reductionRatio: expect.any(Number)
      });
    });

    it('should alert on upcoming funding rate changes', async () => {
      // Mock funding rate with near-term funding
      mockHummingbotBridge.getFundingRate.mockResolvedValue({
        fundingRate: 0.001,
        nextFundingTime: Date.now() + 20 * 60 * 1000, // 20 minutes
        predictedRate: 0.008, // High predicted rate
        historicalRates: [0.001, 0.002, 0.003, 0.005, 0.008]
      });

      const fundingRateAlertSpy = jest.fn();
      perpetualManager.on('fundingRateAlert', fundingRateAlertSpy);

      // Wait for funding rate alert
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(fundingRateAlertSpy).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        currentRate: 0.001,
        predictedRate: 0.008,
        timeToFunding: expect.any(Number)
      });
    });
  });

  describe('leverage optimization', () => {
    beforeEach(async () => {
      await perpetualManager.initialize();
    });

    it('should optimize leverage based on volatility', async () => {
      // Mock high volatility
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 50000,
        trendStrength: 0.7,
        volatility: 0.06 // High volatility
      });

      // Mock a position
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.5,
          entryPrice: 50000,
          markPrice: 50000,
          liquidationPrice: 45000,
          unrealizedPnl: 0,
          realizedPnl: 0,
          leverage: 10,
          margin: 2500,
          marginRatio: 0.2,
          createdAt: new Date()
        }
      ]);

      const leverageOptimizedSpy = jest.fn();
      perpetualManager.on('leverageOptimized', leverageOptimizedSpy);

      // Wait for leverage optimization
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(leverageOptimizedSpy).toHaveBeenCalledWith({
        position: expect.objectContaining({ leverage: 10 }),
        optimization: expect.objectContaining({
          currentLeverage: 10,
          optimalLeverage: expect.any(Number),
          recommendation: expect.stringMatching(/increase|decrease|maintain/),
          reasoning: expect.any(String)
        })
      });
    });

    it('should calculate risk score correctly', async () => {
      // Mock position with various risk factors
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.8,
          entryPrice: 50000,
          markPrice: 46000, // Underwater position
          liquidationPrice: 45000, // Close to liquidation
          unrealizedPnl: -3200,
          realizedPnl: 0,
          leverage: 18, // High leverage
          margin: 2000,
          marginRatio: 0.12, // Low margin ratio
          createdAt: new Date()
        }
      ]);

      // Mock high volatility
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 50000,
        trendStrength: 0.7,
        volatility: 0.08 // High volatility
      });

      const leverageOptimizedSpy = jest.fn();
      perpetualManager.on('leverageOptimized', leverageOptimizedSpy);

      // Wait for optimization
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(leverageOptimizedSpy).toHaveBeenCalledWith({
        position: expect.any(Object),
        optimization: expect.objectContaining({
          riskScore: expect.any(Number),
          recommendation: 'decrease' // Should recommend decreasing leverage
        })
      });
    });

    it('should adjust leverage when significant change is needed', async () => {
      // Mock low volatility scenario
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 50000,
        trendStrength: 0.7,
        volatility: 0.01 // Low volatility
      });

      // Mock a conservative position
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.2,
          entryPrice: 50000,
          markPrice: 50500,
          liquidationPrice: 40000,
          unrealizedPnl: 100,
          realizedPnl: 0,
          leverage: 5, // Low leverage
          margin: 2000,
          marginRatio: 0.4,
          createdAt: new Date()
        }
      ]);

      const leverageAdjustedSpy = jest.fn();
      perpetualManager.on('leverageAdjusted', leverageAdjustedSpy);

      // Wait for leverage adjustment
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should increase leverage due to low volatility
      expect(mockHummingbotBridge.setLeverage).toHaveBeenCalledWith(
        'test-instance-1',
        'BTCUSDT',
        expect.any(Number)
      );
    });
  });

  describe('position correlation analysis', () => {
    beforeEach(async () => {
      await perpetualManager.initialize();
    });

    it('should calculate correlations between positions', async () => {
      // Mock positions for different symbols
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.5,
          entryPrice: 50000,
          markPrice: 50000,
          liquidationPrice: 45000,
          unrealizedPnl: 0,
          realizedPnl: 0,
          leverage: 10,
          margin: 2500,
          marginRatio: 0.2,
          createdAt: new Date()
        },
        {
          symbol: 'ETHUSDT',
          side: 'short',
          size: 2.0,
          entryPrice: 3000,
          markPrice: 3000,
          liquidationPrice: 3300,
          unrealizedPnl: 0,
          realizedPnl: 0,
          leverage: 5,
          margin: 1200,
          marginRatio: 0.3,
          createdAt: new Date()
        }
      ]);

      // Mock price history for correlation calculation
      mockTechnicalAnalysis.getPriceHistory
        .mockResolvedValueOnce([48000, 48500, 49000, 49500, 50000]) // BTCUSDT
        .mockResolvedValueOnce([2800, 2850, 2900, 2950, 3000]); // ETHUSDT

      const correlationsUpdatedSpy = jest.fn();
      perpetualManager.on('correlationsUpdated', correlationsUpdatedSpy);

      // Wait for correlation calculation
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(correlationsUpdatedSpy).toHaveBeenCalledWith({
        correlations: expect.arrayContaining([
          expect.objectContaining({
            symbol1: expect.any(String),
            symbol2: expect.any(String),
            correlation: expect.any(Number),
            hedgeRatio: expect.any(Number),
            effectiveness: expect.any(Number)
          })
        ])
      });

      const correlations = perpetualManager.getCorrelations();
      expect(correlations.length).toBeGreaterThan(0);
    });

    it('should handle insufficient data for correlation calculation', async () => {
      // Mock insufficient price history
      mockTechnicalAnalysis.getPriceHistory.mockResolvedValue([50000, 50100]); // Too few data points

      const correlationsUpdatedSpy = jest.fn();
      perpetualManager.on('correlationsUpdated', correlationsUpdatedSpy);

      // Wait for correlation attempt
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not crash and should handle gracefully
      const correlations = perpetualManager.getCorrelations();
      expect(correlations).toEqual([]);
    });
  });

  describe('hedged position creation', () => {
    beforeEach(async () => {
      await perpetualManager.initialize();
    });

    it('should create hedged position with correlated asset', async () => {
      // Mock correlation data
      const mockCorrelation: PositionCorrelation = {
        symbol1: 'BTCUSDT',
        symbol2: 'ETHUSDT',
        correlation: 0.8,
        hedgeRatio: 0.6,
        effectiveness: 0.75,
        confidence: 0.8,
        timeframe: '1h'
      };

      // Manually set correlation
      (perpetualManager as any).correlations.set('BTCUSDT_ETHUSDT', mockCorrelation);

      const orderId = await perpetualManager.createHedgedPosition('BTCUSDT', 0.5, 'ETHUSDT');

      expect(orderId).toBe('order-123');
      expect(mockHummingbotBridge.placeOrder).toHaveBeenCalledTimes(2); // Primary + hedge

      // Verify hedge order
      expect(mockHummingbotBridge.placeOrder).toHaveBeenNthCalledWith(2, 'test-instance-1', {
        symbol: 'ETHUSDT',
        side: 'sell', // Opposite side due to positive correlation
        type: 'market',
        quantity: 0.3 // 0.5 * 0.6 hedge ratio
      });
    });

    it('should create position without hedge when no correlation exists', async () => {
      const orderId = await perpetualManager.createHedgedPosition('BTCUSDT', 0.5, 'ADAUSDT');

      expect(orderId).toBe('order-123');
      expect(mockHummingbotBridge.placeOrder).toHaveBeenCalledTimes(1); // Only primary position
    });

    it('should handle hedge creation failures gracefully', async () => {
      mockHummingbotBridge.placeOrder
        .mockResolvedValueOnce('order-123') // Primary order succeeds
        .mockRejectedValueOnce(new Error('Hedge order failed')); // Hedge order fails

      const mockCorrelation: PositionCorrelation = {
        symbol1: 'BTCUSDT',
        symbol2: 'ETHUSDT',
        correlation: 0.8,
        hedgeRatio: 0.6,
        effectiveness: 0.75,
        confidence: 0.8,
        timeframe: '1h'
      };

      (perpetualManager as any).correlations.set('BTCUSDT_ETHUSDT', mockCorrelation);

      // Should still return primary order ID even if hedge fails
      const orderId = await perpetualManager.createHedgedPosition('BTCUSDT', 0.5, 'ETHUSDT');
      expect(orderId).toBe('order-123');
    });
  });

  describe('configuration management', () => {
    beforeEach(async () => {
      await perpetualManager.initialize();
    });

    it('should update configuration dynamically', async () => {
      const newConfig = {
        leverage: 15,
        fundingRateThreshold: 0.003,
        leverageOptimization: {
          ...mockConfig.leverageOptimization,
          targetVolatility: 0.04
        }
      };

      await perpetualManager.updateConfiguration(newConfig);

      // Should reconfigure instances
      expect(mockHummingbotBridge.setLeverage).toHaveBeenCalledWith('test-instance-1', 'BTCUSDT', 15);
    });

    it('should validate configuration updates', async () => {
      const invalidConfig = { leverage: 25, maxLeverage: 20 };

      await expect(perpetualManager.updateConfiguration(invalidConfig)).rejects.toThrow();
    });

    it('should emit configuration update events', async () => {
      const configUpdateSpy = jest.fn();
      perpetualManager.on('configurationUpdated', configUpdateSpy);

      await perpetualManager.updateConfiguration({ leverage: 12 });

      expect(configUpdateSpy).toHaveBeenCalledWith({
        config: expect.objectContaining({ leverage: 12 })
      });
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await perpetualManager.initialize();
    });

    it('should handle position update errors gracefully', async () => {
      mockHummingbotBridge.getPositions.mockRejectedValue(new Error('Position update failed'));

      const errorSpy = jest.fn();
      perpetualManager.on('error', errorSpy);

      // Wait for monitoring error
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'monitoring',
        error: expect.any(Error)
      });
    });

    it('should handle leverage adjustment failures', async () => {
      mockHummingbotBridge.setLeverage.mockRejectedValue(new Error('Leverage adjustment failed'));

      // Mock position that needs leverage adjustment
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.5,
          entryPrice: 50000,
          markPrice: 50000,
          liquidationPrice: 45000,
          unrealizedPnl: 0,
          realizedPnl: 0,
          leverage: 5, // Low leverage that should be optimized
          margin: 5000,
          marginRatio: 0.4,
          createdAt: new Date()
        }
      ]);

      // Mock low volatility to trigger leverage increase
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 50000,
        trendStrength: 0.7,
        volatility: 0.01 // Low volatility
      });

      const errorSpy = jest.fn();
      perpetualManager.on('error', errorSpy);

      // Wait for optimization attempt
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'leverage_adjustment',
        error: expect.any(Error),
        positionId: expect.any(String)
      });
    });

    it('should handle funding rate query failures', async () => {
      mockHummingbotBridge.getFundingRate.mockRejectedValue(new Error('Funding rate query failed'));

      // Should not crash and should continue operation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should still have empty funding rates
      const fundingRates = perpetualManager.getFundingRates();
      expect(fundingRates).toEqual([]);
    });
  });

  describe('cleanup and shutdown', () => {
    beforeEach(async () => {
      await perpetualManager.initialize();
    });

    it('should stop monitoring and optimization on shutdown', async () => {
      const stoppedSpy = jest.fn();
      perpetualManager.on('stopped', stoppedSpy);

      // Spy on clearInterval before calling stop
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await perpetualManager.stop();

      expect(stoppedSpy).toHaveBeenCalled();

      // Verify intervals are cleared
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should handle shutdown gracefully even with active positions', async () => {
      // Mock active positions
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.5,
          entryPrice: 50000,
          markPrice: 50000,
          liquidationPrice: 45000,
          unrealizedPnl: 0,
          realizedPnl: 0,
          leverage: 10,
          margin: 2500,
          marginRatio: 0.2,
          createdAt: new Date()
        }
      ]);

      await expect(perpetualManager.stop()).resolves.not.toThrow();
    });
  });
});