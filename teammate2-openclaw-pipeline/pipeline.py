import logging
import os

import blockchain
import event_listener
import log_writer

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)


def _mock_verify_payload(raw_payload: str) -> tuple[str, str]:
    """Placeholder until Teammate 3 supplies verify_payload()."""
    return "PASS", "Mock referee: payload looks good"


def _get_verify_payload():
    try:
        from teammate3_referee.referee import verify_payload as _vp

        def wrapped(raw_payload: str) -> tuple[str, str]:
            result = _vp(raw_payload)
            if isinstance(result, str):
                return result, ""
            return result  # assume (verdict, reason) tuple
        return wrapped
    except ImportError:
        logger.warning("teammate3_referee not available — using mock verify_payload")
        return _mock_verify_payload


def _fetch_seller_payload(seller: str) -> str:
    """Returns the seller's work payload. Replace with real fetch when available."""
    return f"mock payload from seller {seller}"


def handle_event(w3, contract, account, verify_payload, event: dict) -> None:
    tx_id = event["txId"]
    buyer = event["buyer"]
    seller = event["seller"]
    amount = event["amount"]

    log_writer.write_pending(tx_id, buyer, seller, amount)

    try:
        raw_payload = _fetch_seller_payload(seller)
        verdict, reason = verify_payload(raw_payload)
        log_writer.write_verdict(tx_id, verdict, reason)

        tx_hash = blockchain.settle(w3, contract, account, tx_id, verdict)
        log_writer.write_settled(tx_id, verdict, tx_hash)
    except Exception:
        logger.exception("Failed to process txId=%s", tx_id.hex())
        log_writer.upsert(tx_id.hex(), {"status": "FAILED"})


def run_pipeline() -> None:
    logger.info("ClawCourt pipeline starting")
    w3, contract, account = blockchain.connect()
    verify_payload = _get_verify_payload()

    def handler(event: dict):
        handle_event(w3, contract, account, verify_payload, event)

    event_listener.poll_funds_locked(w3, contract, handler)


if __name__ == "__main__":
    run_pipeline()
