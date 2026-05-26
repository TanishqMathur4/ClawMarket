# referee/referee.py
# ── T3: AI Referee ────────────────────────────────────────────────────────
# PRIMARY public API: verify_payload(raw_payload) -> "PASS" | "FAIL"
# Called by pipeline/pipeline.py to validate seller data payloads.
#
# TODO (Teammate 3):
#   1. Implement REFEREE_SYSTEM_PROMPT in prompts.py
#   2. Implement RefereeVerdict Pydantic model in models.py
#   3. Implement verify_payload() with Claude Haiku API call
#   4. Implement get_good_agent_payload() + get_bad_agent_payload()

import logging
from typing import Literal

logger = logging.getLogger(__name__)

# from prompts import REFEREE_SYSTEM_PROMPT  # uncomment when prompts.py is ready
# from models import RefereeVerdict           # uncomment when models.py is ready


def verify_payload(raw_payload: str) -> Literal["PASS", "FAIL"]:
    """
    Validates a raw data payload string against the IoT sensor schema.
    Returns 'PASS' if valid, 'FAIL' otherwise.
    Never raises — defaults to 'FAIL' on any error.

    Target schema:
        { "temperature": <float -50 to 100>, "humidity": <float 0 to 100> }
    """
    raise NotImplementedError("Teammate 3: implement verify_payload()")


def get_good_agent_payload() -> str:
    """Returns a valid IoT sensor JSON payload string."""
    raise NotImplementedError("Teammate 3: implement get_good_agent_payload()")


def get_bad_agent_payload() -> str:
    """Returns a corrupted/broken payload string for demo failure cycles."""
    raise NotImplementedError("Teammate 3: implement get_bad_agent_payload()")
