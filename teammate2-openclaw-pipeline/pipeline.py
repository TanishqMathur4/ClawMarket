import logging
import os
import secrets
import sys

import log_writer

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)

MOCK_MODE = "--mock" in sys.argv or os.environ.get("MOCK_MODE", "").lower() == "true"


def _mock_verify_payload(raw_payload: str) -> tuple[str, str]:
    """Placeholder until Teammate 3 supplies verify_payload()."""
    # Simulate a FAIL on sellers whose address ends in "2" so we can demo the refund path
    if raw_payload.endswith("2"):
        return "FAIL", "Mock referee: payload contains hallucinated content"
    return "PASS", "Mock referee: payload looks good"


def _get_verify_payload():
    try:
        from teammate3_referee.referee import verify_payload as _vp

        def wrapped(raw_payload: str) -> tuple[str, str]:
            result = _vp(raw_payload)
            if isinstance(result, str):
                return result, ""
            return result
        return wrapped
    except ImportError:
        logger.warning("teammate3_referee not available — using mock verify_payload")
        return _mock_verify_payload


def _fetch_seller_payload(seller: str) -> str:
    """Returns the seller's work payload. Replace with real fetch when available."""
    return f"mock payload from seller {seller}"


def _mock_settle(tx_id: bytes, verdict: str) -> str:
    fake_hash = "0x" + secrets.token_hex(32)
    logger.info("Mock settle txId=%s verdict=%s hash=%s", tx_id.hex(), verdict, fake_hash)
    return fake_hash


def handle_event(w3, contract, account, verify_payload, settle_fn, event: dict) -> None:
    tx_id = event["txId"]
    buyer = event["buyer"]
    seller = event["seller"]
    amount = event["amount"]

    log_writer.write_pending(tx_id, buyer, seller, amount)

    try:
        raw_payload = _fetch_seller_payload(seller)
        verdict, reason = verify_payload(raw_payload)
        log_writer.write_verdict(tx_id, verdict, reason)

        tx_hash = settle_fn(tx_id, verdict)
        log_writer.write_settled(tx_id, verdict, tx_hash)
    except Exception:
        logger.exception("Failed to process txId=%s", tx_id.hex())
        log_writer.upsert(tx_id.hex(), {"status": "FAILED"})


def run_pipeline() -> None:
    verify_payload = _get_verify_payload()

    if MOCK_MODE:
        import mock_events
        logger.info("ClawCourt pipeline starting in MOCK mode")

        def handler(event: dict):
            handle_event(None, None, None, verify_payload, _mock_settle, event)

        mock_events.fire_mock_events(handler)
    else:
        import blockchain
        import event_listener
        logger.info("ClawCourt pipeline starting")
        w3, contract, account = blockchain.connect()

        import functools
        settle_fn = functools.partial(blockchain.settle, w3, contract, account)

        def handler(event: dict):
            handle_event(w3, contract, account, verify_payload, settle_fn, event)

        event_listener.poll_funds_locked(w3, contract, handler)


if __name__ == "__main__":
    run_pipeline()
