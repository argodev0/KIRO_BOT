#!/usr/bin/env node

/**
 * Load Testing Suite Runner
 * 
 * Task 25: Implement Load Testing and Performance Validation
 * Orchestrates all load testing components:
 * - Comprehensive load testing scenarios
 * - Artillery-based advanced load testing
 * - Memory profiling and resource monitoring
 * - Performance benchmarking
 * 
 * Requirements: 8.3
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const ComprehensiveLoadTester = require('./comprehensive-load-testing');
const MemoryProfiler = require('./memory-profiler');

class LoadTestingSuiteRunner {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://localhost',
      apiPort: config.apiPort || 3000,
      wsPort: config.wsPort || 3000,
      duration: config.duration || 300000, // 5 minutes
      concurrentUsers: config.concurrentUsers || 50,
      runArtillery: config.runArtillery !== false,
      runMemoryProfiling: config.runMemoryProfiling !== false,
      runComprehensiveTests: config.runComprehensiveTests !== false,
      outputDir: config.outputDir || './load-test-results',
      ...config
    };
    
    this.results = {
      comprehensive: null,
      artillery: null,
      memoryProfile: null,
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
    
    this.startTime = Date.now();
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(`  Data: ${JSON.stringify(data, null, 2)}`);
    }
  }

  async run() {
    console.log('🚀 Starting Load Testing Suite...\n');
    console.log(`Target: ${this.config.baseUrl}:${this.config.apiPort}`);
    console.log(`Duration: ${this.config.duration / 1000}s`);
    console.log(`Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`Output Directory: ${this.config.outputDir}\n`);
    
    // Create output directory
    this.ensureOutputDirectory();
    
    try {
      // Run all test suites in parallel for maximum load
      const testPromises = [];
      
      if (this.config.runComprehensiveTests) {
        testPromises.push(this.runComprehensiveLoadTesting());
      }
      
      if (this.config.runMemoryProfiling) {
        testPromises.push(this.runMemoryProfiling());
      }
      
      if (this.config.runArtillery) {
        testPromises.push(this.runArtilleryLoadTesting());
      }
      
      // Wait for all tests to complete
      await Promise.all(testPromises);
      
      // Generate consolidated report
      const consolidatedReport = this.generateConsolidatedReport();
      this.saveConsolidatedReport(consolidatedReport);
      
      // Display summary
      this.displaySummary(consolidatedReport);
      
      // Exit with appropriate code
      if (this.results.summary.failed > 0) {
        console.log('\n⚠️  Some load tests failed - Review and optimize');
        process.exit(1);
      } else {
        console.log('\n🎉 All load tests completed successfully!');
        process.exit(0);
      }
      
    } catch (error) {
      this.log(`Load testing suite error: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
      this.log(`Created output directory: ${this.config.outputDir}`);
    }
  }

  async runComprehensiveLoadTesting() {
    this.log('🔥 Running comprehensive load testing...');
    
    try {
      const tester = new ComprehensiveLoadTester(this.config);
      
      // Capture console output
      const originalLog = console.log;
      let output = '';
      console.log = (...args) => {
        output += args.join(' ') + '\n';
        originalLog(...args);
      };
      
      // Run comprehensive tests (this will call process.exit, so we need to handle it)
      const testPromise = new Promise((resolve, reject) => {
        const originalExit = process.exit;
        process.exit = (code) => {
          process.exit = originalExit; // Restore original exit
          console.log = originalLog; // Restore original log
          
          if (code === 0) {
            resolve({ success: true, output });
          } else {
            resolve({ success: false, output, exitCode: code });
          }
        };
        
        tester.run().catch(reject);
      });
      
      const result = await testPromise;
      
      // Read the generated report
      const reportPath = 'comprehensive-load-testing-report.json';
      if (fs.existsSync(reportPath)) {
        const reportData = fs.readFileSync(reportPath, 'utf8');
        this.results.comprehensive = JSON.parse(reportData);
        
        // Move report to output directory
        const newPath = path.join(this.config.outputDir, 'comprehensive-load-testing-report.json');
        fs.renameSync(reportPath, newPath);
      }
      
      // Update summary
      if (this.results.comprehensive) {
        this.results.summary.totalTests += this.results.comprehensive.summary.totalTests || 0;
        this.results.summary.passed += this.results.comprehensive.summary.passed || 0;
        this.results.summary.failed += this.results.comprehensive.summary.failed || 0;
        this.results.summary.warnings += this.results.comprehensive.summary.warnings || 0;
      }
      
      this.log('✅ Comprehensive load testing completed');
      
    } catch (error) {
      this.log(`❌ Comprehensive load testing failed: ${error.message}`);
      this.results.summary.failed++;
    }
  }

  async runMemoryProfiling() {
    this.log('🧠 Running memory profiling...');
    
    try {
      const profiler = new MemoryProfiler({
        duration: this.config.duration,
        interval: 1000,
        outputFile: path.join(this.config.outputDir, 'memory-profile-report.json')
      });
      
      profiler.start();
      
      // Wait for profiling to complete
      await new Promise(resolve => setTimeout(resolve, this.config.duration + 5000));
      
      this.results.memoryProfile = profiler.stop();
      
      this.log('✅ Memory profiling completed');
      
      // Update summary based on memory profile results
      if (this.results.memoryProfile.memoryLeakDetection?.detected) {
        this.results.summary.failed++;
      } else {
        this.results.summary.passed++;
      }
      this.results.summary.totalTests++;
      
    } catch (error) {
      this.log(`❌ Memory profiling failed: ${error.message}`);
      this.results.summary.failed++;
    }
  }

  async runArtilleryLoadTesting() {
    this.log('🎯 Running Artillery load testing...');
    
    return new Promise((resolve) => {
      const artilleryConfigPath = path.resolve('artillery-config.yml');
      const outputPath = path.join(this.config.outputDir, 'artillery-report.json');
      
      // Check if Artillery config exists
      if (!fs.existsSync(artilleryConfigPath)) {
        this.log('❌ Artillery config not found, skipping Artillery tests');
        resolve();
        return;
      }
      
      // Run Artillery
      const artilleryProcess = spawn('npx', [
        'artillery', 'run',
        '--output', outputPath,
        artilleryConfigPath
      ], {
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      let output = '';
      let errorOutput = '';
      
      artilleryProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Forward output to console
        process.stdout.write(text);
      });
      
      artilleryProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        // Forward error output to console
        process.stderr.write(text);
      });
      
      artilleryProcess.on('close', (code) => {
        if (code === 0) {
          this.log('✅ Artillery load testing completed');
          
          // Try to read Artillery report
          if (fs.existsSync(outputPath)) {
            try {
              const reportData = fs.readFileSync(outputPath, 'utf8');
              this.results.artillery = JSON.parse(reportData);
              
              // Update summary based on Artillery results
              if (this.results.artillery.aggregate) {
                const errorRate = (this.results.artillery.aggregate.errors / this.results.artillery.aggregate.requests) * 100;
                if (errorRate < 5) {
                  this.results.summary.passed++;
                } else {
                  this.results.summary.failed++;
                }
                this.results.summary.totalTests++;
              }
            } catch (error) {
              this.log(`Warning: Could not parse Artillery report: ${error.message}`);
            }
          }
        } else {
          this.log(`❌ Artillery load testing failed with exit code: ${code}`);
          this.results.summary.failed++;
          this.results.summary.totalTests++;
        }
        
        resolve();
      });
      
      artilleryProcess.on('error', (error) => {
        this.log(`❌ Artillery process error: ${error.message}`);
        this.results.summary.failed++;
        this.results.summary.totalTests++;
        resolve();
      });
    });
  }

  generateConsolidatedReport() {
    const endTime = Date.now();
    const totalDuration = (endTime - this.startTime) / 1000;
    
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: `${totalDuration.toFixed(2)}s`,
      config: this.config,
      
      summary: {
        totalTests: this.results.summary.totalTests,
        passed: this.results.summary.passed,
        failed: this.results.summary.failed,
        warnings: this.results.summary.warnings,
        successRate: this.results.summary.totalTests > 0 ? 
          ((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(2) + '%' : '0%'
      },
      
      testResults: {
        comprehensive: this.results.comprehensive ? {
          status: 'completed',
          summary: this.results.comprehensive.summary,
          keyMetrics: this.extractComprehensiveKeyMetrics()
        } : { status: 'skipped' },
        
        artillery: this.results.artillery ? {
          status: 'completed',
          summary: this.extractArtilleryKeyMetrics()
        } : { status: 'skipped' },
        
        memoryProfile: this.results.memoryProfile ? {
          status: 'completed',
          summary: this.extractMemoryProfileKeyMetrics()
        } : { status: 'skipped' }
      },
      
      overallAssessment: this.generateOverallAssessment(),
      recommendations: this.generateConsolidatedRecommendations(),
      
      detailedResults: {
        comprehensive: this.results.comprehensive,
        artillery: this.results.artillery,
        memoryProfile: this.results.memoryProfile
      }
    };
    
    return report;
  }

  extractComprehensiveKeyMetrics() {
    if (!this.results.comprehensive) return null;
    
    const metrics = {};
    
    // Extract load test metrics
    if (this.results.comprehensive.results.loadTests) {
      const loadTests = Object.values(this.results.comprehensive.results.loadTests);
      metrics.avgThroughput = loadTests.length > 0 ? 
        (loadTests.reduce((sum, test) => sum + (test.throughput || 0), 0) / loadTests.length).toFixed(2) : 0;
      metrics.avgErrorRate = loadTests.length > 0 ? 
        (loadTests.reduce((sum, test) => sum + (test.errorRate || 0), 0) / loadTests.length).toFixed(2) : 0;
    }
    
    // Extract performance benchmark metrics
    if (this.results.comprehensive.results.performanceBenchmarks?.apiEndpoints) {
      const endpoints = Object.values(this.results.comprehensive.results.performanceBenchmarks.apiEndpoints);
      metrics.avgApiLatency = endpoints.length > 0 ? 
        (endpoints.reduce((sum, ep) => sum + parseFloat(ep.latencyStats?.avg || 0), 0) / endpoints.length).toFixed(2) : 0;
    }
    
    return metrics;
  }

  extractArtilleryKeyMetrics() {
    if (!this.results.artillery?.aggregate) return null;
    
    return {
      totalRequests: this.results.artillery.aggregate.requests,
      totalErrors: this.results.artillery.aggregate.errors,
      errorRate: ((this.results.artillery.aggregate.errors / this.results.artillery.aggregate.requests) * 100).toFixed(2) + '%',
      avgResponseTime: this.results.artillery.aggregate.latency?.mean?.toFixed(2) + 'ms',
      p95ResponseTime: this.results.artillery.aggregate.latency?.p95?.toFixed(2) + 'ms',
      requestRate: this.results.artillery.aggregate.rps?.mean?.toFixed(2) + ' req/s'
    };
  }

  extractMemoryProfileKeyMetrics() {
    if (!this.results.memoryProfile) return null;
    
    return {
      heapGrowth: this.results.memoryProfile.summary?.heapGrowth,
      rssGrowth: this.results.memoryProfile.summary?.rssGrowth,
      memoryLeakDetected: this.results.memoryProfile.memoryLeakDetection?.detected || false,
      peakHeapUsage: this.results.memoryProfile.statistics?.heapUsed?.max,
      avgGCDuration: this.results.memoryProfile.garbageCollection?.avgGCDuration
    };
  }

  generateOverallAssessment() {
    const assessment = {
      performance: 'Unknown',
      reliability: 'Unknown',
      scalability: 'Unknown',
      resourceEfficiency: 'Unknown',
      overallGrade: 'Unknown'
    };
    
    let scores = [];
    
    // Performance assessment
    if (this.results.comprehensive?.results?.performanceBenchmarks) {
      const apiEndpoints = Object.values(this.results.comprehensive.results.performanceBenchmarks.apiEndpoints || {});
      const passedEndpoints = apiEndpoints.filter(ep => ep.passed).length;
      const performanceScore = apiEndpoints.length > 0 ? (passedEndpoints / apiEndpoints.length) : 0;
      
      if (performanceScore >= 0.9) assessment.performance = 'Excellent';
      else if (performanceScore >= 0.7) assessment.performance = 'Good';
      else if (performanceScore >= 0.5) assessment.performance = 'Fair';
      else assessment.performance = 'Poor';
      
      scores.push(performanceScore);
    }
    
    // Reliability assessment
    if (this.results.comprehensive?.results?.loadTests) {
      const loadTests = Object.values(this.results.comprehensive.results.loadTests);
      const avgErrorRate = loadTests.length > 0 ? 
        loadTests.reduce((sum, test) => sum + (test.errorRate || 0), 0) / loadTests.length : 100;
      
      const reliabilityScore = Math.max(0, (100 - avgErrorRate) / 100);
      
      if (reliabilityScore >= 0.95) assessment.reliability = 'Excellent';
      else if (reliabilityScore >= 0.9) assessment.reliability = 'Good';
      else if (reliabilityScore >= 0.8) assessment.reliability = 'Fair';
      else assessment.reliability = 'Poor';
      
      scores.push(reliabilityScore);
    }
    
    // Resource efficiency assessment
    if (this.results.memoryProfile) {
      const memoryLeakDetected = this.results.memoryProfile.memoryLeakDetection?.detected;
      const resourceScore = memoryLeakDetected ? 0.3 : 0.8;
      
      if (resourceScore >= 0.8) assessment.resourceEfficiency = 'Excellent';
      else if (resourceScore >= 0.6) assessment.resourceEfficiency = 'Good';
      else if (resourceScore >= 0.4) assessment.resourceEfficiency = 'Fair';
      else assessment.resourceEfficiency = 'Poor';
      
      scores.push(resourceScore);
    }
    
    // Overall grade
    if (scores.length > 0) {
      const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      if (overallScore >= 0.9) assessment.overallGrade = 'A';
      else if (overallScore >= 0.8) assessment.overallGrade = 'B';
      else if (overallScore >= 0.7) assessment.overallGrade = 'C';
      else if (overallScore >= 0.6) assessment.overallGrade = 'D';
      else assessment.overallGrade = 'F';
    }
    
    return assessment;
  }

  generateConsolidatedRecommendations() {
    const recommendations = [];
    
    // Collect recommendations from all test results
    if (this.results.comprehensive?.recommendations) {
      recommendations.push(...this.results.comprehensive.recommendations);
    }
    
    if (this.results.memoryProfile?.recommendations) {
      recommendations.push(...this.results.memoryProfile.recommendations);
    }
    
    // Add overall recommendations based on consolidated results
    if (this.results.summary.failed > this.results.summary.passed) {
      recommendations.push({
        category: 'Overall System Health',
        priority: 'Critical',
        issue: 'More tests failed than passed',
        suggestions: [
          'Conduct thorough system review',
          'Prioritize fixing critical performance issues',
          'Implement comprehensive monitoring',
          'Consider infrastructure scaling'
        ]
      });
    }
    
    // Deduplicate recommendations by category and issue
    const uniqueRecommendations = [];
    const seen = new Set();
    
    recommendations.forEach(rec => {
      const key = `${rec.category}-${rec.issue}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRecommendations.push(rec);
      }
    });
    
    return uniqueRecommendations;
  }

  saveConsolidatedReport(report) {
    const reportPath = path.join(this.config.outputDir, 'consolidated-load-testing-report.json');
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.log(`📄 Consolidated report saved to: ${reportPath}`);
    } catch (error) {
      this.log(`❌ Failed to save consolidated report: ${error.message}`);
    }
  }

  displaySummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 LOAD TESTING SUITE SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n🕒 Total Duration: ${report.totalDuration}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    
    console.log('\n📋 Test Results:');
    Object.entries(report.testResults).forEach(([testType, result]) => {
      const status = result.status === 'completed' ? '✅' : '⏭️';
      console.log(`  ${status} ${testType.charAt(0).toUpperCase() + testType.slice(1)}: ${result.status}`);
    });
    
    console.log('\n🎯 Overall Assessment:');
    console.log(`  Performance: ${report.overallAssessment.performance}`);
    console.log(`  Reliability: ${report.overallAssessment.reliability}`);
    console.log(`  Resource Efficiency: ${report.overallAssessment.resourceEfficiency}`);
    console.log(`  Overall Grade: ${report.overallAssessment.overallGrade}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.category}: ${rec.issue}`);
      });
      
      if (report.recommendations.length > 5) {
        console.log(`  ... and ${report.recommendations.length - 5} more (see detailed report)`);
      }
    }
    
    console.log(`\n📁 Detailed results available in: ${this.config.outputDir}`);
  }
}

// CLI usage
if (require.main === module) {
  const config = {};
  
  // Parse command line arguments
  process.argv.forEach((arg, index) => {
    if (arg === '--url' && process.argv[index + 1]) {
      config.baseUrl = process.argv[index + 1];
    }
    if (arg === '--duration' && process.argv[index + 1]) {
      config.duration = parseInt(process.argv[index + 1]) * 1000;
    }
    if (arg === '--users' && process.argv[index + 1]) {
      config.concurrentUsers = parseInt(process.argv[index + 1]);
    }
    if (arg === '--output-dir' && process.argv[index + 1]) {
      config.outputDir = process.argv[index + 1];
    }
    if (arg === '--no-artillery') {
      config.runArtillery = false;
    }
    if (arg === '--no-memory-profiling') {
      config.runMemoryProfiling = false;
    }
    if (arg === '--no-comprehensive') {
      config.runComprehensiveTests = false;
    }
  });
  
  const runner = new LoadTestingSuiteRunner(config);
  runner.run().catch(error => {
    console.error('Load testing suite failed:', error);
    process.exit(1);
  });
}

module.exports = LoadTestingSuiteRunner;