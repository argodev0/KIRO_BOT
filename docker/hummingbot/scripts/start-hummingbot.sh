#!/bin/bash

# Hummingbot startup script for AI Crypto Trading Bot integration

set -e

echo "Starting Hummingbot instance: ${HUMMINGBOT_INSTANCE_ID:-unknown}"

# Create necessary directories
mkdir -p /home/hummingbot/conf
mkdir -p /home/hummingbot/logs
mkdir -p /home/hummingbot/data

# Set default environment variables
export HUMMINGBOT_INSTANCE_ID=${HUMMINGBOT_INSTANCE_ID:-hb-default}
export HUMMINGBOT_INSTANCE_NAME=${HUMMINGBOT_INSTANCE_NAME:-"Default Hummingbot Instance"}
export HUMMINGBOT_LOG_LEVEL=${HUMMINGBOT_LOG_LEVEL:-INFO}
export HUMMINGBOT_GATEWAY_ENABLED=${HUMMINGBOT_GATEWAY_ENABLED:-true}
export HUMMINGBOT_GATEWAY_PORT=${HUMMINGBOT_GATEWAY_PORT:-5000}
export PAPER_TRADING_MODE=${PAPER_TRADING_MODE:-true}

# Generate configuration files from templates
echo "Generating configuration files..."

# Global configuration
cat > /home/hummingbot/conf/conf_global.yml << EOF
# Global Configuration for ${HUMMINGBOT_INSTANCE_NAME}
instance_id: ${HUMMINGBOT_INSTANCE_ID}
log_level: ${HUMMINGBOT_LOG_LEVEL}
kill_switch_enabled: true
kill_switch_rate: -100
telegram_enabled: false
send_error_logs: false
paper_trade_enabled: ${PAPER_TRADING_MODE}
gateway_enabled: ${HUMMINGBOT_GATEWAY_ENABLED}
gateway_port: ${HUMMINGBOT_GATEWAY_PORT}

# Exchange configurations
binance_api_key: ${EXCHANGE_BINANCE_API_KEY:-""}
binance_api_secret: ${EXCHANGE_BINANCE_API_SECRET:-""}
kucoin_api_key: ${EXCHANGE_KUCOIN_API_KEY:-""}
kucoin_api_secret: ${EXCHANGE_KUCOIN_API_SECRET:-""}
kucoin_passphrase: ${EXCHANGE_KUCOIN_PASSPHRASE:-""}

# Paper trading settings
paper_trade_exchanges: ["binance", "kucoin"]
paper_trade_account_balance: 10000

# Risk management
max_order_age: 1800
order_refresh_time: 30
order_refresh_tolerance_pct: 0.2
filled_order_delay: 60

# Performance optimization
db_mode: 2
anonymized_metrics_enabled: false
EOF

# Security configuration
cat > /home/hummingbot/conf/conf_security.yml << EOF
# Security Configuration
password_verification: false
api_server_enabled: true
api_server_port: ${HUMMINGBOT_GATEWAY_PORT}
api_server_host: 0.0.0.0
api_server_auth_token: ${AUTH_TOKEN:-""}

# SSL/TLS settings
ssl_enabled: false
ssl_cert_path: ""
ssl_key_path: ""

# Rate limiting
rate_limit_enabled: true
rate_limit_per_second: 10
rate_limit_burst: 20

# CORS settings
cors_enabled: true
cors_origins: ["*"]
EOF

# Start the integration API server in the background
echo "Starting integration API server..."
cd /home/hummingbot/integration-api
python -m uvicorn main:app --host 0.0.0.0 --port ${HUMMINGBOT_GATEWAY_PORT} --log-level info &
API_PID=$!

# Wait for API server to start
sleep 5

# Function to handle shutdown
shutdown() {
    echo "Shutting down Hummingbot instance..."
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
    fi
    if [ ! -z "$HUMMINGBOT_PID" ]; then
        kill $HUMMINGBOT_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap shutdown SIGTERM SIGINT

# Start Hummingbot
echo "Starting Hummingbot core..."
cd /home/hummingbot

# Create a simple strategy configuration if none exists
if [ ! -f "/home/hummingbot/conf/pure_market_making_1.yml" ]; then
    cat > /home/hummingbot/conf/pure_market_making_1.yml << EOF
# Default Pure Market Making Strategy
template_version: 1
strategy: pure_market_making
exchange: binance_paper_trade
market: BTC-USDT
bid_spread: 0.1
ask_spread: 0.1
order_amount: 0.001
order_levels: 1
order_refresh_time: 30
order_refresh_tolerance_pct: 0.2
inventory_skew_enabled: false
filled_order_delay: 60
hanging_orders_enabled: false
order_optimization_enabled: false
add_transaction_costs_to_orders: false
price_ceiling: -1
price_floor: -1
ping_pong_enabled: false
EOF
fi

# Start Hummingbot in background mode
python /opt/conda/envs/hummingbot/bin/hummingbot --config-file-name=pure_market_making_1.yml &
HUMMINGBOT_PID=$!

echo "Hummingbot instance ${HUMMINGBOT_INSTANCE_ID} started successfully"
echo "API Server PID: $API_PID"
echo "Hummingbot PID: $HUMMINGBOT_PID"

# Keep the container running
wait $HUMMINGBOT_PID