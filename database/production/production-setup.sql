-- Production Database Setup and Optimization
-- AI Crypto Trading Bot - Production Environment

-- ============================================================================
-- DATABASE CONFIGURATION
-- ============================================================================

-- Set production-optimized parameters
ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET effective_cache_size = '24GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET default_statistics_target = 500;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Enable query optimization
ALTER SYSTEM SET enable_partitionwise_join = on;
ALTER SYSTEM SET enable_partitionwise_aggregate = on;
ALTER SYSTEM SET jit = on;

-- Connection and security settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Reload configuration
SELECT pg_reload_conf();

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- ============================================================================
-- SCHEMAS
-- ============================================================================

-- Create application schemas
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Set search path
ALTER DATABASE trading_bot_prod SET search_path TO public, trading, analytics, audit, monitoring;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table with enhanced security
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    mfa_secret VARCHAR(255),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'locked', 'deleted')),
    failed_login_attempts INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    api_keys JSONB DEFAULT '{}',
    risk_settings JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Market data table (partitioned by time)
CREATE TABLE IF NOT EXISTS market_data (
    id BIGSERIAL,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    quote_volume DECIMAL(20,8),
    trades_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for market data (monthly partitions)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months');
    end_date DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '12 months');
    partition_date DATE;
    partition_name TEXT;
BEGIN
    partition_date := start_date;
    WHILE partition_date < end_date LOOP
        partition_name := 'market_data_' || TO_CHAR(partition_date, 'YYYY_MM');
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF market_data 
                       FOR VALUES FROM (%L) TO (%L)',
                       partition_name,
                       partition_date,
                       partition_date + INTERVAL '1 month');
        partition_date := partition_date + INTERVAL '1 month';
    END LOOP;
END $$;

-- Trading signals table
CREATE TABLE IF NOT EXISTS trading_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('long', 'short')),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    entry_price DECIMAL(20,8) NOT NULL,
    stop_loss DECIMAL(20,8),
    take_profit JSONB, -- Array of take profit levels
    reasoning JSONB NOT NULL,
    technical_indicators JSONB,
    pattern_data JSONB,
    elliott_wave_data JSONB,
    fibonacci_data JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'filled', 'cancelled', 'expired')),
    executed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trade executions table
CREATE TABLE IF NOT EXISTS trade_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID REFERENCES trading_signals(id),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop_limit')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    filled_quantity DECIMAL(20,8) DEFAULT 0,
    average_price DECIMAL(20,8),
    fee DECIMAL(20,8) DEFAULT 0,
    fee_currency VARCHAR(10),
    order_id VARCHAR(100),
    exchange_order_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'filled', 'cancelled', 'rejected')),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    filled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('long', 'short')),
    size DECIMAL(20,8) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    stop_loss DECIMAL(20,8),
    take_profit JSONB,
    margin_used DECIMAL(20,8) DEFAULT 0,
    leverage DECIMAL(5,2) DEFAULT 1.0,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'liquidated')),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Grid trading table
CREATE TABLE IF NOT EXISTS grids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    levels JSONB NOT NULL,
    base_price DECIMAL(20,8) NOT NULL,
    spacing DECIMAL(10,4) NOT NULL,
    investment_amount DECIMAL(20,8) NOT NULL,
    total_profit DECIMAL(20,8) DEFAULT 0,
    active_orders INTEGER DEFAULT 0,
    filled_orders INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Performance metrics table (time-series)
CREATE TABLE IF NOT EXISTS performance_metrics (
    id BIGSERIAL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,8) NOT NULL,
    timeframe VARCHAR(10),
    symbol VARCHAR(20),
    exchange VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for performance metrics (weekly partitions)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('week', CURRENT_DATE - INTERVAL '12 weeks');
    end_date DATE := DATE_TRUNC('week', CURRENT_DATE + INTERVAL '52 weeks');
    partition_date DATE;
    partition_name TEXT;
BEGIN
    partition_date := start_date;
    WHILE partition_date < end_date LOOP
        partition_name := 'performance_metrics_' || TO_CHAR(partition_date, 'YYYY_WW');
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF performance_metrics 
                       FOR VALUES FROM (%L) TO (%L)',
                       partition_name,
                       partition_date,
                       partition_date + INTERVAL '1 week');
        partition_date := partition_date + INTERVAL '1 week';
    END LOOP;
END $$;

-- ============================================================================
-- AUDIT TABLES
-- ============================================================================

-- Audit log table
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id UUID,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'partial')),
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(50) NOT NULL
);

-- Security events table
CREATE TABLE IF NOT EXISTS audit.security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- MONITORING TABLES
-- ============================================================================

-- System metrics table
CREATE TABLE IF NOT EXISTS monitoring.system_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,8) NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application logs table (for structured logging)
CREATE TABLE IF NOT EXISTS monitoring.application_logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    service VARCHAR(50),
    component VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status ON users(account_status) WHERE account_status != 'deleted';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- Market data indexes (applied to partition template)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_data_symbol_exchange_timeframe 
    ON market_data(symbol, exchange, timeframe, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);

-- Trading signals indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_signals_user_id ON trading_signals(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_signals_symbol ON trading_signals(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_signals_status ON trading_signals(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_signals_created_at ON trading_signals(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_signals_confidence ON trading_signals(confidence DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_signals_user_symbol_status 
    ON trading_signals(user_id, symbol, status);

-- Trade executions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_user_id ON trade_executions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_signal_id ON trade_executions(signal_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_symbol ON trade_executions(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_status ON trade_executions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_executed_at ON trade_executions(executed_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_user_symbol_date 
    ON trade_executions(user_id, symbol, executed_at DESC);

-- Positions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_user_status ON positions(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_opened_at ON positions(opened_at DESC);

-- Grid trading indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grids_user_id ON grids(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grids_symbol ON grids(symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grids_status ON grids(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grids_user_status ON grids(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grids_created_at ON grids(created_at DESC);

-- Performance metrics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_user_type 
    ON performance_metrics(user_id, metric_type, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_type_timestamp 
    ON performance_metrics(metric_type, timestamp DESC);

-- Audit log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_id ON audit.audit_log(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_action ON audit.audit_log(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_resource ON audit.audit_log(resource);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_timestamp ON audit.audit_log(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_severity ON audit.audit_log(severity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_category ON audit.audit_log(category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_timestamp 
    ON audit.audit_log(user_id, timestamp DESC);

-- Security events indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_type ON audit.security_events(event_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_severity ON audit.security_events(severity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_timestamp ON audit.security_events(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_resolved ON audit.security_events(resolved);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_user_id ON audit.security_events(user_id);

-- Monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_metrics_name_timestamp 
    ON monitoring.system_metrics(metric_name, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_application_logs_level_timestamp 
    ON monitoring.application_logs(level, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_application_logs_service_timestamp 
    ON monitoring.application_logs(service, timestamp DESC);

-- GIN indexes for JSONB columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_signals_reasoning_gin ON trading_signals USING GIN(reasoning);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_signals_technical_gin ON trading_signals USING GIN(technical_indicators);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_api_keys_gin ON users USING GIN(api_keys);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_risk_settings_gin ON users USING GIN(risk_settings);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grids_levels_gin ON grids USING GIN(levels);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_details_gin ON audit.audit_log USING GIN(details);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active trading signals view
CREATE OR REPLACE VIEW active_trading_signals AS
SELECT 
    s.*,
    u.email as user_email,
    EXTRACT(EPOCH FROM (NOW() - s.created_at)) as age_seconds
FROM trading_signals s
JOIN users u ON s.user_id = u.id
WHERE s.status IN ('pending', 'active')
AND (s.expires_at IS NULL OR s.expires_at > NOW());

-- User portfolio summary view
CREATE OR REPLACE VIEW user_portfolio_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(p.id) as open_positions,
    COALESCE(SUM(p.unrealized_pnl), 0) as total_unrealized_pnl,
    COALESCE(SUM(p.realized_pnl), 0) as total_realized_pnl,
    COALESCE(SUM(p.margin_used), 0) as total_margin_used,
    COUNT(g.id) as active_grids,
    COALESCE(SUM(g.total_profit), 0) as total_grid_profit
FROM users u
LEFT JOIN positions p ON u.id = p.user_id AND p.status = 'open'
LEFT JOIN grids g ON u.id = g.user_id AND g.status = 'active'
WHERE u.account_status = 'active'
GROUP BY u.id, u.email;

-- Trading performance view
CREATE OR REPLACE VIEW trading_performance_daily AS
SELECT 
    user_id,
    DATE(executed_at) as trade_date,
    COUNT(*) as total_trades,
    COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) as winning_trades,
    COUNT(CASE WHEN realized_pnl < 0 THEN 1 END) as losing_trades,
    COALESCE(SUM(realized_pnl), 0) as daily_pnl,
    COALESCE(AVG(realized_pnl), 0) as avg_pnl_per_trade,
    COALESCE(MAX(realized_pnl), 0) as best_trade,
    COALESCE(MIN(realized_pnl), 0) as worst_trade
FROM positions
WHERE status = 'closed' AND closed_at IS NOT NULL
GROUP BY user_id, DATE(executed_at);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trading_signals_updated_at BEFORE UPDATE ON trading_signals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grids_updated_at BEFORE UPDATE ON grids 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create market data partitions
CREATE OR REPLACE FUNCTION create_market_data_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
BEGIN
    partition_date := DATE_TRUNC('month', NEW.timestamp);
    partition_name := 'market_data_' || TO_CHAR(partition_date, 'YYYY_MM');
    
    -- Check if partition exists, create if not
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = partition_name
    ) THEN
        EXECUTE format('CREATE TABLE %I PARTITION OF market_data 
                       FOR VALUES FROM (%L) TO (%L)',
                       partition_name,
                       partition_date,
                       partition_date + INTERVAL '1 month');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic partition creation
CREATE TRIGGER create_market_data_partition_trigger
    BEFORE INSERT ON market_data
    FOR EACH ROW EXECUTE FUNCTION create_market_data_partition();

-- ============================================================================
-- SECURITY AND PERMISSIONS
-- ============================================================================

-- Create application roles
CREATE ROLE trading_bot_app;
CREATE ROLE trading_bot_readonly;
CREATE ROLE trading_bot_analytics;

-- Grant permissions to application role
GRANT CONNECT ON DATABASE trading_bot_prod TO trading_bot_app;
GRANT USAGE ON SCHEMA public, trading, analytics, audit, monitoring TO trading_bot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading_bot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA trading TO trading_bot_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO trading_bot_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA monitoring TO trading_bot_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading_bot_app;

-- Grant permissions to readonly role
GRANT CONNECT ON DATABASE trading_bot_prod TO trading_bot_readonly;
GRANT USAGE ON SCHEMA public, trading, analytics, audit, monitoring TO trading_bot_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO trading_bot_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA trading TO trading_bot_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO trading_bot_readonly;

-- Grant permissions to analytics role
GRANT CONNECT ON DATABASE trading_bot_prod TO trading_bot_analytics;
GRANT USAGE ON SCHEMA analytics, monitoring TO trading_bot_analytics;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO trading_bot_analytics;
GRANT SELECT ON ALL TABLES IN SCHEMA monitoring TO trading_bot_analytics;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO trading_bot_analytics;

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grids ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their own data)
CREATE POLICY user_isolation_policy ON users FOR ALL TO trading_bot_app USING (id = current_setting('app.current_user_id')::UUID);
CREATE POLICY user_signals_policy ON trading_signals FOR ALL TO trading_bot_app USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY user_executions_policy ON trade_executions FOR ALL TO trading_bot_app USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY user_positions_policy ON positions FOR ALL TO trading_bot_app USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY user_grids_policy ON grids FOR ALL TO trading_bot_app USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY user_metrics_policy ON performance_metrics FOR ALL TO trading_bot_app USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================================
-- MAINTENANCE PROCEDURES
-- ============================================================================

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Clean up old market data (keep 6 months)
    DELETE FROM market_data WHERE timestamp < NOW() - INTERVAL '6 months';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Clean up old performance metrics (keep 1 year)
    DELETE FROM performance_metrics WHERE timestamp < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Clean up old application logs (keep 3 months)
    DELETE FROM monitoring.application_logs WHERE timestamp < NOW() - INTERVAL '3 months';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Clean up old system metrics (keep 6 months)
    DELETE FROM monitoring.system_metrics WHERE timestamp < NOW() - INTERVAL '6 months';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL DATA AND CONFIGURATION
-- ============================================================================

-- Insert default configuration data
INSERT INTO monitoring.system_metrics (metric_name, metric_value, labels) VALUES
('database_setup_version', 1.0, '{"component": "database", "environment": "production"}'),
('last_maintenance', EXTRACT(EPOCH FROM NOW()), '{"type": "setup"}');

-- Create default admin user (password should be changed immediately)
INSERT INTO users (email, password_hash, salt, account_status, mfa_enabled) VALUES
('admin@yourdomain.com', 
 crypt('CHANGE_ME_IMMEDIATELY', gen_salt('bf', 12)), 
 gen_salt('bf', 12),
 'active', 
 true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- VACUUM AND ANALYZE
-- ============================================================================

-- Analyze all tables for query planner
ANALYZE;

-- Set up automatic vacuum and analyze
ALTER TABLE users SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE trading_signals SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE trade_executions SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE positions SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE grids SET (autovacuum_vacuum_scale_factor = 0.1);

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Production database setup completed successfully!';
    RAISE NOTICE 'Database version: %', (SELECT metric_value FROM monitoring.system_metrics WHERE metric_name = 'database_setup_version');
    RAISE NOTICE 'Setup timestamp: %', NOW();
    RAISE NOTICE 'Remember to:';
    RAISE NOTICE '1. Change the default admin password immediately';
    RAISE NOTICE '2. Configure backup procedures';
    RAISE NOTICE '3. Set up monitoring and alerting';
    RAISE NOTICE '4. Test disaster recovery procedures';
END $$;