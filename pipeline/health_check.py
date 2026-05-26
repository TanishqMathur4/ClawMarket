"""
Health check and status API for ClawCourt Pipeline
Provides endpoints for monitoring and ClawUp integration
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import json
import os
from datetime import datetime
from web3 import Web3
from dotenv import load_dotenv
import psutil
import logging

load_dotenv()

app = FastAPI(title="ClawCourt Pipeline Health Check")

# Configuration
LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", "../shared/log.json")
RPC_URL = os.getenv("GOAT_RPC_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

# Initialize Web3
w3 = Web3(Web3.HTTPProvider(RPC_URL)) if RPC_URL else None

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s"
)
logger = logging.getLogger(__name__)


@app.get("/health")
async def health_check():
    """
    Basic health check endpoint
    Returns: healthy/unhealthy status
    """
    try:
        checks = {
            "api": True,
            "blockchain": False,
            "log_file": False,
            "disk_space": False
        }
        
        # Check blockchain connection
        if w3 and w3.is_connected():
            checks["blockchain"] = True
        
        # Check log file accessibility
        if os.path.exists(LOG_FILE_PATH):
            checks["log_file"] = True
        
        # Check disk space (>100MB free)
        disk = psutil.disk_usage('/')
        if disk.free > 100 * 1024 * 1024:
            checks["disk_space"] = True
        
        all_healthy = all(checks.values())
        
        return JSONResponse(
            status_code=200 if all_healthy else 503,
            content={
                "status": "healthy" if all_healthy else "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "checks": checks,
                "version": "1.0.0"
            }
        )
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )


@app.get("/status")
async def get_status():
    """
    Detailed status information
    Returns: comprehensive system status
    """
    try:
        status = {
            "pipeline": {
                "status": "running",
                "uptime_seconds": None
            },
            "blockchain": {
                "connected": False,
                "network": None,
                "latest_block": None,
                "contract_address": CONTRACT_ADDRESS
            },
            "transactions": {
                "total": 0,
                "pending": 0,
                "released": 0,
                "refunded": 0
            },
            "system": {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_free_gb": round(psutil.disk_usage('/').free / (1024**3), 2)
            }
        }
        
        # Blockchain status
        if w3 and w3.is_connected():
            status["blockchain"]["connected"] = True
            status["blockchain"]["network"] = w3.eth.chain_id
            status["blockchain"]["latest_block"] = w3.eth.block_number
        
        # Transaction stats from log file
        if os.path.exists(LOG_FILE_PATH):
            with open(LOG_FILE_PATH, 'r') as f:
                try:
                    logs = json.load(f)
                    status["transactions"]["total"] = len(logs)
                    status["transactions"]["pending"] = sum(
                        1 for log in logs if log.get("status") == "PENDING"
                    )
                    status["transactions"]["released"] = sum(
                        1 for log in logs if log.get("status") == "RELEASED"
                    )
                    status["transactions"]["refunded"] = sum(
                        1 for log in logs if log.get("status") == "REFUNDED"
                    )
                except json.JSONDecodeError:
                    logger.warning("Failed to parse log.json")
        
        # Pipeline uptime (from PID file)
        if os.path.exists("pipeline.pid"):
            try:
                with open("pipeline.pid", 'r') as f:
                    pid = int(f.read().strip())
                    process = psutil.Process(pid)
                    status["pipeline"]["uptime_seconds"] = int(
                        datetime.now().timestamp() - process.create_time()
                    )
            except (ProcessLookupError, psutil.NoSuchProcess):
                status["pipeline"]["status"] = "stopped"
        
        return JSONResponse(
            status_code=200,
            content={
                "timestamp": datetime.utcnow().isoformat(),
                "status": status
            }
        )
    
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@app.get("/api/logs")
async def get_logs():
    """
    Returns transaction logs
    Compatible with Teammate 4's frontend
    """
    try:
        if not os.path.exists(LOG_FILE_PATH):
            return JSONResponse(
                status_code=200,
                content={"logs": [], "count": 0}
            )
        
        with open(LOG_FILE_PATH, 'r') as f:
            logs = json.load(f)
        
        return JSONResponse(
            status_code=200,
            content={
                "logs": logs,
                "count": len(logs),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    except Exception as e:
        logger.error(f"Failed to read logs: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ClawCourt Pipeline",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "status": "/status",
            "logs": "/api/logs"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting ClawCourt Pipeline Health Check API...")
    logger.info(f"RPC URL: {RPC_URL}")
    logger.info(f"Contract: {CONTRACT_ADDRESS}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
