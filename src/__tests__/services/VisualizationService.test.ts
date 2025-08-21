/**
 * Visualization Service Tests
 * Unit tests for chart generation and data visualization
 */

import { VisualizationService } from '../../services/VisualizationService';
import {
  PerformanceAnalytics,
  PatternAnalytics,
  ElliottWaveAnalytics,
  FibonacciAnalytics,
  GridAnalytics,
  ChartType,
  AnalyticsPeriod
} from '../../types/analytics';

describe('VisualizationService', () => {
  let visualizationService: VisualizationService;

  beforeEach(() => {
    visualizationService = new VisualizationService();
  });

  const mockPerformanceAnalytics: PerformanceAnalytics = {
    userId: 'test-user',
    period: AnalyticsPeriod.MONTHLY,
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-31'),
    totalTrades: 50,
    winningTrades: 35,
    losingTrades: 15,
    winRate: 0.7,
    totalReturn: 15000,
    totalReturnPercentage: 15,
    realizedPnl: 12000,
    unrealizedPnl: 3000,
    maxDrawdown: -0.08,
    currentDrawdown: -0.02,
    sharpeRatio: 1.8,
    sortinoRatio: 2.2,
    calmarRatio: 1.875,
    maxConsecutiveLosses: 3,
    maxConsecutiveWins: 8,
    averageTradesPerDay: 1.6,
    averageHoldingTime: 4.5,
    patternAnalytics: [
      {
        patternType: 'hammer',
        totalSignals: 20,
        successfulSignals: 16,
        successRate: 0.8,
        averageReturn: 250,
        averageHoldingTime: 3.2,
        confidenceDistribution: { low: 0.1, medium: 0.3, high: 0.6 }
      },
      {
        patternType: 'doji',
        totalSignals: 15,
        successfulSignals: 9,
        successRate: 0.6,
        averageReturn: 180,
        averageHoldingTime: 5.1,
        confidenceDistribution: { low: 0.2, medium: 0.5, high: 0.3 }
      }
    ],
    elliottWaveAnalytics: {
      totalWaveAnalyses: 25,
      correctWaveIdentifications: 18,
      waveAccuracy: 0.72,
      impulseWavePerformance: {
        totalTrades: 15,
        successfulTrades: 12,
        successRate: 0.8,
        averageReturn: 300,
        averageAccuracy: 0.75
      },
      correctiveWavePerformance: {
        totalTrades: 10,
        successfulTrades: 6,
        successRate: 0.6,
        averageReturn: 150,
        averageAccuracy: 0.65
      },
      waveDegreeAccuracy: {
        'Minor': 0.8,
        'Intermediate': 0.7,
        'Primary': 0.6
      },
      waveTargetAccuracy: 0.75,
      fibonacciProjectionAccuracy: 0.68
    },
    fibonacciAnalytics: {
      totalFibonacciSignals: 30,
      successfulRetracements: 18,
      successfulExtensions: 8,
      retracementLevelPerformance: {
        '0.382': { totalTests: 8, successfulTests: 6, accuracy: 0.75, averageReactionStrength: 0.8, averageHoldTime: 3.5 },
        '0.618': { totalTests: 12, successfulTests: 10, accuracy: 0.83, averageReactionStrength: 0.9, averageHoldTime: 4.2 }
      },
      extensionLevelPerformance: {
        '1.618': { totalTests: 10, successfulTests: 7, accuracy: 0.7, averageReactionStrength: 0.75, averageHoldTime: 5.1 }
      },
      confluenceZoneAccuracy: 0.85,
      goldenRatioPerformance: {
        totalTests: 12,
        successfulTests: 10,
        accuracy: 0.83,
        averageReactionStrength: 0.9,
        averageHoldTime: 4.2
      },
      timeFibonacciAccuracy: 0.65
    },
    gridAnalytics: {
      totalGrids: 8,
      activeGrids: 3,
      completedGrids: 5,
      totalGridProfit: 5000,
      averageGridProfit: 625,
      gridSuccessRate: 0.75,
      elliottWaveGridPerformance: {
        totalGrids: 3,
        successfulGrids: 2,
        successRate: 0.67,
        averageProfit: 800,
        averageDuration: 72
      },
      fibonacciGridPerformance: {
        totalGrids: 3,
        successfulGrids: 3,
        successRate: 1.0,
        averageProfit: 900,
        averageDuration: 48
      },
      standardGridPerformance: {
        totalGrids: 2,
        successfulGrids: 1,
        successRate: 0.5,
        averageProfit: 400,
        averageDuration: 96
      },
      averageGridDuration: 72,
      averageFillRate: 0.85,
      optimalSpacingAnalysis: {
        optimalSpacing: 0.02,
        spacingPerformanceMap: { '0.01': 0.6, '0.02': 0.8, '0.03': 0.7 },
        recommendedSpacing: 0.02
      }
    },
    calculatedAt: new Date()
  };

  describe('generatePerformanceCharts', () => {
    it('should generate comprehensive performance charts', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);

      expect(charts).toBeDefined();
      expect(Array.isArray(charts)).toBe(true);
      expect(charts.length).toBeGreaterThan(0);

      // Check for required chart types
      const chartTitles = charts.map(chart => chart.title);
      expect(chartTitles).toContain('Performance Overview');
      expect(chartTitles).toContain('Elliott Wave Analysis Performance');
      expect(chartTitles).toContain('Fibonacci Level Performance');
    });

    it('should create performance overview chart with correct data', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const overviewChart = charts.find(chart => chart.title === 'Performance Overview');

      expect(overviewChart).toBeDefined();
      expect(overviewChart!.chartType).toBe(ChartType.BAR);
      expect(overviewChart!.data.labels).toEqual(['Total Return', 'Win Rate', 'Sharpe Ratio', 'Max Drawdown']);
      expect(overviewChart!.data.datasets[0].data).toHaveLength(4);
      expect(overviewChart!.data.datasets[0].data[0]).toBe(15); // Total return percentage
      expect(overviewChart!.data.datasets[0].data[1]).toBe(70); // Win rate percentage
    });

    it('should create win rate chart with correct distribution', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const winRateChart = charts.find(chart => chart.title.includes('Win Rate'));

      expect(winRateChart).toBeDefined();
      expect(winRateChart!.chartType).toBe(ChartType.DOUGHNUT);
      expect(winRateChart!.data.labels).toEqual(['Winning Trades', 'Losing Trades']);
      expect(winRateChart!.data.datasets[0].data).toEqual([35, 15]);
    });

    it('should create pattern performance chart when patterns exist', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const patternChart = charts.find(chart => chart.title === 'Pattern Performance Analysis');

      expect(patternChart).toBeDefined();
      expect(patternChart!.chartType).toBe(ChartType.BAR);
      expect(patternChart!.data.labels).toContain('hammer');
      expect(patternChart!.data.labels).toContain('doji');
      expect(patternChart!.data.datasets).toHaveLength(2); // Success rate and total signals
    });

    it('should create Elliott Wave chart with wave performance data', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const elliottChart = charts.find(chart => chart.title === 'Elliott Wave Analysis Performance');

      expect(elliottChart).toBeDefined();
      expect(elliottChart!.chartType).toBe(ChartType.BAR);
      expect(elliottChart!.data.labels).toEqual(['Impulse Waves', 'Corrective Waves', 'Wave Targets', 'Overall Accuracy']);
      expect(elliottChart!.data.datasets[0].data[0]).toBe(80); // Impulse wave success rate %
      expect(elliottChart!.data.datasets[0].data[1]).toBe(60); // Corrective wave success rate %
    });

    it('should create Fibonacci chart with level performance', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const fibonacciChart = charts.find(chart => chart.title === 'Fibonacci Level Performance');

      expect(fibonacciChart).toBeDefined();
      expect(fibonacciChart!.chartType).toBe(ChartType.BAR);
      expect(fibonacciChart!.data.labels).toContain('0.382 Ret');
      expect(fibonacciChart!.data.labels).toContain('0.618 Ret');
      expect(fibonacciChart!.data.labels).toContain('1.618 Ext');
    });

    it('should create grid performance chart when grid data exists', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const gridChart = charts.find(chart => chart.title === 'Grid Strategy Performance Comparison');

      expect(gridChart).toBeDefined();
      expect(gridChart!.chartType).toBe(ChartType.BAR);
      expect(gridChart!.data.labels).toEqual(['Elliott Wave Grids', 'Fibonacci Grids', 'Standard Grids']);
      expect(gridChart!.data.datasets).toHaveLength(2); // Success rate and average profit
    });

    it('should skip grid chart when no grid data', async () => {
      const analyticsWithoutGrid = { ...mockPerformanceAnalytics, gridAnalytics: undefined };
      const charts = await visualizationService.generatePerformanceCharts(analyticsWithoutGrid);
      const gridChart = charts.find(chart => chart.title === 'Grid Strategy Performance Comparison');

      expect(gridChart).toBeUndefined();
    });
  });

  describe('generatePortfolioTimeSeriesChart', () => {
    it('should generate portfolio time series chart', () => {
      const portfolioData = [
        {
          timestamp: new Date('2023-01-01'),
          totalValue: 100000,
          unrealizedPnl: 2000,
          realizedPnl: 5000,
          drawdown: -0.02
        },
        {
          timestamp: new Date('2023-01-02'),
          totalValue: 102000,
          unrealizedPnl: 1500,
          realizedPnl: 5500,
          drawdown: -0.01
        },
        {
          timestamp: new Date('2023-01-03'),
          totalValue: 98000,
          unrealizedPnl: -1000,
          realizedPnl: 4000,
          drawdown: -0.04
        }
      ];

      const chart = visualizationService.generatePortfolioTimeSeriesChart(portfolioData);

      expect(chart).toBeDefined();
      expect(chart.chartType).toBe(ChartType.LINE);
      expect(chart.title).toBe('Portfolio Performance Over Time');
      expect(chart.data.labels).toHaveLength(3);
      expect(chart.data.datasets).toHaveLength(2); // Portfolio value and drawdown
      expect(chart.data.datasets[0].label).toBe('Portfolio Value');
      expect(chart.data.datasets[1].label).toBe('Drawdown (%)');
    });

    it('should format dates correctly in labels', () => {
      const portfolioData = [
        {
          timestamp: new Date('2023-01-15T10:30:00Z'),
          totalValue: 100000,
          unrealizedPnl: 0,
          realizedPnl: 0,
          drawdown: 0
        }
      ];

      const chart = visualizationService.generatePortfolioTimeSeriesChart(portfolioData);
      
      expect(chart.data.labels[0]).toBe('2023-01-15');
    });
  });

  describe('generatePatternHeatmap', () => {
    it('should generate pattern performance heatmap', () => {
      const patternData = [
        { pattern: 'hammer', hour: 9, successRate: 0.8 },
        { pattern: 'hammer', hour: 14, successRate: 0.6 },
        { pattern: 'doji', hour: 9, successRate: 0.7 },
        { pattern: 'doji', hour: 14, successRate: 0.9 }
      ];

      const chart = visualizationService.generatePatternHeatmap(patternData);

      expect(chart).toBeDefined();
      expect(chart.chartType).toBe(ChartType.BAR);
      expect(chart.title).toBe('Pattern Performance by Hour of Day');
      expect(chart.data.labels).toHaveLength(24); // 24 hours
      expect(chart.data.datasets).toHaveLength(2); // hammer and doji patterns
      expect(chart.data.datasets[0].label).toBe('hammer');
      expect(chart.data.datasets[1].label).toBe('doji');
    });

    it('should handle missing data points', () => {
      const patternData = [
        { pattern: 'hammer', hour: 9, successRate: 0.8 }
        // Missing data for other hours
      ];

      const chart = visualizationService.generatePatternHeatmap(patternData);

      expect(chart.data.datasets[0].data).toHaveLength(24);
      expect(chart.data.datasets[0].data[9]).toBe(80); // 0.8 * 100
      expect(chart.data.datasets[0].data[10]).toBe(0); // Missing data = 0
    });
  });

  describe('Chart Configuration', () => {
    it('should include responsive configuration', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      
      charts.forEach(chart => {
        expect(chart.config.responsive).toBe(true);
        expect(chart.config.maintainAspectRatio).toBe(false);
      });
    });

    it('should include appropriate scales for bar charts', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const barCharts = charts.filter(chart => chart.chartType === ChartType.BAR);
      
      barCharts.forEach(chart => {
        expect(chart.config.scales).toBeDefined();
        expect(chart.config.scales.y).toBeDefined();
        expect(chart.config.scales.y.beginAtZero).toBe(true);
      });
    });

    it('should include legend configuration for doughnut charts', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const doughnutCharts = charts.filter(chart => chart.chartType === ChartType.DOUGHNUT);
      
      doughnutCharts.forEach(chart => {
        expect(chart.config.plugins.legend).toBeDefined();
        expect(chart.config.plugins.legend.position).toBe('bottom');
      });
    });

    it('should include tooltip configuration', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      
      charts.forEach(chart => {
        expect(chart.config.plugins).toBeDefined();
        if (chart.config.plugins.tooltip) {
          expect(chart.config.plugins.tooltip.callbacks).toBeDefined();
        }
      });
    });
  });

  describe('Color Schemes', () => {
    it('should use appropriate colors for performance metrics', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const overviewChart = charts.find(chart => chart.title === 'Performance Overview');

      expect(overviewChart!.data.datasets[0].backgroundColor).toBeDefined();
      expect(Array.isArray(overviewChart!.data.datasets[0].backgroundColor)).toBe(true);
      
      // Should use green for positive performance, red for negative
      const colors = overviewChart!.data.datasets[0].backgroundColor as string[];
      expect(colors[0]).toBe('#4CAF50'); // Positive return = green
    });

    it('should use green/red for win/loss distribution', async () => {
      const charts = await visualizationService.generatePerformanceCharts(mockPerformanceAnalytics);
      const winRateChart = charts.find(chart => chart.title.includes('Win Rate'));

      const colors = winRateChart!.data.datasets[0].backgroundColor as string[];
      expect(colors[0]).toBe('#4CAF50'); // Winning trades = green
      expect(colors[1]).toBe('#F44336'); // Losing trades = red
    });
  });

  describe('Error Handling', () => {
    it('should handle empty pattern analytics', async () => {
      const analyticsWithoutPatterns = { 
        ...mockPerformanceAnalytics, 
        patternAnalytics: [] 
      };

      const charts = await visualizationService.generatePerformanceCharts(analyticsWithoutPatterns);
      const patternChart = charts.find(chart => chart.title === 'Pattern Performance Analysis');

      expect(patternChart).toBeUndefined();
    });

    it('should handle missing Elliott Wave data', async () => {
      const analyticsWithoutElliott = {
        ...mockPerformanceAnalytics,
        elliottWaveAnalytics: {
          totalWaveAnalyses: 0,
          correctWaveIdentifications: 0,
          waveAccuracy: 0,
          impulseWavePerformance: { totalTrades: 0, successfulTrades: 0, successRate: 0, averageReturn: 0, averageAccuracy: 0 },
          correctiveWavePerformance: { totalTrades: 0, successfulTrades: 0, successRate: 0, averageReturn: 0, averageAccuracy: 0 },
          waveDegreeAccuracy: {},
          waveTargetAccuracy: 0,
          fibonacciProjectionAccuracy: 0
        }
      };

      const charts = await visualizationService.generatePerformanceCharts(analyticsWithoutElliott);
      const elliottChart = charts.find(chart => chart.title === 'Elliott Wave Analysis Performance');

      expect(elliottChart).toBeDefined();
      expect(elliottChart!.data.datasets[0].data).toEqual([0, 0, 0, 0]);
    });

    it('should handle empty portfolio data', () => {
      const emptyPortfolioData: any[] = [];

      const chart = visualizationService.generatePortfolioTimeSeriesChart(emptyPortfolioData);

      expect(chart.data.labels).toEqual([]);
      expect(chart.data.datasets[0].data).toEqual([]);
      expect(chart.data.datasets[1].data).toEqual([]);
    });
  });
});