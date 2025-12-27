import re
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
    
    async def get_products_by_titles(self, product_titles: list[str]) -> list[dict[str, Any]]:
        """Fetch products by their titles (case-insensitive partial match)."""
        if not product_titles:
            return []
        
        # First, try exact or near-exact matches
        title_filters = []
        for title in product_titles:
            if not title:
                continue
            # Escape special regex characters and search in multilingual title fields
            escaped_title = re.escape(title)
            # Use word boundaries for better matching, but also allow partial matches
            title_filters.extend([
                {"title.en": {"$regex": escaped_title, "$options": "i"}},
                {"title.nl": {"$regex": escaped_title, "$options": "i"}},
                {"title.de": {"$regex": escaped_title, "$options": "i"}},
                {"title": {"$regex": escaped_title, "$options": "i"}},
            ])
        
        if not title_filters:
            return []
        
        filters: dict[str, Any] = {
            "status": True,
            "isDeleted": {"$ne": True},
            "$or": title_filters
        }
        
        # Get more products to allow for better matching
        products = await self.collection.find(filters).to_list(length=len(product_titles) * 5)
        
        # Match products to titles in order (prefer exact matches)
        matched_products = []
        matched_product_ids = set()
        
        for title in product_titles:
            if not title:
                continue
            
            title_lower = title.lower().strip()
            best_match = None
            best_match_score = 0
            
            for product in products:
                product_id = str(product.get("_id", ""))
                if product_id in matched_product_ids:
                    continue
                
                # Check if product title matches
                title_obj = product.get("title", {})
                product_title = ""
                if isinstance(title_obj, dict):
                    product_title = title_obj.get("en", "") or title_obj.get(list(title_obj.keys())[0] if title_obj else "", "")
                elif isinstance(title_obj, str):
                    product_title = title_obj
                
                product_title_lower = product_title.lower().strip()
                
                # Calculate match score
                score = 0
                # Exact match gets highest score
                if title_lower == product_title_lower:
                    score = 100
                # Title is contained in product title or vice versa
                elif title_lower in product_title_lower:
                    score = 80
                elif product_title_lower in title_lower:
                    score = 70
                # Check if key words match (split by spaces and common separators)
                else:
                    title_words = set(re.split(r'[\s\+\-]+', title_lower))
                    product_words = set(re.split(r'[\s\+\-]+', product_title_lower))
                    common_words = title_words.intersection(product_words)
                    if common_words and len(common_words) >= min(2, len(title_words)):
                        score = 50 + len(common_words) * 10
                
                if score > best_match_score:
                    best_match = product
                    best_match_score = score
            
            # Only add if we have a reasonable match (score >= 50)
            if best_match and best_match_score >= 50:
                matched_products.append(best_match)
                matched_product_ids.add(str(best_match.get("_id", "")))
        
        return matched_products