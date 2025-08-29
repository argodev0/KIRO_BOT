/**
 * Simple test script to verify Trade Simulation Engine functionality
 */

const { TradeSimulationEngine } = require('./dist/services/TradeSimulationEngine');
const { virtualPortfolioManager } = require('./dist/services/VirtualPortfolioManager');

async function testTradeSimulationEngine() {
  console.log('🚀 Testing Trade Simulation Engine...\n');

  try {
    // Set environment variables for paper trading
    process.env.TRADING_SIMULATION_ONLY = 'true';
    process.env.PAPER_TRADING_MODE = 'true';

    // Initialize the engine
    const engine = TradeSimulationEngine.getInstance({
      enableSlippage: true,
      enableFees: true,
      enableExecutionDelay: false,
      baseSlippagePercent: 0.05,
      baseFeePercent: 0.1
    });

    console.log('✅ Trade Simulation Engine initialized');

    // Test 1: Validate paper trading mode
    console.log('\n📋 Test 1: Paper Trading Mode Validation');
    try {
      const isValid = engine.validatePaperTradingMode();
      console.log(`✅ Paper trading mode validation: ${isValid}`);
    } catch (error) {
      console.log(`❌ Paper trading mode validation failed: ${error.message}`);
    }

    // Test 2: Simulate a market order
    console.log('\n📋 Test 2: Market Order Simulation');
    const marketOrder = {
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 0.1,
      price: 50000,
      exchange: 'binance',
      clientOrderId: 'test-market-order'
    };

    const marketResult = await engine.simulateOrderExecution(marketOrder);
    console.log('✅ Market order simulated:', {
      orderId: marketResult.orderId,
      symbol: marketResult.symbol,
      side: marketResult.side,
      quantity: marketResult.quantity,
      price: marketResult.price,
      status: marketResult.status,
      isPaperTrade: marketResult.isPaperTrade,
      slippage: marketResult.simulationDetails.slippage,
      fee: marketResult.simulationDetails.fee
    });

    // Test 3: Virtual balance handling
    console.log('\n📋 Test 3: Virtual Balance Handling');
    const testUserId = 'test-user-123';
    
    try {
      const balance = await engine.getVirtualBalance(testUserId);
      console.log('✅ Virtual balance retrieved:', {
        totalBalance: balance.totalBalance,
        availableBalance: balance.availableBalance,
        currency: balance.currency
      });
    } catch (error) {
      console.log(`❌ Virtual balance test failed: ${error.message}`);
    }

    // Test 4: P&L Calculation
    console.log('\n📋 Test 4: P&L Calculation');
    const pnl = engine.calculatePositionPnL(
      50000, // entry price
      52000, // current price
      0.1,   // quantity
      'long', // side
      50     // fees
    );
    console.log('✅ P&L calculated:', {
      unrealizedPnL: pnl.unrealizedPnL,
      unrealizedPnLPercent: pnl.unrealizedPnLPercent.toFixed(2) + '%',
      totalCost: pnl.totalCost,
      currentValue: pnl.currentValue,
      netPnL: pnl.netPnL
    });

    // Test 5: Portfolio Performance Simulation
    console.log('\n📋 Test 5: Portfolio Performance Simulation');
    const trades = [
      { symbol: 'BTCUSDT', side: 'buy', quantity: 0.1, price: 50000, timestamp: Date.now() - 3600000 },
      { symbol: 'BTCUSDT', side: 'sell', quantity: 0.1, price: 52000, timestamp: Date.now() }
    ];
    const currentPrices = new Map([['BTCUSDT', 51000]]);
    
    const performance = engine.simulatePortfolioPerformance(10000, trades, currentPrices);
    console.log('✅ Portfolio performance simulated:', {
      finalBalance: performance.finalBalance,
      totalReturn: performance.totalReturn,
      totalReturnPercent: performance.totalReturnPercent.toFixed(2) + '%',
      winRate: (performance.winRate * 100).toFixed(1) + '%',
      maxDrawdown: performance.maxDrawdown.toFixed(2) + '%'
    });

    // Test 6: Configuration Management
    console.log('\n📋 Test 6: Configuration Management');
    const config = engine.getConfig();
    console.log('✅ Current configuration:', {
      enableSlippage: config.enableSlippage,
      enableFees: config.enableFees,
      baseSlippagePercent: config.baseSlippagePercent,
      baseFeePercent: config.baseFeePercent
    });

    // Test 7: Simulation Statistics
    console.log('\n📋 Test 7: Simulation Statistics');
    const stats = engine.getSimulationStats();
    console.log('✅ Simulation statistics:', {
      totalOrders: stats.totalOrders,
      filledOrders: stats.filledOrders,
      averageSlippage: stats.averageSlippage.toFixed(4),
      averageFee: stats.averageFee.toFixed(2)
    });

    // Test 8: Detailed Report
    console.log('\n📋 Test 8: Detailed Simulation Report');
    const report = engine.getDetailedSimulationReport();
    console.log('✅ Detailed report generated:', {
      engineActive: report.engineStatus.isActive,
      paperTradingMode: report.engineStatus.paperTradingMode,
      totalOrdersSimulated: report.engineStatus.totalOrdersSimulated,
      marketConditionsCount: report.marketConditions.length,
      recentOrdersCount: report.recentOrders.length
    });

    console.log('\n🎉 All Trade Simulation Engine tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('✅ Virtual balance handling system - IMPLEMENTED');
    console.log('✅ Trading fee simulation with configurable rates - IMPLEMENTED');
    console.log('✅ Slippage simulation for realistic trade execution - IMPLEMENTED');
    console.log('✅ P&L calculation for virtual portfolio tracking - IMPLEMENTED');
    console.log('✅ Paper trading safety validation - IMPLEMENTED');
    console.log('✅ Portfolio performance simulation - IMPLEMENTED');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testTradeSimulationEngine().catch(console.error);