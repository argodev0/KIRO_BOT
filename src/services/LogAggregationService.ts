import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  userId?: string;
  tradeId?: string;
  symbol?: string;
  exchange?: string;
  metadata?: any;
  tags?: string[];
}

interface LogQuery {
  level?: string;
  service?: string;
  userId?: string;
  symbol?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

interface LogAnalysis {
  errorCount: number;
  warningCount: number;
  topErrors: Array<{ message: string; count: number }>;
  serviceBreakdown: Map<string, number>;
  timelineData: Array<{ timestamp: string; count: number; level: string }>;
}

export class LogAggregationService extends EventEmitter {
  private static instance: LogAggregationService;
  private elasticClient: Client;
  private indexName: string;
  private bufferSize: number = 100;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.indexName = 'trading-bot-logs';
    
    // Initialize Elasticsearch client
    this.elasticClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      }
    });

    this.initializeIndex();
    this.startBufferFlush();
  }

  public static getInstance(): LogAggregationService {
    if (!LogAggregationService.instance) {
      LogAggregationService.instance = new LogAggregationService();
    }
    return LogAggregationService.instance;
  }

  private async initializeIndex(): Promise<void> {
    try {
      const indexExists = await this.elasticClient.indices.exists({
        index: this.indexName
      });

      if (!indexExists) {
        await this.elasticClient.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                timestamp: { type: 'date' },
                level: { type: 'keyword' },
                message: { type: 'text' },
                service: { type: 'keyword' },
                userId: { type: 'keyword' },
                tradeId: { type: 'keyword' },
                symbol: { type: 'keyword' },
                exchange: { type: 'keyword' },
                metadata: { type: 'object' },
                tags: { type: 'keyword' }
              }
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              'index.lifecycle.name': 'trading-bot-policy',
              'index.lifecycle.rollover_alias': 'trading-bot-logs'
            }
          }
        });

        logger.info(`Created Elasticsearch index: ${this.indexName}`);
      }
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch index:', error);
    }
  }

  public logEntry(entry: Omit<LogEntry, 'timestamp'>): void {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    this.logBuffer.push(logEntry);

    // Flush immediately for critical errors
    if (entry.level === 'error' || entry.level === 'critical') {
      this.flushBuffer();
    }

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  public logTradingEvent(
    level: string,
    message: string,
    metadata: {
      userId?: string;
      tradeId?: string;
      symbol?: string;
      exchange?: string;
      [key: string]: any;
    }
  ): void {
    this.logEntry({
      level,
      message,
      service: 'trading',
      userId: metadata.userId,
      tradeId: metadata.tradeId,
      symbol: metadata.symbol,
      exchange: metadata.exchange,
      metadata,
      tags: ['trading', 'execution']
    });
  }

  public logSignalEvent(
    level: string,
    message: string,
    metadata: {
      symbol?: string;
      direction?: string;
      confidence?: number;
      [key: string]: any;
    }
  ): void {
    this.logEntry({
      level,
      message,
      service: 'signal-engine',
      symbol: metadata.symbol,
      metadata,
      tags: ['signal', 'analysis']
    });
  }

  public logSystemEvent(
    level: string,
    message: string,
    service: string,
    metadata?: any
  ): void {
    this.logEntry({
      level,
      message,
      service,
      metadata,
      tags: ['system', 'monitoring']
    });
  }

  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const body = logsToFlush.flatMap(log => [
        { index: { _index: this.indexName } },
        log
      ]);

      await this.elasticClient.bulk({ body });
    } catch (error) {
      logger.error('Failed to flush logs to Elasticsearch:', error);
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  private startBufferFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // Flush every 5 seconds
  }

  public async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    try {
      const searchQuery: any = {
        bool: {
          must: []
        }
      };

      if (query.level) {
        searchQuery.bool.must.push({ term: { level: query.level } });
      }

      if (query.service) {
        searchQuery.bool.must.push({ term: { service: query.service } });
      }

      if (query.userId) {
        searchQuery.bool.must.push({ term: { userId: query.userId } });
      }

      if (query.symbol) {
        searchQuery.bool.must.push({ term: { symbol: query.symbol } });
      }

      if (query.startTime || query.endTime) {
        const timeRange: any = {};
        if (query.startTime) timeRange.gte = query.startTime;
        if (query.endTime) timeRange.lte = query.endTime;
        
        searchQuery.bool.must.push({
          range: { timestamp: timeRange }
        });
      }

      const response = await this.elasticClient.search({
        index: this.indexName,
        body: {
          query: searchQuery,
          sort: [{ timestamp: { order: 'desc' } }],
          size: query.limit || 100,
          from: query.offset || 0
        }
      });

      return response.body.hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      logger.error('Failed to query logs:', error);
      return [];
    }
  }

  public async analyzeLogs(timeRange: { start: string; end: string }): Promise<LogAnalysis> {
    try {
      const response = await this.elasticClient.search({
        index: this.indexName,
        body: {
          query: {
            range: {
              timestamp: {
                gte: timeRange.start,
                lte: timeRange.end
              }
            }
          },
          aggs: {
            error_count: {
              filter: { term: { level: 'error' } }
            },
            warning_count: {
              filter: { term: { level: 'warning' } }
            },
            top_errors: {
              filter: { term: { level: 'error' } },
              aggs: {
                messages: {
                  terms: {
                    field: 'message.keyword',
                    size: 10
                  }
                }
              }
            },
            service_breakdown: {
              terms: {
                field: 'service',
                size: 20
              }
            },
            timeline: {
              date_histogram: {
                field: 'timestamp',
                fixed_interval: '1h'
              },
              aggs: {
                levels: {
                  terms: {
                    field: 'level'
                  }
                }
              }
            }
          },
          size: 0
        }
      });

      const aggs = response.body.aggregations;
      
      const serviceBreakdown = new Map<string, number>();
      aggs.service_breakdown.buckets.forEach((bucket: any) => {
        serviceBreakdown.set(bucket.key, bucket.doc_count);
      });

      const topErrors = aggs.top_errors.messages.buckets.map((bucket: any) => ({
        message: bucket.key,
        count: bucket.doc_count
      }));

      const timelineData = aggs.timeline.buckets.flatMap((bucket: any) => 
        bucket.levels.buckets.map((levelBucket: any) => ({
          timestamp: bucket.key_as_string,
          count: levelBucket.doc_count,
          level: levelBucket.key
        }))
      );

      return {
        errorCount: aggs.error_count.doc_count,
        warningCount: aggs.warning_count.doc_count,
        topErrors,
        serviceBreakdown,
        timelineData
      };
    } catch (error) {
      logger.error('Failed to analyze logs:', error);
      return {
        errorCount: 0,
        warningCount: 0,
        topErrors: [],
        serviceBreakdown: new Map(),
        timelineData: []
      };
    }
  }

  public async searchLogs(searchTerm: string, filters?: LogQuery): Promise<LogEntry[]> {
    try {
      const searchQuery: any = {
        bool: {
          must: [
            {
              multi_match: {
                query: searchTerm,
                fields: ['message', 'metadata.*']
              }
            }
          ]
        }
      };

      // Apply filters
      if (filters) {
        if (filters.level) {
          searchQuery.bool.must.push({ term: { level: filters.level } });
        }
        if (filters.service) {
          searchQuery.bool.must.push({ term: { service: filters.service } });
        }
        if (filters.userId) {
          searchQuery.bool.must.push({ term: { userId: filters.userId } });
        }
      }

      const response = await this.elasticClient.search({
        index: this.indexName,
        body: {
          query: searchQuery,
          sort: [{ timestamp: { order: 'desc' } }],
          size: filters?.limit || 100
        }
      });

      return response.body.hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      logger.error('Failed to search logs:', error);
      return [];
    }
  }

  public async getLogStats(): Promise<any> {
    try {
      const response = await this.elasticClient.search({
        index: this.indexName,
        body: {
          aggs: {
            total_logs: {
              value_count: { field: 'timestamp' }
            },
            levels: {
              terms: { field: 'level' }
            },
            services: {
              terms: { field: 'service' }
            },
            recent_errors: {
              filter: {
                bool: {
                  must: [
                    { term: { level: 'error' } },
                    {
                      range: {
                        timestamp: {
                          gte: 'now-1h'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          size: 0
        }
      });

      return response.body.aggregations;
    } catch (error) {
      logger.error('Failed to get log stats:', error);
      return null;
    }
  }

  public stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush remaining logs
    this.flushBuffer();
  }
}