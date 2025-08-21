/**
 * Fibonacci Analysis Demo
 * Demonstrates the capabilities of the FibonacciService
 */

import { FibonacciService } from '../services/FibonacciService';
import { Wave } from '../types/analysis';

async function demonstrateFibonacciAnalysis() {
  console.log('🔢 Fibonacci Analysis Demo\n');
  
  const fibonacciService = new FibonacciService();
  
  // Example: Bitcoin price movement from $30,000 to $50,000
  const high = 50000;
  const low = 30000;
  const startTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
  const endTime = Date.now();
  
  console.log('📊 Market Data:');
  console.log(`High: $${high.toLocaleString()}`);
  console.log(`Low: $${low.toLocaleString()}`);
  console.log(`Range: $${(high - low).toLocaleString()}\n`);
  
  // 1. Calculate Fibonacci Retracements
  console.log('📉 Fibonacci Retracement Levels:');
  const retracements = fibonacciService.calculateRetracements({ high, low });
  
  retracements.forEach(level => {
    console.log(`  ${level.description}: $${level.price.toLocaleString()} (Strength: ${level.strength})`);
  });
  console.log();
  
  // 2. Calculate Fibonacci Extensions
  console.log('📈 Fibonacci Extension Levels:');
  const wave1: Wave = {
    id: 'impulse-1',
    type: 'wave_1',
    degree: 'intermediate',
    startPrice: low,
    endPrice: high,
    startTime,
    endTime,
    length: high - low,
    duration: endTime - startTime
  };
  
  const wave2: Wave = {
    id: 'correction-2',
    type: 'wave_2',
    degree: 'intermediate',
    startPrice: high,
    endPrice: 42000, // Retracement to 42k
    startTime: endTime,
    endTime: endTime + 7 * 24 * 60 * 60 * 1000,
    length: 8000,
    duration: 7 * 24 * 60 * 60 * 1000
  };
  
  const extensions = fibonacciService.calculateExtensions(wave1, wave2);
  
  extensions.forEach(level => {
    console.log(`  ${level.description}: $${level.price.toLocaleString()} (Strength: ${level.strength})`);
  });
  console.log();
  
  // 3. Time-based Fibonacci Analysis
  console.log('⏰ Time-based Fibonacci Projections:');
  const timeProjections = fibonacciService.calculateTimeFibonacci(startTime, endTime);
  
  timeProjections.forEach(projection => {
    const projectedDate = new Date(projection.timestamp);
    console.log(`  ${projection.description}: ${projectedDate.toLocaleDateString()}`);
  });
  console.log();
  
  // 4. Confluence Zone Detection
  console.log('🎯 Confluence Zone Analysis:');
  const allLevels = [...retracements, ...extensions];
  const confluenceZones = fibonacciService.findConfluenceZones(allLevels);
  
  if (confluenceZones.length > 0) {
    confluenceZones.forEach((zone, index) => {
      console.log(`  Zone ${index + 1}: $${zone.priceLevel.toLocaleString()}`);
      console.log(`    Strength: ${zone.strength.toFixed(2)}`);
      console.log(`    Type: ${zone.type}`);
      console.log(`    Factors: ${zone.factors.length}`);
      console.log(`    Reliability: ${(zone.reliability * 100).toFixed(1)}%`);
      console.log();
    });
  } else {
    console.log('  No confluence zones detected with current levels\n');
  }
  
  // 5. Golden Ratio Zone Identification
  console.log('✨ Golden Ratio Zones:');
  const goldenRatioZones = fibonacciService.identifyGoldenRatioZones(allLevels);
  
  goldenRatioZones.forEach((zone, index) => {
    console.log(`  Golden Zone ${index + 1}: $${zone.priceLevel.toLocaleString()}`);
    console.log(`    Enhanced Strength: ${zone.strength.toFixed(2)}`);
    console.log(`    Type: ${zone.type}`);
    console.log();
  });
  
  // 6. Complete Fibonacci Analysis
  console.log('📋 Complete Fibonacci Analysis Summary:');
  const completeAnalysis = fibonacciService.generateFibonacciAnalysis(
    high, 
    low, 
    startTime, 
    endTime
  );
  
  console.log(`  Retracement Levels: ${completeAnalysis.retracements.length}`);
  console.log(`  Extension Levels: ${completeAnalysis.extensions.length}`);
  console.log(`  Time Projections: ${completeAnalysis.timeProjections.length}`);
  console.log(`  Confluence Zones: ${completeAnalysis.confluenceZones.length}`);
  console.log(`  Price Range: $${completeAnalysis.lowPrice.toLocaleString()} - $${completeAnalysis.highPrice.toLocaleString()}`);
  
  // 7. Trading Insights
  console.log('\n💡 Trading Insights:');
  
  // Find the strongest confluence zone
  const strongestZone = confluenceZones[0];
  if (strongestZone) {
    console.log(`  🎯 Strongest Support/Resistance: $${strongestZone.priceLevel.toLocaleString()}`);
    console.log(`     Reliability: ${(strongestZone.reliability * 100).toFixed(1)}%`);
  }
  
  // Find golden ratio retracement
  const goldenRetracement = retracements.find(r => Math.abs(r.ratio - 0.618) < 0.001);
  if (goldenRetracement) {
    console.log(`  📉 Golden Ratio Retracement: $${goldenRetracement.price.toLocaleString()}`);
    console.log(`     This is a key level for potential trend continuation`);
  }
  
  // Find key extension target
  const primaryExtension = extensions.find(e => Math.abs(e.ratio - 1.618) < 0.001);
  if (primaryExtension) {
    console.log(`  📈 Primary Extension Target: $${primaryExtension.price.toLocaleString()}`);
    console.log(`     This represents the next major resistance level`);
  }
  
  console.log('\n✅ Fibonacci Analysis Complete!');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateFibonacciAnalysis().catch(console.error);
}

export { demonstrateFibonacciAnalysis };