import logging
import os
import secrets
import time
from typing import Callable

logger = logging.getLogger(__name__)

_MOCK_BUYERS  = ["0xA1B2C3D4E5F6a1b2c3d4e5f6A1B2C3D4E5F6a1b2",
                  "0xDeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEf"]
_MOCK_SELLERS = ["0x1234567890AbCdEf1234567890aBcDeF12345678",  # ends 8 (even) → PASS
                  "0xFeDcBa9876543210FedCba9876543210fEdCbA91"]  # ends 1 (odd)  → FAIL
_MOCK_AMOUNTS = [500_000_000, 1_200_000_000, 300_000_000]  # 500, 1200, 300 tUSDC (6 decimals)


def fire_mock_events(
    on_event_callback: Callable[[dict], None],
    count: int = 3,
    interval: float = float(os.environ.get("MOCK_EVENT_INTERVAL", "4")),
) -> None:
    logger.info("Mock event generator: firing %d events every %.1fs", count, interval)
    for i in range(count):
        event = {
            "txId":   secrets.token_bytes(32),
            "buyer":  _MOCK_BUYERS[i % len(_MOCK_BUYERS)],
            "seller": _MOCK_SELLERS[i % len(_MOCK_SELLERS)],
            "amount": _MOCK_AMOUNTS[i % len(_MOCK_AMOUNTS)],
        }
        logger.info("Mock FundsLocked #%d txId=%s", i + 1, event["txId"].hex())
        on_event_callback(event)
        if i < count - 1:
            time.sleep(interval)
    logger.info("Mock event generator done")
