import { HedgeModeManager, HedgeConfiguration, HedgePosition, HedgeTrigger } from '../../services/HedgeModeManager';
import { TechnicalAnalysisService } from '../../services/TechnicalAnalysisService';
import { RiskManagementService } from '../../services/RiskManagementService';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';

// Mock dependencies
jest.mock('../../services/TechnicalAnalysisService');
jest.mock('../../services/RiskManagementService');
jest.mock('../../services/HummingbotBridgeService');

describe('HedgeModeManager', () => {
  let hedgeManager: HedgeModeManager;
  let mockTechnicalAnalysis: jest.Mocked<TechnicalAnalysisService>;
  let mockRiskManagement: jest.Mocked<RiskManagementService>;
  let mockHummingbotBridge: jest.Mocked<HummingbotBridgeService>;
  let mockConfig: HedgeConfiguration;

  beforeEach(() => {
    mockTechnicalAnalysis = new TechnicalAnalysisService({}) as jest.Mocked<TechnicalAnalysisService>;
    mockRiskManagement = new RiskManagementService({}) as jest.Mocked<RiskManagementService>;
    mockHummingbotBridge = new HummingbotBridgeService({}) as jest.Mocked<HummingbotBridgeService>;

    mockConfig = {
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

    hedgeManager = new HedgeModeManager(
      mockConfig,
      mockTechnicalAnalysis,
      mockRiskManagement,
      mockHummingbotBridge
    );

    // Setup default mocks
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

    mockTechnicalAnalysis.getVolumeAnalysis.mockResolvedValue({
      currentVolume: 1000000,
      averageVolume: 800000,
      volumeSpike: false,
      volumeTrend: 'increasing'
    });

    mockTechnicalAnalysis.analyzeWithNKN.mockResolvedValue({
      probability: 0.8,
      confidence: 0.85,
      direction: 'up',
      signals: []
    });

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
          networkIO: 100,
          diskIO: 50
        },
        performance: {
          uptime: 3600,
          totalTrades: 10,
          successfulTrades: 8,
          totalVolume: 1000,
          averageLatency: 100
        },
        createdAt: new Date(),
        lastHealthCheck: new Date(),
        updatedAt: Date.now()
      }
    ]);

    mockHummingbotBridge.placeOrder.mockResolvedValue('order-123');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', async () => {
      await hedgeManager.initialize();

      expect(mockTechnicalAnalysis.getMarketData).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should validate configuration on initialization', async () => {
      const invalidConfig = { ...mockConfig, hedgeRatio: 1.5 };
      const invalidHedgeManager = new HedgeModeManager(
        invalidConfig,
        mockTechnicalAnalysis,
        mockRiskManagement,
        mockHummingbotBridge
      );

      await expect(invalidHedgeManager.initialize()).rejects.toThrow('Hedge ratio must be between 0 and 1');
    });

    it('should reject invalid probability threshold', async () => {
      const invalidConfig = { ...mockConfig, triggerThreshold: { ...mockConfig.triggerThreshold, probabilityThreshold: 1.5 } };
      const invalidHedgeManager = new HedgeModeManager(
        invalidConfig,
        mockTechnicalAnalysis,
        mockRiskManagement,
        mockHummingbotBridge
      );

      await expect(invalidHedgeManager.initialize()).rejects.toThrow('Probability threshold must be between 0 and 1');
    });

    it('should require at least one hedge type enabled', async () => {
      const invalidConfig = { 
        ...mockConfig, 
        hedgeTypes: { oppositePosition: false, optionsHedge: false, crossAssetHedge: false }
      };
      const invalidHedgeManager = new HedgeModeManager(
        invalidConfig,
        mockTechnicalAnalysis,
        mockRiskManagement,
        mockHummingbotBridge
      );

      await expect(invalidHedgeManager.initialize()).rejects.toThrow('At least one hedge type must be enabled');
    });
  });

  describe('hedge trigger detection', () => {
    beforeEach(async () => {
      await hedgeManager.initialize();
    });

    it('should detect price deviation trigger', async () => {
      // Mock significant price deviation
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 48000, // Significant deviation from current price (50000)
        trendStrength: 0.7,
        volatility: 0.02
      });

      const hedgeTriggeredSpy = jest.fn();
      hedgeManager.on('hedgeTriggered', hedgeTriggeredSpy);

      // Wait for trigger check
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(hedgeTriggeredSpy).toHaveBeenCalledWith({
        trigger: expect.objectContaining({
          type: 'price_deviation',
          confidence: expect.any(Number)
        }),
        hedgePosition: expect.any(Object)
      });
    });

    it('should detect volume spike trigger', async () => {
      // Mock volume spike
      mockTechnicalAnalysis.getVolumeAnalysis.mockResolvedValue({
        currentVolume: 2500000, // 2.5x average volume
        averageVolume: 1000000,
        volumeSpike: true,
        volumeTrend: 'spiking'
      });

      const hedgeTriggeredSpy = jest.fn();
      hedgeManager.on('hedgeTriggered', hedgeTriggeredSpy);

      // Wait for trigger check
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(hedgeTriggeredSpy).toHaveBeenCalledWith({
        trigger: expect.objectContaining({
          type: 'volume_spike',
          confidence: expect.any(Number)
        }),
        hedgePosition: expect.any(Object)
      });
    });

    it('should detect probability threshold trigger', async () => {
      // Mock high probability signal
      mockTechnicalAnalysis.analyzeWithNKN.mockResolvedValue({
        probability: 0.85, // Above threshold
        confidence: 0.9,
        direction: 'down',
        signals: []
      });

      const hedgeTriggeredSpy = jest.fn();
      hedgeManager.on('hedgeTriggered', hedgeTriggeredSpy);

      // Wait for trigger check
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(hedgeTriggeredSpy).toHaveBeenCalledWith({
        trigger: expect.objectContaining({
          type: 'probability_threshold',
          confidence: 0.85
        }),
        hedgePosition: expect.any(Object)
      });
    });

    it('should not trigger hedge when conditions are not met', async () => {
      // Mock normal conditions
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 49900, // Small deviation
        trendStrength: 0.7,
        volatility: 0.02
      });

      mockTechnicalAnalysis.analyzeWithNKN.mockResolvedValue({
        probability: 0.6, // Below threshold
        confidence: 0.7,
        direction: 'up',
        signals: []
      });

      const hedgeTriggeredSpy = jest.fn();
      hedgeManager.on('hedgeTriggered', hedgeTriggeredSpy);

      // Wait for trigger check
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(hedgeTriggeredSpy).not.toHaveBeenCalled();
    });
  });

  describe('hedge position management', () => {
    beforeEach(async () => {
      await hedgeManager.initialize();
    });

    it('should create hedge position when triggered', async () => {
      const trigger: HedgeTrigger = {
        type: 'manual',
        timestamp: new Date(),
        data: { reason: 'test' },
        confidence: 1.0
      };

      await hedgeManager.manualHedgeTrigger(trigger.data);

      const activeHedges = hedgeManager.getActiveHedges();
      expect(activeHedges).toHaveLength(1);
      expect(activeHedges[0]).toEqual(expect.objectContaining({
        symbol: 'BTCUSDT',
        status: 'active',
        hedgeRatio: 0.8
      }));
    });

    it('should place opposite position hedge order', async () => {
      await hedgeManager.manualHedgeTrigger({ reason: 'test' });

      expect(mockHummingbotBridge.placeOrder).toHaveBeenCalledWith('test-instance-1', {
        symbol: 'BTCUSDT',
        side: expect.any(String),
        type: 'market',
        quantity: expect.any(Number)
      });
    });

    it('should limit concurrent hedges', async () => {
      // Create multiple hedge triggers
      for (let i = 0; i < 5; i++) {
        await hedgeManager.manualHedgeTrigger({ reason: `test-${i}` });
      }

      const activeHedges = hedgeManager.getActiveHedges();
      expect(activeHedges.length).toBeLessThanOrEqual(3); // Should be limited to 3
    });

    it('should calculate hedge size based on confidence', async () => {
      const lowConfidenceTrigger = {
        type: 'manual' as const,
        timestamp: new Date(),
        data: { reason: 'low-confidence' },
        confidence: 0.5
      };

      await hedgeManager.manualHedgeTrigger(lowConfidenceTrigger.data);

      const activeHedges = hedgeManager.getActiveHedges();
      expect(activeHedges[0].size).toBeLessThan(mockConfig.riskLimits.maxHedgeSize * mockConfig.hedgeRatio);
    });
  });

  describe('hedge position monitoring', () => {
    let hedgePosition: HedgePosition;

    beforeEach(async () => {
      await hedgeManager.initialize();
      await hedgeManager.manualHedgeTrigger({ reason: 'test' });
      
      const activeHedges = hedgeManager.getActiveHedges();
      hedgePosition = activeHedges[0];
    });

    it('should update hedge position prices', async () => {
      // Mock price change
      mockTechnicalAnalysis.getMarketData.mockResolvedValue({
        price: 51000, // Price increased
        volume: 1000000,
        timestamp: new Date()
      });

      // Wait for position update
      await new Promise(resolve => setTimeout(resolve, 11000));

      const activeHedges = hedgeManager.getActiveHedges();
      expect(activeHedges[0].currentPrice).toBe(51000);
      expect(activeHedges[0].unrealizedPnl).not.toBe(0);
    });

    it('should close hedge on stop loss', async () => {
      // Mock price that triggers stop loss
      const stopLossPrice = hedgePosition.side === 'long' ? 
        hedgePosition.entryPrice * (1 - mockConfig.riskLimits.stopLoss) :
        hedgePosition.entryPrice * (1 + mockConfig.riskLimits.stopLoss);

      mockTechnicalAnalysis.getMarketData.mockResolvedValue({
        price: stopLossPrice - 100, // Below stop loss
        volume: 1000000,
        timestamp: new Date()
      });

      const hedgeClosedSpy = jest.fn();
      hedgeManager.on('hedgeClosed', hedgeClosedSpy);

      // Wait for position update and closure
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(hedgeClosedSpy).toHaveBeenCalledWith({
        hedge: expect.objectContaining({
          status: 'closed'
        }),
        reason: 'stop_loss'
      });
    });

    it('should close hedge on take profit', async () => {
      // Mock price that triggers take profit
      const takeProfitPrice = hedgePosition.side === 'long' ? 
        hedgePosition.entryPrice * (1 + mockConfig.riskLimits.stopLoss * 2) :
        hedgePosition.entryPrice * (1 - mockConfig.riskLimits.stopLoss * 2);

      mockTechnicalAnalysis.getMarketData.mockResolvedValue({
        price: takeProfitPrice + 100, // Above take profit
        volume: 1000000,
        timestamp: new Date()
      });

      const hedgeClosedSpy = jest.fn();
      hedgeManager.on('hedgeClosed', hedgeClosedSpy);

      // Wait for position update and closure
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(hedgeClosedSpy).toHaveBeenCalledWith({
        hedge: expect.objectContaining({
          status: 'closed'
        }),
        reason: 'take_profit'
      });
    });

    it('should close hedge on time limit', async () => {
      // Mock old hedge position
      const oldHedge = { ...hedgePosition };
      oldHedge.createdAt = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago

      // Replace the hedge in the manager (simulate old position)
      await hedgeManager.closeAllHedges();
      await hedgeManager.manualHedgeTrigger({ reason: 'old-test' });

      const hedgeClosedSpy = jest.fn();
      hedgeManager.on('hedgeClosed', hedgeClosedSpy);

      // Wait for time-based closure check
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(hedgeClosedSpy).toHaveBeenCalledWith({
        hedge: expect.objectContaining({
          status: 'closed'
        }),
        reason: 'time_limit'
      });
    });
  });

  describe('emergency exit functionality', () => {
    beforeEach(async () => {
      await hedgeManager.initialize();
    });

    it('should trigger emergency exit on max loss', async () => {
      // Create multiple losing hedges
      for (let i = 0; i < 3; i++) {
        await hedgeManager.manualHedgeTrigger({ reason: `losing-hedge-${i}` });
      }

      // Mock significant losses
      mockTechnicalAnalysis.getMarketData.mockResolvedValue({
        price: 45000, // Significant price drop
        volume: 1000000,
        timestamp: new Date()
      });

      const emergencyExitSpy = jest.fn();
      hedgeManager.on('emergencyExit', emergencyExitSpy);

      // Wait for emergency exit check
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(emergencyExitSpy).toHaveBeenCalledWith({
        reason: 'max_loss_exceeded',
        closedHedges: expect.any(Number)
      });
    });

    it('should trigger emergency exit on time limit', async () => {
      // Create hedge and mock old timestamp
      await hedgeManager.manualHedgeTrigger({ reason: 'time-test' });
      
      // Mock very old hedge (simulate by advancing time)
      const activeHedges = hedgeManager.getActiveHedges();
      if (activeHedges.length > 0) {
        activeHedges[0].createdAt = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
      }

      const emergencyExitSpy = jest.fn();
      hedgeManager.on('emergencyExit', emergencyExitSpy);

      // Wait for emergency exit check
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(emergencyExitSpy).toHaveBeenCalledWith({
        reason: 'time_limit_exceeded',
        closedHedges: expect.any(Number)
      });
    });

    it('should close all hedges during emergency exit', async () => {
      // Create multiple hedges
      for (let i = 0; i < 2; i++) {
        await hedgeManager.manualHedgeTrigger({ reason: `emergency-test-${i}` });
      }

      await hedgeManager.closeAllHedges();

      const activeHedges = hedgeManager.getActiveHedges();
      expect(activeHedges).toHaveLength(0);

      const hedgeHistory = hedgeManager.getHedgeHistory();
      expect(hedgeHistory.length).toBeGreaterThan(0);
    });
  });

  describe('performance calculation', () => {
    beforeEach(async () => {
      await hedgeManager.initialize();
    });

    it('should calculate hedge performance metrics', async () => {
      // Create and close some hedges
      await hedgeManager.manualHedgeTrigger({ reason: 'perf-test-1' });
      await hedgeManager.manualHedgeTrigger({ reason: 'perf-test-2' });
      
      // Mock some performance data
      const activeHedges = hedgeManager.getActiveHedges();
      activeHedges.forEach((hedge, index) => {
        hedge.realizedPnl = index === 0 ? 100 : -50; // One winner, one loser
        hedge.status = 'closed';
      });

      const performance = hedgeManager.calculateHedgePerformance();

      expect(performance).toEqual(expect.objectContaining({
        totalHedges: expect.any(Number),
        successfulHedges: expect.any(Number),
        averageHedgeEffectiveness: expect.any(Number),
        totalPnl: expect.any(Number),
        winRate: expect.any(Number),
        averageHoldTime: expect.any(Number)
      }));
    });

    it('should handle empty hedge history', () => {
      const performance = hedgeManager.calculateHedgePerformance();

      expect(performance).toEqual({
        totalHedges: 0,
        successfulHedges: 0,
        averageHedgeEffectiveness: 0,
        totalPnl: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
        averageHoldTime: 0
      });
    });

    it('should calculate Sharpe ratio correctly', async () => {
      // Create hedges with varying performance
      for (let i = 0; i < 5; i++) {
        await hedgeManager.manualHedgeTrigger({ reason: `sharpe-test-${i}` });
      }

      const activeHedges = hedgeManager.getActiveHedges();
      activeHedges.forEach((hedge, index) => {
        hedge.realizedPnl = (index - 2) * 50; // Mix of positive and negative returns
        hedge.status = 'closed';
      });

      const performance = hedgeManager.calculateHedgePerformance();
      expect(performance.sharpeRatio).toBeDefined();
      expect(typeof performance.sharpeRatio).toBe('number');
    });
  });

  describe('configuration management', () => {
    beforeEach(async () => {
      await hedgeManager.initialize();
    });

    it('should update configuration dynamically', async () => {
      const newConfig = { hedgeRatio: 0.9, rebalanceFrequency: 60 };
      
      await hedgeManager.updateConfiguration(newConfig);

      // Configuration should be updated
      expect(mockConfig.hedgeRatio).toBe(0.8); // Original config unchanged
      // But internal config should be updated (tested through behavior)
    });

    it('should validate updated configuration', async () => {
      const invalidConfig = { hedgeRatio: 1.5 };
      
      await expect(hedgeManager.updateConfiguration(invalidConfig)).rejects.toThrow();
    });

    it('should emit configuration update events', async () => {
      const configUpdateSpy = jest.fn();
      hedgeManager.on('configurationUpdated', configUpdateSpy);

      await hedgeManager.updateConfiguration({ hedgeRatio: 0.9 });

      expect(configUpdateSpy).toHaveBeenCalledWith({
        config: expect.objectContaining({ hedgeRatio: 0.9 })
      });
    });
  });

  describe('rebalancing functionality', () => {
    beforeEach(async () => {
      await hedgeManager.initialize();
    });

    it('should rebalance hedges periodically', async () => {
      // Create hedges
      await hedgeManager.manualHedgeTrigger({ reason: 'rebalance-test-1' });
      await hedgeManager.manualHedgeTrigger({ reason: 'rebalance-test-2' });

      const rebalancedSpy = jest.fn();
      hedgeManager.on('hedgesRebalanced', rebalancedSpy);

      // Wait for rebalancing interval (mocked to be shorter)
      await new Promise(resolve => setTimeout(resolve, 35000)); // Slightly longer than rebalance frequency

      expect(rebalancedSpy).toHaveBeenCalledWith({
        performance: expect.any(Object)
      });
    });

    it('should skip rebalancing when no active hedges', async () => {
      const rebalancedSpy = jest.fn();
      hedgeManager.on('hedgesRebalanced', rebalancedSpy);

      // Wait for rebalancing interval
      await new Promise(resolve => setTimeout(resolve, 35000));

      expect(rebalancedSpy).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await hedgeManager.initialize();
    });

    it('should handle market data errors gracefully', async () => {
      mockTechnicalAnalysis.getMarketData.mockRejectedValue(new Error('Market data error'));

      const errorSpy = jest.fn();
      hedgeManager.on('error', errorSpy);

      // Wait for monitoring error
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'monitoring',
        error: expect.any(Error)
      });
    });

    it('should handle order placement failures', async () => {
      mockHummingbotBridge.placeOrder.mockRejectedValue(new Error('Order failed'));

      const errorSpy = jest.fn();
      hedgeManager.on('error', errorSpy);

      await hedgeManager.manualHedgeTrigger({ reason: 'error-test' });

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'hedge_trigger',
        error: expect.any(Error),
        trigger: expect.any(Object)
      });
    });

    it('should handle hedge closure failures', async () => {
      await hedgeManager.manualHedgeTrigger({ reason: 'closure-error-test' });
      
      mockHummingbotBridge.placeOrder.mockRejectedValue(new Error('Close order failed'));

      const errorSpy = jest.fn();
      hedgeManager.on('error', errorSpy);

      // Trigger closure by mocking stop loss condition
      mockTechnicalAnalysis.getMarketData.mockResolvedValue({
        price: 40000, // Significant drop to trigger stop loss
        volume: 1000000,
        timestamp: new Date()
      });

      // Wait for closure attempt
      await new Promise(resolve => setTimeout(resolve, 11000));

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'hedge_close',
        error: expect.any(Error),
        hedgeId: expect.any(String)
      });
    });
  });

  describe('cleanup and shutdown', () => {
    beforeEach(async () => {
      await hedgeManager.initialize();
    });

    it('should stop monitoring and close hedges on shutdown', async () => {
      await hedgeManager.manualHedgeTrigger({ reason: 'shutdown-test' });
      
      const stoppedSpy = jest.fn();
      hedgeManager.on('stopped', stoppedSpy);

      await hedgeManager.stop();

      expect(stoppedSpy).toHaveBeenCalled();
      
      const activeHedges = hedgeManager.getActiveHedges();
      expect(activeHedges).toHaveLength(0);
    });

    it('should clear monitoring intervals on stop', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await hedgeManager.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});