#!/bin/bash

echo "==================================================="
echo "              STARTING BILLMANAGER"
echo "==================================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js is not installed on this PC!"
    echo "Please download and install Node.js from: https://nodejs.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if node_modules exists, install dependencies if missing
if [ ! -d "node_modules" ]; then
    echo "[INFO] First-time setup: Installing dependencies..."
    echo "This may take a couple of minutes. Please wait..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies. Check your internet connection."
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

echo ""
echo "[INFO] Starting local development server..."
echo "The application will open automatically in your browser."
echo "Keep this terminal open while using the application."
echo ""

# Start SvelteKit and open browser
npm run dev -- --open
