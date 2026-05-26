# referee/__init__.py
# Makes `referee` importable as a package from the repo root.
# T2 usage:
#   from referee import verify_payload, get_good_agent_payload, get_bad_agent_payload

from .referee import verify_payload, get_good_agent_payload, get_bad_agent_payload, BAD_PAYLOADS
from .models import RefereeVerdict

__all__ = [
    "verify_payload",
    "get_good_agent_payload",
    "get_bad_agent_payload",
    "BAD_PAYLOADS",
    "RefereeVerdict",
]
