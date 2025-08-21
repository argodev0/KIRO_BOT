import { MonitoringService } from './MonitoringService';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface PerformanceThresholds {
  maxLatency: number;
  maxErrorRate: number;
  minThroughput: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
}

interface PerformanceMetrics {
  latency: {
    avg: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    tradesPerMinute: number;
    signalsPerMinute: number;
  };
  errorRate: {
    overall: number;
    byService: Map<string, number>;
    byExchange: Map<string, number>;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

export class PerformanceMonitoringService extends EventEmitter {
  private static instance: PerformanceMonitoringService;
  private monitoring: MonitoringService;
  private performanceData: Map<string, number[]> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private thresholds: PerformanceThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.monitoring = MonitoringService.getInstance();
    this.thresholds = {
      maxLatency: 1000, // 1 second
      maxErrorRate: 0.05, // 5%
      minThroughput: 10, // 10 requests per second
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      maxCpuUsage: 80 // 80%
    };
    this.startPerformanceMonitoring();
  }

  public static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  public recordLatency(operation: string, latency: number): void {
    if (!this.performanceData.has(`latency_${operation}`)) {
      this.performanceData.set(`latency_${operation}`, []);
    }
    
    const latencies = this.performanceData.get(`latency_${operation}`)!;
    latencies.push(latency);
    
    // Keep only last 1000 measurements
    if (latencies.length > 1000) {
      latencies.shift();
    }

    // Check threshold
    if (latency > this.thresholds.maxLatency) {
      this.emit('performance_alert', {
        type: 'high_latency',
        operation,
        value: latency,
        threshold: this.thresholds.maxLatency,
        timestamp: Date.now()
      });
    }
  }

  public recordThroughput(operation: string, count: number = 1): void {
    const key = `throughput_${operation}`;
    const current = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, current + count);
  }

  public recordError(service: string, errorType: string): void {
    const key = `${service}_${errorType}`;
    const current = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, current + 1);
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    const latencyMetrics = this.calculateLatencyMetrics();
    const throughputMetrics = this.calculateThroughputMetrics();
    const errorRateMetrics = this.calculateErrorRateMetrics();
    const resourceMetrics = this.getResourceMetrics();

    return {
      latency: latencyMetrics,
      throughput: throughputMetrics,
      errorRate: errorRateMetrics,
      resources: resourceMetrics
    };
  }

  private calculateLatencyMetrics(): PerformanceMetrics['latency'] {
    const allLatencies: number[] = [];
    
    for (const [key, values] of this.performanceData.entries()) {
      if (key.startsWith('latency_')) {
        allLatencies.push(...values);
      }
    }

    if (allLatencies.length === 0) {
      return { avg: 0, p95: 0, p99: 0 };
    }

    allLatencies.sort((a, b) => a - b);
    
    const avg = allLatencies.reduce((sum, val) => sum + val, 0) / allLatencies.length;
    const p95Index = Math.floor(allLatencies.length * 0.95);
    const p99Index = Math.floor(allLatencies.length * 0.99);
    
    return {
      avg: Math.round(avg),
      p95: allLatencies[p95Index] || 0,
      p99: allLatencies[p99Index] || 0
    };
  }

  private calculateThroughputMetrics(): PerformanceMetrics['throughput'] {
    const requestsPerSecond = (this.requestCounts.get('throughput_http_requests') || 0) / 60;
    const tradesPerMinute = this.requestCounts.get('throughput_trades') || 0;
    const signalsPerMinute = this.requestCounts.get('throughput_signals') || 0;

    return {
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      tradesPerMinute,
      signalsPerMinute
    };
  }

  private calculateErrorRateMetrics(): PerformanceMetrics['errorRate'] {
    const totalRequests = this.requestCounts.get('throughput_http_requests') || 1;
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    const overall = totalErrors / totalRequests;
    
    const byService = new Map<string, number>();
    const byExchange = new Map<string, number>();
    
    for (const [key, count] of this.errorCounts.entries()) {
      const [service, errorType] = key.split('_');
      
      if (service.includes('exchange')) {
        byExchange.set(service, (byExchange.get(service) || 0) + count);
      } else {
        byService.set(service, (byService.get(service) || 0) + count);
      }
    }

    return {
      overall: Math.round(overall * 10000) / 10000, // 4 decimal places
      byService,
      byExchange
    };
  }

  private getResourceMetrics(): PerformanceMetrics['resources'] {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memoryUsage: memUsage.heapUsed,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      activeConnections: 0 // This would be tracked separately
    };
  }

  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      try {
        this.checkPerformanceThresholds();
        this.resetCounters();
      } catch (error) {
        logger.error('Error in performance monitoring:', error);
      }
    }, 60000); // Check every minute
  }

  private checkPerformanceThresholds(): void {
    const metrics = this.getPerformanceMetrics();
    
    // Check latency thresholds
    if (metrics.latency.p95 > this.thresholds.maxLatency) {
      this.emit('performance_alert', {
        type: 'high_latency_p95',
        value: metrics.latency.p95,
        threshold: this.thresholds.maxLatency,
        timestamp: Date.now()
      });
    }

    // Check error rate thresholds
    if (metrics.errorRate.overall > this.thresholds.maxErrorRate) {
      this.emit('performance_alert', {
        type: 'high_error_rate',
        value: metrics.errorRate.overall,
        threshold: this.thresholds.maxErrorRate,
        timestamp: Date.now()
      });
    }

    // Check throughput thresholds
    if (metrics.throughput.requestsPerSecond < this.thresholds.minThroughput) {
      this.emit('performance_alert', {
        type: 'low_throughput',
        value: metrics.throughput.requestsPerSecond,
        threshold: this.thresholds.minThroughput,
        timestamp: Date.now()
      });
    }

    // Check resource thresholds
    if (metrics.resources.memoryUsage > this.thresholds.maxMemoryUsage) {
      this.emit('performance_alert', {
        type: 'high_memory_usage',
        value: metrics.resources.memoryUsage,
        threshold: this.thresholds.maxMemoryUsage,
        timestamp: Date.now()
      });
    }
  }

  private resetCounters(): void {
    // Reset throughput counters every minute
    this.requestCounts.clear();
    this.errorCounts.clear();
  }

  public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Performance thresholds updated:', this.thresholds);
  }

  public getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}