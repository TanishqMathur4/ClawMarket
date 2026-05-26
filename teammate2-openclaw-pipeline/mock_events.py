import logging
import os
import secrets
import time
from typing import Callable

logger = logging.getLogger(__name__)

_MOCK_BUYERS = [
    "0xBuyer1000000000000000000000000000000000001",
    "0xBuyer2000000000000000000000000000000000002",
]
_MOCK_SELLERS = [
    "0xSeller100000000000000000000000000000000001",
    "0xSeller200000000000000000000000000000000002",
]
_MOCK_AMOUNTS = [50_000, 100_000, 30_000]  # in tUSDC micro-units (6 decimals)


def fire_mock_events(
    handler: Callable[[dict], None],
    count: int = 3,
    interval: float = float(os.environ.get("MOCK_EVENT_INTERVAL", "4")),
) -> None:
    logger.info("Mock event generator firing %d events every %.1fs", count, interval)
    for i in range(count):
        event = {
            "txId": secrets.token_bytes(32),
            "buyer": _MOCK_BUYERS[i % len(_MOCK_BUYERS)],
            "seller": _MOCK_SELLERS[i % len(_MOCK_SELLERS)],
            "amount": _MOCK_AMOUNTS[i % len(_MOCK_AMOUNTS)],
        }
        logger.info(
            "Mock FundsLocked #%d txId=%s buyer=%s seller=%s amount=%s",
            i + 1,
            event["txId"].hex(),
            event["buyer"],
            event["seller"],
            event["amount"],
        )
        handler(event)
        if i < count - 1:
            time.sleep(interval)
    logger.info("Mock event generator done")
