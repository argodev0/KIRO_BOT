/**
 * Virtual Portfolio Manager
 * Manages simulated balances and portfolio state for paper trading
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface VirtualBalance {
  userId: string;
  currency: string;
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  lastUpdated: Date;
}

export interface SimulatedTrade {
  id: string;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  slippage: number;
  executedAt: Date;
  isPaperTrade: true;
  orderId?: string | undefined;
  signalId?: string | undefined;
}

export interface VirtualPosition {
  id: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  stopLoss?: number;
  takeProfit?: number[];
  createdAt: Date;
  updatedAt: Date;
  isPaperPosition: true;
}

export interface PortfolioSummary {
  userId: string;
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  equity: number;
  positions: VirtualPosition[];
  tradeHistory: SimulatedTrade[];
  performance: PerformanceMetrics;
  isPaperPortfolio: true;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export interface VirtualPortfolioConfig {
  initialBalance: number;
  baseCurrency: string;
  tradingFee: number;
  slippageSimulation: boolean;
  maxSlippagePercent: number;
  enableRealisticFees: boolean;
  maxLeverage: number;
}

export class VirtualPortfolioManager extends EventEmitter {
  private static instance: VirtualPortfolioManager;
  private virtualBalances: Map<string, Map<string, VirtualBalance>> = new Map();
  private virtualPositions: Map<string, VirtualPosition[]> = new Map();
  private tradeHistory: Map<string, SimulatedTrade[]> = new Map();
  private config: VirtualPortfolioConfig;

  private constructor(config?: Partial<VirtualPortfolioConfig>) {
    super();
    this.config = {
      initialBalance: 10000, // $10,000 starting balance
      baseCurrency: 'USDT',
      tradingFee: 0.001, // 0.1%
      slippageSimulation: true,
      maxSlippagePercent: 0.5, // 0.5% max slippage
      enableRealisticFees: true,
      maxLeverage: 3,
      ...config
    };

    logger.info('Virtual Portfolio Manager initialized', {
      config: this.config,
      isPaperTrading: true
    });
  }

  public static getInstance(config?: Partial<VirtualPortfolioConfig>): VirtualPortfolioManager {
    if (!VirtualPortfolioManager.instance) {
      VirtualPortfolioManager.instance = new VirtualPortfolioManager(config);
    }
    return VirtualPortfolioManager.instance;
  }

  /**
   * Initialize virtual portfolio for a user
   */
  public async initializeUserPortfolio(userId: string): Promise<VirtualBalance> {
    try {
      // Check if user already has a portfolio
      if (this.virtualBalances.has(userId)) {
        const existingBalance = this.virtualBalances.get(userId)?.get(this.config.baseCurrency);
        if (existingBalance) {
          logger.info(`Virtual portfolio already exists for user ${userId}`);
          return existingBalance;
        }
      }

      // Create initial virtual balance
      const initialBalance: VirtualBalance = {
        userId,
        currency: this.config.baseCurrency,
        totalBalance: this.config.initialBalance,
        availableBalance: this.config.initialBalance,
        lockedBalance: 0,
        lastUpdated: new Date()
      };

      // Store the balance
      if (!this.virtualBalances.has(userId)) {
        this.virtualBalances.set(userId, new Map());
      }
      this.virtualBalances.get(userId)!.set(this.config.baseCurrency, initialBalance);

      // Initialize empty positions and trade history
      this.virtualPositions.set(userId, []);
      this.tradeHistory.set(userId, []);

      this.emit('portfolioInitialized', { userId, initialBalance });

      logger.info(`Virtual portfolio initialized for user ${userId}`, {
        initialBalance: this.config.initialBalance,
        currency: this.config.baseCurrency,
        isPaperTrading: true
      });

      return initialBalance;
    } catch (error) {
      logger.error(`Failed to initialize virtual portfolio for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get virtual balance for a user
   */
  public getVirtualBalance(userId: string, currency: string = this.config.baseCurrency): VirtualBalance | null {
    const userBalances = this.virtualBalances.get(userId);
    if (!userBalances) {
      return null;
    }
    return userBalances.get(currency) || null;
  }

  /**
   * Execute a simulated trade
   */
  public async executeSimulatedTrade(
    userId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    orderId?: string,
    signalId?: string
  ): Promise<SimulatedTrade> {
    try {
      // Ensure user has a portfolio
      let balance = this.getVirtualBalance(userId);
      if (!balance) {
        balance = await this.initializeUserPortfolio(userId);
      }

      // Calculate fees and slippage
      const fee = this.calculateTradingFee(quantity, price);
      const slippage = this.config.slippageSimulation ? this.calculateSlippage(price, quantity) : 0;
      const executionPrice = price + (side === 'BUY' ? slippage : -slippage);
      const totalCost = quantity * executionPrice + fee;

      // Validate sufficient balance for buy orders
      if (side === 'BUY' && balance.availableBalance < totalCost) {
        throw new Error(`Insufficient virtual balance. Required: ${totalCost}, Available: ${balance.availableBalance}`);
      }

      // Create simulated trade
      const simulatedTrade: SimulatedTrade = {
        id: `sim_trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        symbol,
        side,
        quantity,
        price: executionPrice,
        fee,
        slippage,
        executedAt: new Date(),
        isPaperTrade: true,
        orderId,
        signalId
      };

      // Update virtual balance
      await this.updateVirtualBalance(userId, simulatedTrade);

      // Update or create position
      await this.updateVirtualPosition(userId, simulatedTrade);

      // Add to trade history
      if (!this.tradeHistory.has(userId)) {
        this.tradeHistory.set(userId, []);
      }
      this.tradeHistory.get(userId)!.push(simulatedTrade);

      // Keep only last 1000 trades per user
      const userTrades = this.tradeHistory.get(userId)!;
      if (userTrades.length > 1000) {
        this.tradeHistory.set(userId, userTrades.slice(-1000));
      }

      this.emit('tradeExecuted', simulatedTrade);

      logger.info(`Simulated trade executed for user ${userId}`, {
        trade: simulatedTrade,
        isPaperTrade: true
      });

      return simulatedTrade;
    } catch (error) {
      logger.error(`Failed to execute simulated trade for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update virtual balance after a trade
   */
  private async updateVirtualBalance(userId: string, trade: SimulatedTrade): Promise<void> {
    const balance = this.getVirtualBalance(userId);
    if (!balance) {
      throw new Error(`Virtual balance not found for user ${userId}`);
    }

    const totalCost = trade.quantity * trade.price + trade.fee;

    if (trade.side === 'BUY') {
      balance.availableBalance -= totalCost;
    } else {
      balance.availableBalance += totalCost - trade.fee;
    }

    balance.totalBalance = balance.availableBalance + balance.lockedBalance;
    balance.lastUpdated = new Date();

    // Update the stored balance
    this.virtualBalances.get(userId)!.set(balance.currency, balance);

    this.emit('balanceUpdated', { userId, balance, trade });
  }

  /**
   * Update or create virtual position
   */
  private async updateVirtualPosition(userId: string, trade: SimulatedTrade): Promise<void> {
    let positions = this.virtualPositions.get(userId) || [];
    
    // Find existing position for the symbol
    let existingPosition = positions.find(p => p.symbol === trade.symbol);

    if (!existingPosition) {
      // Create new position
      existingPosition = {
        id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        symbol: trade.symbol,
        side: trade.side === 'BUY' ? 'long' : 'short',
        size: trade.quantity,
        entryPrice: trade.price,
        currentPrice: trade.price,
        unrealizedPnl: 0,
        realizedPnl: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPaperPosition: true
      };
      positions.push(existingPosition);
    } else {
      // Update existing position
      if ((existingPosition.side === 'long' && trade.side === 'BUY') ||
          (existingPosition.side === 'short' && trade.side === 'SELL')) {
        // Increase position size
        const totalValue = existingPosition.size * existingPosition.entryPrice + trade.quantity * trade.price;
        const totalSize = existingPosition.size + trade.quantity;
        existingPosition.entryPrice = totalValue / totalSize;
        existingPosition.size = totalSize;
      } else {
        // Reduce or close position
        if (trade.quantity >= existingPosition.size) {
          // Close position completely
          const realizedPnl = this.calculateRealizedPnl(existingPosition, trade);
          existingPosition.realizedPnl += realizedPnl;
          
          // Remove position if completely closed
          positions = positions.filter(p => p.id !== existingPosition!.id);
        } else {
          // Partial close
          const closedPortion = trade.quantity / existingPosition.size;
          const realizedPnl = this.calculateRealizedPnl(existingPosition, trade) * closedPortion;
          existingPosition.realizedPnl += realizedPnl;
          existingPosition.size -= trade.quantity;
        }
      }
      existingPosition.updatedAt = new Date();
    }

    this.virtualPositions.set(userId, positions);
    this.emit('positionUpdated', { userId, position: existingPosition, trade });
  }

  /**
   * Calculate realized PnL for position closure
   */
  private calculateRealizedPnl(position: VirtualPosition, trade: SimulatedTrade): number {
    if (position.side === 'long') {
      return (trade.price - position.entryPrice) * trade.quantity - trade.fee;
    } else {
      return (position.entryPrice - trade.price) * trade.quantity - trade.fee;
    }
  }

  /**
   * Calculate unrealized PnL for open positions
   */
  public calculateUnrealizedPnL(userId: string, currentPrices: Map<string, number>): number {
    const positions = this.virtualPositions.get(userId) || [];
    let totalUnrealizedPnl = 0;

    for (const position of positions) {
      const currentPrice = currentPrices.get(position.symbol);
      if (currentPrice) {
        position.currentPrice = currentPrice;
        
        if (position.side === 'long') {
          position.unrealizedPnl = (currentPrice - position.entryPrice) * position.size;
        } else {
          position.unrealizedPnl = (position.entryPrice - currentPrice) * position.size;
        }
        
        totalUnrealizedPnl += position.unrealizedPnl;
      }
    }

    return totalUnrealizedPnl;
  }

  /**
   * Get complete portfolio summary
   */
  public getPortfolioSummary(userId: string, currentPrices?: Map<string, number>): PortfolioSummary | null {
    const balance = this.getVirtualBalance(userId);
    if (!balance) {
      return null;
    }

    const positions = this.virtualPositions.get(userId) || [];
    const trades = this.tradeHistory.get(userId) || [];

    // Calculate unrealized PnL if current prices provided
    let totalUnrealizedPnl = 0;
    if (currentPrices) {
      totalUnrealizedPnl = this.calculateUnrealizedPnL(userId, currentPrices);
    }

    // Calculate total realized PnL
    const totalRealizedPnl = positions.reduce((sum, pos) => sum + pos.realizedPnl, 0);

    // Calculate equity
    const equity = balance.totalBalance + totalUnrealizedPnl;

    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics(trades, this.config.initialBalance);

    return {
      userId,
      totalBalance: balance.totalBalance,
      availableBalance: balance.availableBalance,
      lockedBalance: balance.lockedBalance,
      totalUnrealizedPnl,
      totalRealizedPnl,
      equity,
      positions,
      tradeHistory: trades.slice(-100), // Last 100 trades
      performance,
      isPaperPortfolio: true
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(trades: SimulatedTrade[], initialBalance: number): PerformanceMetrics {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        sharpeRatio: 0,
        totalReturn: 0,
        totalReturnPercent: 0
      };
    }

    // Calculate basic metrics
    const totalTrades = trades.length;
    let totalPnl = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalWins = 0;
    let totalLosses = 0;

    // Simple PnL calculation (this would be more complex in reality)
    for (let i = 1; i < trades.length; i++) {
      const prevTrade = trades[i - 1];
      const currentTrade = trades[i];
      
      if (prevTrade.symbol === currentTrade.symbol && 
          prevTrade.side !== currentTrade.side) {
        // Calculate PnL for round trip
        const pnl = prevTrade.side === 'BUY' 
          ? (currentTrade.price - prevTrade.price) * Math.min(prevTrade.quantity, currentTrade.quantity)
          : (prevTrade.price - currentTrade.price) * Math.min(prevTrade.quantity, currentTrade.quantity);
        
        totalPnl += pnl;
        
        if (pnl > 0) {
          winningTrades++;
          totalWins += pnl;
        } else {
          losingTrades++;
          totalLosses += Math.abs(pnl);
        }
      }
    }

    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const averageWin = winningTrades > 0 ? totalWins / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
    const totalReturnPercent = (totalPnl / initialBalance) * 100;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      maxDrawdown: 0, // Would need equity curve calculation
      currentDrawdown: 0,
      sharpeRatio: 0, // Would need returns analysis
      totalReturn: totalPnl,
      totalReturnPercent
    };
  }

  /**
   * Calculate trading fee
   */
  private calculateTradingFee(quantity: number, price: number): number {
    if (!this.config.enableRealisticFees) {
      return 0;
    }
    return quantity * price * this.config.tradingFee;
  }

  /**
   * Calculate slippage simulation
   */
  private calculateSlippage(price: number, quantity: number): number {
    if (!this.config.slippageSimulation) {
      return 0;
    }

    // Simple slippage model based on quantity
    const baseSlippage = 0.001; // 0.1%
    const quantityImpact = Math.min(quantity / 1000, 0.005); // Max 0.5% impact
    const randomFactor = (Math.random() - 0.5) * 0.002; // ±0.1% random

    const totalSlippagePercent = Math.min(
      baseSlippage + quantityImpact + randomFactor,
      this.config.maxSlippagePercent / 100
    );

    return price * totalSlippagePercent;
  }

  /**
   * Reset user portfolio (for testing or reset functionality)
   */
  public resetUserPortfolio(userId: string): void {
    this.virtualBalances.delete(userId);
    this.virtualPositions.delete(userId);
    this.tradeHistory.delete(userId);

    this.emit('portfolioReset', { userId });

    logger.info(`Virtual portfolio reset for user ${userId}`, {
      isPaperTrading: true
    });
  }

  /**
   * Get all users with virtual portfolios
   */
  public getAllUsers(): string[] {
    return Array.from(this.virtualBalances.keys());
  }

  /**
   * Get configuration
   */
  public getConfig(): VirtualPortfolioConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const virtualPortfolioManager = VirtualPortfolioManager.getInstance();