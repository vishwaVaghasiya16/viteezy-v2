"""
Custom exception classes for different error types.
"""
from typing import Any


class BaseAppError(Exception):
    """Base exception class for all application errors."""
    
    def __init__(self, message: str, error_code: str | None = None, details: dict[str, Any] | None = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class SessionNotFoundError(BaseAppError):
    """Raised when a session cannot be located."""
    
    def __init__(self, session_id: str, message: str | None = None):
        msg = message or f"Session {session_id} not found."
        super().__init__(
            message=msg,
            error_code="SESSION_NOT_FOUND",
            details={"session_id": session_id}
        )


class ValidationError(BaseAppError):
    """Raised when input validation fails."""
    
    def __init__(self, message: str, field: str | None = None, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            details={"field": field, **(details or {})}
        )


class DatabaseConnectionError(BaseAppError):
    """Raised when database connection fails."""
    
    def __init__(self, message: str = "Database connection failed", details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code="DATABASE_CONNECTION_ERROR",
            details=details or {}
        )


class DatabaseOperationError(BaseAppError):
    """Raised when a database operation fails."""
    
    def __init__(self, message: str, operation: str | None = None, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code="DATABASE_OPERATION_ERROR",
            details={"operation": operation, **(details or {})}
        )


class OpenAIAPIError(BaseAppError):
    """Raised when OpenAI API call fails."""
    
    def __init__(self, message: str, status_code: int | None = None, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            error_code="OPENAI_API_ERROR",
            details={"status_code": status_code, **(details or {})}
        )


class OpenAIRateLimitError(OpenAIAPIError):
    """Raised when OpenAI API rate limit is exceeded."""
    
    def __init__(self, message: str = "OpenAI API rate limit exceeded", retry_after: int | None = None):
        super().__init__(
            message=message,
            error_code="OPENAI_RATE_LIMIT_ERROR",
            details={"retry_after": retry_after}
        )


class OpenAITimeoutError(OpenAIAPIError):
    """Raised when OpenAI API request times out."""
    
    def __init__(self, message: str = "OpenAI API request timed out"):
        super().__init__(
            message=message,
            error_code="OPENAI_TIMEOUT_ERROR"
        )

