from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase

from app.config.settings import settings


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection: AsyncIOMotorCollection = db["users"]

    async def user_exists(self, user_id: str) -> bool:
        """Check if user exists in users collection by ObjectId."""
        try:
            # Convert string to ObjectId
            object_id = ObjectId(user_id)
            user = await self.collection.find_one({"_id": object_id})
            return user is not None
        except Exception:
            # Invalid ObjectId format or other error
            return False

