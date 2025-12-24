"""
Error handling utilities and decorators for production use.
"""
import asyncio
import functools
import logging
import traceback
from typing import Any, Callable, TypeVar

from pymongo.errors import (
    ConnectionFailure,
    ExecutionTimeout,
    NetworkTimeout,
    OperationFailure,
    ServerSelectionTimeoutError,
)
from openai import APIError, APIConnectionError, APITimeoutError, RateLimitError

from app.exceptions.errors import (
    DatabaseConnectionError,
    DatabaseOperationError,
    OpenAIAPIError,
    OpenAIRateLimitError,
    OpenAITimeoutError,
)

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


def handle_database_errors(func: F) -> F:
    """
    Decorator to handle database errors and convert them to custom exceptions.
    """
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return await func(*args, **kwargs)
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Database connection error in {func.__name__}: {e}", exc_info=True)
            raise DatabaseConnectionError(
                message="Failed to connect to database",
                details={"function": func.__name__, "error": str(e)}
            ) from e
        except (ExecutionTimeout, NetworkTimeout) as e:
            logger.error(f"Database timeout in {func.__name__}: {e}", exc_info=True)
            raise DatabaseOperationError(
                message="Database operation timed out",
                operation=func.__name__,
                details={"error": str(e)}
            ) from e
        except OperationFailure as e:
            logger.error(f"Database operation failed in {func.__name__}: {e}", exc_info=True)
            raise DatabaseOperationError(
                message=f"Database operation failed: {str(e)}",
                operation=func.__name__,
                details={"error": str(e), "code": getattr(e, "code", None)}
            ) from e
        except Exception as e:
            logger.error(f"Unexpected database error in {func.__name__}: {e}", exc_info=True)
            raise DatabaseOperationError(
                message="Unexpected database error occurred",
                operation=func.__name__,
                details={"error": str(e), "type": type(e).__name__}
            ) from e
    
    return wrapper  # type: ignore


def handle_openai_errors(func: F) -> F:
    """
    Decorator to handle OpenAI API errors and convert them to custom exceptions.
    """
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return await func(*args, **kwargs)
        except RateLimitError as e:
            logger.warning(f"OpenAI rate limit error in {func.__name__}: {e}")
            retry_after = getattr(e, "retry_after", None)
            raise OpenAIRateLimitError(
                message="OpenAI API rate limit exceeded",
                retry_after=retry_after
            ) from e
        except APITimeoutError as e:
            logger.error(f"OpenAI timeout error in {func.__name__}: {e}", exc_info=True)
            raise OpenAITimeoutError(
                message="OpenAI API request timed out"
            ) from e
        except APIConnectionError as e:
            logger.error(f"OpenAI connection error in {func.__name__}: {e}", exc_info=True)
            raise OpenAIAPIError(
                message="Failed to connect to OpenAI API",
                details={"error": str(e)}
            ) from e
        except APIError as e:
            logger.error(f"OpenAI API error in {func.__name__}: {e}", exc_info=True)
            status_code = getattr(e, "status_code", None)
            raise OpenAIAPIError(
                message=f"OpenAI API error: {str(e)}",
                status_code=status_code,
                details={"error": str(e), "type": type(e).__name__}
            ) from e
        except Exception as e:
            logger.error(f"Unexpected OpenAI error in {func.__name__}: {e}", exc_info=True)
            raise OpenAIAPIError(
                message="Unexpected error calling OpenAI API",
                details={"error": str(e), "type": type(e).__name__}
            ) from e
    
    return wrapper  # type: ignore


async def retry_async(
    func: Callable[..., Any],
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
    *args: Any,
    **kwargs: Any
) -> Any:
    """
    Retry an async function with exponential backoff.
    
    Args:
        func: The async function to retry
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff: Multiplier for delay on each retry
        exceptions: Tuple of exceptions to catch and retry on
        *args: Positional arguments for the function
        **kwargs: Keyword arguments for the function
        
    Returns:
        Result of the function call
        
    Raises:
        Last exception if all retries fail
    """
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except exceptions as e:
            last_exception = e
            if attempt < max_retries:
                wait_time = delay * (backoff ** attempt)
                logger.warning(
                    f"Attempt {attempt + 1}/{max_retries + 1} failed for {func.__name__}: {e}. "
                    f"Retrying in {wait_time:.2f}s..."
                )
                await asyncio.sleep(wait_time)
            else:
                logger.error(
                    f"All {max_retries + 1} attempts failed for {func.__name__}: {e}",
                    exc_info=True
                )
                raise
    
    # This should never be reached, but for type checking
    if last_exception:
        raise last_exception
    raise RuntimeError("Unexpected error in retry logic")


def log_error_with_context(
    error: Exception,
    context: dict[str, Any] | None = None,
    level: int = logging.ERROR
) -> None:
    """
    Log an error with additional context information.
    
    Args:
        error: The exception to log
        context: Additional context information
        level: Logging level (default: ERROR)
    """
    context = context or {}
    error_info = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "traceback": traceback.format_exc(),
        **context
    }
    
    logger.log(
        level,
        f"Error occurred: {error_info['error_type']} - {error_info['error_message']}",
        extra={"error_info": error_info}
    )

