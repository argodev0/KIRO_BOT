/**
 * Hummingbot Gateway API Client
 * Handles communication with Hummingbot Gateway API with authentication and error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { 
  HBConnection, 
  HBStrategy, 
  StrategyExecution, 
  PerformanceMetrics,
  ValidationResult,
  HealthStatus,
  OrderExecution,
  TradeExecution
} from '../types';

export interface GatewayClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  authToken?: string;
  rateLimitPerSecond: number;
  enableMetrics: boolean;
}

export interface GatewayResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
  requestId?: string;
}

export interface GatewayError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  requestId?: string;
}

export class HummingbotGatewayClient extends EventEmitter {
  private client: AxiosInstance;
  private config: GatewayClientConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private rateLimitTokens: number;
  private lastTokenRefill: number;
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: 0
  };

  constructor(config: Partial<GatewayClientConfig>) {
    super();

    this.config = {
      baseURL: 'http://localhost:5000/api/v1',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimitPerSecond: 10,
      enableMetrics: true,
      ...config
    };

    this.rateLimitTokens = this.config.rateLimitPerSecond;
    this.lastTokenRefill = Date.now();

    this.client = this.createAxiosInstance();
    this.setupInterceptors();
    this.startTokenRefillTimer();
  }

  /**
   * Test connection to Hummingbot Gateway
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest<any>('GET', '/health');
      return response.success;
    } catch (error) {
      this.emit('connection:test_failed', error);
      return false;
    }
  }

  /**
   * Get gateway health status
   */
  async getHealth(): Promise<HealthStatus> {
    const response = await this.makeRequest<HealthStatus>('GET', '/health/detailed');
    return response.data!;
  }

  /**
   * Get supported strategies
   */
  async getSupportedStrategies(): Promise<string[]> {
    const response = await this.makeRequest<string[]>('GET', '/strategies/supported');
    return response.data!;
  }

  /**
   * Create a new strategy
   */
  async createStrategy(strategy: HBStrategy): Promise<StrategyExecution> {
    const response = await this.makeRequest<StrategyExecution>('POST', '/strategies', strategy);
    return response.data!;
  }

  /**
   * Get strategy by ID
   */
  async getStrategy(strategyId: string): Promise<StrategyExecution> {
    const response = await this.makeRequest<StrategyExecution>('GET', `/strategies/${strategyId}`);
    return response.data!;
  }

  /**
   * Update strategy configuration
   */
  async updateStrategy(strategyId: string, updates: Partial<HBStrategy>): Promise<StrategyExecution> {
    const response = await this.makeRequest<StrategyExecution>('PUT', `/strategies/${strategyId}`, updates);
    return response.data!;
  }

  /**
   * Start a strategy
   */
  async startStrategy(strategyId: string): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>('POST', `/strategies/${strategyId}/start`);
    return response.data!.success;
  }

  /**
   * Stop a strategy
   */
  async stopStrategy(strategyId: string): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>('POST', `/strategies/${strategyId}/stop`);
    return response.data!.success;
  }

  /**
   * Pause a strategy
   */
  async pauseStrategy(strategyId: string): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>('POST', `/strategies/${strategyId}/pause`);
    return response.data!.success;
  }

  /**
   * Resume a strategy
   */
  async resumeStrategy(strategyId: string): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>('POST', `/strategies/${strategyId}/resume`);
    return response.data!.success;
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(strategyId: string): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>('DELETE', `/strategies/${strategyId}`);
    return response.data!.success;
  }

  /**
   * Get all active strategies
   */
  async getActiveStrategies(): Promise<StrategyExecution[]> {
    const response = await this.makeRequest<StrategyExecution[]>('GET', '/strategies/active');
    return response.data!;
  }

  /**
   * Get strategy performance metrics
   */
  async getStrategyMetrics(strategyId: string): Promise<PerformanceMetrics> {
    const response = await this.makeRequest<PerformanceMetrics>('GET', `/strategies/${strategyId}/metrics`);
    return response.data!;
  }

  /**
   * Get strategy orders
   */
  async getStrategyOrders(strategyId: string): Promise<OrderExecution[]> {
    const response = await this.makeRequest<OrderExecution[]>('GET', `/strategies/${strategyId}/orders`);
    return response.data!;
  }

  /**
   * Get strategy trades
   */
  async getStrategyTrades(strategyId: string): Promise<TradeExecution[]> {
    const response = await this.makeRequest<TradeExecution[]>('GET', `/strategies/${strategyId}/trades`);
    return response.data!;
  }

  /**
   * Validate strategy configuration
   */
  async validateStrategy(strategy: HBStrategy): Promise<ValidationResult> {
    const response = await this.makeRequest<ValidationResult>('POST', '/strategies/validate', strategy);
    return response.data!;
  }

  /**
   * Get exchange balances
   */
  async getBalances(exchange: string): Promise<Record<string, number>> {
    const response = await this.makeRequest<Record<string, number>>('GET', `/exchanges/${exchange}/balances`);
    return response.data!;
  }

  /**
   * Get market data
   */
  async getMarketData(exchange: string, symbol: string): Promise<any> {
    const response = await this.makeRequest<any>('GET', `/exchanges/${exchange}/markets/${symbol}`);
    return response.data!;
  }

  /**
   * Get order book
   */
  async getOrderBook(exchange: string, symbol: string, depth: number = 20): Promise<any> {
    const response = await this.makeRequest<any>('GET', `/exchanges/${exchange}/markets/${symbol}/orderbook`, { depth });
    return response.data!;
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(exchange: string, symbol: string, limit: number = 100): Promise<any[]> {
    const response = await this.makeRequest<any[]>('GET', `/exchanges/${exchange}/markets/${symbol}/trades`, { limit });
    return response.data!;
  }

  /**
   * Get gateway configuration
   */
  async getConfiguration(): Promise<any> {
    const response = await this.makeRequest<any>('GET', '/config');
    return response.data!;
  }

  /**
   * Update gateway configuration
   */
  async updateConfiguration(config: any): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>('PUT', '/config', config);
    return response.data!.success;
  }

  /**
   * Get client metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset client metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: 0
    };
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; message?: string }> {
    try {
      const response = await this.makeRequest('GET', '/health');
      return {
        status: response.success ? 'healthy' : 'unhealthy',
        message: response.message
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deploy a strategy
   */
  async deployStrategy(strategy: HBStrategy): Promise<{ strategyId: string; deploymentId: string }> {
    const response = await this.makeRequest<{ strategyId: string; deploymentId: string }>('POST', '/strategies/deploy', strategy);
    return response.data!;
  }

  /**
   * Restart the gateway service
   */
  async restart(): Promise<void> {
    try {
      await this.makeRequest('POST', '/restart');
    } catch (error) {
      // Restart might cause connection to drop, so we ignore connection errors
      if (error instanceof Error && !error.message.includes('ECONNRESET')) {
        throw error;
      }
    }
  }

  // Private methods

  private createAxiosInstance(): AxiosInstance {
    const config: AxiosRequestConfig = {
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Crypto-Trading-Bot-Gateway-Client/1.0'
      }
    };

    if (this.config.authToken) {
      config.headers!['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    return axios.create(config);
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add request ID for tracking
        const requestId = this.generateRequestId();
        config.headers!['X-Request-ID'] = requestId;
        config.metadata = { requestId, startTime: Date.now() };

        this.emit('request:start', { requestId, method: config.method, url: config.url });
        return config;
      },
      (error) => {
        this.emit('request:error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        const requestId = response.config.headers!['X-Request-ID'];
        const startTime = response.config.metadata?.startTime || Date.now();
        const responseTime = Date.now() - startTime;

        // Update metrics
        if (this.config.enableMetrics) {
          this.updateMetrics(true, responseTime);
        }

        this.emit('request:success', { 
          requestId, 
          method: response.config.method, 
          url: response.config.url,
          status: response.status,
          responseTime 
        });

        return response;
      },
      (error: AxiosError) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        const startTime = error.config?.metadata?.startTime || Date.now();
        const responseTime = Date.now() - startTime;

        // Update metrics
        if (this.config.enableMetrics) {
          this.updateMetrics(false, responseTime);
        }

        this.emit('request:error', { 
          requestId, 
          method: error.config?.method, 
          url: error.config?.url,
          status: error.response?.status,
          responseTime,
          error: error.message 
        });

        return Promise.reject(this.transformError(error));
      }
    );
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<GatewayResponse<T>> {
    // Rate limiting
    await this.waitForRateLimit();

    // Add to queue if needed
    if (this.isProcessingQueue) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push(async () => {
          try {
            const result = await this.executeRequest<T>(method, endpoint, data);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    return this.executeRequest<T>(method, endpoint, data);
  }

  private async executeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<GatewayResponse<T>> {
    let attempt = 0;
    let lastError: any;

    while (attempt < this.config.retryAttempts) {
      try {
        let response: AxiosResponse;

        switch (method) {
          case 'GET':
            response = await this.client.get(endpoint, { params: data });
            break;
          case 'POST':
            response = await this.client.post(endpoint, data);
            break;
          case 'PUT':
            response = await this.client.put(endpoint, data);
            break;
          case 'DELETE':
            response = await this.client.delete(endpoint);
            break;
        }

        // Transform response to standard format
        return this.transformResponse<T>(response);

      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  private transformResponse<T>(response: AxiosResponse): GatewayResponse<T> {
    const requestId = response.config.headers!['X-Request-ID'];

    // Handle different response formats
    if (response.data && typeof response.data === 'object') {
      if ('success' in response.data) {
        // Already in gateway format
        return {
          ...response.data,
          requestId
        };
      } else {
        // Wrap in gateway format
        return {
          success: true,
          data: response.data,
          timestamp: Date.now(),
          requestId
        };
      }
    }

    return {
      success: true,
      data: response.data,
      timestamp: Date.now(),
      requestId
    };
  }

  private transformError(error: AxiosError): GatewayError {
    const requestId = error.config?.headers?.['X-Request-ID'];

    if (error.response?.data && typeof error.response.data === 'object') {
      const errorData = error.response.data as any;
      return {
        code: errorData.code || `HTTP_${error.response.status}`,
        message: errorData.message || error.message,
        details: errorData.details || errorData,
        timestamp: Date.now(),
        requestId
      };
    }

    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText
      },
      timestamp: Date.now(),
      requestId
    };
  }

  private async waitForRateLimit(): Promise<void> {
    if (this.rateLimitTokens <= 0) {
      const waitTime = 1000 / this.config.rateLimitPerSecond;
      await this.delay(waitTime);
    }
    this.rateLimitTokens--;
  }

  private startTokenRefillTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const timePassed = now - this.lastTokenRefill;
      const tokensToAdd = Math.floor((timePassed / 1000) * this.config.rateLimitPerSecond);
      
      if (tokensToAdd > 0) {
        this.rateLimitTokens = Math.min(
          this.config.rateLimitPerSecond,
          this.rateLimitTokens + tokensToAdd
        );
        this.lastTokenRefill = now;
      }
    }, 100); // Check every 100ms
  }

  private updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = Date.now();

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime;
    this.metrics.averageResponseTime = totalResponseTime / this.metrics.totalRequests;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default HummingbotGatewayClient;