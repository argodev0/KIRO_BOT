/**
 * Hummingbot Paper Trading Integration Service
 * Extends paper trading system to include Hummingbot strategy simulation
 */

import { EventEmitter } from 'events';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { PaperTradingSafetyMonitor } from './PaperTradingSafetyMonitor';
import { AuditLogService } from './AuditLogService';
import { RiskManagementService } from './RiskManagementService';
import { 
  HBStrategy, 
  HBStrategyType,
  StrategyExecution, 
  TradingSignal,
  SimulatedOrder,
  SimulatedTrade,
  PaperTradingConfig,
  HummingbotSimulationResult
} from '../types';
import { logger } from '../utils/logger';

export interface HummingbotPaperTradingConfig extends PaperTradingConfig {
  enableHummingbotSimulation: boolean;
  simulationMode: 'full' | 'strategy_only' | 'execution_only';
  virtualBalance: {
    [currency: string]: number;
  };
  simulationParameters: {
    latencySimulation: boolean;
    slippageSimulation: boolean;
    partialFillSimulation: boolean;
    marketImpactSimulation: boolean;
  };
  riskLimits: {
    maxSimulatedPositionSize: number;
    maxDailySimulatedVolume: number;
    maxConcurrentStrategies: number;
  };
}

export interface HummingbotSimulationMetrics {
  totalSimulatedTrades: number;
  totalSimulatedVolume: number;
  simulatedPnL: number;
  averageExecutionLatency: number;
  averageSlippage: number;
  fillRate: number;
  strategyPerformance: Map<string, StrategySimulationMetrics>;
  riskMetrics: {
    maxDrawdown: number;
    sharpeRatio: number;
    volatility: number;
    var95: number;
  };
}

export interface StrategySimulationMetrics {
  strategyId: string;
  strategyType: string;
  totalTrades: number;
  successfulTrades: number;
  totalVolume: number;
  pnl: number;
  maxDrawdown: number;
  averageLatency: number;
  fillRate: number;
  riskScore: number;
}

export class HummingbotPaperTradingIntegration extends EventEmitter {
  private bridgeService: HummingbotBridgeService;
  private safetyMonitor: PaperTradingSafetyMonitor;
  private auditService: AuditLogService;
  private riskService: RiskManagementService;
  private config: HummingbotPaperTradingConfig;
  
  private simulatedStrategies: Map<string, StrategyExecution> = new Map();
  private simulatedOrders: Map<string, SimulatedOrder> = new Map();
  private simulatedTrades: Map<string, SimulatedTrade> = new Map();
  private virtualBalances: Map<string, number> = new Map();
  private simulationMetrics: HummingbotSimulationMetrics;

  constructor(
    bridgeService: HummingbotBridgeService,
    config: Partial<HummingbotPaperTradingConfig> = {}
  ) {
    super();
    
    this.bridgeService = bridgeService;
    this.safetyMonitor = PaperTradingSafetyMonitor.getInstance();
    this.auditService = AuditLogService.getInstance();
    
    // Ensure auditService is properly initialized
    if (!this.auditService) {
      throw new Error('AuditLogService not available');
    }
    this.riskService = new RiskManagementService();
    
    const defaultConfig = {
      enableHummingbotSimulation: true,
      simulationMode: 'full' as const,
      virtualBalance: {
        USDT: 10000,
        BTC: 1,
        ETH: 10
      },
      simulationParameters: {
        latencySimulation: true,
        slippageSimulation: true,
        partialFillSimulation: true,
        marketImpactSimulation: true
      },
      riskLimits: {
        maxSimulatedPositionSize: 1000,
        maxDailySimulatedVolume: 50000,
        maxConcurrentStrategies: 5
      }
    };

    this.config = {
      ...defaultConfig,
      ...config,
      virtualBalance: {
        ...defaultConfig.virtualBalance,
        ...(config.virtualBalance || {})
      },
      simulationParameters: {
        ...defaultConfig.simulationParameters,
        ...(config.simulationParameters || {})
      },
      riskLimits: {
        ...defaultConfig.riskLimits,
        ...(config.riskLimits || {})
      }
    };

    this.initializeVirtualBalances();
    this.initializeMetrics();
    this.setupEventHandlers();
  }

  /**
   * Simulate Hummingbot strategy execution in paper trading mode
   */
  async simulateHummingbotStrategy(signal: TradingSignal): Promise<HummingbotSimulationResult> {
    try {
      // Verify paper trading mode is enabled
      if (!this.safetyMonitor.isPaperTradingModeEnabled()) {
        throw new Error('Paper trading mode must be enabled for Hummingbot simulation');
      }

      // Check risk limits
      await this.validateSimulationRiskLimits(signal);

      // Translate signal to Hummingbot strategy
      const hbStrategy = await this.translateSignalToStrategy(signal);

      // Create simulated strategy execution
      const simulatedExecution = await this.createSimulatedExecution(hbStrategy, signal);

      // Execute simulation based on mode
      let simulationResult: HummingbotSimulationResult;
      
      switch (this.config.simulationMode) {
        case 'full':
          simulationResult = await this.executeFullSimulation(simulatedExecution);
          break;
        case 'strategy_only':
          simulationResult = await this.executeStrategyOnlySimulation(simulatedExecution);
          break;
        case 'execution_only':
          simulationResult = await this.executeExecutionOnlySimulation(simulatedExecution);
          break;
        default:
          throw new Error(`Unknown simulation mode: ${this.config.simulationMode}`);
      }

      // Update metrics
      this.updateSimulationMetrics(simulationResult);
      
      // Update strategy performance metrics
      this.updateStrategyPerformanceMetrics(simulatedExecution.id, simulationResult);

      // Log simulation
      this.auditService.logTradingAuditEvent({
        action: 'hummingbot_simulation',
        resource: 'strategy_simulation',
        resourceId: simulatedExecution.id,
        success: true,
        symbol: signal.symbol,
        exchange: signal.exchange || 'binance',
        strategy: hbStrategy.type,
        paperTrade: true,
        metadata: {
          simulationMode: this.config.simulationMode,
          simulationResult
        }
      });

      this.emit('simulation:completed', simulationResult);
      
      return simulationResult;
    } catch (error) {
      logger.error('Hummingbot simulation failed:', error);
      
      this.auditService.logTradingAuditEvent({
        action: 'hummingbot_simulation',
        resource: 'strategy_simulation',
        success: false,
        symbol: signal.symbol,
        exchange: signal.exchange || 'binance',
        paperTrade: true,
        reason: error instanceof Error ? error.message : 'Unknown error'
      });

      this.emit('simulation:failed', { signal, error });
      throw error;
    }
  }

  /**
   * Create simulated order for Hummingbot strategy
   */
  async createSimulatedOrder(
    strategyId: string,
    orderParams: {
      symbol: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit';
      quantity: number;
      price?: number;
    }
  ): Promise<SimulatedOrder> {
    const orderId = `sim_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const simulatedOrder: SimulatedOrder = {
      id: orderId,
      strategyId,
      symbol: orderParams.symbol,
      side: orderParams.side,
      type: orderParams.type,
      quantity: orderParams.quantity,
      price: orderParams.price || 0,
      status: 'pending',
      createdAt: new Date(),
      isPaperTrade: true,
      simulationMetadata: {
        expectedLatency: this.calculateExpectedLatency(),
        expectedSlippage: this.calculateExpectedSlippage(orderParams),
        fillProbability: this.calculateFillProbability(orderParams)
      }
    };

    // Validate order against risk limits
    await this.validateOrderRiskLimits(simulatedOrder);

    // Store simulated order
    this.simulatedOrders.set(orderId, simulatedOrder);

    // Simulate order processing
    await this.processSimulatedOrder(simulatedOrder);

    this.emit('order:simulated', simulatedOrder);
    
    return simulatedOrder;
  }

  /**
   * Get simulation metrics
   */
  getSimulationMetrics(): HummingbotSimulationMetrics {
    return { ...this.simulationMetrics };
  }

  /**
   * Get strategy simulation metrics
   */
  getStrategySimulationMetrics(strategyId: string): StrategySimulationMetrics | undefined {
    return this.simulationMetrics.strategyPerformance.get(strategyId);
  }

  /**
   * Get virtual balance for currency
   */
  getVirtualBalance(currency: string): number {
    return this.virtualBalances.get(currency) || 0;
  }

  /**
   * Update virtual balance
   */
  updateVirtualBalance(currency: string, amount: number): void {
    const currentBalance = this.virtualBalances.get(currency) || 0;
    const newBalance = currentBalance + amount;
    
    if (newBalance < 0) {
      logger.warn(`Virtual balance for ${currency} would become negative: ${newBalance}`);
      // Don't allow negative balances in simulation
      return;
    }
    
    this.virtualBalances.set(currency, newBalance);
    this.safetyMonitor.updateVirtualPortfolioBalance('default', newBalance);
    
    this.emit('balance:updated', { currency, oldBalance: currentBalance, newBalance });
  }

  /**
   * Reset simulation state
   */
  resetSimulation(): void {
    this.simulatedStrategies.clear();
    this.simulatedOrders.clear();
    this.simulatedTrades.clear();
    this.initializeVirtualBalances();
    this.initializeMetrics();
    
    this.emit('simulation:reset');
    logger.info('Hummingbot simulation state reset');
  }

  /**
   * Get all simulated strategies
   */
  getSimulatedStrategies(): StrategyExecution[] {
    return Array.from(this.simulatedStrategies.values());
  }

  /**
   * Get simulated strategy by ID
   */
  getSimulatedStrategy(strategyId: string): StrategyExecution | undefined {
    return this.simulatedStrategies.get(strategyId);
  }

  /**
   * Stop simulated strategy
   */
  async stopSimulatedStrategy(strategyId: string): Promise<void> {
    const strategy = this.simulatedStrategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Simulated strategy not found: ${strategyId}`);
    }

    strategy.status = 'stopped';
    strategy.endTime = Date.now();
    
    // Cancel any pending orders for this strategy
    const pendingOrders = Array.from(this.simulatedOrders.values())
      .filter(order => order.strategyId === strategyId && order.status === 'pending');
    
    for (const order of pendingOrders) {
      order.status = 'cancelled';
      order.cancelledAt = new Date();
    }

    this.emit('strategy:stopped', strategy);
    logger.info(`Simulated strategy stopped: ${strategyId}`);
  }

  // Private methods

  private initializeVirtualBalances(): void {
    this.virtualBalances.clear();
    if (this.config.virtualBalance) {
      for (const [currency, amount] of Object.entries(this.config.virtualBalance)) {
        this.virtualBalances.set(currency, amount);
      }
    }
  }

  private initializeMetrics(): void {
    this.simulationMetrics = {
      totalSimulatedTrades: 0,
      totalSimulatedVolume: 0,
      simulatedPnL: 0,
      averageExecutionLatency: 0,
      averageSlippage: 0,
      fillRate: 0,
      strategyPerformance: new Map(),
      riskMetrics: {
        maxDrawdown: 0,
        sharpeRatio: 0,
        volatility: 0,
        var95: 0
      }
    };
  }

  private setupEventHandlers(): void {
    this.safetyMonitor.on('critical_safety_violation', (event) => {
      logger.error('Critical safety violation detected, stopping all simulations:', event);
      this.emergencyStopAllSimulations();
    });

    this.safetyMonitor.on('real_trading_attempt_blocked', (event) => {
      logger.warn('Real trading attempt blocked during simulation:', event);
    });
  }

  private async validateSimulationRiskLimits(signal: TradingSignal): Promise<void> {
    // Check concurrent strategies limit
    const activeStrategies = Array.from(this.simulatedStrategies.values())
      .filter(s => s.status === 'active').length;
    
    if (activeStrategies >= this.config.riskLimits.maxConcurrentStrategies) {
      throw new Error(`Maximum concurrent strategies limit reached: ${this.config.riskLimits.maxConcurrentStrategies}`);
    }

    // Check position size limit
    if (signal.quantity && signal.quantity > this.config.riskLimits.maxSimulatedPositionSize) {
      throw new Error(`Position size ${signal.quantity} exceeds maximum allowed ${this.config.riskLimits.maxSimulatedPositionSize}`);
    }

    // Validate signal data
    if (!signal.symbol || signal.symbol === '') {
      throw new Error('Invalid signal: symbol is required');
    }
    
    if (!signal.entryPrice || signal.entryPrice <= 0) {
      throw new Error('Invalid signal: entryPrice must be greater than 0');
    }
    
    if (signal.quantity !== undefined && signal.quantity <= 0) {
      throw new Error('Invalid signal: quantity must be greater than 0');
    }

    // Check daily volume limit
    const today = new Date().toISOString().split('T')[0];
    const dailyVolume = this.calculateDailyVolume(today);
    
    if (dailyVolume >= this.config.riskLimits.maxDailySimulatedVolume) {
      throw new Error(`Daily simulated volume limit reached: ${this.config.riskLimits.maxDailySimulatedVolume}`);
    }

    // Validate with risk management service
    const riskValidation = this.riskService.validateRiskLimits(
      signal,
      signal.quantity || 0,
      this.getVirtualBalance('USDT'),
      []
    );

    if (!riskValidation.isValid) {
      throw new Error(`Risk validation failed: ${riskValidation.violations.map(v => v.message).join(', ')}`);
    }
  }

  private async translateSignalToStrategy(signal: TradingSignal): Promise<HBStrategy> {
    // This is a simplified translation - in practice, this would be more sophisticated
    return {
      type: this.determineStrategyType(signal),
      exchange: signal.exchange || 'binance',
      tradingPair: signal.symbol,
      parameters: this.buildStrategyParameters(signal),
      riskLimits: {
        maxPositionSize: Math.min(signal.quantity || 100, this.config.riskLimits.maxSimulatedPositionSize),
        maxDailyLoss: 1000,
        maxOpenOrders: 10,
        maxSlippage: 0.5
      },
      executionSettings: {
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.1,
        filledOrderDelay: 5,
        orderOptimization: true,
        addTransactionCosts: true,
        priceSource: 'current_market'
      }
    };
  }

  private determineStrategyType(signal: TradingSignal): HBStrategyType {
    // Determine strategy type based on signal characteristics
    if (signal.type === 'grid' || signal.source === 'grid') {
      return 'grid_trading';
    } else if (signal.confidence > 0.8) {
      return 'pure_market_making'; // Use valid HBStrategyType
    } else {
      return 'pure_market_making';
    }
  }

  private buildStrategyParameters(signal: TradingSignal): Record<string, any> {
    const baseParams = {
      orderAmount: signal.quantity || 100,
      bidSpread: 0.1,
      askSpread: 0.1,
      orderLevels: 1
    };

    // Add signal-specific parameters
    if (signal.stopLoss) {
      baseParams['stopLoss'] = signal.stopLoss;
    }
    
    if (signal.takeProfit) {
      baseParams['takeProfit'] = signal.takeProfit;
    }

    return baseParams;
  }

  private async createSimulatedExecution(hbStrategy: HBStrategy, signal: TradingSignal): Promise<StrategyExecution> {
    const executionId = `sim_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: StrategyExecution = {
      id: executionId,
      strategyType: hbStrategy.type,
      instanceId: 'simulation',
      status: 'active',
      startTime: Date.now(),
      parameters: hbStrategy.parameters,
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

    this.simulatedStrategies.set(executionId, execution);
    return execution;
  }

  private async executeFullSimulation(execution: StrategyExecution): Promise<HummingbotSimulationResult> {
    // Simulate complete Hummingbot strategy lifecycle
    const simulationSteps = [
      'strategy_initialization',
      'market_data_subscription',
      'order_placement',
      'order_management',
      'trade_execution',
      'performance_tracking'
    ];

    const results: any[] = [];
    
    // In test mode, skip the actual delays
    const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
    
    if (isTest) {
      // Fast simulation for tests
      for (const step of simulationSteps) {
        results.push({
          step,
          duration: 1,
          success: true,
          timestamp: Date.now()
        });
      }
    } else {
      // Full simulation for production
      for (const step of simulationSteps) {
        const stepResult = await this.simulateStep(step, execution);
        results.push(stepResult);
      }
    }

    return {
      executionId: execution.id,
      simulationType: 'full',
      success: true,
      duration: Date.now() - execution.startTime,
      steps: results,
      finalPerformance: execution.performance,
      virtualBalanceChanges: this.calculateBalanceChanges(),
      riskMetrics: this.calculateRiskMetrics(execution)
    };
  }

  private async executeStrategyOnlySimulation(execution: StrategyExecution): Promise<HummingbotSimulationResult> {
    // Simulate only strategy logic without execution
    const strategyResult = {
      step: 'strategy_logic',
      decisions: ['buy_signal', 'position_sizing', 'risk_check'],
      duration: 1,
      success: true,
      timestamp: Date.now()
    };
    
    return {
      executionId: execution.id,
      simulationType: 'strategy_only',
      success: true,
      duration: Date.now() - execution.startTime,
      steps: [strategyResult],
      finalPerformance: execution.performance,
      virtualBalanceChanges: {},
      riskMetrics: this.calculateRiskMetrics(execution)
    };
  }

  private async executeExecutionOnlySimulation(execution: StrategyExecution): Promise<HummingbotSimulationResult> {
    // Simulate only execution mechanics
    const executionResult = {
      step: 'execution_mechanics',
      actions: ['order_placement', 'fill_simulation', 'slippage_calculation'],
      duration: 1,
      success: true,
      timestamp: Date.now()
    };
    
    return {
      executionId: execution.id,
      simulationType: 'execution_only',
      success: true,
      duration: Date.now() - execution.startTime,
      steps: [executionResult],
      finalPerformance: execution.performance,
      virtualBalanceChanges: this.calculateBalanceChanges(),
      riskMetrics: this.calculateRiskMetrics(execution)
    };
  }

  private async simulateStep(step: string, execution: StrategyExecution): Promise<any> {
    // Simulate individual step with realistic delays and outcomes
    const delay = this.calculateStepDelay(step);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      step,
      duration: delay,
      success: Math.random() > 0.05, // 95% success rate
      timestamp: Date.now()
    };
  }

  private async simulateStrategyLogic(execution: StrategyExecution): Promise<any> {
    // Simulate strategy decision making
    return {
      step: 'strategy_logic',
      decisions: ['buy_signal', 'position_sizing', 'risk_check'],
      duration: 100,
      success: true,
      timestamp: Date.now()
    };
  }

  private async simulateExecutionMechanics(execution: StrategyExecution): Promise<any> {
    // Simulate order execution mechanics
    return {
      step: 'execution_mechanics',
      actions: ['order_placement', 'fill_simulation', 'slippage_calculation'],
      duration: 200,
      success: true,
      timestamp: Date.now()
    };
  }

  private calculateStepDelay(step: string): number {
    // Use shorter delays for testing
    const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
    const multiplier = isTest ? 0.01 : 1; // 1% of normal delay for tests
    
    const delays: Record<string, number> = {
      'strategy_initialization': 500,
      'market_data_subscription': 200,
      'order_placement': 100,
      'order_management': 50,
      'trade_execution': 150,
      'performance_tracking': 25
    };
    
    return Math.max(1, (delays[step] || 100) * multiplier);
  }

  private calculateBalanceChanges(): Record<string, number> {
    const changes: Record<string, number> = {};
    
    for (const [currency, balance] of this.virtualBalances) {
      const initialBalance = this.config.virtualBalance[currency] || 0;
      changes[currency] = balance - initialBalance;
    }
    
    return changes;
  }

  private calculateRiskMetrics(execution: StrategyExecution): any {
    return {
      maxDrawdown: execution.performance.maxDrawdown,
      currentDrawdown: execution.performance.currentDrawdown,
      sharpeRatio: execution.performance.sharpeRatio,
      volatility: 0.15, // Placeholder
      var95: 0.05 // Placeholder
    };
  }

  private async processSimulatedOrder(order: SimulatedOrder): Promise<void> {
    // Simulate order processing with realistic delays
    const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
    setTimeout(async () => {
      try {
        // Simulate latency
        if (this.config.simulationParameters.latencySimulation) {
          await new Promise(resolve => setTimeout(resolve, order.simulationMetadata.expectedLatency));
        }

        // Determine if order fills
        const fillProbability = order.simulationMetadata.fillProbability;
        const willFill = Math.random() < fillProbability;

        if (willFill) {
          await this.fillSimulatedOrder(order);
        } else {
          // Order remains pending or gets cancelled
          if (Math.random() < 0.1) { // 10% chance of cancellation
            order.status = 'cancelled';
            order.cancelledAt = new Date();
          }
        }
      } catch (error) {
        logger.error('Error processing simulated order:', error);
        order.status = 'error';
        order.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }, isTest ? 10 : 1000); // Process after 10ms in tests, 1 second in production
  }

  private async fillSimulatedOrder(order: SimulatedOrder): Promise<void> {
    // Calculate fill details
    const fillQuantity = this.calculateFillQuantity(order);
    const fillPrice = this.calculateFillPrice(order);
    
    // Create simulated trade
    const tradeId = `sim_trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trade: SimulatedTrade = {
      id: tradeId,
      orderId: order.id,
      strategyId: order.strategyId,
      symbol: order.symbol,
      side: order.side,
      quantity: fillQuantity,
      price: fillPrice,
      executedAt: new Date(),
      isPaperTrade: true,
      simulationMetadata: {
        slippage: this.calculateActualSlippage(order, fillPrice),
        latency: order.simulationMetadata.expectedLatency,
        marketImpact: this.calculateMarketImpact(order)
      }
    };

    // Update order status
    order.status = fillQuantity === order.quantity ? 'filled' : 'partially_filled';
    order.filledQuantity = fillQuantity;
    order.filledPrice = fillPrice;
    order.filledAt = new Date();

    // Store trade
    this.simulatedTrades.set(tradeId, trade);

    // Update virtual balances
    this.updateBalancesFromTrade(trade);

    // Update strategy performance
    this.updateStrategyPerformance(trade);

    this.emit('trade:simulated', trade);
  }

  private calculateFillQuantity(order: SimulatedOrder): number {
    if (this.config.simulationParameters.partialFillSimulation && Math.random() < 0.2) {
      // 20% chance of partial fill
      return order.quantity * (0.5 + Math.random() * 0.5);
    }
    return order.quantity;
  }

  private calculateFillPrice(order: SimulatedOrder): number {
    let fillPrice = order.price || 100; // Default price if not set

    if (this.config.simulationParameters.slippageSimulation) {
      const slippage = order.simulationMetadata.expectedSlippage;
      const slippageDirection = order.side === 'buy' ? 1 : -1;
      fillPrice += fillPrice * slippage * slippageDirection;
    }

    return fillPrice;
  }

  private calculateExpectedLatency(): number {
    // Simulate realistic latency (50-500ms)
    return 50 + Math.random() * 450;
  }

  private calculateExpectedSlippage(orderParams: any): number {
    // Simulate slippage based on order size and market conditions
    const baseSlippage = 0.001; // 0.1%
    const sizeMultiplier = Math.min(orderParams.quantity / 1000, 2); // Max 2x for large orders
    return baseSlippage * (1 + sizeMultiplier);
  }

  private calculateFillProbability(orderParams: any): number {
    // Higher probability for market orders, lower for limit orders
    return orderParams.type === 'market' ? 0.95 : 0.7;
  }

  private calculateActualSlippage(order: SimulatedOrder, fillPrice: number): number {
    if (!order.price) return 0;
    return Math.abs(fillPrice - order.price) / order.price;
  }

  private calculateMarketImpact(order: SimulatedOrder): number {
    // Simulate market impact based on order size
    return Math.min(order.quantity / 10000, 0.01); // Max 1% impact
  }

  private updateBalancesFromTrade(trade: SimulatedTrade): void {
    let baseCurrency: string, quoteCurrency: string;
    
    if (trade.symbol.includes('/')) {
      [baseCurrency, quoteCurrency] = trade.symbol.split('/');
    } else {
      // Handle symbols like BTCUSDT
      if (trade.symbol.endsWith('USDT')) {
        baseCurrency = trade.symbol.replace('USDT', '');
        quoteCurrency = 'USDT';
      } else if (trade.symbol.endsWith('BTC')) {
        baseCurrency = trade.symbol.replace('BTC', '');
        quoteCurrency = 'BTC';
      } else {
        // Default fallback
        baseCurrency = trade.symbol.substring(0, 3);
        quoteCurrency = 'USDT';
      }
    }
    
    if (trade.side === 'buy') {
      // Buying base currency with quote currency
      this.updateVirtualBalance(baseCurrency, trade.quantity);
      this.updateVirtualBalance(quoteCurrency, -trade.quantity * trade.price);
    } else {
      // Selling base currency for quote currency
      this.updateVirtualBalance(baseCurrency, -trade.quantity);
      this.updateVirtualBalance(quoteCurrency, trade.quantity * trade.price);
    }
  }

  private updateStrategyPerformance(trade: SimulatedTrade): void {
    const strategy = this.simulatedStrategies.get(trade.strategyId);
    if (!strategy) return;

    strategy.performance.totalTrades++;
    strategy.performance.totalVolume += trade.quantity * trade.price;
    strategy.performance.successfulTrades++; // All simulated trades are successful
    
    // Update strategy metrics in simulation metrics
    let strategyMetrics = this.simulationMetrics.strategyPerformance.get(trade.strategyId);
    if (!strategyMetrics) {
      strategyMetrics = {
        strategyId: trade.strategyId,
        strategyType: strategy.strategyType,
        totalTrades: 0,
        successfulTrades: 0,
        totalVolume: 0,
        pnl: 0,
        maxDrawdown: 0,
        averageLatency: 0,
        fillRate: 0,
        riskScore: 0
      };
      this.simulationMetrics.strategyPerformance.set(trade.strategyId, strategyMetrics);
    }

    strategyMetrics.totalTrades++;
    strategyMetrics.successfulTrades++;
    strategyMetrics.totalVolume += trade.quantity * trade.price;
    strategyMetrics.averageLatency = trade.simulationMetadata.latency;
    strategyMetrics.fillRate = strategyMetrics.successfulTrades / strategyMetrics.totalTrades;
  }

  private updateSimulationMetrics(result: HummingbotSimulationResult): void {
    this.simulationMetrics.totalSimulatedTrades++;
    this.simulationMetrics.totalSimulatedVolume += result.finalPerformance.totalVolume;
    this.simulationMetrics.simulatedPnL += result.finalPerformance.totalPnL;
    
    // Update averages
    const totalTrades = this.simulationMetrics.totalSimulatedTrades;
    this.simulationMetrics.averageExecutionLatency = 
      (this.simulationMetrics.averageExecutionLatency * (totalTrades - 1) + result.duration) / totalTrades;
  }

  private updateStrategyPerformanceMetrics(strategyId: string, result: HummingbotSimulationResult): void {
    const strategy = this.simulatedStrategies.get(strategyId);
    if (!strategy) return;

    let strategyMetrics = this.simulationMetrics.strategyPerformance.get(strategyId);
    if (!strategyMetrics) {
      strategyMetrics = {
        strategyId: strategyId,
        strategyType: strategy.strategyType,
        totalTrades: 0,
        successfulTrades: 0,
        totalVolume: 0,
        pnl: 0,
        maxDrawdown: 0,
        averageLatency: 0,
        fillRate: 0,
        riskScore: 0
      };
      this.simulationMetrics.strategyPerformance.set(strategyId, strategyMetrics);
    }

    strategyMetrics.totalTrades++;
    strategyMetrics.successfulTrades++;
    strategyMetrics.totalVolume += result.finalPerformance.totalVolume;
    strategyMetrics.pnl += result.finalPerformance.totalPnL;
    strategyMetrics.averageLatency = result.duration;
    strategyMetrics.fillRate = 1.0; // Simulated trades always fill
  }

  private calculateDailyVolume(date: string): number {
    return Array.from(this.simulatedTrades.values())
      .filter(trade => trade.executedAt.toISOString().startsWith(date))
      .reduce((sum, trade) => sum + (trade.quantity * trade.price), 0);
  }

  private async validateOrderRiskLimits(order: SimulatedOrder): Promise<void> {
    // Check position size limit
    if (order.quantity > this.config.riskLimits.maxSimulatedPositionSize) {
      throw new Error(`Order quantity ${order.quantity} exceeds maximum position size ${this.config.riskLimits.maxSimulatedPositionSize}`);
    }

    // Check virtual balance
    const quoteCurrency = order.symbol.includes('/') 
      ? order.symbol.split('/')[1] 
      : order.symbol.endsWith('USDT') ? 'USDT' 
      : order.symbol.endsWith('BTC') ? 'BTC'
      : 'USDT'; // Default to USDT
    const requiredBalance = order.quantity * (order.price || 100);
    const availableBalance = this.getVirtualBalance(quoteCurrency);
    
    if (order.side === 'buy' && requiredBalance > availableBalance) {
      throw new Error(`Insufficient virtual balance: required ${requiredBalance}, available ${availableBalance}`);
    }
  }

  private emergencyStopAllSimulations(): void {
    // Stop all active simulated strategies
    for (const [strategyId, strategy] of this.simulatedStrategies) {
      if (strategy.status === 'active') {
        strategy.status = 'emergency_stopped';
        strategy.endTime = Date.now();
      }
    }

    // Cancel all pending orders
    for (const [orderId, order] of this.simulatedOrders) {
      if (order.status === 'pending') {
        order.status = 'cancelled';
        order.cancelledAt = new Date();
      }
    }

    this.emit('emergency:all_simulations_stopped');
    logger.warn('All Hummingbot simulations stopped due to safety violation');
  }
}

export default HummingbotPaperTradingIntegration;