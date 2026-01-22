#!/bin/bash
cd "$(dirname "$0")/verdant_dashboard"
echo "Starting Verdant Analytics Dashboard..."
npm install
npm run dev -- --port 5174 --host
