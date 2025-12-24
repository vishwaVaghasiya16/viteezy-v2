"""
Custom exception classes for the application.
"""
from app.exceptions.errors import (
    DatabaseConnectionError,
    DatabaseOperationError,
    OpenAIAPIError,
    OpenAIRateLimitError,
    OpenAITimeoutError,
    SessionNotFoundError,
    ValidationError,
)

__all__ = [
    "DatabaseConnectionError",
    "DatabaseOperationError",
    "OpenAIAPIError",
    "OpenAIRateLimitError",
    "OpenAITimeoutError",
    "SessionNotFoundError",
    "ValidationError",
]

