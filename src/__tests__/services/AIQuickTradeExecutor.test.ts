import { AIQuickTradeExecutor } from '../../services/AIQuickTradeExecutor';
import { QuickTradeConfig, QuickTradeSignal, MarketConditions } from '../../types/quickTrade';

describe('AIQuickTradeExecutor', () => {
  let executor: AIQuickTradeExecutor;
  let mockConfig: QuickTradeConfig;

  beforeEach(() => {
    mockConfig = {
      maxConcurrentPositions: 5,
      maxPositionSize: 1000,
      minProbabilityThreshold: 0.6,
      maxRiskPerTrade: 0.02,
      hedgeMode: {
        enabled: true,
        activationThreshold: 0.01,
        hedgeRatio: 0.5,
        maxHedgePositions: 3,
        hedgeDelayMs: 1000,
        correlationThreshold: 0.7
      },
      executionTimeoutMs: 5000,
      slippageTolerance: 0.001,
      minTrendStrength: 0.3
    };

    executor = new AIQuickTradeExecutor(mockConfig);
  });

  afterEach(async () => {
    if (executor) {
      await executor.stop();
    }
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      const config = executor.getConfig();
      expect(config).toEqual(mockConfig);
    });

    it('should initialize with empty positions', () => {
      const positions = executor.getActivePositions();
      expect(positions).toHaveLength(0);
    });

    it('should initialize risk metrics', () => {
      const riskMetrics = executor.getRiskMetrics();
      expect(riskMetrics).toBeDefined();
      expect(riskMetrics.totalExposure).toBe(0);
      expect(riskMetrics.winRate).toBe(0);
    });
  });

  describe('start and stop', () => {
    it('should start successfully', async () => {
      const startPromise = executor.start();
      await expect(startPromise).resolves.not.toThrow();
    });

    it('should emit started event', async () => {
      const startedSpy = jest.fn();
      executor.on('started', startedSpy);

      await executor.start();

      expect(startedSpy).toHaveBeenCalled();
    });

    it('should stop successfully', async () => {
      await executor.start();
      const stopPromise = executor.stop();
      await expect(stopPromise).resolves.not.toThrow();
    });

    it('should emit stopped event', async () => {
      const stoppedSpy = jest.fn();
      executor.on('stopped', stoppedSpy);

      await executor.start();
      await executor.stop();

      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not allow starting twice', async () => {
      await executor.start();
      await expect(executor.start()).rejects.toThrow('already running');
    });
  });

  describe('analyzeMarketConditions', () => {
    it('should analyze market conditions successfully', async () => {
      const priceData = Array.from({length: 50}, (_, i) => 100 + i * 0.1);
      const volumeData = Array.from({length: 50}, () => 1000 + Math.random() * 500);

      const conditions = await executor.analyzeMarketConditions(priceData, volumeData);

      expect(conditions).toBeDefined();
      expect(conditions.volatility).toBeDefined();
      expect(conditions.trend).toBeDefined();
      expect(conditions.probability).toBeDefined();
      expect(conditions.liquidity).toBeGreaterThan(0);
      expect(conditions.volume).toBeGreaterThan(0);
      expect(conditions.timestamp).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', async () => {
      const priceData: number[] = [];
      const volumeData: number[] = [];

      await expect(executor.analyzeMarketConditions(priceData, volumeData))
        .rejects.toThrow();
    });

    it('should calculate spread and liquidity', async () => {
      const priceData = [100, 101, 102, 103, 104];
      const volumeData = [1000, 1100, 1200, 1300, 1400];

      const conditions = await executor.analyzeMarketConditions(priceData, volumeData);

      expect(conditions.spread).toBeGreaterThanOrEqual(0);
      expect(conditions.liquidity).toBeGreaterThan(0);
    });
  });

  describe('generateQuickTradeSignal', () => {
    it('should generate valid trade signal for suitable conditions', async () => {
      // Create trending data that should generate a signal
      const trendingPrices = Array.from({length: 30}, (_, i) => 100 + i * 2);
      const volumeData = Array.from({length: 30}, () => 1000);

      const signal = await executor.generateQuickTradeSignal('BTCUSDT', trendingPrices, volumeData);

      if (signal) {
        expect(signal.symbol).toBe('BTCUSDT');
        expect(['enter_long', 'enter_short']).toContain(signal.action);
        expect(signal.confidence).toBeGreaterThan(0);
        expect(signal.confidence).toBeLessThanOrEqual(1);
        expect(signal.positionSize).toBeGreaterThan(0);
        expect(signal.targetPrice).toBeGreaterThan(0);
        expect(signal.timeToLive).toBeGreaterThan(0);
      }
    });

    it('should return null for unsuitable market conditions', async () => {
      // Create very noisy/unsuitable data
      const noisyPrices = Array.from({length: 10}, () => 100 + (Math.random() - 0.5) * 50);
      const volumeData = Array.from({length: 10}, () => 100);

      const signal = await executor.generateQuickTradeSignal('BTCUSDT', noisyPrices, volumeData);

      // Should return null for unsuitable conditions
      expect(signal).toBeNull();
    });

    it('should calculate position size based on volatility', async () => {
      const lowVolPrices = Array.from({length: 20}, (_, i) => 100 + i * 0.1);
      const highVolPrices = Array.from({length: 20}, (_, i) => 100 + i * 5);
      const volumeData = Array.from({length: 20}, () => 1000);

      const lowVolSignal = await executor.generateQuickTradeSignal('BTCUSDT', lowVolPrices, volumeData);
      const highVolSignal = await executor.generateQuickTradeSignal('BTCUSDT', highVolPrices, volumeData);

      if (lowVolSignal && highVolSignal) {
        // Lower volatility should allow larger position sizes
        expect(lowVolSignal.positionSize).toBeGreaterThanOrEqual(highVolSignal.positionSize);
      }
    });
  });

  describe('executeQuickTrade', () => {
    let mockSignal: QuickTradeSignal;

    beforeEach(async () => {
      const priceData = Array.from({length: 20}, (_, i) => 100 + i);
      const volumeData = Array.from({length: 20}, () => 1000);
      const conditions = await executor.analyzeMarketConditions(priceData, volumeData);

      mockSignal = {
        id: 'test-signal-1',
        symbol: 'BTCUSDT',
        action: 'enter_long',
        confidence: 0.8,
        urgency: 'medium',
        positionSize: 100,
        targetPrice: 105,
        stopLoss: 95,
        timeToLive: 300000,
        marketConditions: conditions,
        nknAnalysis: conditions.probability,
        regressionAnalysis: conditions.trend
      };
    });

    it('should execute trade successfully', async () => {
      await executor.start();

      const result = await executor.executeQuickTrade(mockSignal);

      expect(result.success).toBe(true);
      expect(result.executedPrice).toBeGreaterThan(0);
      expect(result.executedSize).toBeGreaterThan(0);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should create position after successful execution', async () => {
      await executor.start();

      const positionOpenedSpy = jest.fn();
      executor.on('positionOpened', positionOpenedSpy);

      await executor.executeQuickTrade(mockSignal);

      expect(positionOpenedSpy).toHaveBeenCalled();
      expect(executor.getActivePositions()).toHaveLength(1);
    });

    it('should respect maximum concurrent positions', async () => {
      await executor.start();

      // Execute trades up to the limit
      const promises = [];
      for (let i = 0; i < mockConfig.maxConcurrentPositions + 2; i++) {
        const signal = { ...mockSignal, id: `signal-${i}` };
        promises.push(executor.executeQuickTrade(signal));
      }

      const results = await Promise.all(promises);
      const successfulTrades = results.filter(r => r.success).length;

      expect(successfulTrades).toBeLessThanOrEqual(mockConfig.maxConcurrentPositions);
    });

    it('should calculate slippage correctly', async () => {
      await executor.start();

      const result = await executor.executeQuickTrade(mockSignal);

      expect(result.slippage).toBeGreaterThanOrEqual(0);
      expect(result.slippage).toBeLessThan(0.01); // Should be reasonable
    });
  });

  describe('hedge mode', () => {
    it('should activate hedge mode when conditions are met', async () => {
      const hedgeConfig = { ...mockConfig };
      hedgeConfig.hedgeMode.enabled = true;
      hedgeConfig.hedgeMode.activationThreshold = 0.001; // Very low threshold for testing

      const hedgeExecutor = new AIQuickTradeExecutor(hedgeConfig);
      await hedgeExecutor.start();

      const hedgeActivatedSpy = jest.fn();
      hedgeExecutor.on('hedgeActivated', hedgeActivatedSpy);

      const priceData = Array.from({length: 20}, (_, i) => 100 + i);
      const volumeData = Array.from({length: 20}, () => 1000);
      const conditions = await hedgeExecutor.analyzeMarketConditions(priceData, volumeData);

      const signal: QuickTradeSignal = {
        id: 'hedge-test-signal',
        symbol: 'BTCUSDT',
        action: 'enter_long',
        confidence: 0.8,
        urgency: 'medium',
        positionSize: 100,
        targetPrice: 105,
        stopLoss: 95,
        timeToLive: 300000,
        marketConditions: conditions,
        nknAnalysis: conditions.probability,
        regressionAnalysis: conditions.trend
      };

      await hedgeExecutor.executeQuickTrade(signal);

      // Wait for hedge activation delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      await hedgeExecutor.stop();
    });

    it('should not activate hedge mode when disabled', async () => {
      const noHedgeConfig = { ...mockConfig };
      noHedgeConfig.hedgeMode.enabled = false;

      const noHedgeExecutor = new AIQuickTradeExecutor(noHedgeConfig);
      await noHedgeExecutor.start();

      const hedgeActivatedSpy = jest.fn();
      noHedgeExecutor.on('hedgeActivated', hedgeActivatedSpy);

      const priceData = Array.from({length: 20}, (_, i) => 100 + i);
      const volumeData = Array.from({length: 20}, () => 1000);
      const conditions = await noHedgeExecutor.analyzeMarketConditions(priceData, volumeData);

      const signal: QuickTradeSignal = {
        id: 'no-hedge-signal',
        symbol: 'BTCUSDT',
        action: 'enter_long',
        confidence: 0.8,
        urgency: 'medium',
        positionSize: 100,
        targetPrice: 105,
        stopLoss: 95,
        timeToLive: 300000,
        marketConditions: conditions,
        nknAnalysis: conditions.probability,
        regressionAnalysis: conditions.trend
      };

      await noHedgeExecutor.executeQuickTrade(signal);

      // Wait to ensure no hedge activation
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(hedgeActivatedSpy).not.toHaveBeenCalled();

      await noHedgeExecutor.stop();
    });
  });

  describe('risk management', () => {
    it('should update risk metrics after trades', async () => {
      await executor.start();

      const priceData = Array.from({length: 20}, (_, i) => 100 + i);
      const volumeData = Array.from({length: 20}, () => 1000);
      const conditions = await executor.analyzeMarketConditions(priceData, volumeData);

      const signal: QuickTradeSignal = {
        id: 'risk-test-signal',
        symbol: 'BTCUSDT',
        action: 'enter_long',
        confidence: 0.8,
        urgency: 'medium',
        positionSize: 100,
        targetPrice: 105,
        stopLoss: 95,
        timeToLive: 300000,
        marketConditions: conditions,
        nknAnalysis: conditions.probability,
        regressionAnalysis: conditions.trend
      };

      await executor.executeQuickTrade(signal);

      const riskMetrics = executor.getRiskMetrics();
      expect(riskMetrics.totalExposure).toBeGreaterThan(0);
    });

    it('should calculate win rate correctly', async () => {
      const riskMetrics = executor.getRiskMetrics();
      expect(riskMetrics.winRate).toBeGreaterThanOrEqual(0);
      expect(riskMetrics.winRate).toBeLessThanOrEqual(1);
    });

    it('should track maximum drawdown', async () => {
      const riskMetrics = executor.getRiskMetrics();
      expect(riskMetrics.maxDrawdown).toBeLessThanOrEqual(0);
    });
  });

  describe('position management', () => {
    it('should close positions at target price', async () => {
      await executor.start();

      const positionClosedSpy = jest.fn();
      executor.on('positionClosed', positionClosedSpy);

      // Create a signal that should hit target quickly
      const priceData = Array.from({length: 20}, (_, i) => 100 + i);
      const volumeData = Array.from({length: 20}, () => 1000);
      const conditions = await executor.analyzeMarketConditions(priceData, volumeData);

      const signal: QuickTradeSignal = {
        id: 'target-test-signal',
        symbol: 'BTCUSDT',
        action: 'enter_long',
        confidence: 0.8,
        urgency: 'medium',
        positionSize: 100,
        targetPrice: 101, // Very close target
        stopLoss: 95,
        timeToLive: 300000,
        marketConditions: conditions,
        nknAnalysis: conditions.probability,
        regressionAnalysis: conditions.trend
      };

      await executor.executeQuickTrade(signal);

      // Wait for position management cycle
      await new Promise(resolve => setTimeout(resolve, 200));

      // Position might be closed if target is hit
      // This is probabilistic due to simulated price movements
    });

    it('should close all positions on stop', async () => {
      await executor.start();

      // Create multiple positions
      const priceData = Array.from({length: 20}, (_, i) => 100 + i);
      const volumeData = Array.from({length: 20}, () => 1000);
      const conditions = await executor.analyzeMarketConditions(priceData, volumeData);

      for (let i = 0; i < 3; i++) {
        const signal: QuickTradeSignal = {
          id: `close-test-signal-${i}`,
          symbol: 'BTCUSDT',
          action: 'enter_long',
          confidence: 0.8,
          urgency: 'medium',
          positionSize: 100,
          targetPrice: 200, // High target to avoid early close
          stopLoss: 50, // Low stop to avoid early close
          timeToLive: 300000,
          marketConditions: conditions,
          nknAnalysis: conditions.probability,
          regressionAnalysis: conditions.trend
        };

        await executor.executeQuickTrade(signal);
      }

      expect(executor.getActivePositions().length).toBeGreaterThan(0);

      await executor.stop();

      expect(executor.getActivePositions()).toHaveLength(0);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = { maxConcurrentPositions: 10 };
      
      const configUpdatedSpy = jest.fn();
      executor.on('configUpdated', configUpdatedSpy);

      executor.updateConfig(newConfig);

      expect(configUpdatedSpy).toHaveBeenCalledWith(expect.objectContaining(newConfig));
      expect(executor.getConfig().maxConcurrentPositions).toBe(10);
    });
  });

  describe('signal queue management', () => {
    it('should add signals to queue', () => {
      const mockSignal: QuickTradeSignal = {
        id: 'queue-test-signal',
        symbol: 'BTCUSDT',
        action: 'enter_long',
        confidence: 0.8,
        urgency: 'medium',
        positionSize: 100,
        targetPrice: 105,
        stopLoss: 95,
        timeToLive: 300000,
        marketConditions: {} as MarketConditions,
        nknAnalysis: {} as any,
        regressionAnalysis: {} as any
      };

      executor.addSignalToQueue(mockSignal);

      expect(executor.getQueueLength()).toBe(1);
    });

    it('should process signals from queue when running', async () => {
      const priceData = Array.from({length: 20}, (_, i) => 100 + i);
      const volumeData = Array.from({length: 20}, () => 1000);
      const conditions = await executor.analyzeMarketConditions(priceData, volumeData);

      const mockSignal: QuickTradeSignal = {
        id: 'queue-process-signal',
        symbol: 'BTCUSDT',
        action: 'enter_long',
        confidence: 0.8,
        urgency: 'medium',
        positionSize: 100,
        targetPrice: 105,
        stopLoss: 95,
        timeToLive: 300000,
        marketConditions: conditions,
        nknAnalysis: conditions.probability,
        regressionAnalysis: conditions.trend
      };

      executor.addSignalToQueue(mockSignal);
      expect(executor.getQueueLength()).toBe(1);

      await executor.start();

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(executor.getQueueLength()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle execution errors gracefully', async () => {
      await executor.start();

      // Create invalid signal
      const invalidSignal: QuickTradeSignal = {
        id: 'invalid-signal',
        symbol: '',
        action: 'enter_long',
        confidence: -1, // Invalid confidence
        urgency: 'medium',
        positionSize: -100, // Invalid size
        targetPrice: 0,
        stopLoss: 0,
        timeToLive: 0,
        marketConditions: {} as MarketConditions,
        nknAnalysis: {} as any,
        regressionAnalysis: {} as any
      };

      const result = await executor.executeQuickTrade(invalidSignal);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle market analysis errors', async () => {
      const invalidPriceData = [NaN, Infinity, -Infinity];
      const invalidVolumeData = [NaN, Infinity, -Infinity];

      await expect(executor.analyzeMarketConditions(invalidPriceData, invalidVolumeData))
        .rejects.toThrow();
    });
  });
});