import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Crypto Trading Bot API',
      version: '1.0.0',
      description: `
        A comprehensive cryptocurrency trading system that combines advanced algorithmic trading capabilities with a professional web interface.
        
        ## Features
        - Advanced technical analysis and pattern recognition
        - Elliott Wave analysis and Fibonacci calculations
        - Multi-exchange connectivity (Binance, KuCoin)
        - Grid trading strategies
        - Real-time WebSocket data streaming
        - Comprehensive risk management
        - Performance analytics and reporting
        
        ## Authentication
        This API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:
        \`Authorization: Bearer <your-jwt-token>\`
        
        ## Rate Limiting
        API endpoints are rate-limited to ensure fair usage:
        - General API: 100 requests per 15 minutes
        - Authentication: 5 attempts per 15 minutes
        - Trading: 30 requests per minute
        - Password reset: 3 attempts per hour
        
        ## Error Handling
        The API returns consistent error responses with the following structure:
        \`\`\`json
        {
          "error": "ERROR_CODE",
          "message": "Human readable error message",
          "details": ["Additional error details if applicable"],
          "timestamp": "2023-01-01T00:00:00.000Z"
        }
        \`\`\`
      `,
      contact: {
        name: 'AI Crypto Trading Bot Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}/api/v1`,
        description: 'Development server'
      },
      {
        url: 'https://api.example.com/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error code'
            },
            message: {
              type: 'string',
              description: 'Human readable error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Additional error details'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            data: {
              type: 'array',
              items: {}
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer'
                },
                limit: {
                  type: 'integer'
                },
                total: {
                  type: 'integer'
                },
                totalPages: {
                  type: 'integer'
                },
                hasNext: {
                  type: 'boolean'
                },
                hasPrev: {
                  type: 'boolean'
                }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            role: {
              type: 'string',
              enum: ['USER', 'ADMIN', 'SUPER_ADMIN'],
              description: 'User role'
            },
            isVerified: {
              type: 'boolean',
              description: 'Email verification status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          }
        },
        TradingSignal: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Signal ID'
            },
            symbol: {
              type: 'string',
              description: 'Trading symbol'
            },
            direction: {
              type: 'string',
              enum: ['LONG', 'SHORT'],
              description: 'Signal direction'
            },
            confidence: {
              type: 'number',
              description: 'Signal confidence score (0-100)'
            },
            entryPrice: {
              type: 'number',
              description: 'Recommended entry price'
            },
            stopLoss: {
              type: 'number',
              description: 'Stop loss price'
            },
            takeProfit: {
              type: 'array',
              items: {
                type: 'number'
              },
              description: 'Take profit levels'
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACTIVE', 'EXECUTED', 'CANCELLED', 'EXPIRED', 'CLOSED'],
              description: 'Signal status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Signal creation timestamp'
            }
          }
        },
        Grid: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Grid ID'
            },
            symbol: {
              type: 'string',
              description: 'Trading symbol'
            },
            strategy: {
              type: 'string',
              enum: ['elliott-wave', 'fibonacci', 'standard', 'dynamic'],
              description: 'Grid strategy type'
            },
            basePrice: {
              type: 'number',
              description: 'Base price for grid calculation'
            },
            spacing: {
              type: 'number',
              description: 'Grid level spacing'
            },
            totalProfit: {
              type: 'number',
              description: 'Total profit from grid'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED', 'CLOSED', 'ERROR'],
              description: 'Grid status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Grid creation timestamp'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'UNAUTHORIZED',
                message: 'Authentication required',
                timestamp: '2023-01-01T00:00:00.000Z'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'FORBIDDEN',
                message: 'Insufficient permissions',
                timestamp: '2023-01-01T00:00:00.000Z'
              }
            }
          }
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: ['Body: email is required'],
                timestamp: '2023-01-01T00:00:00.000Z'
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      retryAfter: {
                        type: 'integer',
                        description: 'Seconds to wait before retrying'
                      }
                    }
                  }
                ]
              },
              example: {
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
                retryAfter: 900,
                timestamp: '2023-01-01T00:00:00.000Z'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Trading',
        description: 'Trading signals and order management endpoints'
      },
      {
        name: 'Grid Trading',
        description: 'Grid trading strategy management endpoints'
      },
      {
        name: 'Analytics',
        description: 'Performance analytics and reporting endpoints'
      },
      {
        name: 'Users',
        description: 'User management and settings endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);