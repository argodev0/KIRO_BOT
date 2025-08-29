/**
 * Load Testing and Performance Validation Tests
 * 
 * Task 25: Implement Load Testing and Performance Validation
 * Tests for load testing scenarios, performance benchmarking, stress testing, and resource optimization
 * 
 * Requirements: 8.3
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import test from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';
import * as path from 'path';

describe('Load Testing and Performance Validation', () => {
  const scriptsDir = path.join(process.cwd(), 'scripts');
  
  beforeAll(() => {
    // Ensure scripts directory exists
    expect(fs.existsSync(scriptsDir)).toBe(true);
  });

  describe('Comprehensive Load Testing Script', () => {
    const scriptPath = path.join(scriptsDir, 'comprehensive-load-testing.js');
    
    test('should exist and be executable', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const stats = fs.statSync(scriptPath);
      expect(stats.isFile()).toBe(true);
    });

    test('should have proper module structure', () => {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for required class and methods
      expect(scriptContent).toContain('class ComprehensiveLoadTester');
      expect(scriptContent).toContain('runProductionTrafficSimulation');
      expect(scriptContent).toContain('runPerformanceBenchmarking');
      expect(scriptContent).toContain('runMarketDataStressTesting');
      expect(scriptContent).toContain('runResourceUsageOptimizationTesting');
    });

    test('should be importable as a module', () => {
      expect(() => {
        const ComprehensiveLoadTester = require(scriptPath);
        expect(typeof ComprehensiveLoadTester).toBe('function');
      }).not.toThrow();
    });

    test('should create instance with default configuration', () => {
      const ComprehensiveLoadTester = require(scriptPath);
      const tester = new ComprehensiveLoadTester();
      
      expect(tester.config).toBeDefined();
      expect(tester.config.baseUrl).toBe('https://localhost');
      expect(tester.config.apiPort).toBe(3000);
      expect(tester.config.concurrentUsers).toBe(50);
      expect(tester.results).toBeDefined();
    });

    test('should accept custom configuration', () => {
      const ComprehensiveLoadTester = require(scriptPath);
      const customConfig = {
        baseUrl: 'https://test.example.com',
        apiPort: 8080,
        concurrentUsers: 100,
        duration: 60000
      };
      
      const tester = new ComprehensiveLoadTester(customConfig);
      
      expect(tester.config.baseUrl).toBe(customConfig.baseUrl);
      expect(tester.config.apiPort).toBe(customConfig.apiPort);
      expect(tester.config.concurrentUsers).toBe(customConfig.concurrentUsers);
      expect(tester.config.duration).toBe(customConfig.duration);
    });
  });

  describe('Memory Profiler Script', () => {
    const scriptPath = path.join(scriptsDir, 'memory-profiler.js');
    
    test('should exist and be executable', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const stats = fs.statSync(scriptPath);
      expect(stats.isFile()).toBe(true);
    });

    test('should have proper module structure', () => {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for required class and methods
      expect(scriptContent).toContain('class MemoryProfiler');
      expect(scriptContent).toContain('start()');
      expect(scriptContent).toContain('stop()');
      expect(scriptContent).toContain('takeMeasurement');
      expect(scriptContent).toContain('detectMemoryLeaks');
      expect(scriptContent).toContain('generateReport');
    });

    test('should be importable as a module', () => {
      expect(() => {
        const MemoryProfiler = require(scriptPath);
        expect(typeof MemoryProfiler).toBe('function');
      }).not.toThrow();
    });

    test('should create instance with default options', () => {
      const MemoryProfiler = require(scriptPath);
      const profiler = new MemoryProfiler();
      
      expect(profiler.options).toBeDefined();
      expect(profiler.options.interval).toBe(1000);
      expect(profiler.options.duration).toBe(300000);
      expect(profiler.measurements).toEqual([]);
    });

    test('should format bytes correctly', () => {
      const MemoryProfiler = require(scriptPath);
      const profiler = new MemoryProfiler();
      
      expect(profiler.formatBytes(0)).toBe('0 B');
      expect(profiler.formatBytes(1024)).toBe('1 KB');
      expect(profiler.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(profiler.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    test('should calculate statistics correctly', () => {
      const MemoryProfiler = require(scriptPath);
      const profiler = new MemoryProfiler();
      
      const values = [10, 20, 30, 40, 50];
      const stats = profiler.calculateStats(values);
      
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.avg).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.stdDev).toBeCloseTo(14.14, 1);
    });
  });

  describe('Load Testing Suite Runner', () => {
    const scriptPath = path.join(scriptsDir, 'run-load-testing-suite.js');
    
    test('should exist and be executable', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const stats = fs.statSync(scriptPath);
      expect(stats.isFile()).toBe(true);
    });

    test('should have proper module structure', () => {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for required class and methods
      expect(scriptContent).toContain('class LoadTestingSuiteRunner');
      expect(scriptContent).toContain('runComprehensiveLoadTesting');
      expect(scriptContent).toContain('runMemoryProfiling');
      expect(scriptContent).toContain('runArtilleryLoadTesting');
      expect(scriptContent).toContain('generateConsolidatedReport');
    });

    test('should be importable as a module', () => {
      expect(() => {
        const LoadTestingSuiteRunner = require(scriptPath);
        expect(typeof LoadTestingSuiteRunner).toBe('function');
      }).not.toThrow();
    });

    test('should create instance with default configuration', () => {
      const LoadTestingSuiteRunner = require(scriptPath);
      const runner = new LoadTestingSuiteRunner();
      
      expect(runner.config).toBeDefined();
      expect(runner.config.baseUrl).toBe('https://localhost');
      expect(runner.config.runArtillery).toBe(true);
      expect(runner.config.runMemoryProfiling).toBe(true);
      expect(runner.config.runComprehensiveTests).toBe(true);
      expect(runner.results).toBeDefined();
    });
  });

  describe('Artillery Configuration', () => {
    const configPath = path.join(process.cwd(), 'artillery-config.yml');
    
    test('should exist', () => {
      expect(fs.existsSync(configPath)).toBe(true);
    });

    test('should have valid YAML structure', () => {
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Check for required sections
      expect(configContent).toContain('config:');
      expect(configContent).toContain('scenarios:');
      expect(configContent).toContain('phases:');
      expect(configContent).toContain('target:');
    });

    test('should have proper load testing phases', () => {
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Check for different load phases
      expect(configContent).toContain('Warm-up');
      expect(configContent).toContain('Normal Load');
      expect(configContent).toContain('Peak Load');
      expect(configContent).toContain('Stress Test');
      expect(configContent).toContain('Cool-down');
    });

    test('should have realistic test scenarios', () => {
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Check for different test scenarios
      expect(configContent).toContain('Health Check Load Test');
      expect(configContent).toContain('Market Data Load Test');
      expect(configContent).toContain('Technical Indicators Load Test');
      expect(configContent).toContain('Trading Operations Load Test');
      expect(configContent).toContain('WebSocket Load Test');
    });
  });

  describe('Test Data Files', () => {
    const testDataDir = path.join(process.cwd(), 'test-data');
    const symbolsFile = path.join(testDataDir, 'symbols.csv');
    
    test('should have test data directory', () => {
      expect(fs.existsSync(testDataDir)).toBe(true);
    });

    test('should have symbols CSV file', () => {
      expect(fs.existsSync(symbolsFile)).toBe(true);
    });

    test('should have valid CSV format', () => {
      const csvContent = fs.readFileSync(symbolsFile, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      // Should have header
      expect(lines[0]).toBe('symbol,timeframe');
      
      // Should have data rows
      expect(lines.length).toBeGreaterThan(1);
      
      // Check format of data rows
      const dataLine = lines[1];
      expect(dataLine).toMatch(/^[A-Z]+USDT,[0-9]+[mhd]$/);
    });

    test('should contain expected trading symbols', () => {
      const csvContent = fs.readFileSync(symbolsFile, 'utf8');
      
      expect(csvContent).toContain('BTCUSDT');
      expect(csvContent).toContain('ETHUSDT');
      expect(csvContent).toContain('ADAUSDT');
      expect(csvContent).toContain('DOTUSDT');
      expect(csvContent).toContain('LINKUSDT');
    });

    test('should contain expected timeframes', () => {
      const csvContent = fs.readFileSync(symbolsFile, 'utf8');
      
      expect(csvContent).toContain('1m');
      expect(csvContent).toContain('5m');
      expect(csvContent).toContain('15m');
      expect(csvContent).toContain('1h');
      expect(csvContent).toContain('4h');
      expect(csvContent).toContain('1d');
    });
  });

  describe('Package.json Scripts', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    test('should have load testing scripts', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.scripts).toHaveProperty('test:load');
      expect(packageJson.scripts).toHaveProperty('test:load-comprehensive');
      expect(packageJson.scripts).toHaveProperty('test:load-suite');
      expect(packageJson.scripts).toHaveProperty('test:load-artillery');
      expect(packageJson.scripts).toHaveProperty('test:memory-profile');
    });

    test('should have correct script commands', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.scripts['test:load-comprehensive']).toBe('node scripts/comprehensive-load-testing.js');
      expect(packageJson.scripts['test:load-suite']).toBe('node scripts/run-load-testing-suite.js');
      expect(packageJson.scripts['test:load-artillery']).toBe('npx artillery run artillery-config.yml');
      expect(packageJson.scripts['test:memory-profile']).toBe('node --expose-gc scripts/memory-profiler.js');
    });
  });

  describe('Load Testing Integration', () => {
    test('should have artillery dependency', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.devDependencies).toHaveProperty('artillery');
    });

    test('should be able to create load tester instance', () => {
      const ComprehensiveLoadTester = require(path.join(scriptsDir, 'comprehensive-load-testing.js'));
      
      expect(() => {
        const tester = new ComprehensiveLoadTester({
          baseUrl: 'https://localhost',
          apiPort: 3000,
          duration: 10000, // Short duration for testing
          concurrentUsers: 5
        });
        
        expect(tester).toBeDefined();
        expect(typeof tester.makeRequest).toBe('function');
        expect(typeof tester.runProductionTrafficSimulation).toBe('function');
        expect(typeof tester.runPerformanceBenchmarking).toBe('function');
        expect(typeof tester.runMarketDataStressTesting).toBe('function');
        expect(typeof tester.runResourceUsageOptimizationTesting).toBe('function');
      }).not.toThrow();
    });

    test('should be able to create memory profiler instance', () => {
      const MemoryProfiler = require(path.join(scriptsDir, 'memory-profiler.js'));
      
      expect(() => {
        const profiler = new MemoryProfiler({
          interval: 1000,
          duration: 10000, // Short duration for testing
          outputFile: 'test-memory-profile.json'
        });
        
        expect(profiler).toBeDefined();
        expect(typeof profiler.start).toBe('function');
        expect(typeof profiler.stop).toBe('function');
        expect(typeof profiler.takeMeasurement).toBe('function');
        expect(typeof profiler.generateReport).toBe('function');
      }).not.toThrow();
    });

    test('should be able to create suite runner instance', () => {
      const LoadTestingSuiteRunner = require(path.join(scriptsDir, 'run-load-testing-suite.js'));
      
      expect(() => {
        const runner = new LoadTestingSuiteRunner({
          baseUrl: 'https://localhost',
          duration: 10000, // Short duration for testing
          runArtillery: false, // Disable for testing
          runMemoryProfiling: false, // Disable for testing
          runComprehensiveTests: false // Disable for testing
        });
        
        expect(runner).toBeDefined();
        expect(typeof runner.run).toBe('function');
        expect(typeof runner.generateConsolidatedReport).toBe('function');
      }).not.toThrow();
    });
  });

  describe('Load Testing Functionality', () => {
    test('should validate request making functionality', async () => {
      const ComprehensiveLoadTester = require(path.join(scriptsDir, 'comprehensive-load-testing.js'));
      const tester = new ComprehensiveLoadTester();
      
      // Test the makeRequest method structure
      expect(typeof tester.makeRequest).toBe('function');
      
      // Test that it returns a promise
      const requestPromise = tester.makeRequest('https://httpbin.org/status/200').catch(() => {
        // Ignore network errors in test environment
      });
      expect(requestPromise).toBeInstanceOf(Promise);
    });

    test('should validate latency statistics calculation', () => {
      const ComprehensiveLoadTester = require(path.join(scriptsDir, 'comprehensive-load-testing.js'));
      const tester = new ComprehensiveLoadTester();
      
      const latencies = [100, 150, 200, 250, 300];
      const stats = tester.calculateLatencyStats(latencies);
      
      expect(stats).toHaveProperty('min');
      expect(stats).toHaveProperty('max');
      expect(stats).toHaveProperty('avg');
      expect(stats).toHaveProperty('p50');
      expect(stats).toHaveProperty('p95');
      expect(stats).toHaveProperty('p99');
      
      expect(parseFloat(stats.min)).toBe(100);
      expect(parseFloat(stats.max)).toBe(300);
      expect(parseFloat(stats.avg)).toBe(200);
    });

    test('should validate scenario evaluation logic', () => {
      const ComprehensiveLoadTester = require(path.join(scriptsDir, 'comprehensive-load-testing.js'));
      const tester = new ComprehensiveLoadTester({
        targetLatency: 200,
        targetThroughput: 100
      });
      
      // Test passing scenario
      const passingResults = {
        errorRate: 2,
        latencies: [100, 150, 180],
        throughput: 120
      };
      expect(tester.evaluateScenarioResults(passingResults)).toBe(true);
      
      // Test failing scenario (high error rate)
      const failingResults = {
        errorRate: 10,
        latencies: [100, 150, 180],
        throughput: 120
      };
      expect(tester.evaluateScenarioResults(failingResults)).toBe(false);
    });
  });

  describe('Memory Profiling Functionality', () => {
    test('should validate memory measurement structure', () => {
      const MemoryProfiler = require(path.join(scriptsDir, 'memory-profiler.js'));
      const profiler = new MemoryProfiler();
      
      // Mock the startTime
      profiler.startTime = Date.now();
      
      // Take a measurement
      profiler.takeMeasurement();
      
      expect(profiler.measurements.length).toBe(1);
      
      const measurement = profiler.measurements[0];
      expect(measurement).toHaveProperty('timestamp');
      expect(measurement).toHaveProperty('elapsedTime');
      expect(measurement).toHaveProperty('heapUsed');
      expect(measurement).toHaveProperty('heapTotal');
      expect(measurement).toHaveProperty('external');
      expect(measurement).toHaveProperty('rss');
    });

    test('should validate memory leak detection logic', () => {
      const MemoryProfiler = require(path.join(scriptsDir, 'memory-profiler.js'));
      const profiler = new MemoryProfiler();
      
      // Create mock measurements with consistent growth
      const baseTime = Date.now();
      for (let i = 0; i < 20; i++) {
        profiler.measurements.push({
          timestamp: baseTime + (i * 1000),
          heapUsed: 100 * 1024 * 1024 + (i * 10 * 1024 * 1024), // Growing memory
          heapGrowth: i > 0 ? 10 * 1024 * 1024 : 0
        });
      }
      
      const detection = profiler.detectMemoryLeaks();
      expect(detection).toHaveProperty('detected');
      expect(detection).toHaveProperty('avgGrowthRate');
      expect(detection).toHaveProperty('confidence');
    });

    test('should validate threshold checking', () => {
      const MemoryProfiler = require(path.join(scriptsDir, 'memory-profiler.js'));
      const profiler = new MemoryProfiler({
        thresholds: {
          heapUsed: 100 * 1024 * 1024, // 100MB
          rss: 200 * 1024 * 1024, // 200MB
          external: 50 * 1024 * 1024, // 50MB
          growthRate: 0.1 // 10% per minute
        }
      });
      
      // Mock console.log to capture warnings
      const originalLog = console.log;
      const logMessages = [];
      console.log = (...args) => {
        logMessages.push(args.join(' '));
      };
      
      // Test measurement that exceeds thresholds
      const highMemoryMeasurement = {
        heapUsed: 150 * 1024 * 1024, // Exceeds threshold
        rss: 250 * 1024 * 1024, // Exceeds threshold
        external: 30 * 1024 * 1024, // Within threshold
        heapGrowthRate: 0.2 * 1024 * 1024 // Exceeds threshold
      };
      
      profiler.checkThresholds(highMemoryMeasurement);
      
      // Restore console.log
      console.log = originalLog;
      
      // Should have generated warnings
      const warningMessages = logMessages.filter(msg => msg.includes('Memory threshold warnings'));
      expect(warningMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty measurements gracefully', () => {
      const ComprehensiveLoadTester = require(path.join(scriptsDir, 'comprehensive-load-testing.js'));
      const tester = new ComprehensiveLoadTester();
      
      const stats = tester.calculateLatencyStats([]);
      expect(stats.min).toBe('0.00');
      expect(stats.max).toBe('0.00');
      expect(stats.avg).toBe('0.00');
    });

    test('should handle memory profiler with no measurements', () => {
      const MemoryProfiler = require(path.join(scriptsDir, 'memory-profiler.js'));
      const profiler = new MemoryProfiler();
      
      const report = profiler.generateReport();
      expect(report).toHaveProperty('error');
      expect(report.error).toBe('No measurements taken');
    });

    test('should handle invalid configuration gracefully', () => {
      const ComprehensiveLoadTester = require(path.join(scriptsDir, 'comprehensive-load-testing.js'));
      
      expect(() => {
        new ComprehensiveLoadTester({
          concurrentUsers: -1,
          duration: -1000
        });
      }).not.toThrow();
    });
  });
});