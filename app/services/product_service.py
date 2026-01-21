"""Product service that loads products from MongoDB and matches them based on user context."""
from __future__ import annotations

import re
from typing import Any

from app.repositories.product_repository import ProductRepository
from app.schemas.product import Product, ProductPrice


class ProductService:
    # Map concerns to keywords that match product benefits/descriptions
    CONCERN_TO_KEYWORDS = {
        "sleep": ["sleep", "rest", "relaxation", "tiredness", "fatigue", "calm"],
        "stress": ["stress", "anxiety", "calm", "relaxation", "psychological"],
        "energy": ["energy", "fatigue", "tiredness", "vitality", "metabolism"],
        "stomach_intestines": ["digestion", "gut", "stomach", "intestines", "bowel", "digestive"],
        "skin": ["skin", "collagen", "complexion", "elasticity", "aging"],
        "resistance": ["immune", "immunity", "resistance", "immune system"],
        "weight": ["weight", "metabolism", "energy metabolism"],
        "libido": ["libido", "sexual", "hormone", "hormonal"],
        "brain": ["brain", "memory", "concentration", "cognitive", "mental", "focus", "learning"],
        "hair_nails": ["hair", "nails", "hair growth", "nail health"],
        "fitness": ["fitness", "muscle", "performance", "recovery", "exercise", "strength"],
        "hormones": ["hormone", "hormonal", "menstrual", "cycle", "libido"],
    }
    
    # Map concerns to health goals for MongoDB search and scoring
    CONCERN_TO_HEALTH_GOALS = {
        "sleep": "Sleep",
        "stress": "Stress Management",
        "energy": "Energy Support",
        "stomach_intestines": ["Digestive Health", "Gut Health"],
        "skin": "Skin Health",
        "resistance": "Immune Support",
        "weight": "Weight Management",
        "libido": "Libido",
        "brain": "Brain Health",
        "hair_nails": ["Hair Health", "Nail Health"],
        "fitness": "Fitness",
        "hormones": "Hormone Balance",
    }

    def __init__(self, repository: ProductRepository):
        """Initialize product service with MongoDB repository."""
        self.repository = repository

    def get_product_by_name(self, product_name: str) -> dict[str, Any] | None:
        """Get raw MongoDB product document by product name (title)."""
        # This is a synchronous wrapper - in practice, we'll search async
        # For now, return None as we'll handle this differently
        return None

    async def find_relevant_products(
        self, message: str | None = None, context: dict | None = None, limit: int | None = None,
        exclude_product_titles: list[str] | None = None, include_product_titles: list[str] | None = None
    ) -> tuple[list[Product], dict[str, dict[str, Any]]]:
        """
        Find relevant products from MongoDB based on user context and message.
        Includes safety and suitability checks.
        Returns tuple of (list of Product objects, dict of product documents by title).
        """
        try:
            # Extract search criteria from context
            concerns = self._extract_concerns(context)
            keywords = self._extract_keywords(concerns, message)
            
            # Map concerns to health goals for MongoDB search
            health_goals = self._concerns_to_health_goals(concerns)
            
            # Extract message terms for search
            message_terms = self._extract_terms(message) if message else []
            
            # Search MongoDB for products
            # Use a higher limit to get more products for filtering
            search_limit = limit or 20
            mongo_products = await self.repository.search(
                message_terms=message_terms,
                health_goals=health_goals,
                limit=search_limit * 2,  # Get more products to filter from
                include_product_titles=include_product_titles,
            )
            
            if not mongo_products:
                import logging
                logging.warning(
                    f"No products found in MongoDB. "
                    f"Concerns: {concerns}, Health Goals: {health_goals}, "
                    f"Message Terms: {message_terms}"
                )
                return [], {}
            
            # Score and filter products - ensure only Active products are processed
            scored_products = []
            # Track if MongoDB search used any criteria (health goals or message terms)
            # If products were found via search criteria, they deserve a base score even if scoring doesn't match
            search_used_criteria = bool(health_goals or message_terms or include_product_titles)
            
            for product in mongo_products:
                # Double-check that product status is Active (safety check)
                # Handle both boolean (true) and string ("Active") formats
                status = product.get("status")
                if status is not True and status != "Active":
                    continue
                # Also check isDeleted flag
                if product.get("isDeleted") is True:
                    continue
                
                score = self._score_product(product, keywords, concerns, context)
                
                # Give products a base score if they were found by MongoDB search but scoring didn't match
                # This handles cases where MongoDB found products (via health goals or message terms)
                # but the scoring logic didn't match keywords
                if score == 0:
                    # If MongoDB search used criteria (health goals or message terms) and found products,
                    # give them a base score so they can still be recommended
                    if search_used_criteria:
                        score = 0.5  # Base score for products found by MongoDB search criteria
                    # If no search criteria at all, also give base score
                    elif not keywords and not concerns:
                        score = 0.5  # Base score when no search criteria
                
                if score > 0:  # Only include products with positive score
                    scored_products.append((score, product))

            # Sort by score (highest first) and apply safety/suitability filters
            scored_products.sort(key=lambda x: x[0], reverse=True)
            
            # Filter by safety and suitability, and exclude/include specific products
            # Use minimum confidence threshold - only recommend products with score >= 0.5
            # This ensures we only recommend relevant products, not force exactly 3
            MIN_CONFIDENCE_SCORE = 0.5
            filtered_products = []
            exclude_titles = set((exclude_product_titles or []))
            include_titles = set((include_product_titles or [])) if include_product_titles else None
            
            # Check if user has negative views on Ayurveda
            exclude_ayurveda = self._should_exclude_ayurveda(context)
            
            for score, product in scored_products:
                # Only include products with minimum confidence score
                if score < MIN_CONFIDENCE_SCORE:
                    # If we already have at least 1 product, stop (don't force more)
                    if len(filtered_products) >= 1:
                        break
                    continue
                
                product_obj = self._mongo_to_product(product)
                product_title = product_obj.title
                
                # If include_product_titles is specified, only include those products
                if include_titles is not None:
                    if product_title not in include_titles:
                        continue
                
                # Exclude previous products if specified
                if product_title in exclude_titles:
                    continue
                
                # Exclude Ayurveda products if user has negative views
                if exclude_ayurveda and self._is_ayurveda_product(product):
                    continue
                
                if self._is_safe_and_suitable(product, context):
                    filtered_products.append(product_obj)
                    # Stop at 3 products max, but don't force exactly 3
                    if len(filtered_products) >= 3:
                        break

            if not filtered_products:
                import logging
                logging.warning(
                    f"No products passed filtering. "
                    f"Found {len(mongo_products)} products from DB, "
                    f"{len(scored_products)} had positive scores, "
                    f"but {len(filtered_products)} passed safety/suitability checks."
                )
            
            # Return both products and their raw documents for safety analysis
            result_products = filtered_products[:3]
            result_docs = {}
            # Create a mapping of product titles to documents
            for score, doc in scored_products:
                product_obj = self._mongo_to_product(doc)
                result_docs[product_obj.title] = doc
            
            return result_products, result_docs
        except Exception as e:
            # Log error and return empty list if search fails
            import logging
            import traceback
            logging.error(f"Error finding products: {e}\n{traceback.format_exc()}")
            return [], {}

    def _extract_concerns(self, context: dict | None) -> list[str]:
        """Extract concerns from context."""
        if not context:
            return []
        
        concerns = context.get("concern")
        if not concerns:
            return []
        
        if isinstance(concerns, str):
            return [concerns.lower().replace(" ", "_").replace("&", "_")]
        elif isinstance(concerns, list):
            return [str(c).lower().replace(" ", "_").replace("&", "_") for c in concerns]
        return []

    def _extract_keywords(self, concerns: list[str], message: str | None) -> set[str]:
        """Extract keywords from concerns and message."""
        keywords = set()
        
        # Add keywords from concerns
        for concern in concerns:
            concern_keywords = self.CONCERN_TO_KEYWORDS.get(concern, [])
            keywords.update(concern_keywords)
        
        # Add keywords from message
        if message:
            message_terms = self._extract_terms(message)
            keywords.update(message_terms)
        
        return keywords

    @staticmethod
    def _extract_terms(message: str) -> list[str]:
        """Extract alphanumeric words with length >=3 from message."""
        return [term.lower() for term in re.findall(r"[a-zA-Z]{3,}", message.lower())]

    def _concerns_to_health_goals(self, concerns: list[str]) -> list[str]:
        """Map user concerns to health goals for MongoDB search."""
        health_goals = []
        for concern in concerns:
            goal = self.CONCERN_TO_HEALTH_GOALS.get(concern)
            if goal:
                if isinstance(goal, list):
                    health_goals.extend(goal)
                else:
                    health_goals.append(goal)
        
        return health_goals

    def _score_product(
        self, product: dict[str, Any], keywords: set[str], concerns: list[str], context: dict | None
    ) -> float:
        """
        Score a product based on how well it matches the keywords and concerns.
        Returns a score from 0.0 to 10.0.
        """
        score = 0.0
        
        # Get product text fields to search
        product_text = self._get_product_text(product).lower()
        
        # Score based on keyword matches
        for keyword in keywords:
            if keyword in product_text:
                score += 1.0
        
        # Bonus for health goals matching concerns
        product_health_goals = product.get("healthGoals", [])
        health_goals_text = " ".join([str(g).lower() for g in product_health_goals])
        
        # Check if product health goals directly match mapped health goals from concerns
        for concern in concerns:
            expected_goals = self.CONCERN_TO_HEALTH_GOALS.get(concern)
            if expected_goals:
                if isinstance(expected_goals, list):
                    # Check if any expected goal matches any product health goal
                    for expected_goal in expected_goals:
                        if any(expected_goal.lower() in str(pg).lower() for pg in product_health_goals):
                            score += 2.0  # Direct match gets higher score
                            break
                else:
                    # Check if expected goal matches any product health goal
                    if any(expected_goals.lower() in str(pg).lower() for pg in product_health_goals):
                        score += 2.0  # Direct match gets higher score
            
            # Also check keyword matching (original logic)
            concern_keywords = self.CONCERN_TO_KEYWORDS.get(concern, [])
            for keyword in concern_keywords:
                if keyword in health_goals_text or keyword in product_text:
                    score += 1.5
                    break  # Only count once per concern
        
        # Check if product is specifically mentioned for user's situation
        if context:
            # Check for vegetarian/vegan matches in sourceInfo
            source_info = product.get("sourceInfo", {})
            certifications = source_info.get("certification", [])
            cert_text = " ".join(certifications).lower()
            
            eating_habits = (context.get("eating_habits") or "").lower()
            if eating_habits == "vegan":
                # Check if product mentions vegan-friendly
                if "vegan" in product_text or "vegan" in cert_text:
                    score += 2.0
            elif eating_habits == "vegetarian":
                # Vegetarian products are usually fine unless explicitly non-vegetarian
                if "vegetarian" in product_text or "vegetarian" in cert_text:
                    score += 1.5
        
        # Bonus for high relevance keywords
        high_value_keywords = {"fatigue", "energy", "immune", "memory", "concentration"}
        for keyword in high_value_keywords:
            if keyword in keywords and keyword in product_text:
                score += 0.5
        
        return score

    def _get_product_text(self, product: dict[str, Any]) -> str:
        """Extract all searchable text from a MongoDB product document."""
        text_parts = []
        
        # Handle multilingual title (prefer English, fallback to first available)
        title = product.get("title", {})
        if isinstance(title, dict):
            title_val = title.get("en", title.get(list(title.keys())[0] if title else "", ""))
            if title_val:
                text_parts.append(str(title_val))
        elif isinstance(title, str):
            text_parts.append(title)
        
        # Handle multilingual description (prefer English, fallback to first available)
        description = product.get("description", {})
        if isinstance(description, dict):
            desc_val = description.get("en", description.get(list(description.keys())[0] if description else "", ""))
            if desc_val:
                text_parts.append(str(desc_val))
        elif isinstance(description, str):
            text_parts.append(description)
        
        # Add short description
        if product.get("shortDescription"):
            text_parts.append(str(product["shortDescription"]))
        
        # Add benefits (convert all items to strings to handle ObjectIds and other types)
        if product.get("benefits"):
            text_parts.extend([str(b) for b in product["benefits"]])
        
        # Add health goals (convert all items to strings to handle ObjectIds and other types)
        if product.get("healthGoals"):
            text_parts.extend([str(g) for g in product["healthGoals"]])
        
        # Add ingredients (convert all items to strings to handle ObjectIds and other types)
        if product.get("ingredients"):
            text_parts.extend([str(i) for i in product["ingredients"]])
        
        # Filter out None values and empty strings, then join
        text_parts = [part for part in text_parts if part]
        return " ".join(text_parts)

    def _is_safe_and_suitable(self, product: dict[str, Any], context: dict | None) -> bool:
        """
        Check if a product is safe and suitable for the user based on:
        - Dietary preferences (vegetarian/vegan)
        - Allergies
        - Medical conditions (MongoDB products may not have explicit safety info)
        """
        if not context:
            return True  # If no context, assume safe (will be filtered by other means)
        
        # MongoDB products don't have safety_information field like JSON products
        # We'll rely on allergen checking and dietary preference matching
        
        # Check dietary preferences
        eating_habits = (context.get("eating_habits") or "").lower()
        if eating_habits == "vegan":
            # Check if product contains animal-derived ingredients
            product_text = self._get_product_text(product).lower()
            animal_indicators = ["gelatin", "fish", "shellfish", "milk", "dairy", "whey", "casein"]
            if any(indicator in product_text for indicator in animal_indicators):
                # Check certifications - if explicitly vegan, allow it
                source_info = product.get("sourceInfo", {})
                certifications = source_info.get("certification", [])
                if "vegan" not in " ".join(certifications).lower():
                    return False
        
        # Check allergies - comprehensive check across all product fields
        allergies = context.get("allergies", "")
        if allergies and allergies.lower() != "no":
            if self._product_contains_allergens(product, allergies):
                return False
        
        # Check dietary preferences and intolerances
        dietary_prefs = (context.get("dietary_preferences") or "").lower()
        if dietary_prefs and dietary_prefs != "no preference":
            if not self._product_matches_dietary_preferences(product, dietary_prefs):
                return False
        
        return True

    def _should_exclude_ayurveda(self, context: dict | None) -> bool:
        """
        Check if user has negative views on Ayurveda that should exclude Ayurveda products.
        Returns True if user selected:
        - "more information needed for an opinion"
        - "i am skeptical"
        - "alternative medicine is nonsense"
        """
        if not context:
            return False
        
        ayurveda_view = (context.get("ayurveda_view") or "").lower()
        exclude_views = [
            "more information needed for an opinion",
            "i am skeptical",
            "alternative medicine is nonsense"
        ]
        
        return ayurveda_view in exclude_views

    def _is_ayurveda_product(self, product: dict[str, Any]) -> bool:
        """
        Check if a product is Ayurveda-related by examining its title, description, and other fields.
        Includes both generic Ayurveda terms and specific Ayurvedic herbs/ingredients.
        """
        product_text = self._get_product_text(product).lower()
        
        # Check for Ayurveda-related keywords
        ayurveda_keywords = [
            "ayurveda",
            "ayurvedic",
            "ayurved",
            "traditional indian medicine",
            "ancient indian medicine"
        ]
        
        # Check for specific Ayurvedic herbs and ingredients
        ayurvedic_herbs = [
            "ashwagandha",
            "ashwagandha root",
            "ashwagandha extract",
            "withania somnifera",
            "turmeric",
            "curcumin",
            "holy basil",
            "tulsi",
            "ocimum sanctum",
            "triphala",
            "amla",
            "amalaki",
            "brahmi",
            "bacopa monnieri",
            "guggul",
            "commiphora mukul",
            "shilajit",
            "guduchi",
            "tinospora cordifolia",
            "neem",
            "azadirachta indica",
            "ginger",
            "zingiber officinale",
            "licorice",
            "glycyrrhiza glabra",
            "gotu kola",
            "centella asiatica",
            "boswellia",
            "frankincense",
            "boswellia serrata"
        ]
        
        # Check for generic Ayurveda terms
        if any(keyword in product_text for keyword in ayurveda_keywords):
            return True
        
        # Check for Ayurvedic herbs/ingredients
        if any(herb in product_text for herb in ayurvedic_herbs):
            return True
        
        return False

    def _product_contains_allergens(self, product: dict[str, Any], user_allergies: str) -> bool:
        """
        Check if product contains any of the user's allergens.
        Searches across all product fields including ingredient name, description, 
        excipients, nutritional info, and absorption info.
        """
        # Normalize user allergies - handle "shellfish and crustaceans" as a special case
        allergies_str = str(user_allergies).lower()
        # Replace "shellfish and crustaceans" with "shellfish,crustaceans" for easier parsing
        allergies_str = allergies_str.replace("shellfish and crustaceans", "shellfish,crustaceans")
        
        allergies_list = [a.strip() for a in allergies_str.split(",")]
        
        # Comprehensive allergen mapping
        allergen_map = {
            "milk": ["milk", "lactose", "dairy", "casein", "whey", "butter", "cream"],
            "egg": ["egg", "albumin", "ovalbumin", "lecithin", "eggs"],
            "fish": ["fish", "gelatin", "fish oil", "omega-3", "dha", "epa", "cod", "salmon", "tuna"],
            "shellfish": ["shellfish", "crustacean", "shrimp", "crab", "lobster", "prawn"],
            "crustaceans": ["shellfish", "crustacean", "shrimp", "crab", "lobster", "prawn"],
            "peanut": ["peanut", "peanuts", "arachis"],
            "nuts": ["nut", "almond", "walnut", "hazelnut", "cashew", "pistachio", "pecan", "macadamia", "brazil nut"],
            "soy": ["soy", "soya", "soybean", "soy bean", "tofu", "tempeh", "miso"],
            "gluten": ["gluten", "wheat", "barley", "rye", "triticale", "spelt", "kamut"],
            "wheat": ["wheat", "gluten", "flour", "semolina", "durum"],
            "pollen": ["pollen", "bee pollen", "flower pollen"],  # Less common but included
        }
        
        # Get all product text fields to search
        all_product_text = self._get_all_product_text_for_allergen_check(product).lower()
        
        # Check each user allergy
        for user_allergy in allergies_list:
            user_allergy = user_allergy.strip()
            if not user_allergy or user_allergy == "no":
                continue
                
            # Get allergens to check for this user allergy
            allergens_to_check = allergen_map.get(user_allergy, [])
            
            # If not in map, check the allergy name itself
            if not allergens_to_check:
                allergens_to_check = [user_allergy]
            
            # Check if any allergen appears in product text
            for allergen in allergens_to_check:
                # Use word boundaries to avoid false positives (e.g., "almond" in "almondine")
                # But also check as substring for compound words
                if allergen in all_product_text:
                    # Additional check: make sure it's not part of a larger word (unless it's a common compound)
                    # For now, we'll be conservative and flag it if found
                    return True
        
        return False

    def _get_all_product_text_for_allergen_check(self, product: dict[str, Any]) -> str:
        """Get all text from MongoDB product that might contain allergen information."""
        text_parts = []
        
        # Get product text (handles multilingual fields)
        text_parts.append(self._get_product_text(product))
        
        # Add ingredients array
        if product.get("ingredients"):
            text_parts.extend([str(ing) for ing in product["ingredients"]])
        
        # Add nutrition info (handles multilingual)
        nutrition_info = product.get("nutritionInfo", {})
        if isinstance(nutrition_info, dict):
            # Handle multilingual nutrition info
            if "en" in nutrition_info:
                text_parts.append(str(nutrition_info["en"]))
            elif nutrition_info:
                # Get first available language
                first_key = list(nutrition_info.keys())[0]
                text_parts.append(str(nutrition_info[first_key]))
        elif isinstance(nutrition_info, str):
            text_parts.append(nutrition_info)
        
        # Add source info and certifications
        source_info = product.get("sourceInfo", {})
        if source_info:
            if source_info.get("certification"):
                text_parts.extend([str(c) for c in source_info["certification"]])
        
        return " ".join(text_parts)

    def _product_matches_dietary_preferences(self, product: dict[str, Any], dietary_prefs: str) -> bool:
        """
        Check if product matches user's dietary preferences/intolerances.
        Returns False if product conflicts with preferences (should be filtered out).
        """
        product_text = self._get_all_product_text_for_allergen_check(product).lower()
        source_info = product.get("sourceInfo", {})
        certifications = [c.lower() for c in source_info.get("certification", [])]
        
        # Check lactose-free preference
        if "lactose-free" in dietary_prefs or "lactose free" in dietary_prefs:
            lactose_indicators = ["lactose", "dairy", "milk", "whey", "casein", "butter", "cream"]
            # If product contains lactose/dairy indicators, filter it out
            if any(indicator in product_text for indicator in lactose_indicators):
                        return False
        
        # Check gluten-free preference
        if "gluten free" in dietary_prefs or "gluten-free" in dietary_prefs:
            # Check certifications first
            if "gluten-free" in certifications or "gluten free" in certifications:
                return True  # Explicitly marked as gluten-free
            # Check product text for gluten-containing ingredients
            gluten_indicators = ["gluten", "wheat", "barley", "rye"]
            if any(indicator in product_text for indicator in gluten_indicators):
                # If contains gluten and not explicitly marked gluten-free, filter it out
                return False
        
        # Check paleo preference (generally avoids grains, legumes, dairy)
        if "paleo" in dietary_prefs:
            # Paleo avoids: grains (wheat, barley, rye, rice), legumes (soy, beans, peanuts), dairy
            paleo_avoid = ["wheat", "barley", "rye", "rice", "soy", "soya", "bean", "peanut", "dairy", "milk", "lactose"]
            if any(avoid in product_text for avoid in paleo_avoid):
                return False
        
        return True

    def _mongo_to_product(self, product: dict[str, Any]) -> Product:
        """Convert MongoDB product document to Product schema."""
        # Handle multilingual title (prefer English, fallback to first available)
        title_obj = product.get("title", {})
        if isinstance(title_obj, dict):
            title = title_obj.get("en", title_obj.get(list(title_obj.keys())[0] if title_obj else "", "Unknown Product"))
        elif isinstance(title_obj, str):
            title = title_obj
        else:
            title = "Unknown Product"
        
        # Handle multilingual description
        description_obj = product.get("description", {})
        if isinstance(description_obj, dict):
            description = description_obj.get("en", description_obj.get(list(description_obj.keys())[0] if description_obj else "", ""))
        elif isinstance(description_obj, str):
            description = description_obj
        else:
            description = ""
        
        # Get short description
        short_description = product.get("shortDescription", "")
        if not short_description and description:
            short_description = description[:150] + "..." if len(description) > 150 else description
        
        # Get benefits
        benefits = product.get("benefits", [])
        
        # Get health goals (already in MongoDB)
        health_goals = product.get("healthGoals", [])
        
        # Handle multilingual nutrition info
        nutrition_info_obj = product.get("nutritionInfo", {})
        nutrition_info = ""
        if isinstance(nutrition_info_obj, dict):
            nutrition_info = nutrition_info_obj.get("en", nutrition_info_obj.get(list(nutrition_info_obj.keys())[0] if nutrition_info_obj else "", ""))
        elif isinstance(nutrition_info_obj, str):
            nutrition_info = nutrition_info_obj
        
        # Handle multilingual howToUse
        how_to_use_obj = product.get("howToUse", {})
        how_to_use = ""
        if isinstance(how_to_use_obj, dict):
            how_to_use = how_to_use_obj.get("en", how_to_use_obj.get(list(how_to_use_obj.keys())[0] if how_to_use_obj else "", ""))
        elif isinstance(how_to_use_obj, str):
            how_to_use = how_to_use_obj
        
        # Get slug
        slug = product.get("slug", "")
        
        # Create product ID from _id or slug
        product_id = str(product.get("_id", slug or title.lower().replace(" ", "_").replace("-", "_")))
        
        # Get price
        price_obj = product.get("price", {})
        price = None
        if price_obj:
            price = ProductPrice(
                currency=price_obj.get("currency"),
                amount=price_obj.get("amount"),
                tax_rate=price_obj.get("taxRate"),
            )

        return Product(
            id=product_id,
            title=title,
            slug=slug,
            description=description,
            shortDescription=short_description,
            benefits=benefits,
            healthGoals=health_goals,
            nutritionInfo=nutrition_info,
            howToUse=how_to_use,
            price=price,
        )

    @staticmethod
    def get_safety_warnings(product_doc: dict[str, Any], context: dict | None = None) -> list[str]:
        """
        Auto-analyze product and generate safety warnings based on ingredients, benefits, and context.
        Intelligently detects allergens, pregnancy concerns, and other safety issues.
        Returns a list of warning messages that are relevant to the user.
        """
        warnings = []
        
        # Get all product text for analysis
        product_text = ProductService._get_product_text_for_analysis(product_doc).lower()
        ingredients = product_doc.get("ingredients", [])
        ingredients_text = " ".join([str(ing).lower() for ing in ingredients])
        all_text = f"{product_text} {ingredients_text}".lower()
        
        # Get user context
        user_gender = None
        user_age = None
        is_pregnant = False
        is_breastfeeding = False
        medical_treatment = False
        
        if context:
            gender_str = (context.get("gender") or "").lower()
            if gender_str in {"male", "man", "m"}:
                user_gender = "male"
            elif gender_str in {"female", "woman", "f"}:
                user_gender = "female"
            
            age_str = context.get("age", "")
            if age_str and age_str.isdigit():
                user_age = int(age_str)
            
            is_pregnant = (
                context.get("conceive") == "yes" or
                "pregnant" in (context.get("situation") or "").lower()
            )
            is_breastfeeding = "breastfeeding" in (context.get("situation") or "").lower()
            medical_treatment = (context.get("medical_treatment") or "").lower() == "yes"
        
        # Auto-detect pregnancy safety concerns
        if user_gender != "male" and (is_pregnant or is_breastfeeding):
            pregnancy_concerns = ProductService._detect_pregnancy_concerns(all_text, ingredients_text)
            if pregnancy_concerns:
                warnings.extend(pregnancy_concerns)
        
        # Auto-detect allergen warnings (for general awareness)
        detected_allergens = ProductService._detect_allergens(all_text, ingredients_text)
        if detected_allergens:
            # Only show if user has those allergies
            user_allergies = (context.get("allergies") or "").lower() if context else ""
            if user_allergies and user_allergies != "no":
                relevant_allergens = []
                for allergen in detected_allergens:
                    if allergen.lower() in user_allergies:
                        relevant_allergens.append(allergen)
                if relevant_allergens:
                    warnings.append(
                        f"This product may contain {', '.join(relevant_allergens)}. "
                        "Please check the ingredient list and consult with your healthcare provider if you have allergies."
                    )
        
        # Age restrictions (for products with high doses or specific ingredients)
        if user_age and user_age < 18:
            age_concerns = ProductService._detect_age_concerns(all_text, ingredients_text)
            if age_concerns:
                warnings.extend(age_concerns)
        
        # Medical treatment warning
        if medical_treatment:
            warnings.append(
                "Please consult with your healthcare provider before starting any new supplements, "
                "especially if you're currently undergoing medical treatment."
            )
        
        return warnings

    @staticmethod
    def _get_product_text_for_analysis(product_doc: dict[str, Any]) -> str:
        """Get all text from product for safety analysis."""
        text_parts = []
        
        # Handle multilingual title
        title_obj = product_doc.get("title", {})
        if isinstance(title_obj, dict):
            title_val = title_obj.get("en", title_obj.get(list(title_obj.keys())[0] if title_obj else "", ""))
            if title_val:
                text_parts.append(str(title_val))
        elif isinstance(title_obj, str):
            text_parts.append(title_obj)
        
        # Handle multilingual description
        desc_obj = product_doc.get("description", {})
        if isinstance(desc_obj, dict):
            desc_val = desc_obj.get("en", desc_obj.get(list(desc_obj.keys())[0] if desc_obj else "", ""))
            if desc_val:
                text_parts.append(str(desc_val))
        elif isinstance(desc_obj, str):
            text_parts.append(desc_obj)
        
        # Add benefits
        if product_doc.get("benefits"):
            text_parts.extend([str(b) for b in product_doc["benefits"]])
        
        # Add health goals
        if product_doc.get("healthGoals"):
            text_parts.extend([str(g) for g in product_doc["healthGoals"]])
        
        # Add nutrition info
        nutrition_obj = product_doc.get("nutritionInfo", {})
        if isinstance(nutrition_obj, dict):
            nutrition_val = nutrition_obj.get("en", nutrition_obj.get(list(nutrition_obj.keys())[0] if nutrition_obj else "", ""))
            if nutrition_val:
                text_parts.append(str(nutrition_val))
        elif isinstance(nutrition_obj, str):
            text_parts.append(nutrition_obj)
        
        # Filter out None values and empty strings, then join
        text_parts = [part for part in text_parts if part]
        return " ".join(text_parts)

    @staticmethod
    def _detect_pregnancy_concerns(product_text: str, ingredients_text: str) -> list[str]:
        """Auto-detect ingredients that may be concerning during pregnancy/breastfeeding."""
        warnings = []
        combined_text = f"{product_text} {ingredients_text}"
        
        # High-dose Vitamin A (retinol) - can cause birth defects
        if any(term in combined_text for term in ["retinol", "vitamin a", "retinyl", "high dose vitamin a"]):
            if "beta-carotene" not in combined_text.lower():  # Beta-carotene is safe
                warnings.append(
                    "This product contains Vitamin A (retinol). High doses of Vitamin A can be harmful during pregnancy. "
                    "Please consult your healthcare provider before use."
                )
        
        # High-dose herbs that may affect pregnancy
        pregnancy_risky_herbs = {
            "black cohosh": "may affect hormone levels",
            "dong quai": "may cause uterine contractions",
            "goldenseal": "may cause uterine contractions",
            "blue cohosh": "may cause uterine contractions",
            "pennyroyal": "may cause miscarriage",
            "saw palmetto": "may affect hormone levels",
            "yohimbe": "may affect blood pressure",
            "ephedra": "may affect blood pressure and heart rate",
        }
        
        for herb, reason in pregnancy_risky_herbs.items():
            if herb in combined_text:
                warnings.append(
                    f"This product contains {herb}, which {reason} during pregnancy. "
                    "Please consult your healthcare provider before use."
                )
        
        # High-dose minerals that need caution
        if "high dose" in combined_text or "megadose" in combined_text:
            if any(term in combined_text for term in ["iron", "zinc", "selenium"]):
                warnings.append(
                    "This product contains high doses of minerals. Please consult your healthcare provider "
                    "to ensure the dosage is appropriate during pregnancy or breastfeeding."
                )
        
            return warnings
    
    @staticmethod
    def _detect_allergens(product_text: str, ingredients_text: str) -> list[str]:
        """Auto-detect common allergens in product."""
        detected = []
        combined_text = f"{product_text} {ingredients_text}"
        
        # Common allergen indicators
        allergen_indicators = {
            "milk": ["milk", "lactose", "casein", "whey", "dairy"],
            "egg": ["egg", "albumin", "lecithin", "ovalbumin"],
            "fish": ["fish", "fish oil", "omega-3", "dha", "epa", "cod liver"],
            "shellfish": ["shellfish", "shrimp", "crab", "lobster", "crustacean"],
            "peanut": ["peanut", "arachis"],
            "tree nuts": ["almond", "walnut", "hazelnut", "cashew", "pistachio", "pecan", "macadamia"],
            "soy": ["soy", "soya", "soybean", "tofu"],
            "gluten": ["wheat", "barley", "rye", "gluten"],
        }
        
        for allergen_name, indicators in allergen_indicators.items():
            if any(indicator in combined_text for indicator in indicators):
                detected.append(allergen_name)
        
        return detected
    
    @staticmethod
    def _detect_age_concerns(product_text: str, ingredients_text: str) -> list[str]:
        """Auto-detect ingredients that may not be suitable for children/teens."""
        warnings = []
        combined_text = f"{product_text} {ingredients_text}"
        
        # High-dose supplements
        if any(term in combined_text for term in ["high dose", "megadose", "exceeds", "above recommended"]):
            warnings.append(
                "This product contains high doses that may not be suitable for individuals under 18. "
                "Please consult a healthcare provider before use."
            )
        
        # Stimulants or energy boosters
        if any(term in combined_text for term in ["caffeine", "guarana", "yerba mate", "green tea extract"]):
            warnings.append(
                "This product contains stimulants. Use caution if you are under 18, and consult a healthcare provider."
            )
        
        # Weight loss supplements
        if any(term in combined_text for term in ["weight loss", "fat burner", "metabolism booster"]):
            warnings.append(
                "Weight management supplements are generally not recommended for individuals under 18. "
                "Please consult a healthcare provider."
            )
        
        return warnings
