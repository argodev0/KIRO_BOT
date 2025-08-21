/**
 * Technical Analysis Engine Demo
 * Demonstrates the capabilities of the technical analysis calculation engine
 */

import { TechnicalAnalysisService } from '../services/TechnicalAnalysisService';
import { CandleData } from '../types/market';

// Generate sample market data
function generateSampleData(count: number = 100): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = 50000;
  const startTime = Date.now() - (count * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    // Create realistic price movement with trend and noise
    const trendComponent = Math.sin(i / 20) * 0.01; // Long-term trend
    const noise = (Math.random() - 0.5) * 0.02; // Random noise
    const change = trendComponent + noise;

    const open = currentPrice;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = 1000000 + Math.random() * 5000000;

    candles.push({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: startTime + (i * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

async function runTechnicalAnalysisDemo() {
  console.log('🚀 Technical Analysis Engine Demo\n');

  // Initialize the technical analysis service
  const analysisService = new TechnicalAnalysisService();

  // Generate sample market data
  console.log('📊 Generating sample market data...');
  const candles = generateSampleData(100);
  console.log(`Generated ${candles.length} candles for ${candles[0].symbol}`);
  console.log(`Price range: $${Math.min(...candles.map(c => c.low)).toFixed(2)} - $${Math.max(...candles.map(c => c.high)).toFixed(2)}\n`);

  try {
    // 1. Calculate all technical indicators
    console.log('🔍 Calculating technical indicators...');
    const indicators = await analysisService.calculateIndicators(candles);
    
    console.log('RSI Values (last 5):');
    console.log(indicators.rsi.slice(-5).map(rsi => rsi.toFixed(2)).join(', '));
    
    console.log('\nWave Trend Values (last 5):');
    indicators.waveTrend.slice(-5).forEach((wt, i) => {
      console.log(`  ${i + 1}: WT1=${wt.wt1.toFixed(2)}, WT2=${wt.wt2.toFixed(2)}, Signal=${wt.signal}`);
    });
    
    console.log('\nPVT Values (last 5):');
    console.log(indicators.pvt.slice(-5).map(pvt => pvt.toFixed(0)).join(', '));

    // 2. Get current technical indicators summary
    console.log('\n📈 Current Technical Analysis Summary:');
    const currentIndicators = await analysisService.getCurrentIndicators(candles);
    
    console.log(`RSI: ${currentIndicators.rsi.toFixed(2)} (${currentIndicators.rsi > 70 ? 'Overbought' : currentIndicators.rsi < 30 ? 'Oversold' : 'Neutral'})`);
    console.log(`Wave Trend: WT1=${currentIndicators.waveTrend.wt1.toFixed(2)}, WT2=${currentIndicators.waveTrend.wt2.toFixed(2)} (${currentIndicators.waveTrend.signal})`);
    console.log(`PVT: ${currentIndicators.pvt.toFixed(0)}`);
    console.log(`Trend: ${currentIndicators.trend}`);
    console.log(`Momentum: ${currentIndicators.momentum}`);
    console.log(`Volatility: ${(currentIndicators.volatility * 100).toFixed(2)}%`);

    // 3. Detect support and resistance levels
    console.log('\n🎯 Support & Resistance Levels:');
    const srLevels = await analysisService.detectSupportResistance(candles);
    
    const supportLevels = srLevels.filter(level => level.type === 'support').slice(0, 3);
    const resistanceLevels = srLevels.filter(level => level.type === 'resistance').slice(0, 3);
    
    console.log('Support Levels:');
    supportLevels.forEach(level => {
      console.log(`  $${level.price.toFixed(2)} (Strength: ${(level.strength * 100).toFixed(0)}%, Touches: ${level.touches})`);
    });
    
    console.log('Resistance Levels:');
    resistanceLevels.forEach(level => {
      console.log(`  $${level.price.toFixed(2)} (Strength: ${(level.strength * 100).toFixed(0)}%, Touches: ${level.touches})`);
    });

    // 4. Classify market regime
    console.log('\n🌊 Market Regime Analysis:');
    const regime = await analysisService.classifyMarketRegime(candles);
    
    console.log(`Type: ${regime.type}`);
    console.log(`Strength: ${(regime.strength * 100).toFixed(0)}%`);
    console.log(`Volatility: ${regime.volatility}`);
    console.log(`Volume: ${regime.volume}`);
    console.log(`Confidence: ${(regime.confidence * 100).toFixed(0)}%`);

    // 5. Multi-timeframe analysis simulation
    console.log('\n⏰ Multi-Timeframe Analysis:');
    try {
      // Generate more data for higher timeframes
      const moreCandles = generateSampleData(200);
      const timeframes = {
        '1h': moreCandles,
        '4h': moreCandles.filter((_, i) => i % 4 === 0), // Simulate 4h data
      };
      
      const mtfAnalysis = await analysisService.getMultiTimeframeAnalysis('BTCUSDT', timeframes);
      
      console.log(`Consensus Direction: ${mtfAnalysis.consensus.direction}`);
      console.log(`Consensus Strength: ${(mtfAnalysis.consensus.strength * 100).toFixed(0)}%`);
      console.log(`Confluence: ${(mtfAnalysis.consensus.confluence * 100).toFixed(0)}%`);
    } catch (error) {
      console.log('Multi-timeframe analysis requires more data for higher timeframes');
      console.log('Skipping this demonstration...');
    }

    // 6. Configuration demonstration
    console.log('\n⚙️  Configuration Management:');
    const currentConfig = analysisService.getConfig();
    console.log(`RSI Period: ${currentConfig.indicators.rsi.period}`);
    console.log(`Wave Trend N1: ${currentConfig.indicators.waveTrend.n1}, N2: ${currentConfig.indicators.waveTrend.n2}`);
    
    // Update configuration
    analysisService.updateConfig({
      indicators: {
        rsi: { period: 21, overbought: 75, oversold: 25 },
        waveTrend: { n1: 12, n2: 24 },
        pvt: { period: 20 },
      },
    });
    
    console.log('Updated RSI period to 21, recalculating...');
    const updatedIndicators = await analysisService.getCurrentIndicators(candles);
    console.log(`New RSI: ${updatedIndicators.rsi.toFixed(2)}`);

    console.log('\n✅ Technical Analysis Demo completed successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('• RSI calculation with configurable periods');
    console.log('• Wave Trend indicator with buy/sell signals');
    console.log('• Price Volume Trend (PVT) calculation');
    console.log('• Support and resistance level detection');
    console.log('• Market regime classification');
    console.log('• Multi-timeframe analysis coordination');
    console.log('• Dynamic configuration management');

  } catch (error) {
    console.error('❌ Error during technical analysis demo:', error);
  }
}

// Run the demo
if (require.main === module) {
  runTechnicalAnalysisDemo().catch(console.error);
}

export { runTechnicalAnalysisDemo };