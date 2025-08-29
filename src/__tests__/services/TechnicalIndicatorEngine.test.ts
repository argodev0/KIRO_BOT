/**
 * Technical Indicator Engine Tests
 */

import { TechnicalIndicatorEngine } from '../../services/TechnicalIndicatorEngine';
import { MarketDataService } from '../../services/MarketDataService';
import { CandleData, Timeframe } from '../../types/market';

// Mock MarketDataService
jest.mock('../../services/MarketDataService');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
  })),
}));

describe('TechnicalIndicatorEngine', () => {
  let engine: TechnicalIndicatorEngine;
  let mockMarketDataService: jest.Mocked<MarketDataService>;
  let mockCandles: CandleData[];

  beforeEach(() => {
    mockMarketDataService = new MarketDataService({} as any, {} as any) as jest.Mocked<MarketDataService>;
    
    const config = {
      redis: { host: 'localhost', port: 6379, db: 0 },
      caching: { ttl: 300, maxCandleHistory: 1000 },
      calculation: { batchSize: 100, updateInterval: 5000, enableRealtime: false },
      timeframes: ['1m', '5m', '15m', '1h'] as Timeframe[],
    };
    
    engine = new TechnicalIndicatorEngine(mockMarketDataService, config);
    
    // Create mock candle data
    mockCandles = [];
    for (let i = 0; i < 100; i++) {
      mockCandles.push({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now() + i * 3600000,
        open: 100 + i * 0.1,
        high: 101 + i * 0.1,
        low: 99 + i * 0.1,
        close: 100.5 + i * 0.1,
        volume: 1000,
      });
    }
    
    mockMarketDataService.getHistoricalCandles = jest.fn().mockResolvedValue(mockCandles);
  });

  describe('calculateIndicators', () => {
    it('should calculate all indicators correctly', async () => {
      const result = await engine.calculateIndicators('BTCUSDT', '1h', 100, false);
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.timeframe).toBe('1h');
      expect(result).toHaveProperty('rsi');
      expect(result).toHaveProperty('macd');
      expect(result).toHaveProperty('bollingerBands');
      expect(result).toHaveProperty('candles');
      
      // Verify RSI result
      expect(result.rsi).toHaveProperty('value');
      expect(result.rsi).toHaveProperty('signal');
      expect(typeof result.rsi.value).toBe('number');
      
      // Verify MACD result
      expect(result.macd).toHaveProperty('macd');
      expect(result.macd).toHaveProperty('signal');
      expect(result.macd).toHaveProperty('histogram');
      
      // Verify Bollinger Bands result
      expect(result.bollingerBands).toHaveProperty('upperBand');
      expect(result.bollingerBands).toHaveProperty('middleBand');
      expect(result.bollingerBands).toHaveProperty('lowerBand');
    });

    it('should throw error with insufficient data', async () => {
      const shortCandles = mockCandles.slice(0, 20);
      mockMarketDataService.getHistoricalCandles.mockResolvedValue(shortCandles);
      
      await expect(engine.calculateIndicators('BTCUSDT', '1h')).rejects.toThrow(
        'Insufficient candle data'
      );
    });
  });

  describe('getMultiTimeframeIndicators', () => {
    it('should calculate indicators for multiple timeframes', async () => {
      const timeframes: Timeframe[] = ['1m', '5m', '1h'];
      const result = await engine.getMultiTimeframeIndicators('BTCUSDT', timeframes, false);
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.timeframes).toBeDefined();
      
      // Should have results for each timeframe
      timeframes.forEach(tf => {
        if (result.timeframes[tf]) {
          expect(result.timeframes[tf]).toHaveProperty('rsi');
          expect(result.timeframes[tf]).toHaveProperty('macd');
          expect(result.timeframes[tf]).toHaveProperty('bollingerBands');
        }
      });
    });
  });

  describe('getIndicatorAnalysis', () => {
    it('should provide comprehensive analysis of indicators', async () => {
      const indicatorResults = await engine.calculateIndicators('BTCUSDT', '1h', 100, false);
      const analysis = engine.getIndicatorAnalysis(indicatorResults);
      
      expect(analysis).toHaveProperty('rsi');
      expect(analysis).toHaveProperty('macd');
      expect(analysis).toHaveProperty('bollingerBands');
      expect(analysis).toHaveProperty('consensus');
      
      // Check RSI analysis
      expect(analysis.rsi).toHaveProperty('signal');
      expect(analysis.rsi).toHaveProperty('strength');
      expect(analysis.rsi).toHaveProperty('description');
      
      // Check consensus
      expect(analysis.consensus).toHaveProperty('signal');
      expect(analysis.consensus).toHaveProperty('strength');
      expect(analysis.consensus).toHaveProperty('confidence');
      expect(['buy', 'sell', 'neutral']).toContain(analysis.consensus.signal);
    });
  });

  describe('subscriptions', () => {
    it('should handle symbol subscriptions correctly', async () => {
      await engine.subscribeToSymbol('BTCUSDT', ['1h']);
      
      const stats = engine.getCacheStats();
      expect(stats.subscriptions).toBe(1);
      expect(stats.activeTimers).toBe(1);
      
      engine.unsubscribeFromSymbol('BTCUSDT', ['1h']);
      
      const statsAfter = engine.getCacheStats();
      expect(statsAfter.subscriptions).toBe(0);
      expect(statsAfter.activeTimers).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should update indicator configuration', () => {
      const newConfig = {
        rsi: { period: 21, overbought: 75, oversold: 25 },
        macd: { fastPeriod: 10, slowPeriod: 20, signalPeriod: 7 },
      };
      
      engine.updateIndicatorConfig(newConfig);
      const config = engine.getConfig();
      
      expect(config.indicators.rsi.period).toBe(21);
      expect(config.indicators.macd.fastPeriod).toBe(10);
    });

    it('should provide cache statistics', () => {
      const stats = engine.getCacheStats();
      
      expect(stats).toHaveProperty('indicatorCacheSize');
      expect(stats).toHaveProperty('candleCacheSize');
      expect(stats).toHaveProperty('subscriptions');
      expect(stats).toHaveProperty('activeTimers');
      
      expect(typeof stats.indicatorCacheSize).toBe('number');
      expect(typeof stats.candleCacheSize).toBe('number');
    });
  });
});