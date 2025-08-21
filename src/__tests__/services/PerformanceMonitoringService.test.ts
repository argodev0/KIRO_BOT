import { PerformanceMonitoringService } from '../../services/PerformanceMonitoringService';

describe('PerformanceMonitoringService', () => {
  let performanceService: PerformanceMonitoringService;

  beforeEach(() => {
    performanceService = PerformanceMonitoringService.getInstance();
  });

  afterEach(() => {
    performanceService.stop();
  });

  describe('Latency Monitoring', () => {
    it('should record latency measurements', () => {
      const operation = 'database_query';
      const latency = 150;

      performanceService.recordLatency(operation, latency);

      const metrics = performanceService.getPerformanceMetrics();
      expect(metrics.latency).toBeDefined();
    });

    it('should emit alert for high latency', (done) => {
      performanceService.on('performance_alert', (alert) => {
        expect(alert.type).toBe('high_latency');
        expect(alert.operation).toBe('slow_operation');
        expect(alert.value).toBe(2000);
        done();
      });

      performanceService.recordLatency('slow_operation', 2000);
    });

    it('should calculate latency percentiles', () => {
      // Record multiple latency measurements
      for (let i = 0; i < 100; i++) {
        performanceService.recordLatency('test_operation', i * 10);
      }

      const metrics = performanceService.getPerformanceMetrics();
      expect(metrics.latency.avg).toBeGreaterThan(0);
      expect(metrics.latency.p95).toBeGreaterThan(metrics.latency.avg);
      expect(metrics.latency.p99).toBeGreaterThan(metrics.latency.p95);
    });
  });

  describe('Throughput Monitoring', () => {
    it('should record throughput measurements', () => {
      performanceService.recordThroughput('http_requests', 5);
      performanceService.recordThroughput('trades', 2);

      const metrics = performanceService.getPerformanceMetrics();
      expect(metrics.throughput).toBeDefined();
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('should emit alert for low throughput', (done) => {
      // Update thresholds to trigger alert
      performanceService.updateThresholds({ minThroughput: 100 });

      performanceService.on('performance_alert', (alert) => {
        if (alert.type === 'low_throughput') {
          expect(alert.value).toBeLessThan(100);
          done();
        }
      });

      // Simulate low throughput scenario
      setTimeout(() => {
        const metrics = performanceService.getPerformanceMetrics();
        // This would trigger the alert in the monitoring interval
      }, 100);
    });
  });

  describe('Error Rate Monitoring', () => {
    it('should record error rates', () => {
      performanceService.recordError('api', 'validation_error');
      performanceService.recordError('database', 'connection_error');
      performanceService.recordThroughput('http_requests', 10);

      const metrics = performanceService.getPerformanceMetrics();
      expect(metrics.errorRate).toBeDefined();
      expect(metrics.errorRate.overall).toBeGreaterThanOrEqual(0);
    });

    it('should track errors by service', () => {
      performanceService.recordError('trading', 'execution_error');
      performanceService.recordError('trading', 'validation_error');
      performanceService.recordError('analytics', 'calculation_error');

      const metrics = performanceService.getPerformanceMetrics();
      expect(metrics.errorRate.byService.size).toBeGreaterThan(0);
    });

    it('should emit alert for high error rate', (done) => {
      performanceService.updateThresholds({ maxErrorRate: 0.01 }); // 1%

      performanceService.on('performance_alert', (alert) => {
        if (alert.type === 'high_error_rate') {
          expect(alert.value).toBeGreaterThan(0.01);
          done();
        }
      });

      // Generate high error rate
      for (let i = 0; i < 10; i++) {
        performanceService.recordError('test', 'error');
      }
      performanceService.recordThroughput('http_requests', 50);
    });
  });

  describe('Resource Monitoring', () => {
    it('should get resource metrics', () => {
      const metrics = performanceService.getPerformanceMetrics();
      
      expect(metrics.resources).toBeDefined();
      expect(metrics.resources.memoryUsage).toBeGreaterThan(0);
      expect(metrics.resources.cpuUsage).toBeGreaterThanOrEqual(0);
    });

    it('should emit alert for high memory usage', (done) => {
      performanceService.updateThresholds({ maxMemoryUsage: 1 }); // 1 byte

      performanceService.on('performance_alert', (alert) => {
        if (alert.type === 'high_memory_usage') {
          expect(alert.value).toBeGreaterThan(1);
          done();
        }
      });

      // Memory usage check happens in monitoring interval
      setTimeout(() => {}, 100);
    });
  });

  describe('Threshold Management', () => {
    it('should update performance thresholds', () => {
      const newThresholds = {
        maxLatency: 500,
        maxErrorRate: 0.02,
        minThroughput: 20
      };

      performanceService.updateThresholds(newThresholds);
      const thresholds = performanceService.getThresholds();

      expect(thresholds.maxLatency).toBe(500);
      expect(thresholds.maxErrorRate).toBe(0.02);
      expect(thresholds.minThroughput).toBe(20);
    });

    it('should get current thresholds', () => {
      const thresholds = performanceService.getThresholds();

      expect(thresholds).toHaveProperty('maxLatency');
      expect(thresholds).toHaveProperty('maxErrorRate');
      expect(thresholds).toHaveProperty('minThroughput');
      expect(thresholds).toHaveProperty('maxMemoryUsage');
      expect(thresholds).toHaveProperty('maxCpuUsage');
    });
  });

  describe('Performance Metrics Calculation', () => {
    it('should calculate comprehensive performance metrics', () => {
      // Generate test data
      performanceService.recordLatency('api_call', 100);
      performanceService.recordLatency('api_call', 200);
      performanceService.recordLatency('api_call', 150);
      
      performanceService.recordThroughput('requests', 10);
      performanceService.recordThroughput('trades', 5);
      
      performanceService.recordError('api', 'error1');
      performanceService.recordError('db', 'error2');

      const metrics = performanceService.getPerformanceMetrics();

      expect(metrics.latency.avg).toBeGreaterThan(0);
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate.overall).toBeGreaterThanOrEqual(0);
      expect(metrics.resources.memoryUsage).toBeGreaterThan(0);
    });
  });
});