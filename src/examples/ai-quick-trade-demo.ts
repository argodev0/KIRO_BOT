import { AIQuickTradeExecutor } from '../services/AIQuickTradeExecutor';
import { QuickTradeConfig } from '../types/quickTrade';

async function demonstrateAIQuickTradeExecution() {
  console.log('🚀 AI-Powered Quick Trade Execution System Demo');
  console.log('================================================');

  // Configure the AI Quick Trade Executor
  const config: QuickTradeConfig = {
    maxConcurrentPositions: 3,
    maxPositionSize: 1000,
    minProbabilityThreshold: 0.6,
    maxRiskPerTrade: 0.02,
    hedgeMode: {
      enabled: true,
      activationThreshold: 0.01,
      hedgeRatio: 0.5,
      maxHedgePositions: 2,
      hedgeDelayMs: 1000,
      correlationThreshold: 0.7
    },
    executionTimeoutMs: 5000,
    slippageTolerance: 0.001,
    minTrendStrength: 0.3
  };

  const executor = new AIQuickTradeExecutor(config);

  // Set up event listeners
  executor.on('positionOpened', (position) => {
    console.log(`📈 Position opened: ${position.symbol} ${position.side} ${position.size} @ ${position.entryPrice}`);
  });

  executor.on('positionClosed', (data) => {
    console.log(`📉 Position closed: ${data.position.symbol} P&L: ${data.finalPnL.toFixed(2)} (${data.reason})`);
  });

  executor.on('hedgeActivated', (data) => {
    console.log(`🛡️ Hedge activated: ${data.original.symbol} hedged with ${data.hedge.symbol}`);
  });

  try {
    // Start the executor
    await executor.start();
    console.log('✅ AI Quick Trade Executor started');

    // Generate sample market data (trending upward)
    const priceData = Array.from({length: 50}, (_, i) => 100 + i * 0.5 + Math.sin(i * 0.1) * 2);
    const volumeData = Array.from({length: 50}, () => 1000 + Math.random() * 500);

    console.log('\n📊 Analyzing market conditions...');
    
    // Analyze market conditions
    const marketConditions = await executor.analyzeMarketConditions(priceData, volumeData);
    console.log(`Market Regime: ${marketConditions.probability.marketRegime}`);
    console.log(`Trend Bias: ${marketConditions.trend.directionalBias}`);
    console.log(`Entry Probability: ${(marketConditions.probability.entryProbability * 100).toFixed(1)}%`);
    console.log(`Confidence Score: ${(marketConditions.probability.confidenceScore * 100).toFixed(1)}%`);
    console.log(`Trend Strength: ${(marketConditions.trend.trendStrength * 100).toFixed(1)}%`);

    // Generate trading signal
    console.log('\n🎯 Generating trading signal...');
    const signal = await executor.generateQuickTradeSignal('BTCUSDT', priceData, volumeData);

    if (signal) {
      console.log(`Signal: ${signal.action} ${signal.symbol}`);
      console.log(`Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
      console.log(`Position Size: ${signal.positionSize}`);
      console.log(`Target Price: ${signal.targetPrice.toFixed(2)}`);
      console.log(`Stop Loss: ${signal.stopLoss.toFixed(2)}`);

      // Execute the trade
      console.log('\n⚡ Executing quick trade...');
      const result = await executor.executeQuickTrade(signal);

      if (result.success) {
        console.log(`✅ Trade executed successfully`);
        console.log(`Executed Price: ${result.executedPrice.toFixed(2)}`);
        console.log(`Executed Size: ${result.executedSize}`);
        console.log(`Slippage: ${(result.slippage * 100).toFixed(3)}%`);
        console.log(`Latency: ${result.latency.toFixed(0)}ms`);
      } else {
        console.log(`❌ Trade execution failed: ${result.error}`);
      }

      // Show active positions
      const positions = executor.getActivePositions();
      console.log(`\n📋 Active Positions: ${positions.length}`);
      positions.forEach(pos => {
        console.log(`  ${pos.symbol} ${pos.side} ${pos.size} @ ${pos.entryPrice.toFixed(2)} (P&L: ${pos.unrealizedPnL.toFixed(2)})`);
      });

      // Show risk metrics
      const riskMetrics = executor.getRiskMetrics();
      console.log(`\n📊 Risk Metrics:`);
      console.log(`  Total Exposure: ${riskMetrics.totalExposure.toFixed(2)}`);
      console.log(`  Win Rate: ${(riskMetrics.winRate * 100).toFixed(1)}%`);
      console.log(`  Sharpe Ratio: ${riskMetrics.sharpeRatio.toFixed(2)}`);

    } else {
      console.log('❌ No suitable trading signal generated');
    }

    // Wait a bit to see any hedge activation
    console.log('\n⏳ Waiting for potential hedge activation...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Stop the executor
    console.log('\n🛑 Stopping AI Quick Trade Executor...');
    await executor.stop();
    console.log('✅ AI Quick Trade Executor stopped');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
if (require.main === module) {
  demonstrateAIQuickTradeExecution()
    .then(() => {
      console.log('\n🎉 Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateAIQuickTradeExecution };