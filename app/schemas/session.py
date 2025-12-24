from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.schemas.chat import ChatMessage


class SessionCreate(BaseModel):
    user_id: str | None = Field(
        default=None,
        description="User ID (ObjectId) to check if user exists in users collection.",
    )
    metadata: dict | None = Field(
        default=None,
        description="Optional metadata like quiz version, or campaign tags.",
    )


class Session(BaseModel):
    id: str
    messages: list[ChatMessage] = Field(default_factory=list)
    metadata: dict | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionResponse(BaseModel):
    session_id: str
    created_at: datetime
