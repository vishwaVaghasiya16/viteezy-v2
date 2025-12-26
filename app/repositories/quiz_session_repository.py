import logging
from datetime import datetime, timezone
from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase
from app.config.settings import settings
from app.utils.error_handler import handle_database_errors

logger = logging.getLogger(__name__)


class QuizSessionRepository:
    """
    Repository for quiz_sessions collection.
    Stores one document per user with a flat list of quiz sessions.
    """
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection: AsyncIOMotorCollection = db[settings.mongo_quiz_sessions_collection]

    @staticmethod
    def _session_id_variants(session_id: str | ObjectId) -> list:
        """
        Build variants to match both ObjectId-based session_ids and legacy string ids.
        """
        variants: list = []
        if isinstance(session_id, ObjectId):
            variants.append(session_id)
            variants.append(str(session_id))
            return variants
        session_id_str = str(session_id)
        try:
            variants.append(ObjectId(session_id_str))
        except Exception:
            pass
        variants.append(session_id_str)
        return variants

    @staticmethod
    def _session_id_to_store(session_id: str | ObjectId) -> ObjectId | str:
        """Convert incoming session_id to ObjectId when possible for storage."""
        if isinstance(session_id, ObjectId):
            return session_id
        try:
            return ObjectId(session_id)
        except Exception:
            return str(session_id)

    @staticmethod
    def _session_id_to_str(session_id: str | ObjectId | None) -> str:
        if isinstance(session_id, ObjectId):
            return str(session_id)
        return str(session_id) if session_id is not None else ""

    @handle_database_errors
    async def add_session(self, user_id: str, session_id: str) -> bool:
        """
        Add a quiz session entry for a user.
        Creates a new document if user doesn't exist, or appends to existing.
        
        Args:
            user_id: User ObjectId as string
            session_id: Session ID string
            
        Returns:
            True if successful
        """
        now = datetime.now(timezone.utc)
        user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
        session_id_value = self._session_id_to_store(session_id)
        
        # Try to find existing document for this user
        existing = await self.collection.find_one({"_id": user_oid})
        
        session_entry = {
            "session_id": session_id_value,
            "session_name": None  # Will be updated later when session_name is generated
        }
        
        if existing:
            # Update existing document - add session to array
            await self.collection.find_one_and_update(
                {"_id": user_oid},
                {
                    "$push": {"session_data": session_entry},
                    "$set": {"updated_at": now}
                },
                upsert=False
            )
        else:
            # Create new document
            await self.collection.insert_one({
                "_id": user_oid,
                "user_id": user_oid,
                "session_data": [session_entry],
                "created_at": now,
                "updated_at": now
            })
        
        return True

    @handle_database_errors
    async def get_user_sessions(self, user_id: str) -> list[dict] | None:
        """
        Get all quiz sessions for a user.
        
        Args:
            user_id: User ObjectId as string
            
        Returns:
            List of session data entries or None if user not found
        """
        user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
        doc = await self.collection.find_one({"_id": user_oid})
        
        if not doc:
            return None
        
        sessions = doc.get("session_data", [])
        # Normalize session_id to string for API consumers
        normalized = []
        for session in sessions:
            normalized.append(
                {
                    **session,
                    "session_id": self._session_id_to_str(session.get("session_id"))
                }
            )
        return normalized

    @handle_database_errors
    async def delete_session(self, user_id: str, session_id: str) -> bool:
        """
        Delete a quiz session entry from quiz_sessions collection.
        Removes the session entry from the user's session_data array.
        
        Args:
            user_id: User ObjectId as string
            session_id: Session ID to delete
            
        Returns:
            True if session was found and deleted, False otherwise
        """
        user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
        session_id_variants = self._session_id_variants(session_id)
        
        # Remove session from session_data array
        result = await self.collection.update_one(
            {"_id": user_oid},
            {
                "$pull": {"session_data": {"session_id": {"$in": session_id_variants}}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return result.modified_count > 0

    @handle_database_errors
    async def update_session_name(self, user_id: str, session_id: str, session_name: str) -> bool:
        """
        Update session_name for a specific session in quiz_sessions collection.
        If the session doesn't exist, it will be added.
        
        Args:
            user_id: User ObjectId as string
            session_id: Session ID to update
            session_name: The session name to set
            
        Returns:
            True if session was found and updated or added, False otherwise
        """
        user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
        now = datetime.now(timezone.utc)
        session_id_variants = self._session_id_variants(session_id)
        session_id_value = self._session_id_to_store(session_id)
        
        # First, try to update existing session
        result = await self.collection.update_one(
            {"_id": user_oid, "session_data.session_id": {"$in": session_id_variants}},
            {
                "$set": {
                    "session_data.$.session_name": session_name,
                    "updated_at": now
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"Updated session_name for session {session_id} in quiz_sessions for user {user_id}")
            return True
        
        # If session doesn't exist, check if user document exists
        user_doc = await self.collection.find_one({"_id": user_oid})
        
        if user_doc:
            # User exists but session doesn't - add the session with session_name
            session_entry = {
                "session_id": session_id_value,
                "session_name": session_name
            }
            await self.collection.update_one(
                {"_id": user_oid},
                {
                    "$push": {"session_data": session_entry},
                    "$set": {"updated_at": now}
                }
            )
            logger.info(f"Added session {session_id} with session_name to quiz_sessions for user {user_id}")
            return True
        else:
            # User doesn't exist - create new document with session
            session_entry = {
                "session_id": session_id_value,
                "session_name": session_name
            }
            await self.collection.insert_one({
                "_id": user_oid,
                "user_id": user_oid,
                "session_data": [session_entry],
                "created_at": now,
                "updated_at": now
            })
            logger.info(f"Created new quiz_sessions document for user {user_id} with session {session_id} and session_name")
            return True
