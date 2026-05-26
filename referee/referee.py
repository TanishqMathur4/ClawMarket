# referee/referee.py
# ── T3: AI Referee ────────────────────────────────────────────────────────
# PRIMARY public API: verify_payload(raw_payload) -> tuple[str, str]
# Returns ("PASS"|"FAIL", reason_string)
# Called by pipeline/pipeline.py to validate seller data payloads.

import json
import logging
import random
import time
from typing import Literal

import anthropic
from dotenv import load_dotenv
from pydantic import ValidationError

from .models import RefereeVerdict
from .prompts import REFEREE_SYSTEM_PROMPT

load_dotenv()
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

client = anthropic.Anthropic()


def verify_payload(raw_payload: str) -> tuple[Literal["PASS", "FAIL"], str]:
    """
    Validates a raw data payload string against the IoT sensor schema.
    Returns ("PASS"|"FAIL", reason) — never raises, defaults to ("FAIL", reason) on error.

    Target schema:
        { "temperature": <float -50 to 100>, "humidity": <float 0 to 100> }
    """
    log.info("Referee received payload: %s", raw_payload)
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=REFEREE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Payload to inspect:\n{raw_payload}"}],
        )
        raw_text = message.content[0].text
        verdict = RefereeVerdict.model_validate_json(raw_text)
        log.info("Verdict: %s — \"%s\"", verdict.status, verdict.reason)
        return verdict.status, verdict.reason

    except (ValidationError, json.JSONDecodeError) as e:
        reason = f"Referee parse error: {e}"
        log.error(reason)
        return "FAIL", reason

    except anthropic.RateLimitError:
        log.warning("Rate limit hit, retrying once...")
        time.sleep(1)
        try:
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                system=REFEREE_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"Payload to inspect:\n{raw_payload}"}],
            )
            raw_text = message.content[0].text
            verdict = RefereeVerdict.model_validate_json(raw_text)
            log.info("Verdict (retry): %s — \"%s\"", verdict.status, verdict.reason)
            return verdict.status, verdict.reason
        except Exception as e:
            reason = f"Retry failed: {e}"
            log.error(reason)
            return "FAIL", reason

    except Exception as e:
        reason = f"Unexpected referee error: {e}"
        log.error(reason)
        return "FAIL", reason


def get_good_agent_payload() -> str:
    """Returns a valid IoT sensor JSON payload string."""
    return json.dumps({
        "temperature": round(random.uniform(18.0, 35.0), 2),
        "humidity":    round(random.uniform(30.0, 80.0), 2),
    })


BAD_PAYLOADS = [
    "API Error: connection timed out",
    '{"temperature": 22.5}',
    '{"temperature": "hot", "humidity": "wet"}',
    '{"temp": 22.5, "hum": 60.1}',
    "undefined",
    '{"temperature": 22.5, "humidity": 60.1',
    "",
]


def get_bad_agent_payload() -> str:
    """Returns a corrupted/broken payload string for demo failure cycles."""
    return random.choice(BAD_PAYLOADS)
