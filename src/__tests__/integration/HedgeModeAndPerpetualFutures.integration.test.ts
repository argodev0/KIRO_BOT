import { HedgeModeManager, HedgeConfiguration } from '../../services/HedgeModeManager';
import { PerpetualFuturesGridBot, GridConfiguration } from '../../services/PerpetualFuturesGridBot';
import { PerpetualFuturesManager, PerpetualFuturesConfig } from '../../services/PerpetualFuturesManager';
import { TechnicalAnalysisService } from '../../services/TechnicalAnalysisService';
import { RiskManagementService } from '../../services/RiskManagementService';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';

// Mock dependencies
jest.mock('../../services/TechnicalAnalysisService');
jest.mock('../../services/RiskManagementService');
jest.mock('../../services/HummingbotBridgeService');

describe('Hedge Mode and Perpetual Futures Integration', () => {
  let hedgeManager: HedgeModeManager;
  let gridBot: PerpetualFuturesGridBot;
  let perpetualManager: PerpetualFuturesManager;
  let mockTechnicalAnalysis: jest.Mocked<TechnicalAnalysisService>;
  let mockRiskManagement: jest.Mocked<RiskManagementService>;
  let mockHummingbotBridge: jest.Mocked<HummingbotBridgeService>;

  const hedgeConfig: HedgeConfiguration = {
    symbol: 'BTCUSDT',
    hedgeRatio: 0.8,
    triggerThreshold: {
      priceDeviation: 0.03,
      volumeSpike: 2.5,
      probabilityThreshold: 0.75,
      timeWindow: 15
    },
    hedgeTypes: {
      oppositePosition: true,
      optionsHedge: false,
      crossAssetHedge: false
    },
    riskLimits: {
      maxHedgeSize: 1.0,
      maxDrawdown: 0.1,
      stopLoss: 0.05
    },
    rebalanceFrequency: 30,
    emergencyExit: {
      enabled: true,
      maxLoss: 500,
      timeLimit: 240
    }
  };

  const gridConfig: GridConfiguration = {
    symbol: 'BTCUSDT',
    basePrice: 50000,
    gridSpacing: 100,
    gridLevels: 5,
    positionSize: 0.01,
    maxPosition: 0.1,
    leverage: 10,
    hedgeMode: true,
    hedgeTrigger: {
      priceDeviation: 0.02,
      volumeThreshold: 2.0,
      probabilityThreshold: 0.7
    },
    elliottWaveEnabled: true,
    nknEnabled: true,
    dynamicAdjustment: true
  };

  const perpetualConfig: PerpetualFuturesConfig = {
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

  beforeEach(() => {
    mockTechnicalAnalysis = new TechnicalAnalysisService({}) as jest.Mocked<TechnicalAnalysisService>;
    mockRiskManagement = new RiskManagementService({}) as jest.Mocked<RiskManagementService>;
    mockHummingbotBridge = new HummingbotBridgeService({}) as jest.Mocked<HummingbotBridgeService>;

    // Setup common mocks
    setupCommonMocks();

    hedgeManager = new HedgeModeManager(
      hedgeConfig,
      mockTechnicalAnalysis,
      mockRiskManagement,
      mockHummingbotBridge
    );

    gridBot = new PerpetualFuturesGridBot(
      gridConfig,
      mockTechnicalAnalysis,
      mockRiskManagement,
      mockHummingbotBridge
    );

    perpetualManager = new PerpetualFuturesManager(
      perpetualConfig,
      mockTechnicalAnalysis,
      mockRiskManagement,
      mockHummingbotBridge
    );
  });

  function setupCommonMocks() {
    mockTechnicalAnalysis.getMarketData.mockResolvedValue({
      price: 50000,
      volume: 1000000,
      timestamp: new Date()
    });

    mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
      slope: 0.5,
      intercept: 49000,
      rSquared: 0.85,
      predictedValue: 49500,
      trendStrength: 0.7,
      volatility: 0.02
    });

    mockTechnicalAnalysis.analyzeWithNKN.mockResolvedValue({
      probability: 0.8,
      confidence: 0.85,
      direction: 'up',
      signals: []
    });

    mockTechnicalAnalysis.analyzeElliottWave.mockResolvedValue({
      currentWave: 'Wave 3',
      waves: [
        { label: 'Wave 1', price: 49000, probability: 0.8 },
        { label: 'Wave 2', price: 49500, probability: 0.6 },
        { label: 'Wave 3', price: 50500, probability: 0.9 }
      ],
      trendDirection: 'up',
      confidence: 0.85
    });

    mockTechnicalAnalysis.getPriceHistory.mockResolvedValue([
      48000, 48500, 49000, 49500, 50000, 50500, 51000, 50800, 50600, 50400
    ]);

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

    mockHummingbotBridge.createInstance.mockResolvedValue({
      id: 'test-instance-1',
      name: 'grid-bot-BTCUSDT',
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
    });

    mockHummingbotBridge.placeOrder.mockResolvedValue('order-123');
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

    mockRiskManagement.checkRiskLimits.mockResolvedValue({
      withinLimits: true,
      violations: [],
      recommendations: []
    });
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Integrated Hedge Mode and Grid Bot Operations', () => {
    it('should coordinate hedge activation between grid bot and hedge manager', async () => {
      await hedgeManager.initialize();
      await gridBot.initialize();
      await gridBot.start();

      // Mock price deviation that should trigger hedge in both systems
      mockTechnicalAnalysis.getMarketData.mockResolvedValue({
        price: 48000, // Significant price drop
        volume: 1000000,
        timestamp: new Date()
      });

      const hedgeTriggeredSpy = jest.fn();
      const gridHedgeActivatedSpy = jest.fn();

      hedgeManager.on('hedgeTriggered', hedgeTriggeredSpy);
      gridBot.on('hedgeActivated', gridHedgeActivatedSpy);

      // Wait for both systems to detect and react
      await new Promise(resolve => setTimeout(resolve, 300));

      // Both systems should have triggered hedges
      expect(hedgeTriggeredSpy).toHaveBeenCalled();
      expect(gridHedgeActivatedSpy).toHaveBeenCalled();

      // Verify coordination - hedge manager should have active hedges
      const activeHedges = hedgeManager.getActiveHedges();
      expect(activeHedges.length).toBeGreaterThan(0);

      // Grid bot should have hedge position
      const gridStatus = gridBot.getStatus();
      expect(gridStatus.hedgePosition).toBeDefined();
      expect(gridStatus.hedgePosition?.active).toBe(true);
    });

    it('should prevent conflicting hedge positions', async () => {
      await hedgeManager.initialize();
      await gridBot.initialize();
      await gridBot.start();

      // Trigger hedge in hedge manager first
      await hedgeManager.manualHedgeTrigger({ reason: 'test' });

      // Mock conditions that would normally trigger grid bot hedge
      mockTechnicalAnalysis.getMarketData.mockResolvedValue({
        price: 48000,
        volume: 1000000,
        timestamp: new Date()
      });

      // Wait for potential grid bot hedge activation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should coordinate to avoid over-hedging
      const hedgeManagerHedges = hedgeManager.getActiveHedges();
      const gridBotStatus = gridBot.getStatus();

      // Total hedge exposure should be reasonable
      const totalHedgeExposure = hedgeManagerHedges.reduce((sum, h) => sum + h.size, 0) +
                                (gridBotStatus.hedgePosition?.size || 0);

      expect(totalHedgeExposure).toBeLessThanOrEqual(perpetualConfig.riskLimits.maxPositionSize);
    });
  });

  describe('Perpetual Futures Management Integration', () => {
    it('should initialize perpetual futures settings correctly', async () => {
      await perpetualManager.initialize();

      expect(mockHummingbotBridge.setLeverage).toHaveBeenCalledWith(
        'test-instance-1',
        'BTCUSDT',
        10
      );
      expect(mockHummingbotBridge.setPositionMode).toHaveBeenCalledWith(
        'test-instance-1',
        'hedge'
      );
      expect(mockHummingbotBridge.setMarginType).toHaveBeenCalledWith(
        'test-instance-1',
        'BTCUSDT',
        'isolated'
      );
    });

    it('should optimize leverage based on market volatility', async () => {
      await perpetualManager.initialize();

      // Mock high volatility scenario
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 49500,
        trendStrength: 0.7,
        volatility: 0.06 // High volatility
      });

      // Mock a position
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.1,
          entryPrice: 50000,
          markPrice: 50000,
          liquidationPrice: 45000,
          unrealizedPnl: 0,
          realizedPnl: 0,
          leverage: 10,
          margin: 500,
          marginRatio: 0.2,
          createdAt: new Date()
        }
      ]);

      const leverageOptimizedSpy = jest.fn();
      perpetualManager.on('leverageOptimized', leverageOptimizedSpy);

      // Wait for optimization cycle
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have optimized leverage due to high volatility
      expect(leverageOptimizedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          optimization: expect.objectContaining({
            recommendation: expect.stringMatching(/decrease|maintain/)
          })
        })
      );
    });

    it('should handle funding rate optimization', async () => {
      await perpetualManager.initialize();

      // Mock high funding rate
      mockHummingbotBridge.getFundingRate.mockResolvedValue({
        fundingRate: 0.008, // High funding rate (0.8%)
        nextFundingTime: Date.now() + 30 * 60 * 1000, // 30 minutes
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

      // Wait for funding rate check
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have triggered funding optimization
      expect(fundingOptimizationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'position_reduced',
          fundingRate: 0.008
        })
      );
    });

    it('should calculate position correlations correctly', async () => {
      await perpetualManager.initialize();

      // Mock price history for correlation calculation
      mockTechnicalAnalysis.getPriceHistory
        .mockResolvedValueOnce([48000, 48500, 49000, 49500, 50000]) // BTCUSDT
        .mockResolvedValueOnce([3000, 3050, 3100, 3150, 3200]); // ETHUSDT

      const correlationsUpdatedSpy = jest.fn();
      perpetualManager.on('correlationsUpdated', correlationsUpdatedSpy);

      // Wait for correlation calculation
      await new Promise(resolve => setTimeout(resolve, 300));

      const correlations = perpetualManager.getCorrelations();
      expect(correlations.length).toBeGreaterThan(0);

      if (correlations.length > 0) {
        const correlation = correlations[0];
        expect(correlation.correlation).toBeGreaterThanOrEqual(-1);
        expect(correlation.correlation).toBeLessThanOrEqual(1);
        expect(correlation.hedgeRatio).toBeDefined();
        expect(correlation.effectiveness).toBeGreaterThanOrEqual(0);
        expect(correlation.effectiveness).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Risk Management Integration', () => {
    it('should enforce position size limits across all systems', async () => {
      await hedgeManager.initialize();
      await gridBot.initialize();
      await perpetualManager.initialize();
      await gridBot.start();

      // Create multiple positions that approach limits
      await hedgeManager.manualHedgeTrigger({ reason: 'test1' });
      await hedgeManager.manualHedgeTrigger({ reason: 'test2' });

      // Mock large position in perpetual manager
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 0.8, // Close to max position size
          entryPrice: 50000,
          markPrice: 50000,
          liquidationPrice: 45000,
          unrealizedPnl: 0,
          realizedPnl: 0,
          leverage: 10,
          margin: 4000,
          marginRatio: 0.2,
          createdAt: new Date()
        }
      ]);

      const riskViolationSpy = jest.fn();
      perpetualManager.on('riskViolation', riskViolationSpy);

      // Wait for risk checks
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should detect risk violation for position size
      expect(riskViolationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'position_size_exceeded'
        })
      );
    });

    it('should trigger emergency shutdown when risk limits are breached', async () => {
      await hedgeManager.initialize();
      await perpetualManager.initialize();

      // Mock severe market conditions
      mockTechnicalAnalysis.getMarketData.mockResolvedValue({
        price: 40000, // 20% drop
        volume: 5000000, // High volume
        timestamp: new Date()
      });

      // Mock large losing positions
      mockHummingbotBridge.getPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          side: 'long',
          size: 1.0,
          entryPrice: 50000,
          markPrice: 40000,
          liquidationPrice: 35000,
          unrealizedPnl: -10000, // Large loss
          realizedPnl: 0,
          leverage: 10,
          margin: 5000,
          marginRatio: 0.05, // Low margin ratio
          createdAt: new Date()
        }
      ]);

      const emergencyExitSpy = jest.fn();
      const liquidationRiskSpy = jest.fn();

      hedgeManager.on('emergencyExit', emergencyExitSpy);
      perpetualManager.on('liquidationRisk', liquidationRiskSpy);

      // Wait for emergency procedures
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should trigger emergency procedures
      expect(liquidationRiskSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring and Analytics', () => {
    it('should track performance across all hedge systems', async () => {
      await hedgeManager.initialize();
      await gridBot.initialize();
      await perpetualManager.initialize();
      await gridBot.start();

      // Create some hedge positions
      await hedgeManager.manualHedgeTrigger({ reason: 'perf-test' });

      // Mock performance data
      const activeHedges = hedgeManager.getActiveHedges();
      if (activeHedges.length > 0) {
        activeHedges[0].realizedPnl = 100;
        activeHedges[0].status = 'closed';
      }

      // Get performance metrics
      const hedgePerformance = hedgeManager.calculateHedgePerformance();
      const gridPerformance = await gridBot.getPerformanceMetrics();

      expect(hedgePerformance).toEqual(expect.objectContaining({
        totalHedges: expect.any(Number),
        totalPnl: expect.any(Number),
        winRate: expect.any(Number)
      }));

      if (gridPerformance) {
        expect(gridPerformance).toEqual(expect.objectContaining({
          gridEfficiency: expect.any(Number),
          probabilityAccuracy: expect.any(Number)
        }));
      }
    });

    it('should provide comprehensive risk metrics', async () => {
      await perpetualManager.initialize();

      // Mock positions with various risk profiles
      mockHummingbotBridge.getPositions.mockResolvedValue([
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
        },
        {
          symbol: 'ETHUSDT',
          side: 'short',
          size: 2.0,
          entryPrice: 3000,
          markPrice: 2950,
          liquidationPrice: 3300,
          unrealizedPnl: 100,
          realizedPnl: 0,
          leverage: 5,
          margin: 1200,
          marginRatio: 0.3,
          createdAt: new Date()
        }
      ]);

      // Wait for position updates
      await new Promise(resolve => setTimeout(resolve, 300));

      const positions = perpetualManager.getPositions();
      expect(positions.length).toBe(2);

      // Verify risk calculations
      positions.forEach(position => {
        expect(position.marginRatio).toBeGreaterThan(0);
        expect(position.liquidationPrice).toBeDefined();
        expect(position.leverage).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration Management', () => {
    it('should update configurations dynamically across systems', async () => {
      await hedgeManager.initialize();
      await gridBot.initialize();
      await perpetualManager.initialize();

      // Update hedge manager configuration
      await hedgeManager.updateConfiguration({
        hedgeRatio: 0.9,
        rebalanceFrequency: 60
      });

      // Update grid bot configuration
      await gridBot.updateConfiguration({
        gridSpacing: 150,
        leverage: 15
      });

      // Update perpetual manager configuration
      await perpetualManager.updateConfiguration({
        leverage: 15,
        fundingRateThreshold: 0.003
      });

      // Verify configurations were updated
      const gridConfig = gridBot.getConfiguration();
      expect(gridConfig.gridSpacing).toBe(150);
      expect(gridConfig.leverage).toBe(15);

      // Should have reconfigured Hummingbot instances
      expect(mockHummingbotBridge.setLeverage).toHaveBeenCalledWith(
        expect.any(String),
        'BTCUSDT',
        15
      );
    });

    it('should validate configuration changes for consistency', async () => {
      await perpetualManager.initialize();

      // Try to set invalid leverage
      await expect(perpetualManager.updateConfiguration({
        leverage: 25, // Above maxLeverage
        maxLeverage: 20
      })).rejects.toThrow('Leverage must be between');

      // Try to set invalid liquidation buffer
      await expect(perpetualManager.updateConfiguration({
        riskLimits: {
          ...perpetualConfig.riskLimits,
          liquidationBuffer: 0.6 // Above 50%
        }
      })).rejects.toThrow('Liquidation buffer must be between');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Hummingbot connection failures gracefully', async () => {
      // Mock connection failure
      mockHummingbotBridge.getInstances.mockRejectedValue(new Error('Connection failed'));

      const errorSpy = jest.fn();
      hedgeManager.on('error', errorSpy);
      perpetualManager.on('error', errorSpy);

      await expect(hedgeManager.initialize()).rejects.toThrow('Connection failed');
      await expect(perpetualManager.initialize()).rejects.toThrow('Connection failed');

      expect(errorSpy).toHaveBeenCalledTimes(2);
    });

    it('should recover from temporary API failures', async () => {
      await hedgeManager.initialize();
      await perpetualManager.initialize();

      // Mock temporary API failure
      mockHummingbotBridge.placeOrder
        .mockRejectedValueOnce(new Error('API temporarily unavailable'))
        .mockResolvedValue('order-123');

      const errorSpy = jest.fn();
      hedgeManager.on('error', errorSpy);

      // Try to create hedge position
      await hedgeManager.manualHedgeTrigger({ reason: 'recovery-test' });

      // Should have logged error but continued operation
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'hedge_trigger',
          error: expect.any(Error)
        })
      );
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should properly cleanup all systems on shutdown', async () => {
      await hedgeManager.initialize();
      await gridBot.initialize();
      await perpetualManager.initialize();
      await gridBot.start();

      // Create some active positions
      await hedgeManager.manualHedgeTrigger({ reason: 'cleanup-test' });

      const hedgeStoppedSpy = jest.fn();
      const gridStoppedSpy = jest.fn();
      const perpetualStoppedSpy = jest.fn();

      hedgeManager.on('stopped', hedgeStoppedSpy);
      gridBot.on('stopped', gridStoppedSpy);
      perpetualManager.on('stopped', perpetualStoppedSpy);

      // Shutdown all systems
      await Promise.all([
        hedgeManager.stop(),
        gridBot.stop(),
        perpetualManager.stop()
      ]);

      expect(hedgeStoppedSpy).toHaveBeenCalled();
      expect(gridStoppedSpy).toHaveBeenCalled();
      expect(perpetualStoppedSpy).toHaveBeenCalled();

      // Verify cleanup
      const activeHedges = hedgeManager.getActiveHedges();
      expect(activeHedges).toHaveLength(0);

      const gridStatus = gridBot.getStatus();
      expect(gridStatus.active).toBe(false);
    });
  });
});