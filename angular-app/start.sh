#!/bin/bash
# Quick start script for Angular Presentation Viewer

echo "🚀 Starting Angular Presentation Viewer..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the angular-app directory:"
    echo "  cd angular-app && ./start.sh"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if the server is already running
if pgrep -f "ng serve" > /dev/null; then
    echo "⚠️  Development server is already running"
    echo "📱 Open http://localhost:4200 in your browser"
    echo ""
    echo "To stop the server, run: pkill -f 'ng serve'"
else
    echo "🏃 Starting development server..."
    echo "📱 Once started, open http://localhost:4200 in your browser"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    npx @angular/cli serve
fi

