# Production Deployment Setup Guide

This guide walks you through setting up the AI Crypto Trading Bot for production deployment with paper trading safety enforcement.

## 🚨 CRITICAL SAFETY NOTICE

**This system is designed for PAPER TRADING ONLY in production. All trades are simulated with virtual balances. No real money will ever be at risk.**

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Docker and Docker Compose installed
- Domain name pointing to your server
- Email address for SSL certificates
- READ-ONLY API keys from exchanges

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd KIRO_BOT
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.production.template .env.production
   # Edit .env.production with your settings
   ```

3. **Validate Configuration**
   ```bash
   npm run validate:production
   ```

4. **Deploy**
   ```bash
   npm run deploy:production
   ```

## Detailed Setup Instructions

### 1. Server Preparation

#### Install Docker
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

#### Configure Firewall
```bash
# Install UFW
sudo apt install ufw -y

# Configure firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Domain and DNS Setup

1. **Purchase a domain** from a registrar
2. **Configure DNS** to point to your server's IP address:
   ```
   A record: your-domain.com -> YOUR_SERVER_IP
   ```
3. **Wait for DNS propagation** (can take up to 24 hours)

### 3. Environment Configuration

#### Copy Template
```bash
cp .env.production.template .env.production
```

#### Configure Critical Settings

**Paper Trading Safety (REQUIRED)**
```bash
PAPER_TRADING_MODE=true
ALLOW_REAL_TRADES=false
FORCE_PAPER_TRADING=true
PAPER_TRADING_VALIDATION=strict
```

**Domain and SSL (REQUIRED)**
```bash
DOMAIN_NAME=your-domain.com
LETSENCRYPT_EMAIL=your-email@example.com
```

**Security (REQUIRED)**
```bash
# Generate strong passwords
JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
ENCRYPTION_KEY=$(openssl rand -base64 32)
```

**Exchange APIs (REQUIRED - READ-ONLY KEYS ONLY)**
```bash
# Binance (READ-ONLY)
BINANCE_API_KEY=your-binance-read-only-key
BINANCE_API_SECRET=your-binance-read-only-secret
BINANCE_READ_ONLY=true

# KuCoin (READ-ONLY)
KUCOIN_API_KEY=your-kucoin-read-only-key
KUCOIN_API_SECRET=your-kucoin-read-only-secret
KUCOIN_PASSPHRASE=your-kucoin-passphrase
KUCOIN_READ_ONLY=true
```

### 4. Exchange API Key Setup

#### Binance API Key Setup
1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Create a new API key
3. **IMPORTANT**: Only enable "Read Info" permission
4. **DO NOT** enable "Enable Trading" or "Enable Withdrawals"
5. Add your server IP to the IP whitelist

#### KuCoin API Key Setup
1. Go to [KuCoin API Management](https://www.kucoin.com/account/api)
2. Create a new API key
3. **IMPORTANT**: Only select "General" permission
4. **DO NOT** select "Trade" or "Transfer" permissions
5. Add your server IP to the IP whitelist

### 5. Validation and Testing

#### Validate Configuration
```bash
# Full validation
npm run validate:production

# Individual validations
npm run validate:config
npm run validate:docker
```

#### Run Tests
```bash
# All tests
npm test

# Paper trading safety tests
npm run test:security
```

### 6. SSL Certificate Setup

#### Automatic Setup (Recommended)
```bash
npm run ssl:setup
```

#### Manual Setup
```bash
# Generate self-signed certificate for testing
./docker/scripts/ssl-setup.sh self-signed

# Setup Let's Encrypt for production
./docker/scripts/ssl-setup.sh setup
```

### 7. Production Deployment

#### Full Deployment
```bash
npm run deploy:production
```

#### Step-by-Step Deployment
```bash
# Validate only
npm run deploy:validate

# Build images only
npm run deploy:build

# Deploy services
docker-compose -f docker/docker-compose.prod.yml up -d
```

### 8. Post-Deployment Verification

#### Check Service Status
```bash
npm run production:status
```

#### View Logs
```bash
npm run production:logs
```

#### Health Checks
```bash
# Frontend health
curl https://your-domain.com/health

# Backend health
curl https://your-domain.com/api/health

# Paper trading mode verification
curl https://your-domain.com/api/config/trading-mode
```

#### Access Monitoring
- **Grafana Dashboard**: `https://your-domain.com:3001` (admin/admin)
- **Prometheus Metrics**: `https://your-domain.com:9090`

## Maintenance

### SSL Certificate Renewal
Certificates are automatically renewed. To manually renew:
```bash
npm run ssl:renew
```

### System Updates
```bash
# Pull latest changes
git pull

# Rebuild and redeploy
npm run deploy:production
```

### Backup Management
```bash
# Manual backup
docker-compose -f docker/docker-compose.prod.yml exec postgres pg_dump -U postgres trading_bot > backup.sql

# Restore backup
docker-compose -f docker/docker-compose.prod.yml exec -T postgres psql -U postgres trading_bot < backup.sql
```

### Log Management
```bash
# View specific service logs
docker-compose -f docker/docker-compose.prod.yml logs backend
docker-compose -f docker/docker-compose.prod.yml logs frontend

# Follow logs in real-time
npm run production:logs
```

## Troubleshooting

### Common Issues

#### SSL Certificate Issues
```bash
# Check certificate status
./docker/scripts/ssl-setup.sh check-expiry

# Force certificate renewal
./docker/scripts/ssl-renew.sh force
```

#### Service Health Issues
```bash
# Check service status
npm run production:status

# Restart specific service
docker-compose -f docker/docker-compose.prod.yml restart backend

# Restart all services
npm run production:restart
```

#### Configuration Issues
```bash
# Re-validate configuration
npm run validate:production

# Check environment variables
docker-compose -f docker/docker-compose.prod.yml exec backend env | grep PAPER_TRADING
```

### Paper Trading Safety Verification

#### Verify Paper Trading Mode
```bash
# Check configuration
curl https://your-domain.com/api/config/trading-mode

# Should return: {"mode": "paper_trading", "real_trades_allowed": false}
```

#### Check API Key Permissions
```bash
# Verify read-only status
curl https://your-domain.com/api/exchanges/permissions

# Should show all keys as read-only
```

### Performance Monitoring

#### System Resources
```bash
# Check Docker resource usage
docker stats

# Check disk space
df -h

# Check memory usage
free -h
```

#### Application Metrics
- Monitor Grafana dashboards at `https://your-domain.com:3001`
- Check Prometheus metrics at `https://your-domain.com:9090`

## Security Best Practices

1. **Regular Updates**
   - Keep the system updated with security patches
   - Regularly update Docker images
   - Monitor for security advisories

2. **Access Control**
   - Use strong passwords for all services
   - Regularly rotate API keys and passwords
   - Monitor access logs for suspicious activity

3. **Backup Strategy**
   - Automated daily backups are configured
   - Test backup restoration procedures regularly
   - Store backups in multiple locations

4. **Monitoring**
   - Set up alerts for critical system events
   - Monitor logs for security events
   - Regular health checks

## Support and Documentation

- **System Documentation**: `docs/SYSTEM_DOCUMENTATION.md`
- **User Guide**: `docs/USER_GUIDE.md`
- **Deployment Guide**: `docs/deployment/PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Runbooks**: `docs/deployment/runbooks.md`

## Emergency Procedures

### System Down
1. Check service status: `npm run production:status`
2. Check logs: `npm run production:logs`
3. Restart services: `npm run production:restart`
4. If issues persist, check `docs/deployment/ROLLBACK_PROCEDURES.md`

### Security Incident
1. Immediately stop services: `npm run production:stop`
2. Check logs for security events
3. Rotate all API keys and passwords
4. Review and update security configuration
5. Restart with updated configuration

### Data Recovery
1. Stop services: `npm run production:stop`
2. Restore from backup (see backup procedures above)
3. Verify data integrity
4. Restart services: `npm run production:start`

---

**Remember: This system is designed for paper trading only. All trades are simulated and no real money is at risk.**