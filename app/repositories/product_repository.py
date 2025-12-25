from typing import Any

from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase

from app.config.settings import settings


class ProductRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection: AsyncIOMotorCollection = db[settings.mongo_products_collection]

    async def search(
        self,
        message_terms: list[str] | None = None,
        health_goals: list[str] | None = None,
        limit: int = 3,
        include_product_titles: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Return raw product documents matching health goals or message keywords."""
        filters: dict[str, Any] = {
            "status": True,  # Changed from "Active" to True (boolean) to match temp_product format
            "isDeleted": {"$ne": True},
        }

        # If include_product_titles is specified, search only for those specific products
        if include_product_titles:
            title_filters = []
            for title in include_product_titles:
                # Search in multilingual title fields
                title_filters.extend([
                    {"title.en": {"$regex": title, "$options": "i"}},
                    {"title.nl": {"$regex": title, "$options": "i"}},
                    {"title.de": {"$regex": title, "$options": "i"}},
                    {"title": {"$regex": title, "$options": "i"}},
                ])
            if title_filters:
                filters["$or"] = title_filters
            # Return early with just these products
            products = await self.collection.find(filters).limit(limit).to_list(length=limit)
            return products

        or_clauses: list[dict[str, Any]] = []

        for goal in health_goals or []:
            or_clauses.append({"healthGoals": {"$regex": goal, "$options": "i"}})

        for term in message_terms or []:
            if len(term) < 3:
                continue
            # Search in multilingual fields (title and description can be objects with lang keys)
            # Also search in simple string fields and arrays
            or_clauses.extend(
                [
                    # Search in multilingual title (English by default, but also check other langs)
                    {"title.en": {"$regex": term, "$options": "i"}},
                    {"title.nl": {"$regex": term, "$options": "i"}},
                    {"title.de": {"$regex": term, "$options": "i"}},
                    # Search in multilingual description
                    {"description.en": {"$regex": term, "$options": "i"}},
                    {"description.nl": {"$regex": term, "$options": "i"}},
                    {"description.de": {"$regex": term, "$options": "i"}},
                    # Search in simple string fields (for backward compatibility)
                    {"title": {"$regex": term, "$options": "i"}},
                    {"description": {"$regex": term, "$options": "i"}},
                    # Search in arrays and simple fields
                    {"healthGoals": {"$regex": term, "$options": "i"}},
                    {"benefits": {"$regex": term, "$options": "i"}},
                    {"shortDescription": {"$regex": term, "$options": "i"}},
                ]
            )

        if or_clauses:
            filters["$or"] = or_clauses

        cursor = (
            self.collection.find(filters)
            .sort("createdAt", -1)
            .limit(limit)
        )
        results = [doc async for doc in cursor]
        
        # If no specific matches found, try a broader search
        # This handles cases where:
        # 1. No search criteria provided (no concerns/message)
        # 2. Search criteria didn't match anything
        if not results:
            # Fallback: search for any Active products
            fallback_filters: dict[str, Any] = {
                "status": True,  # Changed from "Active" to True (boolean) to match temp_product format
                "isDeleted": {"$ne": True},
            }
            fallback_cursor = (
                self.collection.find(fallback_filters)
                .sort("createdAt", -1)
                .limit(limit * 3)  # Get more products for fallback to allow filtering
            )
            results = [doc async for doc in fallback_cursor]
        
        return results
