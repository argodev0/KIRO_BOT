import { OrderRequest, OrderResponse, OrderStatus } from '../../types/trading';
import { TickerData, OrderBookData, CandleData } from '../../types/market';
import { MarketDataFactory } from '../factories/MarketDataFactory';

export class MockBinanceExchange {
  private orders: Map<string, OrderResponse> = new Map();
  private orderCounter = 1;

  async getOrderBook(symbol: string): Promise<OrderBookData> {
    return MarketDataFactory.createOrderBook(symbol);
  }

  async getTicker(symbol: string): Promise<TickerData> {
    return MarketDataFactory.createTicker(symbol);
  }

  async getCandles(symbol: string, interval: string, limit: number = 100): Promise<CandleData[]> {
    return MarketDataFactory.createCandles({
      symbol,
      timeframe: interval,
      count: limit
    });
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    const orderId = `BINANCE_${this.orderCounter++}`;
    const response: OrderResponse = {
      orderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      status: 'NEW',
      timestamp: Date.now(),
      exchange: 'binance'
    };

    this.orders.set(orderId, response);

    // Simulate order processing
    setTimeout(() => {
      const updatedOrder = { ...response, status: 'FILLED' as OrderStatus };
      this.orders.set(orderId, updatedOrder);
    }, Math.random() * 1000 + 500); // 0.5-1.5s delay

    return response;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (order && order.status === 'NEW') {
      this.orders.set(orderId, { ...order, status: 'CANCELED' });
      return true;
    }
    return false;
  }

  async getOrderStatus(orderId: string): Promise<OrderResponse | null> {
    return this.orders.get(orderId) || null;
  }

  async getAccountBalance(): Promise<{ [asset: string]: number }> {
    return {
      USDT: 10000 + Math.random() * 90000,
      BTC: Math.random() * 5,
      ETH: Math.random() * 50,
      ADA: Math.random() * 10000
    };
  }

  // Simulate WebSocket connection
  subscribeToTicker(symbol: string, callback: (data: TickerData) => void): () => void {
    const interval = setInterval(() => {
      callback(MarketDataFactory.createTicker(symbol));
    }, 1000);

    return () => clearInterval(interval);
  }

  subscribeToOrderBook(symbol: string, callback: (data: OrderBookData) => void): () => void {
    const interval = setInterval(() => {
      callback(MarketDataFactory.createOrderBook(symbol));
    }, 500);

    return () => clearInterval(interval);
  }
}

export class MockKuCoinExchange {
  private orders: Map<string, OrderResponse> = new Map();
  private orderCounter = 1;

  async getOrderBook(symbol: string): Promise<OrderBookData> {
    const data = MarketDataFactory.createOrderBook(symbol);
    return { ...data, exchange: 'kucoin' };
  }

  async getTicker(symbol: string): Promise<TickerData> {
    const data = MarketDataFactory.createTicker(symbol);
    return { ...data, exchange: 'kucoin' };
  }

  async getCandles(symbol: string, interval: string, limit: number = 100): Promise<CandleData[]> {
    return MarketDataFactory.createCandles({
      symbol,
      timeframe: interval,
      count: limit
    });
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    const orderId = `KUCOIN_${this.orderCounter++}`;
    const response: OrderResponse = {
      orderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      status: 'NEW',
      timestamp: Date.now(),
      exchange: 'kucoin'
    };

    this.orders.set(orderId, response);

    // Simulate order processing with slightly different timing
    setTimeout(() => {
      const updatedOrder = { ...response, status: 'FILLED' as OrderStatus };
      this.orders.set(orderId, updatedOrder);
    }, Math.random() * 1500 + 800); // 0.8-2.3s delay

    return response;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (order && order.status === 'NEW') {
      this.orders.set(orderId, { ...order, status: 'CANCELED' });
      return true;
    }
    return false;
  }

  async getOrderStatus(orderId: string): Promise<OrderResponse | null> {
    return this.orders.get(orderId) || null;
  }

  async getAccountBalance(): Promise<{ [asset: string]: number }> {
    return {
      USDT: 5000 + Math.random() * 45000,
      BTC: Math.random() * 2,
      ETH: Math.random() * 25,
      DOT: Math.random() * 1000
    };
  }
}

export class MockExchangeManager {
  private binance = new MockBinanceExchange();
  private kucoin = new MockKuCoinExchange();

  getExchange(name: string) {
    switch (name.toLowerCase()) {
      case 'binance':
        return this.binance;
      case 'kucoin':
        return this.kucoin;
      default:
        throw new Error(`Unknown exchange: ${name}`);
    }
  }

  async getBestPrice(symbol: string, side: 'buy' | 'sell'): Promise<{ exchange: string; price: number }> {
    const binanceTicker = await this.binance.getTicker(symbol);
    const kucoinTicker = await this.kucoin.getTicker(symbol);

    if (side === 'buy') {
      // Best ask price (lowest)
      return binanceTicker.ask < kucoinTicker.ask
        ? { exchange: 'binance', price: binanceTicker.ask }
        : { exchange: 'kucoin', price: kucoinTicker.ask };
    } else {
      // Best bid price (highest)
      return binanceTicker.bid > kucoinTicker.bid
        ? { exchange: 'binance', price: binanceTicker.bid }
        : { exchange: 'kucoin', price: kucoinTicker.bid };
    }
  }

  async getAggregatedOrderBook(symbol: string): Promise<OrderBookData> {
    const binanceBook = await this.binance.getOrderBook(symbol);
    const kucoinBook = await this.kucoin.getOrderBook(symbol);

    // Merge order books (simplified)
    const allBids = [...binanceBook.bids, ...kucoinBook.bids]
      .sort((a, b) => b[0] - a[0]) // Sort by price descending
      .slice(0, 20);

    const allAsks = [...binanceBook.asks, ...kucoinBook.asks]
      .sort((a, b) => a[0] - b[0]) // Sort by price ascending
      .slice(0, 20);

    return {
      symbol,
      exchange: 'aggregated',
      timestamp: Date.now(),
      bids: allBids,
      asks: allAsks
    };
  }
}