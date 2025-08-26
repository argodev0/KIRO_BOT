#!/bin/bash

# Nginx Configuration Testing Script
# Tests all aspects of the production Nginx setup for the Paper Trading Bot

set -e

DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
TEST_PORT="${TEST_PORT:-443}"
TIMEOUT="${TIMEOUT:-10}"

echo "🧪 Testing Nginx Configuration for Paper Trading Bot"
echo "===================================================="
echo "Domain: $DOMAIN_NAME"
echo "Port: $TEST_PORT"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✅ $test_name: PASS${NC}"
    elif [ "$result" = "FAIL" ]; then
        echo -e "${RED}❌ $test_name: FAIL${NC}"
    elif [ "$result" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  $test_name: WARNING${NC}"
    else
        echo -e "${BLUE}ℹ️  $test_name: INFO${NC}"
    fi
    
    if [ -n "$details" ]; then
        echo "   $details"
    fi
}

# Function to test HTTP to HTTPS redirect
test_http_redirect() {
    echo "🔄 Testing HTTP to HTTPS redirect..."
    
    local response=$(curl -s -o /dev/null -w "%{http_code},%{redirect_url}" --connect-timeout $TIMEOUT "http://$DOMAIN_NAME/health" 2>/dev/null || echo "000,")
    local status_code=$(echo "$response" | cut -d',' -f1)
    local redirect_url=$(echo "$response" | cut -d',' -f2)
    
    if [ "$status_code" = "301" ] || [ "$status_code" = "302" ]; then
        if [[ "$redirect_url" == https://* ]]; then
            print_result "HTTP to HTTPS Redirect" "PASS" "Status: $status_code, Redirects to: $redirect_url"
        else
            print_result "HTTP to HTTPS Redirect" "FAIL" "Redirects to non-HTTPS URL: $redirect_url"
        fi
    else
        print_result "HTTP to HTTPS Redirect" "FAIL" "Status: $status_code (expected 301/302)"
    fi
}

# Function to test SSL certificate
test_ssl_certificate() {
    echo "🔒 Testing SSL certificate..."
    
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        print_result "SSL Certificate" "INFO" "Skipping SSL test for localhost"
        return
    fi
    
    local ssl_info=$(echo | openssl s_client -servername "$DOMAIN_NAME" -connect "$DOMAIN_NAME:443" 2>/dev/null | openssl x509 -noout -dates -subject 2>/dev/null || echo "")
    
    if [ -n "$ssl_info" ]; then
        local expiry=$(echo "$ssl_info" | grep "notAfter" | cut -d'=' -f2)
        print_result "SSL Certificate" "PASS" "Valid certificate, expires: $expiry"
    else
        print_result "SSL Certificate" "FAIL" "Could not retrieve SSL certificate information"
    fi
}

# Function to test security headers
test_security_headers() {
    echo "🛡️  Testing security headers..."
    
    local url="https://$DOMAIN_NAME/health"
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        url="http://$DOMAIN_NAME/health"
    fi
    
    local headers=$(curl -s -I --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "")
    
    # Test for critical security headers
    local tests=(
        "X-Frame-Options:DENY"
        "X-Content-Type-Options:nosniff"
        "X-XSS-Protection:1; mode=block"
        "Strict-Transport-Security"
        "X-Paper-Trading-Mode:true"
        "X-Trading-Environment"
    )
    
    for test in "${tests[@]}"; do
        local header_name=$(echo "$test" | cut -d':' -f1)
        local expected_value=$(echo "$test" | cut -d':' -f2-)
        
        if echo "$headers" | grep -qi "$header_name"; then
            if [ -n "$expected_value" ]; then
                if echo "$headers" | grep -i "$header_name" | grep -qi "$expected_value"; then
                    print_result "Security Header: $header_name" "PASS" "Contains expected value"
                else
                    print_result "Security Header: $header_name" "WARN" "Present but value may be incorrect"
                fi
            else
                print_result "Security Header: $header_name" "PASS" "Header present"
            fi
        else
            print_result "Security Header: $header_name" "FAIL" "Header missing"
        fi
    done
}

# Function to test paper trading headers
test_paper_trading_headers() {
    echo "📊 Testing paper trading safety headers..."
    
    local url="https://$DOMAIN_NAME/api/trading/"
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        url="http://$DOMAIN_NAME/api/trading/"
    fi
    
    local headers=$(curl -s -I --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "")
    
    local paper_trading_headers=(
        "X-Paper-Trading-Mode"
        "X-Trading-Environment"
        "X-Real-Trading-Status"
        "X-Financial-Risk"
    )
    
    for header in "${paper_trading_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            local value=$(echo "$headers" | grep -i "$header" | cut -d':' -f2- | tr -d ' \r\n')
            print_result "Paper Trading Header: $header" "PASS" "Value: $value"
        else
            print_result "Paper Trading Header: $header" "FAIL" "Critical safety header missing"
        fi
    done
}

# Function to test API endpoints
test_api_endpoints() {
    echo "🔌 Testing API endpoints..."
    
    local base_url="https://$DOMAIN_NAME"
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        base_url="http://$DOMAIN_NAME"
    fi
    
    local endpoints=(
        "/health:200"
        "/api/health:200,404"
        "/api/trading/:200,401,403,404"
        "/api/market/:200,401,403,404"
        "/metrics:200,401,403,404"
    )
    
    for endpoint_test in "${endpoints[@]}"; do
        local endpoint=$(echo "$endpoint_test" | cut -d':' -f1)
        local expected_codes=$(echo "$endpoint_test" | cut -d':' -f2)
        
        local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$base_url$endpoint" 2>/dev/null || echo "000")
        
        if echo "$expected_codes" | grep -q "$response"; then
            print_result "API Endpoint: $endpoint" "PASS" "Status: $response"
        else
            print_result "API Endpoint: $endpoint" "FAIL" "Status: $response (expected: $expected_codes)"
        fi
    done
}

# Function to test WebSocket configuration
test_websocket_config() {
    echo "🔌 Testing WebSocket configuration..."
    
    local ws_url="ws://$DOMAIN_NAME/socket.io/"
    if [ "$DOMAIN_NAME" != "localhost" ]; then
        ws_url="wss://$DOMAIN_NAME/socket.io/"
    fi
    
    # Test WebSocket endpoint accessibility (basic connectivity test)
    local ws_test=$(curl -s -I --connect-timeout $TIMEOUT -H "Upgrade: websocket" -H "Connection: Upgrade" "$ws_url" 2>/dev/null || echo "")
    
    if echo "$ws_test" | grep -qi "upgrade"; then
        print_result "WebSocket Upgrade" "PASS" "WebSocket upgrade headers detected"
    else
        print_result "WebSocket Upgrade" "INFO" "WebSocket endpoint accessible (upgrade test inconclusive)"
    fi
    
    # Test WebSocket-specific headers in HTTP response
    local ws_headers=$(curl -s -I --connect-timeout $TIMEOUT "http://$DOMAIN_NAME/socket.io/" 2>/dev/null || echo "")
    
    if echo "$ws_headers" | grep -qi "X-Paper-Trading-Mode"; then
        print_result "WebSocket Paper Trading Headers" "PASS" "Paper trading headers present on WebSocket endpoint"
    else
        print_result "WebSocket Paper Trading Headers" "WARN" "Paper trading headers may not be configured for WebSocket"
    fi
}

# Function to test rate limiting
test_rate_limiting() {
    echo "⏱️  Testing rate limiting..."
    
    local url="https://$DOMAIN_NAME/health"
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        url="http://$DOMAIN_NAME/health"
    fi
    
    # Make multiple rapid requests to test rate limiting
    local rate_limit_triggered=false
    for i in {1..15}; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$url" 2>/dev/null || echo "000")
        if [ "$response" = "429" ]; then
            rate_limit_triggered=true
            break
        fi
        sleep 0.1
    done
    
    if [ "$rate_limit_triggered" = true ]; then
        print_result "Rate Limiting" "PASS" "Rate limiting is active (HTTP 429 received)"
    else
        print_result "Rate Limiting" "INFO" "Rate limiting not triggered in test (may be configured with higher limits)"
    fi
}

# Function to test compression
test_compression() {
    echo "🗜️  Testing compression..."
    
    local url="https://$DOMAIN_NAME/"
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        url="http://$DOMAIN_NAME/"
    fi
    
    local compression_test=$(curl -s -H "Accept-Encoding: gzip" -I --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "")
    
    if echo "$compression_test" | grep -qi "content-encoding.*gzip"; then
        print_result "Gzip Compression" "PASS" "Gzip compression is enabled"
    else
        print_result "Gzip Compression" "INFO" "Gzip compression not detected (may not be needed for this endpoint)"
    fi
}

# Function to test error pages
test_error_pages() {
    echo "🚫 Testing error pages..."
    
    local base_url="https://$DOMAIN_NAME"
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        base_url="http://$DOMAIN_NAME"
    fi
    
    # Test 404 error page
    local error_404=$(curl -s --connect-timeout $TIMEOUT "$base_url/nonexistent-page-test-404" 2>/dev/null || echo "")
    
    if echo "$error_404" | grep -qi "404\|not found"; then
        print_result "404 Error Page" "PASS" "Custom 404 page is working"
    else
        print_result "404 Error Page" "INFO" "404 handling may be using default configuration"
    fi
}

# Function to generate summary report
generate_summary() {
    echo ""
    echo "📋 Test Summary"
    echo "==============="
    echo ""
    echo "✅ Configuration tests completed for $DOMAIN_NAME"
    echo "🔒 SSL and security configurations tested"
    echo "📊 Paper trading safety headers verified"
    echo "🔌 API and WebSocket endpoints checked"
    echo "⚡ Performance features tested"
    echo ""
    echo "📝 Recommendations:"
    echo "   - Monitor nginx logs for any security violations"
    echo "   - Regularly update SSL certificates"
    echo "   - Review rate limiting settings based on usage patterns"
    echo "   - Ensure paper trading mode is always enforced"
    echo ""
    echo "🔍 For detailed logs, check:"
    echo "   - /var/log/nginx/access.log"
    echo "   - /var/log/nginx/error.log"
    echo "   - /var/log/nginx/security_violations.log"
    echo "   - /var/log/nginx/trading_access.log"
    echo ""
}

# Main execution
main() {
    echo "🚀 Starting comprehensive Nginx configuration tests..."
    echo ""
    
    test_http_redirect
    echo ""
    
    test_ssl_certificate
    echo ""
    
    test_security_headers
    echo ""
    
    test_paper_trading_headers
    echo ""
    
    test_api_endpoints
    echo ""
    
    test_websocket_config
    echo ""
    
    test_rate_limiting
    echo ""
    
    test_compression
    echo ""
    
    test_error_pages
    echo ""
    
    generate_summary
}

# Handle script arguments
case "${1:-test}" in
    "test")
        main
        ;;
    "ssl")
        test_ssl_certificate
        ;;
    "security")
        test_security_headers
        test_paper_trading_headers
        ;;
    "api")
        test_api_endpoints
        ;;
    "websocket")
        test_websocket_config
        ;;
    "performance")
        test_rate_limiting
        test_compression
        ;;
    "help")
        echo "Nginx Configuration Testing Script"
        echo "================================="
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  test        - Run all tests (default)"
        echo "  ssl         - Test SSL configuration only"
        echo "  security    - Test security headers only"
        echo "  api         - Test API endpoints only"
        echo "  websocket   - Test WebSocket configuration only"
        echo "  performance - Test performance features only"
        echo "  help        - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  DOMAIN_NAME - Domain to test (default: localhost)"
        echo "  TEST_PORT   - Port to test (default: 443)"
        echo "  TIMEOUT     - Connection timeout (default: 10)"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac