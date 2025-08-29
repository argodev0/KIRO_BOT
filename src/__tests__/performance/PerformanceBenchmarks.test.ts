import { MarketDataFactory } from '../../test/factories/MarketDataFactory';
import { TradingDataFactory } from '../../test/factories/TradingDataFactory';
import { TechnicalAnalysisService } from '../../services/TechnicalAnalysisService';
import { PatternRecognitionService } from '../../services/PatternRecognitionService';
import { SignalEngine } from '../../services/SignalEngine';
import { ElliottWaveService } from '../../services/ElliottWaveService';
import { FibonacciService } from '../../services/FibonacciService';

describe('Performance Benchmarks', () => {
  let technicalAnalysis: TechnicalAnalysisService;

  let signalEngine: SignalEngine;
  let elliottWave: ElliottWaveService;
  let fibonacci: FibonacciService;

  beforeEach(() => {
    technicalAnalysis = new TechnicalAnalysisService();
    signalEngine = new SignalEngine();
    elliottWave = new ElliottWaveService();
    fibonacci = new FibonacciService();
  });

  describe('Technical Analysis Performance', () => {
    it('should calculate indicators within performance thresholds', async () => {
      const candles = MarketDataFactory.createCandles({ count: 1000 });
      
      const startTime = performance.now();
      await technicalAnalysis.calculateIndicators(candles, ['rsi', 'macd', 'waveTrend']);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Should complete within 100ms for 1000 candles
      expect(executionTime).toBeLessThan(100);
      
      console.log(`Technical Analysis (1000 candles): ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large datasets efficiently', async () => {
      const candles = MarketDataFactory.createCandles({ count: 10000 });
      
      const startTime = performance.now();
      await technicalAnalysis.calculateIndicators(candles, ['rsi', 'macd', 'waveTrend', 'pvt']);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Should complete within 500ms for 10000 candles
      expect(executionTime).toBeLessThan(500);
      
      console.log(`Technical Analysis (10000 candles): ${executionTime.toFixed(2)}ms`);
    });

    it('should maintain consistent performance across multiple runs', async () => {
      const candles = MarketDataFactory.createCandles({ count: 1000 });
      const executionTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await technicalAnalysis.calculateIndicators(candles, ['rsi', 'macd']);
        const endTime = performance.now();
        executionTimes.push(endTime - startTime);
      }
      
      const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      
      // Variance should be reasonable (max should not be more than 3x min)
      expect(maxTime / minTime).toBeLessThan(3);
      
      console.log(`Technical Analysis consistency - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });
  });

  describe('Pattern Recognition Performance', () => {
    it('should detect patterns within performance thresholds', async () => {
      const candles = MarketDataFactory.createCandles({ 
        count: 500,
        pattern: 'candlestick'
      });
      
      const startTime = performance.now();
      await PatternRecognitionService.detectPatterns(candles);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Should complete within 50ms for 500 candles
      expect(executionTime).toBeLessThan(50);
      
      console.log(`Pattern Recognition (500 candles): ${executionTime.toFixed(2)}ms`);
    });

    it('should scale linearly with data size', async () => {
      const sizes = [100, 500, 1000, 2000];
      const times: number[] = [];
      
      for (const size of sizes) {
        const candles = MarketDataFactory.createCandles({ count: size });
        
        const startTime = performance.now();
        await PatternRecognitionService.detectPatterns(candles);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
      }
      
      // Check that performance scales reasonably (not exponentially)
      const ratio2000to100 = times[3] / times[0];
      expect(ratio2000to100).toBeLessThan(30); // Should be less than 30x slower for 20x data
      
      console.log(`Pattern Recognition scaling: ${sizes.map((size, i) => `${size}: ${times[i].toFixed(2)}ms`).join(', ')}`);
    });
  });

  describe('Elliott Wave Analysis Performance', () => {
    it('should analyze wave structures efficiently', async () => {
      const candles = MarketDataFactory.createElliottWaveData({
        waveType: 'impulse',
        degree: 'minor',
        currentWave: 3,
        basePrice: 50000,
        waveHeight: 2000
      });
      
      const startTime = performance.now();
      await elliottWave.analyzeWaveStructure(candles);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Should complete within 200ms
      expect(executionTime).toBeLessThan(200);
      
      console.log(`Elliott Wave Analysis: ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Fibonacci Calculation Performance', () => {
    it('should calculate fibonacci levels quickly', async () => {
      const high = 55000;
      const low = 45000;
      
      const startTime = performance.now();
      
      // Calculate multiple fibonacci scenarios
      for (let i = 0; i < 100; i++) {
        fibonacci.calculateRetracements({ high: high + i * 10, low: low + i * 5 });
        fibonacci.calculateExtensions({ startPrice: low, endPrice: high } as any, { startPrice: high, endPrice: low } as any);
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete 100 calculations within 50ms
      expect(executionTime).toBeLessThan(50);
      
      console.log(`Fibonacci Calculations (100 iterations): ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Signal Generation Performance', () => {
    it('should generate signals within latency requirements', async () => {
      const analysisResults = TradingDataFactory.createAnalysisResults();
      
      const startTime = performance.now();
      await signalEngine.generateSignal('BTCUSDT', analysisResults, MarketDataFactory.createCandles({ count: 100 }));
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Should complete within 10ms for real-time requirements
      expect(executionTime).toBeLessThan(10);
      
      console.log(`Signal Generation: ${executionTime.toFixed(2)}ms`);
    });

    it('should handle concurrent signal generation', async () => {
      const analysisResults = Array.from({ length: 10 }, () => 
        TradingDataFactory.createAnalysisResults()
      );
      
      const startTime = performance.now();
      
      const promises = analysisResults.map(analysis => 
        signalEngine.generateSignal('BTCUSDT', analysis, MarketDataFactory.createCandles({ count: 100 }))
      );
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete 10 concurrent signals within 50ms
      expect(executionTime).toBeLessThan(50);
      
      console.log(`Concurrent Signal Generation (10 signals): ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should not leak memory during continuous processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process data continuously
      for (let i = 0; i < 100; i++) {
        const candles = MarketDataFactory.createCandles({ count: 100 });
        await technicalAnalysis.calculateIndicators(candles, ['rsi', 'macd']);
        
        // Force garbage collection periodically
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory usage - Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should maintain high throughput for market data processing', async () => {
      const batchSize = 1000;
      const batches = 10;
      
      const startTime = performance.now();
      
      for (let i = 0; i < batches; i++) {
        const candles = MarketDataFactory.createCandles({ count: batchSize });
        await technicalAnalysis.calculateIndicators(candles, ['rsi']);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const totalCandles = batchSize * batches;
      const throughput = totalCandles / (totalTime / 1000); // candles per second
      
      // Should process at least 10,000 candles per second
      expect(throughput).toBeGreaterThan(10000);
      
      console.log(`Market Data Throughput: ${throughput.toFixed(0)} candles/second`);
    });

    it('should maintain signal generation throughput', async () => {
      const signalCount = 100;
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: signalCount }, async () => {
        const analysis = TradingDataFactory.createAnalysisResults();
        return signalEngine.generateSignal('BTCUSDT', analysis, MarketDataFactory.createCandles({ count: 100 }));
      });
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const throughput = signalCount / (totalTime / 1000); // signals per second
      
      // Should generate at least 100 signals per second
      expect(throughput).toBeGreaterThan(100);
      
      console.log(`Signal Generation Throughput: ${throughput.toFixed(0)} signals/second`);
    });
  });
});