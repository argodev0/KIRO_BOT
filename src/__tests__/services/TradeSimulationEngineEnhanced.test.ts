/**
 * Enhanced Trade Simulation Engine Tests
 * Tests for virtual balance handling, P&L calculation, and portfolio integration
 */

import { TradeSimulationEngine } from '../../services/TradeSimulationEngine';
import { virtualPortfolioManager } from '../../services/VirtualPortfolioManager';
import { OrderRequest } from '../../types/trading';

// Mock dependencies
jest.mock('../../services/AuditService');
jest.mock('../../services/ProductionLoggingService');
jest.mock('../../utils/logger');

describe('Enhanced Trade Simulation Engine', () => {
  let engine: TradeSimulationEngine;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables for paper trading
    process.env.TRADING_SIMULATION_ONLY = 'true';
    process.env.PAPER_TRADING_MODE = 'true';
    
    engine = TradeSimulationEngine.getInstance({
      enableSlippage: true,
      enableFees: true,
      enableExecutionDelay: false,
      baseSlippagePercent: 0.05,
      baseFeePercent: 0.1
    });

    // Reset virtual portfolio for test user
    virtualPortfolioManager.resetUserPortfolio(testUserId);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TRADING_SIMULATION_ONLY;
    delete process.env.PAPER_TRADING_MODE;
  });

  describe('Virtual Balance Handling', () => {
    it('should initialize virtual balance for new user', async () => {
      const balance = await engine.getVirtualBalance(testUserId);

      expect(balance).toBeDefined();
      expect(balance.totalBalance).toBe(10000); // Default initial balance
      expect(balance.availableBalance).toBe(10000);
      expect(balance.lockedBalance).toBe(0);
      expect(balance.currency).toBe('USDT');
    });

    it('should return existing balance for existing user', async () => {
      // Initialize portfolio first
      await virtualPortfolioManager.initializeUserPortfolio(testUserId);
      
      const balance1 = await engine.getVirtualBalance(testUserId);
      const balance2 = await engine.getVirtualBalance(testUserId);

      expect(balance1).toEqual(balance2);
    });
  });

  describe('Trade Execution with Portfolio Integration', () => {
    it('should execute buy order and update virtual portfolio', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance',
        clientOrderId: 'test-buy-order'
      };

      const result = await engine.executeTradeWithPortfolio(testUserId, orderRequest);

      expect(result.simulatedOrder).toBeDefined();
      expect(result.simulatedOrder.isPaperTrade).toBe(true);
      expect(result.simulatedOrder.status).toBe('filled');
      expect(result.simulatedOrder.side).toBe('buy');
      expect(result.simulatedOrder.quantity).toBe(0.1);

      expect(result.updatedBalance).toBeDefined();
      expect(result.updatedBalance.availableBalance).toBeLessThan(10000); // Balance should decrease

      expect(result.portfolioSummary).toBeDefined();
      expect(result.portfolioSummary.isPaperPortfolio).toBe(true);
      expect(result.portfolioSummary.tradeHistory.length).toBeGreaterThan(0);
    });

    it('should execute sell order and update virtual portfolio', async () => {
      // First buy some BTC
      const buyOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      await engine.executeTradeWithPortfolio(testUserId, buyOrder);

      // Then sell it
      const sellOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'sell',
        type: 'market',
        quantity: 0.05,
        price: 51000,
        exchange: 'binance'
      };

      const result = await engine.executeTradeWithPortfolio(testUserId, sellOrder);

      expect(result.simulatedOrder.side).toBe('sell');
      expect(result.simulatedOrder.quantity).toBe(0.05);
      expect(result.portfolioSummary.tradeHistory.length).toBe(2);
    });

    it('should handle insufficient balance error', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 1.0, // This would cost ~50,000 USDT, more than initial balance
        price: 50000,
        exchange: 'binance'
      };

      await expect(engine.executeTradeWithPortfolio(testUserId, orderRequest))
        .rejects.toThrow('Insufficient virtual balance');
    });
  });

  describe('P&L Calculation', () => {
    it('should calculate unrealized P&L for long position', () => {
      const pnl = engine.calculatePositionPnL(
        50000, // entry price
        52000, // current price
        0.1,   // quantity
        'long', // side
        50     // fees
      );

      expect(pnl.unrealizedPnL).toBe(150); // (52000 - 50000) * 0.1 - 50
      expect(pnl.unrealizedPnLPercent).toBeCloseTo(2.99, 1); // ~3%
      expect(pnl.totalCost).toBe(5050); // 50000 * 0.1 + 50
      expect(pnl.currentValue).toBe(5200); // 52000 * 0.1
      expect(pnl.netPnL).toBe(100); // 150 - 50
    });

    it('should calculate unrealized P&L for short position', () => {
      const pnl = engine.calculatePositionPnL(
        50000, // entry price
        48000, // current price
        0.1,   // quantity
        'short', // side
        50     // fees
      );

      expect(pnl.unrealizedPnL).toBe(150); // (50000 - 48000) * 0.1 - 50
      expect(pnl.unrealizedPnLPercent).toBeCloseTo(2.97, 1); // ~3%
      expect(pnl.netPnL).toBe(100); // 150 - 50
    });

    it('should handle zero cost edge case', () => {
      const pnl = engine.calculatePositionPnL(0, 100, 1, 'long', 0);

      expect(pnl.unrealizedPnLPercent).toBe(0);
      expect(pnl.totalCost).toBe(0);
      expect(pnl.currentValue).toBe(100);
    });
  });

  describe('Portfolio Performance Simulation', () => {
    it('should simulate portfolio performance over multiple trades', () => {
      const trades = [
        { symbol: 'BTCUSDT', side: 'buy' as const, quantity: 0.1, price: 50000, timestamp: Date.now() - 3600000 },
        { symbol: 'BTCUSDT', side: 'sell' as const, quantity: 0.1, price: 52000, timestamp: Date.now() - 1800000 },
        { symbol: 'ETHUSDT', side: 'buy' as const, quantity: 1.0, price: 3000, timestamp: Date.now() - 900000 },
        { symbol: 'ETHUSDT', side: 'sell' as const, quantity: 1.0, price: 3200, timestamp: Date.now() }
      ];

      const currentPrices = new Map([
        ['BTCUSDT', 51000],
        ['ETHUSDT', 3100]
      ]);

      const performance = engine.simulatePortfolioPerformance(10000, trades, currentPrices);

      expect(performance.finalBalance).toBeGreaterThan(10000); // Should be profitable
      expect(performance.totalReturn).toBeGreaterThan(0);
      expect(performance.totalReturnPercent).toBeGreaterThan(0);
      expect(performance.winRate).toBeGreaterThan(0);
      expect(performance.equityCurve.length).toBe(trades.length);
      expect(performance.maxDrawdown).toBeGreaterThanOrEqual(0);
    });

    it('should handle losing trades correctly', () => {
      const trades = [
        { symbol: 'BTCUSDT', side: 'buy' as const, quantity: 0.1, price: 50000, timestamp: Date.now() - 1800000 },
        { symbol: 'BTCUSDT', side: 'sell' as const, quantity: 0.1, price: 48000, timestamp: Date.now() }
      ];

      const currentPrices = new Map([['BTCUSDT', 48000]]);

      const performance = engine.simulatePortfolioPerformance(10000, trades, currentPrices);

      expect(performance.totalReturn).toBeLessThan(0); // Should be negative
      expect(performance.totalReturnPercent).toBeLessThan(0);
      expect(performance.maxDrawdown).toBeGreaterThan(0);
    });
  });

  describe('Paper Trading Validation', () => {
    it('should validate paper trading mode is active', () => {
      expect(() => engine.validatePaperTradingMode()).not.toThrow();
      expect(engine.validatePaperTradingMode()).toBe(true);
    });

    it('should throw error when paper trading mode is not active', () => {
      delete process.env.TRADING_SIMULATION_ONLY;
      delete process.env.PAPER_TRADING_MODE;

      expect(() => engine.validatePaperTradingMode())
        .toThrow('Paper trading mode is not active. Real trading is blocked.');
    });
  });

  describe('Detailed Simulation Report', () => {
    it('should generate comprehensive simulation report', async () => {
      // Execute a few trades first
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      await engine.simulateOrderExecution(orderRequest);
      await engine.simulateOrderExecution({ ...orderRequest, side: 'sell' });

      const report = engine.getDetailedSimulationReport();

      expect(report.engineStatus).toBeDefined();
      expect(report.engineStatus.isActive).toBe(true);
      expect(report.engineStatus.paperTradingMode).toBe(true);
      expect(report.engineStatus.totalOrdersSimulated).toBeGreaterThan(0);

      expect(report.configuration).toBeDefined();
      expect(report.configuration.enableSlippage).toBe(true);
      expect(report.configuration.enableFees).toBe(true);

      expect(report.statistics).toBeDefined();
      expect(report.statistics.totalOrders).toBeGreaterThan(0);

      expect(report.marketConditions).toBeDefined();
      expect(Array.isArray(report.marketConditions)).toBe(true);

      expect(report.recentOrders).toBeDefined();
      expect(Array.isArray(report.recentOrders)).toBe(true);
      expect(report.recentOrders.length).toBeGreaterThan(0);
    });
  });

  describe('Fee and Slippage Configuration', () => {
    it('should apply configurable trading fees', async () => {
      engine.updateConfig({
        baseFeePercent: 0.2, // 0.2% fee
        enableFees: true
      });

      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(orderRequest);

      expect(result.simulationDetails.feePercent).toBe(0.2);
      expect(result.simulationDetails.fee).toBeCloseTo(100, 0); // 0.1 * 50000 * 0.002
    });

    it('should apply configurable slippage', async () => {
      engine.updateConfig({
        baseSlippagePercent: 0.1, // 0.1% slippage
        enableSlippage: true
      });

      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(orderRequest);

      expect(result.simulationDetails.slippagePercent).toBeGreaterThan(0);
      expect(result.price).toBeGreaterThan(orderRequest.price!); // Buy orders should have positive slippage
    });

    it('should disable fees when configured', async () => {
      engine.updateConfig({
        enableFees: false
      });

      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(orderRequest);

      expect(result.simulationDetails.fee).toBe(0);
      expect(result.simulationDetails.feePercent).toBe(0);
    });

    it('should disable slippage when configured', async () => {
      engine.updateConfig({
        enableSlippage: false
      });

      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(orderRequest);

      expect(result.simulationDetails.slippage).toBe(0);
      expect(result.simulationDetails.slippagePercent).toBe(0);
      expect(result.price).toBe(orderRequest.price);
    });
  });

  describe('Market Conditions Impact', () => {
    it('should adjust slippage based on market volatility', async () => {
      // Set high volatility market conditions
      engine.updateMarketConditions('BTCUSDT', {
        volatility: 0.8,
        liquidity: 0.5,
        spread: 0.03,
        volume: 0.6
      });

      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const result = await engine.simulateOrderExecution(orderRequest);

      expect(result.simulationDetails.slippagePercent).toBeGreaterThan(0.05); // Should be higher than base
    });

    it('should adjust fees based on exchange', async () => {
      const binanceOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
        price: 50000,
        exchange: 'binance'
      };

      const kucoinOrder: OrderRequest = {
        ...binanceOrder,
        exchange: 'kucoin'
      };

      const binanceResult = await engine.simulateOrderExecution(binanceOrder);
      const kucoinResult = await engine.simulateOrderExecution(kucoinOrder);

      // Different exchanges should have different fee structures
      expect(binanceResult.simulationDetails.feePercent).not.toBe(kucoinResult.simulationDetails.feePercent);
    });
  });
});