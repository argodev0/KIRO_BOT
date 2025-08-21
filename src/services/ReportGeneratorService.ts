/**
 * Report Generator Service
 * Generate comprehensive analytics reports in various formats
 */

import { AnalyticsService } from './AnalyticsService';
import { VisualizationService } from './VisualizationService';
import {
  AnalyticsReport,
  ReportType,
  AnalyticsPeriod,
  PerformanceAnalytics
} from '../types/analytics';
import { logger } from '../utils/logger';
import { db } from '../models/database';

export class ReportGeneratorService {
  private analyticsService: AnalyticsService;
  private visualizationService: VisualizationService;

  constructor() {
    this.analyticsService = new AnalyticsService(db);
    this.visualizationService = new VisualizationService();
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateReport(
    userId: string,
    reportType: ReportType,
    period: AnalyticsPeriod,
    format: 'json' | 'pdf' | 'csv' = 'json',
    startDate?: Date,
    endDate?: Date
  ): Promise<AnalyticsReport> {
    try {
      const analytics = await this.analyticsService.generatePerformanceAnalytics(
        userId,
        period,
        startDate,
        endDate
      );

      let reportData: any;

      switch (reportType) {
        case ReportType.PERFORMANCE_SUMMARY:
          reportData = await this.generatePerformanceSummaryReport(analytics);
          break;
        case ReportType.PATTERN_ANALYSIS:
          reportData = await this.generatePatternAnalysisReport(analytics);
          break;
        case ReportType.ELLIOTT_WAVE_ANALYSIS:
          reportData = await this.generateElliottWaveReport(analytics);
          break;
        case ReportType.FIBONACCI_ANALYSIS:
          reportData = await this.generateFibonacciReport(analytics);
          break;
        case ReportType.GRID_ANALYSIS:
          reportData = await this.generateGridAnalysisReport(analytics);
          break;
        case ReportType.RISK_ANALYSIS:
          reportData = await this.generateRiskAnalysisReport(analytics);
          break;
        case ReportType.PORTFOLIO_ANALYSIS:
          reportData = await this.generatePortfolioAnalysisReport(userId, analytics);
          break;
        default:
          reportData = analytics;
      }

      const report: AnalyticsReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        reportType,
        period,
        data: reportData,
        generatedAt: new Date(),
        format
      };

      // Store report in database
      await this.storeReport(report);

      // Format report based on requested format
      if (format === 'csv') {
        report.data = this.convertToCSV(reportData, reportType);
      } else if (format === 'pdf') {
        report.data = await this.generatePDFReport(reportData, reportType);
      }

      return report;
    } catch (error) {
      logger.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Generate performance summary report
   */
  private async generatePerformanceSummaryReport(analytics: PerformanceAnalytics): Promise<any> {
    const charts = await this.visualizationService.generatePerformanceCharts(analytics);

    return {
      summary: {
        period: analytics.period,
        dateRange: {
          start: analytics.startDate,
          end: analytics.endDate
        },
        keyMetrics: {
          totalReturn: analytics.totalReturn,
          totalReturnPercentage: analytics.totalReturnPercentage,
          winRate: analytics.winRate,
          sharpeRatio: analytics.sharpeRatio,
          maxDrawdown: analytics.maxDrawdown,
          totalTrades: analytics.totalTrades
        }
      },
      performance: {
        financial: {
          realizedPnl: analytics.realizedPnl,
          unrealizedPnl: analytics.unrealizedPnl,
          totalReturn: analytics.totalReturn,
          returnPercentage: analytics.totalReturnPercentage
        },
        risk: {
          sharpeRatio: analytics.sharpeRatio,
          sortinoRatio: analytics.sortinoRatio,
          calmarRatio: analytics.calmarRatio,
          maxDrawdown: analytics.maxDrawdown,
          currentDrawdown: analytics.currentDrawdown
        },
        trading: {
          totalTrades: analytics.totalTrades,
          winningTrades: analytics.winningTrades,
          losingTrades: analytics.losingTrades,
          winRate: analytics.winRate,
          averageTradesPerDay: analytics.averageTradesPerDay,
          averageHoldingTime: analytics.averageHoldingTime,
          maxConsecutiveWins: analytics.maxConsecutiveWins,
          maxConsecutiveLosses: analytics.maxConsecutiveLosses
        }
      },
      analysis: {
        patterns: analytics.patternAnalytics,
        elliottWave: analytics.elliottWaveAnalytics,
        fibonacci: analytics.fibonacciAnalytics,
        grid: analytics.gridAnalytics
      },
      visualizations: charts,
      recommendations: this.generateRecommendations(analytics)
    };
  }

  /**
   * Generate pattern analysis report
   */
  private async generatePatternAnalysisReport(analytics: PerformanceAnalytics): Promise<any> {
    const patternCharts = analytics.patternAnalytics.map(pattern => ({
      pattern: pattern.patternType,
      chart: {
        chartType: 'bar',
        title: `${pattern.patternType} Performance`,
        data: {
          labels: ['Success Rate', 'Total Signals', 'Avg Return', 'Avg Hold Time'],
          datasets: [{
            label: pattern.patternType,
            data: [
              pattern.successRate * 100,
              pattern.totalSignals,
              pattern.averageReturn,
              pattern.averageHoldingTime
            ],
            backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0']
          }]
        }
      }
    }));

    return {
      summary: {
        totalPatterns: analytics.patternAnalytics.length,
        bestPerformingPattern: analytics.patternAnalytics.reduce((best, current) => 
          current.successRate > best.successRate ? current : best, analytics.patternAnalytics[0]),
        worstPerformingPattern: analytics.patternAnalytics.reduce((worst, current) => 
          current.successRate < worst.successRate ? current : worst, analytics.patternAnalytics[0])
      },
      patterns: analytics.patternAnalytics.map(pattern => ({
        ...pattern,
        performance: this.categorizePerformance(pattern.successRate),
        reliability: this.assessReliability(pattern.totalSignals, pattern.successRate),
        recommendations: this.generatePatternRecommendations(pattern)
      })),
      visualizations: patternCharts,
      insights: this.generatePatternInsights(analytics.patternAnalytics)
    };
  }

  /**
   * Generate Elliott Wave analysis report
   */
  private async generateElliottWaveReport(analytics: PerformanceAnalytics): Promise<any> {
    const elliottWave = analytics.elliottWaveAnalytics;

    return {
      summary: {
        overallAccuracy: elliottWave.waveAccuracy,
        totalAnalyses: elliottWave.totalWaveAnalyses,
        correctIdentifications: elliottWave.correctWaveIdentifications,
        targetAccuracy: elliottWave.waveTargetAccuracy
      },
      wavePerformance: {
        impulse: {
          ...elliottWave.impulseWavePerformance,
          performance: this.categorizePerformance(elliottWave.impulseWavePerformance.successRate)
        },
        corrective: {
          ...elliottWave.correctiveWavePerformance,
          performance: this.categorizePerformance(elliottWave.correctiveWavePerformance.successRate)
        }
      },
      degreeAccuracy: elliottWave.waveDegreeAccuracy,
      projectionAccuracy: {
        waveTargets: elliottWave.waveTargetAccuracy,
        fibonacciProjections: elliottWave.fibonacciProjectionAccuracy
      },
      insights: this.generateElliottWaveInsights(elliottWave),
      recommendations: this.generateElliottWaveRecommendations(elliottWave)
    };
  }

  /**
   * Generate Fibonacci analysis report
   */
  private async generateFibonacciReport(analytics: PerformanceAnalytics): Promise<any> {
    const fibonacci = analytics.fibonacciAnalytics;

    return {
      summary: {
        totalSignals: fibonacci.totalFibonacciSignals,
        retracementSuccess: fibonacci.successfulRetracements,
        extensionSuccess: fibonacci.successfulExtensions,
        confluenceAccuracy: fibonacci.confluenceZoneAccuracy,
        goldenRatioAccuracy: fibonacci.goldenRatioPerformance.accuracy
      },
      levelPerformance: {
        retracements: Object.entries(fibonacci.retracementLevelPerformance).map(([level, perf]) => ({
          level: parseFloat(level),
          ...perf,
          performance: this.categorizePerformance(perf.accuracy)
        })),
        extensions: Object.entries(fibonacci.extensionLevelPerformance).map(([level, perf]) => ({
          level: parseFloat(level),
          ...perf,
          performance: this.categorizePerformance(perf.accuracy)
        }))
      },
      specialLevels: {
        goldenRatio: {
          ...fibonacci.goldenRatioPerformance,
          performance: this.categorizePerformance(fibonacci.goldenRatioPerformance.accuracy)
        },
        confluenceZones: {
          accuracy: fibonacci.confluenceZoneAccuracy,
          performance: this.categorizePerformance(fibonacci.confluenceZoneAccuracy)
        }
      },
      insights: this.generateFibonacciInsights(fibonacci),
      recommendations: this.generateFibonacciRecommendations(fibonacci)
    };
  }

  /**
   * Generate grid analysis report
   */
  private async generateGridAnalysisReport(analytics: PerformanceAnalytics): Promise<any> {
    if (!analytics.gridAnalytics) {
      return { message: 'No grid trading data available for this period' };
    }

    const grid = analytics.gridAnalytics;

    return {
      summary: {
        totalGrids: grid.totalGrids,
        activeGrids: grid.activeGrids,
        completedGrids: grid.completedGrids,
        totalProfit: grid.totalGridProfit,
        averageProfit: grid.averageGridProfit,
        successRate: grid.gridSuccessRate
      },
      strategyComparison: {
        elliottWave: {
          ...grid.elliottWaveGridPerformance,
          performance: this.categorizePerformance(grid.elliottWaveGridPerformance.successRate)
        },
        fibonacci: {
          ...grid.fibonacciGridPerformance,
          performance: this.categorizePerformance(grid.fibonacciGridPerformance.successRate)
        },
        standard: {
          ...grid.standardGridPerformance,
          performance: this.categorizePerformance(grid.standardGridPerformance.successRate)
        }
      },
      efficiency: {
        averageDuration: grid.averageGridDuration,
        fillRate: grid.averageFillRate,
        optimalSpacing: grid.optimalSpacingAnalysis
      },
      insights: this.generateGridInsights(grid),
      recommendations: this.generateGridRecommendations(grid)
    };
  }

  /**
   * Generate risk analysis report
   */
  private async generateRiskAnalysisReport(analytics: PerformanceAnalytics): Promise<any> {
    return {
      summary: {
        riskLevel: this.assessRiskLevel(analytics),
        maxDrawdown: analytics.maxDrawdown,
        currentDrawdown: analytics.currentDrawdown,
        sharpeRatio: analytics.sharpeRatio,
        consecutiveRisk: Math.max(analytics.maxConsecutiveLosses, analytics.maxConsecutiveWins)
      },
      metrics: {
        drawdown: {
          maximum: analytics.maxDrawdown,
          current: analytics.currentDrawdown,
          status: this.getDrawdownStatus(analytics.currentDrawdown)
        },
        ratios: {
          sharpe: {
            value: analytics.sharpeRatio,
            rating: this.rateSharpeRatio(analytics.sharpeRatio)
          },
          sortino: {
            value: analytics.sortinoRatio,
            rating: this.rateSortinoRatio(analytics.sortinoRatio)
          },
          calmar: {
            value: analytics.calmarRatio,
            rating: this.rateCalmarRatio(analytics.calmarRatio)
          }
        },
        consistency: {
          winRate: analytics.winRate,
          maxConsecutiveLosses: analytics.maxConsecutiveLosses,
          maxConsecutiveWins: analytics.maxConsecutiveWins,
          tradingFrequency: analytics.averageTradesPerDay
        }
      },
      riskFactors: this.identifyRiskFactors(analytics),
      recommendations: this.generateRiskRecommendations(analytics)
    };
  }

  /**
   * Generate portfolio analysis report
   */
  private async generatePortfolioAnalysisReport(userId: string, analytics: PerformanceAnalytics): Promise<any> {
    // Get recent portfolio data
    const portfolios = await db.portfolio.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30
    });

    const portfolioData = portfolios.map(p => ({
      timestamp: p.updatedAt,
      totalValue: Number(p.totalBalance),
      unrealizedPnl: Number(p.totalUnrealizedPnl),
      realizedPnl: Number(p.totalRealizedPnl),
      drawdown: Number(p.currentDrawdown)
    }));

    const timeSeriesChart = this.visualizationService.generatePortfolioTimeSeriesChart(portfolioData);

    return {
      summary: {
        currentValue: portfolioData[0]?.totalValue || 0,
        totalReturn: analytics.totalReturn,
        returnPercentage: analytics.totalReturnPercentage,
        unrealizedPnl: analytics.unrealizedPnl,
        realizedPnl: analytics.realizedPnl
      },
      performance: {
        timeSeriesData: portfolioData,
        growthRate: this.calculateGrowthRate(portfolioData),
        volatility: this.calculatePortfolioVolatility(portfolioData),
        consistency: this.assessConsistency(portfolioData)
      },
      visualization: timeSeriesChart,
      insights: this.generatePortfolioInsights(portfolioData, analytics),
      recommendations: this.generatePortfolioRecommendations(portfolioData, analytics)
    };
  }

  // Helper methods for report generation
  private categorizePerformance(rate: number): string {
    if (rate >= 0.8) return 'Excellent';
    if (rate >= 0.6) return 'Good';
    if (rate >= 0.4) return 'Average';
    if (rate >= 0.2) return 'Poor';
    return 'Very Poor';
  }

  private assessReliability(totalSignals: number, successRate: number): string {
    const score = totalSignals * successRate;
    if (score >= 50) return 'High';
    if (score >= 20) return 'Medium';
    return 'Low';
  }

  private assessRiskLevel(analytics: PerformanceAnalytics): string {
    const riskScore = (
      (analytics.maxDrawdown * 100) +
      (analytics.maxConsecutiveLosses * 5) +
      ((1 - analytics.winRate) * 50) +
      (analytics.sharpeRatio < 1 ? 20 : 0)
    );

    if (riskScore >= 80) return 'High';
    if (riskScore >= 50) return 'Medium';
    return 'Low';
  }

  private getDrawdownStatus(drawdown: number): string {
    if (drawdown <= -0.2) return 'Critical';
    if (drawdown <= -0.1) return 'High';
    if (drawdown <= -0.05) return 'Moderate';
    return 'Low';
  }

  private rateSharpeRatio(ratio: number): string {
    if (ratio >= 2) return 'Excellent';
    if (ratio >= 1) return 'Good';
    if (ratio >= 0.5) return 'Average';
    return 'Poor';
  }

  private rateSortinoRatio(ratio: number): string {
    if (ratio >= 2) return 'Excellent';
    if (ratio >= 1.5) return 'Good';
    if (ratio >= 1) return 'Average';
    return 'Poor';
  }

  private rateCalmarRatio(ratio: number): string {
    if (ratio >= 3) return 'Excellent';
    if (ratio >= 2) return 'Good';
    if (ratio >= 1) return 'Average';
    return 'Poor';
  }

  private generateRecommendations(analytics: PerformanceAnalytics): string[] {
    const recommendations: string[] = [];

    if (analytics.winRate < 0.5) {
      recommendations.push('Consider improving signal quality - win rate is below 50%');
    }

    if (analytics.sharpeRatio < 1) {
      recommendations.push('Focus on risk-adjusted returns - Sharpe ratio could be improved');
    }

    if (analytics.maxDrawdown < -0.15) {
      recommendations.push('Implement stricter risk management - maximum drawdown is concerning');
    }

    if (analytics.maxConsecutiveLosses > 5) {
      recommendations.push('Review position sizing and stop-loss strategies');
    }

    return recommendations;
  }

  private generatePatternRecommendations(pattern: any): string[] {
    const recommendations: string[] = [];

    if (pattern.successRate < 0.4) {
      recommendations.push(`Consider reducing reliance on ${pattern.patternType} - low success rate`);
    }

    if (pattern.totalSignals < 10) {
      recommendations.push(`Gather more data for ${pattern.patternType} - sample size is small`);
    }

    return recommendations;
  }

  private generatePatternInsights(patterns: any[]): string[] {
    const insights: string[] = [];
    
    const bestPattern = patterns.reduce((best, current) => 
      current.successRate > best.successRate ? current : best, patterns[0]);
    
    insights.push(`Best performing pattern: ${bestPattern.patternType} with ${(bestPattern.successRate * 100).toFixed(1)}% success rate`);

    const highVolumePatterns = patterns.filter(p => p.totalSignals > 20);
    if (highVolumePatterns.length > 0) {
      insights.push(`${highVolumePatterns.length} patterns have sufficient sample size (>20 signals)`);
    }

    return insights;
  }

  private generateElliottWaveInsights(elliottWave: any): string[] {
    const insights: string[] = [];

    if (elliottWave.impulseWavePerformance.successRate > elliottWave.correctiveWavePerformance.successRate) {
      insights.push('Impulse wave identification performs better than corrective waves');
    }

    if (elliottWave.waveTargetAccuracy > 0.7) {
      insights.push('Wave target projections are highly accurate');
    }

    return insights;
  }

  private generateElliottWaveRecommendations(elliottWave: any): string[] {
    const recommendations: string[] = [];

    if (elliottWave.waveAccuracy < 0.6) {
      recommendations.push('Consider refining Elliott Wave identification algorithms');
    }

    if (elliottWave.waveTargetAccuracy < 0.5) {
      recommendations.push('Review wave target calculation methods');
    }

    return recommendations;
  }

  private generateFibonacciInsights(fibonacci: any): string[] {
    const insights: string[] = [];

    if (fibonacci.goldenRatioPerformance.accuracy > 0.7) {
      insights.push('Golden ratio (0.618) shows strong performance');
    }

    if (fibonacci.confluenceZoneAccuracy > 0.6) {
      insights.push('Confluence zones provide reliable trading opportunities');
    }

    return insights;
  }

  private generateFibonacciRecommendations(fibonacci: any): string[] {
    const recommendations: string[] = [];

    if (fibonacci.confluenceZoneAccuracy > 0.7) {
      recommendations.push('Focus more on confluence zone trading');
    }

    const bestLevel = Object.entries(fibonacci.retracementLevelPerformance)
      .reduce((best: any, [level, perf]: [string, any]) => 
        perf.accuracy > best.accuracy ? { level, ...perf } : best, { accuracy: 0 });

    if (bestLevel.accuracy > 0.7) {
      recommendations.push(`Prioritize ${bestLevel.level} retracement level - highest accuracy`);
    }

    return recommendations;
  }

  private generateGridInsights(grid: any): string[] {
    const insights: string[] = [];

    const strategies = [
      { name: 'Elliott Wave', perf: grid.elliottWaveGridPerformance },
      { name: 'Fibonacci', perf: grid.fibonacciGridPerformance },
      { name: 'Standard', perf: grid.standardGridPerformance }
    ];

    const bestStrategy = strategies.reduce((best, current) => 
      current.perf.successRate > best.perf.successRate ? current : best);

    insights.push(`${bestStrategy.name} grids perform best with ${(bestStrategy.perf.successRate * 100).toFixed(1)}% success rate`);

    return insights;
  }

  private generateGridRecommendations(grid: any): string[] {
    const recommendations: string[] = [];

    if (grid.gridSuccessRate < 0.6) {
      recommendations.push('Consider optimizing grid spacing and strategy selection');
    }

    return recommendations;
  }

  private identifyRiskFactors(analytics: PerformanceAnalytics): string[] {
    const factors: string[] = [];

    if (analytics.maxDrawdown < -0.2) {
      factors.push('High maximum drawdown');
    }

    if (analytics.maxConsecutiveLosses > 7) {
      factors.push('Extended losing streaks');
    }

    if (analytics.winRate < 0.4) {
      factors.push('Low win rate');
    }

    return factors;
  }

  private generateRiskRecommendations(analytics: PerformanceAnalytics): string[] {
    const recommendations: string[] = [];

    if (analytics.maxDrawdown < -0.15) {
      recommendations.push('Implement position sizing limits');
      recommendations.push('Consider daily loss limits');
    }

    if (analytics.sharpeRatio < 0.5) {
      recommendations.push('Focus on risk-adjusted returns');
    }

    return recommendations;
  }

  private calculateGrowthRate(portfolioData: any[]): number {
    if (portfolioData.length < 2) return 0;
    
    const initial = portfolioData[portfolioData.length - 1].totalValue;
    const final = portfolioData[0].totalValue;
    
    return ((final - initial) / initial) * 100;
  }

  private calculatePortfolioVolatility(portfolioData: any[]): number {
    if (portfolioData.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < portfolioData.length; i++) {
      const currentValue = portfolioData[i - 1].totalValue;
      const previousValue = portfolioData[i].totalValue;
      const dailyReturn = (currentValue - previousValue) / previousValue;
      returns.push(dailyReturn);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  private assessConsistency(portfolioData: any[]): string {
    const volatility = this.calculatePortfolioVolatility(portfolioData);
    
    if (volatility < 0.1) return 'High';
    if (volatility < 0.2) return 'Medium';
    return 'Low';
  }

  private generatePortfolioInsights(portfolioData: any[], analytics: PerformanceAnalytics): string[] {
    const insights: string[] = [];
    
    const growthRate = this.calculateGrowthRate(portfolioData);
    insights.push(`Portfolio growth rate: ${growthRate.toFixed(2)}%`);
    
    const consistency = this.assessConsistency(portfolioData);
    insights.push(`Portfolio consistency: ${consistency}`);
    
    return insights;
  }

  private generatePortfolioRecommendations(portfolioData: any[], analytics: PerformanceAnalytics): string[] {
    const recommendations: string[] = [];
    
    const volatility = this.calculatePortfolioVolatility(portfolioData);
    if (volatility > 0.3) {
      recommendations.push('Consider reducing position sizes to lower volatility');
    }
    
    if (analytics.currentDrawdown < -0.1) {
      recommendations.push('Monitor current drawdown closely');
    }
    
    return recommendations;
  }

  private convertToCSV(data: any, reportType: ReportType): string {
    // Simple CSV conversion - would need more sophisticated implementation
    return JSON.stringify(data);
  }

  private async generatePDFReport(data: any, reportType: ReportType): Promise<string> {
    // PDF generation would require a library like puppeteer or jsPDF
    // For now, return a placeholder
    return `PDF report for ${reportType} - ${JSON.stringify(data)}`;
  }

  private async storeReport(report: AnalyticsReport): Promise<void> {
    await db.performanceMetric.create({
      data: {
        userId: report.userId,
        metricType: `report_${report.reportType}`,
        metricValue: 0,
        metadata: report,
        period: report.period
      }
    });
  }
}