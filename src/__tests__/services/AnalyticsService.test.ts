/**
 * Analytics Service Tests
 * Unit tests for performance analytics and reporting
 */

import { AnalyticsService } from '../../services/AnalyticsService';
import { AnalyticsPeriod, TradeAnalytics } from '../../types/analytics';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
  tradingSignal: {
    findMany: jest.fn()
  },
  tradeExecution: {
    findMany: jest.fn()
  },
  grid: {
    findMany: jest.fn()
  },
  portfolio: {
    findFirst: jest.fn()
  },
  performanceMetric: {
    create: jest.fn()
  }
} as unknown as PrismaClient;

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  const userId = 'test-user-id';

  beforeEach(() => {
    analyticsService = new AnalyticsService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('calculatePerformanceMetrics', () => {
    it('should calculate correct performance metrics for profitable trades', () => {
      const trades: TradeAnalytics[] = [
        {
          tradeId: '1',
          symbol: 'BTCUSDT',
          side: 'BUY',
          entryPrice: 50000,
          quantity: 0.1,
          realizedPnl: 500,
          returnPercentage: 10,
          entryTime: new Date('2023-01-01')
        },
        {
          tradeId: '2',
          symbol: 'ETHUSDT',
          side: 'BUY',
          entryPrice: 3000,
          quantity: 1,
          realizedPnl: 300,
          returnPercentage: 10,
          entryTime: new Date('2023-01-02')
        },
        {
          tradeId: '3',
          symbol: 'BTCUSDT',
          side: 'SELL',
          entryPrice: 51000,
          quantity: 0.1,
          realizedPnl: -200,
          returnPercentage: -4,
          entryTime: new Date('2023-01-03')
        }
      ];

      const metrics = analyticsService.calculatePerformanceMetrics(trades);

      expect(metrics.totalReturn).toBe(16); // 10 + 10 + (-4)
      expect(metrics.winRate).toBe(2/3); // 2 winning trades out of 3
      expect(metrics.profitFactor).toBeGreaterThan(1); // Gross profit / Gross loss
      expect(metrics.sharpeRatio).toBeDefined();
      expect(metrics.maxDrawdown).toBeDefined();
    });

    it('should handle empty trades array', () => {
      const trades: TradeAnalytics[] = [];
      const metrics = analyticsService.calculatePerformanceMetrics(trades);

      expect(metrics.totalReturn).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.sharpeRatio).toBe(0);
      expect(metrics.maxDrawdown).toBe(0);
    });

    it('should calculate correct win rate', () => {
      const trades: TradeAnalytics[] = [
        { tradeId: '1', symbol: 'BTC', side: 'BUY', entryPrice: 100, quantity: 1, realizedPnl: 10, entryTime: new Date() },
        { tradeId: '2', symbol: 'BTC', side: 'BUY', entryPrice: 100, quantity: 1, realizedPnl: -5, entryTime: new Date() },
        { tradeId: '3', symbol: 'BTC', side: 'BUY', entryPrice: 100, quantity: 1, realizedPnl: 15, entryTime: new Date() },
        { tradeId: '4', symbol: 'BTC', side: 'BUY', entryPrice: 100, quantity: 1, realizedPnl: -8, entryTime: new Date() }
      ];

      const winRate = analyticsService.calculateWinRate(trades);
      expect(winRate).toBe(0.5); // 2 wins out of 4 trades
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should calculate Sharpe ratio correctly', () => {
      const returns = [0.1, 0.05, -0.02, 0.08, 0.03];
      const riskFreeRate = 0.02;

      const sharpeRatio = analyticsService.calculateSharpeRatio(returns, riskFreeRate);
      
      expect(sharpeRatio).toBeGreaterThan(0);
      expect(typeof sharpeRatio).toBe('number');
    });

    it('should return 0 for empty returns', () => {
      const returns: number[] = [];
      const sharpeRatio = analyticsService.calculateSharpeRatio(returns);
      
      expect(sharpeRatio).toBe(0);
    });

    it('should handle zero volatility', () => {
      const returns = [0.05, 0.05, 0.05, 0.05]; // No volatility
      const sharpeRatio = analyticsService.calculateSharpeRatio(returns);
      
      expect(sharpeRatio).toBe(0);
    });
  });

  describe('calculateSortinoRatio', () => {
    it('should calculate Sortino ratio correctly', () => {
      const returns = [0.1, 0.05, -0.02, 0.08, -0.01, 0.03];
      const targetReturn = 0;

      const sortinoRatio = analyticsService.calculateSortinoRatio(returns, targetReturn);
      
      expect(sortinoRatio).toBeGreaterThan(0);
      expect(typeof sortinoRatio).toBe('number');
    });

    it('should return Infinity when no downside deviation', () => {
      const returns = [0.1, 0.05, 0.08, 0.03]; // All positive returns
      const targetReturn = 0;

      const sortinoRatio = analyticsService.calculateSortinoRatio(returns, targetReturn);
      
      expect(sortinoRatio).toBe(Infinity);
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should calculate maximum drawdown correctly', () => {
      const portfolioValues = [1000, 1100, 1050, 900, 950, 1200];
      
      const maxDrawdown = analyticsService.calculateMaxDrawdown(portfolioValues);
      
      // Max drawdown should be from peak 1100 to trough 900 = (1100-900)/1100 = 0.1818
      expect(maxDrawdown).toBeCloseTo(0.1818, 3);
    });

    it('should return 0 for constantly increasing portfolio', () => {
      const portfolioValues = [1000, 1100, 1200, 1300, 1400];
      
      const maxDrawdown = analyticsService.calculateMaxDrawdown(portfolioValues);
      
      expect(maxDrawdown).toBe(0);
    });

    it('should handle empty array', () => {
      const portfolioValues: number[] = [];
      
      const maxDrawdown = analyticsService.calculateMaxDrawdown(portfolioValues);
      
      expect(maxDrawdown).toBe(0);
    });
  });

  describe('generatePerformanceAnalytics', () => {
    beforeEach(() => {
      // Mock database responses
      (mockPrisma.tradeExecution.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          symbol: 'BTCUSDT',
          side: 'BUY',
          price: 50000,
          quantity: 0.1,
          realizedPnl: 500,
          executedAt: new Date('2023-01-01'),
          signal: {
            confidence: 85,
            reasoning: { pattern: { type: 'hammer' } }
          }
        }
      ]);

      (mockPrisma.tradingSignal.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          userId,
          confidence: 85,
          reasoning: { 
            pattern: { type: 'hammer' },
            elliottWave: { waveType: 'impulse', wavePosition: 'Wave 3' },
            fibonacci: { levelType: 'retracement', level: 0.618 }
          },
          executions: [{ realizedPnl: 500 }],
          createdAt: new Date('2023-01-01')
        }
      ]);

      (mockPrisma.grid.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          strategy: 'ELLIOTT_WAVE',
          totalProfit: 1000,
          status: 'CLOSED',
          createdAt: new Date('2023-01-01')
        }
      ]);

      (mockPrisma.portfolio.findFirst as jest.Mock).mockResolvedValue({
        totalUnrealizedPnl: 200,
        currentDrawdown: -0.05
      });

      (mockPrisma.performanceMetric.create as jest.Mock).mockResolvedValue({});
    });

    it('should generate comprehensive performance analytics', async () => {
      const analytics = await analyticsService.generatePerformanceAnalytics(
        userId,
        AnalyticsPeriod.MONTHLY
      );

      expect(analytics).toBeDefined();
      expect(analytics.userId).toBe(userId);
      expect(analytics.period).toBe(AnalyticsPeriod.MONTHLY);
      expect(analytics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(analytics.patternAnalytics).toBeDefined();
      expect(analytics.elliottWaveAnalytics).toBeDefined();
      expect(analytics.fibonacciAnalytics).toBeDefined();
      expect(analytics.calculatedAt).toBeInstanceOf(Date);
    });

    it('should handle custom date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      const analytics = await analyticsService.generatePerformanceAnalytics(
        userId,
        AnalyticsPeriod.CUSTOM,
        startDate,
        endDate
      );

      expect(analytics.startDate).toEqual(startDate);
      expect(analytics.endDate).toEqual(endDate);
    });
  });

  describe('Pattern Analytics', () => {
    it('should calculate pattern success rates correctly', async () => {
      const mockSignals = [
        {
          reasoning: { pattern: { type: 'hammer' } },
          confidence: 80,
          executions: [{ realizedPnl: 100 }],
          executedAt: new Date('2023-01-01'),
          closedAt: new Date('2023-01-02')
        },
        {
          reasoning: { pattern: { type: 'hammer' } },
          confidence: 75,
          executions: [{ realizedPnl: -50 }],
          executedAt: new Date('2023-01-01'),
          closedAt: new Date('2023-01-02')
        },
        {
          reasoning: { pattern: { type: 'doji' } },
          confidence: 90,
          executions: [{ realizedPnl: 200 }],
          executedAt: new Date('2023-01-01'),
          closedAt: new Date('2023-01-02')
        }
      ];

      (mockPrisma.tradingSignal.findMany as jest.Mock).mockResolvedValue(mockSignals);

      const analytics = await analyticsService.generatePerformanceAnalytics(
        userId,
        AnalyticsPeriod.MONTHLY
      );

      const hammerPattern = analytics.patternAnalytics.find(p => p.patternType === 'hammer');
      const dojiPattern = analytics.patternAnalytics.find(p => p.patternType === 'doji');

      expect(hammerPattern).toBeDefined();
      expect(hammerPattern!.totalSignals).toBe(2);
      expect(hammerPattern!.successfulSignals).toBe(1);
      expect(hammerPattern!.successRate).toBe(0.5);

      expect(dojiPattern).toBeDefined();
      expect(dojiPattern!.totalSignals).toBe(1);
      expect(dojiPattern!.successfulSignals).toBe(1);
      expect(dojiPattern!.successRate).toBe(1);
    });
  });

  describe('Elliott Wave Analytics', () => {
    it('should calculate wave performance correctly', async () => {
      // Mock trade executions
      (mockPrisma.tradeExecution.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          symbol: 'BTCUSDT',
          side: 'BUY',
          price: 50000,
          quantity: 0.1,
          realizedPnl: 100,
          executedAt: new Date(),
          signalId: 'signal1',
          signal: { confidence: 85 }
        }
      ]);

      const mockSignals = [
        {
          elliottWaveScore: 85,
          reasoning: { 
            elliottWave: { 
              waveType: 'impulse', 
              wavePosition: 'Wave 3',
              waveTargets: [51000, 52000],
              actualWaveCompletion: true 
            } 
          },
          executions: [{ realizedPnl: 100 }]
        },
        {
          elliottWaveScore: 75,
          reasoning: { 
            elliottWave: { 
              waveType: 'corrective', 
              wavePosition: 'Wave A',
              waveTargets: [49000, 48000],
              actualWaveCompletion: false 
            } 
          },
          executions: [{ realizedPnl: -50 }]
        }
      ];

      (mockPrisma.tradingSignal.findMany as jest.Mock).mockResolvedValue(mockSignals);
      (mockPrisma.grid.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.portfolio.findFirst as jest.Mock).mockResolvedValue({ totalUnrealizedPnl: 0, currentDrawdown: 0 });

      const analytics = await analyticsService.generatePerformanceAnalytics(
        userId,
        AnalyticsPeriod.MONTHLY
      );

      expect(analytics.elliottWaveAnalytics.totalWaveAnalyses).toBe(2);
      expect(analytics.elliottWaveAnalytics.impulseWavePerformance.totalTrades).toBe(1);
      expect(analytics.elliottWaveAnalytics.correctiveWavePerformance.totalTrades).toBe(1);
      expect(analytics.elliottWaveAnalytics.waveTargetAccuracy).toBe(0.5); // 1 correct out of 2
    });
  });

  describe('Fibonacci Analytics', () => {
    it('should calculate Fibonacci level performance', async () => {
      const mockSignals = [
        {
          fibonacciScore: 90,
          reasoning: { 
            fibonacci: { 
              levelType: 'retracement', 
              level: 0.618,
              confluenceZone: true 
            } 
          },
          executions: [{ realizedPnl: 150 }]
        },
        {
          fibonacciScore: 80,
          reasoning: { 
            fibonacci: { 
              levelType: 'extension', 
              level: 1.618,
              confluenceZone: false 
            } 
          },
          executions: [{ realizedPnl: -30 }]
        }
      ];

      (mockPrisma.tradingSignal.findMany as jest.Mock).mockResolvedValue(mockSignals);

      const analytics = await analyticsService.generatePerformanceAnalytics(
        userId,
        AnalyticsPeriod.MONTHLY
      );

      expect(analytics.fibonacciAnalytics.totalFibonacciSignals).toBe(2);
      expect(analytics.fibonacciAnalytics.successfulRetracements).toBe(1);
      expect(analytics.fibonacciAnalytics.successfulExtensions).toBe(0);
      expect(analytics.fibonacciAnalytics.confluenceZoneAccuracy).toBe(1); // 1 success out of 1 confluence zone
    });
  });

  describe('Grid Analytics', () => {
    it('should calculate grid strategy performance', async () => {
      const mockGrids = [
        {
          strategy: 'ELLIOTT_WAVE',
          totalProfit: 500,
          status: 'CLOSED'
        },
        {
          strategy: 'FIBONACCI',
          totalProfit: -100,
          status: 'CLOSED'
        },
        {
          strategy: 'STANDARD',
          totalProfit: 200,
          status: 'ACTIVE'
        }
      ];

      (mockPrisma.grid.findMany as jest.Mock).mockResolvedValue(mockGrids);

      const analytics = await analyticsService.generatePerformanceAnalytics(
        userId,
        AnalyticsPeriod.MONTHLY
      );

      expect(analytics.gridAnalytics).toBeDefined();
      expect(analytics.gridAnalytics!.totalGrids).toBe(3);
      expect(analytics.gridAnalytics!.totalGridProfit).toBe(600);
      expect(analytics.gridAnalytics!.elliottWaveGridPerformance.totalGrids).toBe(1);
      expect(analytics.gridAnalytics!.fibonacciGridPerformance.totalGrids).toBe(1);
      expect(analytics.gridAnalytics!.standardGridPerformance.totalGrids).toBe(1);
    });

    it('should return undefined when no grids exist', async () => {
      (mockPrisma.grid.findMany as jest.Mock).mockResolvedValue([]);

      const analytics = await analyticsService.generatePerformanceAnalytics(
        userId,
        AnalyticsPeriod.MONTHLY
      );

      expect(analytics.gridAnalytics).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      (mockPrisma.tradeExecution.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        analyticsService.generatePerformanceAnalytics(userId, AnalyticsPeriod.MONTHLY)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle missing signal data', async () => {
      (mockPrisma.tradeExecution.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          symbol: 'BTCUSDT',
          side: 'BUY',
          price: 50000,
          quantity: 0.1,
          realizedPnl: 500,
          executedAt: new Date(),
          signal: null // No associated signal
        }
      ]);

      (mockPrisma.tradingSignal.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.grid.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.portfolio.findFirst as jest.Mock).mockResolvedValue(null);

      const analytics = await analyticsService.generatePerformanceAnalytics(
        userId,
        AnalyticsPeriod.MONTHLY
      );

      expect(analytics).toBeDefined();
      expect(analytics.totalTrades).toBe(1);
      expect(analytics.patternAnalytics).toEqual([]);
    });
  });
});