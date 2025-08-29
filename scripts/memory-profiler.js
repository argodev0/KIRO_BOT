#!/usr/bin/env node

/**
 * Memory Profiler for Resource Optimization Testing
 * 
 * Part of Task 25: Memory and resource usage optimization testing
 * - Monitor memory usage patterns during load testing
 * - Detect memory leaks and optimization opportunities
 * - Generate memory usage reports and recommendations
 */

const fs = require('fs');
const { performance } = require('perf_hooks');

class MemoryProfiler {
  constructor(options = {}) {
    this.options = {
      interval: options.interval || 1000, // 1 second
      duration: options.duration || 300000, // 5 minutes
      outputFile: options.outputFile || 'memory-profile-report.json',
      thresholds: {
        heapUsed: options.heapUsedThreshold || 500 * 1024 * 1024, // 500MB
        rss: options.rssThreshold || 1024 * 1024 * 1024, // 1GB
        external: options.externalThreshold || 100 * 1024 * 1024, // 100MB
        growthRate: options.growthRateThreshold || 0.1 // 10% per minute
      },
      ...options
    };
    
    this.measurements = [];
    this.startTime = null;
    this.intervalId = null;
    this.gcStats = [];
    
    // Enable GC monitoring if available
    if (global.gc) {
      this.gcEnabled = true;
    } else {
      console.warn('Garbage collection monitoring not available. Run with --expose-gc for full profiling.');
      this.gcEnabled = false;
    }
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(`  Data: ${JSON.stringify(data, null, 2)}`);
    }
  }

  start() {
    this.log('🔍 Starting memory profiling...');
    this.startTime = Date.now();
    
    // Take initial measurement
    this.takeMeasurement();
    
    // Start periodic measurements
    this.intervalId = setInterval(() => {
      this.takeMeasurement();
      
      // Check if duration exceeded
      if (Date.now() - this.startTime >= this.options.duration) {
        this.stop();
      }
    }, this.options.interval);
    
    // Monitor GC events if available
    if (this.gcEnabled) {
      this.monitorGarbageCollection();
    }
    
    this.log(`Memory profiling started for ${this.options.duration / 1000}s with ${this.options.interval}ms intervals`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.log('🛑 Memory profiling stopped');
    
    // Generate and save report
    const report = this.generateReport();
    this.saveReport(report);
    
    return report;
  }

  takeMeasurement() {
    const memoryUsage = process.memoryUsage();
    const timestamp = Date.now();
    const elapsedTime = timestamp - this.startTime;
    
    const measurement = {
      timestamp,
      elapsedTime,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      arrayBuffers: memoryUsage.arrayBuffers || 0
    };
    
    // Add derived metrics
    if (this.measurements.length > 0) {
      const previous = this.measurements[this.measurements.length - 1];
      measurement.heapGrowth = memoryUsage.heapUsed - previous.heapUsed;
      measurement.rssGrowth = memoryUsage.rss - previous.rss;
      measurement.heapGrowthRate = measurement.heapGrowth / (this.options.interval / 1000); // bytes per second
    } else {
      measurement.heapGrowth = 0;
      measurement.rssGrowth = 0;
      measurement.heapGrowthRate = 0;
    }
    
    this.measurements.push(measurement);
    
    // Check thresholds
    this.checkThresholds(measurement);
  }

  checkThresholds(measurement) {
    const warnings = [];
    
    if (measurement.heapUsed > this.options.thresholds.heapUsed) {
      warnings.push(`High heap usage: ${(measurement.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
    
    if (measurement.rss > this.options.thresholds.rss) {
      warnings.push(`High RSS usage: ${(measurement.rss / 1024 / 1024).toFixed(2)}MB`);
    }
    
    if (measurement.external > this.options.thresholds.external) {
      warnings.push(`High external memory: ${(measurement.external / 1024 / 1024).toFixed(2)}MB`);
    }
    
    if (measurement.heapGrowthRate > this.options.thresholds.growthRate * 1024 * 1024) {
      warnings.push(`High heap growth rate: ${(measurement.heapGrowthRate / 1024 / 1024).toFixed(2)}MB/s`);
    }
    
    if (warnings.length > 0) {
      this.log('⚠️  Memory threshold warnings:', warnings);
    }
  }

  monitorGarbageCollection() {
    // Store original GC function
    const originalGC = global.gc;
    
    // Wrap GC function to monitor calls
    global.gc = (...args) => {
      const beforeGC = process.memoryUsage();
      const gcStartTime = performance.now();
      
      const result = originalGC.apply(global, args);
      
      const gcEndTime = performance.now();
      const afterGC = process.memoryUsage();
      
      const gcStats = {
        timestamp: Date.now(),
        duration: gcEndTime - gcStartTime,
        beforeGC,
        afterGC,
        heapFreed: beforeGC.heapUsed - afterGC.heapUsed,
        rssFreed: beforeGC.rss - afterGC.rss
      };
      
      this.gcStats.push(gcStats);
      
      this.log(`🗑️  GC completed in ${gcStats.duration.toFixed(2)}ms, freed ${(gcStats.heapFreed / 1024 / 1024).toFixed(2)}MB heap`);
      
      return result;
    };
  }

  generateReport() {
    const duration = (Date.now() - this.startTime) / 1000;
    const totalMeasurements = this.measurements.length;
    
    if (totalMeasurements === 0) {
      return { error: 'No measurements taken' };
    }
    
    const firstMeasurement = this.measurements[0];
    const lastMeasurement = this.measurements[totalMeasurements - 1];
    
    // Calculate statistics
    const heapStats = this.calculateStats(this.measurements.map(m => m.heapUsed));
    const rssStats = this.calculateStats(this.measurements.map(m => m.rss));
    const externalStats = this.calculateStats(this.measurements.map(m => m.external));
    
    // Calculate growth trends
    const heapGrowth = lastMeasurement.heapUsed - firstMeasurement.heapUsed;
    const rssGrowth = lastMeasurement.rss - firstMeasurement.rss;
    const heapGrowthRate = heapGrowth / duration; // bytes per second
    const rssGrowthRate = rssGrowth / duration;
    
    // Detect memory leaks
    const memoryLeakDetection = this.detectMemoryLeaks();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(heapStats, rssStats, heapGrowthRate, memoryLeakDetection);
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration.toFixed(2)}s`,
      totalMeasurements,
      interval: `${this.options.interval}ms`,
      
      summary: {
        initialHeapUsed: this.formatBytes(firstMeasurement.heapUsed),
        finalHeapUsed: this.formatBytes(lastMeasurement.heapUsed),
        heapGrowth: this.formatBytes(heapGrowth),
        heapGrowthRate: `${this.formatBytes(heapGrowthRate)}/s`,
        
        initialRSS: this.formatBytes(firstMeasurement.rss),
        finalRSS: this.formatBytes(lastMeasurement.rss),
        rssGrowth: this.formatBytes(rssGrowth),
        rssGrowthRate: `${this.formatBytes(rssGrowthRate)}/s`
      },
      
      statistics: {
        heapUsed: {
          min: this.formatBytes(heapStats.min),
          max: this.formatBytes(heapStats.max),
          avg: this.formatBytes(heapStats.avg),
          median: this.formatBytes(heapStats.median),
          stdDev: this.formatBytes(heapStats.stdDev)
        },
        rss: {
          min: this.formatBytes(rssStats.min),
          max: this.formatBytes(rssStats.max),
          avg: this.formatBytes(rssStats.avg),
          median: this.formatBytes(rssStats.median),
          stdDev: this.formatBytes(rssStats.stdDev)
        },
        external: {
          min: this.formatBytes(externalStats.min),
          max: this.formatBytes(externalStats.max),
          avg: this.formatBytes(externalStats.avg),
          median: this.formatBytes(externalStats.median),
          stdDev: this.formatBytes(externalStats.stdDev)
        }
      },
      
      memoryLeakDetection,
      
      garbageCollection: this.gcEnabled ? {
        totalGCEvents: this.gcStats.length,
        avgGCDuration: this.gcStats.length > 0 ? 
          (this.gcStats.reduce((sum, gc) => sum + gc.duration, 0) / this.gcStats.length).toFixed(2) + 'ms' : 'N/A',
        totalHeapFreed: this.gcStats.length > 0 ? 
          this.formatBytes(this.gcStats.reduce((sum, gc) => sum + gc.heapFreed, 0)) : 'N/A',
        gcEvents: this.gcStats.slice(-10) // Last 10 GC events
      } : { message: 'GC monitoring not available' },
      
      thresholdViolations: this.getThresholdViolations(),
      
      recommendations,
      
      rawData: {
        measurements: this.measurements.slice(-100), // Last 100 measurements
        gcStats: this.gcStats
      }
    };
    
    return report;
  }

  calculateStats(values) {
    if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0, stdDev: 0 };
    
    const sorted = values.slice().sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    
    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev
    };
  }

  detectMemoryLeaks() {
    if (this.measurements.length < 10) {
      return { detected: false, reason: 'Insufficient data' };
    }
    
    // Check for consistent growth over time
    const recentMeasurements = this.measurements.slice(-20); // Last 20 measurements
    const growthRates = [];
    
    for (let i = 1; i < recentMeasurements.length; i++) {
      const current = recentMeasurements[i];
      const previous = recentMeasurements[i - 1];
      const timeDiff = (current.timestamp - previous.timestamp) / 1000; // seconds
      const heapGrowthRate = (current.heapUsed - previous.heapUsed) / timeDiff;
      growthRates.push(heapGrowthRate);
    }
    
    // Calculate average growth rate
    const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    
    // Check if growth rate is consistently positive and significant
    const positiveGrowthCount = growthRates.filter(rate => rate > 0).length;
    const positiveGrowthRatio = positiveGrowthCount / growthRates.length;
    
    const leakThreshold = 1024 * 1024; // 1MB per second
    const consistencyThreshold = 0.7; // 70% of measurements show growth
    
    const detected = avgGrowthRate > leakThreshold && positiveGrowthRatio > consistencyThreshold;
    
    return {
      detected,
      avgGrowthRate: this.formatBytes(avgGrowthRate) + '/s',
      positiveGrowthRatio: (positiveGrowthRatio * 100).toFixed(1) + '%',
      confidence: detected ? 'High' : 'Low',
      details: detected ? 
        'Consistent memory growth detected. Possible memory leak.' : 
        'No significant memory leak patterns detected.'
    };
  }

  generateRecommendations(heapStats, rssStats, heapGrowthRate, memoryLeakDetection) {
    const recommendations = [];
    
    // High memory usage recommendations
    if (heapStats.max > this.options.thresholds.heapUsed) {
      recommendations.push({
        category: 'Memory Usage',
        priority: 'High',
        issue: `Peak heap usage (${this.formatBytes(heapStats.max)}) exceeds threshold`,
        suggestions: [
          'Review large object allocations',
          'Implement object pooling for frequently created objects',
          'Consider streaming for large data processing',
          'Optimize data structures and algorithms'
        ]
      });
    }
    
    // Memory growth recommendations
    if (heapGrowthRate > this.options.thresholds.growthRate * 1024 * 1024) {
      recommendations.push({
        category: 'Memory Growth',
        priority: 'High',
        issue: `High memory growth rate (${this.formatBytes(heapGrowthRate)}/s)`,
        suggestions: [
          'Check for memory leaks in event listeners',
          'Review closure usage and scope retention',
          'Implement proper cleanup in async operations',
          'Use weak references where appropriate'
        ]
      });
    }
    
    // Memory leak recommendations
    if (memoryLeakDetection.detected) {
      recommendations.push({
        category: 'Memory Leak',
        priority: 'Critical',
        issue: 'Potential memory leak detected',
        suggestions: [
          'Profile application with heap snapshots',
          'Review event listener cleanup',
          'Check for circular references',
          'Implement proper resource disposal',
          'Use memory profiling tools for detailed analysis'
        ]
      });
    }
    
    // GC recommendations
    if (this.gcEnabled && this.gcStats.length > 0) {
      const avgGCDuration = this.gcStats.reduce((sum, gc) => sum + gc.duration, 0) / this.gcStats.length;
      
      if (avgGCDuration > 100) { // 100ms
        recommendations.push({
          category: 'Garbage Collection',
          priority: 'Medium',
          issue: `Long GC pauses (avg: ${avgGCDuration.toFixed(2)}ms)`,
          suggestions: [
            'Reduce object allocation rate',
            'Use object pools for short-lived objects',
            'Consider incremental GC strategies',
            'Optimize data structures to reduce GC pressure'
          ]
        });
      }
    }
    
    // External memory recommendations
    if (externalStats.max > this.options.thresholds.external) {
      recommendations.push({
        category: 'External Memory',
        priority: 'Medium',
        issue: `High external memory usage (${this.formatBytes(externalStats.max)})`,
        suggestions: [
          'Review Buffer and ArrayBuffer usage',
          'Optimize native module memory usage',
          'Consider streaming for large file operations',
          'Implement proper cleanup for external resources'
        ]
      });
    }
    
    return recommendations;
  }

  getThresholdViolations() {
    const violations = [];
    
    this.measurements.forEach((measurement, index) => {
      if (measurement.heapUsed > this.options.thresholds.heapUsed) {
        violations.push({
          type: 'Heap Usage',
          timestamp: measurement.timestamp,
          value: this.formatBytes(measurement.heapUsed),
          threshold: this.formatBytes(this.options.thresholds.heapUsed)
        });
      }
      
      if (measurement.rss > this.options.thresholds.rss) {
        violations.push({
          type: 'RSS Usage',
          timestamp: measurement.timestamp,
          value: this.formatBytes(measurement.rss),
          threshold: this.formatBytes(this.options.thresholds.rss)
        });
      }
      
      if (measurement.heapGrowthRate > this.options.thresholds.growthRate * 1024 * 1024) {
        violations.push({
          type: 'Growth Rate',
          timestamp: measurement.timestamp,
          value: this.formatBytes(measurement.heapGrowthRate) + '/s',
          threshold: this.formatBytes(this.options.thresholds.growthRate * 1024 * 1024) + '/s'
        });
      }
    });
    
    return violations.slice(-20); // Last 20 violations
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  saveReport(report) {
    try {
      fs.writeFileSync(this.options.outputFile, JSON.stringify(report, null, 2));
      this.log(`📄 Memory profile report saved to: ${this.options.outputFile}`);
    } catch (error) {
      this.log(`❌ Failed to save report: ${error.message}`);
    }
  }

  // Static method to run profiling for a specific duration
  static async profile(options = {}) {
    const profiler = new MemoryProfiler(options);
    
    return new Promise((resolve) => {
      profiler.start();
      
      setTimeout(() => {
        const report = profiler.stop();
        resolve(report);
      }, options.duration || 300000);
    });
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options = {
    duration: parseInt(args[0]) || 300000, // 5 minutes default
    interval: parseInt(args[1]) || 1000,   // 1 second default
    outputFile: args[2] || 'memory-profile-report.json'
  };
  
  console.log('🔍 Memory Profiler - Resource Optimization Testing');
  console.log('================================================');
  console.log(`Duration: ${options.duration / 1000}s`);
  console.log(`Interval: ${options.interval}ms`);
  console.log(`Output: ${options.outputFile}\n`);
  
  const profiler = new MemoryProfiler(options);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, stopping profiler...');
    const report = profiler.stop();
    
    console.log('\n📊 Memory Profiling Summary:');
    console.log(`Duration: ${report.duration}`);
    console.log(`Measurements: ${report.totalMeasurements}`);
    console.log(`Heap Growth: ${report.summary.heapGrowth}`);
    console.log(`RSS Growth: ${report.summary.rssGrowth}`);
    console.log(`Memory Leak Detected: ${report.memoryLeakDetection.detected ? 'Yes' : 'No'}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`• ${rec.category}: ${rec.issue}`);
      });
    }
    
    process.exit(0);
  });
  
  profiler.start();
}

module.exports = MemoryProfiler;