#!/bin/bash

echo "🎨 rDraw Setup Script"
echo "====================="

# Create data directory for MongoDB
mkdir -p data/db

# Copy environment example
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env from template"
    echo "⚠️  Please update the JWT_SECRET in backend/.env for production"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run install

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🚀 Quick start options:"
echo ""
echo "Option 1 - With Docker (recommended):"
echo "  docker-compose up"
echo ""
echo "Option 2 - Manual (requires MongoDB):"
echo "  # Start MongoDB first"
echo "  mongod --dbpath ./data/db"
echo "  # Then start the application"
echo "  npm run dev"
echo ""
echo "📱 Application will be available at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:4000"
echo "  GraphQL:  http://localhost:4000/graphql"