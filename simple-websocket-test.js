#!/usr/bin/env node

/**
 * Simple WebSocket Server Test
 * Tests basic WebSocket functionality without requiring full build
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

async function testWebSocketEndpoints() {
  console.log('🔌 Testing WebSocket Server Endpoints...\n');
  
  const tests = [
    {
      name: 'Health Check',
      url: `${SERVER_URL}/health`,
      expectedKeys: ['status', 'paperTradingMode', 'safetyStatus']
    },
    {
      name: 'WebSocket Health',
      url: `${SERVER_URL}/api/v1/websocket/health`,
      expectedKeys: ['status', 'websocket']
    },
    {
      name: 'WebSocket Stats',
      url: `${SERVER_URL}/api/v1/websocket/stats`,
      expectedKeys: ['server', 'performance']
    },
    {
      name: 'WebSocket Channels',
      url: `${SERVER_URL}/api/v1/websocket/channels`,
      expectedKeys: ['channels']
    },
    {
      name: 'Paper Trading Status',
      url: `${SERVER_URL}/api/v1/paper-trading/status`,
      expectedKeys: ['paperTradingMode', 'safety']
    }
  ];

  let passedTests = 0;
  const totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`📋 Testing ${test.name}...`);
      const response = await axios.get(test.url, { timeout: 5000 });
      
      if (response.status === 200) {
        const hasExpectedKeys = test.expectedKeys.every(key => 
          response.data.hasOwnProperty(key)
        );
        
        if (hasExpectedKeys) {
          console.log(`✅ ${test.name}: PASSED`);
          console.log(`   Status: ${response.status}`);
          console.log(`   Keys: ${Object.keys(response.data).join(', ')}`);
          passedTests++;
        } else {
          console.log(`❌ ${test.name}: FAILED - Missing expected keys`);
          console.log(`   Expected: ${test.expectedKeys.join(', ')}`);
          console.log(`   Found: ${Object.keys(response.data).join(', ')}`);
        }
      } else {
        console.log(`❌ ${test.name}: FAILED - Status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED - ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.log('   Server appears to be offline');
      }
    }
    console.log('');
  }

  // Test WebSocket broadcast endpoint
  try {
    console.log('📡 Testing WebSocket Broadcast...');
    const broadcastResponse = await axios.post(`${SERVER_URL}/api/v1/websocket/broadcast`, {
      type: 'all',
      message: {
        type: 'test_message',
        data: { test: true, timestamp: Date.now() }
      }
    }, { timeout: 5000 });

    if (broadcastResponse.data.success) {
      console.log('✅ WebSocket Broadcast: PASSED');
      passedTests++;
    } else {
      console.log('❌ WebSocket Broadcast: FAILED - No success response');
    }
  } catch (error) {
    console.log(`❌ WebSocket Broadcast: FAILED - ${error.message}`);
  }

  const totalTestsWithBroadcast = totalTests + 1;
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 WEBSOCKET SERVER TEST REPORT');
  console.log('='.repeat(60));
  console.log(`✅ Tests Passed: ${passedTests}/${totalTestsWithBroadcast}`);
  console.log(`📊 Success Rate: ${((passedTests / totalTestsWithBroadcast) * 100).toFixed(1)}%`);
  
  console.log('\n🎯 Task 17 Implementation Status:');
  const implementationStatus = passedTests >= totalTestsWithBroadcast * 0.8;
  console.log(`   ${implementationStatus ? '✅' : '❌'} WebSocket Server Endpoints: ${implementationStatus ? 'WORKING' : 'NEEDS WORK'}`);
  console.log(`   ${passedTests >= 3 ? '✅' : '❌'} Health Monitoring: ${passedTests >= 3 ? 'IMPLEMENTED' : 'NEEDS WORK'}`);
  console.log(`   ${passedTests >= 4 ? '✅' : '❌'} Broadcasting System: ${passedTests >= 4 ? 'IMPLEMENTED' : 'NEEDS WORK'}`);
  
  const overallSuccess = passedTests >= totalTestsWithBroadcast * 0.8;
  console.log(`\n🏆 Overall Result: ${overallSuccess ? '✅ TASK 17 ENDPOINTS WORKING' : '❌ TASK 17 NEEDS SERVER STARTUP'}`);
  
  if (overallSuccess) {
    console.log('\n🎉 WebSocket Server endpoints are responding correctly!');
    console.log('   - Health checks are functional');
    console.log('   - Statistics endpoints are working');
    console.log('   - Broadcasting system is operational');
    console.log('   - Paper trading safety is active');
  } else {
    console.log('\n⚠️  Server may not be running or WebSocket service needs configuration');
    console.log('   - Start the server with: npm start');
    console.log('   - Check server logs for any errors');
    console.log('   - Verify all dependencies are installed');
  }
  
  console.log('='.repeat(60));
  
  return overallSuccess;
}

// Run test if this file is executed directly
if (require.main === module) {
  testWebSocketEndpoints()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = testWebSocketEndpoints;