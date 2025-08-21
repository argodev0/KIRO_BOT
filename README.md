# AI Crypto Trading Bot & WebApp

A comprehensive cryptocurrency trading system that combines advanced algorithmic trading capabilities with a professional web interface. The system operates 24/7, analyzing market conditions across multiple exchanges and executing trades based on technical analysis, volume patterns, Elliott Wave theory, Fibonacci analysis, and candlestick pattern recognition.

## 🚀 Current Implementation Status

**24 out of 24 major tasks completed** - The system is production-ready with comprehensive deployment infrastructure, security hardening, performance analytics, monitoring systems, and complete final integration testing suite.

### ✅ Completed Features

- **🏗️ Core Infrastructure**: Node.js/TypeScript, Docker containers, database setup, monitoring
- **📊 Data Models & Validation**: Complete TypeScript interfaces, Prisma ORM, validation schemas
- **🔗 Exchange Connectivity**: Binance & KuCoin APIs, WebSocket streams, data normalization
- **📈 Market Data Pipeline**: Real-time ingestion, Redis caching, multi-timeframe aggregation
- **🔍 Technical Analysis Engine**: RSI, Wave Trend, PVT, support/resistance, market regime classification
- **🕯️ Pattern Recognition**: Candlestick patterns (Doji, Hammer, Engulfing, etc.) with strength scoring
- **🌊 Elliott Wave Analysis**: Wave structure identification, Fibonacci relationships, invalidation rules
- **📐 Fibonacci Analysis**: Retracement/extension levels, confluence detection, time-based analysis
- **🎯 Signal Generation**: Multi-dimensional scoring, confidence calculation, signal validation
- **⚠️ Risk Management**: Position sizing, risk limits, drawdown monitoring, emergency shutdown
- **⚡ Trading Execution**: Order placement, status monitoring, slippage protection
- **🔲 Grid Trading**: Elliott Wave & Fibonacci-based grids, dynamic adjustment
- **🔌 WebSocket Server**: Real-time data distribution, authentication, rate limiting
- **🛡️ REST API & Auth**: JWT authentication, MFA, role-based access, rate limiting
- **⚛️ React Frontend**: TypeScript, Material-UI, Redux Toolkit, responsive design
- **📱 Trading Dashboard**: TradingView charts, real-time data, portfolio overview, trade history
- **📊 Advanced Charting**: Pattern overlays, multi-timeframe sync, custom drawing tools
- **⚙️ Bot Configuration Interface**: Complete configuration management, strategy settings, risk controls, bot control panel
- **📈 Performance Analytics**: Comprehensive trade tracking, metrics calculation, and reporting system
- **🔍 Monitoring & Alerting**: Full observability with Prometheus, Grafana, and automated alerting
- **🔒 Security Hardening**: Enterprise-grade security with audit systems and threat detection
- **🧪 Testing & QA**: 80%+ test coverage with automated CI/CD pipeline
- **🚀 Production Deployment**: Production-ready Kubernetes infrastructure with disaster recovery

### ✅ Final Phase (Completed)

- **✅ Final Integration**: Comprehensive end-to-end testing, load testing, system validation, and production readiness verification

## Features

- **Advanced Technical Analysis**: RSI, Wave Trends, Price Volume Trends, Elliott Wave analysis, Fibonacci retracements and extensions
- **Candlestick Pattern Recognition**: 15+ patterns with strength scoring and multi-timeframe validation
- **Multi-Exchange Support**: Binance and KuCoin integration with real-time WebSocket data feeds
- **Grid Trading Strategies**: Elliott Wave-based and Fibonacci-based grid trading with dynamic adjustment
- **Risk Management**: Comprehensive risk controls with position sizing and drawdown protection
- **Real-time Dashboard**: Professional web interface with TradingView charts and responsive design
- **Bot Configuration Interface**: Comprehensive configuration management with real-time validation and bot control
- **WebSocket Integration**: Real-time data streaming for prices, signals, trades, and notifications
- **Security**: Multi-factor authentication, JWT tokens, encrypted API keys, role-based access

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with comprehensive middleware
- **Database**: PostgreSQL 15 with Prisma ORM
- **Cache**: Redis 7 for high-performance data caching
- **Message Queue**: RabbitMQ 3 for reliable message processing
- **Monitoring**: Prometheus + Grafana for metrics and dashboards
- **WebSocket**: Socket.io for real-time communication
- **Security**: JWT authentication, bcrypt hashing, helmet security headers

### Frontend
- **Framework**: React 18 with TypeScript and strict mode
- **State Management**: Redux Toolkit with RTK Query
- **UI Library**: Material-UI v7 with custom theming
- **Charts**: TradingView Charting Library for professional trading charts
- **Real-time**: Socket.io client for live data updates
- **Build Tool**: Vite for fast development and optimized builds
- **Testing**: Jest + React Testing Library for comprehensive testing

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-crypto-trading-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start infrastructure services**
   ```bash
   docker-compose up -d
   ```

5. **Set up the database**
   ```bash
   npm run db:generate
   npm run migrate
   ```

6. **Start the development servers**
   ```bash
   # Start backend server
   npm run dev
   
   # In a separate terminal, start frontend
   npm run dev:frontend
   ```

The application will be available at:
- **Frontend**: http://localhost:3001 (React development server)
- **API**: http://localhost:3000 (Express.js backend)
- **API Documentation**: http://localhost:3000/api/docs (Swagger UI)
- **Health Check**: http://localhost:3000/health
- **WebSocket Stats**: http://localhost:3000/api/v1/websocket/stats
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

## Project Structure

```
src/
├── config/              # Configuration files and Swagger setup
├── controllers/         # API route controllers (Auth, Trading, Analytics, etc.)
├── middleware/          # Express middleware (auth, validation, rate limiting)
├── models/              # Data models and database interfaces
├── routes/              # API route definitions
├── services/            # Business logic services
│   ├── exchanges/       # Exchange connectors (Binance, KuCoin)
│   └── indicators/      # Technical analysis indicators
├── frontend/            # React frontend application
│   ├── components/      # React components (charts, dashboard, auth)
│   ├── pages/           # Page components
│   ├── store/           # Redux store and slices
│   ├── hooks/           # Custom React hooks
│   └── services/        # Frontend API services
├── types/               # TypeScript type definitions
├── utils/               # Utility functions (logger, metrics)
├── validation/          # Input validation schemas
└── __tests__/           # Test files and setup

database/                # Database initialization scripts
├── init/                # PostgreSQL initialization

monitoring/              # Monitoring configuration
├── prometheus.yml       # Prometheus config
└── grafana/             # Grafana dashboards and provisioning

prisma/                  # Database schema and migrations
└── schema.prisma        # Prisma schema definition

public/                  # Static frontend assets
├── index.html           # Main HTML template
└── tradingview-chart.css # TradingView chart styling

scripts/                 # Development and deployment scripts
├── start-dev.sh         # Development startup script
└── validate-setup.js    # Environment validation
```

## Development

### Available Scripts

#### Development
- `npm run dev` - Start backend development server with hot reload
- `npm run dev:frontend` - Start frontend development server (Vite)
- `npm run build` - Build both backend and frontend for production
- `npm run build:backend` - Build only backend TypeScript
- `npm run build:frontend` - Build only frontend React app
- `npm run start` - Start production server

#### Testing
- `npm run test` - Run all tests (backend + frontend)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:frontend` - Run only frontend tests
- `npm run test:integration` - Run integration tests
- `npm run lint` - Run ESLint on all TypeScript/React files
- `npm run lint:fix` - Fix ESLint issues automatically

#### Final Integration Testing
- `node scripts/run-integration-tests.js` - Run comprehensive E2E test suite
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:load` - Run load testing scenarios
- `npm run test:security` - Run security audit tests

#### Database
- `npm run db:generate` - Generate Prisma client
- `npm run migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio for database management

### Testing

The system includes a comprehensive testing suite with 80%+ coverage:

### Test Categories
- **Unit Tests**: Individual component testing with mocks and stubs
- **Integration Tests**: API endpoint and service integration testing
- **End-to-End Tests**: Complete workflow testing from UI to database
- **Load Tests**: Performance testing under realistic market conditions
- **Security Tests**: Penetration testing and vulnerability assessment
- **User Acceptance Tests**: Real-world trading scenario validation

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run integration test suite
npm run test:integration

# Run end-to-end test suite
node scripts/run-integration-tests.js

# Run specific test categories
npm test -- --testPathPattern=e2e
npm test -- --testPathPattern=security
npm test -- --testPathPattern=performance
```

### Test Results
The final integration testing suite validates:
- ✅ Complete trading workflows (market data → signals → execution)
- ✅ Risk management controls and emergency procedures
- ✅ System recovery and failover scenarios
- ✅ Load testing with 50+ concurrent users and 1000+ requests
- ✅ Security audit with penetration testing
- ✅ User acceptance testing with realistic scenarios

### Database Management

```bash
# Generate Prisma client
npm run db:generate

# Create and run migrations
npm run migrate

# Open Prisma Studio
npm run db:studio
```

## Configuration

### Environment Variables

Key environment variables (see `.env.example` for complete list):

#### Core Configuration
- `NODE_ENV` - Environment (development/production)
- `PORT` - Backend server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis server host
- `RABBITMQ_URL` - RabbitMQ connection string

#### Security
- `JWT_SECRET` - JWT signing secret (change in production!)
- `JWT_EXPIRES_IN` - JWT token expiration (default: 24h)
- `BCRYPT_ROUNDS` - Password hashing rounds (default: 12)

#### Exchange APIs
- `BINANCE_API_KEY` - Binance API key
- `BINANCE_API_SECRET` - Binance API secret
- `BINANCE_SANDBOX` - Use Binance testnet (true/false)
- `KUCOIN_API_KEY` - KuCoin API key
- `KUCOIN_API_SECRET` - KuCoin API secret
- `KUCOIN_PASSPHRASE` - KuCoin API passphrase
- `KUCOIN_SANDBOX` - Use KuCoin sandbox (true/false)

#### Frontend
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3001)

### Exchange API Setup

1. **Binance**:
   - Create API key at https://www.binance.com/en/my/settings/api-management
   - Enable spot trading permissions
   - Set IP restrictions for security

2. **KuCoin**:
   - Create API key at https://www.kucoin.com/account/api
   - Enable trading permissions
   - Note the passphrase for configuration

## Monitoring & Observability

### Prometheus Metrics

The application exposes comprehensive metrics at `/metrics` endpoint:
- **HTTP Metrics**: Request duration, status codes, throughput
- **WebSocket Metrics**: Connection count, message rates, errors
- **Trading Metrics**: Signal generation, execution rates, P&L tracking
- **System Metrics**: Memory usage, CPU utilization, database connections
- **Business Metrics**: Active strategies, risk exposure, performance indicators

### Grafana Dashboards

Pre-configured dashboards available at http://localhost:3001:
- **Application Performance**: Response times, error rates, throughput
- **Trading Analytics**: Signal accuracy, execution performance, P&L trends
- **System Health**: Resource utilization, connection status, error tracking
- **WebSocket Monitoring**: Real-time connection metrics, message flow
- **Exchange Connectivity**: API response times, rate limit usage, connection health

### Structured Logging

Winston-based logging system with:
- **Console Output**: Colorized logs for development
- **File Rotation**: Daily log files with automatic cleanup
- **Log Levels**: Error, warn, info, debug with configurable filtering
- **Request Logging**: Detailed HTTP request/response logging
- **Error Tracking**: Comprehensive error context and stack traces

### Health Checks

Multiple health check endpoints:
- `/health` - Basic application health
- `/api/v1/websocket/stats` - WebSocket server statistics
- Database connection monitoring
- Exchange API connectivity status

## Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure authentication with automatic refresh
- **Multi-Factor Authentication**: TOTP-based 2FA support
- **Role-Based Access Control**: User, admin, and super admin roles
- **Session Management**: Secure token storage and cleanup
- **Password Security**: bcrypt hashing with configurable rounds

### API Security
- **Rate Limiting**: Configurable limits per endpoint and user
- **Input Validation**: Comprehensive Joi-based validation schemas
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js for security header management
- **Request Sanitization**: XSS and injection attack prevention

### Data Protection
- **API Key Encryption**: Exchange API keys encrypted at rest
- **Audit Logging**: Comprehensive logging of all user actions
- **TLS Encryption**: HTTPS for all data transmission
- **Database Security**: Parameterized queries, connection encryption
- **WebSocket Security**: Authenticated connections, rate limiting

### Infrastructure Security
- **Docker Isolation**: Containerized services with network isolation
- **Environment Variables**: Secure configuration management
- **Health Monitoring**: Automated security monitoring and alerting
- **Backup Security**: Encrypted database backups and recovery

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📚 Documentation

### API Documentation
- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI Spec**: http://localhost:3000/api/docs.json
- **WebSocket Events**: See `WEBSOCKET_IMPLEMENTATION.md`

### Implementation Guides
- **Bot Configuration**: `BOT_CONFIGURATION_SUMMARY.md`
- **Dashboard Implementation**: `DASHBOARD_IMPLEMENTATION_SUMMARY.md`
- **Exchange Connectivity**: `EXCHANGE_CONNECTIVITY_SUMMARY.md`
- **Frontend Architecture**: `FRONTEND_IMPLEMENTATION_SUMMARY.md`
- **Technical Analysis**: `TECHNICAL_ANALYSIS_SUMMARY.md`
- **WebSocket Server**: `WEBSOCKET_IMPLEMENTATION.md`
- **Project Status**: `PROJECT_STATUS_SUMMARY.md`
- **Final Integration Testing**: `FINAL_INTEGRATION_TESTING_SUMMARY.md`

### Development Resources
- **Task Tracking**: `.kiro/specs/ai-crypto-trading-bot/tasks.md`
- **Requirements**: `.kiro/specs/ai-crypto-trading-bot/requirements.md`
- **Design Document**: `.kiro/specs/ai-crypto-trading-bot/design.md`

## 🆘 Support & Troubleshooting

### Getting Help
- **Issues**: Create an issue in the repository with detailed information
- **Documentation**: Check the comprehensive documentation files
- **Logs**: Review application logs for error details
- **Health Checks**: Use `/health` endpoint for system status

### Common Issues
1. **Database Connection**: Ensure PostgreSQL is running via Docker
2. **Redis Connection**: Verify Redis container is healthy
3. **Exchange APIs**: Check API keys and network connectivity
4. **WebSocket Issues**: Verify JWT tokens and connection limits
5. **Frontend Build**: Ensure all dependencies are installed

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev

# Check WebSocket connections
curl http://localhost:3000/api/v1/websocket/stats

# Verify database connection
npm run db:studio
```

## Implementation Roadmap

### ✅ Phase 1: Core Infrastructure (Completed)
- [x] Project foundation and Docker setup
- [x] Database models and validation
- [x] Exchange connectivity (Binance, KuCoin)
- [x] Market data pipeline with Redis caching
- [x] WebSocket server for real-time communication

### ✅ Phase 2: Analysis Engine (Completed)
- [x] Technical analysis indicators (RSI, Wave Trend, PVT)
- [x] Candlestick pattern recognition (15+ patterns)
- [x] Elliott Wave analysis with Fibonacci relationships
- [x] Support/resistance detection and confluence analysis
- [x] Multi-dimensional signal generation engine

### ✅ Phase 3: Trading System (Completed)
- [x] Risk management with position sizing
- [x] Trading execution engine with slippage protection
- [x] Grid trading strategies (Elliott Wave & Fibonacci based)
- [x] JWT authentication with MFA support
- [x] REST API with comprehensive endpoints

### ✅ Phase 4: Frontend Interface (Completed)
- [x] React 18 with TypeScript and Material-UI
- [x] Professional trading dashboard with TradingView charts
- [x] Real-time data integration via WebSocket
- [x] Advanced charting with pattern overlays
- [x] Responsive design for mobile/tablet/desktop
- [x] Bot configuration and control interface

### ✅ Phase 5: Analytics & Monitoring (Completed)
- [x] Performance analytics and reporting system
- [x] Advanced monitoring and alerting with Prometheus/Grafana
- [x] Security hardening and comprehensive audit systems

### ✅ Phase 6: Production Deployment (Completed)
- [x] Comprehensive testing and QA with 80%+ coverage
- [x] Kubernetes deployment manifests with auto-scaling
- [x] CI/CD pipeline with automated testing and deployment
- [x] Database backup and disaster recovery procedures

### ✅ Phase 7: Final Validation (Completed)
- [x] End-to-end integration testing with comprehensive workflow validation
- [x] Production load testing and performance optimization
- [x] User acceptance testing with realistic trading scenarios
- [x] Security audit and penetration testing
- [x] System recovery and failover testing

### 🔮 Future Enhancements
- [ ] Machine learning signal enhancement
- [ ] Additional exchange integrations (Coinbase, Kraken)
- [ ] Mobile application (React Native)
- [ ] Advanced portfolio optimization algorithms
- [ ] Social trading and copy trading features
- [ ] Comprehensive backtesting engine with historical data
- [ ] Advanced order types (OCO, trailing stops)
- [ ] Multi-account management
- [ ] API for third-party integrations