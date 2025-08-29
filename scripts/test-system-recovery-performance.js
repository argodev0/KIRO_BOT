#!/usr/bin/env node

/**
 * Test System Recovery and Performance Services
 * 
 * Isolated testing of AutoRecoveryService and PerformanceMonitoringService
 * Requirements: 7.5, 7.6, 7.7
 */

const fs = require('fs');
const path = require('path');

class SystemRecoveryPerformanceTest {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      critical: 0,
      tests: []
    };
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const levelEmoji = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };
    
    console.log(`${levelEmoji[level] || '📋'} [${timestamp}] ${message}`);
    if (details) {
      console.log(`   ${JSON.stringify(details, null, 2)}`);
    }
    
    this.results.tests.push({
      timestamp,
      level,
      message,
      details
    });
    
    if (level === 'critical') this.results.critical++;
    else if (level === 'error') this.results.failed++;
    else if (level === 'success') this.results.passed++;
  }

  async testAutoRecoveryServiceStructure() {
    this.log('info', 'Testing AutoRecoveryService structure and methods...');
    
    try {
      const servicePath = 'src/services/AutoRecoveryService.ts';
      if (!fs.existsSync(servicePath)) {
        this.log('critical', 'AutoRecoveryService not found', { file: servicePath });
        return false;
      }
      
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      
      // Check for essential recovery methods
      const requiredMethods = [
        'handleFailure',
        'addRecoveryAction',
        'executeRecoveryAction',
        'recoverDatabaseConnection',
        'recoverExchangeConnection',
        'recoverWebSocketConnection',
        'recoverMemoryUsage',
        'getFailureHistory',
        'getRecoveryActions'
      ];
      
      let methodsFound = 0;
      for (const method of requiredMethods) {
        if (serviceContent.includes(method)) {
          methodsFound++;
          this.log('success', `AutoRecoveryService method found: ${method}`);
        } else {
          this.log('error', `AutoRecoveryService method missing: ${method}`);
        }
      }
      
      // Check for recovery action types
      const recoveryActionTypes = [
        'database_reconnect',
        'exchange_reconnect',
        'websocket_reconnect',
        'memory_cleanup',
        'service_restart',
        'trading_halt_recovery',
        'rate_limit_recovery'
      ];
      
      let actionsFound = 0;
      for (const action of recoveryActionTypes) {
        if (serviceContent.includes(action)) {
          actionsFound++;
          this.log('success', `Recovery action type found: ${action}`);
        } else {
          this.log('error', `Recovery action type missing: ${action}`);
        }
      }
      
      // Check for EventEmitter usage for recovery events
      if (serviceContent.includes('EventEmitter') && serviceContent.includes('emit')) {
        this.log('success', 'AutoRecoveryService uses EventEmitter for recovery events');
      } else {
        this.log('error', 'AutoRecoveryService missing EventEmitter functionality');
      }
      
      // Check for monitoring integration
      if (serviceContent.includes('MonitoringService')) {
        this.log('success', 'AutoRecoveryService integrates with MonitoringService');
      } else {
        this.log('error', 'AutoRecoveryService missing MonitoringService integration');
      }
      
      const score = ((methodsFound + actionsFound) / (requiredMethods.length + recoveryActionTypes.length)) * 100;
      this.log('info', `AutoRecoveryService completeness: ${score.toFixed(1)}%`);
      
      return score >= 80; // 80% completeness required
      
    } catch (error) {
      this.log('critical', 'AutoRecoveryService structure test failed', error.message);
      return false;
    }
  }

  async testPerformanceMonitoringServiceStructure() {
    this.log('info', 'Testing PerformanceMonitoringService structure and methods...');
    
    try {
      const servicePath = 'src/services/PerformanceMonitoringService.ts';
      if (!fs.existsSync(servicePath)) {
        this.log('critical', 'PerformanceMonitoringService not found', { file: servicePath });
        return false;
      }
      
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      
      // Check for essential performance monitoring methods
      const requiredMethods = [
        'recordLatency',
        'recordThroughput',
        'recordError',
        'getPerformanceMetrics',
        'calculateLatencyMetrics',
        'calculateThroughputMetrics',
        'calculateErrorRateMetrics',
        'getResourceMetrics',
        'checkPerformanceThresholds',
        'updateThresholds'
      ];
      
      let methodsFound = 0;
      for (const method of requiredMethods) {
        if (serviceContent.includes(method)) {
          methodsFound++;
          this.log('success', `PerformanceMonitoringService method found: ${method}`);
        } else {
          this.log('error', `PerformanceMonitoringService method missing: ${method}`);
        }
      }
      
      // Check for performance metrics interfaces
      const requiredInterfaces = [
        'PerformanceThresholds',
        'PerformanceMetrics',
        'latency',
        'throughput',
        'errorRate',
        'resources'
      ];
      
      let interfacesFound = 0;
      for (const iface of requiredInterfaces) {
        if (serviceContent.includes(iface)) {
          interfacesFound++;
          this.log('success', `Performance interface/type found: ${iface}`);
        } else {
          this.log('error', `Performance interface/type missing: ${iface}`);
        }
      }
      
      // Check for threshold monitoring
      if (serviceContent.includes('maxLatency') && serviceContent.includes('maxErrorRate')) {
        this.log('success', 'PerformanceMonitoringService has configurable thresholds');
      } else {
        this.log('error', 'PerformanceMonitoringService missing configurable thresholds');
      }
      
      // Check for EventEmitter usage for performance alerts
      if (serviceContent.includes('EventEmitter') && serviceContent.includes('performance_alert')) {
        this.log('success', 'PerformanceMonitoringService emits performance alerts');
      } else {
        this.log('error', 'PerformanceMonitoringService missing performance alert events');
      }
      
      const score = ((methodsFound + interfacesFound) / (requiredMethods.length + requiredInterfaces.length)) * 100;
      this.log('info', `PerformanceMonitoringService completeness: ${score.toFixed(1)}%`);
      
      return score >= 80; // 80% completeness required
      
    } catch (error) {
      this.log('critical', 'PerformanceMonitoringService structure test failed', error.message);
      return false;
    }
  }

  async testPaperTradingSafetyMechanisms() {
    this.log('info', 'Testing paper trading safety mechanisms...');
    
    try {
      let safetyScore = 0;
      let totalChecks = 0;
      
      // Check PaperTradingSafetyMonitor
      const safetyMonitorPath = 'src/services/PaperTradingSafetyMonitor.ts';
      if (fs.existsSync(safetyMonitorPath)) {
        const monitorContent = fs.readFileSync(safetyMonitorPath, 'utf8');
        
        const safetyFeatures = [
          'isPaperTrade',
          'blockRealTrades',
          'validateTradingMode',
          'PAPER_TRADING_MODE',
          'simulateOrder',
          'virtualBalance'
        ];
        
        for (const feature of safetyFeatures) {
          totalChecks++;
          if (monitorContent.includes(feature)) {
            safetyScore++;
            this.log('success', `Paper trading safety feature found: ${feature}`);
          } else {
            this.log('error', `Paper trading safety feature missing: ${feature}`);
          }
        }
      } else {
        this.log('error', 'PaperTradingSafetyMonitor not found');
        totalChecks += 6; // Expected features
      }
      
      // Check TradeSimulationEngine
      const simulationPath = 'src/services/TradeSimulationEngine.ts';
      if (fs.existsSync(simulationPath)) {
        const simulationContent = fs.readFileSync(simulationPath, 'utf8');
        
        const simulationFeatures = [
          'simulateOrderExecution',
          'isPaperTrade: true',
          'virtualPortfolio',
          'simulatedTrade'
        ];
        
        for (const feature of simulationFeatures) {
          totalChecks++;
          if (simulationContent.includes(feature)) {
            safetyScore++;
            this.log('success', `Trade simulation feature found: ${feature}`);
          } else {
            this.log('error', `Trade simulation feature missing: ${feature}`);
          }
        }
      } else {
        this.log('error', 'TradeSimulationEngine not found');
        totalChecks += 4; // Expected features
      }
      
      // Check environment configuration
      const envPath = '.env.production';
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        const envChecks = [
          { key: 'PAPER_TRADING_MODE', value: 'true' },
          { key: 'ALLOW_REAL_TRADES', value: 'false' },
          { key: 'TRADING_SIMULATION_ONLY', value: 'true' }
        ];
        
        for (const check of envChecks) {
          totalChecks++;
          const pattern = new RegExp(`${check.key}\\s*=\\s*${check.value}`, 'i');
          if (pattern.test(envContent)) {
            safetyScore++;
            this.log('success', `Environment safety setting found: ${check.key}=${check.value}`);
          } else {
            this.log('error', `Environment safety setting missing: ${check.key}=${check.value}`);
          }
        }
      } else {
        this.log('error', 'Production environment file not found');
        totalChecks += 3; // Expected env vars
      }
      
      const safetyPercentage = totalChecks > 0 ? (safetyScore / totalChecks) * 100 : 0;
      this.log('info', `Paper trading safety score: ${safetyPercentage.toFixed(1)}%`);
      
      if (safetyPercentage < 70) {
        this.log('critical', 'Paper trading safety score below acceptable threshold (70%)');
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.log('critical', 'Paper trading safety test failed', error.message);
      return false;
    }
  }

  async testSystemPerformanceMonitor() {
    this.log('info', 'Testing SystemPerformanceMonitor service...');
    
    try {
      const monitorPath = 'src/services/SystemPerformanceMonitor.ts';
      if (!fs.existsSync(monitorPath)) {
        this.log('error', 'SystemPerformanceMonitor not found', { file: monitorPath });
        return false;
      }
      
      const monitorContent = fs.readFileSync(monitorPath, 'utf8');
      
      // Check for system monitoring capabilities
      const monitoringFeatures = [
        'memoryUsage',
        'cpuUsage',
        'diskUsage',
        'networkLatency',
        'responseTime',
        'throughput',
        'errorRate',
        'activeConnections'
      ];
      
      let featuresFound = 0;
      for (const feature of monitoringFeatures) {
        if (monitorContent.includes(feature)) {
          featuresFound++;
          this.log('success', `System monitoring feature found: ${feature}`);
        } else {
          this.log('error', `System monitoring feature missing: ${feature}`);
        }
      }
      
      // Check for alerting capabilities
      if (monitorContent.includes('alert') || monitorContent.includes('threshold')) {
        this.log('success', 'SystemPerformanceMonitor has alerting capabilities');
        featuresFound++;
      } else {
        this.log('error', 'SystemPerformanceMonitor missing alerting capabilities');
      }
      
      const completeness = (featuresFound / (monitoringFeatures.length + 1)) * 100;
      this.log('info', `SystemPerformanceMonitor completeness: ${completeness.toFixed(1)}%`);
      
      return completeness >= 70; // 70% completeness required
      
    } catch (error) {
      this.log('critical', 'SystemPerformanceMonitor test failed', error.message);
      return false;
    }
  }

  async testOperationalReadinessComponents() {
    this.log('info', 'Testing operational readiness components...');
    
    try {
      let readinessScore = 0;
      let totalComponents = 0;
      
      // Check for essential operational scripts
      const operationalScripts = [
        'scripts/production-validation-suite.js',
        'scripts/paper-trading-safety-verification.js',
        'scripts/performance-benchmarking.js',
        'scripts/production-readiness-validation.js',
        'scripts/production-smoke-tests.js'
      ];
      
      for (const script of operationalScripts) {
        totalComponents++;
        if (fs.existsSync(script)) {
          readinessScore++;
          this.log('success', `Operational script found: ${path.basename(script)}`);
        } else {
          this.log('error', `Operational script missing: ${path.basename(script)}`);
        }
      }
      
      // Check for monitoring configuration
      const monitoringConfigs = [
        'monitoring/prometheus.yml',
        'monitoring/production-monitoring.yml',
        'monitoring/grafana/grafana.ini'
      ];
      
      for (const config of monitoringConfigs) {
        totalComponents++;
        if (fs.existsSync(config)) {
          readinessScore++;
          this.log('success', `Monitoring config found: ${path.basename(config)}`);
        } else {
          this.log('error', `Monitoring config missing: ${path.basename(config)}`);
        }
      }
      
      // Check for Docker production configuration
      const dockerConfigs = [
        'docker/docker-compose.prod.yml',
        'docker/Dockerfile.backend',
        'docker/Dockerfile.frontend'
      ];
      
      for (const config of dockerConfigs) {
        totalComponents++;
        if (fs.existsSync(config)) {
          readinessScore++;
          this.log('success', `Docker config found: ${path.basename(config)}`);
        } else {
          this.log('error', `Docker config missing: ${path.basename(config)}`);
        }
      }
      
      const readinessPercentage = totalComponents > 0 ? (readinessScore / totalComponents) * 100 : 0;
      this.log('info', `Operational readiness score: ${readinessPercentage.toFixed(1)}%`);
      
      return readinessPercentage >= 80; // 80% readiness required
      
    } catch (error) {
      this.log('critical', 'Operational readiness test failed', error.message);
      return false;
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalPassed: this.results.passed,
        totalFailed: this.results.failed,
        totalCritical: this.results.critical,
        overallSuccess: this.results.failed === 0 && this.results.critical === 0
      },
      tests: this.results.tests,
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.critical > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'System Safety',
        message: 'Critical system recovery or safety issues detected',
        action: 'Fix all critical issues before deployment'
      });
    }
    
    if (this.results.failed > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'System Completeness',
        message: 'Some system components are missing or incomplete',
        action: 'Complete implementation of missing components'
      });
    }
    
    if (this.results.failed === 0 && this.results.critical === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'Success',
        message: 'All system recovery and performance components are properly implemented',
        action: 'System is ready for recovery and performance validation'
      });
    }
    
    return recommendations;
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 SYSTEM RECOVERY AND PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(80));
    
    const report = this.generateReport();
    
    console.log(`📅 Completed: ${report.timestamp}`);
    console.log(`✅ Total Passed: ${report.summary.totalPassed}`);
    console.log(`❌ Total Failed: ${report.summary.totalFailed}`);
    console.log(`🚨 Critical Issues: ${report.summary.totalCritical}`);
    
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => {
      const priorityEmoji = {
        'CRITICAL': '🚨',
        'HIGH': '⚠️',
        'MEDIUM': '📋',
        'INFO': '💡'
      };
      
      console.log(`  ${priorityEmoji[rec.priority]} ${rec.priority}: ${rec.message}`);
      console.log(`     Action: ${rec.action}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    if (report.summary.overallSuccess) {
      console.log('🎉 SYSTEM RECOVERY AND PERFORMANCE TESTS PASSED! 🎉');
    } else if (report.summary.totalCritical > 0) {
      console.log('🚨 CRITICAL FAILURES - SYSTEM NOT READY FOR DEPLOYMENT! 🚨');
    } else {
      console.log('⚠️  SOME ISSUES DETECTED - REVIEW BEFORE DEPLOYMENT ⚠️');
    }
    
    console.log('='.repeat(80));
    
    return report;
  }

  async run() {
    console.log('🚀 Starting System Recovery and Performance Tests...\n');
    
    try {
      // Test AutoRecoveryService
      const recoveryTest = await this.testAutoRecoveryServiceStructure();
      
      // Test PerformanceMonitoringService
      const performanceTest = await this.testPerformanceMonitoringServiceStructure();
      
      // Test paper trading safety mechanisms
      const safetyTest = await this.testPaperTradingSafetyMechanisms();
      
      // Test SystemPerformanceMonitor
      const systemMonitorTest = await this.testSystemPerformanceMonitor();
      
      // Test operational readiness components
      const readinessTest = await this.testOperationalReadinessComponents();
      
    } catch (error) {
      this.log('critical', `Test execution error: ${error.message}`);
    }
    
    // Generate and save report
    const report = this.printSummary();
    
    const reportPath = 'system-recovery-performance-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    if (report.summary.totalCritical > 0) {
      process.exit(2); // Critical failures
    } else if (report.summary.totalFailed > 0) {
      process.exit(1); // Non-critical failures
    } else {
      process.exit(0); // Success
    }
  }
}

// CLI usage
if (require.main === module) {
  // Show help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
System Recovery and Performance Test

Usage: node test-system-recovery-performance.js [options]

Options:
  --help, -h               Show this help message

This script tests the structure and completeness of:
- AutoRecoveryService
- PerformanceMonitoringService  
- Paper trading safety mechanisms
- SystemPerformanceMonitor
- Operational readiness components
    `);
    process.exit(0);
  }
  
  const tester = new SystemRecoveryPerformanceTest();
  tester.run().catch(error => {
    console.error('System recovery and performance test failed:', error);
    process.exit(1);
  });
}

module.exports = SystemRecoveryPerformanceTest;