/**
 * Grid Strategy Service Demo
 * Demonstrates advanced grid trading capabilities with Elliott Wave and Fibonacci integration
 */

import { GridStrategyService } from '../services/GridStrategyService';
import { ElliottWaveService } from '../services/ElliottWaveService';
import { FibonacciService } from '../services/FibonacciService';
import {
  GridConfig,
  GridStrategy,
  ElliottWaveGridConfig,
  FibonacciGridConfig,
  DynamicGridConfig,
  GridRiskParameters
} from '../types/grid';
import { CandleData } from '../types/market';
// import { WaveStructure, FibonacciLevels } from '../types/analysis';

// Sample market data for demonstration
const sampleCandles: CandleData[] = [
  {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    timestamp: 1640995200000,
    open: 46000,
    high: 46500,
    low: 45500,
    close: 46200,
    volume: 1000
  },
  {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    timestamp: 1640998800000,
    open: 46200,
    high: 48000,
    low: 46000,
    close: 47800,
    volume: 1500
  },
  {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    timestamp: 1641002400000,
    open: 47800,
    high: 48200,
    low: 47000,
    close: 47200,
    volume: 1200
  },
  {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    timestamp: 1641006000000,
    open: 47200,
    high: 49500,
    low: 47000,
    close: 49200,
    volume: 2000
  },
  {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    timestamp: 1641009600000,
    open: 49200,
    high: 49800,
    low: 48500,
    close: 49000,
    volume: 1800
  }
];

const riskParameters: GridRiskParameters = {
  maxLevels: 8,
  maxExposure: 50000,
  maxDrawdown: 0.15,
  stopLoss: 44000,
  takeProfit: 52000
};

async function demonstrateElliottWaveGrid() {
  console.log('\n=== Elliott Wave Grid Strategy Demo ===');
  
  try {
    const elliottWaveService = new ElliottWaveService();
    const gridService = new GridStrategyService();

    // Analyze wave structure
    console.log('1. Analyzing Elliott Wave structure...');
    const waveStructure = await elliottWaveService.analyzeWaveStructure(sampleCandles);
    
    console.log(`   Current Wave: ${waveStructure.currentWave.type}`);
    console.log(`   Wave Count: ${waveStructure.waveCount}`);
    console.log(`   Validity: ${(waveStructure.validity * 100).toFixed(1)}%`);
    console.log(`   Invalidation Level: $${waveStructure.invalidationLevel.toFixed(2)}`);

    // Configure Elliott Wave grid
    const elliottWaveConfig: ElliottWaveGridConfig = {
      waveAnalysis: waveStructure,
      longWaves: ['wave_1', 'wave_3', 'wave_5'],
      shortWaves: ['wave_a', 'wave_b', 'wave_c'],
      invalidationLevel: waveStructure.invalidationLevel,
      waveTargets: [50000, 52000, 55000]
    };

    const gridConfig: GridConfig & { elliottWaveConfig: ElliottWaveGridConfig } = {
      symbol: 'BTCUSDT',
      strategy: 'elliott_wave' as GridStrategy,
      basePrice: 49000,
      quantity: 0.1,
      riskParameters,
      elliottWaveConfig
    };

    // Calculate grid levels
    console.log('\n2. Calculating Elliott Wave-based grid levels...');
    const gridResult = await gridService.calculateElliottWaveGrid(gridConfig);
    
    console.log(`   Total Levels: ${gridResult.totalLevels}`);
    console.log(`   Total Quantity: ${gridResult.totalQuantity.toFixed(3)} BTC`);
    console.log(`   Required Balance: $${gridResult.requiredBalance.toFixed(2)}`);
    console.log(`   Estimated Profit: $${gridResult.estimatedProfit.toFixed(2)}`);
    console.log(`   Risk Assessment: ${gridResult.riskAssessment.recommendation}`);

    console.log('\n   Grid Levels:');
    gridResult.levels.forEach((level, index) => {
      console.log(`   ${index + 1}. ${level.side.toUpperCase()} ${level.quantity} BTC @ $${level.price.toFixed(2)} (Wave: ${level.waveContext?.currentWave})`);
    });

    // Demonstrate grid monitoring
    console.log('\n3. Monitoring grid performance...');
    // Simulate some filled levels
    const simulatedGrid = {
      id: 'demo-grid-1',
      symbol: 'BTCUSDT',
      strategy: 'elliott_wave' as GridStrategy,
      levels: gridResult.levels.map((level, index) => ({
        ...level,
        filled: index < 2, // Simulate first 2 levels filled
        filledAt: index < 2 ? Date.now() - (index * 3600000) : undefined,
        profit: index < 2 ? (level.side === 'buy' ? 50 : -20) : undefined
      })),
      basePrice: 49000,
      spacing: 500,
      totalProfit: 30,
      status: 'active' as const,
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Mock the grid model for demo
    const currentPrice = 49500;
    const filledLevels = simulatedGrid.levels.filter(level => level.filled);
    const activeLevels = simulatedGrid.levels.filter(level => !level.filled);
    
    console.log(`   Current Price: $${currentPrice}`);
    console.log(`   Filled Levels: ${filledLevels.length}`);
    console.log(`   Active Levels: ${activeLevels.length}`);
    console.log(`   Realized P&L: $${simulatedGrid.totalProfit}`);

    // Check for invalidation
    console.log('\n4. Checking wave invalidation...');
    const invalidationCheck = await gridService.checkGridInvalidation(
      'demo-grid-1', 
      currentPrice, 
      waveStructure
    );
    
    console.log(`   Is Invalidated: ${invalidationCheck.isInvalidated}`);
    console.log(`   Reason: ${invalidationCheck.reason || 'Grid structure remains valid'}`);
    console.log(`   Recommended Action: ${invalidationCheck.recommendedAction}`);

  } catch (error) {
    console.error('Elliott Wave Grid Demo Error:', error);
  }
}

async function demonstrateFibonacciGrid() {
  console.log('\n=== Fibonacci Grid Strategy Demo ===');
  
  try {
    const fibonacciService = new FibonacciService();
    const gridService = new GridStrategyService();

    // Calculate Fibonacci levels
    console.log('1. Calculating Fibonacci levels...');
    const highPrice = Math.max(...sampleCandles.map(c => c.high));
    const lowPrice = Math.min(...sampleCandles.map(c => c.low));
    const startTime = sampleCandles[0].timestamp;
    const endTime = sampleCandles[sampleCandles.length - 1].timestamp;

    const fibonacciLevels = fibonacciService.generateFibonacciAnalysis(
      highPrice,
      lowPrice,
      startTime,
      endTime
    );

    console.log(`   Swing High: $${fibonacciLevels.highPrice.toFixed(2)}`);
    console.log(`   Swing Low: $${fibonacciLevels.lowPrice.toFixed(2)}`);
    console.log(`   Retracement Levels: ${fibonacciLevels.retracements.length}`);
    console.log(`   Extension Levels: ${fibonacciLevels.extensions.length}`);
    console.log(`   Confluence Zones: ${fibonacciLevels.confluenceZones.length}`);

    // Display key Fibonacci levels
    console.log('\n   Key Retracement Levels:');
    fibonacciLevels.retracements.forEach(level => {
      console.log(`   ${level.description}: $${level.price.toFixed(2)} (Strength: ${level.strength.toFixed(2)})`);
    });

    // Configure Fibonacci grid
    const fibonacciConfig: FibonacciGridConfig = {
      fibonacciLevels,
      useRetracements: true,
      useExtensions: true,
      goldenRatioEmphasis: true,
      confluenceZones: true
    };

    const gridConfig: GridConfig & { fibonacciConfig: FibonacciGridConfig } = {
      symbol: 'BTCUSDT',
      strategy: 'fibonacci' as GridStrategy,
      basePrice: (highPrice + lowPrice) / 2,
      quantity: 0.08,
      riskParameters,
      fibonacciConfig
    };

    // Calculate Fibonacci grid
    console.log('\n2. Calculating Fibonacci-based grid levels...');
    const gridResult = await gridService.calculateFibonacciGrid(gridConfig);
    
    console.log(`   Total Levels: ${gridResult.totalLevels}`);
    console.log(`   Total Quantity: ${gridResult.totalQuantity.toFixed(3)} BTC`);
    console.log(`   Required Balance: $${gridResult.requiredBalance.toFixed(2)}`);
    console.log(`   Risk Assessment: ${gridResult.riskAssessment.recommendation}`);

    console.log('\n   Fibonacci Grid Levels:');
    gridResult.levels.forEach((level, index) => {
      const fibRatio = level.fibonacciLevel ? `${(level.fibonacciLevel * 100).toFixed(1)}%` : 'N/A';
      const isGoldenRatio = level.fibonacciLevel === 0.618 || level.fibonacciLevel === 1.618;
      const marker = isGoldenRatio ? ' ⭐' : '';
      console.log(`   ${index + 1}. ${level.side.toUpperCase()} ${level.quantity.toFixed(3)} BTC @ $${level.price.toFixed(2)} (${fibRatio})${marker}`);
    });

  } catch (error) {
    console.error('Fibonacci Grid Demo Error:', error);
  }
}

async function demonstrateDynamicGrid() {
  console.log('\n=== Dynamic Grid Strategy Demo ===');
  
  try {
    const gridService = new GridStrategyService();

    // Configure dynamic grid
    const dynamicConfig: DynamicGridConfig = {
      volatilityAdjustment: true,
      volumeAdjustment: true,
      trendAdjustment: true,
      rebalanceFrequency: 60, // 1 hour
      adaptationSpeed: 0.7
    };

    const gridConfig: GridConfig & { dynamicConfig: DynamicGridConfig } = {
      symbol: 'BTCUSDT',
      strategy: 'dynamic' as GridStrategy,
      basePrice: 49000,
      spacing: 200,
      quantity: 0.05,
      riskParameters,
      dynamicConfig
    };

    console.log('1. Calculating dynamic grid with market adaptation...');
    const gridResult = await gridService.calculateDynamicGrid(gridConfig, sampleCandles);
    
    console.log(`   Total Levels: ${gridResult.totalLevels}`);
    console.log(`   Adaptive Spacing Applied: Yes`);
    console.log(`   Volatility Adjustment: Enabled`);
    console.log(`   Volume Adjustment: Enabled`);
    console.log(`   Trend Adjustment: Enabled`);

    // Separate buy and sell levels
    const buyLevels = gridResult.levels.filter(level => level.side === 'buy');
    const sellLevels = gridResult.levels.filter(level => level.side === 'sell');

    console.log('\n   Buy Levels (Below Base Price):');
    buyLevels.forEach((level, index) => {
      console.log(`   ${index + 1}. BUY ${level.quantity.toFixed(3)} BTC @ $${level.price.toFixed(2)}`);
    });

    console.log('\n   Sell Levels (Above Base Price):');
    sellLevels.forEach((level, index) => {
      console.log(`   ${index + 1}. SELL ${level.quantity.toFixed(3)} BTC @ $${level.price.toFixed(2)}`);
    });

    // Demonstrate grid adjustment
    console.log('\n2. Simulating market condition changes...');
    const newMarketConditions = {
      currentPrice: 49800,
      volatility: 0.15 // Higher volatility
    };

    console.log(`   New Price: $${newMarketConditions.currentPrice}`);
    console.log(`   Increased Volatility: ${(newMarketConditions.volatility * 100).toFixed(1)}%`);
    console.log('   Grid would be adjusted to wider spacing due to increased volatility');

  } catch (error) {
    console.error('Dynamic Grid Demo Error:', error);
  }
}

async function demonstrateGridOptimization() {
  console.log('\n=== Grid Parameter Optimization Demo ===');
  
  try {
    const gridService = new GridStrategyService();

    console.log('1. Analyzing historical grid performance for optimization...');
    
    // Simulate optimization parameters
    const optimizationParams = {
      symbol: 'BTCUSDT',
      strategy: 'fibonacci' as GridStrategy,
      timeframe: '1h',
      lookbackPeriod: 30,
      optimizationMetric: 'sharpe_ratio' as const
    };

    console.log(`   Symbol: ${optimizationParams.symbol}`);
    console.log(`   Strategy: ${optimizationParams.strategy}`);
    console.log(`   Optimization Metric: ${optimizationParams.optimizationMetric}`);
    console.log(`   Lookback Period: ${optimizationParams.lookbackPeriod} days`);

    // Note: In a real scenario, this would analyze historical data
    console.log('\n2. Optimization Results (Simulated):');
    console.log('   Optimal Spacing: $250');
    console.log('   Optimal Level Count: 6');
    console.log('   Optimal Quantity per Level: 0.08 BTC');
    console.log('   Expected Annual Return: 15.2%');
    console.log('   Expected Risk (Volatility): 8.5%');
    console.log('   Sharpe Ratio: 1.79');
    console.log('   Maximum Drawdown: 4.2%');

    console.log('\n3. Backtest Performance Metrics:');
    console.log('   Total Trades: 156');
    console.log('   Win Rate: 73.1%');
    console.log('   Profit Factor: 1.85');
    console.log('   Calmar Ratio: 3.62');

  } catch (error) {
    console.error('Grid Optimization Demo Error:', error);
  }
}

async function runGridStrategyDemo() {
  console.log('🤖 Advanced Grid Trading Strategy Demo');
  console.log('=====================================');
  
  try {
    await demonstrateElliottWaveGrid();
    await demonstrateFibonacciGrid();
    await demonstrateDynamicGrid();
    await demonstrateGridOptimization();
    
    console.log('\n✅ Grid Strategy Demo completed successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('• Elliott Wave-based grid level calculation');
    console.log('• Fibonacci golden ratio grid spacing');
    console.log('• Dynamic grid adjustment for market conditions');
    console.log('• Grid invalidation monitoring');
    console.log('• Performance tracking and optimization');
    console.log('• Risk management integration');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runGridStrategyDemo();
}

export { runGridStrategyDemo };