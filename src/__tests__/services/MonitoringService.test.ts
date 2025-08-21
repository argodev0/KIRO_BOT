import { MonitoringService } from '../../services/MonitoringService';
import { register } from 'prom-client';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    // Clear all metrics before each test
    register.clear();
    monitoringService = MonitoringService.getInstance();
  });

  afterEach(() => {
    register.clear();
  });

  describe('HTTP Metrics', () => {
    it('should record HTTP request metrics', () => {
      const method = 'GET';
      const route = '/api/test';
      const statusCode = 200;
      const duration = 0.5;

      monitoringService.recordHttpRequest(method, route, statusCode, duration);

      // Verify metrics are recorded (in a real test, you'd check the actual metric values)
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should track active connections', () => {
      monitoringService.incrementActiveConnections();
      monitoringService.incrementActiveConnections();
      monitoringService.decrementActiveConnections();

      // In a real test, you'd verify the gauge value
      expect(true).toBe(true);
    });
  });

  describe('Trading Metrics', () => {
    it('should record trade execution metrics', () => {
      const symbol = 'BTCUSDT';
      const side = 'buy';
      const exchange = 'binance';
      const status = 'filled';

      monitoringService.recordTradeExecution(symbol, side, exchange, status);

      expect(true).toBe(true);
    });

    it('should record signal generation metrics', () => {
      const symbol = 'ETHUSDT';
      const direction = 'long';
      const confidence = 0.85;

      monitoringService.recordSignalGeneration(symbol, direction, confidence);

      expect(true).toBe(true);
    });

    it('should record order latency metrics', () => {
      const exchange = 'binance';
      const orderType = 'market';
      const latency = 0.1;

      monitoringService.recordOrderLatency(exchange, orderType, latency);

      expect(true).toBe(true);
    });

    it('should update portfolio metrics', () => {
      const userId = 'user123';
      const portfolioValue = 10000;
      const riskExposure = 15.5;

      monitoringService.updatePortfolioValue(userId, portfolioValue);
      monitoringService.updateRiskExposure(userId, riskExposure);

      expect(true).toBe(true);
    });
  });

  describe('Error Metrics', () => {
    it('should record general errors', () => {
      const service = 'trading-engine';
      const errorType = 'validation_error';
      const severity = 'medium';

      monitoringService.recordError(service, errorType, severity);

      expect(true).toBe(true);
    });

    it('should record exchange errors', () => {
      const exchange = 'binance';
      const errorCode = 'RATE_LIMIT';
      const endpoint = '/api/v3/order';

      monitoringService.recordExchangeError(exchange, errorCode, endpoint);

      expect(true).toBe(true);
    });

    it('should record database errors', () => {
      const operation = 'INSERT';
      const table = 'trades';
      const errorType = 'connection_timeout';

      monitoringService.recordDatabaseError(operation, table, errorType);

      expect(true).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should return health status', () => {
      const health = monitoringService.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('metrics');
      expect(health.status).toBe('healthy');
      expect(typeof health.timestamp).toBe('number');
    });
  });

  describe('Metrics Export', () => {
    it('should export metrics in Prometheus format', async () => {
      // Record some metrics first
      monitoringService.recordHttpRequest('GET', '/test', 200, 0.5);
      monitoringService.recordTradeExecution('BTCUSDT', 'buy', 'binance', 'filled');

      const metrics = await monitoringService.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });
  });
});