import { TradingSignal, Position, Grid } from '../../types/trading';
import { User } from '../../types/auth';

export class MockDatabase {
  private signals: Map<string, TradingSignal> = new Map();
  private positions: Map<string, Position> = new Map();
  private grids: Map<string, Grid> = new Map();
  private users: Map<string, User> = new Map();
  private trades: Map<string, any> = new Map();

  // Signal operations
  async saveSignal(signal: TradingSignal): Promise<TradingSignal> {
    this.signals.set(signal.id, { ...signal });
    return signal;
  }

  async getSignal(id: string): Promise<TradingSignal | null> {
    return this.signals.get(id) || null;
  }

  async getSignalsByUser(userId: string): Promise<TradingSignal[]> {
    return Array.from(this.signals.values()).filter(s => s.userId === userId);
  }

  async updateSignalStatus(id: string, status: string): Promise<boolean> {
    const signal = this.signals.get(id);
    if (signal) {
      this.signals.set(id, { ...signal, status });
      return true;
    }
    return false;
  }

  async deleteSignal(id: string): Promise<boolean> {
    return this.signals.delete(id);
  }

  // Position operations
  async savePosition(position: Position): Promise<Position> {
    this.positions.set(position.id, { ...position });
    return position;
  }

  async getPosition(id: string): Promise<Position | null> {
    return this.positions.get(id) || null;
  }

  async getPositionsByUser(userId: string): Promise<Position[]> {
    return Array.from(this.positions.values()).filter(p => p.userId === userId);
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position | null> {
    const position = this.positions.get(id);
    if (position) {
      const updated = { ...position, ...updates };
      this.positions.set(id, updated);
      return updated;
    }
    return null;
  }

  async deletePosition(id: string): Promise<boolean> {
    return this.positions.delete(id);
  }

  // Grid operations
  async saveGrid(grid: Grid): Promise<Grid> {
    this.grids.set(grid.id, { ...grid });
    return grid;
  }

  async getGrid(id: string): Promise<Grid | null> {
    return this.grids.get(id) || null;
  }

  async getGridsByUser(userId: string): Promise<Grid[]> {
    return Array.from(this.grids.values()).filter(g => g.userId === userId);
  }

  async updateGrid(id: string, updates: Partial<Grid>): Promise<Grid | null> {
    const grid = this.grids.get(id);
    if (grid) {
      const updated = { ...grid, ...updates, updatedAt: Date.now() };
      this.grids.set(id, updated);
      return updated;
    }
    return null;
  }

  async deleteGrid(id: string): Promise<boolean> {
    return this.grids.delete(id);
  }

  // User operations
  async saveUser(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find(u => u.email === email) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (user) {
      const updated = { ...user, ...updates };
      this.users.set(id, updated);
      return updated;
    }
    return null;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Trade operations
  async saveTrade(trade: any): Promise<any> {
    const id = trade.id || this.generateId();
    this.trades.set(id, { ...trade, id });
    return { ...trade, id };
  }

  async getTrade(id: string): Promise<any | null> {
    return this.trades.get(id) || null;
  }

  async getTradesByUser(userId: string): Promise<any[]> {
    return Array.from(this.trades.values()).filter(t => t.userId === userId);
  }

  async getTradesBySymbol(symbol: string): Promise<any[]> {
    return Array.from(this.trades.values()).filter(t => t.symbol === symbol);
  }

  // Analytics operations
  async getPerformanceMetrics(userId: string, timeframe: string): Promise<any> {
    const userTrades = await this.getTradesByUser(userId);
    const profitableTrades = userTrades.filter(t => t.pnl > 0);
    
    return {
      totalTrades: userTrades.length,
      profitableTrades: profitableTrades.length,
      winRate: userTrades.length > 0 ? profitableTrades.length / userTrades.length : 0,
      totalPnl: userTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
      averagePnl: userTrades.length > 0 ? userTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / userTrades.length : 0,
      maxDrawdown: Math.random() * 0.2, // Mock value
      sharpeRatio: Math.random() * 2 + 0.5, // Mock value
      timeframe
    };
  }

  // Utility methods
  async clear(): Promise<void> {
    this.signals.clear();
    this.positions.clear();
    this.grids.clear();
    this.users.clear();
    this.trades.clear();
  }

  async count(table: string): Promise<number> {
    switch (table) {
      case 'signals':
        return this.signals.size;
      case 'positions':
        return this.positions.size;
      case 'grids':
        return this.grids.size;
      case 'users':
        return this.users.size;
      case 'trades':
        return this.trades.size;
      default:
        return 0;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

export class MockRedis {
  private cache: Map<string, any> = new Map();
  private expiry: Map<string, number> = new Map();

  async get(key: string): Promise<any> {
    if (this.isExpired(key)) {
      this.cache.delete(key);
      this.expiry.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.cache.set(key, value);
    if (ttl) {
      this.expiry.set(key, Date.now() + ttl * 1000);
    }
  }

  async del(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.expiry.delete(key);
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    if (this.isExpired(key)) {
      this.cache.delete(key);
      this.expiry.delete(key);
      return false;
    }
    return this.cache.has(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter(key => {
      if (this.isExpired(key)) {
        this.cache.delete(key);
        this.expiry.delete(key);
        return false;
      }
      return regex.test(key);
    });
  }

  async flushall(): Promise<void> {
    this.cache.clear();
    this.expiry.clear();
  }

  async hget(key: string, field: string): Promise<any> {
    const hash = await this.get(key);
    return hash ? hash[field] : null;
  }

  async hset(key: string, field: string, value: any): Promise<void> {
    let hash = await this.get(key) || {};
    hash[field] = value;
    await this.set(key, hash);
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const hash = await this.get(key);
    if (hash && hash[field] !== undefined) {
      delete hash[field];
      await this.set(key, hash);
      return true;
    }
    return false;
  }

  private isExpired(key: string): boolean {
    const expiryTime = this.expiry.get(key);
    return expiryTime ? Date.now() > expiryTime : false;
  }
}

export class MockMessageQueue {
  private queues: Map<string, any[]> = new Map();
  private subscribers: Map<string, ((message: any) => void)[]> = new Map();

  async publish(queue: string, message: any): Promise<void> {
    if (!this.queues.has(queue)) {
      this.queues.set(queue, []);
    }
    
    this.queues.get(queue)!.push(message);
    
    // Notify subscribers
    const subs = this.subscribers.get(queue) || [];
    subs.forEach(callback => {
      setTimeout(() => callback(message), 10); // Async delivery
    });
  }

  async subscribe(queue: string, callback: (message: any) => void): Promise<() => void> {
    if (!this.subscribers.has(queue)) {
      this.subscribers.set(queue, []);
    }
    
    this.subscribers.get(queue)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(queue) || [];
      const index = subs.indexOf(callback);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }

  async getQueueLength(queue: string): Promise<number> {
    return this.queues.get(queue)?.length || 0;
  }

  async purgeQueue(queue: string): Promise<void> {
    this.queues.set(queue, []);
  }

  async close(): Promise<void> {
    this.queues.clear();
    this.subscribers.clear();
  }
}