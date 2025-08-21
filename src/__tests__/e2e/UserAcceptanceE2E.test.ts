/**
 * User Acceptance Testing (UAT) for AI Crypto Trading Bot
 * Tests realistic trading scenarios from end-user perspective
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';

interface TradingScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
  execute: () => Promise<any>;
  validate: (result: any) => void;
  cleanup?: () => Promise<void>;
}

interface UserJourney {
  name: string;
  steps: Array<{
    action: string;
    endpoint?: string;
    method?: string;
    body?: any;
    expectedOutcome: string;
  }>;
}

class UserAcceptanceTester {
  private baseUrl: string;
  private authToken: string;
  private testUserId: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    this.testUserId = 'uat-user-' + Date.now();
  }

  async setupUserEnvironment(): Promise<void> {
    // Create test user with realistic configuration
    await fetch(`${this.baseUrl}/api/test/user/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: this.testUserId,
        profile: {
          experience: 'intermediate',
          riskTolerance: 'moderate',
          tradingGoals: ['profit', 'learning'],
          preferredTimeframes: ['1h', '4h', '1d']
        },
        initialBalance: 5000,
        exchangeAccounts: {
          binance: { connected: true, verified: true },
          kucoin: { connected: true, verified: true }
        }
      })
    });
  }

  async executeUserJourney(journey: UserJourney): Promise<any> {
    const results = [];
    
    for (const step of journey.steps) {
      const startTime = performance.now();
      
      try {
        let response;
        
        if (step.endpoint) {
          response = await fetch(`${this.baseUrl}${step.endpoint}`, {
            method: step.method || 'GET',
            headers: {
              'Authorization': `Bearer ${this.authToken}`,
              'Content-Type': 'application/json'
            },
            body: step.body ? JSON.stringify(step.body) : undefined
          });
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        const stepResult = {
          action: step.action,
          success: response ? response.ok : true,
          duration,
          response: response ? {
            status: response.status,
            data: response.ok ? await response.json() : await response.text()
          } : null,
          expectedOutcome: step.expectedOutcome
        };
        
        results.push(stepResult);
        
      } catch (error) {
        results.push({
          action: step.action,
          success: false,
          error: error.message,
          expectedOutcome: step.expectedOutcome
        });
      }
    }
    
    return {
      journey: journey.name,
      steps: results,
      overallSuccess: results.every(r => r.success),
      totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0)
    };
  }

  async simulateRealisticTradingSession(): Promise<any> {
    const session = {
      startTime: Date.now(),
      actions: [],
      outcomes: []
    };

    // 1. Check market conditions
    const marketCheck = await fetch(`${this.baseUrl}/api/market-data/overview`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    
    session.actions.push('Check market overview');
    session.outcomes.push({
      action: 'market_check',
      success: marketCheck.ok,
      data: marketCheck.ok ? await marketCheck.json() : null
    });

    // 2. Review account status
    const accountStatus = await fetch(`${this.baseUrl}/api/account/status`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    
    session.actions.push('Review account status');
    session.outcomes.push({
      action: 'account_review',
      success: accountStatus.ok,
      data: accountStatus.ok ? await accountStatus.json() : null
    });

    // 3. Analyze potential trading opportunities
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
    for (const symbol of symbols) {
      const analysis = await fetch(`${this.baseUrl}/api/analysis/comprehensive/${symbol}`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      
      session.actions.push(`Analyze ${symbol}`);
      session.outcomes.push({
        action: `analysis_${symbol}`,
        success: analysis.ok,
        data: analysis.ok ? await analysis.json() : null
      });
    }

    // 4. Generate trading signals
    const signalGeneration = await fetch(`${this.baseUrl}/api/signals/scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbols: symbols,
        timeframes: ['1h', '4h'],
        minConfidence: 0.7
      })
    });
    
    session.actions.push('Generate trading signals');
    session.outcomes.push({
      action: 'signal_generation',
      success: signalGeneration.ok,
      data: signalGeneration.ok ? await signalGeneration.json() : null
    });

    // 5. Execute trades based on signals (if any high-confidence signals exist)
    const signals = session.outcomes.find(o => o.action === 'signal_generation')?.data?.signals || [];
    const highConfidenceSignals = signals.filter((s: any) => s.confidence > 0.8);
    
    for (const signal of highConfidenceSignals.slice(0, 2)) { // Limit to 2 trades
      const tradeExecution = await fetch(`${this.baseUrl}/api/trading/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signalId: signal.id,
          size: 0.01, // Small size for testing
          exchange: 'binance'
        })
      });
      
      session.actions.push(`Execute trade for ${signal.symbol}`);
      session.outcomes.push({
        action: `trade_execution_${signal.symbol}`,
        success: tradeExecution.ok,
        data: tradeExecution.ok ? await tradeExecution.json() : null
      });
    }

    // 6. Monitor positions
    const positionMonitoring = await fetch(`${this.baseUrl}/api/positions`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });
    
    session.actions.push('Monitor positions');
    session.outcomes.push({
      action: 'position_monitoring',
      success: positionMonitoring.ok,
      data: positionMonitoring.ok ? await positionMonitoring.json() : null
    });

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;

    return session;
  }

  async testGridTradingWorkflow(): Promise<any> {
    const workflow = {
      steps: [],
      success: true,
      errors: []
    };

    try {
      // 1. Analyze market for grid trading opportunity
      const marketAnalysis = await fetch(`${this.baseUrl}/api/analysis/grid-suitability/BTCUSDT`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      
      workflow.steps.push({
        step: 'Market Analysis for Grid Trading',
        success: marketAnalysis.ok,
        data: marketAnalysis.ok ? await marketAnalysis.json() : null
      });

      // 2. Configure grid parameters
      const gridConfig = {
        symbol: 'BTCUSDT',
        strategy: 'elliott-wave',
        basePrice: 50000,
        gridCount: 8,
        spacing: 'fibonacci',
        investment: 1000
      };

      const gridCreation = await fetch(`${this.baseUrl}/api/grids/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gridConfig)
      });
      
      workflow.steps.push({
        step: 'Create Grid Trading Setup',
        success: gridCreation.ok,
        data: gridCreation.ok ? await gridCreation.json() : null
      });

      if (gridCreation.ok) {
        const gridData = await gridCreation.json();
        
        // 3. Monitor grid performance
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const gridStatus = await fetch(`${this.baseUrl}/api/grids/${gridData.id}/status`, {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        
        workflow.steps.push({
          step: 'Monitor Grid Performance',
          success: gridStatus.ok,
          data: gridStatus.ok ? await gridStatus.json() : null
        });

        // 4. Adjust grid if needed
        const gridAdjustment = await fetch(`${this.baseUrl}/api/grids/${gridData.id}/adjust`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reason: 'market_conditions_changed',
            adjustments: {
              spacing: 'tighter',
              riskReduction: 0.1
            }
          })
        });
        
        workflow.steps.push({
          step: 'Adjust Grid Parameters',
          success: gridAdjustment.ok,
          data: gridAdjustment.ok ? await gridAdjustment.json() : null
        });
      }

    } catch (error) {
      workflow.success = false;
      workflow.errors.push(error.message);
    }

    return workflow;
  }

  async testRiskManagementScenarios(): Promise<any> {
    const scenarios = [];

    // Scenario 1: Gradual position building with risk monitoring
    const gradualBuildingScenario = await this.testGradualPositionBuilding();
    scenarios.push(gradualBuildingScenario);

    // Scenario 2: Emergency exit during market volatility
    const emergencyExitScenario = await this.testEmergencyExit();
    scenarios.push(emergencyExitScenario);

    // Scenario 3: Drawdown recovery
    const drawdownRecoveryScenario = await this.testDrawdownRecovery();
    scenarios.push(drawdownRecoveryScenario);

    return {
      scenarios,
      overallSuccess: scenarios.every(s => s.success),
      riskManagementEffectiveness: this.calculateRiskManagementScore(scenarios)
    };
  }

  private async testGradualPositionBuilding(): Promise<any> {
    const scenario = {
      name: 'Gradual Position Building',
      success: true,
      steps: [],
      riskMetrics: []
    };

    // Build position gradually with risk monitoring
    const positionSizes = [0.01, 0.015, 0.02, 0.025];
    
    for (let i = 0; i < positionSizes.length; i++) {
      const size = positionSizes[i];
      
      // Check risk before each trade
      const riskCheck = await fetch(`${this.baseUrl}/api/risk/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: 'BTCUSDT',
          side: 'buy',
          size: size
        })
      });
      
      const riskData = riskCheck.ok ? await riskCheck.json() : null;
      scenario.riskMetrics.push(riskData);
      
      if (riskData?.isValid) {
        // Execute trade
        const trade = await fetch(`${this.baseUrl}/api/trading/execute`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            symbol: 'BTCUSDT',
            side: 'buy',
            size: size,
            exchange: 'binance'
          })
        });
        
        scenario.steps.push({
          step: `Position ${i + 1}`,
          size: size,
          success: trade.ok,
          riskValid: true
        });
      } else {
        scenario.steps.push({
          step: `Position ${i + 1}`,
          size: size,
          success: false,
          riskValid: false,
          reason: 'Risk limits exceeded'
        });
        break; // Stop building position
      }
      
      // Wait between trades
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return scenario;
  }

  private async testEmergencyExit(): Promise<any> {
    const scenario = {
      name: 'Emergency Exit',
      success: true,
      steps: []
    };

    // First, create some positions
    await fetch(`${this.baseUrl}/api/trading/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.02,
        exchange: 'binance'
      })
    });

    // Simulate market crash
    await fetch(`${this.baseUrl}/api/test/market/crash`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ crashPercentage: 15 })
    });

    // Trigger emergency exit
    const emergencyExit = await fetch(`${this.baseUrl}/api/emergency/exit-all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'market_crash' })
    });

    scenario.steps.push({
      step: 'Emergency Exit Execution',
      success: emergencyExit.ok,
      data: emergencyExit.ok ? await emergencyExit.json() : null
    });

    // Verify all positions are closed
    const positions = await fetch(`${this.baseUrl}/api/positions`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    if (positions.ok) {
      const positionData = await positions.json();
      scenario.steps.push({
        step: 'Position Verification',
        success: positionData.positions.length === 0,
        openPositions: positionData.positions.length
      });
    }

    return scenario;
  }

  private async testDrawdownRecovery(): Promise<any> {
    const scenario = {
      name: 'Drawdown Recovery',
      success: true,
      steps: []
    };

    // Simulate losses to create drawdown
    await fetch(`${this.baseUrl}/api/test/simulate-loss`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lossAmount: 500, // 10% of $5000 balance
        reason: 'simulated_drawdown'
      })
    });

    // Check if system adjusts risk parameters
    const riskMetrics = await fetch(`${this.baseUrl}/api/risk/metrics`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    if (riskMetrics.ok) {
      const riskData = await riskMetrics.json();
      scenario.steps.push({
        step: 'Drawdown Detection',
        success: riskData.currentDrawdown > 0,
        drawdown: riskData.currentDrawdown,
        adjustedLimits: riskData.adjustedRiskLimits
      });
    }

    // Test if position sizes are reduced
    const reducedSizeTrade = await fetch(`${this.baseUrl}/api/trading/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: 'ETHUSDT',
        side: 'buy',
        size: 0.1, // Request normal size
        exchange: 'binance'
      })
    });

    if (reducedSizeTrade.ok) {
      const tradeData = await reducedSizeTrade.json();
      scenario.steps.push({
        step: 'Position Size Adjustment',
        success: tradeData.executedSize < 0.1, // Should be reduced
        requestedSize: 0.1,
        executedSize: tradeData.executedSize
      });
    }

    return scenario;
  }

  private calculateRiskManagementScore(scenarios: any[]): number {
    let totalScore = 0;
    let totalTests = 0;

    scenarios.forEach(scenario => {
      scenario.steps.forEach((step: any) => {
        if (step.success) totalScore += 1;
        totalTests += 1;
      });
    });

    return totalTests > 0 ? (totalScore / totalTests) * 100 : 0;
  }

  async testUserInterfaceWorkflows(): Promise<any> {
    const uiWorkflows = [];

    // Test dashboard loading and data display
    const dashboardWorkflow = await this.testDashboardWorkflow();
    uiWorkflows.push(dashboardWorkflow);

    // Test trading interface
    const tradingInterfaceWorkflow = await this.testTradingInterfaceWorkflow();
    uiWorkflows.push(tradingInterfaceWorkflow);

    // Test configuration management
    const configWorkflow = await this.testConfigurationWorkflow();
    uiWorkflows.push(configWorkflow);

    return {
      workflows: uiWorkflows,
      overallUsability: this.calculateUsabilityScore(uiWorkflows)
    };
  }

  private async testDashboardWorkflow(): Promise<any> {
    const workflow = {
      name: 'Dashboard Workflow',
      steps: [],
      loadTimes: []
    };

    // Test dashboard data loading
    const dashboardEndpoints = [
      '/api/dashboard/overview',
      '/api/dashboard/portfolio',
      '/api/dashboard/recent-trades',
      '/api/dashboard/performance'
    ];

    for (const endpoint of dashboardEndpoints) {
      const startTime = performance.now();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      const loadTime = performance.now() - startTime;

      workflow.steps.push({
        endpoint,
        success: response.ok,
        loadTime,
        dataReceived: response.ok
      });

      workflow.loadTimes.push(loadTime);
    }

    return workflow;
  }

  private async testTradingInterfaceWorkflow(): Promise<any> {
    const workflow = {
      name: 'Trading Interface Workflow',
      steps: []
    };

    // Test market data display
    const marketData = await fetch(`${this.baseUrl}/api/market-data/ticker/BTCUSDT`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    workflow.steps.push({
      step: 'Market Data Display',
      success: marketData.ok,
      data: marketData.ok ? await marketData.json() : null
    });

    // Test order form validation
    const orderValidation = await fetch(`${this.baseUrl}/api/trading/validate-order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: 'BTCUSDT',
        side: 'buy',
        size: 0.01,
        type: 'market'
      })
    });

    workflow.steps.push({
      step: 'Order Form Validation',
      success: orderValidation.ok,
      data: orderValidation.ok ? await orderValidation.json() : null
    });

    return workflow;
  }

  private async testConfigurationWorkflow(): Promise<any> {
    const workflow = {
      name: 'Configuration Workflow',
      steps: []
    };

    // Test risk settings update
    const riskUpdate = await fetch(`${this.baseUrl}/api/config/risk`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        maxRiskPerTrade: 0.025,
        maxDailyLoss: 0.06,
        maxTotalExposure: 4.0
      })
    });

    workflow.steps.push({
      step: 'Risk Settings Update',
      success: riskUpdate.ok,
      data: riskUpdate.ok ? await riskUpdate.json() : null
    });

    // Test strategy configuration
    const strategyConfig = await fetch(`${this.baseUrl}/api/config/strategy`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enabledStrategies: ['elliott-wave', 'fibonacci'],
        signalFilters: {
          minConfidence: 0.75,
          requiredTimeframes: ['4h', '1d']
        }
      })
    });

    workflow.steps.push({
      step: 'Strategy Configuration',
      success: strategyConfig.ok,
      data: strategyConfig.ok ? await strategyConfig.json() : null
    });

    return workflow;
  }

  private calculateUsabilityScore(workflows: any[]): number {
    let totalScore = 0;
    let totalSteps = 0;

    workflows.forEach(workflow => {
      workflow.steps.forEach((step: any) => {
        if (step.success) totalScore += 1;
        totalSteps += 1;
      });
    });

    return totalSteps > 0 ? (totalScore / totalSteps) * 100 : 0;
  }
}

describe('User Acceptance Testing (UAT)', () => {
  let uatTester: UserAcceptanceTester;
  const baseUrl = 'http://localhost:3001';
  let authToken: string;

  beforeAll(async () => {
    // Get auth token
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!'
      })
    });
    
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    
    uatTester = new UserAcceptanceTester(baseUrl, authToken);
    await uatTester.setupUserEnvironment();
  }, 30000);

  describe('Realistic Trading Scenarios', () => {
    test('should handle complete trading session workflow', async () => {
      const session = await uatTester.simulateRealisticTradingSession();

      expect(session.outcomes.length).toBeGreaterThan(0);
      expect(session.duration).toBeLessThan(60000); // Should complete within 1 minute

      // Verify key actions were successful
      const marketCheck = session.outcomes.find(o => o.action === 'market_check');
      expect(marketCheck?.success).toBe(true);

      const accountReview = session.outcomes.find(o => o.action === 'account_review');
      expect(accountReview?.success).toBe(true);

      const signalGeneration = session.outcomes.find(o => o.action === 'signal_generation');
      expect(signalGeneration?.success).toBe(true);

      console.log(`Trading session completed in ${session.duration}ms with ${session.actions.length} actions`);
    }, 90000);

    test('should handle grid trading workflow from user perspective', async () => {
      const gridWorkflow = await uatTester.testGridTradingWorkflow();

      expect(gridWorkflow.success).toBe(true);
      expect(gridWorkflow.steps.length).toBeGreaterThan(0);

      // Verify grid creation was successful
      const gridCreation = gridWorkflow.steps.find(s => s.step === 'Create Grid Trading Setup');
      expect(gridCreation?.success).toBe(true);

      // Verify monitoring capabilities
      const gridMonitoring = gridWorkflow.steps.find(s => s.step === 'Monitor Grid Performance');
      expect(gridMonitoring?.success).toBe(true);

      console.log(`Grid trading workflow completed with ${gridWorkflow.steps.length} steps`);
    }, 30000);

    test('should demonstrate effective risk management in realistic scenarios', async () => {
      const riskScenarios = await uatTester.testRiskManagementScenarios();

      expect(riskScenarios.overallSuccess).toBe(true);
      expect(riskScenarios.riskManagementEffectiveness).toBeGreaterThan(80);

      // Verify specific risk management behaviors
      const gradualBuilding = riskScenarios.scenarios.find(s => s.name === 'Gradual Position Building');
      expect(gradualBuilding?.success).toBe(true);

      const emergencyExit = riskScenarios.scenarios.find(s => s.name === 'Emergency Exit');
      expect(emergencyExit?.success).toBe(true);

      const drawdownRecovery = riskScenarios.scenarios.find(s => s.name === 'Drawdown Recovery');
      expect(drawdownRecovery?.success).toBe(true);

      console.log(`Risk management effectiveness: ${riskScenarios.riskManagementEffectiveness.toFixed(2)}%`);
    }, 45000);
  });

  describe('User Journey Testing', () => {
    test('should support new user onboarding journey', async () => {
      const onboardingJourney: UserJourney = {
        name: 'New User Onboarding',
        steps: [
          {
            action: 'Create account',
            endpoint: '/api/auth/register',
            method: 'POST',
            body: {
              email: `newuser${Date.now()}@example.com`,
              password: 'SecurePassword123!',
              acceptTerms: true
            },
            expectedOutcome: 'Account created successfully'
          },
          {
            action: 'Verify email',
            endpoint: '/api/auth/verify-email',
            method: 'POST',
            body: { token: 'mock-verification-token' },
            expectedOutcome: 'Email verified'
          },
          {
            action: 'Complete profile setup',
            endpoint: '/api/user/profile',
            method: 'PUT',
            body: {
              experience: 'beginner',
              riskTolerance: 'conservative',
              tradingGoals: ['learning']
            },
            expectedOutcome: 'Profile updated'
          },
          {
            action: 'Connect exchange account',
            endpoint: '/api/user/exchanges',
            method: 'POST',
            body: {
              exchange: 'binance',
              apiKey: 'test-api-key',
              secretKey: 'test-secret-key'
            },
            expectedOutcome: 'Exchange connected'
          },
          {
            action: 'Set initial risk parameters',
            endpoint: '/api/config/risk',
            method: 'PUT',
            body: {
              maxRiskPerTrade: 0.01, // Conservative 1%
              maxDailyLoss: 0.02,    // Conservative 2%
              maxTotalExposure: 1.0   // Conservative 1x
            },
            expectedOutcome: 'Risk parameters configured'
          }
        ]
      };

      const result = await uatTester.executeUserJourney(onboardingJourney);

      expect(result.overallSuccess).toBe(true);
      expect(result.totalDuration).toBeLessThan(10000); // Should complete quickly

      console.log(`Onboarding journey completed in ${result.totalDuration}ms`);
    }, 20000);

    test('should support experienced trader journey', async () => {
      const experiencedTraderJourney: UserJourney = {
        name: 'Experienced Trader Workflow',
        steps: [
          {
            action: 'Review market analysis',
            endpoint: '/api/analysis/market-overview',
            expectedOutcome: 'Market data retrieved'
          },
          {
            action: 'Scan for high-confidence signals',
            endpoint: '/api/signals/scan',
            method: 'POST',
            body: {
              minConfidence: 0.85,
              strategies: ['elliott-wave', 'fibonacci', 'patterns'],
              timeframes: ['4h', '1d']
            },
            expectedOutcome: 'Signals generated'
          },
          {
            action: 'Create advanced grid strategy',
            endpoint: '/api/grids/create',
            method: 'POST',
            body: {
              symbol: 'BTCUSDT',
              strategy: 'elliott-wave',
              gridCount: 12,
              spacing: 'fibonacci',
              investment: 2000
            },
            expectedOutcome: 'Grid created'
          },
          {
            action: 'Set up automated risk management',
            endpoint: '/api/automation/risk-rules',
            method: 'POST',
            body: {
              rules: [
                { trigger: 'drawdown_5%', action: 'reduce_positions_50%' },
                { trigger: 'volatility_spike', action: 'tighten_stops' }
              ]
            },
            expectedOutcome: 'Automation configured'
          }
        ]
      };

      const result = await uatTester.executeUserJourney(experiencedTraderJourney);

      expect(result.overallSuccess).toBe(true);
      
      // Experienced traders should get more sophisticated features
      const signalScan = result.steps.find(s => s.action === 'Scan for high-confidence signals');
      expect(signalScan?.success).toBe(true);

      const gridCreation = result.steps.find(s => s.action === 'Create advanced grid strategy');
      expect(gridCreation?.success).toBe(true);

      console.log(`Experienced trader journey completed successfully`);
    }, 25000);
  });

  describe('User Interface and Experience Testing', () => {
    test('should provide responsive and intuitive user interface', async () => {
      const uiWorkflows = await uatTester.testUserInterfaceWorkflows();

      expect(uiWorkflows.overallUsability).toBeGreaterThan(90);

      // Test dashboard performance
      const dashboardWorkflow = uiWorkflows.workflows.find(w => w.name === 'Dashboard Workflow');
      expect(dashboardWorkflow).toBeDefined();
      
      // All dashboard components should load quickly
      dashboardWorkflow.loadTimes.forEach((loadTime: number) => {
        expect(loadTime).toBeLessThan(2000); // 2 second max load time
      });

      // Test trading interface responsiveness
      const tradingWorkflow = uiWorkflows.workflows.find(w => w.name === 'Trading Interface Workflow');
      expect(tradingWorkflow?.steps.every((s: any) => s.success)).toBe(true);

      console.log(`UI usability score: ${uiWorkflows.overallUsability.toFixed(2)}%`);
    }, 20000);

    test('should handle user errors gracefully', async () => {
      const errorScenarios = [
        {
          name: 'Invalid trade parameters',
          endpoint: '/api/trading/execute',
          method: 'POST',
          body: {
            symbol: 'INVALID',
            side: 'invalid_side',
            size: -1
          },
          expectedStatus: 400
        },
        {
          name: 'Insufficient balance',
          endpoint: '/api/trading/execute',
          method: 'POST',
          body: {
            symbol: 'BTCUSDT',
            side: 'buy',
            size: 1000 // Way more than test balance
          },
          expectedStatus: 400
        },
        {
          name: 'Invalid configuration',
          endpoint: '/api/config/risk',
          method: 'PUT',
          body: {
            maxRiskPerTrade: -0.1, // Invalid negative risk
            maxDailyLoss: 2.0      // Invalid >100% loss
          },
          expectedStatus: 400
        }
      ];

      for (const scenario of errorScenarios) {
        const response = await fetch(`${baseUrl}${scenario.endpoint}`, {
          method: scenario.method,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(scenario.body)
        });

        expect(response.status).toBe(scenario.expectedStatus);
        
        // Error messages should be user-friendly
        if (!response.ok) {
          const errorData = await response.json();
          expect(errorData).toHaveProperty('message');
          expect(errorData.message).not.toContain('Error:'); // No technical stack traces
        }
      }
    }, 15000);
  });

  describe('Performance and Reliability from User Perspective', () => {
    test('should maintain acceptable performance under normal usage', async () => {
      const performanceTests = [
        {
          name: 'Dashboard load time',
          test: async () => {
            const start = performance.now();
            const response = await fetch(`${baseUrl}/api/dashboard/overview`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const end = performance.now();
            return { duration: end - start, success: response.ok };
          },
          maxDuration: 2000
        },
        {
          name: 'Signal generation time',
          test: async () => {
            const start = performance.now();
            const response = await fetch(`${baseUrl}/api/signals/generate`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ symbol: 'BTCUSDT', forceGenerate: true })
            });
            const end = performance.now();
            return { duration: end - start, success: response.ok };
          },
          maxDuration: 5000
        },
        {
          name: 'Trade execution time',
          test: async () => {
            const start = performance.now();
            const response = await fetch(`${baseUrl}/api/trading/validate-order`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                symbol: 'BTCUSDT',
                side: 'buy',
                size: 0.001
              })
            });
            const end = performance.now();
            return { duration: end - start, success: response.ok };
          },
          maxDuration: 1000
        }
      ];

      for (const perfTest of performanceTests) {
        const result = await perfTest.test();
        
        expect(result.success).toBe(true);
        expect(result.duration).toBeLessThan(perfTest.maxDuration);
        
        console.log(`${perfTest.name}: ${result.duration.toFixed(2)}ms`);
      }
    }, 30000);

    test('should provide reliable service availability', async () => {
      // Test service availability over time
      const availabilityTests = [];
      const testDuration = 10000; // 10 seconds
      const testInterval = 1000;  // 1 second intervals
      
      const startTime = Date.now();
      
      while (Date.now() - startTime < testDuration) {
        const testStart = performance.now();
        
        try {
          const response = await fetch(`${baseUrl}/api/health`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          
          availabilityTests.push({
            timestamp: Date.now(),
            available: response.ok,
            responseTime: performance.now() - testStart
          });
        } catch (error) {
          availabilityTests.push({
            timestamp: Date.now(),
            available: false,
            error: error.message
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, testInterval));
      }
      
      const availability = availabilityTests.filter(t => t.available).length / availabilityTests.length;
      const averageResponseTime = availabilityTests
        .filter(t => t.available && t.responseTime)
        .reduce((sum, t) => sum + t.responseTime!, 0) / availabilityTests.length;
      
      expect(availability).toBeGreaterThan(0.99); // 99% availability
      expect(averageResponseTime).toBeLessThan(500); // 500ms average response time
      
      console.log(`Service availability: ${(availability * 100).toFixed(2)}%`);
      console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
    }, 15000);
  });
});