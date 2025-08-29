import { EventEmitter } from 'events';
import { MonitoringService } from './MonitoringService';
import { logger, logPerformanceMetric } from '../utils/logger';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';

interface SystemThresholds {
  maxMemoryUsage: number; // Percentage
  maxCpuUsage: number; // Percentage
  maxLoadAverage: number; // Load average threshold
  minDiskSpace: number; // Bytes
  maxEventLoopLag: number; // Milliseconds
}

interface PerformanceAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export class SystemPerformanceMonitor extends EventEmitter {
  private static instance: SystemPerformanceMonitor;
  private monitoring: MonitoringService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private eventLoopMonitorInterval: NodeJS.Timeout | null = null;
  
  private thresholds: SystemThresholds = {
    maxMemoryUsage: 85, // 85%
    maxCpuUsage: 80, // 80%
    maxLoadAverage: os.cpus().length * 2, // 2x CPU cores
    minDiskSpace: 1024 * 1024 * 1024, // 1GB
    maxEventLoopLag: 100 // 100ms
  };

  private performanceHistory: Map<string, number[]> = new Map();
  private alertCooldowns: Map<string, number> = new Map();
  private readonly COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    super();
    this.monitoring = MonitoringService.getInstance();
    this.startMonitoring();
  }

  public static getInstance(): SystemPerformanceMonitor {
    if (!SystemPerformanceMonitor.instance) {
      SystemPerformanceMonitor.instance = new SystemPerformanceMonitor();
    }
    return SystemPerformanceMonitor.instance;
  }

  private startMonitoring(): void {
    // System metrics monitoring every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Event loop monitoring every 5 seconds
    this.eventLoopMonitorInterval = setInterval(() => {
      this.monitorEventLoop();
    }, 5000);

    logger.info('System performance monitoring started');
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      await Promise.all([
        this.monitorMemoryUsage(),
        this.monitorCpuUsage(),
        this.monitorLoadAverage(),
        this.monitorDiskSpace(),
        this.monitorNetworkConnections()
      ]);
    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  private async monitorMemoryUsage(): Promise<void> {
    const memUsage = process.memoryUsage();
    const systemMemory = {
      free: os.freemem(),
      total: os.totalmem()
    };

    // Process memory usage
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.recordMetric('heap_memory_usage', heapUsagePercent);

    if (heapUsagePercent > this.thresholds.maxMemoryUsage) {
      this.emitAlert({
        type: 'high_heap_memory_usage',
        severity: heapUsagePercent > 95 ? 'critical' : 'high',
        message: `Heap memory usage is ${heapUsagePercent.toFixed(2)}%`,
        value: heapUsagePercent,
        threshold: this.thresholds.maxMemoryUsage,
        timestamp: Date.now()
      });
    }

    // System memory usage
    const systemMemoryUsagePercent = ((systemMemory.total - systemMemory.free) / systemMemory.total) * 100;
    this.recordMetric('system_memory_usage', systemMemoryUsagePercent);

    if (systemMemoryUsagePercent > this.thresholds.maxMemoryUsage) {
      this.emitAlert({
        type: 'high_system_memory_usage',
        severity: systemMemoryUsagePercent > 95 ? 'critical' : 'high',
        message: `System memory usage is ${systemMemoryUsagePercent.toFixed(2)}%`,
        value: systemMemoryUsagePercent,
        threshold: this.thresholds.maxMemoryUsage,
        timestamp: Date.now()
      });
    }

    logPerformanceMetric('memory_usage', heapUsagePercent, {
      type: 'heap',
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    });

    logPerformanceMetric('system_memory_usage', systemMemoryUsagePercent, {
      type: 'system',
      free: systemMemory.free,
      total: systemMemory.total
    });
  }

  private async monitorCpuUsage(): Promise<void> {
    // Get CPU usage over a 1-second interval
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const endUsage = process.cpuUsage(startUsage);

    const cpuPercent = ((endUsage.user + endUsage.system) / 1000000) * 100; // Convert to percentage
    this.recordMetric('cpu_usage', cpuPercent);

    if (cpuPercent > this.thresholds.maxCpuUsage) {
      this.emitAlert({
        type: 'high_cpu_usage',
        severity: cpuPercent > 95 ? 'critical' : 'high',
        message: `CPU usage is ${cpuPercent.toFixed(2)}%`,
        value: cpuPercent,
        threshold: this.thresholds.maxCpuUsage,
        timestamp: Date.now()
      });
    }

    logPerformanceMetric('cpu_usage', cpuPercent, {
      user: endUsage.user,
      system: endUsage.system
    });
  }

  private async monitorLoadAverage(): Promise<void> {
    const loadAvg = os.loadavg();
    const load1min = loadAvg[0];
    
    this.recordMetric('load_average_1min', load1min);

    if (load1min > this.thresholds.maxLoadAverage) {
      this.emitAlert({
        type: 'high_load_average',
        severity: load1min > this.thresholds.maxLoadAverage * 1.5 ? 'critical' : 'high',
        message: `Load average (1min) is ${load1min.toFixed(2)}`,
        value: load1min,
        threshold: this.thresholds.maxLoadAverage,
        timestamp: Date.now()
      });
    }

    logPerformanceMetric('load_average', load1min, {
      period: '1min',
      load5min: loadAvg[1],
      load15min: loadAvg[2],
      cpuCores: os.cpus().length
    });
  }

  private async monitorDiskSpace(): Promise<void> {
    try {
      const stats = await promisify(fs.stat)('.');
      if ('bavail' in stats && 'frsize' in stats) {
        const availableSpace = (stats as any).bavail * (stats as any).frsize;
        
        this.recordMetric('disk_space_available', availableSpace);

        if (availableSpace < this.thresholds.minDiskSpace) {
          this.emitAlert({
            type: 'low_disk_space',
            severity: availableSpace < this.thresholds.minDiskSpace / 2 ? 'critical' : 'high',
            message: `Available disk space is ${(availableSpace / 1024 / 1024 / 1024).toFixed(2)}GB`,
            value: availableSpace,
            threshold: this.thresholds.minDiskSpace,
            timestamp: Date.now()
          });
        }

        logPerformanceMetric('disk_space', availableSpace, {
          availableGB: (availableSpace / 1024 / 1024 / 1024).toFixed(2)
        });
      }
    } catch (error) {
      // Disk space monitoring not available on this platform
      logger.debug('Disk space monitoring not available:', error);
    }
  }

  private async monitorNetworkConnections(): Promise<void> {
    try {
      // This is a simplified network monitoring
      // In production, you might want to use more sophisticated tools
      const connections = {
        active: 0, // Would be implemented with actual network monitoring
        established: 0,
        listening: 0
      };

      logPerformanceMetric('network_connections', connections.active, {
        established: connections.established,
        listening: connections.listening
      });
    } catch (error) {
      logger.debug('Network monitoring error:', error);
    }
  }

  private monitorEventLoop(): void {
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      this.recordMetric('event_loop_lag', lag);

      if (lag > this.thresholds.maxEventLoopLag) {
        this.emitAlert({
          type: 'high_event_loop_lag',
          severity: lag > this.thresholds.maxEventLoopLag * 2 ? 'critical' : 'medium',
          message: `Event loop lag is ${lag.toFixed(2)}ms`,
          value: lag,
          threshold: this.thresholds.maxEventLoopLag,
          timestamp: Date.now()
        });
      }

      logPerformanceMetric('event_loop_lag', lag);
    });
  }

  private recordMetric(name: string, value: number): void {
    if (!this.performanceHistory.has(name)) {
      this.performanceHistory.set(name, []);
    }

    const history = this.performanceHistory.get(name)!;
    history.push(value);

    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }
  }

  private emitAlert(alert: PerformanceAlert): void {
    const cooldownKey = `${alert.type}_${alert.severity}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey) || 0;
    const now = Date.now();

    // Check cooldown period
    if (now - lastAlert < this.COOLDOWN_PERIOD) {
      return;
    }

    this.alertCooldowns.set(cooldownKey, now);
    
    logger.warn('Performance alert', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      value: alert.value,
      threshold: alert.threshold,
      timestamp: new Date(alert.timestamp).toISOString()
    });

    this.emit('performance_alert', alert);
  }

  public getPerformanceHistory(metricName?: string): Map<string, number[]> | number[] {
    if (metricName) {
      return this.performanceHistory.get(metricName) || [];
    }
    return this.performanceHistory;
  }

  public updateThresholds(newThresholds: Partial<SystemThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('System performance thresholds updated:', this.thresholds);
  }

  public getThresholds(): SystemThresholds {
    return { ...this.thresholds };
  }

  public getCurrentMetrics(): any {
    const memUsage = process.memoryUsage();
    const systemMemory = {
      free: os.freemem(),
      total: os.totalmem()
    };
    const loadAvg = os.loadavg();

    return {
      memory: {
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        },
        system: {
          free: systemMemory.free,
          total: systemMemory.total,
          percentage: ((systemMemory.total - systemMemory.free) / systemMemory.total) * 100
        }
      },
      cpu: {
        usage: process.cpuUsage(),
        cores: os.cpus().length
      },
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2]
      },
      uptime: {
        process: process.uptime(),
        system: os.uptime()
      },
      platform: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname()
      }
    };
  }

  // Additional methods for test compatibility
  public memoryUsage(): number {
    const memUsage = process.memoryUsage();
    return (memUsage.heapUsed / memUsage.heapTotal) * 100;
  }

  public cpuUsage(): number {
    // Return cached CPU usage or calculate synchronously
    const history = this.performanceHistory.get('cpu_usage') || [];
    return history.length > 0 ? history[history.length - 1] : 0;
  }

  public diskUsage(): number {
    // Return cached disk usage or calculate
    const history = this.performanceHistory.get('disk_space_available') || [];
    if (history.length > 0) {
      const available = history[history.length - 1];
      // Convert to usage percentage (assuming 100GB total for calculation)
      const total = 100 * 1024 * 1024 * 1024; // 100GB
      return ((total - available) / total) * 100;
    }
    return 0;
  }

  public networkLatency(): number {
    // Return cached network latency or default
    const history = this.performanceHistory.get('network_latency') || [];
    return history.length > 0 ? history[history.length - 1] : 0;
  }

  public responseTime(): number {
    // Return cached response time or default
    const history = this.performanceHistory.get('response_time') || [];
    return history.length > 0 ? history[history.length - 1] : 0;
  }

  public throughput(): number {
    // Return cached throughput or default
    const history = this.performanceHistory.get('throughput') || [];
    return history.length > 0 ? history[history.length - 1] : 0;
  }

  public errorRate(): number {
    // Return cached error rate or default
    const history = this.performanceHistory.get('error_rate') || [];
    return history.length > 0 ? history[history.length - 1] : 0;
  }

  public activeConnections(): number {
    // Return cached active connections or default
    const history = this.performanceHistory.get('active_connections') || [];
    return history.length > 0 ? history[history.length - 1] : 0;
  }

  // Methods to record additional metrics
  public recordNetworkLatency(latency: number): void {
    this.recordMetric('network_latency', latency);
  }

  public recordResponseTime(responseTime: number): void {
    this.recordMetric('response_time', responseTime);
  }

  public recordThroughput(throughput: number): void {
    this.recordMetric('throughput', throughput);
  }

  public recordErrorRate(errorRate: number): void {
    this.recordMetric('error_rate', errorRate);
  }

  public recordActiveConnections(connections: number): void {
    this.recordMetric('active_connections', connections);
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.eventLoopMonitorInterval) {
      clearInterval(this.eventLoopMonitorInterval);
      this.eventLoopMonitorInterval = null;
    }

    logger.info('System performance monitoring stopped');
  }
}