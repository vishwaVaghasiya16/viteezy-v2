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
    ChatResponseCustom,
    ChatResponseWrapper,
    CreateSessionResponse,
    DeleteSessionResponse,
    ErrorResponse,
    FirstQuestionResponse,
    GetSessionResponse,
    LinkSessionResponse,
    LinkSessionResponseCustom,
    QuestionStateResponseWrapper,
    SearchMessagesResponse,
    SearchMessagesResponseCustom,
    SessionCreateResponse,
    SessionHistoryResponse,
    SessionInfoResponse,
    UserLoginResponse,
    UserLoginResponseCustom,
    UserSessionsResponse,
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
    status_code=status.HTTP_200_OK,
)
async def health_check(
    db: AsyncIOMotorDatabase = Depends(get_database),
    openai_client: AsyncOpenAI = Depends(get_openai_client),
) -> dict:
    """
    Health check endpoint.
    Always returns 200 with the shape:
    {
        "success": bool,
        "message": "All server running" | "Server is not running",
        "data": {
            "status": "healthy" | "unhealthy",
            "timestamp": "...",
            "services": { ... }
        }
    }
    """
    import time
    from datetime import datetime, timezone
    
    timestamp = datetime.now(timezone.utc).isoformat()
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
    except Exception:
        mongodb_status["status"] = "unhealthy"
        mongodb_status["error"] = "Database connection failed"
        overall_healthy = False
    
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
    except Exception:
        openai_status["status"] = "unhealthy"
        openai_status["error"] = "OpenAI API connection failed"
        overall_healthy = False
    
    data = {
        "status": "healthy" if overall_healthy else "unhealthy",
        "timestamp": timestamp,
        "services": {
            "mongodb": mongodb_status,
            "openai": openai_status
        }
    }
    
    return {
        "success": overall_healthy,
        "message": "All server running" if overall_healthy else "Server is not running",
        "data": data
    }


@router.get(
    "/sessions/by-user",
    response_model=UserSessionsResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": UserSessionsResponse, "description": "Invalid user_id format"},
        404: {"model": UserSessionsResponse, "description": "User not found"},
    },
)
async def get_sessions_by_user(
    user_id: str = Query(..., description="User ID to fetch sessions for"),
    chat_service: ChatService = Depends(get_chat_service),
) -> UserSessionsResponse:
    """
    Get session_id and session_name list for a given user_id from ai_conversations.
    """
    try:
        user_id = validate_user_id(user_id)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=UserSessionsResponse(
                success=False,
                message=exc.message,
                data=None
            ).model_dump()
        ) from exc
    
    sessions = await chat_service.session_repo.get_sessions_for_user(user_id)
    if sessions is None:
        return UserSessionsResponse(
            success=False,
            message="User not found or no sessions",
            data=[]
        )
    
    return UserSessionsResponse(
        success=True,
        message="Sessions fetched successfully",
        data=sessions
    )


@router.post(
    "/sessions",
    response_model=SessionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": SessionCreateResponse, "description": "Invalid request"},
        500: {"model": SessionCreateResponse, "description": "Internal server error"}
    }
)
async def create_session(
    payload: SessionCreate | None = None,
    chat_service: ChatService = Depends(get_chat_service),
) -> SessionCreateResponse:
    """
    Create a new chat session.
    
    Returns a standardized success response with session information.
    """
    try:
        user_id = payload.user_id if payload else None
        metadata = (payload.metadata if payload else None) or {}
        if user_id:
            # Normalize user_id before storing in metadata
            from app.utils.validation import normalize_user_id
            metadata["user_id"] = normalize_user_id(user_id)
            metadata["is_registered"] = True
        else:
            metadata["is_registered"] = False
        
        session = await chat_service.create_session(metadata=metadata, user_id=user_id)
        
        session_response = SessionResponse(session_id=session.id, created_at=session.created_at)
        # Serialize datetime to ISO format string
        session_data = session_response.model_dump(mode='json')
        return SessionCreateResponse(
            success=True,
            message="Session created successfully",
            data=session_data
        )
    except PydanticValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=SessionCreateResponse(
                success=False,
                message="Invalid request data",
                data=None
            ).model_dump()
        ) from e
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=SessionCreateResponse(
                success=False,
                message=exc.message,
                data=None
            ).model_dump()
        ) from exc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=SessionCreateResponse(
                success=False,
                message="Failed to create session",
                data=None
            ).model_dump()
        )


@router.get(
    "/sessions/history",
    response_model=SessionHistoryResponse,
    responses={
        400: {"model": SessionHistoryResponse, "description": "Invalid user_id or session_id format"},
        404: {"model": SessionHistoryResponse, "description": "Session not found"},
        500: {"model": SessionHistoryResponse, "description": "Internal server error"}
    }
)
async def get_session_history(
    user_id: str = Query(..., description="User ID to get session history for"),
    session_id: str = Query(..., description="Session ID to get message history for"),
    page: int = Query(1, ge=1, description="Page number for messages (starts from 1)"),
    limit: int = Query(50, ge=1, le=100, description="Number of messages per page"),
    chat_service: ChatService = Depends(get_chat_service),
) -> SessionHistoryResponse:
    """
    Get the full message history of a session including all messages.
    
    Returns all messages in chronological order along with session metadata.
    
    Example:
        GET /api/v1/sessions/history?user_id=65f1a9a1c9a1b2c3d4e50000&session_id=d58917ff0b0444b1936fa4efa142f142
    
    Returns standardized response with full session history.
    """
    from datetime import datetime, timezone
    from bson import ObjectId
    
    try:
        # Validate user_id format
        try:
            ObjectId(user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SessionHistoryResponse(
                    success=False,
                    message="Invalid user_id format. Must be a valid ObjectId.",
                    data=None,
                    pagination=None
                ).model_dump()
            )
        
        # Validate session_id
        try:
            session_id = validate_session_id(session_id)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SessionHistoryResponse(
                    success=False,
                    message=exc.message,
                    data=None,
                    pagination=None
                ).model_dump()
            ) from exc
        
        # Get session with user_id
        session = await chat_service.session_repo.get(session_id, user_id=user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SessionHistoryResponse(
                    success=False,
                    message="Session not found",
                    data=None,
                    pagination=None
                ).model_dump()
            )
        
        # Get session_name from database document (it's stored at session level, not in metadata)
        session_name = None
        try:
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user_doc = await chat_service.session_repo.collection.find_one(
                {"_id": user_oid, "sessions.session_id": session_id},
                {"sessions.$": 1}
            )
            if user_doc and user_doc.get("sessions"):
                session_name = user_doc["sessions"][0].get("session_name")
        except Exception:
            # If not found in nested format, try legacy format
            try:
                legacy_doc = await chat_service.session_repo.collection.find_one({"_id": session_id})
                if legacy_doc:
                    session_name = legacy_doc.get("session_name")
            except Exception:
                pass  # session_name will remain None
        
        # Serialize messages to dict format
        all_messages = []
        for msg in session.messages:
            msg_dict = msg.model_dump(mode='json')
            all_messages.append(msg_dict)
        
        # Calculate pagination for messages
        total_messages = len(all_messages)
        total_pages = (total_messages + limit - 1) // limit if total_messages > 0 else 0
        offset = (page - 1) * limit
        paginated_messages = all_messages[offset:offset + limit]
        
        # Build session history data (without metadata)
        # Normalize user_id to ensure consistent format
        from app.utils.validation import normalize_user_id
        normalized_user_id = normalize_user_id(user_id)
        
        session_data = {
            "session_id": session.id,
            "session_name": session_name,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "updated_at": session.updated_at.isoformat() if session.updated_at else None,
            "user_id": normalized_user_id,
            "message_count": total_messages,
            "messages": paginated_messages
        }
        
        # Build pagination info
        pagination_info = {
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "total_messages": total_messages,
            "has_next": page < total_pages,
            "has_previous": page > 1
        }
        
        return SessionHistoryResponse(
            success=True,
            message="Session history retrieved successfully",
            data=session_data,
            pagination=pagination_info
        )
    except HTTPException:
        raise
    except Exception as e:
        log_error_with_context(
            e,
            context={"user_id": user_id, "session_id": session_id, "endpoint": "get_session_history"}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=SessionHistoryResponse(
                success=False,
                message="Failed to retrieve session history",
                data=None,
                pagination=None
            ).model_dump()
        ) from e


@router.get(
    "/sessions/first-question",
    response_model=FirstQuestionResponse,
    responses={
        400: {"model": FirstQuestionResponse, "description": "Invalid session_id format"},
        404: {"model": FirstQuestionResponse, "description": "Session not found"},
        500: {"model": FirstQuestionResponse, "description": "Internal server error"}
    }
)
async def get_first_question(
    session_id: str = Query(..., description="Session ID to get the first question for"),
    chat_service: ChatService = Depends(get_chat_service),
) -> FirstQuestionResponse:
    """
    Get the first question from the bot without sending any message.
    
    This endpoint initializes the onboarding flow and returns the first question
    (e.g., "Hey! I'm Viteezy. What should I call you?").
    
    After calling this endpoint, you can POST to /chat with the user's answer
    to continue the conversation.
    
    Example:
        GET /api/v1/sessions/first-question?session_id=d58917ff0b0444b1936fa4efa142f142
    
    Returns a standardized success response with the first question.
    """
    from datetime import datetime, timezone
    
    try:
        # Validate session_id
        try:
            session_id = validate_session_id(session_id)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=FirstQuestionResponse(
                    success=False,
                    message=exc.message,
                    data=None
                ).model_dump()
            ) from exc
        
        first_question = await chat_service.get_first_question(session_id)
        # Serialize the response and add timestamp inside data
        question_data = first_question.model_dump(mode='json')
        question_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        return FirstQuestionResponse(
            success=True,
            message="First question retrieved successfully",
            data=question_data
        )
    except SessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FirstQuestionResponse(
                success=False,
                message=str(exc),
                data=None
            ).model_dump()
        ) from exc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=FirstQuestionResponse(
                success=False,
                message="Failed to retrieve first question",
                data=None
            ).model_dump()
        ) from e


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
    response_model=ChatResponseCustom,
    responses={
        400: {"model": ChatResponseCustom, "description": "Invalid request"},
        404: {"model": ChatResponseCustom, "description": "Session not found"},
        500: {"model": ChatResponseCustom, "description": "Internal server error"}
    }
)
async def chat(
    payload: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponseCustom:
    """
    Send a message or option selection to the chat bot.
    
    For option-based questions, send the option value (e.g., "yes", "no", "sleep", etc.)
    as the message field. The bot will validate and process it.
    
    Returns a standardized success response with chat response data.
    """
    from datetime import datetime, timezone
    
    try:
        # Validate and sanitize input
        payload.message = sanitize_message(payload.message)
        payload.session_id = validate_session_id(payload.session_id)
        
        chat_response = await chat_service.handle_message(payload)
        # Serialize the response and add timestamp inside data
        chat_data = chat_response.model_dump(mode='json')
        chat_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        return ChatResponseCustom(
            success=True,
            message="Message processed successfully",
            data=chat_data
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ChatResponseCustom(
                success=False,
                message=exc.message,
                data=None
            ).model_dump()
        ) from exc
    except SessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ChatResponseCustom(
                success=False,
                message=str(exc),
                data=None
            ).model_dump()
        ) from exc
    except PydanticValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ChatResponseCustom(
                success=False,
                message="Invalid request data",
                data=None
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
            detail=ChatResponseCustom(
                success=False,
                message="Failed to process message",
                data=None
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
    response_model=UserLoginResponseCustom,
    responses={
        400: {"model": UserLoginResponseCustom, "description": "Invalid user_id or session_id format"},
        404: {"model": UserLoginResponseCustom, "description": "Session not found"},
        500: {"model": UserLoginResponseCustom, "description": "Internal server error"}
    }
)
async def check_user_login(
    request: UserLoginRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> UserLoginResponseCustom:
    """
    Check if user_id exists in users collection.
    If user exists, return product recommendation message from the session.
    If user doesn't exist, return false with registration message.
    
    Returns standardized response with login status and product recommendation message.
    """
    from datetime import datetime, timezone
    from bson import ObjectId
        
    try:
        # Check if user_id is null or empty
        if not request.user_id or request.user_id.strip() == "":
            login_data = {
                "isLogin": False,
                "showRecommendation": False,
                "message": "Register yourself first on Viteezy to view product recommendations",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            return UserLoginResponseCustom(
                success=False,
                message="User must be registered first",
                data=login_data
            )
        
        # Validate user_id format
        try:
            ObjectId(request.user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=UserLoginResponseCustom(
                    success=False,
                    message="Invalid user_id format. Must be a valid ObjectId.",
                    data=None
                ).model_dump()
            )
        
        # Validate session_id
        try:
            request.session_id = validate_session_id(request.session_id)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=UserLoginResponseCustom(
                    success=False,
                    message=exc.message,
                    data=None
                ).model_dump()
            ) from exc
        
        if not chat_service.user_repo:
            login_data = {
                "isLogin": False,
                "showRecommendation": False,
                "message": "Register yourself first on Viteezy to view product recommendations",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            return UserLoginResponseCustom(
                success=False,
                message="User must be registered first",
                data=login_data
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
                        # Extract major concern and create session_name using OpenAI
                        concerns_raw = responses.get("concern", [])
                        if concerns_raw:
                            # Normalize concerns to get list of concern keys
                            normalized_concerns = chat_service._normalize_concerns(concerns_raw)
                            if normalized_concerns:
                                # Get the first concern as the major concern
                                major_concern_key = normalized_concerns[0]
                                # Get the label from CONCERN_QUESTIONS for context
                                concern_info = chat_service.CONCERN_QUESTIONS.get(major_concern_key, {})
                                concern_label = concern_info.get("label", major_concern_key.replace("_", " ").title())
                                
                                # Generate creative session name using OpenAI
                                try:
                                    session_name = await chat_service.generate_session_name(concern_label)
                                    
                                    # Update session with session_name in ai_conversations
                                    await chat_service.session_repo.update_session_name(
                                        session_id=request.session_id,
                                        session_name=session_name,
                                        user_id=request.user_id
                                    )
                                    
                                    # Update session_name in quiz_sessions as well
                                    if chat_service.quiz_session_repo:
                                        try:
                                            await chat_service.quiz_session_repo.update_session_name(
                                                user_id=request.user_id,
                                                session_id=request.session_id,
                                                session_name=session_name
                                            )
                                        except Exception as e:
                                            import logging
                                            logging.warning(f"Failed to update session_name in quiz_sessions: {e}")
                                except Exception as e:
                                    # Log error but don't fail the request
                                    import logging
                                    logging.warning(f"Failed to generate or update session_name: {e}")
                        
                        login_data = {
                            "isLogin": True,
                            "showRecommendation": True,
                            "message": recommendation_message,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        return UserLoginResponseCustom(
                            success=True,
                            message="Recommendation Shown successfully",
                            data=login_data
                        )
                    else:
                        # No recommendation found in session
                        if medical_treatment_answered:
                            # Conversation ended at medical_treatment, but recommendations should have been generated
                            # If not found, it might be an error or recommendations weren't generated
                            login_data = {
                                "isLogin": True,
                                "showRecommendation": False,
                                "message": "The conversation ended at the medical treatment question. Product recommendations may not be available.",
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }
                            return UserLoginResponseCustom(
                                success=True,
                                message="Recommendation Shown successfully",
                                data=login_data
                            )
                        else:
                            # User exists but no recommendations found (quiz not completed or recommendations not shown yet)
                            login_data = {
                                "isLogin": True,
                                "showRecommendation": True,
                                "message": "User logged in successfully. Product recommendations will be available after completing the quiz.",
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }
                            return UserLoginResponseCustom(
                                success=True,
                                message="Recommendation Shown successfully",
                                data=login_data
                            )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=UserLoginResponseCustom(
                            success=False,
                            message="Session not found",
                            data=None
                        ).model_dump()
                    )
            except SessionNotFoundError:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=UserLoginResponseCustom(
                        success=False,
                        message="Session not found",
                        data=None
                    ).model_dump()
                )
        else:
            login_data = {
                "isLogin": False,
                "showRecommendation": False,
                "message": "Register yourself first on Viteezy to view product recommendations",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            return UserLoginResponseCustom(
                success=False,
                message="User must be registered first",
                data=login_data
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
            detail=UserLoginResponseCustom(
                success=False,
                message="Failed to check user login status",
                data=None
            ).model_dump()
        ) from e

# Old /chat/islogin endpoint removed - use /useridLogin instead


class LinkSessionRequest(BaseModel):
    """Request model for linking a session to a user."""
    user_id: str = Field(..., description="User ID to link the session to")
    session_id: str = Field(..., description="Session ID to link to the user")


@router.post(
    "/sessions/link-user",
    response_model=LinkSessionResponseCustom,
    responses={
        400: {"model": LinkSessionResponseCustom, "description": "Invalid request"},
        404: {"model": LinkSessionResponseCustom, "description": "Session not found"},
        500: {"model": LinkSessionResponseCustom, "description": "Internal server error"}
    }
)
async def link_session_to_user(
    request: LinkSessionRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> LinkSessionResponseCustom:
    """
    Link a session (created without user_id) to a user_id.
    This moves the session from legacy format to nested format within user document.
    
    Use this after a user logs in and gets a user_id, to link their anonymous session.
    
    Returns standardized response with linking status.
    """
    from datetime import datetime, timezone
    from bson import ObjectId
    
    try:
        # Validate session_id
        try:
            request.session_id = validate_session_id(request.session_id)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=LinkSessionResponseCustom(
                    success=False,
                    message=exc.message,
                    data=None
                ).model_dump()
            ) from exc
        
        # Validate user_id format
        try:
            ObjectId(request.user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=LinkSessionResponseCustom(
                    success=False,
                    message="Invalid user_id format. Must be a valid ObjectId.",
                    data=None
                ).model_dump()
            )
        
        session = await chat_service.session_repo.link_session_to_user(
            session_id=request.session_id,
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
                            sess.get("session_id") == request.session_id 
                            for sess in existing_sessions
                        )
                    
                    # Add to quiz_sessions if it doesn't exist
                    if not session_exists:
                        quiz_session_handled = await chat_service.quiz_session_repo.add_session(
                            user_id=request.user_id,
                            session_id=request.session_id
                        )
                    else:
                        quiz_session_handled = True  # Already exists
                except Exception as e:
                    # Log error but don't fail the request
                    import logging
                    logging.warning(f"Failed to add session to quiz_sessions: {e}")
            
            # Session is linked to ai_conversations (that's what link_session_to_user does)
            # Also added to quiz_sessions if quiz_session_handled is True
            # Always include both in the message as per requirements
            message = "Session successfully linked to user and added to quiz_sessions and ai_conversations"
            
            # Normalize user_id for consistent response format
            from app.utils.validation import normalize_user_id
            normalized_user_id = normalize_user_id(request.user_id)
            
            link_data = {
                "session_id": request.session_id,
                "user_id": normalized_user_id,
                "message": message,
                "error": None,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            return LinkSessionResponseCustom(
                success=True,
                message="Session Linked Successfully",
                data=link_data
            )
        else:
            # Normalize user_id for consistent response format
            from app.utils.validation import normalize_user_id
            normalized_user_id = normalize_user_id(request.user_id)
            
            link_data = {
                "session_id": request.session_id,
                "user_id": normalized_user_id,
                "message": "Session not found or already linked to a different user",
                "error": "Session not found or already linked to a different user",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            return LinkSessionResponseCustom(
                success=False,
                message="Session not found or already linked to a different user",
                data=link_data
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=LinkSessionResponseCustom(
                success=False,
                message="Failed to link session to user",
                data=None
            ).model_dump()
        ) from e


@router.get(
    "/search-messages",
    response_model=SearchMessagesResponseCustom,
    responses={
        400: {"model": SearchMessagesResponseCustom, "description": "Invalid user_id format"},
        500: {"model": SearchMessagesResponseCustom, "description": "Internal server error"}
    }
)
async def search_messages(
    user_id: str = Query(..., description="User ID to search messages for"),
    word: str = Query(..., min_length=1, max_length=100, description="Word to search for in messages"),
    page: int = Query(1, ge=1, description="Page number (starts from 1)"),
    limit: int = Query(10, ge=1, le=100, description="Number of results per page"),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SearchMessagesResponseCustom:
    """
    Search for a word in all messages across all sessions for a given user.
    Returns session_id, session_name, date, and message details where the word was found.
    Results are sorted by latest session created first.
    
    Example:
        GET /api/v1/search-messages?user_id=65f1a9a1c9a1b2c3d4e50000&word=digestion&page=1&limit=10
    
    Returns standardized response with search results and pagination.
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
                detail=SearchMessagesResponseCustom(
                    success=False,
                    message="Invalid user_id format. Must be a valid ObjectId.",
                    data=None,
                    pagination=None
                ).model_dump()
            )
        
        # Validate search word
        try:
            word = validate_search_word(word)
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=SearchMessagesResponseCustom(
                    success=False,
                    message=exc.message,
                    data=None,
                    pagination=None
                ).model_dump()
            ) from exc
        
        session_repo = SessionRepository(db)
        all_results = await session_repo.search_word_in_messages(user_id, word)
        
        # Calculate total message matches (sum of all messages across all sessions)
        total_message_matches = sum(len(session["messages"]) for session in all_results)
        
        # Pagination is based on sessions (not individual messages)
        total_sessions = len(all_results)
        total_pages = (total_sessions + limit - 1) // limit if total_sessions > 0 else 0
        offset = (page - 1) * limit
        paginated_results = all_results[offset:offset + limit]
        
        # Normalize user_id for consistent response format
        from app.utils.validation import normalize_user_id
        normalized_user_id = normalize_user_id(user_id)
        
        # Build response data
        search_data = {
            "user_id": normalized_user_id,
            "search_word": word,
            "total_matches": total_message_matches,
            "matches": paginated_results
        }
        
        # Build pagination info
        pagination_info = {
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "total_sessions": total_sessions,
            "has_next": page < total_pages,
            "has_previous": page > 1
        }
        
        return SearchMessagesResponseCustom(
            success=True,
            message="Search successful",
            data=search_data,
            pagination=pagination_info
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=SearchMessagesResponseCustom(
                success=False,
                message="Failed to search messages",
                data=None,
                pagination=None
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
