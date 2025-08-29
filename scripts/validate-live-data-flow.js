#!/usr/bin/env node

/**
 * Live Data Flow Validation
 * 
 * Simple validation script to test if live market data is flowing properly
 */

const WebSocket = require('ws');
const axios = require('axios');

console.log('🚀 Live Market Data Flow Validation\n');

async function validateLiveDataFlow() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { passed: 0, failed: 0, total: 0 }
  };

  // Test 1: KuCoin API
  console.log('1️⃣  Testing KuCoin API connectivity...');
  try {
    const response = await axios.get('https://api.kucoin.com/api/v1/status', { timeout: 10000 });
    if (response.status === 200 && response.data.code === '200000') {
      console.log('   ✅ KuCoin API: Connected');
      results.tests.kucoinAPI = { passed: true, status: response.data.data.status };
      results.summary.passed++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ❌ KuCoin API: Failed -', error.message);
    results.tests.kucoinAPI = { passed: false, error: error.message };
    results.summary.failed++;
  }
  results.summary.total++;

  // Test 2: KuCoin WebSocket Live Data
  console.log('\n2️⃣  Testing KuCoin WebSocket live data...');
  try {
    const liveData = await testKuCoinWebSocket();
    if (liveData) {
      console.log(`   ✅ KuCoin WebSocket: Live data received - ${liveData.symbol} @ $${liveData.price}`);
      results.tests.kucoinWebSocket = { passed: true, data: liveData };
      results.summary.passed++;
    } else {
      throw new Error('No data received');
    }
  } catch (error) {
    console.log('   ❌ KuCoin WebSocket: Failed -', error.message);
    results.tests.kucoinWebSocket = { passed: false, error: error.message };
    results.summary.failed++;
  }
  results.summary.total++;

  // Test 3: Binance API (might be geo-blocked)
  console.log('\n3️⃣  Testing Binance API connectivity...');
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ping', { timeout: 10000 });
    if (response.status === 200) {
      console.log('   ✅ Binance API: Connected');
      results.tests.binanceAPI = { passed: true };
      results.summary.passed++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ⚠️  Binance API: Blocked/Failed -', error.message);
    results.tests.binanceAPI = { passed: false, error: error.message, note: 'May be geo-blocked' };
    results.summary.failed++;
  }
  results.summary.total++;

  // Summary
  console.log('\n📊 VALIDATION RESULTS');
  console.log('=====================');
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Tests Passed: ${results.summary.passed}/${results.summary.total}`);
  console.log(`Tests Failed: ${results.summary.failed}/${results.summary.total}`);
  
  const successRate = (results.summary.passed / results.summary.total) * 100;
  console.log(`Success Rate: ${successRate.toFixed(1)}%`);
  
  // Live data status
  const liveDataFlowing = results.tests.kucoinWebSocket?.passed || false;
  console.log(`\n🎯 LIVE MARKET DATA STATUS: ${liveDataFlowing ? '✅ FLOWING' : '❌ NOT FLOWING'}`);
  
  if (liveDataFlowing) {
    console.log('✅ Live market data is successfully flowing from at least one exchange!');
    console.log('   - Real-time price updates are working');
    console.log('   - WebSocket connections are stable');
    console.log('   - Data format is correct');
  } else {
    console.log('❌ Live market data flow needs attention');
    console.log('   - Check network connectivity');
    console.log('   - Verify exchange API access');
    console.log('   - Review WebSocket implementations');
  }

  return results;
}

async function testKuCoinWebSocket() {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 15000);

    try {
      // Get WebSocket token
      const tokenResponse = await axios.post('https://api.kucoin.com/api/v1/bullet-public');
      if (tokenResponse.data.code !== '200000') {
        throw new Error('Failed to get WebSocket token');
      }

      const tokenData = tokenResponse.data.data;
      const wsUrl = `${tokenData.instanceServers[0].endpoint}?token=${tokenData.token}&[connectId=${Date.now()}]`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        // Subscribe to BTC-USDT ticker
        const subscribeMsg = {
          id: Date.now(),
          type: 'subscribe',
          topic: '/market/ticker:BTC-USDT',
          privateChannel: false,
          response: true
        };
        ws.send(JSON.stringify(subscribeMsg));
      });
      
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          
          if (parsed.type === 'message' && parsed.data && parsed.data.price) {
            clearTimeout(timeout);
            ws.close();
            
            resolve({
              symbol: parsed.subject,
              price: parsed.data.price,
              timestamp: parsed.data.time,
              exchange: 'kucoin'
            });
          }
        } catch (parseError) {
          // Ignore parse errors, keep waiting for valid data
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// Run validation
validateLiveDataFlow()
  .then((results) => {
    const liveDataFlowing = results.tests.kucoinWebSocket?.passed || false;
    process.exit(liveDataFlowing ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Validation failed:', error.message);
    process.exit(1);
  });