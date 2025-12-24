import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError as PydanticValidationError

from app.dependencies.db import get_database
from app.dependencies.openai_client import get_openai_client
from app.exceptions.errors import ValidationError
from app.repositories.session_repository import SessionRepository
from app.schemas.chat import ChatRequest, ChatResponse, QuestionStateResponse
from app.utils.validation import sanitize_message, validate_search_word, validate_session_id, validate_user_id
from app.utils.error_handler import log_error_with_context

logger = logging.getLogger(__name__)
from app.schemas.responses import (
    ChatResponseWrapper,
    CreateSessionResponse,
    DeleteSessionResponse,
    ErrorResponse,
    GetSessionResponse,
    HealthCheckResponse,
    LinkSessionResponse,
    QuestionStateResponseWrapper,
    SearchMessagesResponse,
    SessionInfoResponse,
    UserLoginResponse,
)
from app.schemas.session import SessionCreate, SessionResponse
from app.services.chat_service import ChatService, SessionNotFoundError
from app.services.openai_service import OpenAIChatService
from app.services.product_service import ProductService

router = APIRouter()


async def get_chat_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
    openai_client: AsyncOpenAI = Depends(get_openai_client),
) -> ChatService:
    from app.repositories.product_repository import ProductRepository
    from app.repositories.user_repository import UserRepository
    from app.repositories.quiz_session_repository import QuizSessionRepository
    
    session_repo = SessionRepository(db)
    product_repo = ProductRepository(db)
    user_repo = UserRepository(db)
    quiz_session_repo = QuizSessionRepository(db)
    product_service = ProductService(product_repo)
    ai_service = OpenAIChatService(openai_client)
    return ChatService(
        session_repo=session_repo,
        ai_service=ai_service,
        product_service=product_service,
        user_repo=user_repo,
        quiz_session_repo=quiz_session_repo,
    )


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    responses={
        503: {"model": HealthCheckResponse, "description": "Service unhealthy"}
    }
)
async def health_check(
    db: AsyncIOMotorDatabase = Depends(get_database),
    openai_client: AsyncOpenAI = Depends(get_openai_client),
) -> HealthCheckResponse | Response:
    """
    Production-ready health check endpoint.
    Verifies connectivity to MongoDB and OpenAI API.
    Returns 200 if all services are healthy, 503 if any service is unhealthy.
    """
    import time
    from datetime import datetime, timezone
    import json
    
    health_status = HealthCheckResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
        services={}
    )
    
    overall_healthy = True
    
    # Check MongoDB connection
    mongodb_status = {
        "status": "healthy",
        "response_time_ms": None,
        "error": None
    }
    
    try:
        start_time = time.time()
        await db.command("ping")
        response_time = (time.time() - start_time) * 1000
        mongodb_status["response_time_ms"] = round(response_time, 2)
    except Exception as e:
        mongodb_status["status"] = "unhealthy"
        mongodb_status["error"] = "Database connection failed"
        overall_healthy = False
    
    health_status.services["mongodb"] = mongodb_status
    
    # Check OpenAI API connection
    openai_status = {
        "status": "healthy",
        "response_time_ms": None,
        "error": None
    }
    
    try:
        start_time = time.time()
        await openai_client.models.list()
        response_time = (time.time() - start_time) * 1000
        openai_status["response_time_ms"] = round(response_time, 2)
    except Exception as e:
        openai_status["status"] = "unhealthy"
        openai_status["error"] = "OpenAI API connection failed"
        overall_healthy = False
    
    health_status.services["openai"] = openai_status
    
    # Set overall status
    if not overall_healthy:
        health_status.status = "unhealthy"
        return Response(
            content=health_status.model_dump_json(),
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json"
        )
    
    return health_status


@router.post(
    "/sessions",
    response_model=CreateSessionResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def create_session(
    payload: SessionCreate | None = None,
    chat_service: ChatService = Depends(get_chat_service),
) -> CreateSessionResponse:
    """
    Create a new chat session.
    
    Returns a standardized success response with session information.
    """
    try:
        user_id = payload.user_id if payload else None
        metadata = (payload.metadata if payload else None) or {}
        if user_id:
            metadata["user_id"] = user_id
            metadata["is_registered"] = True
        else:
            metadata["is_registered"] = False
        
        session = await chat_service.create_session(metadata=metadata, user_id=user_id)
        
        session_response = SessionResponse(session_id=session.id, created_at=session.created_at)
        return CreateSessionResponse(
            status="success",
            message="Session created successfully",
            data=session_response.model_dump()
        )
    except PydanticValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                status="error",
                message="Invalid request data",
                error_code="VALIDATION_ERROR",
                details={"errors": e.errors()}
            ).model_dump()
        ) from e
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                status="error",
                message=exc.message,
                error_code=exc.error_code,
                details=exc.details
            ).model_dump()
        ) from exc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                status="error",
                message="Failed to create session",
                error_code="INTERNAL_ERROR"
            ).model_dump()
        )


@router.get(
    "/sessions/{session_id}",
    response_model=GetSessionResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Session not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_session(
    session_id: str,
    chat_service: ChatService = Depends(get_chat_service),
) -> GetSessionResponse:
    """
    Get session information including metadata and token usage.
    
    Returns a standardized success response with session details.
    """
    try:
        # Validate session ID
        session_id = validate_session_id(session_id)
        
        session = await chat_service.session_repo.get(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ErrorResponse(
                    status="error",
                    message="Session not found",
                    error_code="SESSION_NOT_FOUND",
                    details={"session_id": session_id}
                ).model_dump()
            )
        
        session_info = SessionInfoResponse(
            session_id=session.id,
            created_at=session.created_at.isoformat() if session.created_at else None,
            updated_at=session.updated_at.isoformat() if session.updated_at else None,
            message_count=len(session.messages),
            metadata=session.metadata or {}
        )
        
        return GetSessionResponse(
            status="success",
            message="Session retrieved successfully",
            data=session_info
        )
    except HTTPException:
        raise
    except Exception as e:
        log_error_with_context(
            e,
            context={"session_id": session_id, "endpoint": "get_session"}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                status="error",
                message="Failed to retrieve session",
                error_code="INTERNAL_ERROR"
            ).model_dump()
        ) from e


@router.post(
    "/chat",
    response_model=ChatResponseWrapper,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        404: {"model": ErrorResponse, "description": "Session not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def chat(
    payload: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponseWrapper:
    """
    Send a message or option selection to the chat bot.
    
    For option-based questions, send the option value (e.g., "yes", "no", "sleep", etc.)
    as the message field. The bot will validate and process it.
    
    Returns a standardized success response with chat response data.
    """
    try:
        # Validate and sanitize input
        payload.message = sanitize_message(payload.message)
        payload.session_id = validate_session_id(payload.session_id)
        
        chat_response = await chat_service.handle_message(payload)
        return ChatResponseWrapper(
            status="success",
            message="Message processed successfully",
            data=chat_response.model_dump()
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                status="error",
                message=exc.message,
                error_code=exc.error_code,
                details=exc.details
            ).model_dump()
        ) from exc
    except SessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                status="error",
                message=str(exc),
                error_code="SESSION_NOT_FOUND",
                details={"session_id": payload.session_id}
            ).model_dump()
        ) from exc
    except PydanticValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                status="error",
                message="Invalid request data",
                error_code="VALIDATION_ERROR",
                details={"errors": e.errors()}
            ).model_dump()
        ) from e
    except Exception as e:
        log_error_with_context(
            e,
            context={
                "session_id": payload.session_id,
                "endpoint": "chat",
                "message_length": len(payload.message) if payload else 0,
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                status="error",
                message="Failed to process message",
                error_code="INTERNAL_ERROR"
            ).model_dump()
        ) from e


@router.get(
    "/sessions/{session_id}/question",
    response_model=QuestionStateResponseWrapper,
    responses={
        404: {"model": ErrorResponse, "description": "Session not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_current_question(
    session_id: str,
    chat_service: ChatService = Depends(get_chat_service),
) -> QuestionStateResponseWrapper:
    """
    Get the current question state with available options.
    
    This endpoint is useful for frontend to:
    - Display the current question
    - Show available option buttons
    - Know what type of input is expected (yes/no, options, or text)
    
    When a user clicks an option, send that option's value to the /chat endpoint.
    
    Returns a standardized success response with question state data.
    """
    try:
        question_state = await chat_service.get_current_question(session_id)
        return QuestionStateResponseWrapper(
            status="success",
            message="Question state retrieved successfully",
            data=question_state.model_dump()
        )
    except SessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                status="error",
                message=str(exc),
                error_code="SESSION_NOT_FOUND",
                details={"session_id": session_id}
            ).model_dump()
        ) from exc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                status="error",
                message="Failed to retrieve question state",
                error_code="INTERNAL_ERROR"
            ).model_dump()
        ) from e


class UserLoginRequest(BaseModel):
    """Request model for user login verification."""
    user_id: str | None = Field(None, description="User ID to check (can be null or empty)")
    session_id: str = Field(..., description="Session ID to retrieve product recommendations from")


@router.post(
    "/useridLogin",
    response_model=UserLoginResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid user_id or session_id format"},
        404: {"model": ErrorResponse, "description": "Session not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def check_user_login(
    request: UserLoginRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> UserLoginResponse:
    """
    Check if user_id exists in users collection.
    If user exists, return product recommendation message from the session.
    If user doesn't exist, return false with registration message.
    
    Returns standardized response with login status and product recommendation message.
    """
    try:
        from bson import ObjectId
        
        # Check if user_id is null or empty
        if not request.user_id or request.user_id.strip() == "":
            return UserLoginResponse(
                status="fail",
                isLogin=False,
                showRecommendation=False,
                message="Register yourself first on Viteezy to view product recommendations"
            )
        
        # Validate user_id format
        try:
            ObjectId(request.user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    status="error",
                    message="Invalid user_id format. Must be a valid ObjectId.",
                    error_code="INVALID_USER_ID_FORMAT",
                    details={"user_id": request.user_id}
                ).model_dump()
            )
        
        # Validate session_id
        try:
            request.session_id = validate_session_id(request.session_id)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    status="error",
                    message=exc.message,
                    error_code=exc.error_code,
                    details=exc.details
                ).model_dump()
            ) from exc
        
        if not chat_service.user_repo:
            return UserLoginResponse(
                status="fail",
                isLogin=False,
                showRecommendation=False,
                message="Register yourself first on Viteezy to view product recommendations"
            )
        
        user_exists = await chat_service.user_repo.user_exists(request.user_id)
        
        if user_exists:
            # Get session to retrieve product recommendation message
            try:
                session = await chat_service.session_repo.get(request.session_id, user_id=request.user_id)
                if not session:
                    # Try without user_id (legacy format)
                    session = await chat_service.session_repo.get(request.session_id)
                
                if session:
                    # Check if onboarding is complete
                    session_metadata = session.metadata or {}
                    onboarding_state = session_metadata.get("onboarding", {})
                    is_complete = onboarding_state.get("complete", False)
                    responses = onboarding_state.get("responses", {})
                    
                    # Check if conversation ended at medical_treatment (no recommendations generated)
                    medical_treatment_answered = responses.get("medical_treatment") is not None
                    
                    # Extract product recommendation message from session messages
                    # Look for the last assistant message that contains actual product recommendations
                    # (not questions about products)
                    recommendation_message = None
                    
                    # Only look for recommendations if onboarding is complete
                    # Recommendations are generated even when medical_treatment is answered (just not shown in chat)
                    if is_complete:
                        for msg in reversed(session.messages):
                            if msg.role == "assistant":
                                content = msg.content
                                
                                # Skip if this is a question (contains "?" or "Options:" or question patterns)
                                if "?" in content or "Options:" in content or content.strip().endswith("?"):
                                    continue
                                
                                # Check if this message contains actual product recommendations
                                # Look for specific patterns that indicate recommendations, not questions
                                content_lower = content.lower()
                                
                                # Must contain recommendation keywords AND not be a question
                                has_recommendation_keywords = any(
                                    keyword in content_lower 
                                    for keyword in [
                                        "personalized product recommendations",
                                        "here are my",
                                        "recommendations are based",
                                        "recommended products",
                                        "product could be a good fit",
                                        "since you mentioned",
                                        "based on your responses",
                                        "based on your profile"
                                    ]
                                )
                                
                                # Or contains product names (usually formatted as titles/headers)
                                # Product recommendations typically have product names as standalone lines
                                has_product_name_pattern = (
                                    "\n\n" in content and  # Has structured format
                                    any(keyword in content_lower for keyword in ["recommend", "suggest", "supplement"])
                                )
                                
                                if has_recommendation_keywords or has_product_name_pattern:
                                    recommendation_message = content
                                    break
                    
                    if recommendation_message:
                        return UserLoginResponse(
                            status="success",
                            isLogin=True,
                            showRecommendation=True,
                            message=recommendation_message
                        )
                    else:
                        # No recommendation found in session
                        if medical_treatment_answered:
                            # Conversation ended at medical_treatment, but recommendations should have been generated
                            # If not found, it might be an error or recommendations weren't generated
                            return UserLoginResponse(
                                status="success",
                                isLogin=True,
                                showRecommendation=False,
                                message="The conversation ended at the medical treatment question. Product recommendations may not be available."
                            )
                        else:
                            # User exists but no recommendations found (quiz not completed or recommendations not shown yet)
                            return UserLoginResponse(
                                status="success",
                                isLogin=True,
                                showRecommendation=True,
                                message="User logged in successfully. Product recommendations will be available after completing the quiz."
                            )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=ErrorResponse(
                            status="error",
                            message="Session not found",
                            error_code="SESSION_NOT_FOUND",
                            details={"session_id": request.session_id}
                        ).model_dump()
                    )
            except SessionNotFoundError:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=ErrorResponse(
                        status="error",
                        message="Session not found",
                        error_code="SESSION_NOT_FOUND",
                        details={"session_id": request.session_id}
                    ).model_dump()
                )
        else:
            return UserLoginResponse(
                status="fail",
                isLogin=False,
                showRecommendation=False,
                message="Register yourself first on Viteezy to view product recommendations"
            )
    except HTTPException:
        raise
    except Exception as e:
        log_error_with_context(
            e,
            context={"user_id": request.user_id, "session_id": request.session_id, "endpoint": "check_user_login"}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                status="error",
                message="Failed to check user login status",
                error_code="INTERNAL_ERROR"
            ).model_dump()
        ) from e

# Old /chat/islogin endpoint removed - use /useridLogin instead


class LinkSessionRequest(BaseModel):
    """Request model for linking a session to a user."""
    user_id: str


@router.post(
    "/sessions/{session_id}/link-user",
    response_model=LinkSessionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        404: {"model": ErrorResponse, "description": "Session not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def link_session_to_user(
    session_id: str,
    request: LinkSessionRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> LinkSessionResponse:
    """
    Link a session (created without user_id) to a user_id.
    This moves the session from legacy format to nested format within user document.
    
    Use this after a user logs in and gets a user_id, to link their anonymous session.
    
    Returns standardized response with linking status.
    """
    try:
        from bson import ObjectId
        
        # Validate user_id format
        try:
            ObjectId(request.user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    status="error",
                    message="Invalid user_id format. Must be a valid ObjectId.",
                    error_code="INVALID_USER_ID_FORMAT",
                    details={"user_id": request.user_id}
                ).model_dump()
            )
        
        session = await chat_service.session_repo.link_session_to_user(
            session_id=session_id,
            user_id=request.user_id
        )
        
        if session:
            # Also add session to quiz_sessions if it doesn't exist
            quiz_session_handled = False
            if chat_service.quiz_session_repo:
                try:
                    # Check if session already exists in quiz_sessions
                    existing_sessions = await chat_service.quiz_session_repo.get_user_sessions(request.user_id)
                    session_exists = False
                    if existing_sessions:
                        session_exists = any(
                            sess.get("session_id") == session_id 
                            for sess in existing_sessions
                        )
                    
                    # Add to quiz_sessions if it doesn't exist
                    if not session_exists:
                        quiz_session_handled = await chat_service.quiz_session_repo.add_session(
                            user_id=request.user_id,
                            session_id=session_id
                        )
                    else:
                        quiz_session_handled = True  # Already exists
                except Exception as e:
                    # Log error but don't fail the request
                    import logging
                    logging.warning(f"Failed to add session to quiz_sessions: {e}")
            
            message = "Session successfully linked to user"
            if quiz_session_handled:
                message += " and added to quiz_sessions"
            
            return LinkSessionResponse(
                status="success",
                session_id=session_id,
                user_id=request.user_id,
                message=message
            )
        else:
            return LinkSessionResponse(
                status="fail",
                session_id=session_id,
                user_id=request.user_id,
                message="Session not found or already linked to a different user"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                status="error",
                message="Failed to link session to user",
                error_code="INTERNAL_ERROR"
            ).model_dump()
        ) from e


@router.get(
    "/search-messages",
    response_model=SearchMessagesResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid user_id format"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def search_messages(
    user_id: str = Query(..., description="User ID to search messages for"),
    word: str = Query(..., min_length=1, max_length=100, description="Word to search for in messages"),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SearchMessagesResponse:
    """
    Search for a word in all messages across all sessions for a given user.
    Returns session_id and message array index where the word was found.
    
    Example:
        GET /api/v1/search-messages?user_id=65f1a9a1c9a1b2c3d4e50000&word=digestion
    
    Returns standardized response with search results.
    """
    try:
        from bson import ObjectId
        from app.repositories.session_repository import SessionRepository
        
        # Validate user_id format
        try:
            ObjectId(user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    status="error",
                    message="Invalid user_id format. Must be a valid ObjectId.",
                    error_code="INVALID_USER_ID_FORMAT",
                    details={"user_id": user_id}
                ).model_dump()
            )
        
        # Validate search word
        try:
            word = validate_search_word(word)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    status="error",
                    message=exc.message,
                    error_code=exc.error_code,
                    details=exc.details
                ).model_dump()
            ) from exc
        
        session_repo = SessionRepository(db)
        results = await session_repo.search_word_in_messages(user_id, word)
        
        return SearchMessagesResponse(
            status="success",
            user_id=user_id,
            search_word=word,
            total_matches=len(results),
            matches=results
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                status="error",
                message="Failed to search messages",
                error_code="INTERNAL_ERROR"
            ).model_dump()
        ) from e


@router.delete(
    "/sessions/{session_id}",
    response_model=DeleteSessionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid user_id format"},
        404: {"model": ErrorResponse, "description": "Session not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def delete_session(
    session_id: str,
    user_id: str = Query(..., description="User ID associated with the session"),
    chat_service: ChatService = Depends(get_chat_service),
) -> DeleteSessionResponse:
    """
    Delete a session from both ai_conversations and quiz_sessions collections.
    
    This endpoint removes the session from:
    - ai_conversations: Removes session from nested sessions array (or legacy document)
    - quiz_sessions: Removes session entry from user's session_data array
    
    Args:
        session_id: The session ID to delete
        user_id: User ID associated with the session (required)
        
    Returns:
        DeleteSessionResponse with deletion status for both collections
    """
    try:
        from bson import ObjectId
        
        # Validate user_id format
        try:
            ObjectId(user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    status="error",
                    message="Invalid user_id format. Must be a valid ObjectId.",
                    error_code="INVALID_USER_ID_FORMAT",
                    details={"user_id": user_id}
                ).model_dump()
            )
        
        # Delete from ai_conversations
        ai_deleted = await chat_service.session_repo.delete_session(
            session_id=session_id,
            user_id=user_id
        )
        
        # Always attempt to delete from quiz_sessions (even if not found in ai_conversations)
        quiz_deleted = False
        if chat_service.quiz_session_repo:
            quiz_deleted = await chat_service.quiz_session_repo.delete_session(
                user_id=user_id,
                session_id=session_id
            )
        
        # Determine overall status
        # Success if deleted from at least one collection
        if ai_deleted or quiz_deleted:
            status_msg = "success"
            if ai_deleted and quiz_deleted:
                message = "Session deleted from both ai_conversations and quiz_sessions"
            elif ai_deleted:
                message = "Session deleted from ai_conversations. Also attempted deletion from quiz_sessions."
            elif quiz_deleted:
                message = "Session deleted from quiz_sessions. Also attempted deletion from ai_conversations."
        else:
            status_msg = "fail"
            message = "Session not found in either collection"
        
        return DeleteSessionResponse(
            status=status_msg,
            session_id=session_id,
            user_id=user_id,
            message=message,
            ai_conversations_deleted=ai_deleted,
            quiz_sessions_deleted=quiz_deleted
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                status="error",
                message="Failed to delete session",
                error_code="INTERNAL_ERROR"
            ).model_dump()
        ) from e
