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
        # Just check it's importable and callable — don't hit the API yet
        if not callable(_vp):
            raise ImportError("verify_payload is not callable")
        logger.info("Using T3 referee.verify_payload")

        def wrapped(raw_payload: str) -> tuple[str, str]:
            result = _vp(raw_payload)
            return result if isinstance(result, tuple) else (result, "")
        return wrapped
    except (ImportError, Exception) as e:
        logger.warning("referee.verify_payload not ready (%s) — using mock verify_payload", e)

        def mock(raw_payload: str) -> tuple[str, str]:
            import json
            try:
                data = json.loads(raw_payload)
                temp = data.get("temperature")
                hum  = data.get("humidity")
                if (isinstance(temp, (int, float)) and
                        isinstance(hum, (int, float)) and
                        -50 <= temp <= 100 and 0 <= hum <= 100):
                    return "PASS", "Mock referee: valid sensor payload — schema OK"
            except Exception:
                pass
            return "FAIL", "Mock referee: malformed or missing fields"
        return mock


def _fetch_seller_payload(seller: str) -> str:
    """
    Fetch the seller's submitted payload.
    Alternates good/bad based on seller address last hex char:
    - Even → valid sensor JSON (PASS)
    - Odd  → corrupted payload (FAIL)
    """
    import json, random
    is_good = int(seller[-1], 16) % 2 == 0
    if is_good:
        try:
            from referee import get_good_agent_payload
            return get_good_agent_payload()
        except Exception:
            return json.dumps({
                "temperature": round(random.uniform(18.0, 35.0), 2),
                "humidity":    round(random.uniform(30.0, 80.0), 2),
            })
    else:
        try:
            from referee import get_bad_agent_payload
            return get_bad_agent_payload()
        except Exception:
            bad_payloads = [
                "API Error: connection timed out",
                '{"temperature": "hot", "humidity": "wet"}',
                '{"temp": 22.5, "hum": 60.1}',
                "",
            ]
            return random.choice(bad_payloads)


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
        "txId":   tx_id.hex(),
        "buyer":  buyer,
        "seller": seller,
        "amount": amount,   # raw int micro-USDC — log_writer formats to "X.XX tUSDC"
        "status": "PENDING",
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
