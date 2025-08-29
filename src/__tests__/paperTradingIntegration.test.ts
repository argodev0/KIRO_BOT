/**
 * Paper Trading Integration Test
 * Simple integration test to verify paper trading safety components work together
 */

import { PaperTradingGuard } from '../middleware/paperTradingGuard';
import { VirtualPortfolioManager } from '../services/VirtualPortfolioManager';
import { TradeSimulationEngine } from '../services/TradeSimulationEngine';

describe('Paper Trading Integration', () => {
  test('should enforce paper trading safety across all components', async () => {
    // Initialize components
    const paperTradingGuard = PaperTradingGuard.getInstance();
    const virtualPortfolioManager = VirtualPortfolioManager.getInstance();
    const tradeSimulationEngine = TradeSimulationEngine.getInstance();

    const testUserId = 'integration_test_user';

    // 1. Validate paper trading mode
    expect(() => paperTradingGuard.validatePaperTradingMode()).not.toThrow();

    // 2. Initialize virtual portfolio
    const balance = await virtualPortfolioManager.initializeUserPortfolio(testUserId);
    expect(balance.totalBalance).toBe(10000);

    // 3. Simulate order execution (without delay)
    const orderRequest = {
      symbol: 'BTCUSDT',
      side: 'buy' as const,
      type: 'limit' as const, // Use limit order to avoid delay
      quantity: 0.001,
      price: 50000,
      exchange: 'binance'
    };

    const simulatedOrder = await tradeSimulationEngine.simulateOrderExecution(orderRequest);
    expect(simulatedOrder.isPaperTrade).toBe(true);

    // 4. Execute trade in virtual portfolio
    const trade = await virtualPortfolioManager.executeSimulatedTrade(
      testUserId,
      simulatedOrder.symbol,
      simulatedOrder.side === 'buy' ? 'BUY' : 'SELL',
      simulatedOrder.quantity,
      simulatedOrder.price || 50000,
      simulatedOrder.orderId
    );

    expect(trade.isPaperTrade).toBe(true);

    // 5. Verify portfolio summary
    const portfolio = virtualPortfolioManager.getPortfolioSummary(testUserId);
    expect(portfolio?.isPaperPortfolio).toBe(true);
    expect(portfolio?.positions.length).toBeGreaterThan(0);

    // 6. Verify security audit trail
    const auditLog = paperTradingGuard.getSecurityAuditLog();
    expect(auditLog.length).toBeGreaterThan(0);

    // Clean up
    virtualPortfolioManager.resetUserPortfolio(testUserId);
  }, 10000); // 10 second timeout

  test('should validate API key permissions', async () => {
    const paperTradingGuard = PaperTradingGuard.getInstance();

    // Safe API key should pass
    const safeResult = await paperTradingGuard.validateApiPermissions('readonly_key_123', 'binance');
    expect(safeResult.isValid).toBe(true);
    expect(safeResult.riskLevel).toBe('low');

    // Dangerous API key should fail
    expect(() => {
      paperTradingGuard.validateApiPermissions('trading_key_with_trade_permissions', 'binance');
    }).toThrow();
  });

  test('should maintain paper trading configuration', () => {
    const paperTradingGuard = PaperTradingGuard.getInstance();
    const config = paperTradingGuard.getConfig();

    expect(config.enabled).toBe(true);
    expect(config.allowRealTrades).toBe(false);
    expect(config.initialVirtualBalance).toBe(10000);
  });
});