# referee/models.py
# ── T3: Pydantic models ───────────────────────────────────────────────────

from pydantic import BaseModel
from typing import Literal


class RefereeVerdict(BaseModel):
    status: Literal["PASS", "FAIL"]
    reason: str
