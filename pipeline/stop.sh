#!/bin/bash

echo "🛑 Stopping ClawCourt Pipeline..."

# Stop pipeline
if [ -f "pipeline.pid" ]; then
    PID=$(cat pipeline.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "✓ Pipeline stopped (PID: $PID)"
    else
        echo "⚠ Pipeline not running"
    fi
    rm pipeline.pid
fi

# Stop health check
if [ -f "health_check.pid" ]; then
    PID=$(cat health_check.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "✓ Health check stopped (PID: $PID)"
    else
        echo "⚠ Health check not running"
    fi
    rm health_check.pid
fi

echo "✓ All services stopped"
