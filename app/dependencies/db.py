import logging
from collections.abc import AsyncIterator
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.config.settings import settings
from app.exceptions.errors import DatabaseConnectionError

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient | None = None


async def get_client() -> AsyncIOMotorClient:
    """Get or create MongoDB client with error handling."""
    global client
    if client is None:
        try:
            client = AsyncIOMotorClient(
                settings.mongo_uri,
                serverSelectionTimeoutMS=5000,  # 5 second timeout
                connectTimeoutMS=5000,
                socketTimeoutMS=30000,
            )
            # Test connection
            await client.admin.command("ping")
            logger.info("MongoDB connection established successfully")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Failed to connect to MongoDB: {e}", exc_info=True)
            client = None
            raise DatabaseConnectionError(
                message="Failed to establish database connection",
                details={"error": str(e)}
            ) from e
        except Exception as e:
            logger.error(f"Unexpected error connecting to MongoDB: {e}", exc_info=True)
            client = None
            raise DatabaseConnectionError(
                message="Unexpected error connecting to database",
                details={"error": str(e), "type": type(e).__name__}
            ) from e
    return client


async def get_database() -> AsyncIterator[AsyncIOMotorDatabase]:
    """Get database instance with error handling."""
    try:
        motor_client = await get_client()
        db = motor_client[settings.mongo_db]
        yield db
    except DatabaseConnectionError:
        raise
    except Exception as e:
        logger.error(f"Error getting database instance: {e}", exc_info=True)
        raise DatabaseConnectionError(
            message="Failed to get database instance",
            details={"error": str(e)}
        ) from e


async def close_client() -> None:
    """Close MongoDB client connection."""
    global client
    if client:
        try:
            client.close()
            logger.info("MongoDB connection closed")
        except Exception as e:
            logger.warning(f"Error closing MongoDB connection: {e}")
        finally:
            client = None
