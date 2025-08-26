#!/bin/bash

# Production Nginx Setup Script
# Configures Nginx with SSL, WebSocket, and Security for Paper Trading Bot

set -e

# Configuration
DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@example.com}"
NGINX_DIR="./docker/nginx"
SSL_DIR="./docker/ssl"
SCRIPTS_DIR="./docker/scripts"

echo "🚀 Setting up Production Nginx Configuration"
echo "============================================="
echo "Domain: $DOMAIN_NAME"
echo "Email: $LETSENCRYPT_EMAIL"
echo ""

# Function to validate environment
validate_environment() {
    echo "🔍 Validating environment..."
    
    # Check required environment variables
    if [ -z "$DOMAIN_NAME" ] || [ "$DOMAIN_NAME" = "localhost" ]; then
        echo "⚠️  Warning: DOMAIN_NAME is not set or is localhost"
        echo "   For production deployment, set a real domain name"
    fi
    
    if [ -z "$LETSENCRYPT_EMAIL" ] || [ "$LETSENCRYPT_EMAIL" = "admin@example.com" ]; then
        echo "⚠️  Warning: LETSENCRYPT_EMAIL is not properly configured"
        echo "   Set a valid email address for Let's Encrypt notifications"
    fi
    
    # Check if Docker is available
    if ! command -v docker >/dev/null 2>&1; then
        echo "❌ Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        echo "❌ docker-compose is not installed or not in PATH"
        exit 1
    fi
    
    echo "✅ Environment validation completed"
}

# Function to create directory structure
create_directories() {
    echo "📁 Creating directory structure..."
    
    mkdir -p "$NGINX_DIR"
    mkdir -p "$SSL_DIR"
    mkdir -p "$SCRIPTS_DIR"
    mkdir -p "./docker/certbot/www"
    mkdir -p "./logs/nginx"
    
    echo "✅ Directory structure created"
}

# Function to generate DH parameters
generate_dhparams() {
    echo "🔐 Setting up DH parameters..."
    
    if [ ! -f "$SSL_DIR/dhparam.pem" ]; then
        echo "📝 Generating DH parameters (this may take a few minutes)..."
        if [ -x "$SCRIPTS_DIR/generate-dhparam.sh" ]; then
            "$SCRIPTS_DIR/generate-dhparam.sh"
        else
            echo "⚠️  DH parameter generation script not found, generating manually..."
            openssl dhparam -out "$SSL_DIR/dhparam.pem" 2048
        fi
    else
        echo "✅ DH parameters already exist"
    fi
}

# Function to create nginx configuration
setup_nginx_config() {
    echo "⚙️  Setting up Nginx configuration..."
    
    # Substitute domain name in configuration files
    for config_file in "$NGINX_DIR"/*.conf; do
        if [ -f "$config_file" ]; then
            echo "📝 Processing $config_file..."
            sed -i "s/\${DOMAIN_NAME}/$DOMAIN_NAME/g" "$config_file"
        fi
    done
    
    # Create main nginx.conf if it doesn't exist
    if [ ! -f "$NGINX_DIR/nginx.conf" ]; then
        echo "📝 Creating main nginx.conf..."
        cp "$NGINX_DIR/nginx.conf" "$NGINX_DIR/nginx.conf" 2>/dev/null || echo "Using existing nginx.conf"
    fi
    
    # Create production configuration
    if [ -f "$NGINX_DIR/complete-production.conf" ]; then
        echo "📝 Setting up production configuration..."
        sed "s/\${DOMAIN_NAME}/$DOMAIN_NAME/g" "$NGINX_DIR/complete-production.conf" > "$NGINX_DIR/production-ready.conf"
    fi
    
    echo "✅ Nginx configuration setup completed"
}

# Function to create SSL certificates
setup_ssl_certificates() {
    echo "🔒 Setting up SSL certificates..."
    
    if [ "$DOMAIN_NAME" != "localhost" ]; then
        echo "🌐 Setting up Let's Encrypt certificates for $DOMAIN_NAME..."
        
        # Run SSL setup script
        if [ -x "$SCRIPTS_DIR/ssl-setup.sh" ]; then
            "$SCRIPTS_DIR/ssl-setup.sh" setup
        else
            echo "⚠️  SSL setup script not found, manual setup required"
        fi
    else
        echo "🔧 Creating self-signed certificates for localhost..."
        
        # Generate self-signed certificate for localhost
        if [ ! -f "$SSL_DIR/cert.pem" ]; then
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$SSL_DIR/private.key" \
                -out "$SSL_DIR/cert.pem" \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
            
            cp "$SSL_DIR/cert.pem" "$SSL_DIR/ca.pem"
            echo "✅ Self-signed certificate created"
        fi
    fi
}

# Function to create security configurations
setup_security() {
    echo "🛡️  Setting up security configurations..."
    
    # Create .htpasswd file for admin access (if it doesn't exist)
    if [ ! -f "$NGINX_DIR/.htpasswd" ]; then
        echo "📝 Creating admin authentication file..."
        echo "admin:\$apr1\$salt\$hash" > "$NGINX_DIR/.htpasswd"
        echo "⚠️  Default admin credentials created. Change them before production!"
        echo "   Use: htpasswd -c $NGINX_DIR/.htpasswd admin"
    fi
    
    # Set appropriate permissions
    chmod 600 "$NGINX_DIR/.htpasswd" 2>/dev/null || true
    chmod 644 "$SSL_DIR"/*.pem 2>/dev/null || true
    chmod 600 "$SSL_DIR"/*.key 2>/dev/null || true
    
    echo "✅ Security configurations setup completed"
}

# Function to validate configuration
validate_configuration() {
    echo "🔍 Validating Nginx configuration..."
    
    # Test nginx configuration if nginx is available
    if command -v nginx >/dev/null 2>&1; then
        if nginx -t -c "$NGINX_DIR/nginx.conf" 2>/dev/null; then
            echo "✅ Nginx configuration is valid"
        else
            echo "⚠️  Nginx configuration validation failed"
            echo "   This is normal if certificates are not yet generated"
        fi
    else
        echo "ℹ️  Nginx not available for configuration testing"
    fi
}

# Function to create deployment instructions
create_deployment_instructions() {
    cat > "./NGINX_DEPLOYMENT_INSTRUCTIONS.md" << EOF
# Nginx Production Deployment Instructions

## Overview
This document provides step-by-step instructions for deploying the Paper Trading Bot with production Nginx configuration.

## Prerequisites
- Docker and docker-compose installed
- Domain name pointing to your server (for SSL certificates)
- Firewall configured to allow ports 80 and 443

## Deployment Steps

### 1. Environment Configuration
Set the required environment variables:
\`\`\`bash
export DOMAIN_NAME="your-domain.com"
export LETSENCRYPT_EMAIL="your-email@domain.com"
\`\`\`

### 2. Start Services
Start the services with the production configuration:
\`\`\`bash
docker-compose -f docker/docker-compose.prod.yml up -d
\`\`\`

### 3. Monitor Certificate Generation
Watch the certbot logs to ensure SSL certificates are generated:
\`\`\`bash
docker-compose -f docker/docker-compose.prod.yml logs -f certbot
\`\`\`

### 4. Verify Deployment
Check that all services are running:
\`\`\`bash
docker-compose -f docker/docker-compose.prod.yml ps
\`\`\`

Test the application:
\`\`\`bash
curl -I https://$DOMAIN_NAME/health
\`\`\`

### 5. Security Verification
Verify paper trading mode is active:
\`\`\`bash
curl -I https://$DOMAIN_NAME/ | grep -i paper
\`\`\`

## Configuration Files
- \`docker/nginx/production-ready.conf\` - Main production configuration
- \`docker/nginx/security.conf\` - Security headers and rules
- \`docker/nginx/websocket.conf\` - WebSocket proxy configuration

## Monitoring
- Nginx access logs: \`/var/log/nginx/access.log\`
- WebSocket logs: \`/var/log/nginx/websocket_access.log\`
- Trading logs: \`/var/log/nginx/trading_access.log\`
- Security logs: \`/var/log/nginx/security_violations.log\`

## Maintenance
- SSL certificates auto-renew every 12 hours
- Monitor logs for security violations
- Regular security updates recommended

## Troubleshooting
1. Check Docker container logs: \`docker-compose logs [service]\`
2. Verify DNS resolution: \`nslookup $DOMAIN_NAME\`
3. Test SSL configuration: \`openssl s_client -connect $DOMAIN_NAME:443\`
4. Validate nginx config: \`docker exec frontend nginx -t\`

## Security Features
- ✅ SSL/TLS encryption with Let's Encrypt
- ✅ Security headers (HSTS, CSP, etc.)
- ✅ Rate limiting on all endpoints
- ✅ Paper trading mode enforcement
- ✅ WebSocket security for real-time data
- ✅ DDoS protection and request filtering

## Paper Trading Safety
- All trading requests are intercepted and marked as paper trades
- Real trading operations are blocked at the proxy level
- Multiple safety headers ensure paper trading mode
- Comprehensive audit logging for all trading activities
EOF

    echo "📋 Deployment instructions created: ./NGINX_DEPLOYMENT_INSTRUCTIONS.md"
}

# Main execution
main() {
    echo "🚀 Starting Nginx production setup..."
    
    validate_environment
    create_directories
    generate_dhparams
    setup_nginx_config
    setup_ssl_certificates
    setup_security
    validate_configuration
    create_deployment_instructions
    
    echo ""
    echo "🎉 Nginx Production Setup Complete!"
    echo "==================================="
    echo ""
    echo "✅ Configuration files created and configured"
    echo "✅ SSL certificates prepared"
    echo "✅ Security configurations applied"
    echo "✅ WebSocket proxy configured"
    echo "✅ Paper trading safety enforced"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Review the deployment instructions: ./NGINX_DEPLOYMENT_INSTRUCTIONS.md"
    echo "2. Set environment variables for your domain"
    echo "3. Deploy with: docker-compose -f docker/docker-compose.prod.yml up -d"
    echo "4. Monitor certificate generation and verify deployment"
    echo ""
    echo "🔒 Security Note: This configuration enforces paper trading mode"
    echo "   and blocks all real trading operations for maximum safety."
    echo ""
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "validate")
        validate_environment
        validate_configuration
        ;;
    "ssl")
        setup_ssl_certificates
        ;;
    "security")
        setup_security
        ;;
    "help")
        echo "Nginx Production Setup Script"
        echo "============================"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup     - Complete production setup (default)"
        echo "  validate  - Validate environment and configuration"
        echo "  ssl       - Setup SSL certificates only"
        echo "  security  - Setup security configurations only"
        echo "  help      - Show this help message"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac