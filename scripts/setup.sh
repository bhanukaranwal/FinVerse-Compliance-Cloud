#!/bin/bash

# FinVerse Compliance Cloud Setup Script
# Last Updated: 2025-08-15 12:48:15 UTC by bhanukaranwal

set -e

echo "🚀 Setting up FinVerse Compliance Cloud..."
echo "📅 Setup Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "👤 Setup by: bhanukaranwal"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create logs directory
mkdir -p logs
echo "📁 Created logs directory"

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env 2>/dev/null || cp .env .env
    echo "📋 Environment file created"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Build shared packages
echo "🔨 Building shared packages..."
npm run build:shared

# Start infrastructure
echo "🐳 Starting infrastructure services..."
docker-compose up -d postgres redis mongodb

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
docker-compose ps

echo "✅ Setup completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Update the .env file with your API keys and configuration"
echo "2. Run 'npm run dev' to start all services"
echo "3. Visit http://localhost:4000 for the web application"
echo "4. Visit http://localhost:3000/health for API health check"
echo ""
echo "📚 Documentation: https://github.com/bhanukaranwal/finverse-compliance-cloud"
echo "🐛 Issues: https://github.com/bhanukaranwal/finverse-compliance-cloud/issues"