"""
Standardized API response models for production use.
All API responses should follow these consistent formats.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Any, Generic, TypeVar

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from app.schemas.chat import ChatResponse, QuestionStateResponse
    from app.schemas.session import SessionResponse

T = TypeVar("T")


class BaseAPIResponse(BaseModel, Generic[T]):
    """Base response model for all API endpoints."""
    status: str = Field(..., description="Response status: 'success' or 'error'")
    message: str | None = Field(default=None, description="Human-readable message")
    data: T | None = Field(default=None, description="Response data payload")
    timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat(),
        description="Response timestamp in ISO format"
    )


class SuccessResponse(BaseAPIResponse[T]):
    """Standardized success response."""
    status: str = Field(default="success", description="Response status")
    message: str | None = Field(default=None, description="Success message")


class ErrorResponse(BaseAPIResponse[None]):
    """Standardized error response."""
    status: str = Field(default="error", description="Response status")
    message: str = Field(..., description="Error message")
    error_code: str | None = Field(default=None, description="Machine-readable error code")
    details: dict[str, Any] | None = Field(default=None, description="Additional error details")
    data: None = Field(default=None)


class HealthCheckResponse(BaseModel):
    """Health check response model."""
    status: str = Field(..., description="Overall health status: 'healthy' or 'unhealthy'")
    timestamp: str = Field(..., description="Check timestamp in ISO format")
    services: dict[str, dict[str, Any]] = Field(..., description="Individual service health status")


class SessionInfoResponse(BaseModel):
    """Session information response model."""
    session_id: str
    created_at: str | None
    updated_at: str | None
    message_count: int
    metadata: dict[str, Any] | None = None


class UserLoginResponse(BaseModel):
    """User login check response model."""
    status: str = Field(..., description="Response status: 'success' or 'fail'")
    isLogin: bool = Field(..., description="Whether user exists and is logged in")
    showRecommendation: bool = Field(..., description="Whether to show recommendations")
    message: str | None = Field(default=None, description="Product recommendation message or registration message")


class LinkSessionResponse(BaseModel):
    """Link session to user response model."""
    status: str = Field(..., description="Response status: 'success' or 'fail'")
    session_id: str
    user_id: str
    message: str
    error: str | None = Field(default=None, description="Error details if status is 'fail'")


class SearchMessagesResponse(BaseModel):
    """Search messages response model."""
    status: str = Field(default="success")
    user_id: str
    search_word: str
    total_matches: int
    matches: list[dict[str, Any]]


class DeleteSessionResponse(BaseModel):
    """Delete session response model."""
    status: str = Field(..., description="Response status: 'success' or 'fail'")
    session_id: str
    user_id: str
    message: str
    ai_conversations_deleted: bool = Field(default=False, description="Whether session was deleted from ai_conversations")
    quiz_sessions_deleted: bool = Field(default=False, description="Whether session was deleted from quiz_sessions")


# Specific response models for endpoints that need them
# Using dict[str, Any] for nested models to avoid circular imports
class CreateSessionResponse(SuccessResponse):
    """Response model for session creation."""
    data: dict[str, Any] | None = Field(default=None, description="Session information (SessionResponse)")


class GetSessionResponse(SuccessResponse):
    """Response model for getting session info."""
    data: SessionInfoResponse | None = Field(default=None, description="Session information")


class ChatResponseWrapper(SuccessResponse):
    """Response model for chat endpoint."""
    data: dict[str, Any] | None = Field(default=None, description="Chat response data (ChatResponse)")


class QuestionStateResponseWrapper(SuccessResponse):
    """Response model for question state endpoint."""
    data: dict[str, Any] | None = Field(default=None, description="Question state data (QuestionStateResponse)")

