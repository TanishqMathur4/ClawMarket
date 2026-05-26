import logging
import os
import secrets
import sys

# Teammate 3's referee is in ../referee/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'referee'))

import log_writer

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)

MOCK_MODE = "--mock" in sys.argv or os.environ.get("MOCK_MODE", "").lower() == "true"


def _get_verify_payload():
    try:
        from referee import verify_payload as _vp
        _vp("probe")  # raises NotImplementedError if T3's stub isn't implemented yet

        def wrapped(raw_payload: str) -> tuple[str, str]:
            result = _vp(raw_payload)
            return result if isinstance(result, tuple) else (result, "")
        return wrapped
    except (ImportError, NotImplementedError):
        logger.warning("referee.verify_payload not ready — using mock verify_payload")

        def mock(raw_payload: str) -> tuple[str, str]:
            # Simulate FAIL for seller address ending in "2" to exercise the refund path
            if raw_payload.endswith("2"):
                return "FAIL", "Mock referee: payload contains hallucinated content"
            return "PASS", "Mock referee: payload looks good"
        return mock


def _fetch_seller_payload(seller: str) -> str:
    """Fetch the seller's work output. Replace with real HTTP call when available."""
    return f"mock payload from seller {seller}"


def _mock_settle(tx_id: bytes, verdict: str) -> str:
    fake_hash = "0x" + secrets.token_hex(32)
    logger.info("Mock settle txId=%s verdict=%s hash=%s", tx_id.hex(), verdict, fake_hash)
    return fake_hash


def handle_event(settle_fn, verify_payload, event: dict) -> None:
    tx_id  = event["txId"]
    buyer  = event["buyer"]
    seller = event["seller"]
    amount = event["amount"]

    log_writer.write_log({
        "txId":            tx_id.hex(),
        "buyer":           buyer,
        "seller":          seller,
        "amount":          f"{amount / 1e6:.2f}",
        "status":          "PENDING",
        "refereeVerdict":  None,
        "refereeReason":   None,
        "settlementTxHash": None,
    })

    try:
        raw_payload = _fetch_seller_payload(seller)
        verdict, reason = verify_payload(raw_payload)
        log_writer.update_log(tx_id.hex(), {"refereeVerdict": verdict, "refereeReason": reason})

        tx_hash = settle_fn(tx_id, verdict)
        status  = "RELEASED" if verdict == "PASS" else "REFUNDED"
        log_writer.update_log(tx_id.hex(), {"status": status, "settlementTxHash": tx_hash})
    except Exception:
        logger.exception("Failed to process txId=%s", tx_id.hex())
        log_writer.update_log(tx_id.hex(), {"status": "FAILED"})


def run_pipeline() -> None:
    """Entry point called by the OpenClaw skill wrapper."""
    verify_payload = _get_verify_payload()

    if MOCK_MODE:
        import mock_events
        logger.info("ClawCourt pipeline starting in MOCK mode")

        def handler(event):
            handle_event(_mock_settle, verify_payload, event)

        mock_events.fire_mock_events(handler)
    else:
        import blockchain
        import event_listener
        logger.info("ClawCourt pipeline starting")
        w3, contract, account = blockchain.connect()

        import functools
        settle_fn = functools.partial(blockchain.settle, w3, contract, account)

        def handler(event):
            handle_event(settle_fn, verify_payload, event)

        event_listener.start_polling(contract, handler)


if __name__ == "__main__":
    run_pipeline()
