import logging
from datetime import datetime, timezone
from uuid import uuid4
from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.config.settings import settings
from app.schemas.chat import ChatMessage
from app.schemas.session import Session
from app.utils.error_handler import handle_database_errors

logger = logging.getLogger(__name__)


class SessionRepository:
    """
    Repository for ai_conversations collection.
    Stores one document per user with nested sessions array.
    Each session contains messages and metadata.
    """
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection: AsyncIOMotorCollection = db[settings.mongo_sessions_collection]

    @staticmethod
    def _session_id_to_str(session_id: str | ObjectId | None) -> str:
        """Serialize session_id to string for consistent comparisons/responses."""
        if isinstance(session_id, ObjectId):
            return str(session_id)
        return str(session_id) if session_id is not None else ""

    @staticmethod
    def _session_id_variants(session_id: str | ObjectId | None) -> list:
        """
        Build variants to match either ObjectId or legacy string session_ids.
        """
        if session_id is None:
            return []
        variants: list = []
        if isinstance(session_id, ObjectId):
            variants.append(session_id)
            variants.append(str(session_id))
            return variants
        session_str = str(session_id)
        try:
            variants.append(ObjectId(session_str))
        except Exception:
            pass
        variants.append(session_str)
        return variants

    @handle_database_errors
    async def create(self, metadata: dict | None = None, user_id: str | None = None) -> Session:
        """
        Create a new session.
        If user_id is provided, stores in new format (one doc per user with nested sessions).
        If no user_id, uses legacy format for backward compatibility.
        """
        now = datetime.now(timezone.utc)
        session_id = uuid4().hex
        
        if user_id:
            # New format: one document per user with nested sessions
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Check if user document exists and has previous sessions
            user_doc = await self.collection.find_one({"_id": user_oid})
            
            # Check if user has previous sessions (excluding the current one being created)
            has_previous_sessions = False
            if user_doc:
                existing_sessions = user_doc.get("sessions", [])
                # Check if there are any completed sessions (sessions with messages or completed onboarding)
                for sess in existing_sessions:
                    if sess.get("messages") or sess.get("metadata", {}).get("onboarding", {}).get("complete"):
                        has_previous_sessions = True
                        break
            
            # Store has_previous_sessions in metadata
            if metadata is None:
                metadata = {}
            metadata["has_previous_sessions"] = has_previous_sessions
            
            new_session = {
                "session_id": session_id,
                "session_name": None,  # Will be set later when generated
                "messages": [],
                "metadata": metadata or {},
                "created_at": now,
                "updated_at": now
            }
            
            if user_doc:
                # Add session to existing user document
                await self.collection.find_one_and_update(
                    {"_id": user_oid},
                    {
                        "$push": {"sessions": new_session},
                        "$set": {"updated_at": now}
                    }
                )
            else:
                # Create new user document
                await self.collection.insert_one({
                    "_id": user_oid,
                    "user_id": user_oid,
                    "sessions": [new_session],
                    "created_at": now,
                    "updated_at": now
                })
        else:
            # Legacy format: one document per session (for backward compatibility)
            payload = {
                "_id": session_id,
                "session_name": None,  # Will be set later when generated
                "messages": [],
                "metadata": metadata or {},
                "created_at": now,
                "updated_at": now,
            }
            await self.collection.insert_one(payload)
        
        return Session(id=session_id, messages=[], metadata=metadata, created_at=now, updated_at=now)

    @handle_database_errors
    async def get(self, session_id: str, user_id: str | None = None) -> Session | None:
        """
        Get a session by session_id.
        If user_id is provided, searches in new format (nested sessions).
        Otherwise, tries legacy format first, then searches across all users.
        """
        if user_id:
            # New format: find session within user's sessions array
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user_doc = await self.collection.find_one(
                {"_id": user_oid, "sessions.session_id": session_id},
                {"sessions.$": 1}
            )
            
            if not user_doc or not user_doc.get("sessions"):
                return None
            
            session_doc = user_doc["sessions"][0]
            return self._nested_session_to_session(session_doc, session_id)
        else:
            # First try legacy format: direct lookup by session_id as _id
            doc = await self.collection.find_one({"_id": session_id})
            if doc:
                return self._document_to_session(doc)
            
            # If not found, search across all user documents for nested sessions
            # This handles cases where session was created with user_id but we don't have it
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"sessions.$": 1}
            )
            
            if user_doc and user_doc.get("sessions"):
                session_doc = user_doc["sessions"][0]
                return self._nested_session_to_session(session_doc, session_id)
            
            return None

    @handle_database_errors
    async def append_messages(self, session_id: str, messages: list[ChatMessage], user_id: str | None = None) -> Session | None:
        """
        Append messages to a session.
        If user_id is provided, updates in new format (nested sessions).
        Otherwise, tries legacy format first, then searches across all users.
        """
        now = datetime.now(timezone.utc)
        serialized = []
        for msg in messages:
            msg_dict = msg.model_dump()
            if "created_at" not in msg_dict:
                msg_dict["created_at"] = now
            serialized.append(msg_dict)
        
        # If user_id not provided, try to find it by searching for the session
        if not user_id:
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"_id": 1, "sessions.$": 1}
            )
            if user_doc:
                user_id = str(user_doc["_id"])
        
        if user_id:
            # New format: update messages within nested session
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Get current session to find message count
            user_doc = await self.collection.find_one(
                {"_id": user_oid, "sessions.session_id": session_id},
                {"sessions.$": 1}
            )
            
            if not user_doc or not user_doc.get("sessions"):
                return None
            
            current_messages = user_doc["sessions"][0].get("messages", [])
            # Store ALL messages from start to end (no limit for storage)
            # The limit is only applied when sending to OpenAI API for context
            all_messages = current_messages + serialized
            
            # Update messages in nested session
            updated = await self.collection.find_one_and_update(
                {"_id": user_oid, "sessions.session_id": session_id},
                {
                    "$set": {
                        "sessions.$.messages": all_messages,
                        "sessions.$.updated_at": now,
                        "updated_at": now
                    }
                },
                return_document=ReturnDocument.AFTER
            )
            
            if not updated:
                return None
            
            # Find the updated session
            for session in updated.get("sessions", []):
                if session.get("session_id") == session_id:
                    return self._nested_session_to_session(session, session_id)
            return None
        else:
            # Try legacy format first: direct update
            # Store ALL messages from start to end (no limit for storage)
            updated = await self.collection.find_one_and_update(
                {"_id": session_id},
                {
                    "$push": {
                        "messages": {
                            "$each": serialized,
                            # No $slice - store all messages
                        }
                    },
                    "$set": {"updated_at": now},
                },
                return_document=ReturnDocument.AFTER,
            )
            if updated:
                return self._document_to_session(updated)
            
            # If not found in legacy format, try to find in nested format
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"sessions.$": 1}
            )
            if user_doc and user_doc.get("sessions"):
                # Found in nested format, but we need user_id to update
                # This shouldn't happen if user_id was extracted above, but handle it anyway
                user_id = str(user_doc["_id"])
                user_oid = ObjectId(user_id)
                
                # Get current messages
                current_messages = user_doc["sessions"][0].get("messages", [])
                # Store ALL messages from start to end (no limit for storage)
                all_messages = current_messages + serialized
                
                # Update in nested format
                updated = await self.collection.find_one_and_update(
                    {"_id": user_oid, "sessions.session_id": session_id},
                    {
                        "$set": {
                            "sessions.$.messages": all_messages,
                            "sessions.$.updated_at": now,
                            "updated_at": now
                        }
                    },
                    return_document=ReturnDocument.AFTER
                )
                
                if updated:
                    for session in updated.get("sessions", []):
                        if session.get("session_id") == session_id:
                            return self._nested_session_to_session(session, session_id)
            
            return None

    @handle_database_errors
    async def update_session_name(self, session_id: str, session_name: str, user_id: str | None = None) -> Session | None:
        """
        Update session_name for a session.
        If user_id is provided, updates in new format (nested sessions).
        Otherwise, tries legacy format first, then searches across all users.
        """
        now = datetime.now(timezone.utc)
        
        # If user_id not provided, try to find it by searching for the session
        if not user_id:
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"_id": 1, "sessions.$": 1}
            )
            if user_doc:
                user_id = str(user_doc["_id"])
        
        if user_id:
            # New format: update session_name within nested session
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            updated = await self.collection.find_one_and_update(
                {"_id": user_oid, "sessions.session_id": session_id},
                {
                    "$set": {
                        "sessions.$.session_name": session_name,
                        "sessions.$.updated_at": now,
                        "updated_at": now
                    }
                },
                return_document=ReturnDocument.AFTER
            )
            
            if not updated:
                return None
            
            # Find the updated session
            for session in updated.get("sessions", []):
                if session.get("session_id") == session_id:
                    return self._nested_session_to_session(session, session_id)
            return None
        else:
            # Try legacy format first: direct update
            updated = await self.collection.find_one_and_update(
                {"_id": session_id},
                {"$set": {"session_name": session_name, "updated_at": now}},
                return_document=ReturnDocument.AFTER
            )
            
            if updated:
                return self._document_to_session(updated)
            
            # If not found, search across all user documents for nested sessions
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"_id": 1, "sessions.$": 1}
            )
            if user_doc and user_doc.get("sessions"):
                user_id = str(user_doc["_id"])
                user_oid = ObjectId(user_id)
                
                updated = await self.collection.find_one_and_update(
                    {"_id": user_oid, "sessions.session_id": session_id},
                    {
                        "$set": {
                            "sessions.$.session_name": session_name,
                            "sessions.$.updated_at": now,
                            "updated_at": now
                        }
                    },
                    return_document=ReturnDocument.AFTER
                )
                
                if updated:
                    for session in updated.get("sessions", []):
                        if session.get("session_id") == session_id:
                            return self._nested_session_to_session(session, session_id)
            
            return None

    async def update_metadata(self, session_id: str, metadata: dict, user_id: str | None = None) -> Session | None:
        """
        Update session metadata.
        If user_id is provided, updates in new format (nested sessions).
        Otherwise, tries legacy format first, then searches across all users.
        """
        now = datetime.now(timezone.utc)
        
        # If user_id not provided, try to find it by searching for the session
        if not user_id:
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"_id": 1, "sessions.$": 1}
            )
            if user_doc:
                user_id = str(user_doc["_id"])
        
        if user_id:
            # New format: update metadata within nested session
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            updated = await self.collection.find_one_and_update(
                {"_id": user_oid, "sessions.session_id": session_id},
                {
                    "$set": {
                        "sessions.$.metadata": metadata,
                        "sessions.$.updated_at": now,
                        "updated_at": now
                    }
                },
                return_document=ReturnDocument.AFTER
            )
            
            if not updated:
                return None
            
            # Find the updated session
            for session in updated.get("sessions", []):
                if session.get("session_id") == session_id:
                    return self._nested_session_to_session(session, session_id)
            return None
        else:
            # Try legacy format first: direct update
            updated = await self.collection.find_one_and_update(
                {"_id": session_id},
                {"$set": {"metadata": metadata, "updated_at": now}},
                return_document=ReturnDocument.AFTER,
            )
            if updated:
                return self._document_to_session(updated)
            
            # If not found in legacy format, try to find in nested format
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"_id": 1, "sessions.$": 1}
            )
            if user_doc and user_doc.get("sessions"):
                # Found in nested format, update it
                user_id = str(user_doc["_id"])
                user_oid = ObjectId(user_id)
                
                updated = await self.collection.find_one_and_update(
                    {"_id": user_oid, "sessions.session_id": session_id},
                    {
                        "$set": {
                            "sessions.$.metadata": metadata,
                            "sessions.$.updated_at": now,
                            "updated_at": now
                        }
                    },
                    return_document=ReturnDocument.AFTER
                )
                
                if updated:
                    for session in updated.get("sessions", []):
                        if session.get("session_id") == session_id:
                            return self._nested_session_to_session(session, session_id)
            
            return None

    @staticmethod
    def _document_to_session(doc: dict) -> Session:
        """Convert legacy document format to Session model."""
        messages = []
        for msg in doc.get("messages", []):
            # Ensure created_at exists
            if "created_at" not in msg:
                msg["created_at"] = doc.get("created_at")
            messages.append(ChatMessage(**msg))
        
        return Session(
            id=doc["_id"],
            messages=messages,
            metadata=doc.get("metadata", {}),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )

    async def link_session_to_user(self, session_id: str, user_id: str) -> Session | None:
        """
        Link a session (created without user_id) to a user_id.
        Moves the session from legacy format to nested format within user document.
        
        Args:
            session_id: The session ID to link
            user_id: The user ID to link the session to
            
        Returns:
            The updated Session if successful, None otherwise
        """
        now = datetime.now(timezone.utc)
        user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # First, find the session in legacy format (by session_id as _id)
        legacy_doc = await self.collection.find_one({"_id": session_id})
        
        if not legacy_doc:
            # Session not found in legacy format, check if already linked
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"sessions.$": 1, "_id": 1}
            )
            if user_doc and user_doc.get("sessions"):
                # Already linked, just update metadata with user_id if not present
                session_doc = user_doc["sessions"][0]
                current_metadata = session_doc.get("metadata", {})
                if "user_id" not in current_metadata:
                    # Normalize user_id to string for consistent storage in metadata
                    from app.utils.validation import normalize_user_id
                    current_metadata["user_id"] = normalize_user_id(user_id)
                    await self.collection.find_one_and_update(
                        {"_id": user_oid, "sessions.session_id": session_id},
                        {
                            "$set": {
                                "sessions.$.metadata": current_metadata,
                                "sessions.$.updated_at": now,
                                "updated_at": now
                            }
                        }
                    )
                return self._nested_session_to_session(session_doc, session_id)
            return None
        
        # Extract session data from legacy document
        session_id_value = legacy_doc.get("_id", session_id)
        if not isinstance(session_id_value, ObjectId):
            try:
                session_id_value = ObjectId(session_id_value)
            except Exception:
                pass

        session_data = {
            "session_id": session_id_value,
            "session_name": legacy_doc.get("session_name"),  # Preserve existing session_name if any
            "messages": legacy_doc.get("messages", []),
            "metadata": legacy_doc.get("metadata", {}),
            "created_at": legacy_doc.get("created_at", now),
            "updated_at": legacy_doc.get("updated_at", now)
        }
        
        # Add user_id to metadata (normalized to string for consistency)
        if "user_id" not in session_data["metadata"]:
            from app.utils.validation import normalize_user_id
            session_data["metadata"]["user_id"] = normalize_user_id(user_id)
        
        # Check if user document exists
        user_doc = await self.collection.find_one({"_id": user_oid})
        
        if user_doc:
            # User document exists, add session to it
            await self.collection.find_one_and_update(
                {"_id": user_oid},
                {
                    "$push": {"sessions": session_data},
                    "$set": {"updated_at": now}
                }
            )
        else:
            # Create new user document with this session
            await self.collection.insert_one({
                "_id": user_oid,
                "user_id": user_oid,
                "sessions": [session_data],
                "created_at": now,
                "updated_at": now
            })
        
        # Delete the legacy document
        await self.collection.delete_one({"_id": {"$in": self._session_id_variants(session_id_value)}})
        
        # Return the session
        return Session(
            id=self._session_id_to_str(session_id_value),
            messages=[ChatMessage(**msg) for msg in session_data["messages"]],
            metadata=session_data["metadata"],
            created_at=session_data["created_at"],
            updated_at=session_data["updated_at"],
        )

    @staticmethod
    def _nested_session_to_session(session_doc: dict, session_id: str) -> Session:
        """Convert nested session document to Session model."""
        messages = []
        for msg in session_doc.get("messages", []):
            # Ensure created_at exists
            if "created_at" not in msg:
                msg["created_at"] = session_doc.get("created_at")
            messages.append(ChatMessage(**msg))
        session_id_value = session_doc.get("session_id", session_id)
        if isinstance(session_id_value, ObjectId):
            session_id_value = str(session_id_value)
        else:
            session_id_value = str(session_id_value) if session_id_value is not None else str(session_id)
        return Session(
            id=session_id_value,
            messages=messages,
            metadata=session_doc.get("metadata", {}),
            created_at=session_doc.get("created_at"),
            updated_at=session_doc.get("updated_at"),
        )

    async def search_word_in_messages(
        self, user_id: str, search_word: str
    ) -> list[dict]:
        """
        Search for a word in all messages across all sessions for a given user.
        Returns a list of matches grouped by session_id, sorted by session created_at (latest first).
        
        Args:
            user_id: The user ID to search for
            search_word: The word to search for (case-insensitive)
            
        Returns:
            List of dicts grouped by session_id, each containing:
            - session_id: The session ID where the word was found
            - session_name: The session name if available
            - date: The session created_at date
            - messages: Array of message objects with:
            - message_index: The index in the messages array where the word was found
            - role: The role of the message (user/assistant)
            - content: The message content containing the word
        """
        from bson import ObjectId
        
        user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
        
        # Get user document
        user_doc = await self.collection.find_one({"_id": user_oid})
        
        if not user_doc:
            return []
        
        # Dictionary to group results by session_id
        session_results = {}
        search_word_lower = search_word.lower()
        
        # Search through all sessions
        sessions = user_doc.get("sessions", [])
        for session in sessions:
            session_id = session.get("session_id")
            session_name = session.get("session_name")
            created_at = session.get("created_at")
            messages = session.get("messages", [])
            
            # Format date as ISO string if available
            date_str = None
            if created_at:
                if isinstance(created_at, datetime):
                    date_str = created_at.isoformat()
                else:
                    date_str = str(created_at)
            
            # Search through all messages in this session
            session_messages = []
            for index, message in enumerate(messages):
                content = message.get("content", "")
                if search_word_lower in content.lower():
                    session_messages.append({
                        "message_index": index,
                        "role": message.get("role", "unknown"),
                        "content": content
                    })
            
            # Only add session if it has matching messages
            if session_messages:
                session_results[session_id] = {
                    "session_id": session_id,
                    "session_name": session_name,
                    "date": date_str,
                    "messages": session_messages
                }
        
        # Sort sessions by created_at (latest first)
        session_dates = {}
        for session in sessions:
            session_id = session.get("session_id")
            created_at = session.get("created_at")
            if created_at:
                if isinstance(created_at, datetime):
                    session_dates[session_id] = created_at
                elif isinstance(created_at, str):
                    try:
                        # Try parsing ISO format string
                        session_dates[session_id] = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    except:
                        try:
                            from dateutil import parser
                            session_dates[session_id] = parser.parse(created_at)
                        except:
                            session_dates[session_id] = datetime.min
                else:
                    session_dates[session_id] = datetime.min
            else:
                session_dates[session_id] = datetime.min
        
        # Convert to list and sort by session created_at (latest first)
        results = list(session_results.values())
        
        def sort_key(x):
            session_date = session_dates.get(x["session_id"], datetime.min)
            if isinstance(session_date, datetime) and session_date != datetime.min:
                # Use negative timestamp for reverse sort (latest first)
                timestamp = -session_date.timestamp()
            else:
                timestamp = 0
            return timestamp
        
        results.sort(key=sort_key)
        
        # Sort messages within each session by message_index (chronological order)
        for result in results:
            result["messages"].sort(key=lambda x: x["message_index"])
        
        return results

    @handle_database_errors
    async def get_sessions_for_user(self, user_id: str) -> list[dict] | None:
        """
        Return lightweight session info (id/name/timestamps) for a user.
        """
        user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
        doc = await self.collection.find_one({"_id": user_oid}, {"sessions": 1})
        if not doc:
            return None
        sessions = doc.get("sessions", []) or []
        normalized = []
        for session in sessions:
            normalized.append(
                {
                    "session_id": self._session_id_to_str(session.get("session_id")),
                    "session_name": session.get("session_name"),
                    "created_at": session.get("created_at"),
                    "updated_at": session.get("updated_at"),
                }
            )
        return normalized

    @handle_database_errors
    async def update_token_usage(
        self, session_id: str, usage_info: dict, user_id: str | None = None
    ) -> Session | None:
        """
        Update token usage statistics for a session.
        Accumulates tokens and cost across all API calls in the session.
        
        Args:
            session_id: The session ID
            usage_info: Dict with keys: input_tokens, output_tokens, total_tokens, cost, model
            user_id: Optional user ID for nested format
        """
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        session_id_variants = self._session_id_variants(session_id)
        session_id_str = self._session_id_to_str(session_id)
        
        # Try nested format first if user_id is provided
        if user_id:
            try:
                user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
                
                logger.debug(f"Attempting to update token usage in nested format: user_id={user_id}, session_id={session_id}")
                
                # Get current session to retrieve existing token usage
                user_doc = await self.collection.find_one(
                    {"_id": user_oid, "sessions.session_id": {"$in": session_id_variants}},
                    {"sessions.$": 1}
                )
                
                if user_doc and user_doc.get("sessions"):
                    session = user_doc["sessions"][0]
                    current_metadata = session.get("metadata", {})
                    current_usage = current_metadata.get("token_usage", {
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "total_tokens": 0,
                        "cost": 0.0,
                        "model": usage_info.get("model", "unknown"),
                        "api_calls": 0
                    })
                    
                    logger.debug(
                        f"Current token usage: {current_usage}, "
                        f"New usage: input={usage_info.get('input_tokens')}, "
                        f"output={usage_info.get('output_tokens')}, cost=${usage_info.get('cost', 0):.6f}"
                    )
                    
                    # Accumulate token usage
                    updated_usage = {
                        "input_tokens": current_usage.get("input_tokens", 0) + usage_info.get("input_tokens", 0),
                        "output_tokens": current_usage.get("output_tokens", 0) + usage_info.get("output_tokens", 0),
                        "total_tokens": current_usage.get("total_tokens", 0) + usage_info.get("total_tokens", 0),
                        "cost": current_usage.get("cost", 0.0) + usage_info.get("cost", 0.0),
                        "model": usage_info.get("model", current_usage.get("model", "unknown")),
                        "api_calls": current_usage.get("api_calls", 0) + 1,
                        "last_updated": now.isoformat()
                    }
                    
                    logger.debug(f"Updated token usage will be: {updated_usage}")
                    
                    # Update metadata with accumulated token usage
                    updated_metadata = {**current_metadata, "token_usage": updated_usage}
                    
                    updated = await self.collection.find_one_and_update(
                        {"_id": user_oid, "sessions.session_id": {"$in": session_id_variants}},
                        {
                            "$set": {
                                "sessions.$.metadata": updated_metadata,
                                "sessions.$.updated_at": now,
                                "updated_at": now
                            }
                        },
                        return_document=ReturnDocument.AFTER
                    )
                    
                    if updated:
                        for session in updated.get("sessions", []):
                            if self._session_id_to_str(session.get("session_id")) == session_id_str:
                                logger.info(
                                    f"✅ Token usage updated successfully for session {session_id} with user_id {user_id}: "
                                    f"input={updated_usage['input_tokens']}, output={updated_usage['output_tokens']}, "
                                    f"cost=${updated_usage['cost']:.6f}, api_calls={updated_usage['api_calls']}"
                                )
                                return self._nested_session_to_session(session, session_id)
                        logger.warning(f"find_one_and_update returned None for session {session_id} with user_id {user_id}")
                    else:
                        logger.warning(f"find_one_and_update returned None for session {session_id} with user_id {user_id}")
                else:
                    logger.warning(
                        f"Session {session_id} not found in nested format for user_id {user_id}. "
                        f"user_doc exists: {user_doc is not None}, sessions found: {user_doc.get('sessions') if user_doc else None}"
                    )
            except Exception as e:
                logger.error(f"Exception updating token usage in nested format for session {session_id} with user_id {user_id}: {e}", exc_info=True)
                # Fall through to try legacy format or search
        
        # Try to find session in nested format by searching (if user_id wasn't provided or nested update failed)
        if not user_id:
            logger.debug(f"user_id not provided, searching for session {session_id} in nested format")
            user_doc = await self.collection.find_one(
                {"sessions.session_id": {"$in": session_id_variants}},
                {"_id": 1, "sessions.$": 1}
            )
            if user_doc and user_doc.get("sessions"):
                user_id = str(user_doc["_id"])
                logger.info(f"Found session {session_id} in nested format for user_id {user_id}, retrying update")
                # Retry with found user_id
                return await self.update_token_usage(session_id, usage_info, user_id)
        
        # Try legacy format: update in flat document
        logger.debug(f"Attempting to update token usage in legacy format for session {session_id}")
        try:
            session_doc = await self.collection.find_one({"_id": {"$in": session_id_variants}})
            if session_doc:
                current_metadata = session_doc.get("metadata", {})
                current_usage = current_metadata.get("token_usage", {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "cost": 0.0,
                    "model": usage_info.get("model", "unknown"),
                    "api_calls": 0
                })
                
                # Accumulate token usage
                updated_usage = {
                    "input_tokens": current_usage.get("input_tokens", 0) + usage_info.get("input_tokens", 0),
                    "output_tokens": current_usage.get("output_tokens", 0) + usage_info.get("output_tokens", 0),
                    "total_tokens": current_usage.get("total_tokens", 0) + usage_info.get("total_tokens", 0),
                    "cost": current_usage.get("cost", 0.0) + usage_info.get("cost", 0.0),
                    "model": usage_info.get("model", current_usage.get("model", "unknown")),
                    "api_calls": current_usage.get("api_calls", 0) + 1,
                    "last_updated": now.isoformat()
                }
                
                # Update metadata with accumulated token usage
                updated_metadata = {**current_metadata, "token_usage": updated_usage}
                
                updated = await self.collection.find_one_and_update(
                    {"_id": {"$in": session_id_variants}},
                    {
                        "$set": {
                            "metadata": updated_metadata,
                            "updated_at": now
                        }
                    },
                    return_document=ReturnDocument.AFTER
                )
                
                if updated:
                    logger.info(
                        f"✅ Token usage updated successfully for legacy session {session_id}: "
                        f"input={updated_usage['input_tokens']}, output={updated_usage['output_tokens']}, "
                        f"cost=${updated_usage['cost']:.6f}, api_calls={updated_usage['api_calls']}"
                    )
                    return self._document_to_session(updated)
                else:
                    logger.warning(f"find_one_and_update returned None for legacy session {session_id}")
            else:
                logger.warning(f"Legacy session document not found for session_id {session_id}")
        except Exception as e:
            logger.error(f"Exception updating token usage in legacy format for session {session_id}: {e}", exc_info=True)
        
        logger.error(
            f"❌ Failed to update token usage: session {session_id} not found in any format. "
            f"user_id was: {user_id}"
        )
        return None

    @handle_database_errors
    async def delete_session(self, session_id: str, user_id: str | None = None) -> bool:
        """
        Delete a session from ai_conversations collection.
        If user_id is provided, removes session from nested sessions array.
        Otherwise, tries legacy format (deletes document directly).
        
        Args:
            session_id: The session ID to delete
            user_id: Optional user ID for nested format
            
        Returns:
            True if session was found and deleted, False otherwise
        """
        session_id_variants = self._session_id_variants(session_id)
        if user_id:
            # New format: remove session from nested sessions array
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Check if session exists in user's sessions
            user_doc = await self.collection.find_one(
                {"_id": user_oid, "sessions.session_id": {"$in": session_id_variants}},
                {"sessions.$": 1}
            )
            
            if user_doc and user_doc.get("sessions"):
                # Remove the session from the array
                result = await self.collection.update_one(
                    {"_id": user_oid, "sessions.session_id": {"$in": session_id_variants}},
                    {
                        "$pull": {"sessions": {"session_id": {"$in": session_id_variants}}},
                        "$set": {"updated_at": datetime.now(timezone.utc)}
                    }
                )
                return result.modified_count > 0
            return False
        else:
            # Legacy format: delete document directly
            result = await self.collection.delete_one({"_id": {"$in": session_id_variants}})
            if result.deleted_count > 0:
                return True
            
            # If not found in legacy format, try to find in nested format
            # Search across all users for this session_id
            user_doc = await self.collection.find_one(
                {"sessions.session_id": {"$in": session_id_variants}},
                {"_id": 1, "sessions.$": 1}
            )
            
            if user_doc:
                user_oid = user_doc["_id"]
                result = await self.collection.update_one(
                    {"_id": user_oid, "sessions.session_id": {"$in": session_id_variants}},
                    {
                        "$pull": {"sessions": {"session_id": {"$in": session_id_variants}}},
                        "$set": {"updated_at": datetime.now(timezone.utc)}
                    }
                )
                return result.modified_count > 0
            
            return False
