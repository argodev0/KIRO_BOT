/**
 * Analytics Controller
 * REST API endpoints for performance analytics and reporting
 */

import { Request, Response } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { VisualizationService } from '../services/VisualizationService';
import { ReportGeneratorService } from '../services/ReportGeneratorService';
import { AnalyticsPeriod, ReportType, ChartType } from '../types/analytics';
import { AuthRequest } from '../types/auth';
import { logger } from '../utils/logger';
import { db } from '../models/database';

export class AnalyticsController {
  private analyticsService: AnalyticsService;
  private visualizationService: VisualizationService;
  private reportGenerator: ReportGeneratorService;

  constructor() {
    this.analyticsService = new AnalyticsService(db);
    this.visualizationService = new VisualizationService();
    this.reportGenerator = new ReportGeneratorService();
  }

  /**
   * Get comprehensive performance analytics
   */
  getPerformanceAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        period = AnalyticsPeriod.MONTHLY,
        startDate,
        endDate 
      } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await this.analyticsService.generatePerformanceAnalytics(
        userId,
        period as AnalyticsPeriod,
        start,
        end
      );

      res.json({
        success: true,
        data: analytics,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting performance analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance analytics',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get pattern-specific analytics
   */
  getPatternAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        period = AnalyticsPeriod.MONTHLY,
        patternType,
        startDate,
        endDate 
      } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await this.analyticsService.generatePerformanceAnalytics(
        userId,
        period as AnalyticsPeriod,
        start,
        end
      );

      let patternAnalytics = analytics.patternAnalytics;
      
      if (patternType) {
        patternAnalytics = patternAnalytics.filter(p => p.patternType === patternType);
      }

      res.json({
        success: true,
        data: patternAnalytics,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting pattern analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pattern analytics',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get Elliott Wave analytics
   */
  getElliottWaveAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        period = AnalyticsPeriod.MONTHLY,
        startDate,
        endDate 
      } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await this.analyticsService.generatePerformanceAnalytics(
        userId,
        period as AnalyticsPeriod,
        start,
        end
      );

      res.json({
        success: true,
        data: analytics.elliottWaveAnalytics,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting Elliott Wave analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Elliott Wave analytics',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get Fibonacci analytics
   */
  getFibonacciAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        period = AnalyticsPeriod.MONTHLY,
        startDate,
        endDate 
      } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await this.analyticsService.generatePerformanceAnalytics(
        userId,
        period as AnalyticsPeriod,
        start,
        end
      );

      res.json({
        success: true,
        data: analytics.fibonacciAnalytics,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting Fibonacci analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Fibonacci analytics',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get grid trading analytics
   */
  getGridAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        period = AnalyticsPeriod.MONTHLY,
        startDate,
        endDate 
      } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await this.analyticsService.generatePerformanceAnalytics(
        userId,
        period as AnalyticsPeriod,
        start,
        end
      );

      res.json({
        success: true,
        data: analytics.gridAnalytics,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting grid analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get grid analytics',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get portfolio performance over time
   */
  getPortfolioPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        period = AnalyticsPeriod.MONTHLY,
        startDate,
        endDate 
      } = req.query;

      // Get portfolio snapshots over time
      const portfolios = await db.portfolio.findMany({
        where: {
          userId,
          updatedAt: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined
          }
        },
        orderBy: {
          updatedAt: 'asc'
        }
      });

      const performanceData = portfolios.map(portfolio => ({
        timestamp: portfolio.updatedAt,
        totalValue: Number(portfolio.totalBalance),
        unrealizedPnl: Number(portfolio.totalUnrealizedPnl),
        realizedPnl: Number(portfolio.totalRealizedPnl),
        drawdown: Number(portfolio.currentDrawdown)
      }));

      res.json({
        success: true,
        data: performanceData,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting portfolio performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get portfolio performance',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get performance visualization charts
   */
  getPerformanceCharts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        chartType = ChartType.LINE,
        period = AnalyticsPeriod.MONTHLY,
        startDate,
        endDate 
      } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await this.analyticsService.generatePerformanceAnalytics(
        userId,
        period as AnalyticsPeriod,
        start,
        end
      );

      const charts = await this.visualizationService.generatePerformanceCharts(
        analytics,
        chartType as ChartType
      );

      res.json({
        success: true,
        data: charts,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting performance charts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance charts',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Generate analytics report
   */
  generateReport = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        reportType = ReportType.PERFORMANCE_SUMMARY,
        period = AnalyticsPeriod.MONTHLY,
        format = 'json',
        startDate,
        endDate 
      } = req.body;

      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      const report = await this.reportGenerator.generateReport(
        userId,
        reportType as ReportType,
        period as AnalyticsPeriod,
        format as 'json' | 'pdf' | 'csv',
        start,
        end
      );

      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.pdf"`);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.csv"`);
      }

      res.json({
        success: true,
        data: report,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get trade execution analytics
   */
  getTradeExecutionAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        symbol,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      const executions = await db.tradeExecution.findMany({
        where: {
          userId,
          symbol: symbol as string || undefined,
          executedAt: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined
          }
        },
        include: {
          signal: true
        },
        orderBy: {
          executedAt: 'desc'
        },
        take: Number(limit),
        skip: Number(offset)
      });

      const analytics = executions.map(exec => ({
        id: exec.id,
        symbol: exec.symbol,
        side: exec.side,
        quantity: Number(exec.quantity),
        price: Number(exec.price),
        realizedPnl: exec.realizedPnl ? Number(exec.realizedPnl) : null,
        fee: exec.fee ? Number(exec.fee) : null,
        exchange: exec.exchange,
        executedAt: exec.executedAt,
        signal: exec.signal ? {
          confidence: Number(exec.signal.confidence),
          direction: exec.signal.direction,
          reasoning: exec.signal.reasoning
        } : null
      }));

      res.json({
        success: true,
        data: analytics,
        total: executions.length,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting trade execution analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trade execution analytics',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get risk metrics
   */
  getRiskMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        period = AnalyticsPeriod.MONTHLY,
        startDate,
        endDate 
      } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await this.analyticsService.generatePerformanceAnalytics(
        userId,
        period as AnalyticsPeriod,
        start,
        end
      );

      const riskMetrics = {
        maxDrawdown: analytics.maxDrawdown,
        currentDrawdown: analytics.currentDrawdown,
        sharpeRatio: analytics.sharpeRatio,
        sortinoRatio: analytics.sortinoRatio,
        calmarRatio: analytics.calmarRatio,
        maxConsecutiveLosses: analytics.maxConsecutiveLosses,
        winRate: analytics.winRate,
        totalReturn: analytics.totalReturn,
        volatility: 0 // TODO: Calculate from price data
      };

      res.json({
        success: true,
        data: riskMetrics,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting risk metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get risk metrics',
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get performance comparison
   */
  getPerformanceComparison = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { 
        comparePeriods = ['monthly', 'quarterly'],
        startDate,
        endDate 
      } = req.query;

      const periods = Array.isArray(comparePeriods) ? comparePeriods : [comparePeriods];
      const comparison: any = {};

      for (const period of periods) {
        const analytics = await this.analyticsService.generatePerformanceAnalytics(
          userId,
          period as AnalyticsPeriod,
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );

        comparison[period] = {
          totalReturn: analytics.totalReturn,
          winRate: analytics.winRate,
          sharpeRatio: analytics.sharpeRatio,
          maxDrawdown: analytics.maxDrawdown,
          totalTrades: analytics.totalTrades
        };
      }

      res.json({
        success: true,
        data: comparison,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting performance comparison:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance comparison',
        timestamp: Date.now()
      });
    }
  };
}