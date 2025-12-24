"""
Input validation and sanitization utilities.
"""
import re
from typing import Any

from app.exceptions.errors import ValidationError


def validate_session_id(session_id: str) -> str:
    """
    Validate and sanitize session ID.
    
    Args:
        session_id: Session ID to validate
        
    Returns:
        Sanitized session ID
        
    Raises:
        ValidationError: If session ID is invalid
    """
    if not session_id:
        raise ValidationError("Session ID cannot be empty", field="session_id")
    
    # Session IDs are hex strings (32 chars from uuid4().hex)
    if not re.match(r"^[a-f0-9]{32}$", session_id):
        raise ValidationError(
            "Invalid session ID format",
            field="session_id",
            details={"session_id": session_id[:20] + "..." if len(session_id) > 20 else session_id}
        )
    
    return session_id.strip()


def validate_user_id(user_id: str) -> str:
    """
    Validate user ID (ObjectId format).
    
    Args:
        user_id: User ID to validate
        
    Returns:
        Sanitized user ID
        
    Raises:
        ValidationError: If user ID is invalid
    """
    if not user_id:
        raise ValidationError("User ID cannot be empty", field="user_id")
    
    user_id = user_id.strip()
    
    # ObjectId is 24 hex characters
    if not re.match(r"^[a-f0-9]{24}$", user_id, re.IGNORECASE):
        raise ValidationError(
            "Invalid user ID format. Must be a valid ObjectId.",
            field="user_id",
            details={"user_id": user_id}
        )
    
    return user_id


def sanitize_message(message: str, max_length: int = 2000) -> str:
    """
    Sanitize and validate user message.
    
    Args:
        message: Message to sanitize
        max_length: Maximum message length
        
    Returns:
        Sanitized message
        
    Raises:
        ValidationError: If message is invalid
    """
    if not message:
        raise ValidationError("Message cannot be empty", field="message")
    
    message = message.strip()
    
    if len(message) > max_length:
        raise ValidationError(
            f"Message exceeds maximum length of {max_length} characters",
            field="message",
            details={"length": len(message), "max_length": max_length}
        )
    
    # Remove control characters except newlines and tabs
    message = re.sub(r"[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]", "", message)
    
    return message


def validate_search_word(word: str, min_length: int = 1, max_length: int = 100) -> str:
    """
    Validate search word.
    
    Args:
        word: Word to validate
        min_length: Minimum word length
        max_length: Maximum word length
        
    Returns:
        Sanitized word
        
    Raises:
        ValidationError: If word is invalid
    """
    if not word:
        raise ValidationError("Search word cannot be empty", field="word")
    
    word = word.strip()
    
    if len(word) < min_length:
        raise ValidationError(
            f"Search word must be at least {min_length} character(s)",
            field="word",
            details={"length": len(word), "min_length": min_length}
        )
    
    if len(word) > max_length:
        raise ValidationError(
            f"Search word exceeds maximum length of {max_length} characters",
            field="word",
            details={"length": len(word), "max_length": max_length}
        )
    
    # Remove potentially dangerous characters
    word = re.sub(r"[^\w\s-]", "", word)
    
    return word

