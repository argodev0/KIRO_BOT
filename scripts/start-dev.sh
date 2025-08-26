#!/bin/bash

# AI Crypto Trading Bot Development Startup Script

echo "🚀 Starting AI Crypto Trading Bot Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    exit 1
fi

# Start infrastructure services
echo "🐳 Starting infrastructure services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
until docker-compose exec -T postgres pg_isready -U postgres; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

# Check if Redis is ready
echo "🔍 Checking Redis connection..."
until docker-compose exec -T redis redis-cli ping; do
    echo "Waiting for Redis..."
    sleep 2
done

# Check if RabbitMQ is ready
echo "🔍 Checking RabbitMQ connection..."
until docker-compose exec -T rabbitmq rabbitmq-diagnostics ping; do
    echo "Waiting for RabbitMQ..."
    sleep 2
done

echo "✅ All services are ready!"

# Generate Prisma client and run migrations
echo "🗄️  Setting up database..."
npm run db:generate
npm run migrate

echo "🎉 Development environment is ready!"
echo ""
echo "Available services:"
echo "  - API Server: http://localhost:3000"
echo "  - Health Check: http://localhost:3000/health"
echo "  - Metrics: http://localhost:3000/metrics"
echo "  - RabbitMQ Management: http://localhost:15672 (guest/guest)"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3001 (admin/admin)"
echo ""
echo "To start the development server, run: npm run dev"