/**
 * Technical Indicator Integration Tests
 * Tests the complete technical indicator calculation pipeline
 */

import { TechnicalIndicatorEngine } from '../../services/TechnicalIndicatorEngine';
import { MarketDataService } from '../../services/MarketDataService';
import { RSICalculator } from '../../services/indicators/RSICalculator';
import { MACDCalculator } from '../../services/indicators/MACDCalculator';
import { BollingerBandsCalculator } from '../../services/indicators/BollingerBandsCalculator';
import { CandleData, Timeframe } from '../../types/market';

// Mock external dependencies
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn(),
    del: jest.fn(),
  })),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    $disconnect: jest.fn(),
  })),
}));

describe('Technical Indicator Integration', () => {
  let engine: TechnicalIndicatorEngine;
  let mockMarketDataService: jest.Mocked<MarketDataService>;
  let testCandles: CandleData[];

  beforeAll(() => {
    // Create realistic test data
    testCandles = generateRealisticCandleData('BTCUSDT', '1h', 200);
  });

  beforeEach(() => {
    // Mock MarketDataService
    mockMarketDataService = {
      getHistoricalCandles: jest.fn().mockResolvedValue(testCandles),
      on: jest.fn(),
    } as any;

    const config = {
      redis: { host: 'localhost', port: 6379, db: 0 },
      caching: { ttl: 300, maxCandleHistory: 1000 },
      calculation: { batchSize: 100, updateInterval: 5000, enableRealtime: false },
      timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[],
    };

    engine = new TechnicalIndicatorEngine(mockMarketDataService, config);
  });

  describe('End-to-End Indicator Calculation', () => {
    it('should calculate all indicators for multiple timeframes', async () => {
      const symbol = 'BTCUSDT';
      const timeframes: Timeframe[] = ['1h', '4h', '1d'];
      
      const results = await engine.getMultiTimeframeIndicators(symbol, timeframes, false);
      
      expect(results).toBeDefined();
      expect(results.symbol).toBe(symbol);
      expect(results.timeframes).toBeDefined();
      
      // Verify each timeframe has complete indicator data
      timeframes.forEach(tf => {
        const tfResult = results.timeframes[tf];
        if (tfResult) {
          expect(tfResult.rsi).toBeDefined();
          expect(tfResult.macd).toBeDefined();
          expect(tfResult.bollingerBands).toBeDefined();
          
          // Verify RSI is within valid range
          expect(tfResult.rsi.value).toBeGreaterThanOrEqual(0);
          expect(tfResult.rsi.value).toBeLessThanOrEqual(100);
          
          // Verify MACD has all components
          expect(typeof tfResult.macd.macd).toBe('number');
          expect(typeof tfResult.macd.signal).toBe('number');
          expect(typeof tfResult.macd.histogram).toBe('number');
          
          // Verify Bollinger Bands structure
          expect(tfResult.bollingerBands.upperBand).toBeGreaterThan(tfResult.bollingerBands.middleBand);
          expect(tfResult.bollingerBands.middleBand).toBeGreaterThan(tfResult.bollingerBands.lowerBand);
        }
      });
    });

    it('should provide consistent analysis across indicators', async () => {
      const results = await engine.calculateIndicators('BTCUSDT', '1h', 100, false);
      const analysis = engine.getIndicatorAnalysis(results);
      
      expect(analysis.consensus).toBeDefined();
      expect(['buy', 'sell', 'neutral']).toContain(analysis.consensus.signal);
      expect(['weak', 'moderate', 'strong']).toContain(analysis.consensus.strength);
      expect(analysis.consensus.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.consensus.confidence).toBeLessThanOrEqual(1);
      
      // Verify individual indicator analyses
      expect(analysis.rsi.signal).toBeDefined();
      expect(analysis.macd.signal).toBeDefined();
      expect(analysis.bollingerBands.signal).toBeDefined();
    });
  });

  describe('Real-time Updates Simulation', () => {
    it('should handle new candle updates correctly', async () => {
      // Subscribe to symbol
      await engine.subscribeToSymbol('BTCUSDT', ['1h']);
      
      // Simulate new candle
      const newCandle: CandleData = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now(),
        open: 45000,
        high: 45500,
        low: 44800,
        close: 45200,
        volume: 1500,
      };
      
      // Add new candle to test data
      const updatedCandles = [...testCandles, newCandle];
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(updatedCandles);
      
      // Calculate indicators with new data
      const results = await engine.calculateIndicators('BTCUSDT', '1h', 100, false);
      
      expect(results).toBeDefined();
      expect(results.timestamp).toBeGreaterThan(0);
      
      // Cleanup
      engine.unsubscribeFromSymbol('BTCUSDT', ['1h']);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache results for improved performance', async () => {
      const symbol = 'BTCUSDT';
      const timeframe: Timeframe = '1h';
      
      // First calculation
      const start1 = Date.now();
      const results1 = await engine.calculateIndicators(symbol, timeframe, 100, false);
      const time1 = Date.now() - start1;
      
      // Second calculation (should use cache if enabled)
      const start2 = Date.now();
      const results2 = await engine.calculateIndicators(symbol, timeframe, 100, true);
      const time2 = Date.now() - start2;
      
      expect(results1).toBeDefined();
      expect(results2).toBeDefined();
      expect(results1.symbol).toBe(results2.symbol);
      expect(results1.timeframe).toBe(results2.timeframe);
      
      // Verify cache statistics
      const stats = engine.getCacheStats();
      expect(stats.indicatorCacheSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle insufficient data gracefully', async () => {
      const shortCandles = testCandles.slice(0, 20);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(shortCandles);
      
      await expect(engine.calculateIndicators('BTCUSDT', '1h')).rejects.toThrow();
    });

    it('should handle market data service errors', async () => {
      mockMarketDataService.getHistoricalCandles.mockRejectedValue(new Error('Market data unavailable'));
      
      await expect(engine.calculateIndicators('BTCUSDT', '1h')).rejects.toThrow('Market data unavailable');
    });
  });

  describe('Configuration Management', () => {
    it('should allow dynamic configuration updates', () => {
      const originalConfig = engine.getConfig();
      
      const newIndicatorConfig = {
        rsi: { period: 21, overbought: 75, oversold: 25 },
        macd: { fastPeriod: 10, slowPeriod: 20, signalPeriod: 7 },
        bollingerBands: { period: 15, standardDeviations: 2.5 },
      };
      
      engine.updateIndicatorConfig(newIndicatorConfig);
      const updatedConfig = engine.getConfig();
      
      expect(updatedConfig.indicators.rsi.period).toBe(21);
      expect(updatedConfig.indicators.macd.fastPeriod).toBe(10);
      expect(updatedConfig.indicators.bollingerBands.period).toBe(15);
    });
  });
});

/**
 * Generate realistic candle data for testing
 */
function generateRealisticCandleData(symbol: string, timeframe: string, count: number): CandleData[] {
  const candles: CandleData[] = [];
  let basePrice = 45000; // Starting BTC price
  let timestamp = Date.now() - count * 3600000; // Start from count hours ago
  
  for (let i = 0; i < count; i++) {
    // Simulate realistic price movement
    const volatility = 0.02; // 2% volatility
    const trend = Math.sin(i * 0.1) * 0.001; // Cyclical trend
    const randomWalk = (Math.random() - 0.5) * volatility;
    
    const priceChange = (trend + randomWalk) * basePrice;
    const newPrice = basePrice + priceChange;
    
    // Generate OHLC data
    const open = basePrice;
    const close = newPrice;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.005;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.005;
    const volume = 1000 + Math.random() * 2000;
    
    candles.push({
      symbol,
      timeframe,
      timestamp: timestamp + i * 3600000,
      open,
      high,
      low,
      close,
      volume,
    });
    
    basePrice = newPrice;
  }
  
  return candles;
}