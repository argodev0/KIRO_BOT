/**
 * Technical Analysis Service Tests
 * Comprehensive tests for the technical analysis calculation engine
 */

import { TechnicalAnalysisService } from '../../services/TechnicalAnalysisService';
import { CandleData } from '../../types/market';
import { AnalysisConfig } from '../../types/analysis';

describe('TechnicalAnalysisService', () => {
  let service: TechnicalAnalysisService;
  let mockCandles: CandleData[];

  beforeEach(() => {
    service = new TechnicalAnalysisService();
    mockCandles = generateMockCandles(100);
  });

  describe('calculateIndicators', () => {
    it('should calculate all indicators successfully', async () => {
      const results = await service.calculateIndicators(mockCandles);

      expect(results).toBeDefined();
      expect(results.rsi).toHaveLength(mockCandles.length - 14); // RSI period
      expect(results.waveTrend).toHaveLength(expect.any(Number));
      expect(results.pvt).toHaveLength(mockCandles.length);
      expect(results.supportLevels).toBeInstanceOf(Array);
      expect(results.resistanceLevels).toBeInstanceOf(Array);
    });

    it('should calculate specific indicators when requested', async () => {
      const results = await service.calculateIndicators(mockCandles, ['rsi', 'pvt']);

      expect(results.rsi).toHaveLength(expect.any(Number));
      expect(results.pvt).toHaveLength(expect.any(Number));
      expect(results.waveTrend).toHaveLength(0);
    });

    it('should throw error with insufficient data', async () => {
      const shortCandles = generateMockCandles(10);

      await expect(service.calculateIndicators(shortCandles))
        .rejects.toThrow('Insufficient candle data');
    });

    it('should validate candle data', async () => {
      const invalidCandles = [
        { ...mockCandles[0], high: -1 }, // Invalid high
        ...mockCandles.slice(1),
      ];

      await expect(service.calculateIndicators(invalidCandles))
        .rejects.toThrow('Invalid candle data');
    });
  });

  describe('getCurrentIndicators', () => {
    it('should return current technical indicators', async () => {
      const indicators = await service.getCurrentIndicators(mockCandles);

      expect(indicators).toBeDefined();
      expect(indicators.rsi).toBeGreaterThanOrEqual(0);
      expect(indicators.rsi).toBeLessThanOrEqual(100);
      expect(indicators.waveTrend).toBeDefined();
      expect(typeof indicators.waveTrend.wt1).toBe('number');
      expect(typeof indicators.waveTrend.wt2).toBe('number');
      expect(typeof indicators.pvt).toBe('number');
      expect(indicators.trend).toMatch(/^(bullish|bearish|sideways)$/);
      expect(indicators.momentum).toMatch(/^(strong|weak|neutral)$/);
      expect(indicators.volatility).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectSupportResistance', () => {
    it('should detect support and resistance levels', async () => {
      const levels = await service.detectSupportResistance(mockCandles);

      expect(levels).toBeInstanceOf(Array);
      levels.forEach(level => {
        expect(level.price).toBeGreaterThan(0);
        expect(level.strength).toBeGreaterThanOrEqual(0);
        expect(level.strength).toBeLessThanOrEqual(1);
        expect(level.type).toMatch(/^(support|resistance)$/);
        expect(level.touches).toBeGreaterThanOrEqual(1);
        expect(level.lastTouch).toBeGreaterThan(0);
      });
    });
  });

  describe('classifyMarketRegime', () => {
    it('should classify market regime', async () => {
      const regime = await service.classifyMarketRegime(mockCandles);

      expect(regime).toBeDefined();
      expect(regime.type).toMatch(/^(trending|ranging|breakout|reversal)$/);
      expect(regime.strength).toBeGreaterThanOrEqual(0);
      expect(regime.strength).toBeLessThanOrEqual(1);
      expect(regime.volatility).toMatch(/^(low|medium|high)$/);
      expect(regime.volume).toMatch(/^(low|medium|high)$/);
      expect(regime.confidence).toBeGreaterThanOrEqual(0);
      expect(regime.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('getMultiTimeframeAnalysis', () => {
    it('should perform multi-timeframe analysis', async () => {
      const candlesByTimeframe = {
        '1h': generateMockCandles(50),
        '4h': generateMockCandles(30),
        '1d': generateMockCandles(20),
      } as Record<string, CandleData[]>;

      const analysis = await service.getMultiTimeframeAnalysis('BTCUSDT', candlesByTimeframe);

      expect(analysis).toBeDefined();
      expect(analysis.symbol).toBe('BTCUSDT');
      expect(analysis.timeframes).toBeDefined();
      expect(analysis.consensus).toBeDefined();
      expect(analysis.consensus.direction).toMatch(/^(bullish|bearish|neutral)$/);
      expect(analysis.consensus.strength).toBeGreaterThanOrEqual(0);
      expect(analysis.consensus.strength).toBeLessThanOrEqual(1);
      expect(analysis.consensus.confluence).toBeGreaterThanOrEqual(0);
      expect(analysis.consensus.confluence).toBeLessThanOrEqual(1);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig: Partial<AnalysisConfig> = {
        indicators: {
          rsi: { period: 21, overbought: 75, oversold: 25 },
          waveTrend: { n1: 12, n2: 24 },
          pvt: { period: 20 },
        },
      };

      service.updateConfig(newConfig);
      const config = service.getConfig();

      expect(config.indicators.rsi.period).toBe(21);
      expect(config.indicators.rsi.overbought).toBe(75);
      expect(config.indicators.rsi.oversold).toBe(25);
    });

    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config).toBeDefined();
      expect(config.indicators).toBeDefined();
      expect(config.indicators.rsi).toBeDefined();
      expect(config.indicators.waveTrend).toBeDefined();
      expect(config.indicators.pvt).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle empty candle array', async () => {
      await expect(service.calculateIndicators([]))
        .rejects.toThrow('No candle data provided');
    });

    it('should handle null/undefined input', async () => {
      await expect(service.calculateIndicators(null as any))
        .rejects.toThrow('No candle data provided');
    });

    it('should handle malformed candle data', async () => {
      const malformedCandles = [
        { symbol: 'BTCUSDT', timestamp: Date.now() } as any,
        ...mockCandles.slice(1),
      ];

      await expect(service.calculateIndicators(malformedCandles))
        .rejects.toThrow('Invalid candle data');
    });
  });
});

/**
 * Generate mock candle data for testing
 */
function generateMockCandles(count: number, basePrice: number = 50000): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = basePrice;
  const startTime = Date.now() - (count * 60 * 60 * 1000); // 1 hour intervals

  for (let i = 0; i < count; i++) {
    // Generate realistic price movement
    const change = (Math.random() - 0.5) * 0.02; // ±1% change
    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = 1000000 + Math.random() * 5000000;

    candles.push({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

