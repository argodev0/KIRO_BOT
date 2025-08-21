/**
 * Trading Execution Engine Demo
 * Demonstrates the capabilities of the trading execution system
 */

import { TradingExecutionService, ExecutionConfig } from '../services/TradingExecutionService';
import { ExchangeManager, ExchangeManagerConfig } from '../services/exchanges/ExchangeManager';
import { TradingSignal, OrderRequest } from '../types/trading';
import { logger } from '../utils/logger';

async function runTradingExecutionDemo() {
  console.log('🚀 Trading Execution Engine Demo Starting...\n');

  try {
    // 1. Initialize Exchange Manager
    console.log('📡 Setting up Exchange Manager...');
    const exchangeConfig: ExchangeManagerConfig = {
      exchanges: {
        binance: {
          enabled: true,
          apiKey: process.env.BINANCE_API_KEY || 'demo_key',
          apiSecret: process.env.BINANCE_API_SECRET || 'demo_secret',
          testnet: true // Use testnet for demo
        },
        kucoin: {
          enabled: true,
          apiKey: process.env.KUCOIN_API_KEY || 'demo_key',
          apiSecret: process.env.KUCOIN_API_SECRET || 'demo_secret',
          passphrase: process.env.KUCOIN_PASSPHRASE || 'demo_passphrase',
          sandbox: true // Use sandbox for demo
        }
      },
      defaultExchange: 'binance'
    };

    const exchangeManager = new ExchangeManager(exchangeConfig);

    // 2. Configure Trading Execution Service
    console.log('⚙️ Configuring Trading Execution Service...');
    const executionConfig: ExecutionConfig = {
      slippageProtection: {
        enabled: true,
        maxSlippagePercent: 2.0,
        priceCheckInterval: 5000,
        cancelOnExcessiveSlippage: true
      },
      orderOptimization: {
        enabled: true,
        iceberg: {
          enabled: true,
          chunkSize: 1000,
          minChunkSize: 100
        },
        twap: {
          enabled: true,
          duration: 300000, // 5 minutes
          intervals: 5
        }
      },
      maxRetries: 3,
      retryDelay: 1000,
      orderTimeout: 300000, // 5 minutes
      enableAuditLog: true
    };

    const executionService = new TradingExecutionService(exchangeManager, executionConfig);

    // Set up event listeners
    setupEventListeners(executionService);

    // 3. Demo Signal Execution
    console.log('\n📊 Demo 1: Signal-Based Trading Execution');
    await demoSignalExecution(executionService);

    // 4. Demo Manual Order Placement
    console.log('\n📋 Demo 2: Manual Order Placement');
    await demoManualOrderPlacement(executionService);

    // 5. Demo Order Management
    console.log('\n🔧 Demo 3: Order Management (Cancel/Modify)');
    await demoOrderManagement(executionService);

    // 6. Demo Order Optimization
    console.log('\n🎯 Demo 4: Order Optimization (Iceberg/TWAP)');
    await demoOrderOptimization(executionService);

    // 7. Demo Error Handling
    console.log('\n⚠️ Demo 5: Error Handling and Recovery');
    await demoErrorHandling(executionService);

    // 8. Show Audit Trail
    console.log('\n📝 Demo 6: Audit Trail');
    showAuditTrail(executionService);

    // 9. Show Performance Metrics
    console.log('\n📈 Demo 7: Performance Metrics');
    showPerformanceMetrics(executionService);

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await executionService.shutdown();

    console.log('\n✅ Trading Execution Engine Demo Completed Successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

function setupEventListeners(executionService: TradingExecutionService) {
  console.log('🎧 Setting up event listeners...');

  executionService.on('orderPlaced', (orderContext) => {
    console.log(`✅ Order placed: ${orderContext.orderId} for ${orderContext.originalOrder.symbol}`);
  });

  executionService.on('orderStatusChanged', (event) => {
    console.log(`🔄 Order ${event.orderId} status changed: ${event.previousStatus} → ${event.newStatus}`);
  });

  executionService.on('partialFill', (event) => {
    console.log(`📊 Partial fill: ${event.fill.quantity} @ ${event.fill.price} (Total: ${event.totalFilled})`);
  });

  executionService.on('orderCompleted', (orderContext) => {
    console.log(`🏁 Order completed: ${orderContext.orderId} - Status: ${orderContext.status}`);
  });

  executionService.on('orderCancelled', (orderContext) => {
    console.log(`❌ Order cancelled: ${orderContext.orderId}`);
  });
}

async function demoSignalExecution(executionService: TradingExecutionService) {
  console.log('Executing trading signal...');

  const signal: TradingSignal = {
    id: 'demo_signal_1',
    symbol: 'BTCUSDT',
    direction: 'long',
    confidence: 0.85,
    entryPrice: 50000,
    stopLoss: 48000,
    takeProfit: [52000, 54000, 56000],
    reasoning: {
      technical: {
        indicators: ['RSI_oversold', 'MACD_bullish_cross', 'EMA_golden_cross'],
        confluence: 0.8,
        trend: 'bullish'
      },
      patterns: {
        detected: ['hammer', 'bullish_engulfing'],
        strength: 0.75
      },
      elliottWave: {
        currentWave: 'wave3',
        wavePosition: 'impulse_up',
        validity: 0.9
      },
      fibonacci: {
        levels: [0.618, 0.786],
        confluence: 0.7
      },
      volume: {
        profile: 'increasing',
        strength: 0.8
      },
      summary: 'Strong bullish signal with multiple technical confirmations and Elliott Wave support'
    },
    timestamp: Date.now()
  };

  try {
    const result = await executionService.executeSignal(signal, 0.1);
    
    if (result.success) {
      console.log(`✅ Signal executed successfully!`);
      console.log(`   Order ID: ${result.orderId}`);
      console.log(`   Executed Quantity: ${result.executedQuantity}`);
      console.log(`   Average Price: ${result.averagePrice || 'Market'}`);
    } else {
      console.log(`❌ Signal execution failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Signal execution error:`, error);
  }
}

async function demoManualOrderPlacement(executionService: TradingExecutionService) {
  console.log('Placing manual orders...');

  const orders: OrderRequest[] = [
    {
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'limit',
      quantity: 0.05,
      price: 49500,
      exchange: 'binance',
      clientOrderId: 'demo_limit_buy',
      timeInForce: 'GTC'
    },
    {
      symbol: 'ETHUSDT',
      side: 'sell',
      type: 'market',
      quantity: 0.5,
      exchange: 'binance',
      clientOrderId: 'demo_market_sell'
    },
    {
      symbol: 'ADAUSDT',
      side: 'buy',
      type: 'stop',
      quantity: 100,
      stopPrice: 0.45,
      exchange: 'kucoin',
      clientOrderId: 'demo_stop_buy'
    }
  ];

  for (const order of orders) {
    try {
      console.log(`Placing ${order.type} ${order.side} order for ${order.symbol}...`);
      const result = await executionService.placeOrder(order);
      
      if (result.success) {
        console.log(`✅ Order placed: ${result.orderId}`);
      } else {
        console.log(`❌ Order failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Order error:`, error);
    }
  }
}

async function demoOrderManagement(executionService: TradingExecutionService) {
  console.log('Demonstrating order management...');

  // Place an order to manage
  const orderRequest: OrderRequest = {
    symbol: 'BTCUSDT',
    side: 'buy',
    type: 'limit',
    quantity: 0.1,
    price: 49000,
    exchange: 'binance',
    clientOrderId: 'demo_manage_order'
  };

  try {
    const placementResult = await executionService.placeOrder(orderRequest);
    
    if (placementResult.success && placementResult.orderId) {
      const orderId = placementResult.orderId;
      console.log(`✅ Order placed for management: ${orderId}`);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check order status
      console.log('Checking order status...');
      const status = await executionService.getOrderStatus(orderId);
      if (status) {
        console.log(`📊 Order status: ${status.status}`);
      }

      // Modify the order
      console.log('Modifying order...');
      const modifyResult = await executionService.modifyOrder(orderId, {
        quantity: 0.15,
        price: 48500
      });

      if (modifyResult.success) {
        console.log(`✅ Order modified: ${modifyResult.orderId}`);
      } else {
        console.log(`❌ Order modification failed: ${modifyResult.error}`);
      }

      // Cancel the order
      console.log('Cancelling order...');
      const cancelled = await executionService.cancelOrder(modifyResult.orderId || orderId);
      console.log(`${cancelled ? '✅' : '❌'} Order cancellation: ${cancelled ? 'Success' : 'Failed'}`);
    }
  } catch (error) {
    console.log(`❌ Order management error:`, error);
  }
}

async function demoOrderOptimization(executionService: TradingExecutionService) {
  console.log('Demonstrating order optimization...');

  // Large order for iceberg execution
  console.log('Testing Iceberg order execution...');
  const largeOrder: OrderRequest = {
    symbol: 'BTCUSDT',
    side: 'buy',
    type: 'market',
    quantity: 2500, // Large quantity to trigger iceberg
    exchange: 'binance',
    clientOrderId: 'demo_iceberg'
  };

  try {
    const result = await executionService.placeOrder(largeOrder);
    
    if (result.success) {
      console.log(`✅ Iceberg order executed: ${result.executedQuantity} BTC`);
      console.log(`   Average Price: ${result.averagePrice}`);
    } else {
      console.log(`❌ Iceberg order failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Iceberg order error:`, error);
  }

  // TWAP order would require time-based execution
  console.log('TWAP orders would execute over time intervals...');
}

async function demoErrorHandling(executionService: TradingExecutionService) {
  console.log('Demonstrating error handling...');

  // Invalid order to trigger validation error
  const invalidOrder: OrderRequest = {
    symbol: '',
    side: 'buy',
    type: 'limit',
    quantity: -1,
    exchange: 'binance'
  };

  try {
    const result = await executionService.placeOrder(invalidOrder);
    console.log(`❌ Invalid order handled: ${result.error}`);
  } catch (error) {
    console.log(`❌ Error handling test:`, error);
  }

  // Order with excessive slippage
  const slippageOrder: OrderRequest = {
    symbol: 'BTCUSDT',
    side: 'buy',
    type: 'limit',
    quantity: 0.1,
    price: 45000, // Assuming current price is much higher
    exchange: 'binance',
    clientOrderId: 'demo_slippage'
  };

  try {
    const result = await executionService.placeOrder(slippageOrder);
    if (!result.success) {
      console.log(`✅ Slippage protection worked: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Slippage test error:`, error);
  }
}

function showAuditTrail(executionService: TradingExecutionService) {
  console.log('Audit Trail (last 10 entries):');
  const auditLog = executionService.getAuditLog(10);
  
  auditLog.forEach((entry, index) => {
    const timestamp = new Date(entry.timestamp).toISOString();
    console.log(`${index + 1}. [${timestamp}] ${entry.action} - Order: ${entry.orderId || 'N/A'}`);
    if (entry.details && Object.keys(entry.details).length > 0) {
      console.log(`   Details: ${JSON.stringify(entry.details, null, 2)}`);
    }
  });
}

function showPerformanceMetrics(executionService: TradingExecutionService) {
  console.log('Performance Metrics:');
  
  const activeOrders = executionService.getActiveOrders();
  console.log(`📊 Active Orders: ${activeOrders.length}`);
  
  const auditLog = executionService.getAuditLog();
  const orderPlacedCount = auditLog.filter(entry => entry.action === 'order_placed').length;
  const orderCompletedCount = auditLog.filter(entry => entry.action === 'order_completed').length;
  const errorCount = auditLog.filter(entry => entry.action.includes('error')).length;
  
  console.log(`📈 Orders Placed: ${orderPlacedCount}`);
  console.log(`✅ Orders Completed: ${orderCompletedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  if (orderPlacedCount > 0) {
    const successRate = ((orderPlacedCount - errorCount) / orderPlacedCount * 100).toFixed(2);
    console.log(`📊 Success Rate: ${successRate}%`);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runTradingExecutionDemo().catch(console.error);
}

export { runTradingExecutionDemo };