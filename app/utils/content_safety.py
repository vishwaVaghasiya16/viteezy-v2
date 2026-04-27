"""
Content safety checks for user messages.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class SafetyCheckResult:
    blocked: bool
    category: str | None = None
    matched_terms: list[str] | None = None


_ILLEGAL_SUBSTANCE_TERMS = {
    "cocaine",
    "crack",
    "heroin",
    "meth",
    "methamphetamine",
    "fentanyl",
}

_INTENT_PATTERNS = [
    r"\bi\s+(want|need|crave)\b",
    r"\bhow\s+to\s+(get|buy|make|use)\b",
    r"\bwhere\s+can\s+i\s+(get|buy)\b",
    r"\b(buy|score|dealer|snort)\b",
]

_HELP_SEEKING_PATTERNS = [
    r"\b(quit|stop|recovery|rehab|withdrawal|overdose|addicted|addiction)\b",
]


def check_message_safety(message: str) -> SafetyCheckResult:
    """
    Block direct requests for illegal hard drugs while allowing help-seeking contexts.
    """
    text = (message or "").strip().lower()
    if not text:
        return SafetyCheckResult(blocked=False)

    matched_terms = [term for term in _ILLEGAL_SUBSTANCE_TERMS if term in text]
    if not matched_terms:
        return SafetyCheckResult(blocked=False)

    is_help_seeking = any(re.search(pattern, text) for pattern in _HELP_SEEKING_PATTERNS)
    has_prohibited_intent = any(re.search(pattern, text) for pattern in _INTENT_PATTERNS)

    if has_prohibited_intent and not is_help_seeking:
        return SafetyCheckResult(
            blocked=True,
            category="prohibited_substance_request",
            matched_terms=matched_terms,
        )

    return SafetyCheckResult(blocked=False)
