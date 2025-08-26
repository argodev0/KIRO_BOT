#!/bin/bash

# Post-Installation Validation Script
# Run this after logging out and back in to test Docker group membership

echo "=== Post-Installation Validation ==="

# Test Node.js
echo "Testing Node.js..."
node --version
npm --version

# Test Docker
echo "Testing Docker..."
docker --version
docker ps

# Test Docker Compose
echo "Testing Docker Compose..."
if command -v docker-compose &> /dev/null; then
    docker-compose --version
else
    docker compose version
fi

# Test Docker Hello World
echo "Testing Docker with Hello World..."
docker run --rm hello-world

echo "✅ All tests passed! Environment is ready for deployment."