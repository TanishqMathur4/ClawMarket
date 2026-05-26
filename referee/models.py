# referee/models.py
# ── T3: Pydantic models ───────────────────────────────────────────────────
# Enforces structured output from the Referee LLM.

from pydantic import BaseModel
from typing import Literal


class RefereeVerdict(BaseModel):
    status: Literal["PASS", "FAIL"]
    reason: str
