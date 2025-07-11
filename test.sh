#!/bin/bash

echo "🎨 rDraw Application Test Suite"
echo "================================"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is required but not installed."
    exit 1
fi

echo "✅ Node.js $(node --version) found"
echo "✅ npm $(npm --version) found"

# Check MongoDB
if ! command_exists mongod; then
    echo "⚠️  MongoDB is not installed. Installing MongoDB..."
    
    # Install MongoDB Community Edition for Ubuntu/Debian
    if command_exists apt; then
        echo "Installing MongoDB on Ubuntu/Debian..."
        sudo apt update
        sudo apt install -y mongodb-org || {
            echo "❌ Failed to install MongoDB. Please install it manually."
            echo "Visit: https://docs.mongodb.com/manual/installation/"
            exit 1
        }
    else
        echo "❌ MongoDB is required but not installed."
        echo "Please install MongoDB and ensure it's running."
        echo "Visit: https://docs.mongodb.com/manual/installation/"
        exit 1
    fi
fi

# Check if MongoDB is running
if ! pgrep mongod > /dev/null; then
    echo "🔄 Starting MongoDB..."
    if command_exists systemctl; then
        sudo systemctl start mongod
    else
        # Try to start MongoDB manually
        mongod --dbpath ./data/db --fork --logpath ./mongodb.log || {
            echo "❌ Failed to start MongoDB."
            echo "Please start MongoDB manually: mongod"
            exit 1
        }
    fi
fi

echo "✅ MongoDB is running"

# Test backend compilation
echo "🔧 Testing backend compilation..."
cd backend
if ! node -c server.js; then
    echo "❌ Backend compilation failed"
    exit 1
fi
echo "✅ Backend compiles successfully"

# Test frontend compilation  
echo "🔧 Testing frontend compilation..."
cd ../frontend
if ! npm run build > /dev/null 2>&1; then
    echo "❌ Frontend compilation failed"
    exit 1
fi
echo "✅ Frontend compiles successfully"

cd ..

echo ""
echo "🎉 All tests passed!"
echo ""
echo "🚀 To start the application:"
echo "   npm run dev"
echo ""
echo "📱 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4000"
echo "   GraphQL:  http://localhost:4000/graphql"
echo ""
echo "🎨 Enjoy creating collaborative pixel art!"