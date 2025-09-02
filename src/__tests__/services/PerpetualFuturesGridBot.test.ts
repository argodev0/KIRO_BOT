import { PerpetualFuturesGridBot, GridConfiguration, GridLevel, HedgePosition } from '../../services/PerpetualFuturesGridBot';
import { TechnicalAnalysisService } from '../../services/TechnicalAnalysisService';
import { RiskManagementService } from '../../services/RiskManagementService';
import { HummingbotBridgeService } from '../../services/HummingbotBridgeService';

// Mock dependencies
jest.mock('../../services/TechnicalAnalysisService');
jest.mock('../../services/RiskManagementService');
jest.mock('../../services/HummingbotBridgeService');

describe('PerpetualFuturesGridBot', () => {
  let gridBot: PerpetualFuturesGridBot;
  let mockTechnicalAnalysis: jest.Mocked<TechnicalAnalysisService>;
  let mockRiskManagement: jest.Mocked<RiskManagementService>;
  let mockHummingbotBridge: jest.Mocked<HummingbotBridgeService>;
  let mockConfig: GridConfiguration;

  beforeEach(() => {
    mockTechnicalAnalysis = new TechnicalAnalysisService({}) as jest.Mocked<TechnicalAnalysisService>;
    mockRiskManagement = new RiskManagementService({}) as jest.Mocked<RiskManagementService>;
    mockHummingbotBridge = new HummingbotBridgeService({}) as jest.Mocked<HummingbotBridgeService>;

    mockConfig = {
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

    gridBot = new PerpetualFuturesGridBot(
      mockConfig,
      mockTechnicalAnalysis,
      mockRiskManagement,
      mockHummingbotBridge
    );

    // Setup default mocks
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

    mockTechnicalAnalysis.analyzeWithNKN.mockResolvedValue({
      probability: 0.75,
      confidence: 0.8,
      direction: 'up',
      signals: []
    });

    mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
      slope: 0.5,
      intercept: 49000,
      rSquared: 0.85,
      predictedValue: 50000,
      trendStrength: 0.7,
      volatility: 0.02
    });

    mockHummingbotBridge.startInstance.mockResolvedValue();
    mockHummingbotBridge.placeOrder.mockResolvedValue('order-123');
    mockHummingbotBridge.getInstanceStatus.mockResolvedValue({
      status: 'running',
      performance: { totalPnl: 100, unrealizedPnl: 50 },
      position: { size: 0.05 }
    });
    mockHummingbotBridge.getActiveOrders.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      await gridBot.initialize();

      expect(mockHummingbotBridge.createInstance).toHaveBeenCalledWith({
        name: 'grid-bot-BTCUSDT',
        strategy: 'perpetual_market_making',
        config: expect.objectContaining({
          strategy: 'perpetual_market_making',
          exchange: 'binance_perpetual',
          market: 'BTCUSDT',
          leverage: 10
        })
      });

      expect(mockTechnicalAnalysis.analyzeElliottWave).toHaveBeenCalledWith('BTCUSDT', '1h');
    });

    it('should calculate grid levels with Elliott Wave analysis', async () => {
      await gridBot.initialize();

      const gridLevels = gridBot.getGridLevels();
      expect(gridLevels).toHaveLength(10); // 5 buy + 5 sell levels
      
      const buyLevels = gridLevels.filter(l => l.side === 'buy');
      const sellLevels = gridLevels.filter(l => l.side === 'sell');
      
      expect(buyLevels).toHaveLength(5);
      expect(sellLevels).toHaveLength(5);
      
      // Check price ordering (sorted by price, so lowest buy price first)
      expect(buyLevels[buyLevels.length - 1].price).toBe(49900); // basePrice - gridSpacing (highest buy price)
      expect(sellLevels[0].price).toBe(50100); // basePrice + gridSpacing (lowest sell price)
    });

    it('should assign probability scores to grid levels', async () => {
      await gridBot.initialize();

      const gridLevels = gridBot.getGridLevels();
      
      gridLevels.forEach(level => {
        expect(level.probability).toBeGreaterThan(0);
        expect(level.probability).toBeLessThanOrEqual(1);
      });
    });

    it('should handle initialization errors', async () => {
      mockHummingbotBridge.createInstance.mockRejectedValue(new Error('Instance creation failed'));

      await expect(gridBot.initialize()).rejects.toThrow('Instance creation failed');
    });
  });

  describe('grid trading operations', () => {
    beforeEach(async () => {
      await gridBot.initialize();
    });

    it('should start grid trading successfully', async () => {
      await gridBot.start();

      expect(mockHummingbotBridge.startInstance).toHaveBeenCalledWith('test-instance-1');
      expect(mockHummingbotBridge.placeOrder).toHaveBeenCalledTimes(10); // All grid levels
      
      const status = gridBot.getStatus();
      expect(status.active).toBe(true);
    });

    it('should place grid orders at calculated levels', async () => {
      await gridBot.start();

      const gridLevels = gridBot.getGridLevels();
      
      expect(mockHummingbotBridge.placeOrder).toHaveBeenCalledTimes(gridLevels.length);
      
      gridLevels.forEach((level, index) => {
        expect(mockHummingbotBridge.placeOrder).toHaveBeenNthCalledWith(index + 1, 'test-instance-1', {
          symbol: 'BTCUSDT',
          side: level.side,
          type: 'limit',
          quantity: level.quantity,
          price: level.price
        });
      });
    });

    it('should stop grid trading and cancel orders', async () => {
      mockHummingbotBridge.cancelOrder.mockResolvedValue();
      mockHummingbotBridge.stopInstance.mockResolvedValue();

      await gridBot.start();
      await gridBot.stop();

      expect(mockHummingbotBridge.stopInstance).toHaveBeenCalledWith('test-instance-1');
      
      const status = gridBot.getStatus();
      expect(status.active).toBe(false);
    });

    it('should handle order placement failures gracefully', async () => {
      mockHummingbotBridge.placeOrder.mockRejectedValueOnce(new Error('Order failed'));

      await gridBot.start();

      // Should continue with other orders despite one failure
      const status = gridBot.getStatus();
      expect(status.active).toBe(true);
    });
  });

  describe('dynamic grid adjustment', () => {
    beforeEach(async () => {
      await gridBot.initialize();
      await gridBot.start();
    });

    it('should adjust grid spacing based on volatility', async () => {
      // Mock high volatility
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 50000,
        trendStrength: 0.7,
        volatility: 0.05 // High volatility
      });

      // Trigger dynamic adjustment
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for monitoring interval

      const config = gridBot.getConfiguration();
      expect(config.gridSpacing).toBeGreaterThan(100); // Should increase due to high volatility
    });

    it('should recalculate grid levels after significant changes', async () => {
      const initialLevels = gridBot.getGridLevels();
      
      await gridBot.updateConfiguration({ gridSpacing: 200 });

      const updatedLevels = gridBot.getGridLevels();
      expect(updatedLevels[0].price).not.toBe(initialLevels[0].price);
    });
  });

  describe('hedge mode functionality', () => {
    beforeEach(async () => {
      await gridBot.initialize();
      await gridBot.start();
    });

    it('should trigger hedge mode on price deviation', async () => {
      // Mock price update that triggers hedge
      mockTechnicalAnalysis.calculateLinearRegression.mockResolvedValue({
        slope: 0.5,
        intercept: 49000,
        rSquared: 0.85,
        predictedValue: 48000, // Significant deviation
        trendStrength: 0.7,
        volatility: 0.02
      });

      mockTechnicalAnalysis.analyzeWithNKN.mockResolvedValue({
        probability: 0.8, // High probability
        confidence: 0.9,
        direction: 'down',
        signals: []
      });

      // Wait for monitoring to trigger hedge
      await new Promise(resolve => setTimeout(resolve, 200));

      const status = gridBot.getStatus();
      expect(status.hedgePosition).toBeDefined();
      expect(status.hedgePosition?.active).toBe(true);
    });

    it('should calculate hedge position size correctly', async () => {
      // Mock current position
      mockHummingbotBridge.getInstanceStatus.mockResolvedValue({
        status: 'running',
        performance: { totalPnl: 100, unrealizedPnl: 50 },
        position: { size: 0.1 } // Current position
      });

      // Trigger hedge
      await new Promise(resolve => setTimeout(resolve, 200));

      const status = gridBot.getStatus();
      if (status.hedgePosition) {
        expect(status.hedgePosition.size).toBe(0.08); // 80% of current position
        expect(status.hedgePosition.hedgeRatio).toBe(0.8);
      }
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      await gridBot.initialize();
      await gridBot.start();
    });

    it('should track filled orders and update status', async () => {
      // Mock filled order
      mockHummingbotBridge.getActiveOrders.mockResolvedValue([
        {
          id: 'order-123',
          status: 'filled',
          symbol: 'BTCUSDT',
          side: 'buy',
          quantity: 0.01,
          price: 49900
        }
      ]);

      // Wait for status update
      await new Promise(resolve => setTimeout(resolve, 200));

      const status = gridBot.getStatus();
      expect(status.filledOrders).toBeGreaterThan(0);
    });

    it('should calculate performance metrics', async () => {
      mockHummingbotBridge.getInstancePerformance.mockResolvedValue({
        totalPnl: 150,
        unrealizedPnl: 75,
        totalTrades: 20,
        successfulTrades: 18,
        winRate: 0.9,
        averageLatency: 50
      });

      const metrics = await gridBot.getPerformanceMetrics();

      expect(metrics).toEqual(expect.objectContaining({
        totalPnl: 150,
        unrealizedPnl: 75,
        gridEfficiency: expect.any(Number),
        averageSpread: 100,
        probabilityAccuracy: expect.any(Number)
      }));
    });

    it('should handle performance calculation errors', async () => {
      mockHummingbotBridge.getInstancePerformance.mockRejectedValue(new Error('Performance error'));

      const metrics = await gridBot.getPerformanceMetrics();
      expect(metrics).toBeNull();
    });
  });

  describe('Elliott Wave integration', () => {
    beforeEach(async () => {
      await gridBot.initialize();
    });

    it('should adjust quantities based on Elliott Wave levels', async () => {
      const gridLevels = gridBot.getGridLevels();
      
      // Check that quantities are adjusted based on wave analysis
      const levelWithWave = gridLevels.find(l => l.elliottWaveLevel);
      if (levelWithWave) {
        expect(levelWithWave.quantity).not.toBe(mockConfig.positionSize);
      }
    });

    it('should handle Elliott Wave analysis failures', async () => {
      mockTechnicalAnalysis.analyzeElliottWave.mockRejectedValue(new Error('Elliott Wave error'));

      // Should still initialize without Elliott Wave data
      await expect(gridBot.initialize()).resolves.not.toThrow();
      
      const gridLevels = gridBot.getGridLevels();
      expect(gridLevels.length).toBeGreaterThan(0);
    });
  });

  describe('NKN probability analysis', () => {
    beforeEach(async () => {
      await gridBot.initialize();
    });

    it('should use NKN for probability calculation when enabled', async () => {
      const gridLevels = gridBot.getGridLevels();
      
      expect(mockTechnicalAnalysis.analyzeWithNKN).toHaveBeenCalled();
      
      gridLevels.forEach(level => {
        expect(level.probability).toBeDefined();
      });
    });

    it('should fallback to linear regression when NKN fails', async () => {
      mockTechnicalAnalysis.analyzeWithNKN.mockRejectedValue(new Error('NKN error'));

      await gridBot.initialize();

      expect(mockTechnicalAnalysis.calculateLinearRegression).toHaveBeenCalled();
      
      const gridLevels = gridBot.getGridLevels();
      gridLevels.forEach(level => {
        expect(level.probability).toBeGreaterThan(0);
      });
    });
  });

  describe('risk management integration', () => {
    beforeEach(async () => {
      await gridBot.initialize();
      await gridBot.start();
    });

    it('should respect maximum position limits', async () => {
      const status = gridBot.getStatus();
      expect(Math.abs(status.currentPosition)).toBeLessThanOrEqual(mockConfig.maxPosition);
    });

    it('should handle risk limit violations', async () => {
      // Mock risk violation
      mockRiskManagement.checkRiskLimits.mockResolvedValue({
        withinLimits: false,
        violations: ['position_size_exceeded'],
        recommendations: ['reduce_position']
      });

      // Should handle violation gracefully
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const status = gridBot.getStatus();
      expect(status.active).toBe(true); // Should continue operating
    });
  });

  describe('configuration management', () => {
    beforeEach(async () => {
      await gridBot.initialize();
    });

    it('should update configuration dynamically', async () => {
      const newConfig = { gridSpacing: 150, gridLevels: 7 };
      
      await gridBot.updateConfiguration(newConfig);

      const config = gridBot.getConfiguration();
      expect(config.gridSpacing).toBe(150);
      expect(config.gridLevels).toBe(7);
    });

    it('should recalculate grid on significant configuration changes', async () => {
      const initialLevels = gridBot.getGridLevels().length;
      
      await gridBot.updateConfiguration({ gridLevels: 8 });

      const newLevels = gridBot.getGridLevels().length;
      expect(newLevels).not.toBe(initialLevels);
    });

    it('should emit configuration update events', async () => {
      const configUpdateSpy = jest.fn();
      gridBot.on('configurationUpdated', configUpdateSpy);

      await gridBot.updateConfiguration({ gridSpacing: 120 });

      expect(configUpdateSpy).toHaveBeenCalledWith({
        oldConfig: expect.objectContaining({ gridSpacing: 100 }),
        newConfig: expect.objectContaining({ gridSpacing: 120 })
      });
    });
  });

  describe('error handling', () => {
    it('should handle Hummingbot connection errors', async () => {
      mockHummingbotBridge.startInstance.mockRejectedValue(new Error('Connection failed'));

      await gridBot.initialize();
      await expect(gridBot.start()).rejects.toThrow('Connection failed');
    });

    it('should emit error events for monitoring failures', async () => {
      const errorSpy = jest.fn();
      gridBot.on('error', errorSpy);

      mockHummingbotBridge.getInstanceStatus.mockRejectedValue(new Error('Status error'));

      await gridBot.initialize();
      await gridBot.start();

      // Wait for monitoring error
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'monitoring',
        error: expect.any(Error)
      });
    });

    it('should handle order cancellation failures during stop', async () => {
      mockHummingbotBridge.cancelOrder.mockRejectedValue(new Error('Cancel failed'));

      await gridBot.initialize();
      await gridBot.start();

      // Should not throw despite cancellation failures
      await expect(gridBot.stop()).resolves.not.toThrow();
    });
  });

  describe('event emission', () => {
    beforeEach(async () => {
      await gridBot.initialize();
    });

    it('should emit initialization event', async () => {
      const initSpy = jest.fn();
      const newGridBot = new PerpetualFuturesGridBot(
        mockConfig,
        mockTechnicalAnalysis,
        mockRiskManagement,
        mockHummingbotBridge
      );
      
      newGridBot.on('initialized', initSpy);
      await newGridBot.initialize();

      expect(initSpy).toHaveBeenCalledWith({
        config: mockConfig,
        instance: expect.any(Object)
      });
    });

    it('should emit grid levels calculated event', async () => {
      const gridSpy = jest.fn();
      const newGridBot = new PerpetualFuturesGridBot(
        mockConfig,
        mockTechnicalAnalysis,
        mockRiskManagement,
        mockHummingbotBridge
      );
      
      newGridBot.on('gridLevelsCalculated', gridSpy);
      await newGridBot.initialize();

      expect(gridSpy).toHaveBeenCalledWith({
        levels: expect.any(Array)
      });
    });

    it('should emit status update events', async () => {
      const statusSpy = jest.fn();
      gridBot.on('statusUpdated', statusSpy);

      await gridBot.start();

      // Wait for status update
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(statusSpy).toHaveBeenCalledWith({
        status: expect.objectContaining({
          active: true,
          lastUpdate: expect.any(Date)
        })
      });
    });
  });
});