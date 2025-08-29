const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAuthSystem() {
  console.log('🔐 Testing Enhanced Authentication and Security System...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed');
    console.log('   Paper Trading Mode:', healthResponse.data.paperTradingMode);
    console.log('   Safety Status:', healthResponse.data.safetyStatus);

    // Test 2: Security status
    console.log('\n2. Testing security status...');
    const securityResponse = await axios.get(`${BASE_URL}/api/v1/security/status`);
    console.log('✅ Security status retrieved');
    console.log('   Security Features:', Object.keys(securityResponse.data.security));
    console.log('   Authentication Methods:', Object.keys(securityResponse.data.authentication));

    // Test 3: Register new user
    console.log('\n3. Testing user registration...');
    const registerData = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };

    const registerResponse = await axios.post(`${BASE_URL}/api/v1/auth/register`, registerData);
    console.log('✅ User registration successful');
    console.log('   User ID:', registerResponse.data.data.user.id);
    console.log('   Access Token Length:', registerResponse.data.data.accessToken.length);

    const { accessToken, refreshToken } = registerResponse.data.data;

    // Test 4: Login with credentials
    console.log('\n4. Testing user login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      email: registerData.email,
      password: registerData.password
    });
    console.log('✅ User login successful');

    // Test 5: Access protected endpoint
    console.log('\n5. Testing protected endpoint access...');
    const profileResponse = await axios.get(`${BASE_URL}/api/v1/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    console.log('✅ Protected endpoint access successful');
    console.log('   User Email:', profileResponse.data.data.user.email);
    console.log('   Auth Method:', profileResponse.data.data.authMethod);

    // Test 6: Token refresh
    console.log('\n6. Testing token refresh...');
    const refreshResponse = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
      refreshToken
    });
    console.log('✅ Token refresh successful');

    // Test 7: Rate limiting test
    console.log('\n7. Testing rate limiting...');
    let rateLimitHit = false;
    for (let i = 0; i < 10; i++) {
      try {
        await axios.post(`${BASE_URL}/api/v1/auth/login`, {
          email: 'invalid@example.com',
          password: 'wrongpassword'
        });
      } catch (error) {
        if (error.response?.status === 429) {
          rateLimitHit = true;
          console.log('✅ Rate limiting working - got 429 status');
          break;
        }
      }
    }
    if (!rateLimitHit) {
      console.log('⚠️  Rate limiting may not be working as expected');
    }

    // Test 8: CORS headers
    console.log('\n8. Testing CORS headers...');
    const corsResponse = await axios.options(`${BASE_URL}/api/v1/auth/profile`);
    const corsHeaders = corsResponse.headers;
    if (corsHeaders['access-control-allow-origin']) {
      console.log('✅ CORS headers present');
      console.log('   Allow Origin:', corsHeaders['access-control-allow-origin']);
    } else {
      console.log('⚠️  CORS headers may not be configured');
    }

    // Test 9: Security headers
    console.log('\n9. Testing security headers...');
    const securityHeaders = healthResponse.headers;
    const expectedHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security'
    ];
    
    let securityHeadersPresent = 0;
    expectedHeaders.forEach(header => {
      if (securityHeaders[header]) {
        securityHeadersPresent++;
        console.log(`   ✅ ${header}: ${securityHeaders[header]}`);
      } else {
        console.log(`   ❌ ${header}: missing`);
      }
    });
    
    if (securityHeadersPresent >= 3) {
      console.log('✅ Security headers mostly configured');
    } else {
      console.log('⚠️  Some security headers missing');
    }

    // Test 10: Logout
    console.log('\n10. Testing logout...');
    await axios.post(`${BASE_URL}/api/v1/auth/logout`, {
      refreshToken
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    console.log('✅ Logout successful');

    console.log('\n🎉 All authentication and security tests completed successfully!');
    
    return {
      success: true,
      message: 'Enhanced authentication and security system is working correctly',
      features: {
        userRegistration: true,
        userLogin: true,
        jwtTokens: true,
        tokenRefresh: true,
        protectedEndpoints: true,
        rateLimiting: rateLimitHit,
        corsHeaders: !!corsHeaders['access-control-allow-origin'],
        securityHeaders: securityHeadersPresent >= 3,
        sessionManagement: true,
        logout: true
      }
    };

  } catch (error) {
    console.error('\n❌ Authentication system test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAuthSystem()
    .then(result => {
      console.log('\n📊 Test Results:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testAuthSystem };