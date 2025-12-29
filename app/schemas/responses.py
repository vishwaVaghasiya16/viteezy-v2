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


class PaginationMeta(BaseModel):
    """Standard pagination metadata."""
    page: int = Field(..., description="Current page number (1-based)")
    limit: int = Field(..., description="Number of items per page")
    total: int = Field(..., description="Total number of items")
    pages: int = Field(..., description="Total number of pages")
    hasNext: bool = Field(..., description="Whether there is a next page")
    hasPrev: bool = Field(..., description="Whether there is a previous page")


class SearchMessagesResponseCustom(BaseModel):
    """Custom response model for search-messages endpoint with success boolean, data, and pagination."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: dict[str, Any] | None = Field(default=None, description="Search results data")
    pagination: PaginationMeta | None = Field(default=None, description="Pagination information")


class SessionHistoryResponse(BaseModel):
    """Custom response model for session history endpoint with success boolean, full message history, and pagination."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: dict[str, Any] | None = Field(default=None, description="Session history data including messages")
    pagination: dict[str, Any] | None = Field(default=None, description="Pagination information for messages")


class UserSessionsResponse(BaseModel):
    """Custom response model for listing sessions by user_id."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: list[dict[str, Any]] | None = Field(default=None, description="Array of session objects (session_id, session_name, timestamps)")
    pagination: PaginationMeta | None = Field(default=None, description="Pagination metadata for the sessions list")


class DeleteSessionData(BaseModel):
    """Details about the delete session operation."""
    session_id: str
    user_id: str
    ai_conversations_deleted: bool = Field(default=False, description="Whether session was deleted from ai_conversations")
    quiz_sessions_deleted: bool = Field(default=False, description="Whether session was deleted from quiz_sessions")


class DeleteSessionResponse(BaseModel):
    """Delete session response model."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: DeleteSessionData | None = Field(default=None, description="Delete session details")


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


class SessionCreateResponse(BaseModel):
    """Custom response model for session creation endpoint with success boolean and no timestamp."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: dict[str, Any] | None = Field(default=None, description="Session data containing session_id and created_at")


class FirstQuestionResponse(BaseModel):
    """Custom response model for first-question endpoint with success boolean, timestamp in data, and no outer timestamp."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: dict[str, Any] | None = Field(default=None, description="First question data with timestamp included inside")


class ChatResponseCustom(BaseModel):
    """Custom response model for chat endpoint with success boolean, timestamp in data, and no outer timestamp."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: dict[str, Any] | None = Field(default=None, description="Chat response data with timestamp included inside")


class UserLoginResponseCustom(BaseModel):
    """Custom response model for useridLogin endpoint with success boolean, timestamp in data, and no outer timestamp."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message (e.g., 'Recommendation Shown successfully' or 'User must be registered first')")
    data: dict[str, Any] | None = Field(default=None, description="Login data containing isLogin, showRecommendation, message, and timestamp")


class LinkSessionResponseCustom(BaseModel):
    """Custom response model for link-user endpoint with success boolean, timestamp in data, and no outer timestamp."""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message (e.g., 'Session Linked Successfully' or error message)")
    data: dict[str, Any] | None = Field(default=None, description="Link session data containing session_id, user_id, message, and error")
