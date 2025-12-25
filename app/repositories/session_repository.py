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
                    current_metadata["user_id"] = user_id
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
        session_data = {
            "session_id": session_id,
            "messages": legacy_doc.get("messages", []),
            "metadata": legacy_doc.get("metadata", {}),
            "created_at": legacy_doc.get("created_at", now),
            "updated_at": legacy_doc.get("updated_at", now)
        }
        
        # Add user_id to metadata
        if "user_id" not in session_data["metadata"]:
            session_data["metadata"]["user_id"] = user_id
        
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
        await self.collection.delete_one({"_id": session_id})
        
        # Return the session
        return Session(
            id=session_id,
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
        
        return Session(
            id=session_id,
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
        Returns a list of matches with session_id and message index.
        
        Args:
            user_id: The user ID to search for
            search_word: The word to search for (case-insensitive)
            
        Returns:
            List of dicts with:
            - session_id: The session ID where the word was found
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
        
        results = []
        search_word_lower = search_word.lower()
        
        # Search through all sessions
        sessions = user_doc.get("sessions", [])
        for session in sessions:
            session_id = session.get("session_id")
            messages = session.get("messages", [])
            
            # Search through all messages in this session
            for index, message in enumerate(messages):
                content = message.get("content", "")
                if search_word_lower in content.lower():
                    results.append({
                        "session_id": session_id,
                        "message_index": index,
                        "role": message.get("role", "unknown"),
                        "content": content
                    })
        
        return results

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
        
        if user_id:
            # New format: update in nested sessions
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Get current session to retrieve existing token usage
            user_doc = await self.collection.find_one(
                {"_id": user_oid, "sessions.session_id": session_id},
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
                    {"_id": user_oid, "sessions.session_id": session_id},
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
                        if session.get("session_id") == session_id:
                            return self._nested_session_to_session(session, session_id)
        else:
            # Legacy format: update in flat document
            session_doc = await self.collection.find_one({"_id": session_id})
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
                    {"_id": session_id},
                    {
                        "$set": {
                            "metadata": updated_metadata,
                            "updated_at": now
                        }
                    },
                    return_document=ReturnDocument.AFTER
                )
                
                if updated:
                    return self._document_to_session(updated)
        
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
        if user_id:
            # New format: remove session from nested sessions array
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Check if session exists in user's sessions
            user_doc = await self.collection.find_one(
                {"_id": user_oid, "sessions.session_id": session_id},
                {"sessions.$": 1}
            )
            
            if user_doc and user_doc.get("sessions"):
                # Remove the session from the array
                result = await self.collection.update_one(
                    {"_id": user_oid, "sessions.session_id": session_id},
                    {
                        "$pull": {"sessions": {"session_id": session_id}},
                        "$set": {"updated_at": datetime.now(timezone.utc)}
                    }
                )
                return result.modified_count > 0
            return False
        else:
            # Legacy format: delete document directly
            result = await self.collection.delete_one({"_id": session_id})
            if result.deleted_count > 0:
                return True
            
            # If not found in legacy format, try to find in nested format
            # Search across all users for this session_id
            user_doc = await self.collection.find_one(
                {"sessions.session_id": session_id},
                {"_id": 1, "sessions.$": 1}
            )
            
            if user_doc:
                user_oid = user_doc["_id"]
                result = await self.collection.update_one(
                    {"_id": user_oid, "sessions.session_id": session_id},
                    {
                        "$pull": {"sessions": {"session_id": session_id}},
                        "$set": {"updated_at": datetime.now(timezone.utc)}
                    }
                )
                return result.modified_count > 0
            
            return False
