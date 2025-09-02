/**
 * Hummingbot Bridge Service
 * Central coordination point for all Hummingbot interactions
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { 
  HBConnection, 
  HBConfig, 
  HBStrategy, 
  StrategyExecution, 
  HBStrategyStatus, 
  PerformanceMetrics,
  TradingSignal,
  HBInstance,
  InstanceStatus,
  HealthStatus,
  ValidationResult,
  ExecutionResult,
  PortfolioBalance
} from '../types';

export interface HummingbotBridgeServiceConfig {
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
  apiVersion: string;
  defaultPort: number;
}

export class HummingbotBridgeService extends EventEmitter {
  private connections: Map<string, HBConnection> = new Map();
  private httpClients: Map<string, AxiosInstance> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: HummingbotBridgeServiceConfig;

  constructor(config: Partial<HummingbotBridgeServiceConfig> = {}) {
    super();
    
    this.config = {
      maxConnections: 10,
      connectionTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      apiVersion: 'v1',
      defaultPort: 5000,
      ...config
    };

    this.setupEventHandlers();
  }

  /**
   * Connect to a Hummingbot instance
   */
  async connectToHummingbot(instanceId: string, config: HBConfig): Promise<HBConnection> {
    try {
      // Check if connection already exists
      const existingConnection = this.connections.get(instanceId);
      if (existingConnection && existingConnection.status === 'connected') {
        return existingConnection;
      }

      // Check connection limits
      if (this.connections.size >= this.config.maxConnections) {
        throw new Error(`Maximum connections (${this.config.maxConnections}) reached`);
      }

      // Create new connection
      const connection: HBConnection = {
        instanceId,
        status: 'connecting',
        lastPing: Date.now(),
        apiVersion: this.config.apiVersion,
        supportedStrategies: [],
        endpoint: this.buildEndpoint(config.instanceSettings),
        connectionAttempts: 0
      };

      this.connections.set(instanceId, connection);

      // Create HTTP client
      const httpClient = this.createHttpClient(connection.endpoint, config);
      this.httpClients.set(instanceId, httpClient);

      // Attempt connection
      await this.establishConnection(instanceId, connection);

      // Start health checks
      this.startHealthCheck(instanceId);

      this.emit('connection:established', { instanceId, connection });
      
      return connection;
    } catch (error) {
      const connection = this.connections.get(instanceId);
      if (connection) {
        connection.status = 'error';
        connection.lastError = error instanceof Error ? error.message : 'Unknown error';
        connection.connectionAttempts++;
      }

      this.emit('connection:failed', { instanceId, error });
      throw error;
    }
  }

  /**
   * Execute a trading strategy on Hummingbot
   */
  async executeStrategy(strategy: HBStrategy): Promise<StrategyExecution> {
    try {
      // Find available instance
      const instanceId = await this.selectOptimalInstance(strategy);
      const connection = this.connections.get(instanceId);
      
      if (!connection || connection.status !== 'connected') {
        throw new Error(`No healthy connection available for instance ${instanceId}`);
      }

      // Translate strategy to Hummingbot format
      const hbStrategy = await this.translateStrategy(strategy);

      // Validate strategy
      const validation = await this.validateStrategy(hbStrategy);
      if (!validation.isValid) {
        throw new Error(`Strategy validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Deploy strategy
      const execution = await this.deployStrategy(instanceId, hbStrategy);

      this.emit('strategy:executed', { instanceId, strategy: hbStrategy, execution });

      return execution;
    } catch (error) {
      this.emit('strategy:failed', { strategy, error });
      throw error;
    }
  }

  /**
   * Monitor a strategy's execution
   */
  monitorStrategy(strategyId: string): NodeJS.EventEmitter {
    const monitor = new EventEmitter();
    
    // Set up monitoring interval
    const monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.getStrategyMetrics(strategyId);
        monitor.emit('metrics', metrics);

        // Check for anomalies
        const anomalies = await this.detectAnomalies(metrics);
        if (anomalies.length > 0) {
          monitor.emit('anomalies', anomalies);
        }
      } catch (error) {
        monitor.emit('error', error);
      }
    }, 5000); // Monitor every 5 seconds

    // Cleanup on stop
    monitor.on('stop', () => {
      clearInterval(monitoringInterval);
    });

    return monitor;
  }

  /**
   * Stop a running strategy
   */
  async stopStrategy(strategyId: string): Promise<boolean> {
    try {
      const instanceId = await this.findStrategyInstance(strategyId);
      const httpClient = this.httpClients.get(instanceId);
      
      if (!httpClient) {
        throw new Error(`No HTTP client found for instance ${instanceId}`);
      }

      const response = await httpClient.post(`/strategies/${strategyId}/stop`);
      
      if (response.data.success) {
        this.emit('strategy:stopped', { strategyId, instanceId });
        return true;
      }

      throw new Error(response.data.error || 'Failed to stop strategy');
    } catch (error) {
      this.emit('strategy:stop_failed', { strategyId, error });
      throw error;
    }
  }

  /**
   * Get performance metrics for a strategy
   */
  async getPerformanceMetrics(strategyId: string): Promise<PerformanceMetrics> {
    try {
      const instanceId = await this.findStrategyInstance(strategyId);
      const httpClient = this.httpClients.get(instanceId);
      
      if (!httpClient) {
        throw new Error(`No HTTP client found for instance ${instanceId}`);
      }

      const response = await httpClient.get(`/strategies/${strategyId}/metrics`);
      
      if (response.data.success) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to get performance metrics');
    } catch (error) {
      this.emit('metrics:failed', { strategyId, error });
      throw error;
    }
  }

  /**
   * Get all active connections
   */
  getConnections(): Map<string, HBConnection> {
    return new Map(this.connections);
  }

  /**
   * Get connection by instance ID
   */
  getConnection(instanceId: string): HBConnection | undefined {
    return this.connections.get(instanceId);
  }

  /**
   * Disconnect from a Hummingbot instance
   */
  async disconnect(instanceId: string): Promise<void> {
    try {
      // Stop health checks
      const healthCheckInterval = this.healthCheckIntervals.get(instanceId);
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        this.healthCheckIntervals.delete(instanceId);
      }

      // Remove HTTP client
      this.httpClients.delete(instanceId);

      // Update connection status
      const connection = this.connections.get(instanceId);
      if (connection) {
        connection.status = 'disconnected';
      }

      // Remove connection
      this.connections.delete(instanceId);

      this.emit('connection:disconnected', { instanceId });
    } catch (error) {
      this.emit('connection:disconnect_failed', { instanceId, error });
      throw error;
    }
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(instanceId => 
      this.disconnect(instanceId)
    );

    await Promise.allSettled(disconnectPromises);
  }

  /**
   * Get health status of all instances
   */
  async getHealthStatus(): Promise<HealthStatus[]> {
    const healthPromises = Array.from(this.connections.keys()).map(async instanceId => {
      try {
        return await this.checkInstanceHealth(instanceId);
      } catch (error) {
        return {
          instanceId,
          status: 'unhealthy' as InstanceStatus,
          uptime: 0,
          lastHealthCheck: Date.now(),
          healthScore: 0,
          issues: [{
            type: 'connectivity' as const,
            severity: 'critical' as const,
            description: error instanceof Error ? error.message : 'Health check failed',
            detectedAt: Date.now(),
            resolved: false
          }],
          metrics: {
            cpuUsage: 0,
            memoryUsage: 0,
            diskUsage: 0,
            networkLatency: 0,
            errorRate: 100,
            responseTime: 0,
            activeConnections: 0,
            queueDepth: 0
          }
        };
      }
    });

    return Promise.all(healthPromises);
  }

  // Private methods

  private setupEventHandlers(): void {
    this.on('connection:failed', ({ instanceId, error }) => {
      console.error(`Connection failed for instance ${instanceId}:`, error);
      this.handleConnectionFailure(instanceId);
    });

    this.on('strategy:failed', ({ strategy, error }) => {
      console.error(`Strategy execution failed:`, error);
    });
  }

  private buildEndpoint(instanceSettings: any): string {
    const host = instanceSettings.host || 'localhost';
    const port = instanceSettings.port || this.config.defaultPort;
    return `http://${host}:${port}/api/${this.config.apiVersion}`;
  }

  private createHttpClient(endpoint: string, config: HBConfig): AxiosInstance {
    const clientConfig: AxiosRequestConfig = {
      baseURL: endpoint,
      timeout: this.config.connectionTimeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Crypto-Trading-Bot/1.0'
      }
    };

    // Add authentication if available
    if (config.instanceSettings.environment?.AUTH_TOKEN) {
      clientConfig.headers!['Authorization'] = `Bearer ${config.instanceSettings.environment.AUTH_TOKEN}`;
    }

    const client = axios.create(clientConfig);

    // Add request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        console.log(`[Hummingbot API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[Hummingbot API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[Hummingbot API] Response error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );

    return client;
  }

  private async establishConnection(instanceId: string, connection: HBConnection): Promise<void> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    let attempts = 0;
    while (attempts < this.config.retryAttempts) {
      try {
        // Ping the instance
        const response = await httpClient.get('/health');
        
        if (response.status === 200) {
          connection.status = 'connected';
          connection.lastPing = Date.now();
          connection.apiVersion = response.data.version || this.config.apiVersion;
          connection.supportedStrategies = response.data.supportedStrategies || [];
          connection.connectionAttempts = attempts + 1;
          return;
        }
      } catch (error) {
        attempts++;
        if (attempts < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempts);
        }
      }
    }

    throw new Error(`Failed to establish connection after ${this.config.retryAttempts} attempts`);
  }

  private startHealthCheck(instanceId: string): void {
    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck(instanceId);
      } catch (error) {
        console.error(`Health check failed for instance ${instanceId}:`, error);
        this.handleHealthCheckFailure(instanceId);
      }
    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(instanceId, interval);
  }

  private async performHealthCheck(instanceId: string): Promise<void> {
    const connection = this.connections.get(instanceId);
    const httpClient = this.httpClients.get(instanceId);

    if (!connection || !httpClient) {
      throw new Error(`Connection or HTTP client not found for instance ${instanceId}`);
    }

    const startTime = Date.now();
    const response = await httpClient.get('/health');
    const responseTime = Date.now() - startTime;

    if (response.status === 200) {
      connection.status = 'connected';
      connection.lastPing = Date.now();
      this.emit('health:check_passed', { instanceId, responseTime });
    } else {
      throw new Error(`Health check failed with status ${response.status}`);
    }
  }

  private async handleConnectionFailure(instanceId: string): Promise<void> {
    const connection = this.connections.get(instanceId);
    if (!connection) return;

    // Attempt reconnection if not too many attempts
    if (connection.connectionAttempts < this.config.retryAttempts) {
      setTimeout(async () => {
        try {
          await this.establishConnection(instanceId, connection);
          this.emit('connection:recovered', { instanceId });
        } catch (error) {
          this.emit('connection:recovery_failed', { instanceId, error });
        }
      }, this.config.retryDelay * connection.connectionAttempts);
    }
  }

  private async handleHealthCheckFailure(instanceId: string): Promise<void> {
    const connection = this.connections.get(instanceId);
    if (connection) {
      connection.status = 'error';
      this.emit('health:check_failed', { instanceId });
    }
  }

  private async selectOptimalInstance(strategy: HBStrategy): Promise<string> {
    const healthyConnections = Array.from(this.connections.entries())
      .filter(([_, connection]) => connection.status === 'connected');

    if (healthyConnections.length === 0) {
      throw new Error('No healthy Hummingbot instances available');
    }

    // Simple round-robin selection for now
    // TODO: Implement more sophisticated load balancing
    const selectedIndex = Math.floor(Math.random() * healthyConnections.length);
    return healthyConnections[selectedIndex][0];
  }

  private async translateStrategy(strategy: HBStrategy): Promise<HBStrategy> {
    // Strategy is already in Hummingbot format, just return it
    return strategy;
  }

  private async validateStrategy(strategy: HBStrategy): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: any[] = [];

    // Basic validation
    if (!strategy.exchange) {
      errors.push({ field: 'exchange', message: 'Exchange is required', code: 'REQUIRED' });
    }

    if (!strategy.tradingPair) {
      errors.push({ field: 'tradingPair', message: 'Trading pair is required', code: 'REQUIRED' });
    }

    // Risk validation
    if (strategy.riskLimits.maxPositionSize <= 0) {
      errors.push({ field: 'maxPositionSize', message: 'Max position size must be positive', code: 'INVALID_VALUE' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  async deployStrategy(instanceId: string, strategy: HBStrategy): Promise<StrategyExecution> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    const response = await httpClient.post('/strategies', strategy);

    if (response.data.success) {
      return {
        id: response.data.data.id,
        strategyType: strategy.type,
        instanceId,
        status: 'active' as HBStrategyStatus,
        startTime: Date.now(),
        parameters: strategy.parameters,
        performance: {
          totalTrades: 0,
          successfulTrades: 0,
          totalVolume: 0,
          totalPnL: 0,
          averageLatency: 0,
          averageSlippage: 0,
          fillRate: 0,
          maxDrawdown: 0,
          currentDrawdown: 0,
          profitFactor: 0,
          sharpeRatio: 0,
          winRate: 0
        },
        orders: [],
        trades: [],
        errors: []
      };
    }

    throw new Error(response.data.error || 'Failed to deploy strategy');
  }

  private async getStrategyMetrics(strategyId: string): Promise<any> {
    const instanceId = await this.findStrategyInstance(strategyId);
    const httpClient = this.httpClients.get(instanceId);
    
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    const response = await httpClient.get(`/strategies/${strategyId}/metrics`);
    return response.data.data;
  }

  private async detectAnomalies(metrics: any): Promise<any[]> {
    const anomalies: any[] = [];

    // Simple anomaly detection - would be expanded with ML models
    if (metrics.executionLatency > 1000) {
      anomalies.push({
        id: `anomaly_${Date.now()}`,
        type: 'high_latency',
        severity: 'medium',
        description: 'Execution latency is higher than normal',
        detectedAt: Date.now(),
        metrics: { latency: metrics.executionLatency },
        threshold: 1000,
        actualValue: metrics.executionLatency,
        resolved: false
      });
    }

    return anomalies;
  }

  private async findStrategyInstance(strategyId: string): Promise<string> {
    // This would query the database or maintain a mapping
    // For now, return the first available instance
    const healthyConnections = Array.from(this.connections.entries())
      .filter(([_, connection]) => connection.status === 'connected');

    if (healthyConnections.length === 0) {
      throw new Error('No healthy instances available');
    }

    return healthyConnections[0][0];
  }

  private async checkInstanceHealth(instanceId: string): Promise<HealthStatus> {
    const connection = this.connections.get(instanceId);
    const httpClient = this.httpClients.get(instanceId);

    if (!connection || !httpClient) {
      throw new Error(`Connection or HTTP client not found for instance ${instanceId}`);
    }

    const startTime = Date.now();
    const response = await httpClient.get('/health/detailed');
    const responseTime = Date.now() - startTime;

    const healthData = response.data.data;

    return {
      instanceId,
      status: healthData.status || 'running',
      uptime: healthData.uptime || 0,
      lastHealthCheck: Date.now(),
      healthScore: this.calculateHealthScore(healthData),
      issues: healthData.issues || [],
      metrics: {
        cpuUsage: healthData.cpu || 0,
        memoryUsage: healthData.memory || 0,
        diskUsage: healthData.disk || 0,
        networkLatency: responseTime,
        errorRate: healthData.errorRate || 0,
        responseTime,
        activeConnections: healthData.connections || 0,
        queueDepth: healthData.queueDepth || 0
      }
    };
  }

  private calculateHealthScore(healthData: any): number {
    let score = 100;

    // Deduct points for high resource usage
    if (healthData.cpu > 80) score -= 20;
    if (healthData.memory > 80) score -= 20;
    if (healthData.disk > 90) score -= 30;

    // Deduct points for high error rate
    if (healthData.errorRate > 5) score -= 30;

    return Math.max(0, score);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Additional methods for grid bot integration
  async createInstance(config: any): Promise<any> {
    // Create a new Hummingbot instance
    const instanceId = `instance_${Date.now()}`;
    
    // Mock instance creation for now
    return {
      id: instanceId,
      name: config.name,
      status: 'created',
      containerId: `container_${instanceId}`,
      config: config.config,
      strategies: [],
      resources: {
        cpuUsage: 0,
        memoryUsage: 0,
        networkIO: 0,
        diskIO: 0
      },
      performance: {
        uptime: 0,
        totalTrades: 0,
        successfulTrades: 0,
        totalVolume: 0,
        averageLatency: 0
      },
      createdAt: new Date(),
      lastHealthCheck: new Date(),
      updatedAt: Date.now()
    };
  }

  async startInstance(instanceId: string): Promise<void> {
    const connection = this.connections.get(instanceId);
    if (connection) {
      connection.status = 'connected';
    }
  }

  async stopInstance(instanceId: string): Promise<void> {
    const connection = this.connections.get(instanceId);
    if (connection) {
      connection.status = 'disconnected';
    }
  }

  async placeOrder(instanceId: string, orderParams: any): Promise<string> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    // Mock order placement
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // In real implementation, this would make HTTP request to Hummingbot
    // const response = await httpClient.post('/orders', orderParams);
    
    return orderId;
  }

  async cancelOrder(instanceId: string, orderId: string): Promise<void> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    // Mock order cancellation
    // In real implementation: await httpClient.delete(`/orders/${orderId}`);
  }

  async getInstanceStatus(instanceId: string): Promise<any> {
    const connection = this.connections.get(instanceId);
    if (!connection) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    return {
      status: connection.status,
      performance: {
        totalPnl: 0,
        unrealizedPnl: 0
      },
      position: {
        size: 0
      }
    };
  }

  async getActiveOrders(instanceId: string): Promise<any[]> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    // Mock active orders
    return [];
  }

  async getInstancePerformance(instanceId: string): Promise<any> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    return {
      totalPnl: 0,
      unrealizedPnl: 0,
      totalTrades: 0,
      successfulTrades: 0,
      winRate: 0,
      averageLatency: 0
    };
  }

  async getInstances(): Promise<any[]> {
    // Return mock instances
    return Array.from(this.connections.entries()).map(([id, connection]) => ({
      id,
      status: connection.status,
      name: `Instance ${id}`,
      containerId: `container_${id}`,
      config: {},
      strategies: [],
      resources: {
        cpuUsage: 50,
        memoryUsage: 1024,
        networkIO: 100,
        diskIO: 50
      },
      performance: {
        uptime: 3600,
        totalTrades: 10,
        successfulTrades: 8,
        totalVolume: 1000,
        averageLatency: 100
      },
      createdAt: new Date(),
      lastHealthCheck: new Date(),
      updatedAt: Date.now()
    }));
  }

  /**
   * Get instances by exchange
   */
  async getInstancesByExchange(exchange: string): Promise<HBInstance[]> {
    const instances: HBInstance[] = [];
    
    for (const [instanceId, connection] of this.connections) {
      if (connection.status === 'connected') {
        try {
          const httpClient = this.httpClients.get(instanceId);
          if (httpClient) {
            const response = await httpClient.get('/instance/info');
            const instanceInfo = response.data;
            
            // Check if instance supports the exchange
            if (instanceInfo.supportedExchanges?.includes(exchange)) {
              instances.push({
                id: instanceId,
                name: instanceInfo.name || instanceId,
                status: 'running',
                strategies: instanceInfo.activeStrategies || [],
                resources: instanceInfo.resources || { cpuUsage: 0, memoryUsage: 0, memoryLimit: 0, networkIn: 0, networkOut: 0, diskUsage: 0, diskLimit: 0 },
                performance: instanceInfo.performance || { uptime: 0, totalStrategies: 0, activeStrategies: 0, totalTrades: 0, totalVolume: 0, totalPnL: 0, averageLatency: 0, errorRate: 0 },
                config: instanceInfo.config || {},
                createdAt: instanceInfo.createdAt || Date.now(),
                updatedAt: Date.now(),
                lastHealthCheck: Date.now()
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to get instance info for ${instanceId}:`, error);
        }
      }
    }
    
    return instances;
  }

  /**
   * Get market price from exchange
   */
  async getMarketPrice(exchange: string, pair: string): Promise<number> {
    // Find an instance that supports this exchange
    const instances = await this.getInstancesByExchange(exchange);
    if (instances.length === 0) {
      throw new Error(`No instances available for exchange ${exchange}`);
    }

    const instanceId = instances[0].id;
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      const response = await httpClient.get(`/market/price/${exchange}/${pair}`);
      return response.data.price;
    } catch (error) {
      throw new Error(`Failed to get market price for ${pair} on ${exchange}: ${error}`);
    }
  }

  /**
   * Ping exchange to check connectivity
   */
  async pingExchange(exchange: string): Promise<void> {
    const instances = await this.getInstancesByExchange(exchange);
    if (instances.length === 0) {
      throw new Error(`No instances available for exchange ${exchange}`);
    }

    const instanceId = instances[0].id;
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      await httpClient.get(`/exchange/ping/${exchange}`);
    } catch (error) {
      throw new Error(`Failed to ping exchange ${exchange}: ${error}`);
    }
  }

  /**
   * Get volatility for exchange
   */
  async getVolatility(exchange: string): Promise<number> {
    const instances = await this.getInstancesByExchange(exchange);
    if (instances.length === 0) {
      throw new Error(`No instances available for exchange ${exchange}`);
    }

    const instanceId = instances[0].id;
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      const response = await httpClient.get(`/market/volatility/${exchange}`);
      return response.data.volatility;
    } catch (error) {
      console.warn(`Failed to get volatility for ${exchange}, using default:`, error);
      return 0.02; // Default 2% volatility
    }
  }

  /**
   * Get volume for exchange
   */
  async getVolume(exchange: string): Promise<number> {
    const instances = await this.getInstancesByExchange(exchange);
    if (instances.length === 0) {
      throw new Error(`No instances available for exchange ${exchange}`);
    }

    const instanceId = instances[0].id;
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      const response = await httpClient.get(`/market/volume/${exchange}`);
      return response.data.volume;
    } catch (error) {
      console.warn(`Failed to get volume for ${exchange}, using default:`, error);
      return 1000000; // Default volume
    }
  }

  /**
   * Get spread for exchange
   */
  async getSpread(exchange: string): Promise<number> {
    const instances = await this.getInstancesByExchange(exchange);
    if (instances.length === 0) {
      throw new Error(`No instances available for exchange ${exchange}`);
    }

    const instanceId = instances[0].id;
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      const response = await httpClient.get(`/market/spread/${exchange}`);
      return response.data.spread;
    } catch (error) {
      console.warn(`Failed to get spread for ${exchange}, using default:`, error);
      return 0.001; // Default 0.1% spread
    }
  }

  /**
   * Update strategy parameters
   */
  async updateStrategy(strategyId: string, strategy: HBStrategy): Promise<void> {
    // Find the instance running this strategy
    for (const [instanceId, connection] of this.connections) {
      if (connection.status === 'connected') {
        const httpClient = this.httpClients.get(instanceId);
        if (httpClient) {
          try {
            await httpClient.put(`/strategy/${strategyId}`, strategy);
            this.emit('strategy:updated', { instanceId, strategyId, strategy });
            return;
          } catch (error) {
            // Strategy not found on this instance, continue searching
            continue;
          }
        }
      }
    }
    
    throw new Error(`Strategy ${strategyId} not found on any instance`);
  }

  /**
   * Set leverage for perpetual futures
   */
  async setLeverage(instanceId: string, symbol: string, leverage: number): Promise<void> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      await httpClient.post(`/perpetual/leverage`, { symbol, leverage });
      this.emit('leverage:set', { instanceId, symbol, leverage });
    } catch (error) {
      this.emit('leverage:failed', { instanceId, symbol, leverage, error });
      throw error;
    }
  }

  /**
   * Set position mode for perpetual futures
   */
  async setPositionMode(instanceId: string, mode: 'one_way' | 'hedge'): Promise<void> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      await httpClient.post(`/perpetual/position-mode`, { mode });
      this.emit('positionMode:set', { instanceId, mode });
    } catch (error) {
      this.emit('positionMode:failed', { instanceId, mode, error });
      throw error;
    }
  }

  /**
   * Set margin type for perpetual futures
   */
  async setMarginType(instanceId: string, symbol: string, marginType: 'isolated' | 'cross'): Promise<void> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      await httpClient.post(`/perpetual/margin-type`, { symbol, marginType });
      this.emit('marginType:set', { instanceId, symbol, marginType });
    } catch (error) {
      this.emit('marginType:failed', { instanceId, symbol, marginType, error });
      throw error;
    }
  }

  /**
   * Get perpetual futures positions
   */
  async getPositions(instanceId: string, symbol?: string): Promise<any[]> {
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      const url = symbol ? `/perpetual/positions/${symbol}` : '/perpetual/positions';
      const response = await httpClient.get(url);
      return response.data.positions || [];
    } catch (error) {
      console.warn(`Failed to get positions for instance ${instanceId}:`, error);
      return [];
    }
  }

  /**
   * Get funding rate for perpetual futures
   */
  async getFundingRate(symbol: string): Promise<any> {
    // Find any available instance
    const instances = await this.getInstances();
    const availableInstance = instances.find(i => i.status === 'running');
    
    if (!availableInstance) {
      throw new Error('No available instances for funding rate query');
    }

    const httpClient = this.httpClients.get(availableInstance.id);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${availableInstance.id}`);
    }

    try {
      const response = await httpClient.get(`/perpetual/funding-rate/${symbol}`);
      return response.data;
    } catch (error) {
      console.warn(`Failed to get funding rate for ${symbol}:`, error);
      // Return mock data
      return {
        fundingRate: 0.0001,
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // 8 hours from now
        predictedRate: 0.0001,
        historicalRates: [0.0001, 0.0002, 0.0001, -0.0001, 0.0003]
      };
    }
  }

  /**
   * Get balances from exchange
   */
  async getBalances(exchange: string): Promise<PortfolioBalance> {
    const instances = await this.getInstancesByExchange(exchange);
    if (instances.length === 0) {
      throw new Error(`No instances available for exchange ${exchange}`);
    }

    const instanceId = instances[0].id;
    const httpClient = this.httpClients.get(instanceId);
    if (!httpClient) {
      throw new Error(`No HTTP client found for instance ${instanceId}`);
    }

    try {
      const response = await httpClient.get(`/balances/${exchange}`);
      return {
        exchange,
        assets: response.data.assets || {},
        totalValue: response.data.totalValue || 0,
        lastUpdated: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get balances for ${exchange}: ${error}`);
    }
  }
}

export default HummingbotBridgeService;