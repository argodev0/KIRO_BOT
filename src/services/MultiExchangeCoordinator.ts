import { EventEmitter } from 'events';
import { HummingbotBridgeService } from './HummingbotBridgeService';
import { HummingbotStrategyMonitor } from './HummingbotStrategyMonitor';
import { HummingbotConfigurationManager } from './HummingbotConfigurationManager';
import { 
  HBStrategy, 
  HBInstance, 
  StrategyExecution, 
  ArbitrageOpportunity,
  ExchangeStatus,
  PortfolioBalance,
  MultiExchangeConfig
} from '../types/hummingbot';

export interface CrossExchangeStrategy {
  id: string;
  type: 'arbitrage' | 'rebalancing' | 'coordinated_grid';
  exchanges: string[];
  strategies: HBStrategy[];
  status: 'active' | 'paused' | 'stopped';
  performance: {
    totalPnL: number;
    executedTrades: number;
    averageLatency: number;
  };
}

export interface ArbitrageDetectionConfig {
  minProfitThreshold: number;
  maxLatencyMs: number;
  supportedPairs: string[];
  exchanges: string[];
}

export interface ExchangeFailoverConfig {
  primaryExchange: string;
  fallbackExchanges: string[];
  healthCheckIntervalMs: number;
  failoverThresholdMs: number;
}

export class MultiExchangeCoordinator extends EventEmitter {
  private bridgeService: HummingbotBridgeService;
  private strategyMonitor: HummingbotStrategyMonitor;
  private configManager: HummingbotConfigurationManager;
  private activeStrategies: Map<string, CrossExchangeStrategy> = new Map();
  private exchangeStatus: Map<string, ExchangeStatus> = new Map();
  private arbitrageConfig: ArbitrageDetectionConfig;
  private failoverConfig: ExchangeFailoverConfig;
  private portfolioBalances: Map<string, PortfolioBalance> = new Map();

  constructor(
    bridgeService: HummingbotBridgeService,
    strategyMonitor: HummingbotStrategyMonitor,
    configManager: HummingbotConfigurationManager,
    config: MultiExchangeConfig
  ) {
    super();
    this.bridgeService = bridgeService;
    this.strategyMonitor = strategyMonitor;
    this.configManager = configManager;
    this.arbitrageConfig = config.arbitrage;
    this.failoverConfig = config.failover;
    
    this.initializeExchangeMonitoring();
  }

  /**
   * Initialize monitoring for all configured exchanges
   */
  private initializeExchangeMonitoring(): void {
    const exchanges = ['binance', 'kucoin'];
    
    exchanges.forEach(exchange => {
      this.exchangeStatus.set(exchange, {
        name: exchange,
        status: 'unknown',
        lastPing: 0,
        latency: 0,
        errorCount: 0
      });
    });

    // Start health check interval
    setInterval(() => {
      this.performHealthChecks();
    }, this.failoverConfig.healthCheckIntervalMs);
  }

  /**
   * Implement cross-exchange strategy coordination for Binance and KuCoin
   */
  async coordinateStrategies(strategies: HBStrategy[]): Promise<CrossExchangeStrategy> {
    const strategyId = `cross_${Date.now()}`;
    
    // Group strategies by exchange
    const exchangeGroups = this.groupStrategiesByExchange(strategies);
    
    // Validate exchange availability
    await this.validateExchangeAvailability(Object.keys(exchangeGroups));
    
    // Deploy strategies to respective exchanges
    const deployedStrategies: HBStrategy[] = [];
    
    for (const [exchange, exchangeStrategies] of Object.entries(exchangeGroups)) {
      try {
        const instances = await this.bridgeService.getInstancesByExchange(exchange);
        
        for (const strategy of exchangeStrategies) {
          const instance = this.selectOptimalInstance(instances);
          const deployedStrategy = await this.bridgeService.deployStrategy(instance.id, strategy);
          deployedStrategies.push(strategy);
        }
      } catch (error) {
        console.error(`Failed to deploy strategies to ${exchange}:`, error);
        throw new Error(`Cross-exchange coordination failed for ${exchange}`);
      }
    }

    const crossExchangeStrategy: CrossExchangeStrategy = {
      id: strategyId,
      type: 'coordinated_grid',
      exchanges: Object.keys(exchangeGroups),
      strategies: deployedStrategies,
      status: 'active',
      performance: {
        totalPnL: 0,
        executedTrades: 0,
        averageLatency: 0
      }
    };

    this.activeStrategies.set(strategyId, crossExchangeStrategy);
    this.emit('strategyCoordinated', crossExchangeStrategy);
    
    return crossExchangeStrategy;
  }

  /**
   * Create arbitrage opportunity detection and execution via Hummingbot
   */
  async detectArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    for (const pair of this.arbitrageConfig.supportedPairs) {
      const prices = await this.getPricesAcrossExchanges(pair);
      
      // Find price differences
      for (let i = 0; i < prices.length; i++) {
        for (let j = i + 1; j < prices.length; j++) {
          const priceDiff = Math.abs(prices[i].price - prices[j].price);
          const profitPercent = (priceDiff / Math.min(prices[i].price, prices[j].price)) * 100;
          
          if (profitPercent >= this.arbitrageConfig.minProfitThreshold) {
            const buyExchange = prices[i].price < prices[j].price ? prices[i].exchange : prices[j].exchange;
            const sellExchange = prices[i].price < prices[j].price ? prices[j].exchange : prices[i].exchange;
            
            opportunities.push({
              id: `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              pair,
              buyExchange,
              sellExchange,
              buyPrice: Math.min(prices[i].price, prices[j].price),
              sellPrice: Math.max(prices[i].price, prices[j].price),
              profitPercent,
              estimatedProfit: priceDiff,
              detectedAt: Date.now(),
              status: 'detected'
            });
          }
        }
      }
    }
    
    return opportunities;
  }

  /**
   * Execute arbitrage opportunity via Hummingbot
   */
  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<StrategyExecution> {
    // Validate opportunity is still valid
    const currentPrices = await this.getPricesAcrossExchanges(opportunity.pair);
    const buyPrice = currentPrices.find(p => p.exchange === opportunity.buyExchange)?.price;
    const sellPrice = currentPrices.find(p => p.exchange === opportunity.sellExchange)?.price;
    
    if (!buyPrice || !sellPrice || (sellPrice - buyPrice) / buyPrice * 100 < this.arbitrageConfig.minProfitThreshold) {
      throw new Error('Arbitrage opportunity no longer valid');
    }

    // Create arbitrage strategies for both exchanges
    const buyStrategy: HBStrategy = {
      id: `arb_buy_${opportunity.id}`,
      type: 'pure_market_making',
      exchange: opportunity.buyExchange,
      tradingPair: opportunity.pair,
      parameters: {
        bid_spread: 0.1,
        ask_spread: 0.1,
        order_amount: this.calculateArbitrageOrderSize(opportunity),
        order_levels: 1,
        order_level_amount: 0,
        order_level_spread: 0
      },
      riskLimits: {
        maxPositionSize: 1000,
        maxDailyLoss: 100,
        stopLossPercentage: 2,
        maxOpenOrders: 5,
        maxSlippage: 0.5
      },
      executionSettings: {
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.1,
        filledOrderDelay: 1,
        orderOptimization: true,
        addTransactionCosts: true,
        priceSource: 'current_market'
      }
    };

    const sellStrategy: HBStrategy = {
      id: `arb_sell_${opportunity.id}`,
      type: 'pure_market_making',
      exchange: opportunity.sellExchange,
      tradingPair: opportunity.pair,
      parameters: {
        bid_spread: 0.1,
        ask_spread: 0.1,
        order_amount: this.calculateArbitrageOrderSize(opportunity),
        order_levels: 1,
        order_level_amount: 0,
        order_level_spread: 0
      },
      riskLimits: {
        maxPositionSize: 1000,
        maxDailyLoss: 100,
        stopLossPercentage: 2,
        maxOpenOrders: 5,
        maxSlippage: 0.5
      },
      executionSettings: {
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.1,
        filledOrderDelay: 1,
        orderOptimization: true,
        addTransactionCosts: true,
        priceSource: 'current_market'
      }
    };

    // Deploy strategies simultaneously
    const buyInstance = await this.bridgeService.getInstancesByExchange(opportunity.buyExchange);
    const sellInstance = await this.bridgeService.getInstancesByExchange(opportunity.sellExchange);
    
    const [buyExecution, sellExecution] = await Promise.all([
      this.bridgeService.deployStrategy(buyInstance[0].id, buyStrategy),
      this.bridgeService.deployStrategy(sellInstance[0].id, sellStrategy)
    ]);

    const execution: StrategyExecution = {
      id: `arb_exec_${opportunity.id}`,
      strategyType: 'arbitrage',
      instanceId: 'multi_exchange',
      status: 'active',
      startTime: Date.now(),
      parameters: {
        opportunity,
        buyStrategy: buyExecution,
        sellStrategy: sellExecution
      },
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

    this.emit('arbitrageExecuted', execution);
    return execution;
  }  /**

   * Build exchange-specific strategy adjustment based on market conditions
   */
  async adjustStrategiesForMarketConditions(): Promise<void> {
    for (const [strategyId, strategy] of this.activeStrategies) {
      for (const exchange of strategy.exchanges) {
        const marketConditions = await this.getMarketConditions(exchange);
        const adjustments = this.calculateStrategyAdjustments(marketConditions);
        
        if (adjustments.length > 0) {
          await this.applyStrategyAdjustments(strategyId, exchange, adjustments);
        }
      }
    }
  }

  /**
   * Implement failover mechanisms when exchanges become unavailable
   */
  async handleExchangeFailover(failedExchange: string): Promise<void> {
    console.log(`Initiating failover for exchange: ${failedExchange}`);
    
    // Get all strategies running on the failed exchange
    const affectedStrategies = Array.from(this.activeStrategies.values())
      .filter(strategy => strategy.exchanges.includes(failedExchange));
    
    for (const strategy of affectedStrategies) {
      try {
        // Find fallback exchange
        const fallbackExchange = this.findFallbackExchange(failedExchange, strategy.type);
        
        if (fallbackExchange) {
          await this.migrateStrategyToExchange(strategy, failedExchange, fallbackExchange);
          this.emit('strategyMigrated', {
            strategyId: strategy.id,
            fromExchange: failedExchange,
            toExchange: fallbackExchange
          });
        } else {
          // No fallback available, pause strategy
          await this.pauseStrategy(strategy.id);
          this.emit('strategyPaused', {
            strategyId: strategy.id,
            reason: 'No fallback exchange available'
          });
        }
      } catch (error) {
        console.error(`Failed to handle failover for strategy ${strategy.id}:`, error);
        this.emit('failoverError', { strategyId: strategy.id, error });
      }
    }
  }

  /**
   * Create portfolio rebalancing coordination across multiple exchanges
   */
  async rebalancePortfolio(targetAllocations: Map<string, number>): Promise<void> {
    // Get current balances across all exchanges
    await this.updatePortfolioBalances();
    
    const rebalancingTrades: Array<{
      exchange: string;
      pair: string;
      side: 'buy' | 'sell';
      amount: number;
    }> = [];

    // Calculate required trades for rebalancing
    for (const [asset, targetPercent] of targetAllocations) {
      const currentBalances = this.getCurrentAssetBalances(asset);
      const totalValue = this.getTotalPortfolioValue();
      const targetValue = totalValue * (targetPercent / 100);
      
      let currentValue = 0;
      for (const [exchange, balance] of currentBalances) {
        currentValue += balance.value;
      }
      
      const rebalanceAmount = targetValue - currentValue;
      
      if (Math.abs(rebalanceAmount) > totalValue * 0.01) { // 1% threshold
        const trades = this.calculateRebalancingTrades(asset, rebalanceAmount, currentBalances);
        rebalancingTrades.push(...trades);
      }
    }

    // Execute rebalancing trades via Hummingbot
    for (const trade of rebalancingTrades) {
      await this.executeRebalancingTrade(trade);
    }

    this.emit('portfolioRebalanced', {
      trades: rebalancingTrades,
      timestamp: Date.now()
    });
  }

  // Helper methods
  private groupStrategiesByExchange(strategies: HBStrategy[]): Record<string, HBStrategy[]> {
    return strategies.reduce((groups, strategy) => {
      if (!groups[strategy.exchange]) {
        groups[strategy.exchange] = [];
      }
      groups[strategy.exchange].push(strategy);
      return groups;
    }, {} as Record<string, HBStrategy[]>);
  }

  private async validateExchangeAvailability(exchanges: string[]): Promise<void> {
    for (const exchange of exchanges) {
      const status = this.exchangeStatus.get(exchange);
      if (!status || status.status !== 'healthy') {
        throw new Error(`Exchange ${exchange} is not available`);
      }
    }
  }

  private selectOptimalInstance(instances: HBInstance[]): HBInstance {
    // Select instance with lowest load
    return instances.reduce((optimal, current) => {
      const optimalLoad = optimal.strategies.length;
      const currentLoad = current.strategies.length;
      return currentLoad < optimalLoad ? current : optimal;
    });
  }

  private async getPricesAcrossExchanges(pair: string): Promise<Array<{exchange: string, price: number}>> {
    const prices: Array<{exchange: string, price: number}> = [];
    
    for (const exchange of this.arbitrageConfig.exchanges) {
      try {
        const price = await this.bridgeService.getMarketPrice(exchange, pair);
        prices.push({ exchange, price });
      } catch (error) {
        console.warn(`Failed to get price for ${pair} on ${exchange}:`, error);
      }
    }
    
    return prices;
  }

  private calculateArbitrageOrderSize(opportunity: ArbitrageOpportunity): number {
    // Calculate optimal order size based on available balance and risk limits
    const maxRiskAmount = 1000; // Max $1000 per arbitrage
    const estimatedOrderSize = maxRiskAmount / opportunity.buyPrice;
    return Math.min(estimatedOrderSize, 10); // Max 10 units
  }

  private async performHealthChecks(): Promise<void> {
    for (const [exchange, status] of this.exchangeStatus) {
      try {
        const startTime = Date.now();
        await this.bridgeService.pingExchange(exchange);
        const latency = Date.now() - startTime;
        
        this.exchangeStatus.set(exchange, {
          ...status,
          status: 'healthy',
          lastPing: Date.now(),
          latency,
          errorCount: 0
        });
      } catch (error) {
        const newErrorCount = status.errorCount + 1;
        const newStatus = newErrorCount >= 3 ? 'failed' : 'degraded';
        
        this.exchangeStatus.set(exchange, {
          ...status,
          status: newStatus,
          errorCount: newErrorCount
        });

        if (newStatus === 'failed') {
          await this.handleExchangeFailover(exchange);
        }
      }
    }
  }

  private async getMarketConditions(exchange: string): Promise<any> {
    // Get market conditions like volatility, volume, spread
    return {
      volatility: await this.bridgeService.getVolatility(exchange),
      volume: await this.bridgeService.getVolume(exchange),
      spread: await this.bridgeService.getSpread(exchange)
    };
  }

  private calculateStrategyAdjustments(marketConditions: any): any[] {
    const adjustments = [];
    
    // Adjust based on volatility
    if (marketConditions.volatility > 0.05) {
      adjustments.push({
        parameter: 'bid_spread',
        value: marketConditions.volatility * 2,
        reason: 'High volatility detected'
      });
    }
    
    return adjustments;
  }

  private async applyStrategyAdjustments(strategyId: string, exchange: string, adjustments: any[]): Promise<void> {
    const strategy = this.activeStrategies.get(strategyId);
    if (!strategy) return;

    for (const adjustment of adjustments) {
      // Update strategy parameters
      const exchangeStrategies = strategy.strategies.filter(s => s.exchange === exchange);
      for (const exchangeStrategy of exchangeStrategies) {
        exchangeStrategy.parameters[adjustment.parameter] = adjustment.value;
        await this.bridgeService.updateStrategy(exchangeStrategy.id, exchangeStrategy);
      }
    }

    this.emit('strategyAdjusted', { strategyId, exchange, adjustments });
  }

  private findFallbackExchange(failedExchange: string, strategyType: string): string | null {
    const fallbacks = this.failoverConfig.fallbackExchanges.filter(ex => ex !== failedExchange);
    
    for (const fallback of fallbacks) {
      const status = this.exchangeStatus.get(fallback);
      if (status && status.status === 'healthy') {
        return fallback;
      }
    }
    
    return null;
  }

  private async migrateStrategyToExchange(
    strategy: CrossExchangeStrategy, 
    fromExchange: string, 
    toExchange: string
  ): Promise<void> {
    // Stop strategies on failed exchange
    const strategiesToMigrate = strategy.strategies.filter(s => s.exchange === fromExchange);
    
    for (const strategyToMigrate of strategiesToMigrate) {
      // Stop old strategy
      await this.bridgeService.stopStrategy(strategyToMigrate.id);
      
      // Create new strategy on fallback exchange
      const newStrategy = {
        ...strategyToMigrate,
        id: `${strategyToMigrate.id}_migrated`,
        exchange: toExchange
      };
      
      const instances = await this.bridgeService.getInstancesByExchange(toExchange);
      await this.bridgeService.deployStrategy(instances[0].id, newStrategy);
      
      // Update strategy record
      const index = strategy.strategies.findIndex(s => s.id === strategyToMigrate.id);
      if (index !== -1) {
        strategy.strategies[index] = newStrategy;
      }
    }
  }

  private async pauseStrategy(strategyId: string): Promise<void> {
    const strategy = this.activeStrategies.get(strategyId);
    if (strategy) {
      strategy.status = 'paused';
      
      // Stop all associated Hummingbot strategies
      for (const hbStrategy of strategy.strategies) {
        await this.bridgeService.stopStrategy(hbStrategy.id);
      }
    }
  }

  private async updatePortfolioBalances(): Promise<void> {
    const exchanges = ['binance', 'kucoin'];
    
    for (const exchange of exchanges) {
      try {
        const balances = await this.bridgeService.getBalances(exchange);
        this.portfolioBalances.set(exchange, balances);
      } catch (error) {
        console.error(`Failed to get balances for ${exchange}:`, error);
      }
    }
  }

  private getCurrentAssetBalances(asset: string): Map<string, {amount: number, value: number}> {
    const balances = new Map();
    
    for (const [exchange, portfolio] of this.portfolioBalances) {
      const assetBalance = portfolio.assets[asset];
      if (assetBalance) {
        balances.set(exchange, assetBalance);
      }
    }
    
    return balances;
  }

  private getTotalPortfolioValue(): number {
    let total = 0;
    for (const [, portfolio] of this.portfolioBalances) {
      total += portfolio.totalValue;
    }
    return total;
  }

  private calculateRebalancingTrades(
    asset: string, 
    rebalanceAmount: number, 
    currentBalances: Map<string, {amount: number, value: number}>
  ): Array<{exchange: string, pair: string, side: 'buy' | 'sell', amount: number}> {
    const trades = [];
    
    if (rebalanceAmount > 0) {
      // Need to buy more of this asset
      const exchange = this.selectExchangeForBuying(asset);
      trades.push({
        exchange,
        pair: `${asset}/USDT`,
        side: 'buy' as const,
        amount: Math.abs(rebalanceAmount)
      });
    } else {
      // Need to sell some of this asset
      const exchange = this.selectExchangeForSelling(asset, currentBalances);
      trades.push({
        exchange,
        pair: `${asset}/USDT`,
        side: 'sell' as const,
        amount: Math.abs(rebalanceAmount)
      });
    }
    
    return trades;
  }

  private selectExchangeForBuying(asset: string): string {
    // Select exchange with best liquidity/price for buying
    return 'binance'; // Simplified selection
  }

  private selectExchangeForSelling(asset: string, balances: Map<string, any>): string {
    // Select exchange with highest balance for selling
    let maxBalance = 0;
    let selectedExchange = 'binance';
    
    for (const [exchange, balance] of balances) {
      if (balance.amount > maxBalance) {
        maxBalance = balance.amount;
        selectedExchange = exchange;
      }
    }
    
    return selectedExchange;
  }

  private async executeRebalancingTrade(trade: {
    exchange: string;
    pair: string;
    side: 'buy' | 'sell';
    amount: number;
  }): Promise<void> {
    const rebalanceStrategy: HBStrategy = {
      id: `rebalance_${Date.now()}`,
      type: 'pure_market_making',
      exchange: trade.exchange,
      tradingPair: trade.pair,
      parameters: {
        bid_spread: 0.1,
        ask_spread: 0.1,
        order_amount: trade.amount,
        order_levels: 1,
        order_level_amount: 0,
        order_level_spread: 0
      },
      riskLimits: {
        maxPositionSize: trade.amount * 2,
        maxDailyLoss: 1000,
        stopLossPercentage: 5,
        maxOpenOrders: 10,
        maxSlippage: 1.0
      },
      executionSettings: {
        orderRefreshTime: 30,
        orderRefreshTolerance: 0.1,
        filledOrderDelay: 1,
        orderOptimization: true,
        addTransactionCosts: true,
        priceSource: 'current_market'
      }
    };

    const instances = await this.bridgeService.getInstancesByExchange(trade.exchange);
    await this.bridgeService.deployStrategy(instances[0].id, rebalanceStrategy);
  }

  // Public methods for external access
  public getActiveStrategies(): CrossExchangeStrategy[] {
    return Array.from(this.activeStrategies.values());
  }

  public getExchangeStatus(): Map<string, ExchangeStatus> {
    return new Map(this.exchangeStatus);
  }

  public async stopStrategy(strategyId: string): Promise<void> {
    await this.pauseStrategy(strategyId);
    this.activeStrategies.delete(strategyId);
  }
}