#!/bin/bash

# Scaler Support Frontend - Railpack Deployment Script

set -e  # Exit on any error

echo "Starting Scaler Support Frontend deployment..."

# We're already in the frontend directory when deployed
# Check if package.json exists in current directory
if [ ! -f "package.json" ]; then
    # Try to go to frontend directory if we're in root
    if [ -d "frontend" ]; then
        cd frontend
        echo "Changed to frontend directory"
    fi
    
    # Check again
    if [ ! -f "package.json" ]; then
        echo "Error: package.json not found in current or frontend directory!"
        echo "Current directory: $(pwd)"
        echo "Contents:"
        ls -la
        exit 1
    fi
fi

echo "Found package.json in: $(pwd)"

# Install dependencies
echo "Installing dependencies..."
npm ci --only=production || npm install

# Build the application
echo "Building application..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not found!"
    echo "Contents after build:"
    ls -la
    exit 1
fi

# Serve the built application
echo "Starting production server..."

# Use PORT environment variable if set, otherwise default to 3000
PORT=${PORT:-3000}
echo "Using port: $PORT"

# Try different serving methods
if command -v serve &> /dev/null; then
    echo "Using serve package..."
    serve -s dist -l $PORT
elif command -v npx &> /dev/null; then
    echo "Using vite preview..."
    npx vite preview --host 0.0.0.0 --port $PORT
else
    echo "Using simple HTTP server..."
    cd dist
    python3 -m http.server $PORT || python -m SimpleHTTPServer $PORT
fi
