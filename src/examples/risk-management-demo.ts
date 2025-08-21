/**
 * Risk Management Service Demo
 * Demonstrates comprehensive risk management capabilities
 */

import { RiskManagementService, PositionSizeRequest, EmergencyShutdownReason } from '../services/RiskManagementService';
import { TradingSignal, Position, Portfolio } from '../types/trading';

async function demonstrateRiskManagement() {
  console.log('🛡️  Risk Management Service Demo\n');

  // Initialize risk management service
  const riskService = new RiskManagementService();

  // Sample trading signal
  const signal: TradingSignal = {
    symbol: 'BTCUSDT',
    direction: 'long',
    confidence: 0.85,
    entryPrice: 50000,
    stopLoss: 48000,
    takeProfit: [52000, 54000],
    reasoning: {
      technical: { indicators: ['RSI', 'MACD'], confluence: 0.8, trend: 'bullish' },
      patterns: { detected: ['hammer'], strength: 0.7 },
      elliottWave: { currentWave: 'Wave 3', wavePosition: 'impulse', validity: 0.9 },
      fibonacci: { levels: [0.618], confluence: 0.8 },
      volume: { profile: 'increasing', strength: 0.7 },
      summary: 'Strong bullish signal with multiple confirmations'
    },
    timestamp: Date.now()
  };

  // Account setup
  const accountBalance = 100000; // $100,000 account

  // Existing positions
  const currentPositions: Position[] = [
    {
      id: 'pos1',
      symbol: 'ETHUSDT',
      side: 'long',
      size: 10,
      entryPrice: 3000,
      currentPrice: 3100,
      unrealizedPnl: 1000,
      timestamp: Date.now(),
      exchange: 'binance'
    }
  ];

  // Portfolio status
  const portfolio: Portfolio = {
    totalBalance: accountBalance,
    availableBalance: 80000,
    positions: currentPositions,
    totalUnrealizedPnl: 1000,
    totalRealizedPnl: 5000,
    maxDrawdown: 0.15,
    currentDrawdown: 0.08,
    equity: 101000
  };

  console.log('📊 Account Overview:');
  console.log(`Balance: $${accountBalance.toLocaleString()}`);
  console.log(`Current Positions: ${currentPositions.length}`);
  console.log(`Current Drawdown: ${(portfolio.currentDrawdown * 100).toFixed(2)}%\n`);

  // 1. Position Size Calculation
  console.log('💰 Position Size Calculation:');
  
  const positionRequest: PositionSizeRequest = {
    signal,
    accountBalance,
    riskPercentage: 0.02, // 2% risk
    currentPositions
  };

  const positionSize = riskService.calculatePositionSize(positionRequest);
  const positionValue = positionSize * signal.entryPrice;
  
  console.log(`Signal: ${signal.symbol} ${signal.direction} at $${signal.entryPrice}`);
  console.log(`Stop Loss: $${signal.stopLoss}`);
  console.log(`Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
  console.log(`Calculated Position Size: ${positionSize} BTC`);
  console.log(`Position Value: $${positionValue.toLocaleString()}`);
  console.log(`Risk Amount: $${(positionSize * Math.abs(signal.entryPrice - signal.stopLoss!)).toLocaleString()}\n`);

  // 2. Risk Validation
  console.log('🔍 Risk Validation:');
  
  const validation = riskService.validateRiskLimits(
    signal,
    positionSize,
    accountBalance,
    currentPositions,
    portfolio
  );

  console.log(`Validation Result: ${validation.isValid ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Risk Percentage: ${(validation.riskPercentage * 100).toFixed(2)}%`);
  console.log(`Current Exposure: ${validation.currentExposure.toFixed(2)}x`);
  console.log(`Max Allowed Size: ${validation.maxAllowedSize.toFixed(4)} BTC`);

  if (validation.violations.length > 0) {
    console.log('\n⚠️  Risk Violations:');
    validation.violations.forEach(violation => {
      console.log(`- ${violation.type}: ${violation.message}`);
    });
  }
  console.log();

  // 3. Drawdown Monitoring
  console.log('📉 Drawdown Monitoring:');
  
  const drawdownStatus = riskService.monitorDrawdown(portfolio);
  
  console.log(`Current Drawdown: ${(drawdownStatus.current * 100).toFixed(2)}%`);
  console.log(`Maximum Drawdown: ${(drawdownStatus.maximum * 100).toFixed(2)}%`);
  console.log(`Violation: ${drawdownStatus.isViolation ? '❌ YES' : '✅ NO'}`);
  console.log(`Action Required: ${drawdownStatus.actionRequired.toUpperCase()}\n`);

  // 4. Leverage Adjustment
  console.log('⚖️  Leverage Adjustment:');
  
  const baseLeverage = 5;
  const marketVolatility = 0.04; // 4% volatility
  
  const adjustedLeverage = riskService.adjustLeverageForVolatility(
    baseLeverage,
    signal.symbol,
    marketVolatility
  );
  
  console.log(`Base Leverage: ${baseLeverage}x`);
  console.log(`Market Volatility: ${(marketVolatility * 100).toFixed(2)}%`);
  console.log(`Adjusted Leverage: ${adjustedLeverage}x\n`);

  // 5. Correlation Analysis
  console.log('🔗 Correlation Analysis:');
  
  const correlationAnalysis = riskService.analyzeCorrelation(signal.symbol, currentPositions);
  
  console.log(`Target Symbol: ${correlationAnalysis.symbol}`);
  console.log(`Correlated Assets: ${correlationAnalysis.correlatedSymbols.join(', ') || 'None'}`);
  console.log(`Max Correlation: ${(correlationAnalysis.correlationCoefficient * 100).toFixed(1)}%`);
  console.log(`Risk Adjustment: ${(correlationAnalysis.riskAdjustment * 100).toFixed(1)}%\n`);

  // 6. Daily Loss Tracking
  console.log('📅 Daily Loss Tracking:');
  
  // Simulate some daily losses
  riskService.updateDailyLoss(2000);
  riskService.updateDailyLoss(1500);
  
  console.log('Daily losses updated: $2,000 + $1,500 = $3,500');
  
  // Test validation with daily loss
  const dailyLossValidation = riskService.validateRiskLimits(
    signal,
    positionSize,
    accountBalance,
    currentPositions
  );
  
  const dailyLossViolation = dailyLossValidation.violations.find(v => v.type === 'max_daily_loss');
  if (dailyLossViolation) {
    console.log(`⚠️  Daily loss limit check: ${dailyLossViolation.message}`);
  } else {
    console.log('✅ Daily loss within limits');
  }
  console.log();

  // 7. Emergency Scenarios
  console.log('🚨 Emergency Scenarios:');
  
  // Simulate high drawdown scenario
  const highDrawdownPortfolio: Portfolio = {
    ...portfolio,
    currentDrawdown: 0.25 // 25% drawdown
  };
  
  const emergencyDrawdownStatus = riskService.monitorDrawdown(highDrawdownPortfolio);
  console.log(`High Drawdown Scenario: ${(emergencyDrawdownStatus.current * 100).toFixed(2)}%`);
  console.log(`Action Required: ${emergencyDrawdownStatus.actionRequired.toUpperCase()}`);
  
  if (emergencyDrawdownStatus.actionRequired === 'emergency_close') {
    console.log('🚨 Emergency shutdown would be triggered!');
    
    const shutdownReason: EmergencyShutdownReason = {
      type: 'risk_violation',
      message: 'Maximum drawdown exceeded - emergency position closure required',
      severity: 'critical',
      timestamp: Date.now()
    };
    
    console.log(`Shutdown Reason: ${shutdownReason.message}`);
    console.log(`Severity: ${shutdownReason.severity.toUpperCase()}`);
    
    // Note: In demo, we don't actually execute the shutdown
    console.log('(Emergency shutdown simulation - not executed in demo)');
  }
  console.log();

  // 8. Risk Parameter Customization
  console.log('⚙️  Custom Risk Parameters:');
  
  const customRiskService = new RiskManagementService({
    maxRiskPerTrade: 0.01, // 1% instead of 3%
    maxTotalExposure: 3.0,  // 3x instead of 5x
    maxDrawdown: 0.15       // 15% instead of 20%
  });
  
  const customValidation = customRiskService.validateRiskLimits(
    signal,
    positionSize,
    accountBalance,
    currentPositions
  );
  
  console.log('Custom Parameters Applied:');
  console.log(`- Max Risk Per Trade: 1%`);
  console.log(`- Max Total Exposure: 3x`);
  console.log(`- Max Drawdown: 15%`);
  console.log(`Validation with Custom Params: ${customValidation.isValid ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (!customValidation.isValid) {
    console.log('Violations with stricter parameters:');
    customValidation.violations.forEach(violation => {
      console.log(`- ${violation.message}`);
    });
  }
  console.log();

  // 9. Risk Summary
  console.log('📋 Risk Management Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Position sizing calculated with multiple adjustments`);
  console.log(`✅ Risk limits validated across all parameters`);
  console.log(`✅ Drawdown monitoring with automated actions`);
  console.log(`✅ Leverage adjusted for market volatility`);
  console.log(`✅ Correlation analysis prevents over-exposure`);
  console.log(`✅ Daily loss tracking with limits enforcement`);
  console.log(`✅ Emergency shutdown system ready for critical events`);
  console.log(`✅ Customizable risk parameters for different strategies`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n🎯 Risk Management Demo Complete!');
  console.log('The system provides comprehensive protection through:');
  console.log('• Multi-factor position sizing');
  console.log('• Real-time risk validation');
  console.log('• Automated drawdown protection');
  console.log('• Emergency shutdown capabilities');
  console.log('• Correlation-based exposure management');
  console.log('• Volatility-adjusted leverage');
}

// Run the demo
if (require.main === module) {
  demonstrateRiskManagement().catch(console.error);
}

export { demonstrateRiskManagement };