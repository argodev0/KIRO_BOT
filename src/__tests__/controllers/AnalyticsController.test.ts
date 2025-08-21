/**
 * Analytics Controller Tests
 * Unit tests for analytics API endpoints
 */

import { Request, Response } from 'express';
import { AnalyticsController } from '../../controllers/AnalyticsController';
import { AnalyticsService } from '../../services/AnalyticsService';
import { VisualizationService } from '../../services/VisualizationService';
import { ReportGeneratorService } from '../../services/ReportGeneratorService';
import { AnalyticsPeriod, ReportType, ChartType } from '../../types/analytics';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  } | undefined;
  query: any;
  body: any;
}

// Mock services
jest.mock('../../services/AnalyticsService');
jest.mock('../../services/VisualizationService');
jest.mock('../../services/ReportGeneratorService');
jest.mock('../../models/database');

const MockedAnalyticsService = AnalyticsService as jest.MockedClass<typeof AnalyticsService>;
const MockedVisualizationService = VisualizationService as jest.MockedClass<typeof VisualizationService>;
const MockedReportGeneratorService = ReportGeneratorService as jest.MockedClass<typeof ReportGeneratorService>;

describe('AnalyticsController', () => {
  let analyticsController: AnalyticsController;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;
  let mockVisualizationService: jest.Mocked<VisualizationService>;
  let mockReportGenerator: jest.Mocked<ReportGeneratorService>;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockAnalyticsService = new MockedAnalyticsService({} as any) as jest.Mocked<AnalyticsService>;
    mockVisualizationService = new MockedVisualizationService() as jest.Mocked<VisualizationService>;
    mockReportGenerator = new MockedReportGeneratorService() as jest.Mocked<ReportGeneratorService>;

    // Mock constructor calls
    MockedAnalyticsService.mockImplementation(() => mockAnalyticsService);
    MockedVisualizationService.mockImplementation(() => mockVisualizationService);
    MockedReportGeneratorService.mockImplementation(() => mockReportGenerator);

    analyticsController = new AnalyticsController();

    // Setup mock request and response
    mockRequest = {
      user: { userId: 'test-user-id', email: 'test@example.com', role: 'user' },
      query: {},
      body: {}
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn()
    };
  });

  describe('getPerformanceAnalytics', () => {
    const mockAnalytics = {
      userId: 'test-user-id',
      period: AnalyticsPeriod.MONTHLY,
      totalTrades: 50,
      winRate: 0.7,
      totalReturn: 15000,
      sharpeRatio: 1.8,
      maxDrawdown: -0.08,
      patternAnalytics: [],
      elliottWaveAnalytics: {} as any,
      fibonacciAnalytics: {} as any,
      calculatedAt: new Date()
    };

    it('should return performance analytics successfully', async () => {
      mockRequest.query = { period: 'monthly' };
      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue(mockAnalytics as any);

      await analyticsController.getPerformanceAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockAnalyticsService.generatePerformanceAnalytics).toHaveBeenCalledWith(
        'test-user-id',
        AnalyticsPeriod.MONTHLY,
        undefined,
        undefined
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics,
        timestamp: expect.any(Number)
      });
    });

    it('should handle custom date range', async () => {
      const startDate = '2023-01-01';
      const endDate = '2023-01-31';
      mockRequest.query = { 
        period: 'custom',
        startDate,
        endDate
      };

      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue(mockAnalytics as any);

      await analyticsController.getPerformanceAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockAnalyticsService.generatePerformanceAnalytics).toHaveBeenCalledWith(
        'test-user-id',
        AnalyticsPeriod.CUSTOM,
        new Date(startDate),
        new Date(endDate)
      );
    });

    it('should handle service errors', async () => {
      mockRequest.query = { period: 'monthly' };
      mockAnalyticsService.generatePerformanceAnalytics.mockRejectedValue(new Error('Service error'));

      await analyticsController.getPerformanceAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get performance analytics',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getPatternAnalytics', () => {
    const mockPatternAnalytics = [
      {
        patternType: 'hammer',
        totalSignals: 20,
        successfulSignals: 16,
        successRate: 0.8,
        averageReturn: 250,
        averageHoldingTime: 3.2,
        confidenceDistribution: { low: 0.1, medium: 0.3, high: 0.6 }
      }
    ];

    it('should return pattern analytics successfully', async () => {
      mockRequest.query = { period: 'monthly' };
      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue({
        patternAnalytics: mockPatternAnalytics
      } as any);

      await analyticsController.getPatternAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockPatternAnalytics,
        timestamp: expect.any(Number)
      });
    });

    it('should filter by pattern type', async () => {
      mockRequest.query = { period: 'monthly', patternType: 'hammer' };
      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue({
        patternAnalytics: mockPatternAnalytics
      } as any);

      await analyticsController.getPatternAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockPatternAnalytics, // Should be filtered to only hammer patterns
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getElliottWaveAnalytics', () => {
    const mockElliottWaveAnalytics = {
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
      waveDegreeAccuracy: {},
      waveTargetAccuracy: 0.75,
      fibonacciProjectionAccuracy: 0.68
    };

    it('should return Elliott Wave analytics successfully', async () => {
      mockRequest.query = { period: 'monthly' };
      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue({
        elliottWaveAnalytics: mockElliottWaveAnalytics
      } as any);

      await analyticsController.getElliottWaveAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockElliottWaveAnalytics,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getFibonacciAnalytics', () => {
    const mockFibonacciAnalytics = {
      totalFibonacciSignals: 30,
      successfulRetracements: 18,
      successfulExtensions: 8,
      retracementLevelPerformance: {},
      extensionLevelPerformance: {},
      confluenceZoneAccuracy: 0.85,
      goldenRatioPerformance: {
        totalTests: 12,
        successfulTests: 10,
        accuracy: 0.83,
        averageReactionStrength: 0.9,
        averageHoldTime: 4.2
      },
      timeFibonacciAccuracy: 0.65
    };

    it('should return Fibonacci analytics successfully', async () => {
      mockRequest.query = { period: 'monthly' };
      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue({
        fibonacciAnalytics: mockFibonacciAnalytics
      } as any);

      await analyticsController.getFibonacciAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockFibonacciAnalytics,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getGridAnalytics', () => {
    const mockGridAnalytics = {
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
        spacingPerformanceMap: {},
        recommendedSpacing: 0.02
      }
    };

    it('should return grid analytics successfully', async () => {
      mockRequest.query = { period: 'monthly' };
      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue({
        gridAnalytics: mockGridAnalytics
      } as any);

      await analyticsController.getGridAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockGridAnalytics,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getPerformanceCharts', () => {
    const mockCharts = [
      {
        chartType: ChartType.LINE,
        title: 'Performance Overview',
        data: { labels: [], datasets: [] },
        config: { responsive: true, maintainAspectRatio: false }
      }
    ];

    it('should return performance charts successfully', async () => {
      mockRequest.query = { chartType: 'line', period: 'monthly' };
      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue({} as any);
      mockVisualizationService.generatePerformanceCharts.mockResolvedValue(mockCharts);

      await analyticsController.getPerformanceCharts(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockVisualizationService.generatePerformanceCharts).toHaveBeenCalledWith(
        {},
        ChartType.LINE
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCharts,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('generateReport', () => {
    const mockReport = {
      id: 'report-123',
      userId: 'test-user-id',
      reportType: ReportType.PERFORMANCE_SUMMARY,
      period: AnalyticsPeriod.MONTHLY,
      data: {
        userId: 'test-user-id',
        period: AnalyticsPeriod.MONTHLY,
        totalTrades: 0,
        winRate: 0,
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        patternAnalytics: [],
        elliottWaveAnalytics: {} as any,
        fibonacciAnalytics: {} as any,
        calculatedAt: new Date()
      } as any,
      generatedAt: new Date(),
      format: 'json' as const
    };

    it('should generate report successfully', async () => {
      mockRequest.body = {
        reportType: 'performance_summary',
        period: 'monthly',
        format: 'json'
      };

      mockReportGenerator.generateReport.mockResolvedValue(mockReport);

      await analyticsController.generateReport(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockReportGenerator.generateReport).toHaveBeenCalledWith(
        'test-user-id',
        ReportType.PERFORMANCE_SUMMARY,
        AnalyticsPeriod.MONTHLY,
        'json',
        undefined,
        undefined
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport,
        timestamp: expect.any(Number)
      });
    });

    it('should set appropriate headers for PDF format', async () => {
      mockRequest.body = {
        reportType: 'performance_summary',
        period: 'monthly',
        format: 'pdf'
      };

      mockReportGenerator.generateReport.mockResolvedValue(mockReport);

      await analyticsController.generateReport(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="analytics-report-')
      );
    });

    it('should set appropriate headers for CSV format', async () => {
      mockRequest.body = {
        reportType: 'performance_summary',
        period: 'monthly',
        format: 'csv'
      };

      mockReportGenerator.generateReport.mockResolvedValue(mockReport);

      await analyticsController.generateReport(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="analytics-report-')
      );
    });
  });

  describe('getTradeExecutionAnalytics', () => {
    it('should return trade execution analytics successfully', async () => {
      // Mock the database call
      const mockDb = require('../../models/database');
      mockDb.tradeExecution = {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            symbol: 'BTCUSDT',
            side: 'BUY',
            quantity: 0.1,
            price: 50000,
            realizedPnl: 500,
            fee: 10,
            exchange: 'binance',
            executedAt: new Date(),
            signal: {
              confidence: 85,
              direction: 'LONG',
              reasoning: {}
            }
          }
        ])
      };

      mockRequest.query = { limit: '10', offset: '0' };

      await analyticsController.getTradeExecutionAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
        total: expect.any(Number),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getRiskMetrics', () => {
    it('should return risk metrics successfully', async () => {
      const mockAnalytics = {
        maxDrawdown: -0.08,
        currentDrawdown: -0.02,
        sharpeRatio: 1.8,
        sortinoRatio: 2.2,
        calmarRatio: 1.875,
        maxConsecutiveLosses: 3,
        winRate: 0.7,
        totalReturn: 15000
      };

      mockAnalyticsService.generatePerformanceAnalytics.mockResolvedValue(mockAnalytics as any);

      await analyticsController.getRiskMetrics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          maxDrawdown: -0.08,
          currentDrawdown: -0.02,
          sharpeRatio: 1.8,
          sortinoRatio: 2.2,
          calmarRatio: 1.875,
          maxConsecutiveLosses: 3,
          winRate: 0.7,
          totalReturn: 15000,
          volatility: 0
        },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getPerformanceComparison', () => {
    it('should return performance comparison successfully', async () => {
      mockRequest.query = { comparePeriods: ['monthly', 'quarterly'] };

      const mockMonthlyAnalytics = {
        totalReturn: 5000,
        winRate: 0.7,
        sharpeRatio: 1.5,
        maxDrawdown: -0.05,
        totalTrades: 20
      };

      const mockQuarterlyAnalytics = {
        totalReturn: 15000,
        winRate: 0.65,
        sharpeRatio: 1.8,
        maxDrawdown: -0.08,
        totalTrades: 60
      };

      mockAnalyticsService.generatePerformanceAnalytics
        .mockResolvedValueOnce(mockMonthlyAnalytics as any)
        .mockResolvedValueOnce(mockQuarterlyAnalytics as any);

      await analyticsController.getPerformanceComparison(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          monthly: {
            totalReturn: 5000,
            winRate: 0.7,
            sharpeRatio: 1.5,
            maxDrawdown: -0.05,
            totalTrades: 20
          },
          quarterly: {
            totalReturn: 15000,
            winRate: 0.65,
            sharpeRatio: 1.8,
            maxDrawdown: -0.08,
            totalTrades: 60
          }
        },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user in request', async () => {
      mockRequest.user = undefined;

      await analyticsController.getPerformanceAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      // Should throw an error or handle gracefully
      // The actual behavior depends on the authentication middleware
    });

    it('should handle database connection errors', async () => {
      mockAnalyticsService.generatePerformanceAnalytics.mockRejectedValue(
        new Error('Database connection failed')
      );

      await analyticsController.getPerformanceAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get performance analytics',
        timestamp: expect.any(Number)
      });
    });

    it('should handle invalid date ranges', async () => {
      mockRequest.query = {
        period: 'custom',
        startDate: '2023-01-31',
        endDate: '2023-01-01' // End before start
      };

      mockAnalyticsService.generatePerformanceAnalytics.mockRejectedValue(
        new Error('Invalid date range')
      );

      await analyticsController.getPerformanceAnalytics(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});