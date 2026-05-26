import json
import logging
import random
import time

import anthropic
from dotenv import load_dotenv
from pydantic import ValidationError

from models import RefereeVerdict
from prompts import REFEREE_SYSTEM_PROMPT

load_dotenv()
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

client = anthropic.Anthropic()


def verify_payload(raw_payload: str) -> str:
    """Validates a raw data payload string. Returns 'PASS' or 'FAIL'."""
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
        return verdict.status
    except (ValidationError, json.JSONDecodeError) as e:
        log.error("Failed to parse LLM output: %s", e)
        return "FAIL"
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
            return verdict.status
        except Exception as e:
            log.error("Retry failed: %s", e)
            return "FAIL"
    except Exception as e:
        log.error("Unexpected error in verify_payload: %s", e)
        return "FAIL"


def get_good_agent_payload() -> str:
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
    return random.choice(BAD_PAYLOADS)
