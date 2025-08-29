#!/usr/bin/env node

const axios = require('axios');
const { performance } = require('perf_hooks');

class ProductionAlertingTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Production Alerting System Tests...\n');
    
    try {
      // Test basic functionality
      await this.testAlertingSystemHealth();
      await this.testCriticalIssueCreation();
      await this.testCriticalIssueResolution();
      await this.testPerformanceMetrics();
      await this.testAlertThresholds();
      await this.testWebhookAlerts();
      await this.testPaperTradingSafety();
      await this.testAlertingConfiguration();
      await this.testAlertStatistics();
      await this.testSystemIntegration();
      
      // Test notification channels
      await this.testNotificationChannels();
      
      // Test error scenarios
      await this.testErrorHandling();
      
      // Performance tests
      await this.testPerformanceUnderLoad();
      
    } catch (error) {
      console.error('❌ Test suite failed with error:', error.message);
      this.recordTest('Test Suite Execution', false, error.message);
    }
    
    this.printResults();
    return this.testResults;
  }

  async testAlertingSystemHealth() {
    console.log('📊 Testing Alerting System Health...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/alerting/health`);
      
      if (response.status === 200 && response.data.success) {
        const healthData = response.data.data;
        
        // Verify health data structure
        const requiredFields = ['status', 'alertingEnabled', 'activeIssues', 'totalIssues', 'timestamp'];
        const hasAllFields = requiredFields.every(field => healthData.hasOwnProperty(field));
        
        if (hasAllFields && healthData.status === 'healthy') {
          this.recordTest('Alerting System Health Check', true, `Status: ${healthData.status}, Active Issues: ${healthData.activeIssues}`);
        } else {
          this.recordTest('Alerting System Health Check', false, 'Invalid health data structure or unhealthy status');
        }
      } else {
        this.recordTest('Alerting System Health Check', false, 'Invalid response format');
      }
    } catch (error) {
      this.recordTest('Alerting System Health Check', false, error.message);
    }
  }

  async testCriticalIssueCreation() {
    console.log('🚨 Testing Critical Issue Creation...');
    
    try {
      const testIssue = {
        type: 'system_failure',
        title: 'Test Critical Issue',
        description: 'This is a test critical issue created by the automated test suite',
        source: 'test_suite',
        severity: 'warning',
        metadata: {
          testId: Date.now(),
          automated: true
        }
      };
      
      const response = await axios.post(`${this.baseUrl}/api/alerting/issues`, testIssue);
      
      if (response.status === 201 && response.data.success) {
        const issueId = response.data.data.issueId;
        
        // Verify the issue was created
        const getResponse = await axios.get(`${this.baseUrl}/api/alerting/issues/${issueId}`);
        
        if (getResponse.status === 200 && getResponse.data.success) {
          const issue = getResponse.data.data;
          
          if (issue.title === testIssue.title && issue.type === testIssue.type) {
            this.recordTest('Critical Issue Creation', true, `Issue created with ID: ${issueId}`);
            
            // Store issue ID for resolution test
            this.testIssueId = issueId;
          } else {
            this.recordTest('Critical Issue Creation', false, 'Issue data mismatch');
          }
        } else {
          this.recordTest('Critical Issue Creation', false, 'Failed to retrieve created issue');
        }
      } else {
        this.recordTest('Critical Issue Creation', false, 'Failed to create issue');
      }
    } catch (error) {
      this.recordTest('Critical Issue Creation', false, error.message);
    }
  }

  async testCriticalIssueResolution() {
    console.log('✅ Testing Critical Issue Resolution...');
    
    if (!this.testIssueId) {
      this.recordTest('Critical Issue Resolution', false, 'No test issue ID available');
      return;
    }
    
    try {
      const response = await axios.patch(`${this.baseUrl}/api/alerting/issues/${this.testIssueId}/resolve`, {
        resolvedBy: 'test_suite'
      });
      
      if (response.status === 200 && response.data.success) {
        // Verify the issue was resolved
        const getResponse = await axios.get(`${this.baseUrl}/api/alerting/issues/${this.testIssueId}`);
        
        if (getResponse.status === 200 && getResponse.data.success) {
          const issue = getResponse.data.data;
          
          if (issue.resolved && issue.resolvedAt) {
            this.recordTest('Critical Issue Resolution', true, `Issue resolved at: ${new Date(issue.resolvedAt).toISOString()}`);
          } else {
            this.recordTest('Critical Issue Resolution', false, 'Issue not marked as resolved');
          }
        } else {
          this.recordTest('Critical Issue Resolution', false, 'Failed to retrieve resolved issue');
        }
      } else {
        this.recordTest('Critical Issue Resolution', false, 'Failed to resolve issue');
      }
    } catch (error) {
      this.recordTest('Critical Issue Resolution', false, error.message);
    }
  }

  async testPerformanceMetrics() {
    console.log('📈 Testing Performance Metrics...');
    
    try {
      // Update a performance metric
      const metricData = {
        name: 'test_metric',
        value: 75.5,
        threshold: 80
      };
      
      const updateResponse = await axios.post(`${this.baseUrl}/api/alerting/metrics`, metricData);
      
      if (updateResponse.status === 200 && updateResponse.data.success) {
        // Retrieve metrics
        const getResponse = await axios.get(`${this.baseUrl}/api/alerting/metrics`);
        
        if (getResponse.status === 200 && getResponse.data.success) {
          const metrics = getResponse.data.data.metrics;
          const testMetric = metrics.find(m => m.name === 'test_metric');
          
          if (testMetric && testMetric.value === 75.5) {
            this.recordTest('Performance Metrics', true, `Metric updated: ${testMetric.name} = ${testMetric.value}`);
          } else {
            this.recordTest('Performance Metrics', false, 'Test metric not found or incorrect value');
          }
        } else {
          this.recordTest('Performance Metrics', false, 'Failed to retrieve metrics');
        }
      } else {
        this.recordTest('Performance Metrics', false, 'Failed to update metric');
      }
    } catch (error) {
      this.recordTest('Performance Metrics', false, error.message);
    }
  }

  async testAlertThresholds() {
    console.log('⚠️ Testing Alert Thresholds...');
    
    try {
      // Get current thresholds
      const getResponse = await axios.get(`${this.baseUrl}/api/alerting/thresholds`);
      
      if (getResponse.status === 200 && getResponse.data.success) {
        const thresholds = getResponse.data.data.thresholds;
        
        if (thresholds.length > 0) {
          // Update a threshold
          const testThreshold = thresholds[0];
          const updateData = {
            description: 'Updated by test suite',
            enabled: true
          };
          
          const updateResponse = await axios.patch(`${this.baseUrl}/api/alerting/thresholds/${testThreshold.metric}`, updateData);
          
          if (updateResponse.status === 200 && updateResponse.data.success) {
            this.recordTest('Alert Thresholds', true, `Updated threshold for: ${testThreshold.metric}`);
          } else {
            this.recordTest('Alert Thresholds', false, 'Failed to update threshold');
          }
        } else {
          this.recordTest('Alert Thresholds', false, 'No thresholds found');
        }
      } else {
        this.recordTest('Alert Thresholds', false, 'Failed to retrieve thresholds');
      }
    } catch (error) {
      this.recordTest('Alert Thresholds', false, error.message);
    }
  }

  async testWebhookAlerts() {
    console.log('🔗 Testing Webhook Alerts...');
    
    try {
      // Test Grafana-style webhook
      const grafanaAlert = {
        alerts: [
          {
            labels: {
              severity: 'warning',
              team: 'trading'
            },
            annotations: {
              summary: 'Test Grafana Alert',
              description: 'This is a test alert from Grafana webhook'
            }
          }
        ]
      };
      
      const response = await axios.post(`${this.baseUrl}/api/alerting/webhook/grafana`, grafanaAlert);
      
      if (response.status === 200 && response.data.success) {
        this.recordTest('Webhook Alerts (Grafana)', true, 'Grafana webhook processed successfully');
      } else {
        this.recordTest('Webhook Alerts (Grafana)', false, 'Failed to process Grafana webhook');
      }
      
      // Test generic webhook
      const genericAlert = {
        title: 'Test Generic Alert',
        message: 'This is a test alert from generic webhook',
        severity: 'warning'
      };
      
      const genericResponse = await axios.post(`${this.baseUrl}/api/alerting/webhook/external`, genericAlert);
      
      if (genericResponse.status === 200 && genericResponse.data.success) {
        this.recordTest('Webhook Alerts (Generic)', true, 'Generic webhook processed successfully');
      } else {
        this.recordTest('Webhook Alerts (Generic)', false, 'Failed to process generic webhook');
      }
    } catch (error) {
      this.recordTest('Webhook Alerts', false, error.message);
    }
  }

  async testPaperTradingSafety() {
    console.log('🛡️ Testing Paper Trading Safety...');
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/alerting/safety-check`);
      
      if (response.status === 200 && response.data.success) {
        this.recordTest('Paper Trading Safety Check', true, 'Safety check completed successfully');
      } else {
        this.recordTest('Paper Trading Safety Check', false, 'Safety check failed');
      }
    } catch (error) {
      this.recordTest('Paper Trading Safety Check', false, error.message);
    }
  }

  async testAlertingConfiguration() {
    console.log('⚙️ Testing Alerting Configuration...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/alerting/config`);
      
      if (response.status === 200 && response.data.success) {
        const config = response.data.data;
        
        // Verify configuration structure
        const requiredFields = ['enabled', 'emailNotifications', 'webhookNotifications', 'slackNotifications'];
        const hasAllFields = requiredFields.every(field => config.hasOwnProperty(field));
        
        if (hasAllFields) {
          this.recordTest('Alerting Configuration', true, `Alerting enabled: ${config.enabled}`);
        } else {
          this.recordTest('Alerting Configuration', false, 'Invalid configuration structure');
        }
      } else {
        this.recordTest('Alerting Configuration', false, 'Failed to retrieve configuration');
      }
    } catch (error) {
      this.recordTest('Alerting Configuration', false, error.message);
    }
  }

  async testAlertStatistics() {
    console.log('📊 Testing Alert Statistics...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/alerting/statistics`);
      
      if (response.status === 200 && response.data.success) {
        const stats = response.data.data;
        
        // Verify statistics structure
        const requiredFields = ['totalIssues', 'activeIssues', 'resolvedIssues', 'issuesByType', 'issuesBySeverity'];
        const hasAllFields = requiredFields.every(field => stats.hasOwnProperty(field));
        
        if (hasAllFields) {
          this.recordTest('Alert Statistics', true, `Total issues: ${stats.totalIssues}, Active: ${stats.activeIssues}`);
        } else {
          this.recordTest('Alert Statistics', false, 'Invalid statistics structure');
        }
      } else {
        this.recordTest('Alert Statistics', false, 'Failed to retrieve statistics');
      }
    } catch (error) {
      this.recordTest('Alert Statistics', false, error.message);
    }
  }

  async testSystemIntegration() {
    console.log('🔄 Testing System Integration...');
    
    try {
      // Test that alerting system integrates with main application
      const healthResponse = await axios.get(`${this.baseUrl}/api/health`);
      
      if (healthResponse.status === 200) {
        this.recordTest('System Integration', true, 'Main application is accessible');
      } else {
        this.recordTest('System Integration', false, 'Main application not accessible');
      }
    } catch (error) {
      this.recordTest('System Integration', false, error.message);
    }
  }

  async testNotificationChannels() {
    console.log('📧 Testing Notification Channels...');
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/alerting/test`);
      
      if (response.status === 200 && response.data.success) {
        const testResults = response.data.data.testResults;
        
        this.recordTest('Email Notifications', testResults.email, testResults.email ? 'Email test passed' : 'Email test failed');
        this.recordTest('Webhook Notifications', testResults.webhook, testResults.webhook ? 'Webhook test passed' : 'Webhook test failed');
        this.recordTest('Slack Notifications', testResults.slack, testResults.slack ? 'Slack test passed' : 'Slack test failed');
      } else {
        this.recordTest('Notification Channels', false, 'Failed to test notification channels');
      }
    } catch (error) {
      this.recordTest('Notification Channels', false, error.message);
    }
  }

  async testErrorHandling() {
    console.log('❌ Testing Error Handling...');
    
    try {
      // Test invalid issue creation
      const invalidIssue = {
        type: 'invalid_type',
        title: '',
        description: 'Test'
      };
      
      try {
        await axios.post(`${this.baseUrl}/api/alerting/issues`, invalidIssue);
        this.recordTest('Error Handling (Invalid Issue)', false, 'Should have rejected invalid issue');
      } catch (error) {
        if (error.response && error.response.status === 400) {
          this.recordTest('Error Handling (Invalid Issue)', true, 'Correctly rejected invalid issue');
        } else {
          this.recordTest('Error Handling (Invalid Issue)', false, 'Unexpected error response');
        }
      }
      
      // Test non-existent issue retrieval
      try {
        await axios.get(`${this.baseUrl}/api/alerting/issues/non-existent-id`);
        this.recordTest('Error Handling (Non-existent Issue)', false, 'Should have returned 404');
      } catch (error) {
        if (error.response && error.response.status === 404) {
          this.recordTest('Error Handling (Non-existent Issue)', true, 'Correctly returned 404 for non-existent issue');
        } else {
          this.recordTest('Error Handling (Non-existent Issue)', false, 'Unexpected error response');
        }
      }
    } catch (error) {
      this.recordTest('Error Handling', false, error.message);
    }
  }

  async testPerformanceUnderLoad() {
    console.log('⚡ Testing Performance Under Load...');
    
    try {
      const startTime = performance.now();
      const promises = [];
      
      // Create multiple concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(axios.get(`${this.baseUrl}/api/alerting/health`));
      }
      
      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      
      const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / results.length;
      
      if (successfulRequests >= 8 && avgResponseTime < 1000) { // 80% success rate, under 1s avg
        this.recordTest('Performance Under Load', true, `${successfulRequests}/10 requests successful, avg ${avgResponseTime.toFixed(2)}ms`);
      } else {
        this.recordTest('Performance Under Load', false, `Only ${successfulRequests}/10 requests successful, avg ${avgResponseTime.toFixed(2)}ms`);
      }
    } catch (error) {
      this.recordTest('Performance Under Load', false, error.message);
    }
  }

  recordTest(testName, passed, details) {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
      console.log(`  ✅ ${testName}: ${details}`);
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${testName}: ${details}`);
    }
    
    this.testResults.details.push({
      name: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 PRODUCTION ALERTING SYSTEM TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed} ✅`);
    console.log(`Failed: ${this.testResults.failed} ❌`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  • ${test.name}: ${test.details}`);
        });
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    
    if (this.testResults.failed === 0) {
      console.log('  ✅ All tests passed! Production alerting system is ready for deployment.');
    } else {
      console.log('  ⚠️  Some tests failed. Please review and fix the issues before deployment.');
      console.log('  📝 Check the server logs for more detailed error information.');
      console.log('  🔧 Verify that all required environment variables are set correctly.');
      console.log('  📧 Ensure notification channels (email, Slack, webhooks) are properly configured.');
    }
    
    // Save results to file
    const fs = require('fs');
    const resultsFile = `production-alerting-test-results-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(this.testResults, null, 2));
    console.log(`\n📄 Detailed results saved to: ${resultsFile}`);
  }
}

// Run tests if called directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const tester = new ProductionAlertingTester(baseUrl);
  
  tester.runAllTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = ProductionAlertingTester;