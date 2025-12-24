"""
Global exception handler middleware for FastAPI.
"""
import logging
import traceback
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError

from app.exceptions.errors import (
    BaseAppError,
    DatabaseConnectionError,
    DatabaseOperationError,
    OpenAIAPIError,
    OpenAIRateLimitError,
    OpenAITimeoutError,
    SessionNotFoundError,
)
from app.schemas.responses import ErrorResponse
from app.utils.error_handler import log_error_with_context

logger = logging.getLogger(__name__)


async def exception_handler_middleware(request: Request, call_next: Callable) -> Response:
    """
    Global exception handler middleware that catches all exceptions
    and returns standardized error responses.
    """
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        return await handle_exception(exc, request)


async def handle_exception(exc: Exception, request: Request) -> JSONResponse:
    """
    Handle exceptions and return appropriate HTTP responses.
    """
    # Log the error with context
    context = {
        "path": request.url.path,
        "method": request.method,
        "query_params": dict(request.query_params),
    }
    log_error_with_context(exc, context)
    
    # Handle custom application errors
    if isinstance(exc, SessionNotFoundError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=ErrorResponse(
                status="error",
                message=exc.message,
                error_code=exc.error_code,
                details=exc.details
            ).model_dump()
        )
    
    if isinstance(exc, DatabaseConnectionError):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=ErrorResponse(
                status="error",
                message="Database service unavailable. Please try again later.",
                error_code=exc.error_code,
                details=exc.details
            ).model_dump()
        )
    
    if isinstance(exc, DatabaseOperationError):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                status="error",
                message="Database operation failed. Please try again later.",
                error_code=exc.error_code,
                details=exc.details
            ).model_dump()
        )
    
    if isinstance(exc, OpenAIRateLimitError):
        retry_after = exc.details.get("retry_after")
        headers = {}
        if retry_after:
            headers["Retry-After"] = str(retry_after)
        
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            headers=headers,
            content=ErrorResponse(
                status="error",
                message="Service is temporarily unavailable due to high demand. Please try again later.",
                error_code=exc.error_code,
                details=exc.details
            ).model_dump()
        )
    
    if isinstance(exc, (OpenAITimeoutError, OpenAIAPIError)):
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorResponse(
                status="error",
                message="AI service is temporarily unavailable. Please try again later.",
                error_code=exc.error_code,
                details=exc.details
            ).model_dump()
        )
    
    if isinstance(exc, BaseAppError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=ErrorResponse(
                status="error",
                message=exc.message,
                error_code=exc.error_code,
                details=exc.details
            ).model_dump()
        )
    
    # Handle Pydantic validation errors
    if isinstance(exc, PydanticValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                status="error",
                message="Validation error",
                error_code="VALIDATION_ERROR",
                details={"errors": exc.errors()}
            ).model_dump()
        )
    
    # Handle unexpected errors
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
        exc_info=True,
        extra={"path": request.url.path, "method": request.method}
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            status="error",
            message="An unexpected error occurred. Please try again later.",
            error_code="INTERNAL_SERVER_ERROR",
            details={}
        ).model_dump()
    )

