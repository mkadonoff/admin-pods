#!/bin/bash
# Setup script for admin-pods development environment
# This script automates the initial setup of both API and Web projects

set -e

echo "==================================="
echo "Admin Pods Setup Script"
echo "==================================="
echo ""

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm found"
echo ""

# Setup API
echo "Setting up API..."
cd api

if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update api/.env with your SQL Server connection string"
    echo "   Example: DATABASE_URL=\"Server=localhost;Database=admin_pods;User=sa;Password=YourPassword123;TrustServerCertificate=true\""
fi

echo "Installing API dependencies..."
npm install

echo ""
echo "Setting up database schema..."
npm run prisma:generate

echo "✅ API setup complete"
echo ""

# Setup Web
cd ../web

echo "Setting up Web..."
echo "Installing Web dependencies..."
npm install

echo "✅ Web setup complete"
echo ""

cd ..

echo "==================================="
echo "Setup Complete! 🎉"
echo "==================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your database:"
echo "   - Edit api/.env with your SQL Server connection"
echo "   - Run: cd api && npm run prisma:migrate init"
echo ""
echo "2. Start the servers (in separate terminals):"
echo "   - API:  cd api && npm run dev  (port 3000)"
echo "   - Web:  cd web && npm run dev  (port 5173)"
echo ""
echo "3. Open http://localhost:5173 in your browser"
echo ""
echo "Documentation:"
echo "  - Quick start:    Read QUICKSTART.md"
echo "  - Full overview:  Read README.md"
echo "  - For AI agents:  Read .github/copilot-instructions.md"
echo "  - Data flow:      Read DATA_FLOW.md"
echo ""
