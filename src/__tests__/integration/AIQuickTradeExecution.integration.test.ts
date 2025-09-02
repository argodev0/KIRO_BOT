import { AIQuickTradeExecutor } from '../../services/AIQuickTradeExecutor';
import { NKNProbabilityAnalyzer } from '../../services/NKNProbabilityAnalyzer';
import { LinearRegressionAnalyzer } from '../../services/LinearRegressionAnalyzer';
import { QuickTradeConfig, QuickTradeSignal } from '../../types/quickTrade';

describe('AI Quick Trade Execution Integration', () => {
  let executor: AIQuickTradeExecutor;
  let nknAnalyzer: NKNProbabilityAnalyzer;
  let regressionAnalyzer: LinearRegressionAnalyzer;
  let config: QuickTradeConfig;

  beforeEach(() => {
    config = {
      maxConcurrentPositions: 3,
      maxPositionSize: 1000,
      minProbabilityThreshold: 0.6,
      maxRiskPerTrade: 0.02,
      hedgeMode: {
        enabled: true,
        activationThreshold: 0.01,
        hedgeRatio: 0.5,
        maxHedgePositions: 2,
        hedgeDelayMs: 500,
        correlationThreshold: 0.7
      },
      executionTimeoutMs: 5000,
      slippageTolerance: 0.001,
      minTrendStrength: 0.3
    };

    executor = new AIQuickTradeExecutor(config);
    nknAnalyzer = new NKNProbabilityAnalyzer();
    regressionAnalyzer = new LinearRegressionAnalyzer();
  });

  afterEach(async () => {
    if (executor) {
      await executor.stop();
    }
  });

  describe('End-to-End Trading Workflow', () => {
    it('should complete full trading cycle from analysis to execution', async () => {
      // Create realistic market data
      const priceData = generateTrendingPriceData(100, 50, 0.02); // Uptrend
      const volumeData = generateVolumeData(50, 1000, 0.1);

      await executor.start();

      // Track events
      const events: any[] = [];
      executor.on('positionOpened', (position) => events.push({ type: 'opened', position }));
      executor.on('positionClosed', (data) => events.push({ type: 'closed', data }));
      executor.on('hedgeActivated', (data) => events.push({ type: 'hedge', data }));

      // Generate and execute signal
      const signal = await executor.generateQuickTradeSignal('BTCUSDT', priceData, volumeData);
      
      if (signal) {
        const result = await executor.executeQuickTrade(signal);
        expect(result.success).toBe(true);

        // Verify position was created
        const positions = executor.getActivePositions();
        expect(positions.length).toBeGreaterThan(0);

        // Verify risk metrics are updated
        const riskMetrics = executor.getRiskMetrics();
        expect(riskMetrics.totalExposure).toBeGreaterThan(0);

        // Wait for potential hedge activation
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent positions', async () => {
      const priceData = generateTrendingPriceData(100, 30, 0.01);
      const volumeData = generateVolumeData(30, 1000, 0.1);

      await executor.start();

      const signals: QuickTradeSignal[] = [];
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];

      // Generate multiple signals
      for (const symbol of symbols) {
        const signal = await executor.generateQuickTradeSignal(symbol, priceData, volumeData);
        if (signal) {
          signals.push(signal);
        }
      }

      // Execute all signals
      const results = await Promise.all(
        signals.map(signal => executor.executeQuickTrade(signal))
      );

      const successfulTrades = results.filter(r => r.success);
      expect(successfulTrades.length).toBeGreaterThan(0);
      expect(successfulTrades.length).toBeLessThanOrEqual(config.maxConcurrentPositions);

      const positions = executor.getActivePositions();
      expect(positions.length).toBe(successfulTrades.length);
    });

    it('should integrate NKN and Linear Regression analysis correctly', async () => {
      // Test with different market conditions
      const testScenarios = [
        {
          name: 'Strong Uptrend',
          priceData: generateTrendingPriceData(100, 40, 0.03),
          expectedBias: 'bullish'
        },
        {
          name: 'Strong Downtrend', 
          priceData: generateTrendingPriceData(100, 40, -0.03),
          expectedBias: 'bearish'
        },
        {
          name: 'Sideways Market',
          priceData: generateSidewaysData(100, 40, 2),
          expectedBias: 'neutral'
        }
      ];

      for (const scenario of testScenarios) {
        const volumeData = generateVolumeData(40, 1000, 0.1);
        
        // Analyze market conditions
        const conditions = await executor.analyzeMarketConditions(scenario.priceData, volumeData);
        
        expect(conditions.trend.directionalBias).toBe(scenario.expectedBias);
        expect(conditions.probability.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(conditions.probability.confidenceScore).toBeLessThanOrEqual(1);
        
        // Generate signal based on analysis
        const signal = await executor.generateQuickTradeSignal('BTCUSDT', scenario.priceData, volumeData);
        
        if (signal) {
          expect(signal.action).toMatch(/enter_(long|short)/);
          expect(signal.confidence).toBeGreaterThan(0);
        }
      }
    });

    it('should properly manage hedge mode activation', async () => {
      // Create volatile market data that should trigger hedge mode
      const volatilePriceData = generateVolatileData(100, 30, 0.05);
      const volumeData = generateVolumeData(30, 1000, 0.2);

      await executor.start();

      let hedgeActivated = false;
      executor.on('hedgeActivated', () => {
        hedgeActivated = true;
      });

      // Generate and execute initial position
      const signal = await executor.generateQuickTradeSignal('BTCUSDT', volatilePriceData, volumeData);
      
      if (signal) {
        const result = await executor.executeQuickTrade(signal);
        expect(result.success).toBe(true);

        // Wait for hedge activation delay plus processing time
        await new Promise(resolve => setTimeout(resolve, 1500));

        const positions = executor.getActivePositions();
        
        // Check if hedge was activated (positions might be linked)
        const hedgedPositions = positions.filter(p => p.hedgePositionId);
        
        if (hedgeActivated) {
          expect(hedgedPositions.length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle rapid signal generation and execution', async () => {
      const priceData = generateTrendingPriceData(100, 50, 0.02);
      const volumeData = generateVolumeData(50, 1000, 0.1);

      await executor.start();

      // Generate multiple rapid signals
      const signalPromises = [];
      for (let i = 0; i < 5; i++) {
        signalPromises.push(
          executor.generateQuickTradeSignal(`SYMBOL${i}`, priceData, volumeData)
        );
      }

      const signals = (await Promise.all(signalPromises)).filter(s => s !== null) as QuickTradeSignal[];
      
      // Add all signals to queue rapidly
      signals.forEach(signal => executor.addSignalToQueue(signal));

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify queue was processed
      expect(executor.getQueueLength()).toBeLessThan(signals.length);
    });

    it('should maintain risk limits across multiple trades', async () => {
      const priceData = generateTrendingPriceData(100, 30, 0.01);
      const volumeData = generateVolumeData(30, 1000, 0.1);

      await executor.start();

      // Execute trades up to risk limits
      const maxTrades = config.maxConcurrentPositions * 2;
      const tradePromises = [];

      for (let i = 0; i < maxTrades; i++) {
        const signal = await executor.generateQuickTradeSignal(`SYMBOL${i}`, priceData, volumeData);
        if (signal) {
          tradePromises.push(executor.executeQuickTrade(signal));
        }
      }

      const results = await Promise.all(tradePromises);
      const successfulTrades = results.filter(r => r.success);

      // Should not exceed maximum concurrent positions
      expect(successfulTrades.length).toBeLessThanOrEqual(config.maxConcurrentPositions);

      // Verify risk metrics
      const riskMetrics = executor.getRiskMetrics();
      expect(riskMetrics.totalExposure).toBeLessThanOrEqual(
        config.maxPositionSize * config.maxConcurrentPositions
      );
    });

    it('should handle position lifecycle from entry to exit', async () => {
      const priceData = generateTrendingPriceData(100, 25, 0.02);
      const volumeData = generateVolumeData(25, 1000, 0.1);

      await executor.start();

      let positionClosed = false;
      let closedPosition: any = null;

      executor.on('positionClosed', (data) => {
        positionClosed = true;
        closedPosition = data;
      });

      // Generate signal with close target/stop levels
      const signal = await executor.generateQuickTradeSignal('BTCUSDT', priceData, volumeData);
      
      if (signal) {
        // Modify signal to have close target for testing
        signal.targetPrice = signal.action === 'enter_long' ? 
          priceData[priceData.length - 1] * 1.01 : 
          priceData[priceData.length - 1] * 0.99;

        const result = await executor.executeQuickTrade(signal);
        expect(result.success).toBe(true);

        // Wait for position management cycles
        await new Promise(resolve => setTimeout(resolve, 500));

        if (positionClosed) {
          expect(closedPosition).toBeDefined();
          expect(closedPosition.reason).toBeDefined();
          expect(closedPosition.finalPnL).toBeDefined();
        }
      }
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle high-frequency signal generation', async () => {
      const priceData = generateTrendingPriceData(100, 100, 0.01);
      const volumeData = generateVolumeData(100, 1000, 0.1);

      const startTime = Date.now();
      
      // Generate many signals rapidly
      const signalPromises = [];
      for (let i = 0; i < 20; i++) {
        signalPromises.push(
          executor.generateQuickTradeSignal(`SYMBOL${i}`, priceData, volumeData)
        );
      }

      const signals = await Promise.all(signalPromises);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      const validSignals = signals.filter(s => s !== null);
      expect(validSignals.length).toBeGreaterThan(0);
    });

    it('should maintain performance under load', async () => {
      await executor.start();

      const priceData = generateTrendingPriceData(100, 50, 0.02);
      const volumeData = generateVolumeData(50, 1000, 0.1);

      const startTime = Date.now();
      const operations = [];

      // Perform multiple operations concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(executor.analyzeMarketConditions(priceData, volumeData));
        operations.push(executor.generateQuickTradeSignal(`SYMBOL${i}`, priceData, volumeData));
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
      expect(results.length).toBe(20);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from analysis errors', async () => {
      await executor.start();

      // Test with problematic data
      const problematicData = [NaN, Infinity, -Infinity, 0];
      const volumeData = [0, 0, 0, 0];

      // Should handle errors gracefully
      await expect(executor.analyzeMarketConditions(problematicData, volumeData))
        .rejects.toThrow();

      // Should still be able to process valid data after error
      const validPriceData = generateTrendingPriceData(100, 20, 0.01);
      const validVolumeData = generateVolumeData(20, 1000, 0.1);

      const conditions = await executor.analyzeMarketConditions(validPriceData, validVolumeData);
      expect(conditions).toBeDefined();
    });

    it('should handle execution failures gracefully', async () => {
      await executor.start();

      const priceData = generateTrendingPriceData(100, 20, 0.01);
      const volumeData = generateVolumeData(20, 1000, 0.1);
      const conditions = await executor.analyzeMarketConditions(priceData, volumeData);

      // Create invalid signal
      const invalidSignal: QuickTradeSignal = {
        id: 'invalid-signal',
        symbol: '',
        action: 'enter_long',
        confidence: -1,
        urgency: 'medium',
        positionSize: -100,
        targetPrice: 0,
        stopLoss: 0,
        timeToLive: 0,
        marketConditions: conditions,
        nknAnalysis: conditions.probability,
        regressionAnalysis: conditions.trend
      };

      const result = await executor.executeQuickTrade(invalidSignal);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Should still be able to execute valid trades
      const validSignal = await executor.generateQuickTradeSignal('BTCUSDT', priceData, volumeData);
      if (validSignal) {
        const validResult = await executor.executeQuickTrade(validSignal);
        expect(validResult.success).toBe(true);
      }
    });
  });

  // Helper functions for generating test data
  function generateTrendingPriceData(startPrice: number, length: number, trendStrength: number): number[] {
    const data = [startPrice];
    for (let i = 1; i < length; i++) {
      const trend = trendStrength * i;
      const noise = (Math.random() - 0.5) * 0.01 * startPrice;
      data.push(startPrice + trend * startPrice + noise);
    }
    return data;
  }

  function generateSidewaysData(centerPrice: number, length: number, range: number): number[] {
    const data = [];
    for (let i = 0; i < length; i++) {
      const noise = (Math.random() - 0.5) * range;
      data.push(centerPrice + noise);
    }
    return data;
  }

  function generateVolatileData(startPrice: number, length: number, volatility: number): number[] {
    const data = [startPrice];
    for (let i = 1; i < length; i++) {
      const change = (Math.random() - 0.5) * volatility * startPrice;
      data.push(Math.max(0.01, data[i-1] + change));
    }
    return data;
  }

  function generateVolumeData(length: number, baseVolume: number, volatility: number): number[] {
    const data = [];
    for (let i = 0; i < length; i++) {
      const variation = (Math.random() - 0.5) * volatility * baseVolume;
      data.push(Math.max(1, baseVolume + variation));
    }
    return data;
  }
});