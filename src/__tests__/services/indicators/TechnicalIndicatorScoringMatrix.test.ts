/**
 * Technical Indicator Scoring Matrix Tests
 */

import { TechnicalIndicatorScoringMatrix, IndicatorMatrix, IndicatorScore } from '../../../services/indicators/TechnicalIndicatorScoringMatrix';
import { CandleData } from '../../../types/market';
import { TechnicalIndicators } from '../../../types/analysis';

describe('TechnicalIndicatorScoringMatrix', () => {
  let scoringMatrix: TechnicalIndicatorScoringMatrix;
  let mockCandles: CandleData[];
  let mockIndicators: TechnicalIndicators;
  let mockHistoricalIndicators: TechnicalIndicators[];

  beforeEach(() => {
    scoringMatrix = new TechnicalIndicatorScoringMatrix();
    
    // Create mock candle data
    mockCandles = [];
    for (let i = 0; i < 50; i++) {
      mockCandles.push({
        symbol: 'BTCUSDT',
        timeframe: '1m',
        timestamp: Date.now() - (50 - i) * 60000,
        open: 100 + Math.random() * 2,
        high: 102 + Math.random() * 2,
        low: 98 + Math.random() * 2,
        close: 100 + Math.random() * 2,
        volume: 1000000 + Math.random() * 500000,
      });
    }

    // Create mock current indicators
    mockIndicators = {
      rsi: 65,
      waveTrend: {
        wt1: -45,
        wt2: -30,
        signal: 'buy',
        divergence: null,
      },
      pvt: 1500000,
      supportLevels: [98, 95, 92],
      resistanceLevels: [105, 108, 112],
      trend: 'bullish',
      momentum: 'strong',
      volatility: 0.25,
    };

    // Create mock historical indicators
    mockHistoricalIndicators = [];
    for (let i = 0; i < 30; i++) {
      mockHistoricalIndicators.push({
        rsi: 50 + Math.random() * 40,
        waveTrend: {
          wt1: -60 + Math.random() * 120,
          wt2: -60 + Math.random() * 120,
          signal: Math.random() > 0.5 ? 'buy' : Math.random() > 0.5 ? 'sell' : 'neutral',
          divergence: Math.random() > 0.8 ? 'bullish' : Math.random() > 0.9 ? 'bearish' : null,
        },
        pvt: 1000000 + Math.random() * 1000000,
        supportLevels: [95 + Math.random() * 5],
        resistanceLevels: [105 + Math.random() * 5],
        trend: Math.random() > 0.5 ? 'bullish' : Math.random() > 0.5 ? 'bearish' : 'sideways',
        momentum: Math.random() > 0.5 ? 'strong' : Math.random() > 0.5 ? 'weak' : 'neutral',
        volatility: 0.1 + Math.random() * 0.4,
      });
    }
  });

  describe('calculateScoringMatrix', () => {
    it('should calculate comprehensive scoring matrix', async () => {
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        mockIndicators,
        mockHistoricalIndicators
      );

      expect(matrix).toBeDefined();
      expect(matrix).toHaveProperty('timestamp');
      expect(matrix).toHaveProperty('symbol');
      expect(matrix).toHaveProperty('scores');
      expect(matrix).toHaveProperty('correlationMatrix');
      expect(matrix).toHaveProperty('overallScore');
      expect(matrix).toHaveProperty('dominantSignal');
      expect(matrix).toHaveProperty('confidence');
      expect(matrix).toHaveProperty('divergences');

      expect(matrix.symbol).toBe('BTCUSDT');
      expect(Array.isArray(matrix.scores)).toBe(true);
      expect(matrix.scores.length).toBeGreaterThan(0);
      expect(['bullish', 'bearish', 'neutral']).toContain(matrix.dominantSignal);
      expect(matrix.overallScore).toBeGreaterThanOrEqual(0);
      expect(matrix.overallScore).toBeLessThanOrEqual(1);
      expect(matrix.confidence).toBeGreaterThanOrEqual(0);
      expect(matrix.confidence).toBeLessThanOrEqual(1);
    });

    it('should validate individual indicator scores', async () => {
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        mockIndicators,
        mockHistoricalIndicators
      );

      matrix.scores.forEach(score => {
        expect(score).toHaveProperty('indicator');
        expect(score).toHaveProperty('score');
        expect(score).toHaveProperty('signal');
        expect(score).toHaveProperty('strength');
        expect(score).toHaveProperty('confidence');
        expect(score).toHaveProperty('reasoning');

        expect(typeof score.indicator).toBe('string');
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(1);
        expect(['bullish', 'bearish', 'neutral']).toContain(score.signal);
        expect(['weak', 'moderate', 'strong']).toContain(score.strength);
        expect(score.confidence).toBeGreaterThanOrEqual(0);
        expect(score.confidence).toBeLessThanOrEqual(1);
        expect(Array.isArray(score.reasoning)).toBe(true);
      });
    });

    it('should calculate correlation matrix', async () => {
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        mockIndicators,
        mockHistoricalIndicators
      );

      const correlationMatrix = matrix.correlationMatrix;
      
      expect(correlationMatrix).toHaveProperty('pairs');
      expect(correlationMatrix).toHaveProperty('averageCorrelation');
      expect(correlationMatrix).toHaveProperty('strongCorrelations');
      expect(correlationMatrix).toHaveProperty('weakCorrelations');

      expect(Array.isArray(correlationMatrix.pairs)).toBe(true);
      expect(correlationMatrix.averageCorrelation).toBeGreaterThanOrEqual(-1);
      expect(correlationMatrix.averageCorrelation).toBeLessThanOrEqual(1);
      expect(Array.isArray(correlationMatrix.strongCorrelations)).toBe(true);
      expect(Array.isArray(correlationMatrix.weakCorrelations)).toBe(true);

      correlationMatrix.pairs.forEach(pair => {
        expect(pair).toHaveProperty('indicator1');
        expect(pair).toHaveProperty('indicator2');
        expect(pair).toHaveProperty('correlation');
        expect(pair).toHaveProperty('strength');
        expect(pair).toHaveProperty('agreement');

        expect(pair.correlation).toBeGreaterThanOrEqual(-1);
        expect(pair.correlation).toBeLessThanOrEqual(1);
        expect(['weak', 'moderate', 'strong']).toContain(pair.strength);
        expect(typeof pair.agreement).toBe('boolean');
      });
    });

    it('should detect divergences', async () => {
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        mockIndicators,
        mockHistoricalIndicators
      );

      expect(Array.isArray(matrix.divergences)).toBe(true);

      matrix.divergences.forEach(divergence => {
        expect(divergence).toHaveProperty('indicator');
        expect(divergence).toHaveProperty('type');
        expect(divergence).toHaveProperty('strength');
        expect(divergence).toHaveProperty('priceAction');
        expect(divergence).toHaveProperty('indicatorAction');

        expect(['bullish', 'bearish']).toContain(divergence.type);
        expect(divergence.strength).toBeGreaterThanOrEqual(0);
        expect(divergence.strength).toBeLessThanOrEqual(1);
        expect(['higher_highs', 'lower_lows', 'higher_lows', 'lower_highs']).toContain(divergence.priceAction);
        expect(['rising', 'falling', 'flat']).toContain(divergence.indicatorAction);
      });
    });
  });

  describe('RSI scoring', () => {
    it('should score oversold RSI as bullish', async () => {
      const oversoldIndicators = { ...mockIndicators, rsi: 25 };
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        oversoldIndicators,
        mockHistoricalIndicators
      );

      const rsiScore = matrix.scores.find(s => s.indicator === 'RSI');
      expect(rsiScore).toBeDefined();
      expect(rsiScore!.signal).toBe('bullish');
      expect(rsiScore!.score).toBeGreaterThan(0.7);
    });

    it('should score overbought RSI as bearish', async () => {
      const overboughtIndicators = { ...mockIndicators, rsi: 80 };
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        overboughtIndicators,
        mockHistoricalIndicators
      );

      const rsiScore = matrix.scores.find(s => s.indicator === 'RSI');
      expect(rsiScore).toBeDefined();
      expect(rsiScore!.signal).toBe('bearish');
      expect(rsiScore!.score).toBeGreaterThan(0.7);
    });

    it('should score neutral RSI appropriately', async () => {
      const neutralIndicators = { ...mockIndicators, rsi: 50 };
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        neutralIndicators,
        mockHistoricalIndicators
      );

      const rsiScore = matrix.scores.find(s => s.indicator === 'RSI');
      expect(rsiScore).toBeDefined();
      expect(rsiScore!.signal).toBe('neutral');
      expect(rsiScore!.score).toBeLessThan(0.7);
    });
  });

  describe('Wave Trend scoring', () => {
    it('should score buy signal appropriately', async () => {
      const buyIndicators = {
        ...mockIndicators,
        waveTrend: { wt1: -70, wt2: -50, signal: 'buy' as const, divergence: null },
      };
      
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        buyIndicators,
        mockHistoricalIndicators
      );

      const wtScore = matrix.scores.find(s => s.indicator === 'WaveTrend');
      expect(wtScore).toBeDefined();
      expect(wtScore!.signal).toBe('bullish');
      expect(wtScore!.score).toBeGreaterThan(0.6);
    });

    it('should score sell signal appropriately', async () => {
      const sellIndicators = {
        ...mockIndicators,
        waveTrend: { wt1: 70, wt2: 50, signal: 'sell' as const, divergence: null },
      };
      
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        sellIndicators,
        mockHistoricalIndicators
      );

      const wtScore = matrix.scores.find(s => s.indicator === 'WaveTrend');
      expect(wtScore).toBeDefined();
      expect(wtScore!.signal).toBe('bearish');
      expect(wtScore!.score).toBeGreaterThan(0.6);
    });

    it('should boost score for divergence', async () => {
      const divergenceIndicators = {
        ...mockIndicators,
        waveTrend: { wt1: -70, wt2: -50, signal: 'buy' as const, divergence: 'bullish' as const },
      };
      
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        divergenceIndicators,
        mockHistoricalIndicators
      );

      const wtScore = matrix.scores.find(s => s.indicator === 'WaveTrend');
      expect(wtScore).toBeDefined();
      expect(wtScore!.score).toBeGreaterThan(0.8); // Should be boosted
    });
  });

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        weights: {
          rsi: 0.3,
          waveTrend: 0.3,
          pvt: 0.2,
          momentum: 0.1,
          trend: 0.1,
          volume: 0.0,
        },
      };
      
      scoringMatrix.updateConfig(newConfig);
      const config = scoringMatrix.getConfig();
      
      expect(config.weights.rsi).toBe(0.3);
      expect(config.weights.waveTrend).toBe(0.3);
      expect(config.weights.volume).toBe(0.0);
    });

    it('should return current configuration', () => {
      const config = scoringMatrix.getConfig();
      
      expect(config).toHaveProperty('weights');
      expect(config).toHaveProperty('thresholds');
      expect(config).toHaveProperty('divergenceSettings');
      
      expect(config.weights).toHaveProperty('rsi');
      expect(config.weights).toHaveProperty('waveTrend');
      expect(config.weights).toHaveProperty('pvt');
    });
  });

  describe('edge cases', () => {
    it('should handle insufficient historical data', async () => {
      const shortHistory = mockHistoricalIndicators.slice(0, 2);
      
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        mockIndicators,
        shortHistory
      );

      expect(matrix).toBeDefined();
      expect(matrix.correlationMatrix.pairs.length).toBe(0);
    });

    it('should handle extreme indicator values', async () => {
      const extremeIndicators = {
        ...mockIndicators,
        rsi: 0,
        waveTrend: { wt1: -100, wt2: 100, signal: 'neutral' as const, divergence: null },
        volatility: 1.0,
      };
      
      const matrix = await scoringMatrix.calculateScoringMatrix(
        mockCandles,
        extremeIndicators,
        mockHistoricalIndicators
      );

      expect(matrix).toBeDefined();
      expect(matrix.overallScore).toBeGreaterThanOrEqual(0);
      expect(matrix.overallScore).toBeLessThanOrEqual(1);
    });

    it('should handle empty candle array', async () => {
      await expect(scoringMatrix.calculateScoringMatrix(
        [],
        mockIndicators,
        mockHistoricalIndicators
      )).rejects.toThrow();
    });
  });
});