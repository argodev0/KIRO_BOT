/**
 * Visualization Service
 * Generate charts and visualizations for performance analytics
 */

import {
  PerformanceAnalytics,
  PatternAnalytics,
  ElliottWaveAnalytics,
  FibonacciAnalytics,
  GridAnalytics,
  AnalyticsVisualization,
  ChartType,
  ChartData,
  Dataset
} from '../types/analytics';
import { logger } from '../utils/logger';

export class VisualizationService {
  /**
   * Generate comprehensive performance charts
   */
  async generatePerformanceCharts(
    analytics: PerformanceAnalytics,
    chartType: ChartType = ChartType.LINE
  ): Promise<AnalyticsVisualization[]> {
    try {
      const charts: AnalyticsVisualization[] = [];

      // Performance overview chart
      charts.push(this.createPerformanceOverviewChart(analytics));

      // Win rate and trade distribution
      charts.push(this.createWinRateChart(analytics));

      // Risk metrics chart
      charts.push(this.createRiskMetricsChart(analytics));

      // Pattern performance chart
      if (analytics.patternAnalytics.length > 0) {
        charts.push(this.createPatternPerformanceChart(analytics.patternAnalytics));
      }

      // Elliott Wave performance chart
      charts.push(this.createElliottWaveChart(analytics.elliottWaveAnalytics));

      // Fibonacci performance chart
      charts.push(this.createFibonacciChart(analytics.fibonacciAnalytics));

      // Grid performance chart (if applicable)
      if (analytics.gridAnalytics) {
        charts.push(this.createGridPerformanceChart(analytics.gridAnalytics));
      }

      return charts;
    } catch (error) {
      logger.error('Error generating performance charts:', error);
      throw error;
    }
  }

  /**
   * Create performance overview chart
   */
  private createPerformanceOverviewChart(analytics: PerformanceAnalytics): AnalyticsVisualization {
    const data: ChartData = {
      labels: ['Total Return', 'Win Rate', 'Sharpe Ratio', 'Max Drawdown'],
      datasets: [{
        label: 'Performance Metrics',
        data: [
          analytics.totalReturnPercentage,
          analytics.winRate * 100,
          analytics.sharpeRatio * 10, // Scale for visibility
          Math.abs(analytics.maxDrawdown) * 100
        ],
        backgroundColor: [
          analytics.totalReturnPercentage >= 0 ? '#4CAF50' : '#F44336',
          analytics.winRate >= 0.5 ? '#4CAF50' : '#FF9800',
          analytics.sharpeRatio >= 1 ? '#4CAF50' : '#FF9800',
          analytics.maxDrawdown <= -0.1 ? '#F44336' : '#FF9800'
        ],
        borderColor: '#2196F3',
        borderWidth: 2
      }]
    };

    return {
      chartType: ChartType.BAR,
      title: 'Performance Overview',
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Percentage (%)'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const labels = ['Return %', 'Win Rate %', 'Sharpe Ratio (x10)', 'Max Drawdown %'];
                return `${labels[context.dataIndex]}: ${context.parsed.y.toFixed(2)}`;
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create win rate chart
   */
  private createWinRateChart(analytics: PerformanceAnalytics): AnalyticsVisualization {
    const data: ChartData = {
      labels: ['Winning Trades', 'Losing Trades'],
      datasets: [{
        label: 'Trade Distribution',
        data: [analytics.winningTrades, analytics.losingTrades],
        backgroundColor: ['#4CAF50', '#F44336'],
        borderColor: ['#388E3C', '#D32F2F'],
        borderWidth: 2
      }]
    };

    return {
      chartType: ChartType.DOUGHNUT,
      title: `Trade Distribution (${(analytics.winRate * 100).toFixed(1)}% Win Rate)`,
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const total = analytics.totalTrades;
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create risk metrics chart
   */
  private createRiskMetricsChart(analytics: PerformanceAnalytics): AnalyticsVisualization {
    const data: ChartData = {
      labels: ['Sharpe Ratio', 'Sortino Ratio', 'Calmar Ratio'],
      datasets: [{
        label: 'Risk-Adjusted Returns',
        data: [analytics.sharpeRatio, analytics.sortinoRatio, analytics.calmarRatio],
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        borderColor: '#2196F3',
        borderWidth: 2,
        fill: true
      }]
    };

    return {
      chartType: ChartType.LINE,
      title: 'Risk-Adjusted Performance Metrics',
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Ratio'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    };
  }

  /**
   * Create pattern performance chart
   */
  private createPatternPerformanceChart(patternAnalytics: PatternAnalytics[]): AnalyticsVisualization {
    const sortedPatterns = patternAnalytics
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10); // Top 10 patterns

    const data: ChartData = {
      labels: sortedPatterns.map(p => p.patternType),
      datasets: [
        {
          label: 'Success Rate (%)',
          data: sortedPatterns.map(p => p.successRate * 100),
          backgroundColor: 'rgba(76, 175, 80, 0.6)',
          borderColor: '#4CAF50',
          borderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: 'Total Signals',
          data: sortedPatterns.map(p => p.totalSignals),
          backgroundColor: 'rgba(255, 152, 0, 0.6)',
          borderColor: '#FF9800',
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    };

    return {
      chartType: ChartType.BAR,
      title: 'Pattern Performance Analysis',
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Pattern Type'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Success Rate (%)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Total Signals'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    };
  }

  /**
   * Create Elliott Wave performance chart
   */
  private createElliottWaveChart(elliottWave: ElliottWaveAnalytics): AnalyticsVisualization {
    const data: ChartData = {
      labels: ['Impulse Waves', 'Corrective Waves', 'Wave Targets', 'Overall Accuracy'],
      datasets: [{
        label: 'Elliott Wave Performance (%)',
        data: [
          elliottWave.impulseWavePerformance.successRate * 100,
          elliottWave.correctiveWavePerformance.successRate * 100,
          elliottWave.waveTargetAccuracy * 100,
          elliottWave.waveAccuracy * 100
        ],
        backgroundColor: [
          '#4CAF50',
          '#2196F3',
          '#FF9800',
          '#9C27B0'
        ],
        borderColor: '#333',
        borderWidth: 1
      }]
    };

    return {
      chartType: ChartType.BAR,
      title: 'Elliott Wave Analysis Performance',
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Accuracy (%)'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    };
  }

  /**
   * Create Fibonacci performance chart
   */
  private createFibonacciChart(fibonacci: FibonacciAnalytics): AnalyticsVisualization {
    const retracementLevels = Object.entries(fibonacci.retracementLevelPerformance);
    const extensionLevels = Object.entries(fibonacci.extensionLevelPerformance);

    const data: ChartData = {
      labels: [...retracementLevels.map(([level]) => `${level} Ret`), ...extensionLevels.map(([level]) => `${level} Ext`)],
      datasets: [{
        label: 'Fibonacci Level Accuracy (%)',
        data: [
          ...retracementLevels.map(([, perf]) => perf.accuracy * 100),
          ...extensionLevels.map(([, perf]) => perf.accuracy * 100)
        ],
        backgroundColor: retracementLevels.map(() => 'rgba(255, 193, 7, 0.6)')
          .concat(extensionLevels.map(() => 'rgba(156, 39, 176, 0.6)')),
        borderColor: retracementLevels.map(() => '#FFC107')
          .concat(extensionLevels.map(() => '#9C27B0')),
        borderWidth: 2
      }]
    };

    return {
      chartType: ChartType.BAR,
      title: 'Fibonacci Level Performance',
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Accuracy (%)'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    };
  }

  /**
   * Create grid performance chart
   */
  private createGridPerformanceChart(gridAnalytics: GridAnalytics): AnalyticsVisualization {
    const data: ChartData = {
      labels: ['Elliott Wave Grids', 'Fibonacci Grids', 'Standard Grids'],
      datasets: [
        {
          label: 'Success Rate (%)',
          data: [
            gridAnalytics.elliottWaveGridPerformance.successRate * 100,
            gridAnalytics.fibonacciGridPerformance.successRate * 100,
            gridAnalytics.standardGridPerformance.successRate * 100
          ],
          backgroundColor: 'rgba(33, 150, 243, 0.6)',
          borderColor: '#2196F3',
          borderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: 'Average Profit',
          data: [
            gridAnalytics.elliottWaveGridPerformance.averageProfit,
            gridAnalytics.fibonacciGridPerformance.averageProfit,
            gridAnalytics.standardGridPerformance.averageProfit
          ],
          backgroundColor: 'rgba(76, 175, 80, 0.6)',
          borderColor: '#4CAF50',
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    };

    return {
      chartType: ChartType.BAR,
      title: 'Grid Strategy Performance Comparison',
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Success Rate (%)'
            },
            max: 100
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Average Profit'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    };
  }

  /**
   * Generate portfolio performance time series chart
   */
  generatePortfolioTimeSeriesChart(
    portfolioData: Array<{
      timestamp: Date;
      totalValue: number;
      unrealizedPnl: number;
      realizedPnl: number;
      drawdown: number;
    }>
  ): AnalyticsVisualization {
    const labels = portfolioData.map(d => d.timestamp.toISOString().split('T')[0]);

    const data: ChartData = {
      labels,
      datasets: [
        {
          label: 'Portfolio Value',
          data: portfolioData.map(d => d.totalValue),
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          borderColor: '#2196F3',
          borderWidth: 2,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Drawdown (%)',
          data: portfolioData.map(d => d.drawdown * 100),
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          borderColor: '#F44336',
          borderWidth: 2,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    };

    return {
      chartType: ChartType.LINE,
      title: 'Portfolio Performance Over Time',
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Portfolio Value'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Drawdown (%)'
            },
            grid: {
              drawOnChartArea: false
            },
            max: 0
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    };
  }

  /**
   * Generate heatmap for pattern performance by time
   */
  generatePatternHeatmap(
    patternData: Array<{
      pattern: string;
      hour: number;
      successRate: number;
    }>
  ): AnalyticsVisualization {
    const patterns = [...new Set(patternData.map(d => d.pattern))];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const heatmapData = patterns.map(pattern => {
      return hours.map(hour => {
        const data = patternData.find(d => d.pattern === pattern && d.hour === hour);
        return data ? data.successRate * 100 : 0;
      });
    });

    const data: ChartData = {
      labels: hours.map(h => `${h}:00`),
      datasets: patterns.map((pattern, index) => ({
        label: pattern,
        data: heatmapData[index],
        backgroundColor: `hsla(${index * 360 / patterns.length}, 70%, 50%, 0.6)`,
        borderColor: `hsla(${index * 360 / patterns.length}, 70%, 40%, 1)`,
        borderWidth: 1
      }))
    };

    return {
      chartType: ChartType.BAR,
      title: 'Pattern Performance by Hour of Day',
      data,
      config: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Hour of Day'
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Success Rate (%)'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    };
  }
}