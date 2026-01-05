from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"] = "user"
    # Content can be null for cases where we just want to send options/metadata
    content: str | None = Field(default=None, min_length=1, max_length=2000)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Session identifier provided by the backend.")
    message: str = Field(..., min_length=1, max_length=2000)
    context: dict | None = Field(
        default=None,
        description="Optional structured context (e.g., quiz answers, user profile).",
    )


class QuestionOption(BaseModel):
    """Represents an option for a question."""
    value: str = Field(..., description="The value to send when this option is selected")
    label: str = Field(..., description="The display label for this option")


class ChatResponse(BaseModel):
    session_id: str
    reply: ChatMessage | None = Field(
        default=None,
        description="Assistant reply message. Can be None if conversation ended."
    )
    options: list[QuestionOption] | None = Field(
        default=None,
        description="Available options for the current question (if applicable)"
    )
    question_type: str | None = Field(
        default=None,
        description="Type of question: 'yes_no', 'options', 'text', etc."
    )
    redirect_url: str | None = Field(
        default=None,
        description="URL to redirect user to (e.g., for separate registration)"
    )
    isRegistered: bool = Field(
        default=False,
        description="Whether the session is registered (user_id provided) or guest"
    )


class QuestionStateResponse(BaseModel):
    """Response for getting the current question state."""
    session_id: str
    question: str | None = Field(default=None, description="Current question text")
    options: list[QuestionOption] | None = Field(
        default=None,
        description="Available options for selection"
    )
    question_type: str | None = Field(
        default=None,
        description="Type of question: 'yes_no', 'options', 'text', etc."
    )
    is_awaiting_answer: bool = Field(default=False, description="Whether the bot is waiting for an answer")
    is_complete: bool = Field(default=False, description="Whether onboarding is complete")


class ErrorResponse(BaseModel):
    detail: str
