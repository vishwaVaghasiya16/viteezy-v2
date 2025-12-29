from __future__ import annotations

import re
from typing import Any

import logging

from app.config.settings import settings
from app.exceptions.errors import SessionNotFoundError
from app.repositories.session_repository import SessionRepository
from app.repositories.quiz_session_repository import QuizSessionRepository
from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse, QuestionOption, QuestionStateResponse
from app.schemas.session import Session
from app.services.product_service import ProductService
from app.services.openai_service import OpenAIChatService
from app.utils.error_handler import log_error_with_context

logger = logging.getLogger(__name__)


class ChatService:
    PROMPTS = {
        "name": "Hey! I'm Viteezy. What should I call you?",
        "for_whom": "Hey friend! 😊 Is this quiz for you or for a family member? (me/family)",
        "family_name": "Got it, what's their name?",
        "relation": "How are you related to {family_name}?",
        "age": "Nice to meet you, {name}! How young are you feeling these days? (just the number)",
        "protein": "{name}, are you sipping on any protein shakes or powders lately? (yes/no)",
        "email": "Where can I send your plan, {name}? Drop your best email.",
        "knowledge": (
            "How comfy are you with vitamins & supplements, {name}? "
            "Pick one: Well informed / Curious / Skeptical."
        ),
        "vitamin_count": (
            "What’s your current vitamin/supplement load? Options: No / 1 to 3 / 4+."
        ),
        "gender": "Which fits best: male, woman, or gender neutral?",
        "conceive": "{name}, are you currently pregnant or breastfeeding? (yes/no)",
        "situation": (
            "Got it. What’s your situation? Pick one: "
            "To get pregnant in the next 2 years / I am pregnant now / Breastfeeding."
        ),
        "children": "{name}, thinking about having kids in the coming years? (yes/no)",
        "concern": (
            "Alright {name}, what's your biggest wellness focus right now? Pick one: "
            "Sleep / Stress / Energy / Stomach & Intestines / Skin / Resistance / Weight / Libido / Brain / Hair & nails / Fitness{hormones}"
        ),
        # Lifestyle questions from prompt.txt
        "lifestyle_status": "When it comes to a healthy lifestyle, you are: Been doing well for a long time / Nice on the way / Ready to start",
        "fruit_intake": "How much fruit do you eat on average per day? (For example, a banana or a portion of blueberries) Options: Hardly / One time / Twice or more",
        "vegetable_intake": "How many vegetables do you eat on average per day? (For example, a bell pepper or a portion of broccoli) Options: Hardly / One time / Twice or more",
        "dairy_intake": "How many dairy products do you consume on average per day? (For example, a glass of milk, a piece of cheese or a bowl of yoghurt) Options: Hardly / One time / Twice or more",
        "fiber_intake": "How many fiber-rich products do you consume on average per day? (For example, grains, legumes and nuts) Options: Hardly / One time / Twice or more",
        "protein_intake": "How many protein-rich products do you consume on average per day? (For example, eggs, meat, beans and tofu) Options: Hardly / One time / Twice or more",
        "eating_habits": "How would you describe your eating habits? Options: No preference / Flexitarian / Vegetarian / Vegan",
        "meat_intake": "How much meat do you eat on average per week? Options: Never / Once or twice / Three times or more",
        "fish_intake": "How much fish or seafood do you eat on average per week? Options: Never / Once or twice / Three times or more",
        "drinks_alcohol": "Do you drink alcohol? (yes/no)",
        "alcohol_daily": "Do you often drink more than 6 alcoholic drinks a day? (yes/no)",
        "alcohol_weekly": "Do you often drink more than 12 alcoholic drinks in a week? (yes/no)",
        "coffee_intake": "Do you often drink more than 4 cups of coffee a day? (yes/no)",
        "smokes": "Do you smoke? (Also counts if you are a social smoker) (yes/no)",
        "allergies": "Do you have one or more of the following allergies? Options: No / Milk / Egg / Fish / Shellfish and crustaceans / Peanut / Nuts / Soy / Gluten / Wheat / Pollen",
        "dietary_preferences": "Do you have any other dietary preferences or intolerances? Options: No preference / Lactose-free / Gluten free / Paleo",
        "sunlight_exposure": 'Do you sit in direct sunlight for more than 30 minutes a day on average? (Without clothes and without sunscreen and makeup) (yes/no)',
        "iron_advised": "Have you ever been advised to take iron? (yes/no)",
        "ayurveda_view": "What is your view on Eastern lifestyle such as Ayurveda? Options: I am convinced / We can learn a lot from ancient medicine / I am open to it / More information needed for an opinion / I am skeptical / Alternative medicine is nonsense",
        "new_product_attitude": "When a new product is available with promising results, you want to: Options: To be the first / You are at the forefront of new products / Learn more / You are cautiously optimistic / Waiting for now / Scientific research takes time",
        "previous_concern_followup": "Sorry to hear you are facing the same concern again..Are you feeling better after intaking the product recommended?",
        "medical_treatment": "Are you currently undergoing any medical treatment? (yes/no)",
    }
    CONCERN_SYNONYMS = {
        "sleep": "sleep",
        "stress": "stress",
        "energy": "energy",
        "stomach": "stomach_intestines",
        "stomach & intestines": "stomach_intestines",
        "stomach and intestines": "stomach_intestines",
        "intestines": "stomach_intestines",
        "gut": "stomach_intestines",
        "skin": "skin",
        "resistance": "resistance",
        "immunity": "resistance",
        "immune": "resistance",
        "immune system": "resistance",
        "weight": "weight",
        "libido": "libido",
        "brain": "brain",
        "hair": "hair_nails",
        "nails": "hair_nails",
        "hair & nails": "hair_nails",
        "hair and nails": "hair_nails",
        "hair nails": "hair_nails",
        "fitness": "fitness",
        "hormones": "hormones",
        "hormone": "hormones",
    }
    CONCERN_QUESTIONS = {
        "sleep": {
            "label": "Sleep",
            "questions": [
                {"id": "fall_asleep", "prompt": "Do you usually find it hard to fall asleep?"},
                {"id": "refreshed", "prompt": "When you wake up, do you feel refreshed or still tired?"},
                {
                    "id": "hours",
                    "prompt": "On most nights, how many hours do you sleep? 7+ hours / Less than 7 / Less than 5",
                },
            ],
        },
        "stress": {
            "label": "Stress",
            "questions": [
                {"id": "busy_level", "prompt": "How busy does your daily life feel? Few things / Normal / A lot"},
                {"id": "after_day", "prompt": "After a busy day, how do you usually feel? Energized or completely drained?"},
                {
                    "id": "signals",
                    "prompt": (
                        "During stressful periods, do you notice any of these? "
                        "Faster breathing, tense muscles, trouble sleeping, sensitive stomach, head pressure, fast heartbeat"
                    ),
                },
            ],
        },
        "energy": {
            "label": "Energy",
            "questions": [
                {"id": "day_load", "prompt": "How full do your days feel?"},
                {"id": "end_day", "prompt": "At the end of the day, is your energy still there or totally gone?"},
                {"id": "body_signals", "prompt": "During busy periods, what does your body usually signal about energy?"},
            ],
        },
        "stomach_intestines": {
            "label": "Stomach & Intestines",
            "questions": [
                {
                    "id": "bowel",
                    "prompt": "How would you describe your bowel movements? Less than once / About once / More than once / Irregular",
                },
                {
                    "id": "improve",
                    "prompt": (
                        "What would you most like to improve? Gas & bloating / That 'balloon' feeling / "
                        "Letting go easily / Overall digestion / None"
                    ),
                },
                {"id": "extra", "prompt": "Any other tummy or digestion details you want me to know?"},
            ],
        },
        "skin": {
            "label": "Skin",
            "questions": [
                {
                    "id": "most_days",
                    "prompt": "How would you describe your skin most days? Pulling / Shiny / Sensitive / Dull / Pretty good",
                },
                {
                    "id": "notices",
                    "prompt": "Do you notice any of these? Pimples, discoloration, lines, less elasticity, aging, or none",
                },
                {"id": "dry", "prompt": "Does your skin often feel dry? Yes or no"},
            ],
        },
        "resistance": {
            "label": "Resistance",
            "questions": [
                {"id": "low", "prompt": "Do you feel your resistance is a bit low lately?"},
                {"id": "intense_training", "prompt": "Are you currently exercising very intensively?"},
                {"id": "medical_care", "prompt": "Are you under medical care right now?"},
            ],
        },
        "weight": {
            "label": "Weight",
            "questions": [
                {
                    "id": "challenge",
                    "prompt": (
                        "Where do you feel the biggest challenge with weight loss? Movement, exercise, nutrition, "
                        "discipline, knowledge, or none"
                    ),
                },
                {"id": "binge", "prompt": "Do you experience binge eating sometimes?"},
                {"id": "sleep_hours", "prompt": "Do you usually sleep less than 7 hours a night?"},
            ],
        },
        "hormones": {
            "label": "Hormones",
            "questions": [
                {"id": "cycle", "prompt": "How regular is your menstrual cycle?"},
                {
                    "id": "physical_changes",
                    "prompt": "During your period, do you notice physical changes like bloating, cravings, or pimples?",
                },
                {"id": "emotions", "prompt": "Emotionally during your period, what do you feel most?"},
            ],
        },
        "libido": {
            "label": "Libido",
            "questions": [
                {"id": "level", "prompt": "How would you describe your current libido? Low / Average / High"},
                {"id": "sleep_quality", "prompt": "How’s your sleep quality lately?"},
                {"id": "pressure", "prompt": "How much pressure do you feel during the day?"},
            ],
        },
        "brain": {
            "label": "Brain",
            "questions": [
                {
                    "id": "symptoms",
                    "prompt": (
                        "Do you experience any of these? Difficulty focusing, forgetfulness, trouble finding words, or none"
                    ),
                },
                {"id": "mood", "prompt": "Mentally, do you notice things like worry or low motivation?"},
                {"id": "improve", "prompt": "What would you most like to improve? Focus, memory, mental fitness, staying sharp"},
            ],
        },
        "hair_nails": {
            "label": "Hair & Nails",
            "questions": [
                {
                    "id": "hair",
                    "prompt": (
                        "How would you describe your hair? Dry, thin, split ends, won’t grow long, could be fuller, or none"
                    ),
                },
                {
                    "id": "nails",
                    "prompt": "What would you like to improve about your nails? Strength, length, condition, or none",
                },
                {"id": "extras", "prompt": "Anything else about your hair or nails you want me to know?"},
            ],
        },
        "fitness": {
            "label": "Fitness",
            "questions": [
                {"id": "frequency", "prompt": "How often do you exercise in a typical week?"},
                {
                    "id": "training",
                    "prompt": "What kind of training do you mostly do? Strength, cardio, HIIT, flexibility, or none",
                },
                {
                    "id": "priority",
                    "prompt": "What matters most to you in fitness? Performance, sweating, muscle, or health",
                },
            ],
        },
    }

    def __init__(
        self,
        session_repo: SessionRepository,
        ai_service: OpenAIChatService,
        product_service: ProductService,
        user_repo=None,  # Optional UserRepository
        quiz_session_repo=None,  # Optional QuizSessionRepository
    ):
        self.session_repo = session_repo
        self.ai_service = ai_service
        self.product_service = product_service
        self.user_repo = user_repo
        self.quiz_session_repo = quiz_session_repo

    def _get_user_id_from_session(self, session: Session) -> str | None:
        """Extract user_id from session metadata."""
        return (session.metadata or {}).get("user_id")
    
    def _get_is_registered_from_session(self, session: Session) -> bool:
        """Check if session is registered (has user_id) or guest."""
        metadata = session.metadata or {}
        # Check is_registered flag first, then fallback to user_id presence
        if "is_registered" in metadata:
            return metadata.get("is_registered", False)
        # Fallback: check if user_id exists
        return metadata.get("user_id") is not None
        """Extract user_id from session metadata."""
        if session.metadata:
            return session.metadata.get("user_id")
        return None

    async def _update_session_token_usage(self, session_id: str, usage_info: dict, user_id: str | None = None) -> bool:
        """
        Update token usage statistics in session metadata.
        
        Returns:
            True if update was successful, False otherwise
        """
        print(f"[_update_session_token_usage] Called with session_id={session_id}, user_id={user_id}")
        print(f"[_update_session_token_usage] usage_info: {usage_info}")
        try:
            logger.debug(
                f"Calling update_token_usage: session_id={session_id}, "
                f"user_id={user_id}, usage_info={usage_info}"
            )
            print(f"[_update_session_token_usage] Calling session_repo.update_token_usage...")
            result = await self.session_repo.update_token_usage(session_id, usage_info, user_id)
            print(f"[_update_session_token_usage] session_repo.update_token_usage returned: {result}")
            if result:
                success_msg = f"Token usage updated successfully for session {session_id}"
                print(f"[_update_session_token_usage] SUCCESS: {success_msg}")
                logger.info(success_msg)
                return True
            else:
                warning_msg = f"update_token_usage returned None for session {session_id}, user_id: {user_id}"
                print(f"[_update_session_token_usage] WARNING: {warning_msg}")
                logger.warning(warning_msg)
                return False
        except Exception as e:
            error_msg = f"Exception in _update_session_token_usage: {e}"
            print(f"[_update_session_token_usage] EXCEPTION: {error_msg}")
            import traceback
            print(f"[_update_session_token_usage] Traceback: {traceback.format_exc()}")
            log_error_with_context(
                e,
                context={
                    "session_id": session_id,
                    "user_id": user_id,
                    "operation": "update_token_usage",
                    "usage_info": usage_info,
                },
                level=logging.ERROR
            )
            logger.error(error_msg, exc_info=True)
            return False

    async def _get_previous_session_data(self, user_id: str) -> dict:
        """
        Get user data from previous completed sessions.
        Returns dict with name, age, email, gender if available.
        """
        if not user_id:
            return {}
        
        try:
            from bson import ObjectId
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Get user document with all sessions
            # Access the collection through the repository
            user_doc = await self.session_repo.collection.find_one({"_id": user_oid})
            
            if not user_doc:
                return {}
            
            # Find the most recent completed session
            sessions = user_doc.get("sessions", [])
            previous_data = {}
            
            # Look through sessions in reverse order (most recent first)
            for session in reversed(sessions):
                session_metadata = session.get("metadata", {})
                onboarding = session_metadata.get("onboarding", {})
                responses = onboarding.get("responses", {})
                
                # If this session has completed onboarding, extract data
                if onboarding.get("complete") and responses:
                    # Extract name, email, gender (but NOT age - age is always asked)
                    if "name" in responses and "name" not in previous_data:
                        previous_data["name"] = responses.get("name")
                    if "email" in responses and "email" not in previous_data:
                        previous_data["email"] = responses.get("email")
                    if "gender" in responses and "gender" not in previous_data:
                        previous_data["gender"] = responses.get("gender")
                    
                    # If we have all required fields (name, email, gender), break
                    # Note: age is not included as it's always asked
                    if all(key in previous_data for key in ["name", "email", "gender"]):
                        break
            
            return previous_data
        except Exception:
            # If any error occurs, return empty dict
            return {}

    async def _get_previous_session_concerns_and_products(self, user_id: str, current_session_id: str) -> dict:
        """
        Get previous session's concerns and product recommendations.
        Returns dict with previous_concerns, previous_products, and previous_messages.
        """
        if not user_id:
            return {}
        
        try:
            from bson import ObjectId
            user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Get user document with all sessions
            user_doc = await self.session_repo.collection.find_one({"_id": user_oid})
            
            if not user_doc:
                return {}
            
            # Find the most recent completed session (excluding current session)
            sessions = user_doc.get("sessions", [])
            previous_session_data = {}
            
            # Look through sessions in reverse order (most recent first)
            for session in reversed(sessions):
                session_id_raw = session.get("session_id")
                session_id = str(session_id_raw) if session_id_raw is not None else None
                # Skip current session
                if session_id == str(current_session_id):
                    continue
                
                session_metadata = session.get("metadata", {})
                onboarding = session_metadata.get("onboarding", {})
                responses = onboarding.get("responses", {})
                messages = session.get("messages", [])
                
                # If this session has completed onboarding, extract concerns and products
                # Check for sessions where major concerns are mapped (concern field exists and is not empty)
                if onboarding.get("complete") and responses:
                    # Extract concerns - only consider sessions where concerns are actually mapped
                    previous_concerns = self._normalize_concerns(responses.get("concern", []))
                    
                    # Only process if this session has major concerns mapped
                    if previous_concerns:
                        # Extract product recommendations from messages
                        previous_products = []
                        recommendation_text = ""
                        
                        # Look for product recommendation messages (usually the last assistant message)
                        for msg in reversed(messages):
                            if msg.get("role") == "assistant":
                                content = msg.get("content", "")
                                # Check if this message contains product recommendations
                                # Product recommendations typically mention product names
                                if any(keyword in content.lower() for keyword in ["recommend", "suggest", "product", "supplement"]):
                                    recommendation_text = content
                                    # Try to extract product names (they're usually in the message)
                                    # This is a simple extraction - product names are typically at the start of each recommendation
                                    lines = content.split("\n")
                                    for line in lines:
                                        line = line.strip()
                                        if line and not line.startswith(("IMPORTANT", "Note:", "⚠️", "Since you", "STRONG MEDICAL")):
                                            # Likely a product name or title
                                            if len(line) < 100 and not line.startswith("Since"):
                                                product_name = line.split(":")[0].strip()
                                                if product_name and product_name not in previous_products:
                                                    previous_products.append(product_name)
                                    break
                        
                        previous_session_data = {
                            "previous_concerns": previous_concerns,
                            "previous_products": previous_products[:3],  # Limit to 3 products
                            "previous_recommendation_text": recommendation_text,
                        }
                        break  # Found the most recent completed session with major concerns
            
            return previous_session_data
        except Exception as e:
            import logging
            logging.error(f"Error getting previous session concerns: {e}")
            return {}

    async def _check_if_major_concern_same(self, user_id: str, current_session_id: str, current_concerns: list[str]) -> bool:
        """
        Check if the major concern (first concern) from previous session matches current major concern.
        
        Args:
            user_id: User ID to check previous sessions
            current_session_id: Current session ID to exclude
            current_concerns: List of current normalized concerns
            
        Returns:
            True if major concern (first concern) is the same, False otherwise
        """
        if not user_id or not current_concerns:
            return False
        
        # Get the major concern (first concern)
        current_major_concern = current_concerns[0] if current_concerns else None
        if not current_major_concern:
            return False
        
        try:
            # Get previous session data
            previous_data = await self._get_previous_session_concerns_and_products(user_id, current_session_id)
            previous_concerns = previous_data.get("previous_concerns", [])
            
            if not previous_concerns:
                return False
            
            # Get the major concern from previous session (first concern)
            previous_major_concern = previous_concerns[0] if previous_concerns else None
            
            # Compare major concerns
            return previous_major_concern == current_major_concern
        except Exception as e:
            import logging
            logging.error(f"Error checking if major concern is same: {e}")
            return False

    async def create_session(self, metadata: dict | None = None, user_id: str | None = None) -> Session:
        # Check if user exists if user_id is provided
        user_exists = False
        is_logged_in = False
        
        if user_id and self.user_repo:
            user_exists = await self.user_repo.user_exists(user_id)
            is_logged_in = user_exists  # If user exists, they're considered logged in
        
        # Store user info in metadata
        if metadata is None:
            metadata = {}
        if user_id:
            metadata["user_id"] = user_id
            metadata["user_exists"] = user_exists
            metadata["is_logged_in"] = is_logged_in
        
        session = await self.session_repo.create(metadata=metadata, user_id=user_id)
        
        # Check if user has previous sessions and get their data
        has_previous_sessions = metadata.get("has_previous_sessions", False)
        if has_previous_sessions and user_id:
            previous_data = await self._get_previous_session_data(user_id)
            if previous_data:
                # Pre-populate onboarding responses with previous data
                # Note: age is NOT included as it's always asked every session
                onboarding_state = {
                    "step": 0,
                    "responses": previous_data,  # Pre-populate with name, email, gender (age will be asked)
                    "complete": False,
                    "awaiting_answer": False,
                }
                # Update session metadata with pre-populated data
                session_metadata = session.metadata or {}
                session_metadata["onboarding"] = onboarding_state
                session = await self.session_repo.update_metadata(
                    session_id=session.id,
                    metadata=session_metadata,
                    user_id=user_id,
                )
        
        # Add to quiz_sessions collection if user_id is provided
        if user_id and self.quiz_session_repo:
            await self.quiz_session_repo.add_session(user_id, session.id)
        
        return session

    async def get_session(self, session_id: str, user_id: str | None = None) -> Session:
        session = await self.session_repo.get(session_id, user_id=user_id)
        if not session:
            raise SessionNotFoundError(f"Session {session_id} not found.")
        return session

    async def handle_message(self, payload: ChatRequest) -> ChatResponse:
        # Try to get user_id from session metadata if available
        # First try without user_id (legacy format), then with user_id if found
        session = await self.session_repo.get(payload.session_id)
        if not session:
            raise SessionNotFoundError(f"Session {payload.session_id} not found.")
        
        # Extract user_id from session metadata for subsequent operations
        user_id = self._get_user_id_from_session(session)
        
        # Get isRegistered status for all responses
        is_registered = self._get_is_registered_from_session(session)

        user_message = ChatMessage(role="user", content=payload.message)

        onboarding_state = self._get_onboarding_state(session)
        
        # Check if this is the very first message (session has no messages)
        # If so, automatically start onboarding by asking the first question
        # UNLESS the first question was already shown via GET /first-question endpoint
        is_first_message = len(session.messages) == 0
        first_question_already_shown = onboarding_state.get("first_question_shown", False)
        
        if is_first_message and not onboarding_state.get("complete") and not first_question_already_shown:
            # Initialize onboarding state if not already initialized
            if onboarding_state.get("step", 0) == 0 and not onboarding_state.get("awaiting_answer"):
                # Get the first question
                has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)
                ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
                
                if ordered_steps:
                    first_field = ordered_steps[0]
                    first_prompt = self._build_prompt(field=first_field, responses=onboarding_state["responses"])
                    
                    # Build the first question with friendly greeting
                    question_content = self._friendly_question(
                        prompt=first_prompt,
                        step=0,
                        prev_answer=None,
                        prev_field=None,
                        responses=onboarding_state.get("responses", {}),
                    )
                    
                    # Save the user's trigger message (even though we ignore its content)
                    await self.session_repo.append_messages(
                        session_id=session.id, messages=[user_message], user_id=user_id
                    )
                    
                    # Create the first question reply
                    first_reply = ChatMessage(role="assistant", content=question_content)
                    
                    # Get options for the first question
                    options, question_type = self._get_question_options(first_field)
                    
                    # Update onboarding state
                    onboarding_state["step"] = 0
                    onboarding_state["awaiting_answer"] = True
                    await self.session_repo.append_messages(
                        session_id=session.id, messages=[first_reply], user_id=user_id
                    )
                    await self.session_repo.update_metadata(
                        session_id=session.id,
                        metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                        user_id=user_id,
                    )
                    
                    return ChatResponse(
                        session_id=session.id,
                        reply=first_reply,
                        options=options,
                        question_type=question_type,
                        isRegistered=is_registered,
                    )

        # Check if onboarding is complete and recommendations have been shown
        # If so, prevent further conversation
        if onboarding_state.get("complete") and onboarding_state.get("recommendations_shown"):
            end_message = ChatMessage(
                role="assistant",
                content="Thank you for completing the quiz! Your personalized recommendations have been provided above. If you have any questions, please feel free to reach out to our support team. Have a great day! 😊"
            )
            await self.session_repo.append_messages(
                session_id=session.id, messages=[user_message, end_message], user_id=user_id
            )
            return ChatResponse(
                session_id=session.id,
                reply=end_message,
                options=None,
                question_type=None,
                isRegistered=is_registered,
            )

        # Check if user has previous sessions (for returning users)
        has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)

        ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
        acknowledgment: str | None = None

        # Check if we're waiting for registration confirmation (this should be checked first, before normal field validation)
        if onboarding_state.get("awaiting_registration_confirmation"):
            user_response_lower = payload.message.strip().lower()
            if user_response_lower in ["okay", "ok", "yes", "yep", "yeah", "sure", "alright", "y"]:
                # Redirect to registration
                redirect_message = (
                    "Perfect! I'll redirect you to create a separate registration. "
                    "This will give your family member the best personalized experience! 🎯"
                )
                reply = ChatMessage(role="assistant", content=redirect_message)
                
                await self.session_repo.append_messages(
                    session_id=session.id, messages=[user_message, reply], user_id=user_id
                )
                onboarding_state["awaiting_registration_confirmation"] = False
                await self.session_repo.update_metadata(
                    session_id=session.id,
                    metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                    user_id=user_id,
                )
                return ChatResponse(
                    session_id=session.id,
                    reply=reply,
                    redirect_url="https://viteezy.nl/login",
                    isRegistered=is_registered,
                )
            elif user_response_lower in ["no", "nope", "nah", "n"]:
                # User wants to continue here, proceed with family flow
                onboarding_state["awaiting_registration_confirmation"] = False
                onboarding_state["step"] += 1  # Move to next step (family_name)
                onboarding_state["awaiting_answer"] = False
                acknowledgment = "No problem! Let's continue with the quiz for your family member here. 😊"
                await self.session_repo.append_messages(
                    session_id=session.id, messages=[user_message], user_id=user_id
                )
                await self.session_repo.update_metadata(
                    session_id=session.id,
                    metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                    user_id=user_id,
                )
                # Continue to show next question below
            else:
                # Invalid response, ask again
                error_reply = ChatMessage(
                    role="assistant",
                    content="Please choose 'Yes' to redirect to registration or 'No' to continue here."
                )
                options = [
                    QuestionOption(value="yes", label="Yes"),
                    QuestionOption(value="no", label="No"),
                ]
                await self.session_repo.append_messages(
                    session_id=session.id, messages=[user_message, error_reply], user_id=user_id
                )
                await self.session_repo.update_metadata(
                    session_id=session.id,
                    metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                    user_id=user_id,
                )
                return ChatResponse(
                    session_id=session.id,
                    reply=error_reply,
                    options=options,
                    question_type="yes_no",
                    isRegistered=is_registered,
                )

        if onboarding_state["step"] < len(ordered_steps):
            if onboarding_state["awaiting_answer"]:
                current_field = ordered_steps[onboarding_state["step"]]
                is_valid, normalized, error_reply = self._validate_response(
                    field=current_field,
                    raw_value=payload.message.strip(),
                    responses=onboarding_state["responses"],
                )
                if not is_valid:
                    reply = ChatMessage(role="assistant", content=error_reply)
                    # Get options for the current question to show again
                    options, question_type = self._get_question_options(current_field)
                    
                    await self.session_repo.append_messages(
                        session_id=session.id, messages=[user_message, reply], user_id=user_id
                    )
                    await self.session_repo.update_metadata(
                        session_id=session.id,
                        metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                        user_id=user_id,
                    )
                    return ChatResponse(
                        session_id=session.id,
                        reply=reply,
                        options=options,
                        question_type=question_type,
                        isRegistered=is_registered,
                    )

                self._save_response(
                    field=current_field,
                    normalized=normalized,
                    responses=onboarding_state["responses"],
                )
                onboarding_state["last_answer"] = normalized
                onboarding_state["last_field"] = current_field
                
                # Special handling for "for_whom" = "family"
                if current_field == "for_whom" and normalized == "family":
                    # Show registration suggestion and wait for user response
                    registration_message = (
                        "I understand you'd like to get recommendations for a family member. "
                        "For the best personalized experience, I'd recommend creating a separate registration "
                        "for your family member at https://viteezy.nl/login so they can have their own "
                        "personalized product recommendations.\n\n"
                        "Would you like to do that?"
                    )
                    reply = ChatMessage(role="assistant", content=registration_message)
                    onboarding_state["awaiting_registration_confirmation"] = True
                    onboarding_state["awaiting_answer"] = False
                    # Don't increment step yet - wait for their response
                    
                    # Provide yes/no options for frontend
                    options = [
                        QuestionOption(value="yes", label="Yes"),
                        QuestionOption(value="no", label="No"),
                    ]
                    
                    await self.session_repo.append_messages(
                        session_id=session.id, messages=[user_message, reply], user_id=user_id
                    )
                    await self.session_repo.update_metadata(
                        session_id=session.id,
                        metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                        user_id=user_id,
                    )
                    return ChatResponse(
                        session_id=session.id,
                        reply=reply,
                        options=options,
                        question_type="yes_no",
                    )
                
                # Normal flow - increment step and get acknowledgment
                onboarding_state["step"] += 1
                onboarding_state["awaiting_answer"] = False

                # Generate empathetic acknowledgment based on the answer
                # Note: responses dict has been updated by _save_response, so we can check saved values
                acknowledgment = self._get_empathetic_acknowledgment(
                    field=current_field,
                    answer=normalized,
                    responses=onboarding_state["responses"],
                )
                
                # Handle previous_concern_followup response
                if current_field == "previous_concern_followup":
                    # Store the response (yes/no) in both onboarding_state and responses dict
                    onboarding_state["previous_concern_followup_checked"] = True
                    onboarding_state["previous_concern_followup_response"] = normalized
                    # Also store in responses so it's included in context for product recommendations
                    onboarding_state["responses"]["previous_concern_followup"] = normalized
                    # Get previous concerns for product recommendations
                    if user_id:
                        previous_data = await self._get_previous_session_concerns_and_products(user_id, session.id)
                        onboarding_state["previous_concerns"] = previous_data.get("previous_concerns", [])
                        onboarding_state["previous_products"] = previous_data.get("previous_products", [])
                    # Continue to next question (medical_treatment)
                    await self.session_repo.update_metadata(
                        session_id=session.id,
                        metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                        user_id=user_id,
                    )
                    # Don't return here - continue to show next question
                
                # Check if this was the medical_treatment question - if so, generate recommendations but end conversation
                if current_field == "medical_treatment":
                    # Mark onboarding as complete
                    onboarding_state["complete"] = True
                    
                    # Save the user's response first
                    await self.session_repo.append_messages(
                        session_id=session.id, messages=[user_message], user_id=user_id
                    )
                    
                    # Generate product recommendations even though conversation ends
                    # This allows /useridLogin to retrieve them later
                    profile_context = onboarding_state.get("responses", {})
                    previous_products = onboarding_state.get("previous_products", [])
                    previous_concern_resolved = onboarding_state.get("previous_concern_resolved")
                    previous_concerns = onboarding_state.get("previous_concerns", [])
                    
                    try:
                        recommended_products, product_documents = await self.product_service.find_relevant_products(
                            message=None,
                            context=profile_context,
                            limit=10,
                            exclude_product_titles=previous_products if previous_concern_resolved is False else [],
                        )
                        
                        if not recommended_products and previous_products and previous_concern_resolved is False:
                            recommended_products, product_documents = await self.product_service.find_relevant_products(
                                message=None,
                                context=profile_context,
                                limit=3,
                                include_product_titles=previous_products,
                            )
                        
                        if not recommended_products:
                            recommended_products, product_documents = await self.product_service.find_relevant_products(
                                message=None,
                                context=profile_context,
                                limit=3,
                            )
                    except Exception as e:
                        import logging
                        logging.error(f"Error finding products for medical_treatment: {e}")
                        recommended_products = []
                        product_documents = {}
                    
                    # Generate recommendation message and save to session (but don't return it)
                    if recommended_products:
                        recommendation_message = await self._format_product_recommendations(
                            recommended_products,
                            profile_context,
                            product_documents,
                            previous_concern_resolved=previous_concern_resolved,
                            previous_concerns=previous_concerns,
                            previous_products=previous_products if previous_concern_resolved is False else [],
                        )
                        recommendation_reply = ChatMessage(role="assistant", content=recommendation_message)
                        await self.session_repo.append_messages(
                            session_id=session.id, messages=[recommendation_reply], user_id=user_id
                        )
                    
                    # Mark recommendations as shown and store product titles
                    product_titles = [product.title for product in recommended_products] if recommended_products else []
                    onboarding_state["recommendations_shown"] = True
                    onboarding_state["recommended_product_titles"] = product_titles
                    await self.session_repo.update_metadata(
                        session_id=session.id,
                        metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                        user_id=user_id,
                    )
                    
                    # End conversation immediately - return with content: null (but recommendations are saved)
                    is_registered = self._get_is_registered_from_session(session)
                    return ChatResponse(
                        session_id=session.id,
                        reply=None,  # No message/content in response
                        options=None,
                        question_type=None,
                        isRegistered=is_registered,
                    )

            # Check if we should ask previous_concern_followup question
            # This should be asked if: user_id exists, has_previous_sessions, and major concern is the same
            # Only check once when concerns are available and we haven't checked before
            should_ask_previous_concern_followup = onboarding_state.get("should_ask_previous_concern_followup", False)
            if user_id and has_previous_sessions and not onboarding_state.get("previous_concern_followup_checked"):
                current_concerns = self._normalize_concerns(onboarding_state.get("responses", {}).get("concern", []))
                if current_concerns:
                    # Check if major concern is the same as previous session
                    should_ask_previous_concern_followup = await self._check_if_major_concern_same(
                        user_id, session.id, current_concerns
                    )
                    # Store this in onboarding state to avoid re-checking
                    onboarding_state["should_ask_previous_concern_followup"] = should_ask_previous_concern_followup

            ordered_steps = self._ordered_steps(
                onboarding_state["responses"], 
                has_previous_sessions=has_previous_sessions,
                should_ask_previous_concern_followup=should_ask_previous_concern_followup
            )

            if onboarding_state["step"] < len(ordered_steps):
                next_field = ordered_steps[onboarding_state["step"]]
                next_prompt = self._build_prompt(field=next_field, responses=onboarding_state["responses"])
                
                # Build the next question with motivational prefix
                question_content = self._friendly_question(
                        prompt=next_prompt,
                        step=onboarding_state["step"],
                        prev_answer=onboarding_state.get("last_answer"),
                        prev_field=onboarding_state.get("last_field"),
                    responses=onboarding_state.get("responses", {}),
                )
                
                # Combine acknowledgment with next question if acknowledgment exists
                if acknowledgment:
                    reply_content = f"{acknowledgment}\n\n{question_content}"
                else:
                    reply_content = question_content
                
                reply = ChatMessage(
                    role="assistant",
                    content=reply_content,
                )
                onboarding_state["awaiting_answer"] = True
                
                # Get options for this question
                options, question_type = self._get_question_options(next_field)
                
                await self.session_repo.append_messages(
                    session_id=session.id, messages=[user_message, reply], user_id=user_id
                )
                await self.session_repo.update_metadata(
                    session_id=session.id,
                    metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                    user_id=user_id,
                )
                return ChatResponse(
                    session_id=session.id,
                    reply=reply,
                    options=options,
                    question_type=question_type,
                    isRegistered=is_registered,
                )
            
            # Onboarding is complete - check if we're waiting for login
            onboarding_state["complete"] = True
            await self.session_repo.update_metadata(
                session_id=session.id,
                metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                user_id=user_id,
            )
            
            # Check if we're waiting for login check (set after medical_treatment)
            # The frontend should call /useridLogin endpoint to check if user exists
            # If user exists, products will be shown automatically
            session_metadata = session.metadata or {}
            user_id = session_metadata.get("user_id")
            
            # If awaiting_login_check, continue to show products (login check happens via /useridLogin)
            if onboarding_state.get("awaiting_login_check"):
                # Clear the flag and continue to product recommendations
                onboarding_state["awaiting_login_check"] = False
                await self.session_repo.update_metadata(
                    session_id=session.id,
                    metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                    user_id=user_id,
                )
            
            # Check if we need to ask about previous concerns (for returning users)
            has_previous_sessions = session_metadata.get("has_previous_sessions", False)
            if has_previous_sessions and user_id and not onboarding_state.get("previous_concern_checked"):
                # Get previous session's concerns and products
                previous_data = await self._get_previous_session_concerns_and_products(user_id, session.id)
                previous_concerns = previous_data.get("previous_concerns", [])
                current_concerns = self._normalize_concerns(onboarding_state.get("responses", {}).get("concern", []))
                
                # Check if there's overlap between previous and current concerns
                if previous_concerns and current_concerns:
                    concerns_overlap = set(previous_concerns) & set(current_concerns)
                    if concerns_overlap:
                        # Same concerns are being repeated - ask if previous products helped
                        # Format concerns properly for display
                        concern_labels = []
                        for c in concerns_overlap:
                            # Get proper label from CONCERN_QUESTIONS if available
                            concern_info = self.CONCERN_QUESTIONS.get(c, {})
                            label = concern_info.get("label", c.replace("_", " ").title())
                            concern_labels.append(label.lower())
                        
                        concerns_text = ", ".join(concern_labels)
                        previous_products = previous_data.get("previous_products", [])
                        products_text = ""
                        if previous_products:
                            products_text = f" (including {', '.join(previous_products[:2])})"
                        
                        question_message = (
                            f"I notice you're still experiencing {concerns_text} concerns. "
                            f"Having taken the previous recommended products{products_text}, has the issue been resolved? "
                            f"Please answer yes or no."
                        )
                        
                        onboarding_state["previous_concern_checked"] = True
                        onboarding_state["awaiting_previous_concern_response"] = True
                        onboarding_state["previous_concerns"] = list(concerns_overlap)
                        onboarding_state["previous_products"] = previous_products
                        
                        await self.session_repo.update_metadata(
                            session_id=session.id,
                            metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                            user_id=user_id,
                        )
                        
                        question_reply = ChatMessage(role="assistant", content=question_message)
                        options = [
                            QuestionOption(value="yes", label="Yes"),
                            QuestionOption(value="no", label="No"),
                        ]
                        
                        await self.session_repo.append_messages(
                            session_id=session.id, messages=[user_message, question_reply], user_id=user_id
                        )
                        
                        return ChatResponse(
                            session_id=session.id,
                            reply=question_reply,
                            options=options,
                            question_type="yes_no",
                            isRegistered=is_registered,
                        )
                elif previous_concerns:
                    # User has previous concerns but current concerns are different - still ask
                    # Format concerns properly for display
                    concern_labels = []
                    for c in previous_concerns:
                        concern_info = self.CONCERN_QUESTIONS.get(c, {})
                        label = concern_info.get("label", c.replace("_", " ").title())
                        concern_labels.append(label.lower())
                    concerns_text = ", ".join(concern_labels)
                    question_message = (
                        f"I see you previously had concerns about {concerns_text}. "
                        f"Have those issues been resolved? Please answer yes or no."
                    )
                    
                    onboarding_state["previous_concern_checked"] = True
                    onboarding_state["awaiting_previous_concern_response"] = True
                    onboarding_state["previous_concerns"] = previous_concerns
                    
                    await self.session_repo.update_metadata(
                        session_id=session.id,
                        metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                        user_id=user_id,
                    )
                    
                    question_reply = ChatMessage(role="assistant", content=question_message)
                    options = [
                        QuestionOption(value="yes", label="Yes"),
                        QuestionOption(value="no", label="No"),
                    ]
                    
                    await self.session_repo.append_messages(
                        session_id=session.id, messages=[user_message, question_reply], user_id=user_id
                    )
                    
                    return ChatResponse(
                        session_id=session.id,
                        reply=question_reply,
                        options=options,
                        question_type="yes_no",
                        isRegistered=is_registered,
                    )
                else:
                    # No previous concerns found, mark as checked and proceed
                    onboarding_state["previous_concern_checked"] = True
            
            # Check if we're waiting for response about previous concerns
            if onboarding_state.get("awaiting_previous_concern_response"):
                user_response_lower = payload.message.strip().lower()
                if user_response_lower in ["yes", "yep", "yeah", "y"]:
                    # Issue has been resolved - proceed normally
                    onboarding_state["previous_concern_resolved"] = True
                    onboarding_state["awaiting_previous_concern_response"] = False
                elif user_response_lower in ["no", "nope", "nah", "n"]:
                    # Issue has NOT been resolved - store response and proceed with strong doctor recommendation
                    onboarding_state["previous_concern_resolved"] = False
                    onboarding_state["awaiting_previous_concern_response"] = False
                else:
                    # Invalid response, ask again
                    error_reply = ChatMessage(
                        role="assistant",
                        content="Please answer 'yes' or 'no'. Has the previous issue been resolved?"
                    )
                    options = [
                        QuestionOption(value="yes", label="Yes"),
                        QuestionOption(value="no", label="No"),
                    ]
                    await self.session_repo.append_messages(
                        session_id=session.id, messages=[user_message, error_reply], user_id=user_id
                    )
                    await self.session_repo.update_metadata(
                        session_id=session.id,
                        metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                        user_id=user_id,
                    )
                    return ChatResponse(
                        session_id=session.id,
                        reply=error_reply,
                        options=options,
                        question_type="yes_no",
                        isRegistered=is_registered,
                    )
                
                # Update metadata with response and store user message
                await self.session_repo.append_messages(
                    session_id=session.id, messages=[user_message], user_id=user_id
                )
                await self.session_repo.update_metadata(
                    session_id=session.id,
                    metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                    user_id=user_id,
                )
                # Continue to product recommendations below - DO NOT return here
            
            # Get product recommendations based on all onboarding responses
            profile_context = onboarding_state.get("responses", {})
            
            # Get previous products to exclude them initially (but include with caution if no others found)
            previous_products = onboarding_state.get("previous_products", [])
            previous_concern_resolved = onboarding_state.get("previous_concern_resolved")
            previous_concerns = onboarding_state.get("previous_concerns", [])
            
            try:
                # First, try to find products excluding previous ones (only if issue not resolved)
                recommended_products, product_documents = await self.product_service.find_relevant_products(
                    message=None,
                    context=profile_context,
                    limit=10,  # Get more products to filter from
                    exclude_product_titles=previous_products if previous_concern_resolved is False else [],
                )
                
                # If no products found and we have previous products, include them with caution
                if not recommended_products and previous_products and previous_concern_resolved is False:
                    # Get previous products with caution - search specifically for them
                    recommended_products, product_documents = await self.product_service.find_relevant_products(
                        message=None,
                        context=profile_context,
                        limit=3,
                        include_product_titles=previous_products,  # Only get these specific products
                    )
                
                # Always ensure we have products - if still none, get any products
                if not recommended_products:
                    recommended_products, product_documents = await self.product_service.find_relevant_products(
                        message=None,
                        context=profile_context,
                        limit=3,
                    )
            except Exception as e:
                import logging
                logging.error(f"Error finding products: {e}")
                # Fallback if product search fails
                recommended_products = []
                product_documents = {}
            
            # Generate clinical, direct recommendation message
            # Pass previous concern info to add doctor recommendation if needed
            recommendation_message = await self._format_product_recommendations(
                recommended_products,
                profile_context,
                product_documents,
                previous_concern_resolved=previous_concern_resolved,
                previous_concerns=previous_concerns,
                previous_products=previous_products if previous_concern_resolved is False else [],
            )
            
            recommendation_reply = ChatMessage(role="assistant", content=recommendation_message)
            await self.session_repo.append_messages(
                session_id=session.id, messages=[recommendation_reply], user_id=user_id
            )
            
            # Mark onboarding as complete and recommendations as shown
            # Store product titles in metadata for later retrieval
            product_titles = [product.title for product in recommended_products]
            onboarding_state["complete"] = True
            onboarding_state["recommendations_shown"] = True
            onboarding_state["recommended_product_titles"] = product_titles
            await self.session_repo.update_metadata(
                session_id=session.id,
                metadata={**(session.metadata or {}), "onboarding": onboarding_state},
                user_id=user_id,
            )
            
            return ChatResponse(
                session_id=session.id,
                reply=recommendation_reply,
                options=None,
                question_type=None,
                isRegistered=is_registered,
            )

        profile_context = onboarding_state.get("responses", {})
        combined_context = {**profile_context}
        if payload.context:
            combined_context.update(payload.context)

        trimmed_history = session.messages[-settings.max_history_turns * 2 :]

        products, product_docs = await self.product_service.find_relevant_products(
            message=payload.message,
            context=combined_context,
            limit=settings.product_context_limit,
        )
        product_snippets = [product.to_prompt_snippet() for product in products]

        try:
            reply_text, usage_info = await self.ai_service.generate_reply(
                system_prompt=settings.system_prompt,
                history=trimmed_history,
                user_message=payload.message,
                context=combined_context,
                products=product_snippets,
            )
        except Exception as e:
            log_error_with_context(
                e,
                context={
                    "session_id": session.id,
                    "user_id": user_id,
                    "message_length": len(payload.message),
                }
            )
            # Return a graceful error message instead of crashing
            reply_text = "I apologize, but I'm experiencing technical difficulties right now. Please try again in a moment."
            usage_info = {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "cost": 0.0,
                "model": settings.openai_model,
            }
            # Re-raise to let the error handler deal with it
            raise

        assistant_message = ChatMessage(role="assistant", content=reply_text)

        try:
            await self.session_repo.append_messages(
                session_id=session.id, messages=[user_message, assistant_message], user_id=user_id
            )
        except Exception as e:
            log_error_with_context(
                e,
                context={
                    "session_id": session.id,
                    "user_id": user_id,
                    "operation": "append_messages",
                }
            )
            # Log but don't fail the request - message was already generated
            logger.warning(f"Failed to save messages to database: {e}")
        
        # Update token usage in session metadata (non-blocking)
        # Always log to ensure we can see what's happening
        print(f"[TOKEN_USAGE] Starting update for session {session.id}, user_id: {user_id}")
        print(f"[TOKEN_USAGE] usage_info type: {type(usage_info)}, value: {usage_info}")
        
        # Validate usage_info has required fields
        if not usage_info or not isinstance(usage_info, dict):
            error_msg = f"Invalid usage_info for session {session.id}: {usage_info}"
            print(f"[TOKEN_USAGE] ERROR: {error_msg}")
            logger.error(error_msg)
        elif usage_info.get("input_tokens", 0) == 0 and usage_info.get("output_tokens", 0) == 0:
            warning_msg = (
                f"usage_info has zero tokens for session {session.id}: {usage_info}. "
                f"This might indicate the OpenAI API didn't return usage data."
            )
            print(f"[TOKEN_USAGE] WARNING: {warning_msg}")
            logger.warning(warning_msg)
        else:
            info_msg = (
                f"Updating token usage for session {session.id}, user_id: {user_id}, "
                f"usage_info: input={usage_info.get('input_tokens')}, "
                f"output={usage_info.get('output_tokens')}, "
                f"total={usage_info.get('total_tokens')}, "
                f"cost=${usage_info.get('cost', 0):.6f}, "
                f"model={usage_info.get('model', 'unknown')}"
            )
            print(f"[TOKEN_USAGE] {info_msg}")
            logger.info(info_msg)
            try:
                print(f"[TOKEN_USAGE] Calling _update_session_token_usage...")
                result = await self._update_session_token_usage(session.id, usage_info, user_id)
                print(f"[TOKEN_USAGE] _update_session_token_usage returned: {result}")
                if result:
                    success_msg = (
                        f"✅ Successfully updated token usage for session {session.id}: "
                        f"input={usage_info.get('input_tokens')}, "
                        f"output={usage_info.get('output_tokens')}, "
                        f"cost=${usage_info.get('cost', 0):.6f}"
                    )
                    print(f"[TOKEN_USAGE] SUCCESS: {success_msg}")
                    logger.info(success_msg)
                else:
                    warning_msg = (
                        f"⚠️ Token usage update returned False/None for session {session.id}, user_id: {user_id}. "
                        f"Check logs above for details."
                    )
                    print(f"[TOKEN_USAGE] WARNING: {warning_msg}")
                    logger.warning(warning_msg)
            except Exception as e:
                error_msg = f"❌ Failed to update token usage for session {session.id}: {e}"
                print(f"[TOKEN_USAGE] EXCEPTION: {error_msg}")
                print(f"[TOKEN_USAGE] Exception details: {type(e).__name__}: {str(e)}")
                import traceback
                print(f"[TOKEN_USAGE] Traceback: {traceback.format_exc()}")
                log_error_with_context(
                    e,
                    context={
                        "session_id": session.id,
                        "user_id": user_id,
                        "operation": "update_token_usage",
                        "usage_info": usage_info,
                    }
                )
                # Log but don't fail the request
                logger.error(error_msg, exc_info=True)

        return ChatResponse(
            session_id=session.id,
            reply=assistant_message,
            options=None,
            question_type=None,
            isRegistered=is_registered,
        )

    def _get_onboarding_state(self, session: Session) -> dict:
        state = {}
        if session.metadata and isinstance(session.metadata, dict):
            state = session.metadata.get("onboarding") or {}
        return {
            "step": int(state.get("step", 0)),
            "awaiting_answer": bool(state.get("awaiting_answer", False)),
            "awaiting_registration_confirmation": bool(state.get("awaiting_registration_confirmation", False)),
            "responses": dict(state.get("responses", {})),
            "complete": bool(state.get("complete", False)),
            "last_answer": state.get("last_answer"),
            "last_field": state.get("last_field"),
            "first_question_shown": bool(state.get("first_question_shown", False)),
        }

    def _ordered_steps(self, responses: dict, has_previous_sessions: bool = False, 
                      should_ask_previous_concern_followup: bool = False) -> list[str]:
        """
        Generate ordered list of onboarding steps.
        
        Args:
            responses: User responses dictionary
            has_previous_sessions: If True, skip name, email, gender for returning users (but always ask age)
            should_ask_previous_concern_followup: If True, add previous_concern_followup question before medical_treatment
        """
        steps = []
        
        # Skip name, email, gender for returning users (but always ask age)
        if not has_previous_sessions:
            steps.append("name")
        
        steps.append("for_whom")

        if (responses.get("for_whom") or "") == "family":
            steps.extend(["family_name", "relation"])

        # Age is always asked (even for returning users)
        steps.append("age")

        # For returning users who select "me", skip name, email, gender, knowledge, vitamin_count
        # and go directly to protein (after age)
        if has_previous_sessions and (responses.get("for_whom") or "") == "me":
            # Skip directly to protein question (age already added above)
            steps.append("protein")
        else:
            # For new users or family members, include all questions
            if not has_previous_sessions:
                steps.extend(["email", "knowledge", "vitamin_count"])
            steps.append("protein")
            if not has_previous_sessions:
                steps.append("gender")
        
        # Get gender (either from current responses or pre-populated from previous session)
        gender = (responses.get("gender") or "").lower()

        if gender in {"woman", "female", "gender neutral"}:
            steps.append("conceive")
            if (responses.get("conceive") or "").lower() == "yes":
                steps.append("situation")
        elif gender == "male":
            steps.append("children")

        steps.append("concern")
        concerns = self._normalize_concerns(responses.get("concern"))
        if concerns:
            steps.extend(self._concern_followup_steps(concerns))
        
        # Add lifestyle questions after concern questions
        steps.extend([
            "lifestyle_status",
            "fruit_intake",
            "vegetable_intake",
            "dairy_intake",
            "fiber_intake",
            "protein_intake",
            "eating_habits",
        ])
        
        # Conditional: meat and fish questions only if not vegetarian/vegan
        eating_habits = (responses.get("eating_habits") or "").lower()
        if eating_habits not in {"vegetarian", "vegan"}:
            steps.extend(["meat_intake", "fish_intake"])
        
        # Alcohol filter question
        steps.append("drinks_alcohol")
        
        # Conditional: detailed alcohol questions only if drinks alcohol
        drinks_alcohol = (responses.get("drinks_alcohol") or "").lower()
        if drinks_alcohol in {"yes", "y", "yeah", "yep"}:
            steps.extend(["alcohol_daily", "alcohol_weekly"])
        
        # Coffee and smoking
        steps.extend(["coffee_intake", "smokes"])
        
        # Allergies, dietary preferences, and other questions
        steps.extend([
            "allergies",
            "dietary_preferences",
            "sunlight_exposure",
            "iron_advised",
            "ayurveda_view",
            "new_product_attitude",
        ])
        
        # Add previous_concern_followup question before medical_treatment if needed
        if should_ask_previous_concern_followup:
            steps.append("previous_concern_followup")
        
        steps.append("medical_treatment")  # Final question before recommendations
        
        return steps

    def _build_prompt(self, field: str, responses: dict) -> str:
        labels = self._person_labels(responses)
        name = labels["name"]
        person = labels["person"]
        possessive = labels["possessive"]
        is_family = labels["is_family"]
        gender = (responses.get("gender") or "").strip().lower()
        is_woman = gender in {"female", "woman"}
        hormones = " / Hormones" if is_woman and field == "concern" else ""

        if field == "name":
            return self.PROMPTS["name"]
        if field == "for_whom":
            # For returning users, use their name instead of "friend"
            if name and name != "you" and name.lower() != "friend":
                return f"Hey {name}! 😊 Is this quiz for you or for a family member? (me/family)"
            return self.PROMPTS["for_whom"]
        if field == "family_name":
            return self.PROMPTS["family_name"]
        if field == "relation":
            return self.PROMPTS["relation"].format(family_name=person)

        if field == "age":
            return (
                f"How young is {person} feeling these days?"
                if is_family
                else self.PROMPTS["age"].format(name=name)
            )
        if field == "protein":
            return (
                f"Is {person} sipping on any protein shakes or powders lately? (yes/no)"
                if is_family
                else self.PROMPTS["protein"].format(name=name)
            )
        if field == "email":
            return (
                f"Where can I send {possessive} plan? Drop the best email."
                if is_family
                else self.PROMPTS["email"].format(name=name)
            )
        if field == "knowledge":
            return (
                f"How comfy is {person} with vitamins & supplements?"
                f" Pick one: Well informed / Curious / Skeptical."
                if is_family
                else self.PROMPTS["knowledge"].format(name=name)
            )
        if field == "vitamin_count":
            return (
                f"What’s {possessive} current vitamin/supplement load? Options: No / 1 to 3 / 4+."
                if is_family
                else self.PROMPTS["vitamin_count"]
            )
        if field == "gender":
            return (
                f"Which fits {person}: male, woman, or gender neutral?"
                if is_family
                else self.PROMPTS["gender"]
            )
        if field == "conceive":
            return (
                f"Is {person} currently pregnant or breastfeeding? (yes/no)"
                if is_family
                else self.PROMPTS["conceive"].format(name=name)
            )
        if field == "situation":
            return (
                f"What’s {person}'s situation? Pick one: To get pregnant in the next 2 years / "
                f"I am pregnant now / Breastfeeding."
                if is_family
                else self.PROMPTS["situation"]
            )
        if field == "children":
            return (
                f"Is {person} thinking about having kids in the coming years? (yes/no)"
                if is_family
                else self.PROMPTS["children"].format(name=name)
            )
        if field == "concern":
            return (
                f"What's {person}'s biggest wellness focus right now? Pick one: "
                f"Sleep / Stress / Energy / Stomach & Intestines / Skin / Resistance / Weight / Libido / Brain / Hair & nails / Fitness{hormones}"
                if is_family
                else self.PROMPTS["concern"].format(name=name, hormones=hormones)
            )

        concern_question = self._parse_concern_field(field)
        if concern_question:
            concern_key, question_id = concern_question
            return self._concern_prompt(concern_key=concern_key, question_id=question_id, responses=responses)

        # Handle previous_concern_followup question
        if field == "previous_concern_followup":
            return self.PROMPTS["previous_concern_followup"]

        # Handle lifestyle questions
        lifestyle_fields = {
            "lifestyle_status", "fruit_intake", "vegetable_intake", "dairy_intake",
            "fiber_intake", "protein_intake", "eating_habits", "meat_intake",
            "fish_intake", "drinks_alcohol", "alcohol_daily", "alcohol_weekly",
            "coffee_intake", "smokes", "allergies", "dietary_preferences",
            "sunlight_exposure", "iron_advised", "ayurveda_view", "new_product_attitude",
            "medical_treatment",
        }
        if field in lifestyle_fields:
            prompt_template = self.PROMPTS[field]
            # Format with name for personalized questions
            if "{name}" in prompt_template:
                return prompt_template.format(name=name)
            # For family members, adjust the prompt with proper verb agreement
            if is_family and field in {"lifestyle_status", "fruit_intake", "vegetable_intake", 
                                       "dairy_intake", "fiber_intake", "protein_intake", 
                                       "eating_habits", "meat_intake", "fish_intake", 
                                       "drinks_alcohol", "alcohol_daily", "alcohol_weekly",
                                       "coffee_intake", "smokes", "allergies", 
                                       "dietary_preferences", "sunlight_exposure", 
                                       "iron_advised", "ayurveda_view", "new_product_attitude",
                                       "medical_treatment"}:
                import re
                prompt = prompt_template
                pronoun = labels.get("pronoun", "they")
                
                # Fix verb agreement: "do you" → "does {person}", "are you" → "is {person}"
                prompt = re.sub(r'\bDo you\b', f'Does {person}', prompt, flags=re.IGNORECASE)
                prompt = re.sub(r'\bdo you\b', f'does {person}', prompt, flags=re.IGNORECASE)
                prompt = re.sub(r'\bAre you\b', f'Is {person}', prompt, flags=re.IGNORECASE)
                prompt = re.sub(r'\bare you\b', f'is {person}', prompt, flags=re.IGNORECASE)
                prompt = re.sub(r'\bHave you\b', f'Has {person}', prompt, flags=re.IGNORECASE)
                prompt = re.sub(r'\bhave you\b', f'has {person}', prompt, flags=re.IGNORECASE)
                
                # Replace "your" with possessive first (before replacing "you")
                prompt = re.sub(r'\byour\b', possessive, prompt, flags=re.IGNORECASE)
                
                # Replace "you" with person (but not if it's part of "your" which we already replaced)
                prompt = re.sub(r'\byou\b', person, prompt, flags=re.IGNORECASE)
                
                # Fix verb forms after person name: "{person} eat" → "{person} eats"
                verb_fixes = [
                    (r'\beat\b', 'eats'),
                    (r'\bdrink\b', 'drinks'),
                    (r'\bconsume\b', 'consumes'),
                    (r'\bsit\b', 'sits'),
                    (r'\bsmoke\b', 'smokes'),
                    (r'\bwant\b', 'wants'),
                ]
                for pattern, replacement in verb_fixes:
                    # Replace verb after person name
                    prompt = re.sub(rf'({re.escape(person)} {pattern})', f'{person} {replacement}', prompt, flags=re.IGNORECASE)
                
                # Special case: "{person} are" → "{person} is"
                prompt = re.sub(rf'\b{re.escape(person)} are\b', f'{person} is', prompt, flags=re.IGNORECASE)
                
                # Fix "have" → "has" when it's the main verb (not "has been")
                prompt = re.sub(rf'\b{re.escape(person)} have\b(?!\s+been)', f'{person} has', prompt, flags=re.IGNORECASE)
                
                return prompt
            return prompt_template

        prompt_template = self.PROMPTS[field]
        return prompt_template.format(name=name, hormones=hormones, family_name=person)

    @staticmethod
    def _person_labels(responses: dict) -> dict:
        name = responses.get("name") or "friend"
        for_whom = responses.get("for_whom") or "self"
        family_name = responses.get("family_name")
        relation = responses.get("relation") or "family member"
        gender = (responses.get("gender") or "").lower()

        if for_whom == "family":
            is_family = True
            # Capitalize family name if provided
            if family_name:
                person = family_name.title()
                possessive = f"{person}'s"
                reference = person
            else:
                # Use relation if family_name not provided
                person = f"your {relation}"
                possessive = f"your {relation}'s"
                reference = f"your {relation}"
            
            # Determine pronoun based on gender/relation
            if gender in ["woman", "female"]:
                pronoun = "she"
                pronoun_obj = "her"
                pronoun_possessive = "her"
            elif gender in ["male", "man"]:
                pronoun = "he"
                pronoun_obj = "him"
                pronoun_possessive = "his"
            else:
                # Try to infer from relation
                relation_lower = relation.lower() if relation else ""
                if relation_lower in ["son", "brother", "father", "dad", "husband", "boyfriend"]:
                    pronoun = "he"
                    pronoun_obj = "him"
                    pronoun_possessive = "his"
                elif relation_lower in ["daughter", "sister", "mother", "mom", "wife", "girlfriend"]:
                    pronoun = "she"
                    pronoun_obj = "her"
                    pronoun_possessive = "her"
                else:
                    pronoun = "they"
                    pronoun_obj = "them"
                    pronoun_possessive = "their"
        else:
            person = "you"
            possessive = "your"
            reference = "you"
            is_family = False
            pronoun = "you"
            pronoun_obj = "you"
            pronoun_possessive = "your"

        return {
            "name": name,
            "person": person,
            "possessive": possessive,
            "reference": reference,
            "is_family": is_family,
            "pronoun": pronoun,
            "pronoun_obj": pronoun_obj,
            "pronoun_possessive": pronoun_possessive,
            "relation": relation,
            "family_name": family_name,
        }

    def _validate_response(self, field: str, raw_value: str, responses: dict) -> tuple[bool, Any, str]:
        """Validate onboarding answers. Returns (valid, normalized_value, error_message)."""
        val = raw_value.strip()
        name = responses.get("name") or "friend"

        if field == "name":
            if len(val) < 2:
                return False, val, "I want to remember you, can you share a name with at least 2 letters? 😊"
            return True, val, ""

        if field == "for_whom":
            normalized = val.lower()
            allowed = {
                "me": "self",
                "myself": "self",
                "self": "self",
                "for me": "self",
                "no": "self",
                "family": "family",
                "family member": "family",
                "for family": "family",
                "for my family": "family",
                "friend": "family",
                "partner": "family",
                "spouse": "family",
                "yes": "family",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, "Is this for you or for a family member? Just say 'me' or 'family'."

        if field == "family_name":
            if len(val) < 2:
                return False, val, "Tell me their name with at least 2 letters so I can personalize it. 😊"
            return True, val, ""

        if field == "relation":
            if len(val) < 3:
                return False, val, "How are you related? (e.g., spouse, parent, sibling, friend)"
            return True, val, ""

        if field == "age":
            if not val.isdigit():
                return False, val, f"{name}, can you share your age as a number (e.g., 27)?"
            age = int(val)
            if age <= 0 or age > 100:
                return False, val, f"{name}, that age feels off. Mind giving me a real number between 1 and 100?"
            return True, str(age), ""

        if field == "protein":
            normalized = val.lower()
            yes_set = {"yes", "y", "yeah", "yep", "sure", "taking", "i do"}
            no_set = {"no", "n", "nope", "nah", "not"}
            if normalized in yes_set:
                return True, "yes", ""
            if normalized in no_set:
                return True, "no", ""
            return False, val, f"{name}, just a quick yes or no, are you taking protein powder or shakes right now?"

        if field == "knowledge":
            normalized = val.lower()
            allowed = {
                "well informed": "well informed",
                "well-informed": "well informed",
                "informed": "well informed",
                "curious": "curious",
                "skeptical": "skeptical",
                "sceptical": "skeptical",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, choose one: Well informed, Curious, or Skeptical."

        if field == "vitamin_count":
            normalized = val.lower()
            allowed = {
                "no": "0",
                "none": "0",
                "0": "0",
                "1": "1 to 3",
                "2": "1 to 3",
                "3": "1 to 3",
                "1 to 3": "1 to 3",
                "1-3": "1 to 3",
                "4": "4+",
                "4+": "4+",
                "5": "4+",
                "5+": "4+",
                "many": "4+",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: No, 1 to 3, or 4+."

        if field == "gender":
            normalized = val.lower()
            allowed = {
                "male": "male",
                "man": "male",
                "m": "male",
                "woman": "female",
                "women": "female",
                "female": "female",
                "f": "female",
                "gender neutral": "gender neutral",
                "neutral": "gender neutral",
                "non-binary": "gender neutral",
                "nonbinary": "gender neutral",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, choose one: male, woman, or gender neutral."

        if field == "conceive":
            normalized = val.lower()
            if normalized in {"yes", "y", "yeah", "yep"}:
                return True, "yes", ""
            if normalized in {"no", "n", "nope", "nah"}:
                return True, "no", ""
            return False, val, f"{name}, a simple yes or no works, are you pregnant or breastfeeding?"

        if field == "situation":
            normalized = val.lower()
            allowed = {
                "to get pregnant in the next 2 years": "planning (2 years)",
                "planning": "planning (2 years)",
                "next 2 years": "planning (2 years)",
                "i am pregnant now": "pregnant",
                "pregnant": "pregnant",
                "breastfeeding": "breastfeeding",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: To get pregnant in the next 2 years / I am pregnant now / Breastfeeding."

        if field == "children":
            normalized = val.lower()
            if normalized in {"yes", "y", "yeah", "yep"}:
                return True, "yes", ""
            if normalized in {"no", "n", "nope", "nah"}:
                return True, "no", ""
            return False, val, f"{name}, just a yes or no, planning for kids in the coming years?"

        if field == "email":
            if "@" in val and "." in val.split("@")[-1] and len(val) > 5:
                return True, val, ""
            return False, val, f"{name}, could you share a real email like youremail@example.com? Promise I’ll keep it safe."

        if field == "concern":
            options = {
                "sleep",
                "stress",
                "energy",
                "stomach & intestines",
                "stomach",
                "intestines",
                "skin",
                "resistance",
                "weight",
                "libido",
                "brain",
                "hair & nails",
                "hair",
                "nails",
                "fitness",
                "hormones",
            }
            parsed = self._parse_concerns(val)
            if parsed:
                return True, parsed, ""
            return False, val, (
                f"{name}, pick one or a few from: Sleep / Stress / Energy / Stomach & Intestines / "
                "Skin / Resistance / Weight / Libido / Brain / Hair & nails / Fitness (Hormones if relevant). "
                "You can separate choices with commas."
            )

        parsed_concern_question = self._parse_concern_field(field)
        if parsed_concern_question:
            concern_key, question_id = parsed_concern_question
            question = self._question_by_key(concern_key, question_id, responses)
            label = self.CONCERN_QUESTIONS.get(concern_key, {}).get("label", concern_key.title())
            if not val:
                return False, val, f"Quick one about {label}: {question or 'can you share a short answer?'}"
            return True, val, ""

        # Lifestyle question validations
        if field == "lifestyle_status":
            normalized = val.lower()
            allowed = {
                "been doing well for a long time": "been doing well for a long time",
                "doing well": "been doing well for a long time",
                "nice on the way": "nice on the way",
                "on the way": "nice on the way",
                "ready to start": "ready to start",
                "starting": "ready to start",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: Been doing well for a long time / Nice on the way / Ready to start"

        if field in {"fruit_intake", "vegetable_intake", "dairy_intake", "fiber_intake", "protein_intake"}:
            normalized = val.lower()
            allowed = {
                "hardly": "hardly",
                "rarely": "hardly",
                "seldom": "hardly",
                "one time": "one time",
                "once": "one time",
                "1": "one time",
                "twice or more": "twice or more",
                "twice": "twice or more",
                "2": "twice or more",
                "more": "twice or more",
                "multiple": "twice or more",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: Hardly / One time / Twice or more"

        if field == "eating_habits":
            normalized = val.lower()
            allowed = {
                "no preference": "no preference",
                "none": "no preference",
                "flexitarian": "flexitarian",
                "vegetarian": "vegetarian",
                "veg": "vegetarian",
                "vegan": "vegan",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: No preference / Flexitarian / Vegetarian / Vegan"

        if field in {"meat_intake", "fish_intake"}:
            normalized = val.lower()
            allowed = {
                "never": "never",
                "no": "never",
                "once or twice": "once or twice",
                "once": "once or twice",
                "twice": "once or twice",
                "1-2": "once or twice",
                "three times or more": "three times or more",
                "three": "three times or more",
                "3": "three times or more",
                "more": "three times or more",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: Never / Once or twice / Three times or more"

        if field in {"drinks_alcohol", "alcohol_daily", "alcohol_weekly", "coffee_intake", "smokes", "sunlight_exposure", "iron_advised", "medical_treatment", "previous_concern_followup"}:
            normalized = val.lower()
            if normalized in {"yes", "y", "yeah", "yep", "sure"}:
                return True, "yes", ""
            if normalized in {"no", "n", "nope", "nah", "not"}:
                return True, "no", ""
            return False, val, f"{name}, just a quick yes or no works here."

        if field == "allergies":
            normalized = val.lower()
            allowed = {
                "no": "no",
                "none": "no",
                "milk": "milk",
                "egg": "egg",
                "eggs": "egg",
                "fish": "fish",
                "shellfish and crustaceans": "shellfish and crustaceans",
                "shellfish": "shellfish and crustaceans",
                "crustaceans": "shellfish and crustaceans",
                "peanut": "peanut",
                "peanuts": "peanut",
                "nuts": "nuts",
                "soy": "soy",
                "gluten": "gluten",
                "wheat": "wheat",
                "pollen": "pollen",
            }
            # Allow multiple allergies separated by commas
            if "," in normalized:
                parts = [part.strip() for part in normalized.split(",")]
                valid_parts = []
                for part in parts:
                    if part in allowed:
                        valid_parts.append(allowed[part])
                if valid_parts:
                    return True, ", ".join(valid_parts), ""
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick from: No / Milk / Egg / Fish / Shellfish and crustaceans / Peanut / Nuts / Soy / Gluten / Wheat / Pollen"

        if field == "dietary_preferences":
            normalized = val.lower()
            allowed = {
                "no preference": "no preference",
                "none": "no preference",
                "lactose-free": "lactose-free",
                "lactose free": "lactose-free",
                "gluten free": "gluten free",
                "gluten-free": "gluten free",
                "paleo": "paleo",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: No preference / Lactose-free / Gluten free / Paleo"

        if field == "ayurveda_view":
            normalized = val.lower()
            allowed = {
                "i am convinced": "i am convinced",
                "convinced": "i am convinced",
                "we can learn a lot from ancient medicine": "we can learn a lot from ancient medicine",
                "learn from ancient medicine": "we can learn a lot from ancient medicine",
                "ancient medicine": "we can learn a lot from ancient medicine",
                "i am open to it": "i am open to it",
                "open to it": "i am open to it",
                "open": "i am open to it",
                "more information needed for an opinion": "more information needed for an opinion",
                "need more information": "more information needed for an opinion",
                "i am skeptical": "i am skeptical",
                "skeptical": "i am skeptical",
                "alternative medicine is nonsense": "alternative medicine is nonsense",
                "nonsense": "alternative medicine is nonsense",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: I am convinced / We can learn a lot from ancient medicine / I am open to it / More information needed for an opinion / I am skeptical / Alternative medicine is nonsense"

        if field == "new_product_attitude":
            normalized = val.lower()
            allowed = {
                "to be the first": "to be the first",
                "first": "to be the first",
                "you are at the forefront of new products": "you are at the forefront of new products",
                "forefront": "you are at the forefront of new products",
                "learn more": "learn more",
                "you are cautiously optimistic": "you are cautiously optimistic",
                "cautiously optimistic": "you are cautiously optimistic",
                "waiting for now": "waiting for now",
                "waiting": "waiting for now",
                "scientific research takes time": "scientific research takes time",
                "research takes time": "scientific research takes time",
            }
            if normalized in allowed:
                return True, allowed[normalized], ""
            return False, val, f"{name}, pick one: To be the first / You are at the forefront of new products / Learn more / You are cautiously optimistic / Waiting for now / Scientific research takes time"

        return True, val, ""

    def _get_empathetic_acknowledgment(
        self, field: str, answer: str, responses: dict[str, Any]
    ) -> str | None:
        """
        Generate empathetic, motivational acknowledgments based on user's answer.
        Makes the bot feel more connected and caring.
        Analyzes the context and severity to provide appropriate responses.
        Personalizes for family members when applicable.
        """
        answer_lower = str(answer).lower()
        labels = self._person_labels(responses)
        is_family = labels.get("is_family", False)
        person = labels.get("person", "you")
        pronoun = labels.get("pronoun", "you")
        pronoun_obj = labels.get("pronoun_obj", "you")
        pronoun_possessive = labels.get("pronoun_possessive", "your")
        reference = labels.get("reference", "you")
        
        # Check if this is a concern detail question (e.g., "concern|sleep|fall_asleep")
        concern_detail = self._parse_concern_field(field)
        if concern_detail:
            concern_key, question_id = concern_detail
            
            # Sleep-related concern details
            if concern_key == "sleep":
                # Severe sleep issues
                if any(term in answer_lower for term in ["less than 5", "less than 7", "still tired", "tired", "exhausted", "drained"]):
                    is_pregnant = responses.get("situation", "").lower() in ["pregnant", "i am pregnant now"]
                    if is_pregnant:
                        return "I understand how difficult this must be, especially during pregnancy. Sleep is so important for both you and your baby. Let's find safe, natural solutions to help you get the rest you need. You're doing the right thing by addressing this! 🌙💕"
                    return "I completely understand how challenging this is. Getting enough quality sleep is crucial for your wellbeing. Let's work together to find solutions that will help you feel more rested and refreshed. You're taking an important step! 🌙"
                
                # Difficulty falling asleep
                if question_id == "fall_asleep" and answer_lower in ["yes", "yep", "yeah"]:
                    return "I know how frustrating it can be when sleep doesn't come easily. We'll find ways to help you relax and drift off more naturally. You're not alone in this! 😴"
                
                # Not feeling refreshed
                if question_id == "wake_refreshed" and "tired" in answer_lower:
                    return "Waking up still tired can really affect your whole day. Let's find solutions to help you get more restorative sleep so you wake up feeling refreshed and ready. We'll get there! ☀️"
            
            # Energy-related concern details
            if concern_key == "energy":
                # Severe energy issues
                if any(term in answer_lower for term in ["totally gone", "gone", "sleepy", "tired", "exhausted", "drained", "low", "very low"]):
                    is_pregnant = responses.get("situation", "").lower() in ["pregnant", "i am pregnant now"]
                    if is_pregnant:
                        return "I know energy can be really challenging during pregnancy. Your body is doing amazing work, and it's completely normal to feel drained. Let's find safe, natural ways to support your energy levels. You're doing great! ⚡💕"
                    return "I hear you on the energy front. Feeling drained can make everything harder. Let's find natural ways to boost your vitality and help you feel more energized throughout the day. We'll work on this together! ⚡"
                
                # Energy completely gone
                if "totally gone" in answer_lower or "gone" in answer_lower:
                    return "I understand how exhausting that must feel. When your energy is completely depleted, it affects everything. Let's find solutions to help restore your natural energy and vitality. You've got this! 💪"
        
        # Name - warm welcome
        if field == "name":
            return f"Nice to meet you, {answer}! I'm so glad you're here. I'm excited to help you on your wellness journey. Let's get started! 😊"
        
        # Pregnancy - congratulations regardless of gender (supporting partner/family)
        # Check "situation" field for detailed pregnancy status (this is where we show specific messages)
        if field == "situation":
            if "pregnant" in answer_lower or answer_lower == "i am pregnant now":
                return "Congratulations in advance! That's such wonderful news. I'm here to help you find the best supplements to support your journey. Let's make sure everything is perfect for you! 💕"
            elif "planning" in answer_lower or "2 years" in answer_lower or "to get pregnant" in answer_lower:
                return "That's exciting that you're planning for this journey! I'm here to help you prepare your body with the right supplements. Let's get you ready for this beautiful chapter! 🌟"
            elif "breastfeeding" in answer_lower:
                return "That's amazing! Breastfeeding is such a special time. I'll help you find supplements that are safe and beneficial for both you and your little one. You're doing great! 💕"
        
        # For "conceive" field (initial yes/no), just acknowledge without congratulating yet
        # We'll congratulate after they specify their situation
        if field == "conceive" and answer_lower in ["yes", "yep", "yeah"]:
            return "Thanks for sharing that with me. I'll help you find the right supplements for your situation. Let's continue! 😊"
        
        # Legacy "pregnant" field support
        if field == "pregnant":
            if "pregnant" in answer_lower or answer_lower in ["yes", "yep", "yeah", "i am pregnant now"]:
                return "Congratulations in advance! That's such wonderful news. I'm here to help you find the best supplements to support your journey. Let's make sure everything is perfect for you! 💕"
            elif "planning" in answer_lower or "2 years" in answer_lower:
                return "That's exciting that you're planning for this journey! I'm here to help you prepare your body with the right supplements. Let's get you ready for this beautiful chapter! 🌟"
            elif "breastfeeding" in answer_lower:
                return "That's amazing! Breastfeeding is such a special time. I'll help you find supplements that are safe and beneficial for both you and your little one. You're doing great! 💕"
        
        # Sleep issues - supportive and reassuring (check both string and list)
        if field == "concern":
            concerns_list = responses.get("concern", [])
            if isinstance(concerns_list, str):
                concerns_list = [concerns_list]
            concerns_text = " ".join(concerns_list).lower() if isinstance(concerns_list, list) else answer_lower
            
            if "sleep" in concerns_text or "sleep" in answer_lower:
                if is_family:
                    return f"I completely understand how challenging lack of sleep can be for {person}. No worries, we'll handle this together and find solutions that work for {pronoun_obj}. {person.title()}'s taking the right step by addressing this! 🌙"
                return "I completely understand how challenging lack of sleep can be. No worries, we'll handle this together and find solutions that work for you. You're taking the right step by addressing this! 🌙"
            
            # Energy issues - motivating
            if any(term in concerns_text or term in answer_lower for term in ["energy", "tired", "fatigue", "exhausted", "drained"]):
                if is_family:
                    return f"I hear you on the energy front for {person}. Let's get {pronoun_obj} feeling more energized and vibrant! We'll find the right support to boost {pronoun_possessive} vitality. {person.title()}'s got this! ⚡"
                return "I hear you on the energy front. Let's get you feeling more energized and vibrant! We'll find the right support to boost your vitality. You've got this! ⚡"
            
            # Stress/Anxiety - supportive
            if any(term in concerns_text or term in answer_lower for term in ["stress", "anxiety", "worried", "overwhelmed"]):
                if is_family:
                    return f"Stress and anxiety can be really tough to deal with. {person.title()} is not alone in this, and I'm here to help {pronoun_obj} find natural ways to feel more calm and balanced. We'll work through this together. 💙"
                return "Stress and anxiety can be really tough to deal with. You're not alone in this, and I'm here to help you find natural ways to feel more calm and balanced. We'll work through this together. 💙"
            
            # Skin concerns - encouraging
            if any(term in concerns_text or term in answer_lower for term in ["skin", "acne", "pimples", "dry", "sensitive"]):
                return "I understand skin concerns can affect your confidence. Let's work together to find products that will help your skin glow and feel its best. You deserve to feel great in your own skin! ✨"
            
            # Weight/Health goals - motivating
            if any(term in concerns_text or term in answer_lower for term in ["weight", "fitness", "health", "wellness"]):
                return "That's fantastic that you're focused on your health goals! I'm excited to help you on this journey. Together, we'll find the perfect supplements to support your wellness. Let's do this! 💪"
            
            # General concern acknowledgment if no specific match
            if concerns_list or answer_lower not in ["no", "none", "nope", "nah"]:
                return "I understand your concerns, and I'm here to help you address them. Let's work together to find the right solutions for you. You're taking a great step towards better health! 💚"
        
        # Medical treatment - supportive and careful (especially important if pregnant)
        if field == "medical_treatment" and answer_lower in ["yes", "yep", "yeah"]:
            is_pregnant = responses.get("situation", "").lower() in ["pregnant", "i am pregnant now"]
            if is_pregnant:
                return "Thank you for sharing that with me. I really appreciate your honesty, especially during this special time. We'll be extra careful with recommendations and make sure everything is safe for both you and your baby. Your health is our top priority. 🏥💕"
            return "Thank you for sharing that with me. I really appreciate your honesty. We'll be extra careful with recommendations and make sure everything is safe for you. Your health is our top priority. 🏥"
        
        # Allergies - reassuring
        if field == "allergies" and answer_lower not in ["no", "none", "nope", "nah"]:
            return "Thanks for letting me know about your allergies. I'll make absolutely sure to recommend only products that are completely safe for you. Your safety comes first, always! 🛡️"
        
        # Dietary preferences - positive
        if field == "eating_habits" and answer_lower in ["vegetarian", "vegan"]:
            if is_family:
                return f"That's wonderful! I respect {person}'s dietary choices completely. I'll make sure all recommendations align perfectly with {pronoun_possessive} values. Let's find the best plant-based support for {pronoun_obj}! 🌱"
            return "That's wonderful! I respect your dietary choices completely. I'll make sure all recommendations align perfectly with your values. Let's find the best plant-based support for you! 🌱"
        
        # Gender - welcoming and inclusive
        if field == "gender":
            return "Perfect! Thanks for sharing that with me. This helps me personalize recommendations just for you. Let's continue! 😊"
        
        # Age-related concerns - supportive
        if field == "age":
            try:
                age = int(answer)
                if age < 18:
                    return "Thanks for sharing your age! I'll make sure all recommendations are age-appropriate and safe for you. Let's find the perfect supplements for your stage of life! 🌟"
                elif age >= 50:
                    return "I appreciate you sharing your age. This helps me recommend products that are specifically beneficial for your life stage. Let's focus on keeping you healthy and vibrant! 💫"
                else:
                    return "Thanks for sharing! This helps me tailor recommendations that are perfect for your age group. Let's continue! 😊"
            except (ValueError, TypeError):
                pass
        
        # Positive health status - celebrating
        if field == "health_status" and any(term in answer_lower for term in ["good", "great", "excellent", "fine", "well"]):
            return "That's wonderful to hear! It's great that you're feeling good. Let's keep that momentum going and find supplements that will help you maintain and even enhance your wellness! 🎉"
        
        # Exercise - encouraging
        if field == "exercise" and answer_lower in ["yes", "yep", "yeah"]:
            return "That's awesome that you're staying active! Exercise combined with the right supplements can really amplify your results. Let's find products that support your active lifestyle! 🏃‍♀️"
        
        # No exercise - non-judgmental support
        if field == "exercise" and answer_lower in ["no", "nope", "nah"]:
            return "No judgment here at all! Everyone's journey is different. Let's find supplements that work for your lifestyle and help you feel your best, regardless of your activity level. You're doing great! 💚"
        
        # Lifestyle questions - acknowledge concerning patterns (vary responses to avoid repetition)
        lifestyle_fields = ["fruit_intake", "vegetable_intake", "dairy_intake", "fiber_intake", "protein_intake"]
        if field in lifestyle_fields:
            if answer_lower == "hardly":
                return "I appreciate your honesty. Nutrition is important, and supplements can help fill in the gaps. Let's make sure you're getting all the nutrients you need! 💚"
            elif answer_lower == "one time":
                # Vary the acknowledgment to avoid repetition
                acknowledgments = [
                    "Good to know! Supplements can help ensure you're getting all the nutrients you need. Let's continue! 🌟",
                    "Thanks for sharing! Every bit of nutrition counts. Let's keep going! 💪",
                    "Got it! Supplements can complement your diet nicely. Next question:",
                ]
                # Use field name to create a consistent but varied response
                field_index = lifestyle_fields.index(field) if field in lifestyle_fields else 0
                return acknowledgments[field_index % len(acknowledgments)]
            elif answer_lower == "twice or more":
                return "That's great! You're doing well with your nutrition. Supplements can still help optimize your intake. Let's continue! 🌟"
        
        # Lifestyle status - acknowledge progress
        if field == "lifestyle_status":
            if "ready to start" in answer_lower:
                return "That's wonderful that you're ready to make positive changes! I'm here to support you every step of the way. Let's build a plan that works for you! 💪"
            elif "nice on the way" in answer_lower:
                return "That's great that you're already on the path! Keep up the momentum, and let's find supplements that will support your continued progress! 🌟"
            elif "been doing well" in answer_lower:
                return "That's fantastic! It's wonderful that you've been maintaining a healthy lifestyle. Let's find supplements that will help you maintain and enhance your wellness! 🎉"
        
        # General positive acknowledgment for any "yes" answer (but not for concerning contexts)
        if answer_lower in ["yes", "yep", "yeah", "sure", "okay", "ok"]:
            # Don't use generic "yes" acknowledgment for concerning health questions
            if field and any(term in field.lower() for term in ["concern", "sleep", "energy", "stress", "medical"]):
                return None  # Let more specific acknowledgments handle these
            return "Perfect! Thanks for sharing that with me. I'm here to help you every step of the way. Let's continue! 😊"
        
        # General acknowledgment for any answer (fallback)
        return None

    def _friendly_question(
        self, prompt: str, step: int, prev_answer: Any | None = None, prev_field: str | None = None, responses: dict | None = None
    ) -> str:
        tone = self._tone_from_answer(prev_answer, prev_field)
        
        # Get family member info if available
        is_family = False
        if responses:
            labels = self._person_labels(responses)
            is_family = labels.get("is_family", False)
        
        # Check for severe concerns to use more empathetic prefixes
        is_severe_concern = False
        if prev_answer:
            answer_text = str(prev_answer).lower()
            severe_indicators = ["less than 5", "less than 7", "still tired", "totally gone", "gone", "exhausted", "drained", "sleepy"]
            is_severe_concern = any(indicator in answer_text for indicator in severe_indicators)
        
        buckets = {
            "celebrate": [
                "Love that! 🎉",
                "Nice, that's great to hear!",
                "Awesome vibes, let's keep it going:",
                "Sweet, thanks for sharing!",
                "Great choice, here's another quick one:",
                "That's solid, let's keep the momentum:",
                "Great energy, rolling on:",
                "You're crushing it, next bit:",
                "Brilliant, tell me this:",
                "Fantastic! Quick follow-up:",
                "High five on that! One more:",
                "Sounds great, here comes the next one:",
            ],
            "supportive": [
                "I hear you, and I'm here to help you through this. Let's work together:",
                "Got it, and we'll sort this out together. You're not alone:",
                "Thanks for being real about that. I appreciate your honesty:",
                "Totally understand, let's dial this in. We've got this:",
                "Noted, and I'm here to support you. Let's make this better:",
                "We'll tackle this together, next question to help:",
                "I'm on your side, tell me a bit more so I can help you better:",
                "Let's figure this out together, one more question:",
                "Thanks for sharing, this helps me help you. Let's continue:",
                "We've got this, quick follow-up:",
                "Let's get you feeling better, next up:",
                "Appreciate the honesty, another quick one:",
                "I'm here with you, let's fine-tune things:",
                "We'll solve this step by step, next one:",
                "You're not alone in this, tell me more:",
                "Let's smooth this out, here's another:",
                "I get it, let's make a plan together:",
                "We'll adjust as we go, quick follow-up:",
                "Let's make this easier for you, next question:",
                "Thanks for trusting me with that, one more:",
                "We'll keep it gentle, share a bit more:",
                "Let's take it one step at a time, next up:",
                "I've got you, help me with this one:",
            ],
            "neutral": [
                "Hey friend! 😊",
                "Great! Let's keep moving forward together:",
                "Thanks for that, I appreciate you sharing. Another quick one:",
                "You're doing great! Here we go:",
                "Appreciate it, this helps me understand you better. Tell me this:",
                "Let's keep the flow going, next question:",
                "I'm here to help you, here's one more:",
                "Thanks for being open with me, answer this:",
                "On we go together, give me your take:",
                "You're making great progress, what about this:",
                "Still with me? I'm here for you. Here's the next one:",
                "Let's continue this journey together, tell me this:",
            ],
        }
        
        # For severe concerns, prioritize more empathetic supportive prefixes
        if is_severe_concern and tone == "supportive":
            severe_supportive = [
                "I understand this is challenging. Let's work through this together:",
                "I hear you, and I'm here to help. Let's take the next step:",
                "This must be really tough. We'll find solutions together:",
                "I appreciate you sharing this with me. Let's continue:",
                "You're not alone in this. Let's keep moving forward:",
            ]
            choices = severe_supportive
        else:
            choices = buckets.get(tone, buckets["neutral"])
        
        prefix = choices[step % len(choices)]
        
        # If prompt already starts with "Hey" (personalized greeting), don't add prefix
        if prompt.strip().startswith("Hey"):
            return prompt
        
        return f"{prefix} {prompt}"

    def _tone_from_answer(self, answer: Any | None, field: str | None = None) -> str:
        if answer is None:
            return "neutral"
        text = str(answer).lower()
        
        # Check for severe concerning answers that need extra support
        severe_concerns = {
            "less than 5",
            "less than 7",
            "still tired",
            "totally gone",
            "gone",
            "exhausted",
            "drained",
            "sleepy",
            "hardly",
        }
        if any(concern in text for concern in severe_concerns):
            return "supportive"
        
        positive = {
            "good",
            "great",
            "pretty good",
            "energized",
            "7+",
            "7 +",
            "high",
            "performance",
            "health",
            "fine",
            "balanced",
            "strong",
            "clear",
            "better",
            "improving",
            "refreshed",
            "solid",
            "steady",
        }
        supportive = {
            "no",
            "none",
            "nah",
            "nope",
            "not really",
            "yes",
            "yep",
            "yeah",
            "low",
            "little",
            "less",
            "tired",
            "drained",
            "pimples",
            "dry",
            "sensitive",
            "bloating",
            "balloon",
            "irregular",
            "worried",
            "stress",
            "cravings",
            "trouble",
            "hard",
            "difficulty",
            "struggle",
            "pain",
            "aching",
            "aging",
            "lines",
            "breakouts",
            "fatigue",
            "bloated",
            "tight",
            "pressure",
            "tense",
            "poor",
            "very poor",
            "very high",
            "high pressure",
            "sleepy",
            "still tired",
            "totally gone",
            "gone",
            "exhausted",
            "hardly",
        }
        sensitive_fields = {
            "weight",
            "sleep",
            "stress",
            "energy",
            "brain",
            "stomach",
            "intestines",
            "skin",
            "resistance",
            "libido",
            "hormones",
            "hair",
            "nails",
            "fitness",
            "concern",
        }
        is_sensitive = any(key in (field or "") for key in sensitive_fields)

        # Strong positives
        if any(token in text for token in positive):
            if is_sensitive and text.strip() in {"yes", "yeah", "yep", "y"}:
                return "supportive"
            return "celebrate"

        # Explicit negatives or challenges
        if any(token in text for token in supportive):
            return "supportive"

        # When unsure on sensitive topics, err on supportive
        if is_sensitive:
            return "supportive"

        return "neutral"

    def _parse_concerns(self, raw: str) -> list[str]:
        """Parse a concern string into a list of canonical concern keys."""
        if not raw:
            return []
        normalized = raw.lower()
        normalized = normalized.replace("stomach and intestines", "stomach & intestines")
        normalized = normalized.replace("hair and nails", "hair & nails")
        normalized = normalized.replace("hair nails", "hair & nails")
        normalized = re.sub(r"\s+/+\s*", ",", normalized)
        normalized = normalized.replace(";", ",")
        normalized = normalized.replace("|", ",")
        normalized = re.sub(r"\s+and\s+", ",", normalized)
        parts = [part.strip() for part in normalized.split(",") if part.strip()]

        selections: list[str] = []
        for part in parts:
            if part in self.CONCERN_SYNONYMS:
                canonical = self.CONCERN_SYNONYMS[part]
                if canonical not in selections:
                    selections.append(canonical)
                continue
            # Fallback: match known synonyms inside the part
            matches = self._extract_concern_tokens(part)
            for token in matches:
                if token not in selections:
                    selections.append(token)

        if not selections:
            selections = self._extract_concern_tokens(normalized)
        return selections

    def _extract_concern_tokens(self, text: str) -> list[str]:
        """Find concern tokens inside text in order of appearance."""
        if not text:
            return []
        pattern = r"\b(" + "|".join(
            re.escape(key) for key in sorted(self.CONCERN_SYNONYMS.keys(), key=lambda k: len(k), reverse=True)
        ) + r")\b"
        matches = []
        for match in re.finditer(pattern, text):
            key = match.group(1)
            canonical = self.CONCERN_SYNONYMS.get(key)
            if canonical and canonical not in matches:
                matches.append(canonical)
        return matches

    def _normalize_concerns(self, raw_value) -> list[str]:
        if isinstance(raw_value, list):
            normalized = []
            for item in raw_value:
                normalized.extend(self._parse_concerns(str(item)))
            # Preserve order but dedupe
            seen = set()
            ordered = []
            for item in normalized:
                if item not in seen:
                    seen.add(item)
                    ordered.append(item)
            return ordered
        if isinstance(raw_value, str):
            return self._parse_concerns(raw_value)
        return []

    def _concern_followup_steps(self, concerns: list[str]) -> list[str]:
        steps: list[str] = []
        for concern in concerns:
            question_set = self.CONCERN_QUESTIONS.get(concern, {})
            for question in question_set.get("questions", []):
                steps.append(self._concern_field_key(concern, question["id"]))
        return steps

    @staticmethod
    def _concern_field_key(concern: str, question_id: str) -> str:
        return f"concern|{concern}|{question_id}"

    @staticmethod
    def _parse_concern_field(field: str) -> tuple[str, str] | None:
        if not field.startswith("concern|"):
            return None
        parts = field.split("|", 2)
        if len(parts) != 3:
            return None
        _, concern_key, question_id = parts
        return concern_key, question_id

    def _concern_prompt(self, concern_key: str, question_id: str, responses: dict | None = None) -> str:
        label = self.CONCERN_QUESTIONS.get(concern_key, {}).get("label", concern_key.title())
        question = self._question_by_key(concern_key, question_id, responses)
        if not question:
            return f"A quick one about {label}: can you share a short answer?"
        return f"On {label}: {question}"

    def _question_by_key(self, concern_key: str, question_id: str, responses: dict | None = None) -> str | None:
        question_set = self.CONCERN_QUESTIONS.get(concern_key, {})
        for question in question_set.get("questions", []):
            if question["id"] == question_id:
                prompt = question["prompt"]
                
                # Personalize for family members
                if responses:
                    labels = self._person_labels(responses)
                    is_family = labels.get("is_family", False)
                    relation = responses.get("relation", "")
                    family_name = responses.get("family_name", "")
                    
                    if is_family:
                        # Build the reference phrase (e.g., "your son", "your daughter", or family name)
                        if family_name:
                            reference = family_name
                            possessive_ref = f"{family_name}'s"
                            pronoun = "they"  # Use "they" for name
                        elif relation:
                            reference = f"your {relation}"
                            possessive_ref = f"your {relation}'s"
                            # Determine pronoun based on relation
                            relation_lower = relation.lower()
                            if relation_lower in ["son", "brother", "father", "dad", "husband", "boyfriend"]:
                                pronoun = "he"
                            elif relation_lower in ["daughter", "sister", "mother", "mom", "wife", "girlfriend"]:
                                pronoun = "she"
                            else:
                                pronoun = "they"
                        else:
                            reference = "your family member"
                            possessive_ref = "your family member's"
                            pronoun = "they"
                        
                        # Replace "you" with the reference (handling different cases)
                        import re
                        
                        # Pattern 1: "Do you" → "Does {reference}" (handles start and middle of sentence)
                        prompt = re.sub(r'\bDo you\b', f'Does {reference}', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\bdo you\b', f'does {reference}', prompt, flags=re.IGNORECASE)
                        
                        # Pattern 2: "When you" → "When {reference}"
                        prompt = re.sub(r'\bWhen you\b', f'When {reference}', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\bwhen you\b', f'when {reference}', prompt, flags=re.IGNORECASE)
                        
                        # Pattern 3: "How would you" → "How would {reference}"
                        prompt = re.sub(r'\bHow would you\b', f'How would {reference}', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\bhow would you\b', f'how would {reference}', prompt, flags=re.IGNORECASE)
                        
                        # Pattern 4: "Are you" → "Is {reference}"
                        prompt = re.sub(r'\bAre you\b', f'Is {reference}', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\bare you\b', f'is {reference}', prompt, flags=re.IGNORECASE)
                        
                        # Pattern 5: "What would you" → "What would {reference}"
                        prompt = re.sub(r'\bWhat would you\b', f'What would {reference}', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\bwhat would you\b', f'what would {reference}', prompt, flags=re.IGNORECASE)
                        
                        # Pattern 6: "On most nights, how many hours do you sleep" → "On most nights, how many hours does {reference} sleep"
                        prompt = re.sub(r'\bhow many hours do you\b', f'how many hours does {reference}', prompt, flags=re.IGNORECASE)
                        
                        # Pattern 7: Replace "your" with possessive when it refers to the family member's things
                        # Common patterns: "your skin", "your hair", "your bowel", etc.
                        common_attributes = ['skin', 'hair', 'nails', 'bowel', 'energy', 'resistance', 'libido', 
                                            'cycle', 'period', 'mood', 'focus', 'memory', 'days', 'life', 
                                            'periods', 'training', 'exercise', 'stomach', 'digestion']
                        for attr in common_attributes:
                            prompt = re.sub(rf'\byour {attr}\b', f'{possessive_ref} {attr}', prompt, flags=re.IGNORECASE)
                        
                        # Pattern 8: Fix verb agreement
                        # "When {reference} wake" → "When {reference} wakes"
                        prompt = re.sub(rf'\bWhen {re.escape(reference)} wake\b', f'When {reference} wakes', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(rf'\bwhen {re.escape(reference)} wake\b', f'when {reference} wakes', prompt, flags=re.IGNORECASE)
                        
                        # Pattern 9: Replace remaining "you" with pronoun or reference
                        prompt = re.sub(r'\byou feel\b', f'{pronoun} feel', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\byou usually\b', f'{reference} usually', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\byou notice\b', f'{reference} notice', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\byou experience\b', f'{reference} experience', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\byou sleep\b', f'{reference} sleeps', prompt, flags=re.IGNORECASE)
                        prompt = re.sub(r'\byou want\b', f'{reference} wants', prompt, flags=re.IGNORECASE)
                
                # Make weight challenge question gender-aware
                if concern_key == "weight" and question_id == "challenge":
                    gender = (responses or {}).get("gender", "").lower() if responses else ""
                    # Only include pregnancy option for women
                    if gender in ["woman", "female"]:
                        # Add pregnancy option for women (before "or none")
                        if "pregnancy" not in prompt.lower():
                            prompt = prompt.replace(", or none", ", pregnancy, or none")
                    else:
                        # Remove pregnancy option for men/non-women (in case it was added)
                        prompt = prompt.replace(", pregnancy", "").replace("pregnancy, ", "")
                
                return prompt
        return None

    def _save_response(self, field: str, normalized, responses: dict) -> None:
        if field == "concern":
            responses[field] = self._normalize_concerns(normalized)
            return
        parsed_concern = self._parse_concern_field(field)
        if parsed_concern:
            concern_key, question_id = parsed_concern
            details = responses.setdefault("concern_details", {})
            concern_bucket = details.setdefault(concern_key, {})
            concern_bucket[question_id] = normalized
            return
        responses[field] = normalized

    async def _format_product_recommendations(
        self, products: list, context: dict, product_documents: dict[str, dict] | None = None,
        previous_concern_resolved: bool | None = None, previous_concerns: list[str] | None = None,
        previous_products: list[str] | None = None
    ) -> str:
        """
        Format product recommendations with clear explanations of why each product is suggested.
        Includes product name, detailed explanation based on user concerns and context, and context-aware safety warnings.
        
        Args:
            products: List of recommended products
            context: User context and responses
            product_documents: Raw product documents from MongoDB
            previous_concern_resolved: Whether previous concerns were resolved (None if not asked)
            previous_concerns: List of previous concerns that were repeated
        """
        if not products:
            return "No products found matching your profile."
        
        # Get user context for explanations
        concerns = self._normalize_concerns(context.get("concern", []))
        concern_details = context.get("concern_details", {})
        medical_treatment = (context.get("medical_treatment") or "").lower() == "yes"
        
        # Build recommendation text
        recommendations = []
        
        # Add medical treatment disclaimer at the start if applicable
        intro_text = ""
        if medical_treatment:
            intro_text = (
                "IMPORTANT: Since you mentioned you're currently undergoing medical treatment, "
                "please consult with your healthcare provider before starting any new supplements. "
                "The following recommendations are based on your profile, but medical guidance is essential.\n\n"
            )
        
        # Add message if Ayurveda products are excluded due to user's views
        ayurveda_view = (context.get("ayurveda_view") or "").lower()
        exclude_ayurveda_views = [
            "more information needed for an opinion",
            "i am skeptical",
            "alternative medicine is nonsense"
        ]
        if ayurveda_view in exclude_ayurveda_views:
            ayurveda_message = (
                "Note: Since you have said you do not prefer Ayurveda, I am not recommending Ayurveda medicine.\n\n"
            )
            intro_text = ayurveda_message + intro_text if intro_text else ayurveda_message
        
        # Add caution if previous_concern_followup was answered (user facing same concern again)
        previous_concern_followup_response = context.get("previous_concern_followup")
        if previous_concern_followup_response:
            # Get major concern label for the warning
            major_concern_label = ""
            if concerns:
                major_concern_key = concerns[0]
                concern_info = self.CONCERN_QUESTIONS.get(major_concern_key, {})
                major_concern_label = concern_info.get("label", major_concern_key.replace("_", " ").title())
            
            caution_message = (
                f"\n\n⚠️ IMPORTANT: Since you are facing the same concern ({major_concern_label.lower()}) again, "
                f"please consult with a healthcare provider or doctor before starting any new supplements. "
                f"While I'm recommending products below, persistent or recurring health concerns may require professional medical evaluation. "
                f"Your health and wellbeing are important - please seek medical advice to ensure the best care.\n\n"
            )
            intro_text = caution_message + intro_text if intro_text else caution_message
        
        # Add strong doctor recommendation if previous concerns were not resolved
        if previous_concern_resolved is False and previous_concerns:
            concerns_text = ", ".join([c.replace("_", " ").title() for c in previous_concerns])
            doctor_warning = (
                f"\n\n⚠️ STRONG MEDICAL ADVISORY: Since you mentioned that having taken the previous recommended products, "
                f"your concerns about {concerns_text} have not been resolved, I STRONGLY recommend that you visit a healthcare provider "
                f"or doctor for a proper medical evaluation. Persistent health issues may require professional medical attention "
                f"beyond what supplements can address. Please consult with a healthcare professional before continuing with any new supplements.\n\n"
            )
            intro_text = doctor_warning + intro_text if intro_text else doctor_warning
        
        # Add brief problem summary (2-3 lines) based on user's concerns and answers
        # Pass actual product count to make summary dynamic
        actual_product_count = len(products)
        problem_summary = self._build_problem_summary(concerns, concern_details, context, actual_product_count)
        if problem_summary:
            intro_text += problem_summary + "\n\n"
        
        previous_products_set = set((previous_products or []))
        
        # Use all products (up to 3 max) - don't force exactly 3
        for product in products[:3]:  # Max 3, but can be fewer
            product_name = product.title
            is_previous_product = product_name in previous_products_set
            
            # Build detailed explanation based on user context
            # Pass None for product_json since MongoDB products don't have the same structure
            explanation = self._build_product_explanation(product, None, concerns, concern_details, context)
            
            # Get the full MongoDB product document for safety analysis
            product_doc = {}
            if product_documents and product_name in product_documents:
                product_doc = product_documents[product_name]
            else:
                # Fallback: try to fetch if not provided
                product_doc = await self._get_product_document_by_title(product_name)
            
            # Get context-aware safety warnings with auto-detection
            warnings = self.product_service.get_safety_warnings(product_doc, context)
            
            # Format product recommendation
            product_text = f"{product_name}\n{explanation}"
            
            # Add warnings if any
            if warnings:
                product_text += "\n" + "\n".join([f"Note: {w}" for w in warnings])
            
            # Add caution note if this is a previously recommended product that didn't resolve the issue
            if is_previous_product and previous_concern_resolved is False:
                product_text += "\n⚠️ CAUTION: This product was previously recommended but the issue persists. Please consult with a healthcare provider before continuing."
            
            # Add extra medical disclaimer for each product if user is under medical treatment
            if medical_treatment:
                product_text += "\n⚠️ Medical Advisory: Please consult with your healthcare provider before starting this supplement."
            
            recommendations.append(product_text)
        
        # Join all recommendations with intro text
        return intro_text + "\n\n".join(recommendations)
    
    def _build_product_explanation(
        self, product, product_json: dict | None, concerns: list[str], 
        concern_details: dict, context: dict
    ) -> str:
        """Build a detailed explanation of why this product is recommended."""
        explanation_parts = []
        explanation_parts = []
        # Get product information from Product object (MongoDB)
        product_text = self._get_product_text_for_explanation(product, product_json)
        key_benefits = product.benefits or []
        
        # Extract ingredient name from product title
        # For MongoDB products, the title typically contains the main ingredient
        ingredient_name = product.title
        # Try to extract first part of title (before any "+" or "Complex" etc.)
        if " + " in ingredient_name:
            ingredient_name = ingredient_name.split(" + ")[0]
        elif " Complex" in ingredient_name:
            ingredient_name = ingredient_name.replace(" Complex", "")
        
        # Build explanation based on user's concerns and what they mentioned
        user_concerns_text = []
        relevant_benefits = []
        
        for concern in concerns:
            concern_label = self.CONCERN_QUESTIONS.get(concern, {}).get("label", concern.replace("_", " ").title())
            concern_keywords = self.product_service.CONCERN_TO_KEYWORDS.get(concern, [])
            
            # Check if product addresses this concern
            if any(keyword in product_text.lower() for keyword in concern_keywords):
                user_concerns_text.append(concern_label.lower())
                
                # Find specific benefits that match this concern
                for benefit in key_benefits:
                    benefit_lower = benefit.lower()
                    if any(keyword in benefit_lower for keyword in concern_keywords):
                        if benefit not in relevant_benefits:
                            relevant_benefits.append(benefit)
        
        # Build the explanation sentence with better grammar and varied phrasing
        if user_concerns_text and relevant_benefits:
            # Format concerns properly (e.g., "brain" -> "brain concerns", "sleep" -> "sleep issues")
            concerns_phrases = []
            for concern in user_concerns_text:
                if concern in ["brain", "sleep", "stress", "energy", "weight", "skin"]:
                    concerns_phrases.append(f"{concern} concerns")
                elif concern in ["stomach & intestines", "stomach_intestines"]:
                    concerns_phrases.append("digestive concerns")
                elif concern == "hair & nails" or concern == "hair_nails":
                    concerns_phrases.append("hair and nail concerns")
                else:
                    concerns_phrases.append(concern)
            
            concerns_phrase = ", ".join(concerns_phrases)
            # Get 1-2 most relevant benefits, but vary the phrasing
            top_benefits = relevant_benefits[:2]
            if len(top_benefits) == 2:
                benefits_phrase = f"{top_benefits[0].lower().rstrip('.')} and {top_benefits[1].lower().rstrip('.')}"
            else:
                benefits_phrase = top_benefits[0].lower().rstrip(".")
            
            # Vary the explanation phrasing to avoid repetition
            # Fix grammar: ensure benefits_phrase works with "can" (use base form) or use "which/that" instead
            # Convert benefits to base form if it starts with a verb (e.g., "promotes" -> "promote")
            benefits_base = benefits_phrase
            if benefits_phrase.split()[0].endswith('s') and len(benefits_phrase.split()[0]) > 3:
                # Likely a third-person verb, convert to base form for "can"
                first_word = benefits_phrase.split()[0]
                if first_word.endswith('s') and not first_word.endswith('ss'):
                    benefits_base = benefits_phrase.replace(first_word, first_word[:-1], 1)
            
            explanation_variants = [
                f"This product may help address your {concerns_phrase} through {ingredient_name}, which {benefits_phrase}.",
                f"Based on your {concerns_phrase}, {ingredient_name} in this product can {benefits_base}.",
                f"For your {concerns_phrase}, this product offers {ingredient_name} that {benefits_phrase}."
            ]
            # Use a simple hash of product name to pick variant (consistent per product)
            variant_idx = hash(product.title) % len(explanation_variants)
            explanation = explanation_variants[variant_idx]
        elif user_concerns_text:
            # Format concerns properly
            concerns_phrases = []
            for concern in user_concerns_text:
                if concern in ["brain", "sleep", "stress", "energy", "weight", "skin"]:
                    concerns_phrases.append(f"{concern} concerns")
                elif concern in ["stomach & intestines", "stomach_intestines"]:
                    concerns_phrases.append("digestive concerns")
                elif concern == "hair & nails" or concern == "hair_nails":
                    concerns_phrases.append("hair and nail concerns")
                else:
                    concerns_phrases.append(concern)
            
            concerns_phrase = ", ".join(concerns_phrases)
            # Fallback to general benefits
            if key_benefits:
                top_benefit = key_benefits[0].lower().rstrip(".")
                explanation_variants = [
                    f"This product may support your {concerns_phrase} with {ingredient_name} that {top_benefit}.",
                    f"For your {concerns_phrase}, this product contains {ingredient_name} which {top_benefit}.",
                    f"Addressing your {concerns_phrase}, this product includes {ingredient_name} that {top_benefit}."
                ]
                variant_idx = hash(product.title) % len(explanation_variants)
                explanation = explanation_variants[variant_idx]
            else:
                explanation = (
                    f"This product may be beneficial for your {concerns_phrase} as it contains {ingredient_name} "
                    f"that supports these areas."
                )
        elif key_benefits:
            # No specific concerns matched, but we have benefits
            top_benefit = key_benefits[0].lower().rstrip(".")
            explanation = (
                f"This product contains {ingredient_name} that {top_benefit}, "
                f"which may be relevant for your wellness goals."
            )
        else:
            # Fallback
            explanation = (
                f"This product contains {ingredient_name} that may be beneficial "
                f"based on your profile and health goals."
            )
        
        return explanation
    
    def _get_product_text_for_explanation(self, product, product_json: dict | None) -> str:
        """Get searchable text from product for explanation matching."""
        text_parts = []
        
        if product.description:
            text_parts.append(product.description)
        
        if product.benefits:
            text_parts.extend(product.benefits)
        
        if product.health_goals:
            text_parts.extend(product.health_goals)
        
        if product_json:
            # Handle multilingual fields from MongoDB
            if product_json.get("description"):
                desc = product_json["description"]
                if isinstance(desc, dict):
                    text_parts.append(desc.get("en", desc.get(list(desc.keys())[0] if desc else "", "")))
                elif isinstance(desc, str):
                    text_parts.append(desc)
            if product_json.get("benefits"):
                text_parts.extend(product_json["benefits"])
            if product_json.get("ingredients"):
                text_parts.extend(product_json["ingredients"])
        
        return " ".join(text_parts)
    
    def _build_problem_summary(self, concerns: list[str], concern_details: dict, context: dict, product_count: int = 3) -> str:
        """
        Build a brief 2-3 line summary of the problems the quiz bot noticed based on user's answers.
        
        Args:
            concerns: List of normalized concern keys (e.g., ["brain", "sleep"])
            concern_details: Dictionary of concern details with follow-up answers
            context: Full user context including all responses
            product_count: Actual number of products being recommended (1-3)
        
        Returns:
            A 2-3 line summary string, or empty string if no concerns
        """
        if not concerns:
            return ""
        
        # Get concern labels
        concern_labels = []
        for concern in concerns:
            label = self.CONCERN_QUESTIONS.get(concern, {}).get("label", concern.replace("_", " ").title())
            concern_labels.append(label)
        
        # Build summary based on concerns and key details
        summary_parts = []
        
        # Primary concern statement
        if len(concern_labels) == 1:
            primary_concern = concern_labels[0]
            summary_parts.append(f"Based on your responses, I've noticed you're experiencing {primary_concern.lower()} concerns.")
        else:
            concerns_text = ", ".join(concern_labels[:-1]) + f" and {concern_labels[-1]}"
            summary_parts.append(f"Based on your responses, I've identified concerns related to {concerns_text.lower()}.")
        
        # Add specific details if available
        specific_details = []
        
        # Check for specific concern details that provide context
        for concern in concerns:
            concern_data = concern_details.get(concern, {})
            if concern == "brain" and concern_data.get("symptoms"):
                symptoms = concern_data.get("symptoms", "").lower()
                if "difficulty focusing" in symptoms or "focus" in symptoms:
                    specific_details.append("difficulty with focus and concentration")
                elif "forgetfulness" in symptoms or "memory" in symptoms:
                    specific_details.append("memory-related challenges")
                elif "trouble finding words" in symptoms:
                    specific_details.append("cognitive challenges")
            elif concern == "sleep" and concern_data.get("fall_asleep"):
                if "yes" in concern_data.get("fall_asleep", "").lower() or "hard" in concern_data.get("fall_asleep", "").lower():
                    specific_details.append("trouble falling asleep")
            elif concern == "stress" and concern_data.get("busy_level"):
                busy = concern_data.get("busy_level", "").lower()
                if "a lot" in busy or "very" in busy:
                    specific_details.append("high levels of daily stress")
            elif concern == "energy" and concern_data.get("end_day"):
                if "gone" in concern_data.get("end_day", "").lower() or "tired" in concern_data.get("end_day", "").lower():
                    specific_details.append("low energy levels by end of day")
        
        # Build second line with specific details or general statement
        if specific_details:
            details_text = ", ".join(specific_details[:2])  # Max 2 details
            summary_parts.append(f"Specifically, you mentioned {details_text}.")
        else:
            # Generic supportive statement
            summary_parts.append("These are common concerns that can often be supported with targeted nutritional supplements.")
        
        # Third line - transition to recommendations (dynamic based on actual product count)
        if product_count == 1:
            summary_parts.append("Here is a product that may help address these areas:")
        elif product_count == 2:
            summary_parts.append("Here are two products that may help address these areas:")
        else:
            summary_parts.append("Here are three products that may help address these areas:")
        
        return "\n".join(summary_parts)
    
    async def _get_product_document_by_title(self, product_title: str) -> dict:
        """Get full MongoDB product document by title for safety analysis."""
        try:
            # Search for the product in MongoDB
            products = await self.product_service.repository.search(
                message_terms=[product_title.split()[0]] if product_title else [],  # Use first word of title
                health_goals=[],
                limit=10
            )
            
            # Find exact match by title
            for product in products:
                title_obj = product.get("title", {})
                if isinstance(title_obj, dict):
                    title = title_obj.get("en", title_obj.get(list(title_obj.keys())[0] if title_obj else "", ""))
                elif isinstance(title_obj, str):
                    title = title_obj
                else:
                    title = ""
                
                if title.lower() == product_title.lower():
                    return product
            
            # If no exact match, return first product or empty dict
            return products[0] if products else {}
        except Exception:
            return {}
    
    def _get_question_options(self, field: str) -> tuple[list[QuestionOption] | None, str | None]:
        """
        Extract available options for a question field.
        Returns tuple of (options_list, question_type).
        """
        # Yes/No questions
        yes_no_fields = {
            "protein", "conceive", "children", "drinks_alcohol", "alcohol_daily",
            "alcohol_weekly", "coffee_intake", "smokes", "sunlight_exposure",
            "iron_advised", "medical_treatment", "previous_concern_followup"
        }
        
        if field in yes_no_fields:
            return [
                QuestionOption(value="yes", label="Yes"),
                QuestionOption(value="no", label="No"),
            ], "yes_no"
        
        # Option-based questions
        if field == "for_whom":
            return [
                QuestionOption(value="me", label="Me"),
                QuestionOption(value="family", label="Family"),
            ], "options"
        
        if field == "gender":
            return [
                QuestionOption(value="male", label="Male"),
                QuestionOption(value="woman", label="Woman"),
                QuestionOption(value="gender neutral", label="Gender Neutral"),
            ], "options"
        
        if field == "knowledge":
            return [
                QuestionOption(value="well informed", label="Well informed"),
                QuestionOption(value="curious", label="Curious"),
                QuestionOption(value="skeptical", label="Skeptical"),
            ], "options"
        
        if field == "vitamin_count":
            return [
                QuestionOption(value="no", label="No"),
                QuestionOption(value="1 to 3", label="1 to 3"),
                QuestionOption(value="4+", label="4+"),
            ], "options"
        
        if field == "situation":
            return [
                QuestionOption(value="to get pregnant in the next 2 years", label="To get pregnant in the next 2 years"),
                QuestionOption(value="i am pregnant now", label="I am pregnant now"),
                QuestionOption(value="breastfeeding", label="Breastfeeding"),
            ], "options"
        
        if field == "concern":
            return [
                QuestionOption(value="sleep", label="Sleep"),
                QuestionOption(value="stress", label="Stress"),
                QuestionOption(value="energy", label="Energy"),
                QuestionOption(value="stomach_intestines", label="Stomach & Intestines"),
                QuestionOption(value="skin", label="Skin"),
                QuestionOption(value="resistance", label="Resistance"),
                QuestionOption(value="weight", label="Weight"),
                QuestionOption(value="hormones", label="Hormones"),
                QuestionOption(value="libido", label="Libido"),
                QuestionOption(value="brain", label="Brain"),
                QuestionOption(value="hair_nails", label="Hair & Nails"),
                QuestionOption(value="fitness", label="Fitness"),
            ], "options"
        
        if field == "lifestyle_status":
            return [
                QuestionOption(value="been doing well for a long time", label="Been doing well for a long time"),
                QuestionOption(value="nice on the way", label="Nice on the way"),
                QuestionOption(value="ready to start", label="Ready to start"),
            ], "options"
        
        if field in {"fruit_intake", "vegetable_intake", "dairy_intake", "fiber_intake", "protein_intake"}:
            return [
                QuestionOption(value="hardly", label="Hardly"),
                QuestionOption(value="one time", label="One time"),
                QuestionOption(value="twice or more", label="Twice or more"),
            ], "options"
        
        if field == "eating_habits":
            return [
                QuestionOption(value="no preference", label="No preference"),
                QuestionOption(value="flexitarian", label="Flexitarian"),
                QuestionOption(value="vegetarian", label="Vegetarian"),
                QuestionOption(value="vegan", label="Vegan"),
            ], "options"
        
        if field in {"meat_intake", "fish_intake"}:
            return [
                QuestionOption(value="never", label="Never"),
                QuestionOption(value="once or twice", label="Once or twice"),
                QuestionOption(value="three times or more", label="Three times or more"),
            ], "options"
        
        if field == "allergies":
            return [
                QuestionOption(value="no", label="No"),
                QuestionOption(value="milk", label="Milk"),
                QuestionOption(value="egg", label="Egg"),
                QuestionOption(value="fish", label="Fish"),
                QuestionOption(value="shellfish and crustaceans", label="Shellfish and crustaceans"),
                QuestionOption(value="peanut", label="Peanut"),
                QuestionOption(value="nuts", label="Nuts"),
                QuestionOption(value="soy", label="Soy"),
                QuestionOption(value="gluten", label="Gluten"),
                QuestionOption(value="wheat", label="Wheat"),
                QuestionOption(value="pollen", label="Pollen"),
            ], "options"
        
        if field == "dietary_preferences":
            return [
                QuestionOption(value="no preference", label="No preference"),
                QuestionOption(value="lactose-free", label="Lactose-free"),
                QuestionOption(value="gluten free", label="Gluten free"),
                QuestionOption(value="paleo", label="Paleo"),
            ], "options"
        
        if field == "ayurveda_view":
            return [
                QuestionOption(value="i am convinced", label="I am convinced"),
                QuestionOption(value="we can learn a lot from ancient medicine", label="We can learn a lot from ancient medicine"),
                QuestionOption(value="i am open to it", label="I am open to it"),
                QuestionOption(value="more information needed for an opinion", label="More information needed for an opinion"),
                QuestionOption(value="i am skeptical", label="I am skeptical"),
                QuestionOption(value="alternative medicine is nonsense", label="Alternative medicine is nonsense"),
            ], "options"
        
        if field == "new_product_attitude":
            return [
                QuestionOption(value="to be the first", label="To be the first"),
                QuestionOption(value="you are at the forefront of new products", label="You are at the forefront of new products"),
                QuestionOption(value="learn more", label="Learn more"),
                QuestionOption(value="you are cautiously optimistic", label="You are cautiously optimistic"),
                QuestionOption(value="waiting for now", label="Waiting for now"),
                QuestionOption(value="scientific research takes time", label="Scientific research takes time"),
            ], "options"
        
        # Concern follow-up questions with options
        if field.startswith("concern|"):
            concern_detail = self._parse_concern_field(field)
            if concern_detail:
                concern_key, question_id = concern_detail
                
                # Sleep concern questions
                if concern_key == "sleep":
                    if question_id == "fall_asleep":
                        return [
                            QuestionOption(value="yes", label="Yes"),
                            QuestionOption(value="no", label="No"),
                        ], "yes_no"
                    if question_id == "refreshed":
                        return [
                            QuestionOption(value="refreshed", label="Refreshed"),
                            QuestionOption(value="still tired", label="Still tired"),
                        ], "options"
                    if question_id == "hours":
                        return [
                            QuestionOption(value="7+ hours", label="7+ hours"),
                            QuestionOption(value="less than 7", label="Less than 7"),
                            QuestionOption(value="less than 5", label="Less than 5"),
                        ], "options"
                
                # Stress concern questions
                if concern_key == "stress":
                    if question_id == "busy_level":
                        return [
                            QuestionOption(value="few things", label="Few things"),
                            QuestionOption(value="normal", label="Normal"),
                            QuestionOption(value="a lot", label="A lot"),
                        ], "options"
                    if question_id == "after_day":
                        return [
                            QuestionOption(value="energized", label="Energized"),
                            QuestionOption(value="completely drained", label="Completely drained"),
                        ], "options"
                    if question_id == "signals":
                        return [
                            QuestionOption(value="faster breathing", label="Faster breathing"),
                            QuestionOption(value="tense muscles", label="Tense muscles"),
                            QuestionOption(value="trouble sleeping", label="Trouble sleeping"),
                            QuestionOption(value="sensitive stomach", label="Sensitive stomach"),
                            QuestionOption(value="head pressure", label="Head pressure"),
                            QuestionOption(value="fast heartbeat", label="Fast heartbeat"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                
                # Energy concern questions
                if concern_key == "energy":
                    if question_id == "day_load":
                        return [
                            QuestionOption(value="very full", label="Very full"),
                            QuestionOption(value="moderate", label="Moderate"),
                            QuestionOption(value="not very full", label="Not very full"),
                        ], "options"
                    if question_id == "end_day":
                        return [
                            QuestionOption(value="still there", label="Still there"),
                            QuestionOption(value="totally gone", label="Totally gone"),
                        ], "options"
                    if question_id == "body_signals":
                        return [
                            QuestionOption(value="tired", label="Tired"),
                            QuestionOption(value="sleepy", label="Sleepy"),
                            QuestionOption(value="low energy", label="Low energy"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                
                # Stomach & Intestines concern questions
                if concern_key == "stomach_intestines":
                    if question_id == "bowel":
                        return [
                            QuestionOption(value="less than once", label="Less than once"),
                            QuestionOption(value="about once", label="About once"),
                            QuestionOption(value="more than once", label="More than once"),
                            QuestionOption(value="irregular", label="Irregular"),
                        ], "options"
                    if question_id == "improve":
                        return [
                            QuestionOption(value="gas & bloating", label="Gas & bloating"),
                            QuestionOption(value="that 'balloon' feeling", label="That 'balloon' feeling"),
                            QuestionOption(value="letting go easily", label="Letting go easily"),
                            QuestionOption(value="overall digestion", label="Overall digestion"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                
                # Skin concern questions
                if concern_key == "skin":
                    if question_id == "most_days":
                        return [
                            QuestionOption(value="pulling", label="Pulling"),
                            QuestionOption(value="shiny", label="Shiny"),
                            QuestionOption(value="sensitive", label="Sensitive"),
                            QuestionOption(value="dull", label="Dull"),
                            QuestionOption(value="pretty good", label="Pretty good"),
                        ], "options"
                    if question_id == "notices":
                        return [
                            QuestionOption(value="pimples", label="Pimples"),
                            QuestionOption(value="discoloration", label="Discoloration"),
                            QuestionOption(value="lines", label="Lines"),
                            QuestionOption(value="less elasticity", label="Less elasticity"),
                            QuestionOption(value="aging", label="Aging"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                    if question_id == "dry":
                        return [
                            QuestionOption(value="yes", label="Yes"),
                            QuestionOption(value="no", label="No"),
                        ], "yes_no"
                
                # Resistance concern questions
                if concern_key == "resistance":
                    if question_id in ["low", "intense_training", "medical_care"]:
                        return [
                            QuestionOption(value="yes", label="Yes"),
                            QuestionOption(value="no", label="No"),
                        ], "yes_no"
                
                # Weight concern questions
                if concern_key == "weight":
                    if question_id == "challenge":
                        return [
                            QuestionOption(value="movement", label="Movement"),
                            QuestionOption(value="exercise", label="Exercise"),
                            QuestionOption(value="nutrition", label="Nutrition"),
                            QuestionOption(value="discipline", label="Discipline"),
                            QuestionOption(value="knowledge", label="Knowledge"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                    if question_id in ["binge", "sleep_hours"]:
                        return [
                            QuestionOption(value="yes", label="Yes"),
                            QuestionOption(value="no", label="No"),
                        ], "yes_no"
                
                # Hormones concern questions
                if concern_key == "hormones":
                    if question_id == "cycle":
                        return [
                            QuestionOption(value="regular", label="Regular"),
                            QuestionOption(value="irregular", label="Irregular"),
                            QuestionOption(value="very irregular", label="Very irregular"),
                        ], "options"
                    if question_id == "physical_changes":
                        return [
                            QuestionOption(value="yes", label="Yes"),
                            QuestionOption(value="no", label="No"),
                        ], "yes_no"
                    if question_id == "emotions":
                        return [
                            QuestionOption(value="moody", label="Moody"),
                            QuestionOption(value="irritable", label="Irritable"),
                            QuestionOption(value="sad", label="Sad"),
                            QuestionOption(value="anxious", label="Anxious"),
                            QuestionOption(value="fine", label="Fine"),
                        ], "options"
                
                # Libido concern questions
                if concern_key == "libido":
                    if question_id == "level":
                        return [
                            QuestionOption(value="low", label="Low"),
                            QuestionOption(value="average", label="Average"),
                            QuestionOption(value="high", label="High"),
                        ], "options"
                    if question_id == "sleep_quality":
                        return [
                            QuestionOption(value="excellent", label="Excellent"),
                            QuestionOption(value="good", label="Good"),
                            QuestionOption(value="fair", label="Fair"),
                            QuestionOption(value="poor", label="Poor"),
                        ], "options"
                    if question_id == "pressure":
                        return [
                            QuestionOption(value="a lot", label="A lot"),
                            QuestionOption(value="some", label="Some"),
                            QuestionOption(value="little", label="Little"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                
                # Brain concern questions
                if concern_key == "brain":
                    if question_id == "symptoms":
                        return [
                            QuestionOption(value="difficulty focusing", label="Difficulty focusing"),
                            QuestionOption(value="forgetfulness", label="Forgetfulness"),
                            QuestionOption(value="trouble finding words", label="Trouble finding words"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                    if question_id == "mood":
                        return [
                            QuestionOption(value="yes", label="Yes"),
                            QuestionOption(value="no", label="No"),
                        ], "yes_no"
                    if question_id == "improve":
                        return [
                            QuestionOption(value="focus", label="Focus"),
                            QuestionOption(value="memory", label="Memory"),
                            QuestionOption(value="mental fitness", label="Mental fitness"),
                            QuestionOption(value="staying sharp", label="Staying sharp"),
                        ], "options"
                
                # Hair & Nails concern questions
                if concern_key == "hair_nails":
                    if question_id == "hair":
                        return [
                            QuestionOption(value="dry", label="Dry"),
                            QuestionOption(value="thin", label="Thin"),
                            QuestionOption(value="split ends", label="Split ends"),
                            QuestionOption(value="won't grow long", label="Won't grow long"),
                            QuestionOption(value="could be fuller", label="Could be fuller"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                    if question_id == "nails":
                        return [
                            QuestionOption(value="strength", label="Strength"),
                            QuestionOption(value="length", label="Length"),
                            QuestionOption(value="condition", label="Condition"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                
                # Fitness concern questions
                if concern_key == "fitness":
                    if question_id == "frequency":
                        return [
                            QuestionOption(value="daily", label="Daily"),
                            QuestionOption(value="3-5 times a week", label="3-5 times a week"),
                            QuestionOption(value="1-2 times a week", label="1-2 times a week"),
                            QuestionOption(value="rarely", label="Rarely"),
                            QuestionOption(value="never", label="Never"),
                        ], "options"
                    if question_id == "training":
                        return [
                            QuestionOption(value="strength", label="Strength"),
                            QuestionOption(value="cardio", label="Cardio"),
                            QuestionOption(value="hiit", label="HIIT"),
                            QuestionOption(value="flexibility", label="Flexibility"),
                            QuestionOption(value="none", label="None"),
                        ], "options"
                    if question_id == "priority":
                        return [
                            QuestionOption(value="performance", label="Performance"),
                            QuestionOption(value="sweating", label="Sweating"),
                            QuestionOption(value="muscle", label="Muscle"),
                            QuestionOption(value="health", label="Health"),
                        ], "options"
        
        # Text input questions (name, email, age, etc.)
        text_fields = {"name", "family_name", "relation", "age", "email"}
        if field in text_fields:
            return None, "text"
        
        # Default: no options (free text)
        return None, "text"
    
    async def generate_session_name(self, concern: str, session_id: str | None = None, user_id: str | None = None) -> str:
        """
        Generate a creative session name based on the user's concern using OpenAI.
        Returns a unique, creative name like "Stress concerns supplements" or similar.
        
        Args:
            concern: The user's health concern
            session_id: Optional session ID to store token usage
            user_id: Optional user ID to store token usage
        """
        try:
            system_prompt = (
                "You are a helpful assistant that creates creative, concise session names for wellness conversations. "
                "Generate a short, descriptive session name (2-5 words) based on the user's health concern. "
                "Make it natural and conversational, like ChatGPT session names. "
                "Examples: 'Stress relief supplements', 'Sleep support journey', 'Energy boost plan', 'Gut health solutions'. "
                "Return ONLY the session name, nothing else. Keep it under 40 characters."
            )
            
            user_message = f"Create a creative session name for a user with this concern: {concern}"
            
            reply_text, usage_info = await self.ai_service.generate_reply(
                system_prompt=system_prompt,
                history=[],
                user_message=user_message,
                context=None,
                products=None,
            )
            
            # Store token usage if session_id is provided
            if session_id and usage_info and usage_info.get("input_tokens", 0) > 0:
                try:
                    await self._update_session_token_usage(session_id, usage_info, user_id)
                except Exception as e:
                    import logging
                    logging.warning(f"Failed to store token usage for session name generation: {e}")
            
            # Clean up the response - remove quotes, extra whitespace, etc.
            session_name = reply_text.strip().strip('"').strip("'").strip()
            
            # Fallback if OpenAI returns something too long or empty
            if not session_name or len(session_name) > 50:
                # Use a simple fallback format
                concern_label = concern.replace("_", " ").title()
                session_name = f"{concern_label} Support"
            
            return session_name
        except Exception as e:
            # Fallback to simple format if OpenAI fails
            import logging
            logging.warning(f"Failed to generate session name with OpenAI: {e}")
            concern_label = concern.replace("_", " ").title()
            return f"{concern_label} Support"
    
    async def get_first_question(self, session_id: str) -> ChatResponse:
        """
        Get the first question from the bot without requiring a user message.
        Initializes the onboarding flow and returns the first question.
        
        This is useful when you want to display the first question immediately
        after creating a session, without sending a trigger message.
        """
        # Try without user_id first (legacy), then with user_id if found
        session = await self.session_repo.get(session_id)
        if not session:
            raise SessionNotFoundError(f"Session {session_id} not found.")
        
        # If session found but no messages, try with user_id from metadata
        user_id = self._get_user_id_from_session(session)
        if user_id and not session.messages:
            # Retry with user_id
            session = await self.session_repo.get(session_id, user_id=user_id)
            if not session:
                raise SessionNotFoundError(f"Session {session_id} not found.")
        
        onboarding_state = self._get_onboarding_state(session)
        
        # Check if onboarding is already complete
        if onboarding_state.get("complete"):
            # Return a message indicating onboarding is complete
            return ChatResponse(
                session_id=session_id,
                reply=ChatMessage(
                    role="assistant",
                    content="You have already completed the onboarding. Your recommendations have been provided."
                ),
                options=None,
                question_type=None,
                isRegistered=self._get_is_registered_from_session(session),
            )
        
        # Check if first question was already asked (session has messages)
        if len(session.messages) > 0:
            # Get the current question instead
            return await self._get_current_question_response(session_id, session, onboarding_state)
        
        # Initialize onboarding and get first question
        has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)
        ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
        
        if not ordered_steps:
            raise ValueError("No onboarding steps available")
        
        first_field = ordered_steps[0]
        first_prompt = self._build_prompt(field=first_field, responses=onboarding_state["responses"])
        
        # Build the first question with friendly greeting
        question_content = self._friendly_question(
            prompt=first_prompt,
            step=0,
            prev_answer=None,
            prev_field=None,
            responses=onboarding_state.get("responses", {}),
        )
        
        # Create the first question reply
        first_reply = ChatMessage(role="assistant", content=question_content)
        
        # Get options for the first question
        options, question_type = self._get_question_options(first_field)
        
        # Update onboarding state (mark as initialized and awaiting answer)
        onboarding_state["step"] = 0
        onboarding_state["awaiting_answer"] = True
        onboarding_state["first_question_shown"] = True  # Mark that first question was shown via GET
        
        # Save the first question to session
        await self.session_repo.append_messages(
            session_id=session.id, messages=[first_reply], user_id=user_id
        )
        await self.session_repo.update_metadata(
            session_id=session.id,
            metadata={**(session.metadata or {}), "onboarding": onboarding_state},
            user_id=user_id,
        )
        
        return ChatResponse(
            session_id=session_id,
            reply=first_reply,
            options=options,
            question_type=question_type,
            isRegistered=self._get_is_registered_from_session(session),
        )
    
    async def _get_current_question_response(self, session_id: str, session: Session, onboarding_state: dict) -> ChatResponse:
        """Helper method to get current question as ChatResponse."""
        has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)
        ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
        
        if onboarding_state["step"] < len(ordered_steps):
            current_field = ordered_steps[onboarding_state["step"]]
            question_text = self._build_prompt(field=current_field, responses=onboarding_state["responses"])
            question_text = self._friendly_question(
                prompt=question_text,
                step=onboarding_state["step"],
                prev_answer=onboarding_state.get("last_answer"),
                prev_field=onboarding_state.get("last_field"),
                responses=onboarding_state.get("responses", {}),
            )
            
            options, question_type = self._get_question_options(current_field)
            
            return ChatResponse(
                session_id=session_id,
                reply=ChatMessage(role="assistant", content=question_text),
                options=options,
                question_type=question_type,
                isRegistered=self._get_is_registered_from_session(session),
            )
        
        # Onboarding complete
        return ChatResponse(
            session_id=session_id,
            reply=ChatMessage(
                role="assistant",
                content="Onboarding is complete. Your recommendations have been provided."
            ),
            options=None,
            question_type=None,
            isRegistered=self._get_is_registered_from_session(session),
        )

    async def get_current_question(self, session_id: str) -> QuestionStateResponse:
        """
        Get the current question state with available options.
        Useful for frontend to display option buttons.
        """
        # Try without user_id first (legacy), then with user_id if found
        session = await self.session_repo.get(session_id)
        if not session:
            raise SessionNotFoundError(f"Session {session_id} not found.")
        
        # If session found but no messages, try with user_id from metadata
        user_id = self._get_user_id_from_session(session)
        if user_id and not session.messages:
            # Retry with user_id
            session = await self.session_repo.get(session_id, user_id=user_id)
            if not session:
                raise SessionNotFoundError(f"Session {session_id} not found.")
        
        onboarding_state = self._get_onboarding_state(session)
        
        # Check if user has previous sessions (for returning users)
        has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)
        
        ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
        
        if onboarding_state["complete"]:
            return QuestionStateResponse(
                session_id=session_id,
                question=None,
                options=None,
                question_type=None,
                is_awaiting_answer=False,
                is_complete=True,
            )
        
        if onboarding_state["step"] < len(ordered_steps):
            current_field = ordered_steps[onboarding_state["step"]]
            question_text = self._build_prompt(field=current_field, responses=onboarding_state["responses"])
            question_text = self._friendly_question(
                prompt=question_text,
                step=onboarding_state["step"],
                prev_answer=onboarding_state.get("last_answer"),
                prev_field=onboarding_state.get("last_field"),
                responses=onboarding_state.get("responses", {}),
            )
            
            options, question_type = self._get_question_options(current_field)
            
            return QuestionStateResponse(
                session_id=session_id,
                question=question_text,
                options=options,
                question_type=question_type,
                is_awaiting_answer=onboarding_state["awaiting_answer"],
                is_complete=False,
            )
        
        # Onboarding complete
        return QuestionStateResponse(
            session_id=session_id,
            question=None,
            options=None,
            question_type=None,
            is_awaiting_answer=False,
            is_complete=True,
        )

# from __future__ import annotations

# import re
# from typing import Any

# import logging

# from app.config.settings import settings
# from app.exceptions.errors import SessionNotFoundError
# from app.repositories.session_repository import SessionRepository
# from app.repositories.quiz_session_repository import QuizSessionRepository
# from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse, QuestionOption, QuestionStateResponse
# from app.schemas.session import Session
# from app.services.product_service import ProductService
# from app.services.openai_service import OpenAIChatService
# from app.utils.error_handler import log_error_with_context

# logger = logging.getLogger(__name__)


# class ChatService:
#     PROMPTS = {
#         "name": "Hey! I'm Viteezy. What should I call you?",
#         "for_whom": "Hey friend! 😊 Is this quiz for you or for a family member? (me/family)",
#         "family_name": "Got it, what's their name?",
#         "relation": "How are you related to {family_name}?",
#         "age": "Nice to meet you, {name}! How young are you feeling these days? (just the number)",
#         "protein": "{name}, are you sipping on any protein shakes or powders lately? (yes/no)",
#         "email": "Where can I send your plan, {name}? Drop your best email.",
#         "knowledge": (
#             "How comfy are you with vitamins & supplements, {name}? "
#             "Pick one: Well informed / Curious / Skeptical."
#         ),
#         "vitamin_count": (
#             "What’s your current vitamin/supplement load? Options: No / 1 to 3 / 4+."
#         ),
#         "gender": "Which fits best: male, woman, or gender neutral?",
#         "conceive": "{name}, are you currently pregnant or breastfeeding? (yes/no)",
#         "situation": (
#             "Got it. What’s your situation? Pick one: "
#             "To get pregnant in the next 2 years / I am pregnant now / Breastfeeding."
#         ),
#         "children": "{name}, thinking about having kids in the coming years? (yes/no)",
#         "concern": (
#             "Alright {name}, what's your biggest wellness focus right now? Pick one: "
#             "Sleep / Stress / Energy / Stomach & Intestines / Skin / Resistance / Weight / Libido / Brain / Hair & nails / Fitness{hormones}"
#         ),
#         # Lifestyle questions from prompt.txt
#         "lifestyle_status": "When it comes to a healthy lifestyle, you are: Been doing well for a long time / Nice on the way / Ready to start",
#         "fruit_intake": "How much fruit do you eat on average per day? (For example, a banana or a portion of blueberries) Options: Hardly / One time / Twice or more",
#         "vegetable_intake": "How many vegetables do you eat on average per day? (For example, a bell pepper or a portion of broccoli) Options: Hardly / One time / Twice or more",
#         "dairy_intake": "How many dairy products do you consume on average per day? (For example, a glass of milk, a piece of cheese or a bowl of yoghurt) Options: Hardly / One time / Twice or more",
#         "fiber_intake": "How many fiber-rich products do you consume on average per day? (For example, grains, legumes and nuts) Options: Hardly / One time / Twice or more",
#         "protein_intake": "How many protein-rich products do you consume on average per day? (For example, eggs, meat, beans and tofu) Options: Hardly / One time / Twice or more",
#         "eating_habits": "How would you describe your eating habits? Options: No preference / Flexitarian / Vegetarian / Vegan",
#         "meat_intake": "How much meat do you eat on average per week? Options: Never / Once or twice / Three times or more",
#         "fish_intake": "How much fish or seafood do you eat on average per week? Options: Never / Once or twice / Three times or more",
#         "drinks_alcohol": "Do you drink alcohol? (yes/no)",
#         "alcohol_daily": "Do you often drink more than 6 alcoholic drinks a day? (yes/no)",
#         "alcohol_weekly": "Do you often drink more than 12 alcoholic drinks in a week? (yes/no)",
#         "coffee_intake": "Do you often drink more than 4 cups of coffee a day? (yes/no)",
#         "smokes": "Do you smoke? (Also counts if you are a social smoker) (yes/no)",
#         "allergies": "Do you have one or more of the following allergies? Options: No / Milk / Egg / Fish / Shellfish and crustaceans / Peanut / Nuts / Soy / Gluten / Wheat / Pollen",
#         "dietary_preferences": "Do you have any other dietary preferences or intolerances? Options: No preference / Lactose-free / Gluten free / Paleo",
#         "sunlight_exposure": 'Do you sit in direct sunlight for more than 30 minutes a day on average? (Without clothes and without sunscreen and makeup) (yes/no)',
#         "iron_advised": "Have you ever been advised to take iron? (yes/no)",
#         "ayurveda_view": "What is your view on Eastern lifestyle such as Ayurveda? Options: I am convinced / We can learn a lot from ancient medicine / I am open to it / More information needed for an opinion / I am skeptical / Alternative medicine is nonsense",
#         "new_product_attitude": "When a new product is available with promising results, you want to: Options: To be the first / You are at the forefront of new products / Learn more / You are cautiously optimistic / Waiting for now / Scientific research takes time",
#         "medical_treatment": "Are you currently undergoing any medical treatment? (yes/no)",
#     }
#     CONCERN_SYNONYMS = {
#         "sleep": "sleep",
#         "stress": "stress",
#         "energy": "energy",
#         "stomach": "stomach_intestines",
#         "stomach & intestines": "stomach_intestines",
#         "stomach and intestines": "stomach_intestines",
#         "intestines": "stomach_intestines",
#         "gut": "stomach_intestines",
#         "skin": "skin",
#         "resistance": "resistance",
#         "immunity": "resistance",
#         "immune": "resistance",
#         "immune system": "resistance",
#         "weight": "weight",
#         "libido": "libido",
#         "brain": "brain",
#         "hair": "hair_nails",
#         "nails": "hair_nails",
#         "hair & nails": "hair_nails",
#         "hair and nails": "hair_nails",
#         "hair nails": "hair_nails",
#         "fitness": "fitness",
#         "hormones": "hormones",
#         "hormone": "hormones",
#     }
#     CONCERN_QUESTIONS = {
#         "sleep": {
#             "label": "Sleep",
#             "questions": [
#                 {"id": "fall_asleep", "prompt": "Do you usually find it hard to fall asleep?"},
#                 {"id": "refreshed", "prompt": "When you wake up, do you feel refreshed or still tired?"},
#                 {
#                     "id": "hours",
#                     "prompt": "On most nights, how many hours do you sleep? 7+ hours / Less than 7 / Less than 5",
#                 },
#             ],
#         },
#         "stress": {
#             "label": "Stress",
#             "questions": [
#                 {"id": "busy_level", "prompt": "How busy does your daily life feel? Few things / Normal / A lot"},
#                 {"id": "after_day", "prompt": "After a busy day, how do you usually feel? Energized or completely drained?"},
#                 {
#                     "id": "signals",
#                     "prompt": (
#                         "During stressful periods, do you notice any of these? "
#                         "Faster breathing, tense muscles, trouble sleeping, sensitive stomach, head pressure, fast heartbeat"
#                     ),
#                 },
#             ],
#         },
#         "energy": {
#             "label": "Energy",
#             "questions": [
#                 {"id": "day_load", "prompt": "How full do your days feel?"},
#                 {"id": "end_day", "prompt": "At the end of the day, is your energy still there or totally gone?"},
#                 {"id": "body_signals", "prompt": "During busy periods, what does your body usually signal about energy?"},
#             ],
#         },
#         "stomach_intestines": {
#             "label": "Stomach & Intestines",
#             "questions": [
#                 {
#                     "id": "bowel",
#                     "prompt": "How would you describe your bowel movements? Less than once / About once / More than once / Irregular",
#                 },
#                 {
#                     "id": "improve",
#                     "prompt": (
#                         "What would you most like to improve? Gas & bloating / That 'balloon' feeling / "
#                         "Letting go easily / Overall digestion / None"
#                     ),
#                 },
#                 {"id": "extra", "prompt": "Any other tummy or digestion details you want me to know?"},
#             ],
#         },
#         "skin": {
#             "label": "Skin",
#             "questions": [
#                 {
#                     "id": "most_days",
#                     "prompt": "How would you describe your skin most days? Pulling / Shiny / Sensitive / Dull / Pretty good",
#                 },
#                 {
#                     "id": "notices",
#                     "prompt": "Do you notice any of these? Pimples, discoloration, lines, less elasticity, aging, or none",
#                 },
#                 {"id": "dry", "prompt": "Does your skin often feel dry? Yes or no"},
#             ],
#         },
#         "resistance": {
#             "label": "Resistance",
#             "questions": [
#                 {"id": "low", "prompt": "Do you feel your resistance is a bit low lately?"},
#                 {"id": "intense_training", "prompt": "Are you currently exercising very intensively?"},
#                 {"id": "medical_care", "prompt": "Are you under medical care right now?"},
#             ],
#         },
#         "weight": {
#             "label": "Weight",
#             "questions": [
#                 {
#                     "id": "challenge",
#                     "prompt": (
#                         "Where do you feel the biggest challenge with weight loss? Movement, exercise, nutrition, "
#                         "discipline, knowledge, or none"
#                     ),
#                 },
#                 {"id": "binge", "prompt": "Do you experience binge eating sometimes?"},
#                 {"id": "sleep_hours", "prompt": "Do you usually sleep less than 7 hours a night?"},
#             ],
#         },
#         "hormones": {
#             "label": "Hormones",
#             "questions": [
#                 {"id": "cycle", "prompt": "How regular is your menstrual cycle?"},
#                 {
#                     "id": "physical_changes",
#                     "prompt": "During your period, do you notice physical changes like bloating, cravings, or pimples?",
#                 },
#                 {"id": "emotions", "prompt": "Emotionally during your period, what do you feel most?"},
#             ],
#         },
#         "libido": {
#             "label": "Libido",
#             "questions": [
#                 {"id": "level", "prompt": "How would you describe your current libido? Low / Average / High"},
#                 {"id": "sleep_quality", "prompt": "How’s your sleep quality lately?"},
#                 {"id": "pressure", "prompt": "How much pressure do you feel during the day?"},
#             ],
#         },
#         "brain": {
#             "label": "Brain",
#             "questions": [
#                 {
#                     "id": "symptoms",
#                     "prompt": (
#                         "Do you experience any of these? Difficulty focusing, forgetfulness, trouble finding words, or none"
#                     ),
#                 },
#                 {"id": "mood", "prompt": "Mentally, do you notice things like worry or low motivation?"},
#                 {"id": "improve", "prompt": "What would you most like to improve? Focus, memory, mental fitness, staying sharp"},
#             ],
#         },
#         "hair_nails": {
#             "label": "Hair & Nails",
#             "questions": [
#                 {
#                     "id": "hair",
#                     "prompt": (
#                         "How would you describe your hair? Dry, thin, split ends, won’t grow long, could be fuller, or none"
#                     ),
#                 },
#                 {
#                     "id": "nails",
#                     "prompt": "What would you like to improve about your nails? Strength, length, condition, or none",
#                 },
#                 {"id": "extras", "prompt": "Anything else about your hair or nails you want me to know?"},
#             ],
#         },
#         "fitness": {
#             "label": "Fitness",
#             "questions": [
#                 {"id": "frequency", "prompt": "How often do you exercise in a typical week?"},
#                 {
#                     "id": "training",
#                     "prompt": "What kind of training do you mostly do? Strength, cardio, HIIT, flexibility, or none",
#                 },
#                 {
#                     "id": "priority",
#                     "prompt": "What matters most to you in fitness? Performance, sweating, muscle, or health",
#                 },
#             ],
#         },
#     }

#     def __init__(
#         self,
#         session_repo: SessionRepository,
#         ai_service: OpenAIChatService,
#         product_service: ProductService,
#         user_repo=None,  # Optional UserRepository
#         quiz_session_repo=None,  # Optional QuizSessionRepository
#     ):
#         self.session_repo = session_repo
#         self.ai_service = ai_service
#         self.product_service = product_service
#         self.user_repo = user_repo
#         self.quiz_session_repo = quiz_session_repo

#     def _get_user_id_from_session(self, session: Session) -> str | None:
#         """Extract user_id from session metadata."""
#         return (session.metadata or {}).get("user_id")
    
#     def _get_is_registered_from_session(self, session: Session) -> bool:
#         """Check if session is registered (has user_id) or guest."""
#         metadata = session.metadata or {}
#         # Check is_registered flag first, then fallback to user_id presence
#         if "is_registered" in metadata:
#             return metadata.get("is_registered", False)
#         # Fallback: check if user_id exists
#         return metadata.get("user_id") is not None
#         """Extract user_id from session metadata."""
#         if session.metadata:
#             return session.metadata.get("user_id")
#         return None

#     async def _update_session_token_usage(self, session_id: str, usage_info: dict, user_id: str | None = None) -> bool:
#         """
#         Update token usage statistics in session metadata.
        
#         Returns:
#             True if update was successful, False otherwise
#         """
#         print(f"[_update_session_token_usage] Called with session_id={session_id}, user_id={user_id}")
#         print(f"[_update_session_token_usage] usage_info: {usage_info}")
#         try:
#             logger.debug(
#                 f"Calling update_token_usage: session_id={session_id}, "
#                 f"user_id={user_id}, usage_info={usage_info}"
#             )
#             print(f"[_update_session_token_usage] Calling session_repo.update_token_usage...")
#             result = await self.session_repo.update_token_usage(session_id, usage_info, user_id)
#             print(f"[_update_session_token_usage] session_repo.update_token_usage returned: {result}")
#             if result:
#                 success_msg = f"Token usage updated successfully for session {session_id}"
#                 print(f"[_update_session_token_usage] SUCCESS: {success_msg}")
#                 logger.info(success_msg)
#                 return True
#             else:
#                 warning_msg = f"update_token_usage returned None for session {session_id}, user_id: {user_id}"
#                 print(f"[_update_session_token_usage] WARNING: {warning_msg}")
#                 logger.warning(warning_msg)
#                 return False
#         except Exception as e:
#             error_msg = f"Exception in _update_session_token_usage: {e}"
#             print(f"[_update_session_token_usage] EXCEPTION: {error_msg}")
#             import traceback
#             print(f"[_update_session_token_usage] Traceback: {traceback.format_exc()}")
#             log_error_with_context(
#                 e,
#                 context={
#                     "session_id": session_id,
#                     "user_id": user_id,
#                     "operation": "update_token_usage",
#                     "usage_info": usage_info,
#                 },
#                 level=logging.ERROR
#             )
#             logger.error(error_msg, exc_info=True)
#             return False

#     async def _get_previous_session_data(self, user_id: str) -> dict:
#         """
#         Get user data from previous completed sessions.
#         Returns dict with name, age, email, gender if available.
#         """
#         if not user_id:
#             return {}
        
#         try:
#             from bson import ObjectId
#             user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
#             # Get user document with all sessions
#             # Access the collection through the repository
#             user_doc = await self.session_repo.collection.find_one({"_id": user_oid})
            
#             if not user_doc:
#                 return {}
            
#             # Find the most recent completed session
#             sessions = user_doc.get("sessions", [])
#             previous_data = {}
            
#             # Look through sessions in reverse order (most recent first)
#             for session in reversed(sessions):
#                 session_metadata = session.get("metadata", {})
#                 onboarding = session_metadata.get("onboarding", {})
#                 responses = onboarding.get("responses", {})
                
#                 # If this session has completed onboarding, extract data
#                 if onboarding.get("complete") and responses:
#                     # Extract name, email, gender (but NOT age - age is always asked)
#                     if "name" in responses and "name" not in previous_data:
#                         previous_data["name"] = responses.get("name")
#                     if "email" in responses and "email" not in previous_data:
#                         previous_data["email"] = responses.get("email")
#                     if "gender" in responses and "gender" not in previous_data:
#                         previous_data["gender"] = responses.get("gender")
                    
#                     # If we have all required fields (name, email, gender), break
#                     # Note: age is not included as it's always asked
#                     if all(key in previous_data for key in ["name", "email", "gender"]):
#                         break
            
#             return previous_data
#         except Exception:
#             # If any error occurs, return empty dict
#             return {}

#     async def _get_previous_session_concerns_and_products(self, user_id: str, current_session_id: str) -> dict:
#         """
#         Get previous session's concerns and product recommendations.
#         Returns dict with previous_concerns, previous_products, and previous_messages.
#         """
#         if not user_id:
#             return {}
        
#         try:
#             from bson import ObjectId
#             user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
#             # Get user document with all sessions
#             user_doc = await self.session_repo.collection.find_one({"_id": user_oid})
            
#             if not user_doc:
#                 return {}
            
#             # Find the most recent completed session (excluding current session)
#             sessions = user_doc.get("sessions", [])
#             previous_session_data = {}
            
#             # Look through sessions in reverse order (most recent first)
#             for session in reversed(sessions):
#                 session_id_raw = session.get("session_id")
#                 session_id = str(session_id_raw) if session_id_raw is not None else None
#                 # Skip current session
#                 if session_id == str(current_session_id):
#                     continue
                
#                 session_metadata = session.get("metadata", {})
#                 onboarding = session_metadata.get("onboarding", {})
#                 responses = onboarding.get("responses", {})
#                 messages = session.get("messages", [])
                
#                 # If this session has completed onboarding, extract concerns and products
#                 # Check for sessions where major concerns are mapped (concern field exists and is not empty)
#                 if onboarding.get("complete") and responses:
#                     # Extract concerns - only consider sessions where concerns are actually mapped
#                     previous_concerns = self._normalize_concerns(responses.get("concern", []))
                    
#                     # Only process if this session has major concerns mapped
#                     if previous_concerns:
#                         # Extract product recommendations from messages
#                         previous_products = []
#                         recommendation_text = ""
                        
#                         # Look for product recommendation messages (usually the last assistant message)
#                         for msg in reversed(messages):
#                             if msg.get("role") == "assistant":
#                                 content = msg.get("content", "")
#                                 # Check if this message contains product recommendations
#                                 # Product recommendations typically mention product names
#                                 if any(keyword in content.lower() for keyword in ["recommend", "suggest", "product", "supplement"]):
#                                     recommendation_text = content
#                                     # Try to extract product names (they're usually in the message)
#                                     # This is a simple extraction - product names are typically at the start of each recommendation
#                                     lines = content.split("\n")
#                                     for line in lines:
#                                         line = line.strip()
#                                         if line and not line.startswith(("IMPORTANT", "Note:", "⚠️", "Since you", "STRONG MEDICAL")):
#                                             # Likely a product name or title
#                                             if len(line) < 100 and not line.startswith("Since"):
#                                                 product_name = line.split(":")[0].strip()
#                                                 if product_name and product_name not in previous_products:
#                                                     previous_products.append(product_name)
#                                     break
                        
#                         previous_session_data = {
#                             "previous_concerns": previous_concerns,
#                             "previous_products": previous_products[:3],  # Limit to 3 products
#                             "previous_recommendation_text": recommendation_text,
#                         }
#                         break  # Found the most recent completed session with major concerns
            
#             return previous_session_data
#         except Exception as e:
#             import logging
#             logging.error(f"Error getting previous session concerns: {e}")
#             return {}

#     async def create_session(self, metadata: dict | None = None, user_id: str | None = None) -> Session:
#         # Check if user exists if user_id is provided
#         user_exists = False
#         is_logged_in = False
        
#         if user_id and self.user_repo:
#             user_exists = await self.user_repo.user_exists(user_id)
#             is_logged_in = user_exists  # If user exists, they're considered logged in
        
#         # Store user info in metadata
#         if metadata is None:
#             metadata = {}
#         if user_id:
#             metadata["user_id"] = user_id
#             metadata["user_exists"] = user_exists
#             metadata["is_logged_in"] = is_logged_in
        
#         session = await self.session_repo.create(metadata=metadata, user_id=user_id)
        
#         # Check if user has previous sessions and get their data
#         has_previous_sessions = metadata.get("has_previous_sessions", False)
#         if has_previous_sessions and user_id:
#             previous_data = await self._get_previous_session_data(user_id)
#             if previous_data:
#                 # Pre-populate onboarding responses with previous data
#                 # Note: age is NOT included as it's always asked every session
#                 onboarding_state = {
#                     "step": 0,
#                     "responses": previous_data,  # Pre-populate with name, email, gender (age will be asked)
#                     "complete": False,
#                     "awaiting_answer": False,
#                 }
#                 # Update session metadata with pre-populated data
#                 session_metadata = session.metadata or {}
#                 session_metadata["onboarding"] = onboarding_state
#                 session = await self.session_repo.update_metadata(
#                     session_id=session.id,
#                     metadata=session_metadata,
#                     user_id=user_id,
#                 )
        
#         # Add to quiz_sessions collection if user_id is provided
#         if user_id and self.quiz_session_repo:
#             await self.quiz_session_repo.add_session(user_id, session.id)
        
#         return session

#     async def get_session(self, session_id: str, user_id: str | None = None) -> Session:
#         session = await self.session_repo.get(session_id, user_id=user_id)
#         if not session:
#             raise SessionNotFoundError(f"Session {session_id} not found.")
#         return session

#     async def handle_message(self, payload: ChatRequest) -> ChatResponse:
#         # Try to get user_id from session metadata if available
#         # First try without user_id (legacy format), then with user_id if found
#         session = await self.session_repo.get(payload.session_id)
#         if not session:
#             raise SessionNotFoundError(f"Session {payload.session_id} not found.")
        
#         # Extract user_id from session metadata for subsequent operations
#         user_id = self._get_user_id_from_session(session)
        
#         # Get isRegistered status for all responses
#         is_registered = self._get_is_registered_from_session(session)

#         user_message = ChatMessage(role="user", content=payload.message)

#         onboarding_state = self._get_onboarding_state(session)
        
#         # Check if this is the very first message (session has no messages)
#         # If so, automatically start onboarding by asking the first question
#         # UNLESS the first question was already shown via GET /first-question endpoint
#         is_first_message = len(session.messages) == 0
#         first_question_already_shown = onboarding_state.get("first_question_shown", False)
        
#         if is_first_message and not onboarding_state.get("complete") and not first_question_already_shown:
#             # Initialize onboarding state if not already initialized
#             if onboarding_state.get("step", 0) == 0 and not onboarding_state.get("awaiting_answer"):
#                 # Get the first question
#                 has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)
#                 ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
                
#                 if ordered_steps:
#                     first_field = ordered_steps[0]
#                     first_prompt = self._build_prompt(field=first_field, responses=onboarding_state["responses"])
                    
#                     # Build the first question with friendly greeting
#                     question_content = self._friendly_question(
#                         prompt=first_prompt,
#                         step=0,
#                         prev_answer=None,
#                         prev_field=None,
#                         responses=onboarding_state.get("responses", {}),
#                     )
                    
#                     # Save the user's trigger message (even though we ignore its content)
#                     await self.session_repo.append_messages(
#                         session_id=session.id, messages=[user_message], user_id=user_id
#                     )
                    
#                     # Create the first question reply
#                     first_reply = ChatMessage(role="assistant", content=question_content)
                    
#                     # Get options for the first question
#                     options, question_type = self._get_question_options(first_field)
                    
#                     # Update onboarding state
#                     onboarding_state["step"] = 0
#                     onboarding_state["awaiting_answer"] = True
#                     await self.session_repo.append_messages(
#                         session_id=session.id, messages=[first_reply], user_id=user_id
#                     )
#                     await self.session_repo.update_metadata(
#                         session_id=session.id,
#                         metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                         user_id=user_id,
#                     )
                    
#                     return ChatResponse(
#                         session_id=session.id,
#                         reply=first_reply,
#                         options=options,
#                         question_type=question_type,
#                         isRegistered=is_registered,
#                     )

#         # Check if onboarding is complete and recommendations have been shown
#         # If so, prevent further conversation
#         if onboarding_state.get("complete") and onboarding_state.get("recommendations_shown"):
#             end_message = ChatMessage(
#                 role="assistant",
#                 content="Thank you for completing the quiz! Your personalized recommendations have been provided above. If you have any questions, please feel free to reach out to our support team. Have a great day! 😊"
#             )
#             await self.session_repo.append_messages(
#                 session_id=session.id, messages=[user_message, end_message], user_id=user_id
#             )
#             return ChatResponse(
#                 session_id=session.id,
#                 reply=end_message,
#                 options=None,
#                 question_type=None,
#                 isRegistered=is_registered,
#             )

#         # Check if user has previous sessions (for returning users)
#         has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)

#         ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
#         acknowledgment: str | None = None

#         # Check if we're waiting for registration confirmation (this should be checked first, before normal field validation)
#         if onboarding_state.get("awaiting_registration_confirmation"):
#             user_response_lower = payload.message.strip().lower()
#             if user_response_lower in ["okay", "ok", "yes", "yep", "yeah", "sure", "alright", "y"]:
#                 # Redirect to registration
#                 redirect_message = (
#                     "Perfect! I'll redirect you to create a separate registration. "
#                     "This will give your family member the best personalized experience! 🎯"
#                 )
#                 reply = ChatMessage(role="assistant", content=redirect_message)
                
#                 await self.session_repo.append_messages(
#                     session_id=session.id, messages=[user_message, reply], user_id=user_id
#                 )
#                 onboarding_state["awaiting_registration_confirmation"] = False
#                 await self.session_repo.update_metadata(
#                     session_id=session.id,
#                     metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                     user_id=user_id,
#                 )
#                 return ChatResponse(
#                     session_id=session.id,
#                     reply=reply,
#                     redirect_url="https://viteezy.nl/login",
#                     isRegistered=is_registered,
#                 )
#             elif user_response_lower in ["no", "nope", "nah", "n"]:
#                 # User wants to continue here, proceed with family flow
#                 onboarding_state["awaiting_registration_confirmation"] = False
#                 onboarding_state["step"] += 1  # Move to next step (family_name)
#                 onboarding_state["awaiting_answer"] = False
#                 acknowledgment = "No problem! Let's continue with the quiz for your family member here. 😊"
#                 await self.session_repo.append_messages(
#                     session_id=session.id, messages=[user_message], user_id=user_id
#                 )
#                 await self.session_repo.update_metadata(
#                     session_id=session.id,
#                     metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                     user_id=user_id,
#                 )
#                 # Continue to show next question below
#             else:
#                 # Invalid response, ask again
#                 error_reply = ChatMessage(
#                     role="assistant",
#                     content="Please choose 'Yes' to redirect to registration or 'No' to continue here."
#                 )
#                 options = [
#                     QuestionOption(value="yes", label="Yes"),
#                     QuestionOption(value="no", label="No"),
#                 ]
#                 await self.session_repo.append_messages(
#                     session_id=session.id, messages=[user_message, error_reply], user_id=user_id
#                 )
#                 await self.session_repo.update_metadata(
#                     session_id=session.id,
#                     metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                     user_id=user_id,
#                 )
#                 return ChatResponse(
#                     session_id=session.id,
#                     reply=error_reply,
#                     options=options,
#                     question_type="yes_no",
#                     isRegistered=is_registered,
#                 )

#         if onboarding_state["step"] < len(ordered_steps):
#             if onboarding_state["awaiting_answer"]:
#                 current_field = ordered_steps[onboarding_state["step"]]
#                 is_valid, normalized, error_reply = self._validate_response(
#                     field=current_field,
#                     raw_value=payload.message.strip(),
#                     responses=onboarding_state["responses"],
#                 )
#                 if not is_valid:
#                     reply = ChatMessage(role="assistant", content=error_reply)
#                     # Get options for the current question to show again
#                     options, question_type = self._get_question_options(current_field)
                    
#                     await self.session_repo.append_messages(
#                         session_id=session.id, messages=[user_message, reply], user_id=user_id
#                     )
#                     await self.session_repo.update_metadata(
#                         session_id=session.id,
#                         metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                         user_id=user_id,
#                     )
#                     return ChatResponse(
#                         session_id=session.id,
#                         reply=reply,
#                         options=options,
#                         question_type=question_type,
#                         isRegistered=is_registered,
#                     )

#                 self._save_response(
#                     field=current_field,
#                     normalized=normalized,
#                     responses=onboarding_state["responses"],
#                 )
#                 onboarding_state["last_answer"] = normalized
#                 onboarding_state["last_field"] = current_field
                
#                 # Special handling for "for_whom" = "family"
#                 if current_field == "for_whom" and normalized == "family":
#                     # Show registration suggestion and wait for user response
#                     registration_message = (
#                         "I understand you'd like to get recommendations for a family member. "
#                         "For the best personalized experience, I'd recommend creating a separate registration "
#                         "for your family member at https://viteezy.nl/login so they can have their own "
#                         "personalized product recommendations.\n\n"
#                         "Would you like to do that?"
#                     )
#                     reply = ChatMessage(role="assistant", content=registration_message)
#                     onboarding_state["awaiting_registration_confirmation"] = True
#                     onboarding_state["awaiting_answer"] = False
#                     # Don't increment step yet - wait for their response
                    
#                     # Provide yes/no options for frontend
#                     options = [
#                         QuestionOption(value="yes", label="Yes"),
#                         QuestionOption(value="no", label="No"),
#                     ]
                    
#                     await self.session_repo.append_messages(
#                         session_id=session.id, messages=[user_message, reply], user_id=user_id
#                     )
#                     await self.session_repo.update_metadata(
#                         session_id=session.id,
#                         metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                         user_id=user_id,
#                     )
#                     return ChatResponse(
#                         session_id=session.id,
#                         reply=reply,
#                         options=options,
#                         question_type="yes_no",
#                     )
                
#                 # Normal flow - increment step and get acknowledgment
#                 onboarding_state["step"] += 1
#                 onboarding_state["awaiting_answer"] = False

#                 # Generate empathetic acknowledgment based on the answer
#                 # Note: responses dict has been updated by _save_response, so we can check saved values
#                 acknowledgment = self._get_empathetic_acknowledgment(
#                     field=current_field,
#                     answer=normalized,
#                     responses=onboarding_state["responses"],
#                 )
                
#                 # Check if this was the medical_treatment question - if so, generate recommendations but end conversation
#                 if current_field == "medical_treatment":
#                     # Mark onboarding as complete
#                     onboarding_state["complete"] = True
                    
#                     # Save the user's response first
#                     await self.session_repo.append_messages(
#                         session_id=session.id, messages=[user_message], user_id=user_id
#                     )
                    
#                     # Generate product recommendations even though conversation ends
#                     # This allows /useridLogin to retrieve them later
#                     profile_context = onboarding_state.get("responses", {})
#                     previous_products = onboarding_state.get("previous_products", [])
#                     previous_concern_resolved = onboarding_state.get("previous_concern_resolved")
#                     previous_concerns = onboarding_state.get("previous_concerns", [])
                    
#                     try:
#                         recommended_products, product_documents = await self.product_service.find_relevant_products(
#                             message=None,
#                             context=profile_context,
#                             limit=10,
#                             exclude_product_titles=previous_products if previous_concern_resolved is False else [],
#                         )
                        
#                         if not recommended_products and previous_products and previous_concern_resolved is False:
#                             recommended_products, product_documents = await self.product_service.find_relevant_products(
#                                 message=None,
#                                 context=profile_context,
#                                 limit=3,
#                                 include_product_titles=previous_products,
#                             )
                        
#                         if not recommended_products:
#                             recommended_products, product_documents = await self.product_service.find_relevant_products(
#                                 message=None,
#                                 context=profile_context,
#                                 limit=3,
#                             )
#                     except Exception as e:
#                         import logging
#                         logging.error(f"Error finding products for medical_treatment: {e}")
#                         recommended_products = []
#                         product_documents = {}
                    
#                     # Generate recommendation message and save to session (but don't return it)
#                     if recommended_products:
#                         recommendation_message = await self._format_product_recommendations(
#                             recommended_products,
#                             profile_context,
#                             product_documents,
#                             previous_concern_resolved=previous_concern_resolved,
#                             previous_concerns=previous_concerns,
#                             previous_products=previous_products if previous_concern_resolved is False else [],
#                         )
#                         recommendation_reply = ChatMessage(role="assistant", content=recommendation_message)
#                         await self.session_repo.append_messages(
#                             session_id=session.id, messages=[recommendation_reply], user_id=user_id
#                         )
                    
#                     # Mark recommendations as shown and store product titles
#                     product_titles = [product.title for product in recommended_products] if recommended_products else []
#                     onboarding_state["recommendations_shown"] = True
#                     onboarding_state["recommended_product_titles"] = product_titles
#                     await self.session_repo.update_metadata(
#                         session_id=session.id,
#                         metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                         user_id=user_id,
#                     )
                    
#                     # End conversation immediately - return with content: null (but recommendations are saved)
#                     is_registered = self._get_is_registered_from_session(session)
#                     return ChatResponse(
#                         session_id=session.id,
#                         reply=None,  # No message/content in response
#                         options=None,
#                         question_type=None,
#                         isRegistered=is_registered,
#                     )

#             ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)

#             if onboarding_state["step"] < len(ordered_steps):
#                 next_field = ordered_steps[onboarding_state["step"]]
#                 next_prompt = self._build_prompt(field=next_field, responses=onboarding_state["responses"])
                
#                 # Build the next question with motivational prefix
#                 question_content = self._friendly_question(
#                         prompt=next_prompt,
#                         step=onboarding_state["step"],
#                         prev_answer=onboarding_state.get("last_answer"),
#                         prev_field=onboarding_state.get("last_field"),
#                     responses=onboarding_state.get("responses", {}),
#                 )
                
#                 # Combine acknowledgment with next question if acknowledgment exists
#                 if acknowledgment:
#                     reply_content = f"{acknowledgment}\n\n{question_content}"
#                 else:
#                     reply_content = question_content
                
#                 reply = ChatMessage(
#                     role="assistant",
#                     content=reply_content,
#                 )
#                 onboarding_state["awaiting_answer"] = True
                
#                 # Get options for this question
#                 options, question_type = self._get_question_options(next_field)
                
#                 await self.session_repo.append_messages(
#                     session_id=session.id, messages=[user_message, reply], user_id=user_id
#                 )
#                 await self.session_repo.update_metadata(
#                     session_id=session.id,
#                     metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                     user_id=user_id,
#                 )
#                 return ChatResponse(
#                     session_id=session.id,
#                     reply=reply,
#                     options=options,
#                     question_type=question_type,
#                     isRegistered=is_registered,
#                 )
            
#             # Onboarding is complete - check if we're waiting for login
#             onboarding_state["complete"] = True
#             await self.session_repo.update_metadata(
#                 session_id=session.id,
#                 metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                 user_id=user_id,
#             )
            
#             # Check if we're waiting for login check (set after medical_treatment)
#             # The frontend should call /useridLogin endpoint to check if user exists
#             # If user exists, products will be shown automatically
#             session_metadata = session.metadata or {}
#             user_id = session_metadata.get("user_id")
            
#             # If awaiting_login_check, continue to show products (login check happens via /useridLogin)
#             if onboarding_state.get("awaiting_login_check"):
#                 # Clear the flag and continue to product recommendations
#                 onboarding_state["awaiting_login_check"] = False
#                 await self.session_repo.update_metadata(
#                     session_id=session.id,
#                     metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                     user_id=user_id,
#                 )
            
#             # Check if we need to ask about previous concerns (for returning users)
#             has_previous_sessions = session_metadata.get("has_previous_sessions", False)
#             if has_previous_sessions and user_id and not onboarding_state.get("previous_concern_checked"):
#                 # Get previous session's concerns and products
#                 previous_data = await self._get_previous_session_concerns_and_products(user_id, session.id)
#                 previous_concerns = previous_data.get("previous_concerns", [])
#                 current_concerns = self._normalize_concerns(onboarding_state.get("responses", {}).get("concern", []))
                
#                 # Check if there's overlap between previous and current concerns
#                 if previous_concerns and current_concerns:
#                     concerns_overlap = set(previous_concerns) & set(current_concerns)
#                     if concerns_overlap:
#                         # Same concerns are being repeated - ask if previous products helped
#                         # Format concerns properly for display
#                         concern_labels = []
#                         for c in concerns_overlap:
#                             # Get proper label from CONCERN_QUESTIONS if available
#                             concern_info = self.CONCERN_QUESTIONS.get(c, {})
#                             label = concern_info.get("label", c.replace("_", " ").title())
#                             concern_labels.append(label.lower())
                        
#                         concerns_text = ", ".join(concern_labels)
#                         previous_products = previous_data.get("previous_products", [])
#                         products_text = ""
#                         if previous_products:
#                             products_text = f" (including {', '.join(previous_products[:2])})"
                        
#                         question_message = (
#                             f"I notice you're still experiencing {concerns_text} concerns. "
#                             f"Having taken the previous recommended products{products_text}, has the issue been resolved? "
#                             f"Please answer yes or no."
#                         )
                        
#                         onboarding_state["previous_concern_checked"] = True
#                         onboarding_state["awaiting_previous_concern_response"] = True
#                         onboarding_state["previous_concerns"] = list(concerns_overlap)
#                         onboarding_state["previous_products"] = previous_products
                        
#                         await self.session_repo.update_metadata(
#                             session_id=session.id,
#                             metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                             user_id=user_id,
#                         )
                        
#                         question_reply = ChatMessage(role="assistant", content=question_message)
#                         options = [
#                             QuestionOption(value="yes", label="Yes"),
#                             QuestionOption(value="no", label="No"),
#                         ]
                        
#                         await self.session_repo.append_messages(
#                             session_id=session.id, messages=[user_message, question_reply], user_id=user_id
#                         )
                        
#                         return ChatResponse(
#                             session_id=session.id,
#                             reply=question_reply,
#                             options=options,
#                             question_type="yes_no",
#                             isRegistered=is_registered,
#                         )
#                 elif previous_concerns:
#                     # User has previous concerns but current concerns are different - still ask
#                     # Format concerns properly for display
#                     concern_labels = []
#                     for c in previous_concerns:
#                         concern_info = self.CONCERN_QUESTIONS.get(c, {})
#                         label = concern_info.get("label", c.replace("_", " ").title())
#                         concern_labels.append(label.lower())
#                     concerns_text = ", ".join(concern_labels)
#                     question_message = (
#                         f"I see you previously had concerns about {concerns_text}. "
#                         f"Have those issues been resolved? Please answer yes or no."
#                     )
                    
#                     onboarding_state["previous_concern_checked"] = True
#                     onboarding_state["awaiting_previous_concern_response"] = True
#                     onboarding_state["previous_concerns"] = previous_concerns
                    
#                     await self.session_repo.update_metadata(
#                         session_id=session.id,
#                         metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                         user_id=user_id,
#                     )
                    
#                     question_reply = ChatMessage(role="assistant", content=question_message)
#                     options = [
#                         QuestionOption(value="yes", label="Yes"),
#                         QuestionOption(value="no", label="No"),
#                     ]
                    
#                     await self.session_repo.append_messages(
#                         session_id=session.id, messages=[user_message, question_reply], user_id=user_id
#                     )
                    
#                     return ChatResponse(
#                         session_id=session.id,
#                         reply=question_reply,
#                         options=options,
#                         question_type="yes_no",
#                         isRegistered=is_registered,
#                     )
#                 else:
#                     # No previous concerns found, mark as checked and proceed
#                     onboarding_state["previous_concern_checked"] = True
            
#             # Check if we're waiting for response about previous concerns
#             if onboarding_state.get("awaiting_previous_concern_response"):
#                 user_response_lower = payload.message.strip().lower()
#                 if user_response_lower in ["yes", "yep", "yeah", "y"]:
#                     # Issue has been resolved - proceed normally
#                     onboarding_state["previous_concern_resolved"] = True
#                     onboarding_state["awaiting_previous_concern_response"] = False
#                 elif user_response_lower in ["no", "nope", "nah", "n"]:
#                     # Issue has NOT been resolved - store response and proceed with strong doctor recommendation
#                     onboarding_state["previous_concern_resolved"] = False
#                     onboarding_state["awaiting_previous_concern_response"] = False
#                 else:
#                     # Invalid response, ask again
#                     error_reply = ChatMessage(
#                         role="assistant",
#                         content="Please answer 'yes' or 'no'. Has the previous issue been resolved?"
#                     )
#                     options = [
#                         QuestionOption(value="yes", label="Yes"),
#                         QuestionOption(value="no", label="No"),
#                     ]
#                     await self.session_repo.append_messages(
#                         session_id=session.id, messages=[user_message, error_reply], user_id=user_id
#                     )
#                     await self.session_repo.update_metadata(
#                         session_id=session.id,
#                         metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                         user_id=user_id,
#                     )
#                     return ChatResponse(
#                         session_id=session.id,
#                         reply=error_reply,
#                         options=options,
#                         question_type="yes_no",
#                         isRegistered=is_registered,
#                     )
                
#                 # Update metadata with response and store user message
#                 await self.session_repo.append_messages(
#                     session_id=session.id, messages=[user_message], user_id=user_id
#                 )
#                 await self.session_repo.update_metadata(
#                     session_id=session.id,
#                     metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                     user_id=user_id,
#                 )
#                 # Continue to product recommendations below - DO NOT return here
            
#             # Get product recommendations based on all onboarding responses
#             profile_context = onboarding_state.get("responses", {})
            
#             # Get previous products to exclude them initially (but include with caution if no others found)
#             previous_products = onboarding_state.get("previous_products", [])
#             previous_concern_resolved = onboarding_state.get("previous_concern_resolved")
#             previous_concerns = onboarding_state.get("previous_concerns", [])
            
#             try:
#                 # First, try to find products excluding previous ones (only if issue not resolved)
#                 recommended_products, product_documents = await self.product_service.find_relevant_products(
#                     message=None,
#                     context=profile_context,
#                     limit=10,  # Get more products to filter from
#                     exclude_product_titles=previous_products if previous_concern_resolved is False else [],
#                 )
                
#                 # If no products found and we have previous products, include them with caution
#                 if not recommended_products and previous_products and previous_concern_resolved is False:
#                     # Get previous products with caution - search specifically for them
#                     recommended_products, product_documents = await self.product_service.find_relevant_products(
#                         message=None,
#                         context=profile_context,
#                         limit=3,
#                         include_product_titles=previous_products,  # Only get these specific products
#                     )
                
#                 # Always ensure we have products - if still none, get any products
#                 if not recommended_products:
#                     recommended_products, product_documents = await self.product_service.find_relevant_products(
#                         message=None,
#                         context=profile_context,
#                         limit=3,
#                     )
#             except Exception as e:
#                 import logging
#                 logging.error(f"Error finding products: {e}")
#                 # Fallback if product search fails
#                 recommended_products = []
#                 product_documents = {}
            
#             # Generate clinical, direct recommendation message
#             # Pass previous concern info to add doctor recommendation if needed
#             recommendation_message = await self._format_product_recommendations(
#                 recommended_products,
#                 profile_context,
#                 product_documents,
#                 previous_concern_resolved=previous_concern_resolved,
#                 previous_concerns=previous_concerns,
#                 previous_products=previous_products if previous_concern_resolved is False else [],
#             )
            
#             recommendation_reply = ChatMessage(role="assistant", content=recommendation_message)
#             await self.session_repo.append_messages(
#                 session_id=session.id, messages=[recommendation_reply], user_id=user_id
#             )
            
#             # Mark onboarding as complete and recommendations as shown
#             # Store product titles in metadata for later retrieval
#             product_titles = [product.title for product in recommended_products]
#             onboarding_state["complete"] = True
#             onboarding_state["recommendations_shown"] = True
#             onboarding_state["recommended_product_titles"] = product_titles
#             await self.session_repo.update_metadata(
#                 session_id=session.id,
#                 metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#                 user_id=user_id,
#             )
            
#             return ChatResponse(
#                 session_id=session.id,
#                 reply=recommendation_reply,
#                 options=None,
#                 question_type=None,
#                 isRegistered=is_registered,
#             )

#         profile_context = onboarding_state.get("responses", {})
#         combined_context = {**profile_context}
#         if payload.context:
#             combined_context.update(payload.context)

#         trimmed_history = session.messages[-settings.max_history_turns * 2 :]

#         products, product_docs = await self.product_service.find_relevant_products(
#             message=payload.message,
#             context=combined_context,
#             limit=settings.product_context_limit,
#         )
#         product_snippets = [product.to_prompt_snippet() for product in products]

#         try:
#             reply_text, usage_info = await self.ai_service.generate_reply(
#                 system_prompt=settings.system_prompt,
#                 history=trimmed_history,
#                 user_message=payload.message,
#                 context=combined_context,
#                 products=product_snippets,
#             )
#         except Exception as e:
#             log_error_with_context(
#                 e,
#                 context={
#                     "session_id": session.id,
#                     "user_id": user_id,
#                     "message_length": len(payload.message),
#                 }
#             )
#             # Return a graceful error message instead of crashing
#             reply_text = "I apologize, but I'm experiencing technical difficulties right now. Please try again in a moment."
#             usage_info = {
#                 "input_tokens": 0,
#                 "output_tokens": 0,
#                 "total_tokens": 0,
#                 "cost": 0.0,
#                 "model": settings.openai_model,
#             }
#             # Re-raise to let the error handler deal with it
#             raise

#         assistant_message = ChatMessage(role="assistant", content=reply_text)

#         try:
#             await self.session_repo.append_messages(
#                 session_id=session.id, messages=[user_message, assistant_message], user_id=user_id
#             )
#         except Exception as e:
#             log_error_with_context(
#                 e,
#                 context={
#                     "session_id": session.id,
#                     "user_id": user_id,
#                     "operation": "append_messages",
#                 }
#             )
#             # Log but don't fail the request - message was already generated
#             logger.warning(f"Failed to save messages to database: {e}")
        
#         # Update token usage in session metadata (non-blocking)
#         # Always log to ensure we can see what's happening
#         print(f"[TOKEN_USAGE] Starting update for session {session.id}, user_id: {user_id}")
#         print(f"[TOKEN_USAGE] usage_info type: {type(usage_info)}, value: {usage_info}")
        
#         # Validate usage_info has required fields
#         if not usage_info or not isinstance(usage_info, dict):
#             error_msg = f"Invalid usage_info for session {session.id}: {usage_info}"
#             print(f"[TOKEN_USAGE] ERROR: {error_msg}")
#             logger.error(error_msg)
#         elif usage_info.get("input_tokens", 0) == 0 and usage_info.get("output_tokens", 0) == 0:
#             warning_msg = (
#                 f"usage_info has zero tokens for session {session.id}: {usage_info}. "
#                 f"This might indicate the OpenAI API didn't return usage data."
#             )
#             print(f"[TOKEN_USAGE] WARNING: {warning_msg}")
#             logger.warning(warning_msg)
#         else:
#             info_msg = (
#                 f"Updating token usage for session {session.id}, user_id: {user_id}, "
#                 f"usage_info: input={usage_info.get('input_tokens')}, "
#                 f"output={usage_info.get('output_tokens')}, "
#                 f"total={usage_info.get('total_tokens')}, "
#                 f"cost=${usage_info.get('cost', 0):.6f}, "
#                 f"model={usage_info.get('model', 'unknown')}"
#             )
#             print(f"[TOKEN_USAGE] {info_msg}")
#             logger.info(info_msg)
#             try:
#                 print(f"[TOKEN_USAGE] Calling _update_session_token_usage...")
#                 result = await self._update_session_token_usage(session.id, usage_info, user_id)
#                 print(f"[TOKEN_USAGE] _update_session_token_usage returned: {result}")
#                 if result:
#                     success_msg = (
#                         f"✅ Successfully updated token usage for session {session.id}: "
#                         f"input={usage_info.get('input_tokens')}, "
#                         f"output={usage_info.get('output_tokens')}, "
#                         f"cost=${usage_info.get('cost', 0):.6f}"
#                     )
#                     print(f"[TOKEN_USAGE] SUCCESS: {success_msg}")
#                     logger.info(success_msg)
#                 else:
#                     warning_msg = (
#                         f"⚠️ Token usage update returned False/None for session {session.id}, user_id: {user_id}. "
#                         f"Check logs above for details."
#                     )
#                     print(f"[TOKEN_USAGE] WARNING: {warning_msg}")
#                     logger.warning(warning_msg)
#             except Exception as e:
#                 error_msg = f"❌ Failed to update token usage for session {session.id}: {e}"
#                 print(f"[TOKEN_USAGE] EXCEPTION: {error_msg}")
#                 print(f"[TOKEN_USAGE] Exception details: {type(e).__name__}: {str(e)}")
#                 import traceback
#                 print(f"[TOKEN_USAGE] Traceback: {traceback.format_exc()}")
#                 log_error_with_context(
#                     e,
#                     context={
#                         "session_id": session.id,
#                         "user_id": user_id,
#                         "operation": "update_token_usage",
#                         "usage_info": usage_info,
#                     }
#                 )
#                 # Log but don't fail the request
#                 logger.error(error_msg, exc_info=True)

#         return ChatResponse(
#             session_id=session.id,
#             reply=assistant_message,
#             options=None,
#             question_type=None,
#             isRegistered=is_registered,
#         )

#     def _get_onboarding_state(self, session: Session) -> dict:
#         state = {}
#         if session.metadata and isinstance(session.metadata, dict):
#             state = session.metadata.get("onboarding") or {}
#         return {
#             "step": int(state.get("step", 0)),
#             "awaiting_answer": bool(state.get("awaiting_answer", False)),
#             "awaiting_registration_confirmation": bool(state.get("awaiting_registration_confirmation", False)),
#             "responses": dict(state.get("responses", {})),
#             "complete": bool(state.get("complete", False)),
#             "last_answer": state.get("last_answer"),
#             "last_field": state.get("last_field"),
#             "first_question_shown": bool(state.get("first_question_shown", False)),
#         }

#     def _ordered_steps(self, responses: dict, has_previous_sessions: bool = False) -> list[str]:
#         """
#         Generate ordered list of onboarding steps.
        
#         Args:
#             responses: User responses dictionary
#             has_previous_sessions: If True, skip name, email, gender for returning users (but always ask age)
#         """
#         steps = []
        
#         # Skip name, email, gender for returning users (but always ask age)
#         if not has_previous_sessions:
#             steps.append("name")
        
#         steps.append("for_whom")

#         if (responses.get("for_whom") or "") == "family":
#             steps.extend(["family_name", "relation"])

#         # Age is always asked (even for returning users)
#         steps.append("age")

#         # For returning users who select "me", skip name, email, gender, knowledge, vitamin_count
#         # and go directly to protein (after age)
#         if has_previous_sessions and (responses.get("for_whom") or "") == "me":
#             # Skip directly to protein question (age already added above)
#             steps.append("protein")
#         else:
#             # For new users or family members, include all questions
#             if not has_previous_sessions:
#                 steps.extend(["email", "knowledge", "vitamin_count"])
#             steps.append("protein")
#             if not has_previous_sessions:
#                 steps.append("gender")
        
#         # Get gender (either from current responses or pre-populated from previous session)
#         gender = (responses.get("gender") or "").lower()

#         if gender in {"woman", "female", "gender neutral"}:
#             steps.append("conceive")
#             if (responses.get("conceive") or "").lower() == "yes":
#                 steps.append("situation")
#         elif gender == "male":
#             steps.append("children")

#         steps.append("concern")
#         concerns = self._normalize_concerns(responses.get("concern"))
#         if concerns:
#             steps.extend(self._concern_followup_steps(concerns))
        
#         # Add lifestyle questions after concern questions
#         steps.extend([
#             "lifestyle_status",
#             "fruit_intake",
#             "vegetable_intake",
#             "dairy_intake",
#             "fiber_intake",
#             "protein_intake",
#             "eating_habits",
#         ])
        
#         # Conditional: meat and fish questions only if not vegetarian/vegan
#         eating_habits = (responses.get("eating_habits") or "").lower()
#         if eating_habits not in {"vegetarian", "vegan"}:
#             steps.extend(["meat_intake", "fish_intake"])
        
#         # Alcohol filter question
#         steps.append("drinks_alcohol")
        
#         # Conditional: detailed alcohol questions only if drinks alcohol
#         drinks_alcohol = (responses.get("drinks_alcohol") or "").lower()
#         if drinks_alcohol in {"yes", "y", "yeah", "yep"}:
#             steps.extend(["alcohol_daily", "alcohol_weekly"])
        
#         # Coffee and smoking
#         steps.extend(["coffee_intake", "smokes"])
        
#         # Allergies, dietary preferences, and other questions
#         steps.extend([
#             "allergies",
#             "dietary_preferences",
#             "sunlight_exposure",
#             "iron_advised",
#             "ayurveda_view",
#             "new_product_attitude",
#             "medical_treatment",  # Final question before recommendations
#         ])
        
#         return steps

#     def _build_prompt(self, field: str, responses: dict) -> str:
#         labels = self._person_labels(responses)
#         name = labels["name"]
#         person = labels["person"]
#         possessive = labels["possessive"]
#         is_family = labels["is_family"]
#         gender = (responses.get("gender") or "").strip().lower()
#         is_woman = gender in {"female", "woman"}
#         hormones = " / Hormones" if is_woman and field == "concern" else ""

#         if field == "name":
#             return self.PROMPTS["name"]
#         if field == "for_whom":
#             # For returning users, use their name instead of "friend"
#             if name and name != "you" and name.lower() != "friend":
#                 return f"Hey {name}! 😊 Is this quiz for you or for a family member? (me/family)"
#             return self.PROMPTS["for_whom"]
#         if field == "family_name":
#             return self.PROMPTS["family_name"]
#         if field == "relation":
#             return self.PROMPTS["relation"].format(family_name=person)

#         if field == "age":
#             return (
#                 f"How young is {person} feeling these days?"
#                 if is_family
#                 else self.PROMPTS["age"].format(name=name)
#             )
#         if field == "protein":
#             return (
#                 f"Is {person} sipping on any protein shakes or powders lately? (yes/no)"
#                 if is_family
#                 else self.PROMPTS["protein"].format(name=name)
#             )
#         if field == "email":
#             return (
#                 f"Where can I send {possessive} plan? Drop the best email."
#                 if is_family
#                 else self.PROMPTS["email"].format(name=name)
#             )
#         if field == "knowledge":
#             return (
#                 f"How comfy is {person} with vitamins & supplements?"
#                 f" Pick one: Well informed / Curious / Skeptical."
#                 if is_family
#                 else self.PROMPTS["knowledge"].format(name=name)
#             )
#         if field == "vitamin_count":
#             return (
#                 f"What’s {possessive} current vitamin/supplement load? Options: No / 1 to 3 / 4+."
#                 if is_family
#                 else self.PROMPTS["vitamin_count"]
#             )
#         if field == "gender":
#             return (
#                 f"Which fits {person}: male, woman, or gender neutral?"
#                 if is_family
#                 else self.PROMPTS["gender"]
#             )
#         if field == "conceive":
#             return (
#                 f"Is {person} currently pregnant or breastfeeding? (yes/no)"
#                 if is_family
#                 else self.PROMPTS["conceive"].format(name=name)
#             )
#         if field == "situation":
#             return (
#                 f"What’s {person}'s situation? Pick one: To get pregnant in the next 2 years / "
#                 f"I am pregnant now / Breastfeeding."
#                 if is_family
#                 else self.PROMPTS["situation"]
#             )
#         if field == "children":
#             return (
#                 f"Is {person} thinking about having kids in the coming years? (yes/no)"
#                 if is_family
#                 else self.PROMPTS["children"].format(name=name)
#             )
#         if field == "concern":
#             return (
#                 f"What's {person}'s biggest wellness focus right now? Pick one: "
#                 f"Sleep / Stress / Energy / Stomach & Intestines / Skin / Resistance / Weight / Libido / Brain / Hair & nails / Fitness{hormones}"
#                 if is_family
#                 else self.PROMPTS["concern"].format(name=name, hormones=hormones)
#             )

#         concern_question = self._parse_concern_field(field)
#         if concern_question:
#             concern_key, question_id = concern_question
#             return self._concern_prompt(concern_key=concern_key, question_id=question_id, responses=responses)

#         # Handle lifestyle questions
#         lifestyle_fields = {
#             "lifestyle_status", "fruit_intake", "vegetable_intake", "dairy_intake",
#             "fiber_intake", "protein_intake", "eating_habits", "meat_intake",
#             "fish_intake", "drinks_alcohol", "alcohol_daily", "alcohol_weekly",
#             "coffee_intake", "smokes", "allergies", "dietary_preferences",
#             "sunlight_exposure", "iron_advised", "ayurveda_view", "new_product_attitude",
#             "medical_treatment",
#         }
#         if field in lifestyle_fields:
#             prompt_template = self.PROMPTS[field]
#             # Format with name for personalized questions
#             if "{name}" in prompt_template:
#                 return prompt_template.format(name=name)
#             # For family members, adjust the prompt with proper verb agreement
#             if is_family and field in {"lifestyle_status", "fruit_intake", "vegetable_intake", 
#                                        "dairy_intake", "fiber_intake", "protein_intake", 
#                                        "eating_habits", "meat_intake", "fish_intake", 
#                                        "drinks_alcohol", "alcohol_daily", "alcohol_weekly",
#                                        "coffee_intake", "smokes", "allergies", 
#                                        "dietary_preferences", "sunlight_exposure", 
#                                        "iron_advised", "ayurveda_view", "new_product_attitude",
#                                        "medical_treatment"}:
#                 import re
#                 prompt = prompt_template
#                 pronoun = labels.get("pronoun", "they")
                
#                 # Fix verb agreement: "do you" → "does {person}", "are you" → "is {person}"
#                 prompt = re.sub(r'\bDo you\b', f'Does {person}', prompt, flags=re.IGNORECASE)
#                 prompt = re.sub(r'\bdo you\b', f'does {person}', prompt, flags=re.IGNORECASE)
#                 prompt = re.sub(r'\bAre you\b', f'Is {person}', prompt, flags=re.IGNORECASE)
#                 prompt = re.sub(r'\bare you\b', f'is {person}', prompt, flags=re.IGNORECASE)
#                 prompt = re.sub(r'\bHave you\b', f'Has {person}', prompt, flags=re.IGNORECASE)
#                 prompt = re.sub(r'\bhave you\b', f'has {person}', prompt, flags=re.IGNORECASE)
                
#                 # Replace "your" with possessive first (before replacing "you")
#                 prompt = re.sub(r'\byour\b', possessive, prompt, flags=re.IGNORECASE)
                
#                 # Replace "you" with person (but not if it's part of "your" which we already replaced)
#                 prompt = re.sub(r'\byou\b', person, prompt, flags=re.IGNORECASE)
                
#                 # Fix verb forms after person name: "{person} eat" → "{person} eats"
#                 verb_fixes = [
#                     (r'\beat\b', 'eats'),
#                     (r'\bdrink\b', 'drinks'),
#                     (r'\bconsume\b', 'consumes'),
#                     (r'\bsit\b', 'sits'),
#                     (r'\bsmoke\b', 'smokes'),
#                     (r'\bwant\b', 'wants'),
#                 ]
#                 for pattern, replacement in verb_fixes:
#                     # Replace verb after person name
#                     prompt = re.sub(rf'({re.escape(person)} {pattern})', f'{person} {replacement}', prompt, flags=re.IGNORECASE)
                
#                 # Special case: "{person} are" → "{person} is"
#                 prompt = re.sub(rf'\b{re.escape(person)} are\b', f'{person} is', prompt, flags=re.IGNORECASE)
                
#                 # Fix "have" → "has" when it's the main verb (not "has been")
#                 prompt = re.sub(rf'\b{re.escape(person)} have\b(?!\s+been)', f'{person} has', prompt, flags=re.IGNORECASE)
                
#                 return prompt
#             return prompt_template

#         prompt_template = self.PROMPTS[field]
#         return prompt_template.format(name=name, hormones=hormones, family_name=person)

#     @staticmethod
#     def _person_labels(responses: dict) -> dict:
#         name = responses.get("name") or "friend"
#         for_whom = responses.get("for_whom") or "self"
#         family_name = responses.get("family_name")
#         relation = responses.get("relation") or "family member"
#         gender = (responses.get("gender") or "").lower()

#         if for_whom == "family":
#             is_family = True
#             # Capitalize family name if provided
#             if family_name:
#                 person = family_name.title()
#                 possessive = f"{person}'s"
#                 reference = person
#             else:
#                 # Use relation if family_name not provided
#                 person = f"your {relation}"
#                 possessive = f"your {relation}'s"
#                 reference = f"your {relation}"
            
#             # Determine pronoun based on gender/relation
#             if gender in ["woman", "female"]:
#                 pronoun = "she"
#                 pronoun_obj = "her"
#                 pronoun_possessive = "her"
#             elif gender in ["male", "man"]:
#                 pronoun = "he"
#                 pronoun_obj = "him"
#                 pronoun_possessive = "his"
#             else:
#                 # Try to infer from relation
#                 relation_lower = relation.lower() if relation else ""
#                 if relation_lower in ["son", "brother", "father", "dad", "husband", "boyfriend"]:
#                     pronoun = "he"
#                     pronoun_obj = "him"
#                     pronoun_possessive = "his"
#                 elif relation_lower in ["daughter", "sister", "mother", "mom", "wife", "girlfriend"]:
#                     pronoun = "she"
#                     pronoun_obj = "her"
#                     pronoun_possessive = "her"
#                 else:
#                     pronoun = "they"
#                     pronoun_obj = "them"
#                     pronoun_possessive = "their"
#         else:
#             person = "you"
#             possessive = "your"
#             reference = "you"
#             is_family = False
#             pronoun = "you"
#             pronoun_obj = "you"
#             pronoun_possessive = "your"

#         return {
#             "name": name,
#             "person": person,
#             "possessive": possessive,
#             "reference": reference,
#             "is_family": is_family,
#             "pronoun": pronoun,
#             "pronoun_obj": pronoun_obj,
#             "pronoun_possessive": pronoun_possessive,
#             "relation": relation,
#             "family_name": family_name,
#         }

#     def _validate_response(self, field: str, raw_value: str, responses: dict) -> tuple[bool, Any, str]:
#         """Validate onboarding answers. Returns (valid, normalized_value, error_message)."""
#         val = raw_value.strip()
#         name = responses.get("name") or "friend"

#         if field == "name":
#             if len(val) < 2:
#                 return False, val, "I want to remember you, can you share a name with at least 2 letters? 😊"
#             return True, val, ""

#         if field == "for_whom":
#             normalized = val.lower()
#             allowed = {
#                 "me": "self",
#                 "myself": "self",
#                 "self": "self",
#                 "for me": "self",
#                 "no": "self",
#                 "family": "family",
#                 "family member": "family",
#                 "for family": "family",
#                 "for my family": "family",
#                 "friend": "family",
#                 "partner": "family",
#                 "spouse": "family",
#                 "yes": "family",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, "Is this for you or for a family member? Just say 'me' or 'family'."

#         if field == "family_name":
#             if len(val) < 2:
#                 return False, val, "Tell me their name with at least 2 letters so I can personalize it. 😊"
#             return True, val, ""

#         if field == "relation":
#             if len(val) < 3:
#                 return False, val, "How are you related? (e.g., spouse, parent, sibling, friend)"
#             return True, val, ""

#         if field == "age":
#             if not val.isdigit():
#                 return False, val, f"{name}, can you share your age as a number (e.g., 27)?"
#             age = int(val)
#             if age <= 0 or age > 100:
#                 return False, val, f"{name}, that age feels off. Mind giving me a real number between 1 and 100?"
#             return True, str(age), ""

#         if field == "protein":
#             normalized = val.lower()
#             yes_set = {"yes", "y", "yeah", "yep", "sure", "taking", "i do"}
#             no_set = {"no", "n", "nope", "nah", "not"}
#             if normalized in yes_set:
#                 return True, "yes", ""
#             if normalized in no_set:
#                 return True, "no", ""
#             return False, val, f"{name}, just a quick yes or no, are you taking protein powder or shakes right now?"

#         if field == "knowledge":
#             normalized = val.lower()
#             allowed = {
#                 "well informed": "well informed",
#                 "well-informed": "well informed",
#                 "informed": "well informed",
#                 "curious": "curious",
#                 "skeptical": "skeptical",
#                 "sceptical": "skeptical",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, choose one: Well informed, Curious, or Skeptical."

#         if field == "vitamin_count":
#             normalized = val.lower()
#             allowed = {
#                 "no": "0",
#                 "none": "0",
#                 "0": "0",
#                 "1": "1 to 3",
#                 "2": "1 to 3",
#                 "3": "1 to 3",
#                 "1 to 3": "1 to 3",
#                 "1-3": "1 to 3",
#                 "4": "4+",
#                 "4+": "4+",
#                 "5": "4+",
#                 "5+": "4+",
#                 "many": "4+",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: No, 1 to 3, or 4+."

#         if field == "gender":
#             normalized = val.lower()
#             allowed = {
#                 "male": "male",
#                 "man": "male",
#                 "m": "male",
#                 "woman": "female",
#                 "women": "female",
#                 "female": "female",
#                 "f": "female",
#                 "gender neutral": "gender neutral",
#                 "neutral": "gender neutral",
#                 "non-binary": "gender neutral",
#                 "nonbinary": "gender neutral",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, choose one: male, woman, or gender neutral."

#         if field == "conceive":
#             normalized = val.lower()
#             if normalized in {"yes", "y", "yeah", "yep"}:
#                 return True, "yes", ""
#             if normalized in {"no", "n", "nope", "nah"}:
#                 return True, "no", ""
#             return False, val, f"{name}, a simple yes or no works, are you pregnant or breastfeeding?"

#         if field == "situation":
#             normalized = val.lower()
#             allowed = {
#                 "to get pregnant in the next 2 years": "planning (2 years)",
#                 "planning": "planning (2 years)",
#                 "next 2 years": "planning (2 years)",
#                 "i am pregnant now": "pregnant",
#                 "pregnant": "pregnant",
#                 "breastfeeding": "breastfeeding",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: To get pregnant in the next 2 years / I am pregnant now / Breastfeeding."

#         if field == "children":
#             normalized = val.lower()
#             if normalized in {"yes", "y", "yeah", "yep"}:
#                 return True, "yes", ""
#             if normalized in {"no", "n", "nope", "nah"}:
#                 return True, "no", ""
#             return False, val, f"{name}, just a yes or no, planning for kids in the coming years?"

#         if field == "email":
#             if "@" in val and "." in val.split("@")[-1] and len(val) > 5:
#                 return True, val, ""
#             return False, val, f"{name}, could you share a real email like youremail@example.com? Promise I’ll keep it safe."

#         if field == "concern":
#             options = {
#                 "sleep",
#                 "stress",
#                 "energy",
#                 "stomach & intestines",
#                 "stomach",
#                 "intestines",
#                 "skin",
#                 "resistance",
#                 "weight",
#                 "libido",
#                 "brain",
#                 "hair & nails",
#                 "hair",
#                 "nails",
#                 "fitness",
#                 "hormones",
#             }
#             parsed = self._parse_concerns(val)
#             if parsed:
#                 return True, parsed, ""
#             return False, val, (
#                 f"{name}, pick one or a few from: Sleep / Stress / Energy / Stomach & Intestines / "
#                 "Skin / Resistance / Weight / Libido / Brain / Hair & nails / Fitness (Hormones if relevant). "
#                 "You can separate choices with commas."
#             )

#         parsed_concern_question = self._parse_concern_field(field)
#         if parsed_concern_question:
#             concern_key, question_id = parsed_concern_question
#             question = self._question_by_key(concern_key, question_id, responses)
#             label = self.CONCERN_QUESTIONS.get(concern_key, {}).get("label", concern_key.title())
#             if not val:
#                 return False, val, f"Quick one about {label}: {question or 'can you share a short answer?'}"
#             return True, val, ""

#         # Lifestyle question validations
#         if field == "lifestyle_status":
#             normalized = val.lower()
#             allowed = {
#                 "been doing well for a long time": "been doing well for a long time",
#                 "doing well": "been doing well for a long time",
#                 "nice on the way": "nice on the way",
#                 "on the way": "nice on the way",
#                 "ready to start": "ready to start",
#                 "starting": "ready to start",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: Been doing well for a long time / Nice on the way / Ready to start"

#         if field in {"fruit_intake", "vegetable_intake", "dairy_intake", "fiber_intake", "protein_intake"}:
#             normalized = val.lower()
#             allowed = {
#                 "hardly": "hardly",
#                 "rarely": "hardly",
#                 "seldom": "hardly",
#                 "one time": "one time",
#                 "once": "one time",
#                 "1": "one time",
#                 "twice or more": "twice or more",
#                 "twice": "twice or more",
#                 "2": "twice or more",
#                 "more": "twice or more",
#                 "multiple": "twice or more",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: Hardly / One time / Twice or more"

#         if field == "eating_habits":
#             normalized = val.lower()
#             allowed = {
#                 "no preference": "no preference",
#                 "none": "no preference",
#                 "flexitarian": "flexitarian",
#                 "vegetarian": "vegetarian",
#                 "veg": "vegetarian",
#                 "vegan": "vegan",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: No preference / Flexitarian / Vegetarian / Vegan"

#         if field in {"meat_intake", "fish_intake"}:
#             normalized = val.lower()
#             allowed = {
#                 "never": "never",
#                 "no": "never",
#                 "once or twice": "once or twice",
#                 "once": "once or twice",
#                 "twice": "once or twice",
#                 "1-2": "once or twice",
#                 "three times or more": "three times or more",
#                 "three": "three times or more",
#                 "3": "three times or more",
#                 "more": "three times or more",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: Never / Once or twice / Three times or more"

#         if field in {"drinks_alcohol", "alcohol_daily", "alcohol_weekly", "coffee_intake", "smokes", "sunlight_exposure", "iron_advised", "medical_treatment"}:
#             normalized = val.lower()
#             if normalized in {"yes", "y", "yeah", "yep", "sure"}:
#                 return True, "yes", ""
#             if normalized in {"no", "n", "nope", "nah", "not"}:
#                 return True, "no", ""
#             return False, val, f"{name}, just a quick yes or no works here."

#         if field == "allergies":
#             normalized = val.lower()
#             allowed = {
#                 "no": "no",
#                 "none": "no",
#                 "milk": "milk",
#                 "egg": "egg",
#                 "eggs": "egg",
#                 "fish": "fish",
#                 "shellfish and crustaceans": "shellfish and crustaceans",
#                 "shellfish": "shellfish and crustaceans",
#                 "crustaceans": "shellfish and crustaceans",
#                 "peanut": "peanut",
#                 "peanuts": "peanut",
#                 "nuts": "nuts",
#                 "soy": "soy",
#                 "gluten": "gluten",
#                 "wheat": "wheat",
#                 "pollen": "pollen",
#             }
#             # Allow multiple allergies separated by commas
#             if "," in normalized:
#                 parts = [part.strip() for part in normalized.split(",")]
#                 valid_parts = []
#                 for part in parts:
#                     if part in allowed:
#                         valid_parts.append(allowed[part])
#                 if valid_parts:
#                     return True, ", ".join(valid_parts), ""
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick from: No / Milk / Egg / Fish / Shellfish and crustaceans / Peanut / Nuts / Soy / Gluten / Wheat / Pollen"

#         if field == "dietary_preferences":
#             normalized = val.lower()
#             allowed = {
#                 "no preference": "no preference",
#                 "none": "no preference",
#                 "lactose-free": "lactose-free",
#                 "lactose free": "lactose-free",
#                 "gluten free": "gluten free",
#                 "gluten-free": "gluten free",
#                 "paleo": "paleo",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: No preference / Lactose-free / Gluten free / Paleo"

#         if field == "ayurveda_view":
#             normalized = val.lower()
#             allowed = {
#                 "i am convinced": "i am convinced",
#                 "convinced": "i am convinced",
#                 "we can learn a lot from ancient medicine": "we can learn a lot from ancient medicine",
#                 "learn from ancient medicine": "we can learn a lot from ancient medicine",
#                 "ancient medicine": "we can learn a lot from ancient medicine",
#                 "i am open to it": "i am open to it",
#                 "open to it": "i am open to it",
#                 "open": "i am open to it",
#                 "more information needed for an opinion": "more information needed for an opinion",
#                 "need more information": "more information needed for an opinion",
#                 "i am skeptical": "i am skeptical",
#                 "skeptical": "i am skeptical",
#                 "alternative medicine is nonsense": "alternative medicine is nonsense",
#                 "nonsense": "alternative medicine is nonsense",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: I am convinced / We can learn a lot from ancient medicine / I am open to it / More information needed for an opinion / I am skeptical / Alternative medicine is nonsense"

#         if field == "new_product_attitude":
#             normalized = val.lower()
#             allowed = {
#                 "to be the first": "to be the first",
#                 "first": "to be the first",
#                 "you are at the forefront of new products": "you are at the forefront of new products",
#                 "forefront": "you are at the forefront of new products",
#                 "learn more": "learn more",
#                 "you are cautiously optimistic": "you are cautiously optimistic",
#                 "cautiously optimistic": "you are cautiously optimistic",
#                 "waiting for now": "waiting for now",
#                 "waiting": "waiting for now",
#                 "scientific research takes time": "scientific research takes time",
#                 "research takes time": "scientific research takes time",
#             }
#             if normalized in allowed:
#                 return True, allowed[normalized], ""
#             return False, val, f"{name}, pick one: To be the first / You are at the forefront of new products / Learn more / You are cautiously optimistic / Waiting for now / Scientific research takes time"

#         return True, val, ""

#     def _get_empathetic_acknowledgment(
#         self, field: str, answer: str, responses: dict[str, Any]
#     ) -> str | None:
#         """
#         Generate empathetic, motivational acknowledgments based on user's answer.
#         Makes the bot feel more connected and caring.
#         Analyzes the context and severity to provide appropriate responses.
#         Personalizes for family members when applicable.
#         """
#         answer_lower = str(answer).lower()
#         labels = self._person_labels(responses)
#         is_family = labels.get("is_family", False)
#         person = labels.get("person", "you")
#         pronoun = labels.get("pronoun", "you")
#         pronoun_obj = labels.get("pronoun_obj", "you")
#         pronoun_possessive = labels.get("pronoun_possessive", "your")
#         reference = labels.get("reference", "you")
        
#         # Check if this is a concern detail question (e.g., "concern|sleep|fall_asleep")
#         concern_detail = self._parse_concern_field(field)
#         if concern_detail:
#             concern_key, question_id = concern_detail
            
#             # Sleep-related concern details
#             if concern_key == "sleep":
#                 # Severe sleep issues
#                 if any(term in answer_lower for term in ["less than 5", "less than 7", "still tired", "tired", "exhausted", "drained"]):
#                     is_pregnant = responses.get("situation", "").lower() in ["pregnant", "i am pregnant now"]
#                     if is_pregnant:
#                         return "I understand how difficult this must be, especially during pregnancy. Sleep is so important for both you and your baby. Let's find safe, natural solutions to help you get the rest you need. You're doing the right thing by addressing this! 🌙💕"
#                     return "I completely understand how challenging this is. Getting enough quality sleep is crucial for your wellbeing. Let's work together to find solutions that will help you feel more rested and refreshed. You're taking an important step! 🌙"
                
#                 # Difficulty falling asleep
#                 if question_id == "fall_asleep" and answer_lower in ["yes", "yep", "yeah"]:
#                     return "I know how frustrating it can be when sleep doesn't come easily. We'll find ways to help you relax and drift off more naturally. You're not alone in this! 😴"
                
#                 # Not feeling refreshed
#                 if question_id == "wake_refreshed" and "tired" in answer_lower:
#                     return "Waking up still tired can really affect your whole day. Let's find solutions to help you get more restorative sleep so you wake up feeling refreshed and ready. We'll get there! ☀️"
            
#             # Energy-related concern details
#             if concern_key == "energy":
#                 # Severe energy issues
#                 if any(term in answer_lower for term in ["totally gone", "gone", "sleepy", "tired", "exhausted", "drained", "low", "very low"]):
#                     is_pregnant = responses.get("situation", "").lower() in ["pregnant", "i am pregnant now"]
#                     if is_pregnant:
#                         return "I know energy can be really challenging during pregnancy. Your body is doing amazing work, and it's completely normal to feel drained. Let's find safe, natural ways to support your energy levels. You're doing great! ⚡💕"
#                     return "I hear you on the energy front. Feeling drained can make everything harder. Let's find natural ways to boost your vitality and help you feel more energized throughout the day. We'll work on this together! ⚡"
                
#                 # Energy completely gone
#                 if "totally gone" in answer_lower or "gone" in answer_lower:
#                     return "I understand how exhausting that must feel. When your energy is completely depleted, it affects everything. Let's find solutions to help restore your natural energy and vitality. You've got this! 💪"
        
#         # Name - warm welcome
#         if field == "name":
#             return f"Nice to meet you, {answer}! I'm so glad you're here. I'm excited to help you on your wellness journey. Let's get started! 😊"
        
#         # Pregnancy - congratulations regardless of gender (supporting partner/family)
#         # Check "situation" field for detailed pregnancy status (this is where we show specific messages)
#         if field == "situation":
#             if "pregnant" in answer_lower or answer_lower == "i am pregnant now":
#                 return "Congratulations in advance! That's such wonderful news. I'm here to help you find the best supplements to support your journey. Let's make sure everything is perfect for you! 💕"
#             elif "planning" in answer_lower or "2 years" in answer_lower or "to get pregnant" in answer_lower:
#                 return "That's exciting that you're planning for this journey! I'm here to help you prepare your body with the right supplements. Let's get you ready for this beautiful chapter! 🌟"
#             elif "breastfeeding" in answer_lower:
#                 return "That's amazing! Breastfeeding is such a special time. I'll help you find supplements that are safe and beneficial for both you and your little one. You're doing great! 💕"
        
#         # For "conceive" field (initial yes/no), just acknowledge without congratulating yet
#         # We'll congratulate after they specify their situation
#         if field == "conceive" and answer_lower in ["yes", "yep", "yeah"]:
#             return "Thanks for sharing that with me. I'll help you find the right supplements for your situation. Let's continue! 😊"
        
#         # Legacy "pregnant" field support
#         if field == "pregnant":
#             if "pregnant" in answer_lower or answer_lower in ["yes", "yep", "yeah", "i am pregnant now"]:
#                 return "Congratulations in advance! That's such wonderful news. I'm here to help you find the best supplements to support your journey. Let's make sure everything is perfect for you! 💕"
#             elif "planning" in answer_lower or "2 years" in answer_lower:
#                 return "That's exciting that you're planning for this journey! I'm here to help you prepare your body with the right supplements. Let's get you ready for this beautiful chapter! 🌟"
#             elif "breastfeeding" in answer_lower:
#                 return "That's amazing! Breastfeeding is such a special time. I'll help you find supplements that are safe and beneficial for both you and your little one. You're doing great! 💕"
        
#         # Sleep issues - supportive and reassuring (check both string and list)
#         if field == "concern":
#             concerns_list = responses.get("concern", [])
#             if isinstance(concerns_list, str):
#                 concerns_list = [concerns_list]
#             concerns_text = " ".join(concerns_list).lower() if isinstance(concerns_list, list) else answer_lower
            
#             if "sleep" in concerns_text or "sleep" in answer_lower:
#                 if is_family:
#                     return f"I completely understand how challenging lack of sleep can be for {person}. No worries, we'll handle this together and find solutions that work for {pronoun_obj}. {person.title()}'s taking the right step by addressing this! 🌙"
#                 return "I completely understand how challenging lack of sleep can be. No worries, we'll handle this together and find solutions that work for you. You're taking the right step by addressing this! 🌙"
            
#             # Energy issues - motivating
#             if any(term in concerns_text or term in answer_lower for term in ["energy", "tired", "fatigue", "exhausted", "drained"]):
#                 if is_family:
#                     return f"I hear you on the energy front for {person}. Let's get {pronoun_obj} feeling more energized and vibrant! We'll find the right support to boost {pronoun_possessive} vitality. {person.title()}'s got this! ⚡"
#                 return "I hear you on the energy front. Let's get you feeling more energized and vibrant! We'll find the right support to boost your vitality. You've got this! ⚡"
            
#             # Stress/Anxiety - supportive
#             if any(term in concerns_text or term in answer_lower for term in ["stress", "anxiety", "worried", "overwhelmed"]):
#                 if is_family:
#                     return f"Stress and anxiety can be really tough to deal with. {person.title()} is not alone in this, and I'm here to help {pronoun_obj} find natural ways to feel more calm and balanced. We'll work through this together. 💙"
#                 return "Stress and anxiety can be really tough to deal with. You're not alone in this, and I'm here to help you find natural ways to feel more calm and balanced. We'll work through this together. 💙"
            
#             # Skin concerns - encouraging
#             if any(term in concerns_text or term in answer_lower for term in ["skin", "acne", "pimples", "dry", "sensitive"]):
#                 return "I understand skin concerns can affect your confidence. Let's work together to find products that will help your skin glow and feel its best. You deserve to feel great in your own skin! ✨"
            
#             # Weight/Health goals - motivating
#             if any(term in concerns_text or term in answer_lower for term in ["weight", "fitness", "health", "wellness"]):
#                 return "That's fantastic that you're focused on your health goals! I'm excited to help you on this journey. Together, we'll find the perfect supplements to support your wellness. Let's do this! 💪"
            
#             # General concern acknowledgment if no specific match
#             if concerns_list or answer_lower not in ["no", "none", "nope", "nah"]:
#                 return "I understand your concerns, and I'm here to help you address them. Let's work together to find the right solutions for you. You're taking a great step towards better health! 💚"
        
#         # Medical treatment - supportive and careful (especially important if pregnant)
#         if field == "medical_treatment" and answer_lower in ["yes", "yep", "yeah"]:
#             is_pregnant = responses.get("situation", "").lower() in ["pregnant", "i am pregnant now"]
#             if is_pregnant:
#                 return "Thank you for sharing that with me. I really appreciate your honesty, especially during this special time. We'll be extra careful with recommendations and make sure everything is safe for both you and your baby. Your health is our top priority. 🏥💕"
#             return "Thank you for sharing that with me. I really appreciate your honesty. We'll be extra careful with recommendations and make sure everything is safe for you. Your health is our top priority. 🏥"
        
#         # Allergies - reassuring
#         if field == "allergies" and answer_lower not in ["no", "none", "nope", "nah"]:
#             return "Thanks for letting me know about your allergies. I'll make absolutely sure to recommend only products that are completely safe for you. Your safety comes first, always! 🛡️"
        
#         # Dietary preferences - positive
#         if field == "eating_habits" and answer_lower in ["vegetarian", "vegan"]:
#             if is_family:
#                 return f"That's wonderful! I respect {person}'s dietary choices completely. I'll make sure all recommendations align perfectly with {pronoun_possessive} values. Let's find the best plant-based support for {pronoun_obj}! 🌱"
#             return "That's wonderful! I respect your dietary choices completely. I'll make sure all recommendations align perfectly with your values. Let's find the best plant-based support for you! 🌱"
        
#         # Gender - welcoming and inclusive
#         if field == "gender":
#             return "Perfect! Thanks for sharing that with me. This helps me personalize recommendations just for you. Let's continue! 😊"
        
#         # Age-related concerns - supportive
#         if field == "age":
#             try:
#                 age = int(answer)
#                 if age < 18:
#                     return "Thanks for sharing your age! I'll make sure all recommendations are age-appropriate and safe for you. Let's find the perfect supplements for your stage of life! 🌟"
#                 elif age >= 50:
#                     return "I appreciate you sharing your age. This helps me recommend products that are specifically beneficial for your life stage. Let's focus on keeping you healthy and vibrant! 💫"
#                 else:
#                     return "Thanks for sharing! This helps me tailor recommendations that are perfect for your age group. Let's continue! 😊"
#             except (ValueError, TypeError):
#                 pass
        
#         # Positive health status - celebrating
#         if field == "health_status" and any(term in answer_lower for term in ["good", "great", "excellent", "fine", "well"]):
#             return "That's wonderful to hear! It's great that you're feeling good. Let's keep that momentum going and find supplements that will help you maintain and even enhance your wellness! 🎉"
        
#         # Exercise - encouraging
#         if field == "exercise" and answer_lower in ["yes", "yep", "yeah"]:
#             return "That's awesome that you're staying active! Exercise combined with the right supplements can really amplify your results. Let's find products that support your active lifestyle! 🏃‍♀️"
        
#         # No exercise - non-judgmental support
#         if field == "exercise" and answer_lower in ["no", "nope", "nah"]:
#             return "No judgment here at all! Everyone's journey is different. Let's find supplements that work for your lifestyle and help you feel your best, regardless of your activity level. You're doing great! 💚"
        
#         # Lifestyle questions - acknowledge concerning patterns (vary responses to avoid repetition)
#         lifestyle_fields = ["fruit_intake", "vegetable_intake", "dairy_intake", "fiber_intake", "protein_intake"]
#         if field in lifestyle_fields:
#             if answer_lower == "hardly":
#                 return "I appreciate your honesty. Nutrition is important, and supplements can help fill in the gaps. Let's make sure you're getting all the nutrients you need! 💚"
#             elif answer_lower == "one time":
#                 # Vary the acknowledgment to avoid repetition
#                 acknowledgments = [
#                     "Good to know! Supplements can help ensure you're getting all the nutrients you need. Let's continue! 🌟",
#                     "Thanks for sharing! Every bit of nutrition counts. Let's keep going! 💪",
#                     "Got it! Supplements can complement your diet nicely. Next question:",
#                 ]
#                 # Use field name to create a consistent but varied response
#                 field_index = lifestyle_fields.index(field) if field in lifestyle_fields else 0
#                 return acknowledgments[field_index % len(acknowledgments)]
#             elif answer_lower == "twice or more":
#                 return "That's great! You're doing well with your nutrition. Supplements can still help optimize your intake. Let's continue! 🌟"
        
#         # Lifestyle status - acknowledge progress
#         if field == "lifestyle_status":
#             if "ready to start" in answer_lower:
#                 return "That's wonderful that you're ready to make positive changes! I'm here to support you every step of the way. Let's build a plan that works for you! 💪"
#             elif "nice on the way" in answer_lower:
#                 return "That's great that you're already on the path! Keep up the momentum, and let's find supplements that will support your continued progress! 🌟"
#             elif "been doing well" in answer_lower:
#                 return "That's fantastic! It's wonderful that you've been maintaining a healthy lifestyle. Let's find supplements that will help you maintain and enhance your wellness! 🎉"
        
#         # General positive acknowledgment for any "yes" answer (but not for concerning contexts)
#         if answer_lower in ["yes", "yep", "yeah", "sure", "okay", "ok"]:
#             # Don't use generic "yes" acknowledgment for concerning health questions
#             if field and any(term in field.lower() for term in ["concern", "sleep", "energy", "stress", "medical"]):
#                 return None  # Let more specific acknowledgments handle these
#             return "Perfect! Thanks for sharing that with me. I'm here to help you every step of the way. Let's continue! 😊"
        
#         # General acknowledgment for any answer (fallback)
#         return None

#     def _friendly_question(
#         self, prompt: str, step: int, prev_answer: Any | None = None, prev_field: str | None = None, responses: dict | None = None
#     ) -> str:
#         tone = self._tone_from_answer(prev_answer, prev_field)
        
#         # Get family member info if available
#         is_family = False
#         if responses:
#             labels = self._person_labels(responses)
#             is_family = labels.get("is_family", False)
        
#         # Check for severe concerns to use more empathetic prefixes
#         is_severe_concern = False
#         if prev_answer:
#             answer_text = str(prev_answer).lower()
#             severe_indicators = ["less than 5", "less than 7", "still tired", "totally gone", "gone", "exhausted", "drained", "sleepy"]
#             is_severe_concern = any(indicator in answer_text for indicator in severe_indicators)
        
#         buckets = {
#             "celebrate": [
#                 "Love that! 🎉",
#                 "Nice, that's great to hear!",
#                 "Awesome vibes, let's keep it going:",
#                 "Sweet, thanks for sharing!",
#                 "Great choice, here's another quick one:",
#                 "That's solid, let's keep the momentum:",
#                 "Great energy, rolling on:",
#                 "You're crushing it, next bit:",
#                 "Brilliant, tell me this:",
#                 "Fantastic! Quick follow-up:",
#                 "High five on that! One more:",
#                 "Sounds great, here comes the next one:",
#             ],
#             "supportive": [
#                 "I hear you, and I'm here to help you through this. Let's work together:",
#                 "Got it, and we'll sort this out together. You're not alone:",
#                 "Thanks for being real about that. I appreciate your honesty:",
#                 "Totally understand, let's dial this in. We've got this:",
#                 "Noted, and I'm here to support you. Let's make this better:",
#                 "We'll tackle this together, next question to help:",
#                 "I'm on your side, tell me a bit more so I can help you better:",
#                 "Let's figure this out together, one more question:",
#                 "Thanks for sharing, this helps me help you. Let's continue:",
#                 "We've got this, quick follow-up:",
#                 "Let's get you feeling better, next up:",
#                 "Appreciate the honesty, another quick one:",
#                 "I'm here with you, let's fine-tune things:",
#                 "We'll solve this step by step, next one:",
#                 "You're not alone in this, tell me more:",
#                 "Let's smooth this out, here's another:",
#                 "I get it, let's make a plan together:",
#                 "We'll adjust as we go, quick follow-up:",
#                 "Let's make this easier for you, next question:",
#                 "Thanks for trusting me with that, one more:",
#                 "We'll keep it gentle, share a bit more:",
#                 "Let's take it one step at a time, next up:",
#                 "I've got you, help me with this one:",
#             ],
#             "neutral": [
#                 "Hey friend! 😊",
#                 "Great! Let's keep moving forward together:",
#                 "Thanks for that, I appreciate you sharing. Another quick one:",
#                 "You're doing great! Here we go:",
#                 "Appreciate it, this helps me understand you better. Tell me this:",
#                 "Let's keep the flow going, next question:",
#                 "I'm here to help you, here's one more:",
#                 "Thanks for being open with me, answer this:",
#                 "On we go together, give me your take:",
#                 "You're making great progress, what about this:",
#                 "Still with me? I'm here for you. Here's the next one:",
#                 "Let's continue this journey together, tell me this:",
#             ],
#         }
        
#         # For severe concerns, prioritize more empathetic supportive prefixes
#         if is_severe_concern and tone == "supportive":
#             severe_supportive = [
#                 "I understand this is challenging. Let's work through this together:",
#                 "I hear you, and I'm here to help. Let's take the next step:",
#                 "This must be really tough. We'll find solutions together:",
#                 "I appreciate you sharing this with me. Let's continue:",
#                 "You're not alone in this. Let's keep moving forward:",
#             ]
#             choices = severe_supportive
#         else:
#             choices = buckets.get(tone, buckets["neutral"])
        
#         prefix = choices[step % len(choices)]
        
#         # If prompt already starts with "Hey" (personalized greeting), don't add prefix
#         if prompt.strip().startswith("Hey"):
#             return prompt
        
#         return f"{prefix} {prompt}"

#     def _tone_from_answer(self, answer: Any | None, field: str | None = None) -> str:
#         if answer is None:
#             return "neutral"
#         text = str(answer).lower()
        
#         # Check for severe concerning answers that need extra support
#         severe_concerns = {
#             "less than 5",
#             "less than 7",
#             "still tired",
#             "totally gone",
#             "gone",
#             "exhausted",
#             "drained",
#             "sleepy",
#             "hardly",
#         }
#         if any(concern in text for concern in severe_concerns):
#             return "supportive"
        
#         positive = {
#             "good",
#             "great",
#             "pretty good",
#             "energized",
#             "7+",
#             "7 +",
#             "high",
#             "performance",
#             "health",
#             "fine",
#             "balanced",
#             "strong",
#             "clear",
#             "better",
#             "improving",
#             "refreshed",
#             "solid",
#             "steady",
#         }
#         supportive = {
#             "no",
#             "none",
#             "nah",
#             "nope",
#             "not really",
#             "yes",
#             "yep",
#             "yeah",
#             "low",
#             "little",
#             "less",
#             "tired",
#             "drained",
#             "pimples",
#             "dry",
#             "sensitive",
#             "bloating",
#             "balloon",
#             "irregular",
#             "worried",
#             "stress",
#             "cravings",
#             "trouble",
#             "hard",
#             "difficulty",
#             "struggle",
#             "pain",
#             "aching",
#             "aging",
#             "lines",
#             "breakouts",
#             "fatigue",
#             "bloated",
#             "tight",
#             "pressure",
#             "tense",
#             "poor",
#             "very poor",
#             "very high",
#             "high pressure",
#             "sleepy",
#             "still tired",
#             "totally gone",
#             "gone",
#             "exhausted",
#             "hardly",
#         }
#         sensitive_fields = {
#             "weight",
#             "sleep",
#             "stress",
#             "energy",
#             "brain",
#             "stomach",
#             "intestines",
#             "skin",
#             "resistance",
#             "libido",
#             "hormones",
#             "hair",
#             "nails",
#             "fitness",
#             "concern",
#         }
#         is_sensitive = any(key in (field or "") for key in sensitive_fields)

#         # Strong positives
#         if any(token in text for token in positive):
#             if is_sensitive and text.strip() in {"yes", "yeah", "yep", "y"}:
#                 return "supportive"
#             return "celebrate"

#         # Explicit negatives or challenges
#         if any(token in text for token in supportive):
#             return "supportive"

#         # When unsure on sensitive topics, err on supportive
#         if is_sensitive:
#             return "supportive"

#         return "neutral"

#     def _parse_concerns(self, raw: str) -> list[str]:
#         """Parse a concern string into a list of canonical concern keys."""
#         if not raw:
#             return []
#         normalized = raw.lower()
#         normalized = normalized.replace("stomach and intestines", "stomach & intestines")
#         normalized = normalized.replace("hair and nails", "hair & nails")
#         normalized = normalized.replace("hair nails", "hair & nails")
#         normalized = re.sub(r"\s+/+\s*", ",", normalized)
#         normalized = normalized.replace(";", ",")
#         normalized = normalized.replace("|", ",")
#         normalized = re.sub(r"\s+and\s+", ",", normalized)
#         parts = [part.strip() for part in normalized.split(",") if part.strip()]

#         selections: list[str] = []
#         for part in parts:
#             if part in self.CONCERN_SYNONYMS:
#                 canonical = self.CONCERN_SYNONYMS[part]
#                 if canonical not in selections:
#                     selections.append(canonical)
#                 continue
#             # Fallback: match known synonyms inside the part
#             matches = self._extract_concern_tokens(part)
#             for token in matches:
#                 if token not in selections:
#                     selections.append(token)

#         if not selections:
#             selections = self._extract_concern_tokens(normalized)
#         return selections

#     def _extract_concern_tokens(self, text: str) -> list[str]:
#         """Find concern tokens inside text in order of appearance."""
#         if not text:
#             return []
#         pattern = r"\b(" + "|".join(
#             re.escape(key) for key in sorted(self.CONCERN_SYNONYMS.keys(), key=lambda k: len(k), reverse=True)
#         ) + r")\b"
#         matches = []
#         for match in re.finditer(pattern, text):
#             key = match.group(1)
#             canonical = self.CONCERN_SYNONYMS.get(key)
#             if canonical and canonical not in matches:
#                 matches.append(canonical)
#         return matches

#     def _normalize_concerns(self, raw_value) -> list[str]:
#         if isinstance(raw_value, list):
#             normalized = []
#             for item in raw_value:
#                 normalized.extend(self._parse_concerns(str(item)))
#             # Preserve order but dedupe
#             seen = set()
#             ordered = []
#             for item in normalized:
#                 if item not in seen:
#                     seen.add(item)
#                     ordered.append(item)
#             return ordered
#         if isinstance(raw_value, str):
#             return self._parse_concerns(raw_value)
#         return []

#     def _concern_followup_steps(self, concerns: list[str]) -> list[str]:
#         steps: list[str] = []
#         for concern in concerns:
#             question_set = self.CONCERN_QUESTIONS.get(concern, {})
#             for question in question_set.get("questions", []):
#                 steps.append(self._concern_field_key(concern, question["id"]))
#         return steps

#     @staticmethod
#     def _concern_field_key(concern: str, question_id: str) -> str:
#         return f"concern|{concern}|{question_id}"

#     @staticmethod
#     def _parse_concern_field(field: str) -> tuple[str, str] | None:
#         if not field.startswith("concern|"):
#             return None
#         parts = field.split("|", 2)
#         if len(parts) != 3:
#             return None
#         _, concern_key, question_id = parts
#         return concern_key, question_id

#     def _concern_prompt(self, concern_key: str, question_id: str, responses: dict | None = None) -> str:
#         label = self.CONCERN_QUESTIONS.get(concern_key, {}).get("label", concern_key.title())
#         question = self._question_by_key(concern_key, question_id, responses)
#         if not question:
#             return f"A quick one about {label}: can you share a short answer?"
#         return f"On {label}: {question}"

#     def _question_by_key(self, concern_key: str, question_id: str, responses: dict | None = None) -> str | None:
#         question_set = self.CONCERN_QUESTIONS.get(concern_key, {})
#         for question in question_set.get("questions", []):
#             if question["id"] == question_id:
#                 prompt = question["prompt"]
                
#                 # Personalize for family members
#                 if responses:
#                     labels = self._person_labels(responses)
#                     is_family = labels.get("is_family", False)
#                     relation = responses.get("relation", "")
#                     family_name = responses.get("family_name", "")
                    
#                     if is_family:
#                         # Build the reference phrase (e.g., "your son", "your daughter", or family name)
#                         if family_name:
#                             reference = family_name
#                             possessive_ref = f"{family_name}'s"
#                             pronoun = "they"  # Use "they" for name
#                         elif relation:
#                             reference = f"your {relation}"
#                             possessive_ref = f"your {relation}'s"
#                             # Determine pronoun based on relation
#                             relation_lower = relation.lower()
#                             if relation_lower in ["son", "brother", "father", "dad", "husband", "boyfriend"]:
#                                 pronoun = "he"
#                             elif relation_lower in ["daughter", "sister", "mother", "mom", "wife", "girlfriend"]:
#                                 pronoun = "she"
#                             else:
#                                 pronoun = "they"
#                         else:
#                             reference = "your family member"
#                             possessive_ref = "your family member's"
#                             pronoun = "they"
                        
#                         # Replace "you" with the reference (handling different cases)
#                         import re
                        
#                         # Pattern 1: "Do you" → "Does {reference}" (handles start and middle of sentence)
#                         prompt = re.sub(r'\bDo you\b', f'Does {reference}', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\bdo you\b', f'does {reference}', prompt, flags=re.IGNORECASE)
                        
#                         # Pattern 2: "When you" → "When {reference}"
#                         prompt = re.sub(r'\bWhen you\b', f'When {reference}', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\bwhen you\b', f'when {reference}', prompt, flags=re.IGNORECASE)
                        
#                         # Pattern 3: "How would you" → "How would {reference}"
#                         prompt = re.sub(r'\bHow would you\b', f'How would {reference}', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\bhow would you\b', f'how would {reference}', prompt, flags=re.IGNORECASE)
                        
#                         # Pattern 4: "Are you" → "Is {reference}"
#                         prompt = re.sub(r'\bAre you\b', f'Is {reference}', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\bare you\b', f'is {reference}', prompt, flags=re.IGNORECASE)
                        
#                         # Pattern 5: "What would you" → "What would {reference}"
#                         prompt = re.sub(r'\bWhat would you\b', f'What would {reference}', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\bwhat would you\b', f'what would {reference}', prompt, flags=re.IGNORECASE)
                        
#                         # Pattern 6: "On most nights, how many hours do you sleep" → "On most nights, how many hours does {reference} sleep"
#                         prompt = re.sub(r'\bhow many hours do you\b', f'how many hours does {reference}', prompt, flags=re.IGNORECASE)
                        
#                         # Pattern 7: Replace "your" with possessive when it refers to the family member's things
#                         # Common patterns: "your skin", "your hair", "your bowel", etc.
#                         common_attributes = ['skin', 'hair', 'nails', 'bowel', 'energy', 'resistance', 'libido', 
#                                             'cycle', 'period', 'mood', 'focus', 'memory', 'days', 'life', 
#                                             'periods', 'training', 'exercise', 'stomach', 'digestion']
#                         for attr in common_attributes:
#                             prompt = re.sub(rf'\byour {attr}\b', f'{possessive_ref} {attr}', prompt, flags=re.IGNORECASE)
                        
#                         # Pattern 8: Fix verb agreement
#                         # "When {reference} wake" → "When {reference} wakes"
#                         prompt = re.sub(rf'\bWhen {re.escape(reference)} wake\b', f'When {reference} wakes', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(rf'\bwhen {re.escape(reference)} wake\b', f'when {reference} wakes', prompt, flags=re.IGNORECASE)
                        
#                         # Pattern 9: Replace remaining "you" with pronoun or reference
#                         prompt = re.sub(r'\byou feel\b', f'{pronoun} feel', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\byou usually\b', f'{reference} usually', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\byou notice\b', f'{reference} notice', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\byou experience\b', f'{reference} experience', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\byou sleep\b', f'{reference} sleeps', prompt, flags=re.IGNORECASE)
#                         prompt = re.sub(r'\byou want\b', f'{reference} wants', prompt, flags=re.IGNORECASE)
                
#                 # Make weight challenge question gender-aware
#                 if concern_key == "weight" and question_id == "challenge":
#                     gender = (responses or {}).get("gender", "").lower() if responses else ""
#                     # Only include pregnancy option for women
#                     if gender in ["woman", "female"]:
#                         # Add pregnancy option for women (before "or none")
#                         if "pregnancy" not in prompt.lower():
#                             prompt = prompt.replace(", or none", ", pregnancy, or none")
#                     else:
#                         # Remove pregnancy option for men/non-women (in case it was added)
#                         prompt = prompt.replace(", pregnancy", "").replace("pregnancy, ", "")
                
#                 return prompt
#         return None

#     def _save_response(self, field: str, normalized, responses: dict) -> None:
#         if field == "concern":
#             responses[field] = self._normalize_concerns(normalized)
#             return
#         parsed_concern = self._parse_concern_field(field)
#         if parsed_concern:
#             concern_key, question_id = parsed_concern
#             details = responses.setdefault("concern_details", {})
#             concern_bucket = details.setdefault(concern_key, {})
#             concern_bucket[question_id] = normalized
#             return
#         responses[field] = normalized

#     async def _format_product_recommendations(
#         self, products: list, context: dict, product_documents: dict[str, dict] | None = None,
#         previous_concern_resolved: bool | None = None, previous_concerns: list[str] | None = None,
#         previous_products: list[str] | None = None
#     ) -> str:
#         """
#         Format product recommendations with clear explanations of why each product is suggested.
#         Includes product name, detailed explanation based on user concerns and context, and context-aware safety warnings.
        
#         Args:
#             products: List of recommended products
#             context: User context and responses
#             product_documents: Raw product documents from MongoDB
#             previous_concern_resolved: Whether previous concerns were resolved (None if not asked)
#             previous_concerns: List of previous concerns that were repeated
#         """
#         if not products:
#             return "No products found matching your profile."
        
#         # Get user context for explanations
#         concerns = self._normalize_concerns(context.get("concern", []))
#         concern_details = context.get("concern_details", {})
#         medical_treatment = (context.get("medical_treatment") or "").lower() == "yes"
        
#         # Build recommendation text
#         recommendations = []
        
#         # Add medical treatment disclaimer at the start if applicable
#         intro_text = ""
#         if medical_treatment:
#             intro_text = (
#                 "IMPORTANT: Since you mentioned you're currently undergoing medical treatment, "
#                 "please consult with your healthcare provider before starting any new supplements. "
#                 "The following recommendations are based on your profile, but medical guidance is essential.\n\n"
#             )
        
#         # Add message if Ayurveda products are excluded due to user's views
#         ayurveda_view = (context.get("ayurveda_view") or "").lower()
#         exclude_ayurveda_views = [
#             "more information needed for an opinion",
#             "i am skeptical",
#             "alternative medicine is nonsense"
#         ]
#         if ayurveda_view in exclude_ayurveda_views:
#             ayurveda_message = (
#                 "Note: Since you have said you do not prefer Ayurveda, I am not recommending Ayurveda medicine.\n\n"
#             )
#             intro_text = ayurveda_message + intro_text if intro_text else ayurveda_message
        
#         # Add strong doctor recommendation if previous concerns were not resolved
#         if previous_concern_resolved is False and previous_concerns:
#             concerns_text = ", ".join([c.replace("_", " ").title() for c in previous_concerns])
#             doctor_warning = (
#                 f"\n\n⚠️ STRONG MEDICAL ADVISORY: Since you mentioned that having taken the previous recommended products, "
#                 f"your concerns about {concerns_text} have not been resolved, I STRONGLY recommend that you visit a healthcare provider "
#                 f"or doctor for a proper medical evaluation. Persistent health issues may require professional medical attention "
#                 f"beyond what supplements can address. Please consult with a healthcare professional before continuing with any new supplements.\n\n"
#             )
#             intro_text = doctor_warning + intro_text if intro_text else doctor_warning
        
#         # Add brief problem summary (2-3 lines) based on user's concerns and answers
#         # Pass actual product count to make summary dynamic
#         actual_product_count = len(products)
#         problem_summary = self._build_problem_summary(concerns, concern_details, context, actual_product_count)
#         if problem_summary:
#             intro_text += problem_summary + "\n\n"
        
#         previous_products_set = set((previous_products or []))
        
#         # Use all products (up to 3 max) - don't force exactly 3
#         for product in products[:3]:  # Max 3, but can be fewer
#             product_name = product.title
#             is_previous_product = product_name in previous_products_set
            
#             # Build detailed explanation based on user context
#             # Pass None for product_json since MongoDB products don't have the same structure
#             explanation = self._build_product_explanation(product, None, concerns, concern_details, context)
            
#             # Get the full MongoDB product document for safety analysis
#             product_doc = {}
#             if product_documents and product_name in product_documents:
#                 product_doc = product_documents[product_name]
#             else:
#                 # Fallback: try to fetch if not provided
#                 product_doc = await self._get_product_document_by_title(product_name)
            
#             # Get context-aware safety warnings with auto-detection
#             warnings = self.product_service.get_safety_warnings(product_doc, context)
            
#             # Format product recommendation
#             product_text = f"{product_name}\n{explanation}"
            
#             # Add warnings if any
#             if warnings:
#                 product_text += "\n" + "\n".join([f"Note: {w}" for w in warnings])
            
#             # Add caution note if this is a previously recommended product that didn't resolve the issue
#             if is_previous_product and previous_concern_resolved is False:
#                 product_text += "\n⚠️ CAUTION: This product was previously recommended but the issue persists. Please consult with a healthcare provider before continuing."
            
#             # Add extra medical disclaimer for each product if user is under medical treatment
#             if medical_treatment:
#                 product_text += "\n⚠️ Medical Advisory: Please consult with your healthcare provider before starting this supplement."
            
#             recommendations.append(product_text)
        
#         # Join all recommendations with intro text
#         return intro_text + "\n\n".join(recommendations)
    
#     def _build_product_explanation(
#         self, product, product_json: dict | None, concerns: list[str], 
#         concern_details: dict, context: dict
#     ) -> str:
#         """Build a detailed explanation of why this product is recommended."""
#         explanation_parts = []
#         explanation_parts = []
#         # Get product information from Product object (MongoDB)
#         product_text = self._get_product_text_for_explanation(product, product_json)
#         key_benefits = product.benefits or []
        
#         # Extract ingredient name from product title
#         # For MongoDB products, the title typically contains the main ingredient
#         ingredient_name = product.title
#         # Try to extract first part of title (before any "+" or "Complex" etc.)
#         if " + " in ingredient_name:
#             ingredient_name = ingredient_name.split(" + ")[0]
#         elif " Complex" in ingredient_name:
#             ingredient_name = ingredient_name.replace(" Complex", "")
        
#         # Build explanation based on user's concerns and what they mentioned
#         user_concerns_text = []
#         relevant_benefits = []
        
#         for concern in concerns:
#             concern_label = self.CONCERN_QUESTIONS.get(concern, {}).get("label", concern.replace("_", " ").title())
#             concern_keywords = self.product_service.CONCERN_TO_KEYWORDS.get(concern, [])
            
#             # Check if product addresses this concern
#             if any(keyword in product_text.lower() for keyword in concern_keywords):
#                 user_concerns_text.append(concern_label.lower())
                
#                 # Find specific benefits that match this concern
#                 for benefit in key_benefits:
#                     benefit_lower = benefit.lower()
#                     if any(keyword in benefit_lower for keyword in concern_keywords):
#                         if benefit not in relevant_benefits:
#                             relevant_benefits.append(benefit)
        
#         # Build the explanation sentence with better grammar and varied phrasing
#         if user_concerns_text and relevant_benefits:
#             # Format concerns properly (e.g., "brain" -> "brain concerns", "sleep" -> "sleep issues")
#             concerns_phrases = []
#             for concern in user_concerns_text:
#                 if concern in ["brain", "sleep", "stress", "energy", "weight", "skin"]:
#                     concerns_phrases.append(f"{concern} concerns")
#                 elif concern in ["stomach & intestines", "stomach_intestines"]:
#                     concerns_phrases.append("digestive concerns")
#                 elif concern == "hair & nails" or concern == "hair_nails":
#                     concerns_phrases.append("hair and nail concerns")
#                 else:
#                     concerns_phrases.append(concern)
            
#             concerns_phrase = ", ".join(concerns_phrases)
#             # Get 1-2 most relevant benefits, but vary the phrasing
#             top_benefits = relevant_benefits[:2]
#             if len(top_benefits) == 2:
#                 benefits_phrase = f"{top_benefits[0].lower().rstrip('.')} and {top_benefits[1].lower().rstrip('.')}"
#             else:
#                 benefits_phrase = top_benefits[0].lower().rstrip(".")
            
#             # Vary the explanation phrasing to avoid repetition
#             # Fix grammar: ensure benefits_phrase works with "can" (use base form) or use "which/that" instead
#             # Convert benefits to base form if it starts with a verb (e.g., "promotes" -> "promote")
#             benefits_base = benefits_phrase
#             if benefits_phrase.split()[0].endswith('s') and len(benefits_phrase.split()[0]) > 3:
#                 # Likely a third-person verb, convert to base form for "can"
#                 first_word = benefits_phrase.split()[0]
#                 if first_word.endswith('s') and not first_word.endswith('ss'):
#                     benefits_base = benefits_phrase.replace(first_word, first_word[:-1], 1)
            
#             explanation_variants = [
#                 f"This product may help address your {concerns_phrase} through {ingredient_name}, which {benefits_phrase}.",
#                 f"Based on your {concerns_phrase}, {ingredient_name} in this product can {benefits_base}.",
#                 f"For your {concerns_phrase}, this product offers {ingredient_name} that {benefits_phrase}."
#             ]
#             # Use a simple hash of product name to pick variant (consistent per product)
#             variant_idx = hash(product.title) % len(explanation_variants)
#             explanation = explanation_variants[variant_idx]
#         elif user_concerns_text:
#             # Format concerns properly
#             concerns_phrases = []
#             for concern in user_concerns_text:
#                 if concern in ["brain", "sleep", "stress", "energy", "weight", "skin"]:
#                     concerns_phrases.append(f"{concern} concerns")
#                 elif concern in ["stomach & intestines", "stomach_intestines"]:
#                     concerns_phrases.append("digestive concerns")
#                 elif concern == "hair & nails" or concern == "hair_nails":
#                     concerns_phrases.append("hair and nail concerns")
#                 else:
#                     concerns_phrases.append(concern)
            
#             concerns_phrase = ", ".join(concerns_phrases)
#             # Fallback to general benefits
#             if key_benefits:
#                 top_benefit = key_benefits[0].lower().rstrip(".")
#                 explanation_variants = [
#                     f"This product may support your {concerns_phrase} with {ingredient_name} that {top_benefit}.",
#                     f"For your {concerns_phrase}, this product contains {ingredient_name} which {top_benefit}.",
#                     f"Addressing your {concerns_phrase}, this product includes {ingredient_name} that {top_benefit}."
#                 ]
#                 variant_idx = hash(product.title) % len(explanation_variants)
#                 explanation = explanation_variants[variant_idx]
#             else:
#                 explanation = (
#                     f"This product may be beneficial for your {concerns_phrase} as it contains {ingredient_name} "
#                     f"that supports these areas."
#                 )
#         elif key_benefits:
#             # No specific concerns matched, but we have benefits
#             top_benefit = key_benefits[0].lower().rstrip(".")
#             explanation = (
#                 f"This product contains {ingredient_name} that {top_benefit}, "
#                 f"which may be relevant for your wellness goals."
#             )
#         else:
#             # Fallback
#             explanation = (
#                 f"This product contains {ingredient_name} that may be beneficial "
#                 f"based on your profile and health goals."
#             )
        
#         return explanation
    
#     def _get_product_text_for_explanation(self, product, product_json: dict | None) -> str:
#         """Get searchable text from product for explanation matching."""
#         text_parts = []
        
#         if product.description:
#             text_parts.append(product.description)
        
#         if product.benefits:
#             text_parts.extend(product.benefits)
        
#         if product.health_goals:
#             text_parts.extend(product.health_goals)
        
#         if product_json:
#             # Handle multilingual fields from MongoDB
#             if product_json.get("description"):
#                 desc = product_json["description"]
#                 if isinstance(desc, dict):
#                     text_parts.append(desc.get("en", desc.get(list(desc.keys())[0] if desc else "", "")))
#                 elif isinstance(desc, str):
#                     text_parts.append(desc)
#             if product_json.get("benefits"):
#                 text_parts.extend(product_json["benefits"])
#             if product_json.get("ingredients"):
#                 text_parts.extend(product_json["ingredients"])
        
#         return " ".join(text_parts)
    
#     def _build_problem_summary(self, concerns: list[str], concern_details: dict, context: dict, product_count: int = 3) -> str:
#         """
#         Build a brief 2-3 line summary of the problems the quiz bot noticed based on user's answers.
        
#         Args:
#             concerns: List of normalized concern keys (e.g., ["brain", "sleep"])
#             concern_details: Dictionary of concern details with follow-up answers
#             context: Full user context including all responses
#             product_count: Actual number of products being recommended (1-3)
        
#         Returns:
#             A 2-3 line summary string, or empty string if no concerns
#         """
#         if not concerns:
#             return ""
        
#         # Get concern labels
#         concern_labels = []
#         for concern in concerns:
#             label = self.CONCERN_QUESTIONS.get(concern, {}).get("label", concern.replace("_", " ").title())
#             concern_labels.append(label)
        
#         # Build summary based on concerns and key details
#         summary_parts = []
        
#         # Primary concern statement
#         if len(concern_labels) == 1:
#             primary_concern = concern_labels[0]
#             summary_parts.append(f"Based on your responses, I've noticed you're experiencing {primary_concern.lower()} concerns.")
#         else:
#             concerns_text = ", ".join(concern_labels[:-1]) + f" and {concern_labels[-1]}"
#             summary_parts.append(f"Based on your responses, I've identified concerns related to {concerns_text.lower()}.")
        
#         # Add specific details if available
#         specific_details = []
        
#         # Check for specific concern details that provide context
#         for concern in concerns:
#             concern_data = concern_details.get(concern, {})
#             if concern == "brain" and concern_data.get("symptoms"):
#                 symptoms = concern_data.get("symptoms", "").lower()
#                 if "difficulty focusing" in symptoms or "focus" in symptoms:
#                     specific_details.append("difficulty with focus and concentration")
#                 elif "forgetfulness" in symptoms or "memory" in symptoms:
#                     specific_details.append("memory-related challenges")
#                 elif "trouble finding words" in symptoms:
#                     specific_details.append("cognitive challenges")
#             elif concern == "sleep" and concern_data.get("fall_asleep"):
#                 if "yes" in concern_data.get("fall_asleep", "").lower() or "hard" in concern_data.get("fall_asleep", "").lower():
#                     specific_details.append("trouble falling asleep")
#             elif concern == "stress" and concern_data.get("busy_level"):
#                 busy = concern_data.get("busy_level", "").lower()
#                 if "a lot" in busy or "very" in busy:
#                     specific_details.append("high levels of daily stress")
#             elif concern == "energy" and concern_data.get("end_day"):
#                 if "gone" in concern_data.get("end_day", "").lower() or "tired" in concern_data.get("end_day", "").lower():
#                     specific_details.append("low energy levels by end of day")
        
#         # Build second line with specific details or general statement
#         if specific_details:
#             details_text = ", ".join(specific_details[:2])  # Max 2 details
#             summary_parts.append(f"Specifically, you mentioned {details_text}.")
#         else:
#             # Generic supportive statement
#             summary_parts.append("These are common concerns that can often be supported with targeted nutritional supplements.")
        
#         # Third line - transition to recommendations (dynamic based on actual product count)
#         if product_count == 1:
#             summary_parts.append("Here is a product that may help address these areas:")
#         elif product_count == 2:
#             summary_parts.append("Here are two products that may help address these areas:")
#         else:
#             summary_parts.append("Here are three products that may help address these areas:")
        
#         return "\n".join(summary_parts)
    
#     async def _get_product_document_by_title(self, product_title: str) -> dict:
#         """Get full MongoDB product document by title for safety analysis."""
#         try:
#             # Search for the product in MongoDB
#             products = await self.product_service.repository.search(
#                 message_terms=[product_title.split()[0]] if product_title else [],  # Use first word of title
#                 health_goals=[],
#                 limit=10
#             )
            
#             # Find exact match by title
#             for product in products:
#                 title_obj = product.get("title", {})
#                 if isinstance(title_obj, dict):
#                     title = title_obj.get("en", title_obj.get(list(title_obj.keys())[0] if title_obj else "", ""))
#                 elif isinstance(title_obj, str):
#                     title = title_obj
#                 else:
#                     title = ""
                
#                 if title.lower() == product_title.lower():
#                     return product
            
#             # If no exact match, return first product or empty dict
#             return products[0] if products else {}
#         except Exception:
#             return {}
    
#     def _get_question_options(self, field: str) -> tuple[list[QuestionOption] | None, str | None]:
#         """
#         Extract available options for a question field.
#         Returns tuple of (options_list, question_type).
#         """
#         # Yes/No questions
#         yes_no_fields = {
#             "protein", "conceive", "children", "drinks_alcohol", "alcohol_daily",
#             "alcohol_weekly", "coffee_intake", "smokes", "sunlight_exposure",
#             "iron_advised", "medical_treatment"
#         }
        
#         if field in yes_no_fields:
#             return [
#                 QuestionOption(value="yes", label="Yes"),
#                 QuestionOption(value="no", label="No"),
#             ], "yes_no"
        
#         # Option-based questions
#         if field == "for_whom":
#             return [
#                 QuestionOption(value="me", label="Me"),
#                 QuestionOption(value="family", label="Family"),
#             ], "options"
        
#         if field == "gender":
#             return [
#                 QuestionOption(value="male", label="Male"),
#                 QuestionOption(value="woman", label="Woman"),
#                 QuestionOption(value="gender neutral", label="Gender Neutral"),
#             ], "options"
        
#         if field == "knowledge":
#             return [
#                 QuestionOption(value="well informed", label="Well informed"),
#                 QuestionOption(value="curious", label="Curious"),
#                 QuestionOption(value="skeptical", label="Skeptical"),
#             ], "options"
        
#         if field == "vitamin_count":
#             return [
#                 QuestionOption(value="no", label="No"),
#                 QuestionOption(value="1 to 3", label="1 to 3"),
#                 QuestionOption(value="4+", label="4+"),
#             ], "options"
        
#         if field == "situation":
#             return [
#                 QuestionOption(value="to get pregnant in the next 2 years", label="To get pregnant in the next 2 years"),
#                 QuestionOption(value="i am pregnant now", label="I am pregnant now"),
#                 QuestionOption(value="breastfeeding", label="Breastfeeding"),
#             ], "options"
        
#         if field == "concern":
#             return [
#                 QuestionOption(value="sleep", label="Sleep"),
#                 QuestionOption(value="stress", label="Stress"),
#                 QuestionOption(value="energy", label="Energy"),
#                 QuestionOption(value="stomach_intestines", label="Stomach & Intestines"),
#                 QuestionOption(value="skin", label="Skin"),
#                 QuestionOption(value="resistance", label="Resistance"),
#                 QuestionOption(value="weight", label="Weight"),
#                 QuestionOption(value="hormones", label="Hormones"),
#                 QuestionOption(value="libido", label="Libido"),
#                 QuestionOption(value="brain", label="Brain"),
#                 QuestionOption(value="hair_nails", label="Hair & Nails"),
#                 QuestionOption(value="fitness", label="Fitness"),
#             ], "options"
        
#         if field == "lifestyle_status":
#             return [
#                 QuestionOption(value="been doing well for a long time", label="Been doing well for a long time"),
#                 QuestionOption(value="nice on the way", label="Nice on the way"),
#                 QuestionOption(value="ready to start", label="Ready to start"),
#             ], "options"
        
#         if field in {"fruit_intake", "vegetable_intake", "dairy_intake", "fiber_intake", "protein_intake"}:
#             return [
#                 QuestionOption(value="hardly", label="Hardly"),
#                 QuestionOption(value="one time", label="One time"),
#                 QuestionOption(value="twice or more", label="Twice or more"),
#             ], "options"
        
#         if field == "eating_habits":
#             return [
#                 QuestionOption(value="no preference", label="No preference"),
#                 QuestionOption(value="flexitarian", label="Flexitarian"),
#                 QuestionOption(value="vegetarian", label="Vegetarian"),
#                 QuestionOption(value="vegan", label="Vegan"),
#             ], "options"
        
#         if field in {"meat_intake", "fish_intake"}:
#             return [
#                 QuestionOption(value="never", label="Never"),
#                 QuestionOption(value="once or twice", label="Once or twice"),
#                 QuestionOption(value="three times or more", label="Three times or more"),
#             ], "options"
        
#         if field == "allergies":
#             return [
#                 QuestionOption(value="no", label="No"),
#                 QuestionOption(value="milk", label="Milk"),
#                 QuestionOption(value="egg", label="Egg"),
#                 QuestionOption(value="fish", label="Fish"),
#                 QuestionOption(value="shellfish and crustaceans", label="Shellfish and crustaceans"),
#                 QuestionOption(value="peanut", label="Peanut"),
#                 QuestionOption(value="nuts", label="Nuts"),
#                 QuestionOption(value="soy", label="Soy"),
#                 QuestionOption(value="gluten", label="Gluten"),
#                 QuestionOption(value="wheat", label="Wheat"),
#                 QuestionOption(value="pollen", label="Pollen"),
#             ], "options"
        
#         if field == "dietary_preferences":
#             return [
#                 QuestionOption(value="no preference", label="No preference"),
#                 QuestionOption(value="lactose-free", label="Lactose-free"),
#                 QuestionOption(value="gluten free", label="Gluten free"),
#                 QuestionOption(value="paleo", label="Paleo"),
#             ], "options"
        
#         if field == "ayurveda_view":
#             return [
#                 QuestionOption(value="i am convinced", label="I am convinced"),
#                 QuestionOption(value="we can learn a lot from ancient medicine", label="We can learn a lot from ancient medicine"),
#                 QuestionOption(value="i am open to it", label="I am open to it"),
#                 QuestionOption(value="more information needed for an opinion", label="More information needed for an opinion"),
#                 QuestionOption(value="i am skeptical", label="I am skeptical"),
#                 QuestionOption(value="alternative medicine is nonsense", label="Alternative medicine is nonsense"),
#             ], "options"
        
#         if field == "new_product_attitude":
#             return [
#                 QuestionOption(value="to be the first", label="To be the first"),
#                 QuestionOption(value="you are at the forefront of new products", label="You are at the forefront of new products"),
#                 QuestionOption(value="learn more", label="Learn more"),
#                 QuestionOption(value="you are cautiously optimistic", label="You are cautiously optimistic"),
#                 QuestionOption(value="waiting for now", label="Waiting for now"),
#                 QuestionOption(value="scientific research takes time", label="Scientific research takes time"),
#             ], "options"
        
#         # Concern follow-up questions with options
#         if field.startswith("concern|"):
#             concern_detail = self._parse_concern_field(field)
#             if concern_detail:
#                 concern_key, question_id = concern_detail
                
#                 # Sleep concern questions
#                 if concern_key == "sleep":
#                     if question_id == "fall_asleep":
#                         return [
#                             QuestionOption(value="yes", label="Yes"),
#                             QuestionOption(value="no", label="No"),
#                         ], "yes_no"
#                     if question_id == "refreshed":
#                         return [
#                             QuestionOption(value="refreshed", label="Refreshed"),
#                             QuestionOption(value="still tired", label="Still tired"),
#                         ], "options"
#                     if question_id == "hours":
#                         return [
#                             QuestionOption(value="7+ hours", label="7+ hours"),
#                             QuestionOption(value="less than 7", label="Less than 7"),
#                             QuestionOption(value="less than 5", label="Less than 5"),
#                         ], "options"
                
#                 # Stress concern questions
#                 if concern_key == "stress":
#                     if question_id == "busy_level":
#                         return [
#                             QuestionOption(value="few things", label="Few things"),
#                             QuestionOption(value="normal", label="Normal"),
#                             QuestionOption(value="a lot", label="A lot"),
#                         ], "options"
#                     if question_id == "after_day":
#                         return [
#                             QuestionOption(value="energized", label="Energized"),
#                             QuestionOption(value="completely drained", label="Completely drained"),
#                         ], "options"
#                     if question_id == "signals":
#                         return [
#                             QuestionOption(value="faster breathing", label="Faster breathing"),
#                             QuestionOption(value="tense muscles", label="Tense muscles"),
#                             QuestionOption(value="trouble sleeping", label="Trouble sleeping"),
#                             QuestionOption(value="sensitive stomach", label="Sensitive stomach"),
#                             QuestionOption(value="head pressure", label="Head pressure"),
#                             QuestionOption(value="fast heartbeat", label="Fast heartbeat"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
                
#                 # Energy concern questions
#                 if concern_key == "energy":
#                     if question_id == "day_load":
#                         return [
#                             QuestionOption(value="very full", label="Very full"),
#                             QuestionOption(value="moderate", label="Moderate"),
#                             QuestionOption(value="not very full", label="Not very full"),
#                         ], "options"
#                     if question_id == "end_day":
#                         return [
#                             QuestionOption(value="still there", label="Still there"),
#                             QuestionOption(value="totally gone", label="Totally gone"),
#                         ], "options"
#                     if question_id == "body_signals":
#                         return [
#                             QuestionOption(value="tired", label="Tired"),
#                             QuestionOption(value="sleepy", label="Sleepy"),
#                             QuestionOption(value="low energy", label="Low energy"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
                
#                 # Stomach & Intestines concern questions
#                 if concern_key == "stomach_intestines":
#                     if question_id == "bowel":
#                         return [
#                             QuestionOption(value="less than once", label="Less than once"),
#                             QuestionOption(value="about once", label="About once"),
#                             QuestionOption(value="more than once", label="More than once"),
#                             QuestionOption(value="irregular", label="Irregular"),
#                         ], "options"
#                     if question_id == "improve":
#                         return [
#                             QuestionOption(value="gas & bloating", label="Gas & bloating"),
#                             QuestionOption(value="that 'balloon' feeling", label="That 'balloon' feeling"),
#                             QuestionOption(value="letting go easily", label="Letting go easily"),
#                             QuestionOption(value="overall digestion", label="Overall digestion"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
                
#                 # Skin concern questions
#                 if concern_key == "skin":
#                     if question_id == "most_days":
#                         return [
#                             QuestionOption(value="pulling", label="Pulling"),
#                             QuestionOption(value="shiny", label="Shiny"),
#                             QuestionOption(value="sensitive", label="Sensitive"),
#                             QuestionOption(value="dull", label="Dull"),
#                             QuestionOption(value="pretty good", label="Pretty good"),
#                         ], "options"
#                     if question_id == "notices":
#                         return [
#                             QuestionOption(value="pimples", label="Pimples"),
#                             QuestionOption(value="discoloration", label="Discoloration"),
#                             QuestionOption(value="lines", label="Lines"),
#                             QuestionOption(value="less elasticity", label="Less elasticity"),
#                             QuestionOption(value="aging", label="Aging"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
#                     if question_id == "dry":
#                         return [
#                             QuestionOption(value="yes", label="Yes"),
#                             QuestionOption(value="no", label="No"),
#                         ], "yes_no"
                
#                 # Resistance concern questions
#                 if concern_key == "resistance":
#                     if question_id in ["low", "intense_training", "medical_care"]:
#                         return [
#                             QuestionOption(value="yes", label="Yes"),
#                             QuestionOption(value="no", label="No"),
#                         ], "yes_no"
                
#                 # Weight concern questions
#                 if concern_key == "weight":
#                     if question_id == "challenge":
#                         return [
#                             QuestionOption(value="movement", label="Movement"),
#                             QuestionOption(value="exercise", label="Exercise"),
#                             QuestionOption(value="nutrition", label="Nutrition"),
#                             QuestionOption(value="discipline", label="Discipline"),
#                             QuestionOption(value="knowledge", label="Knowledge"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
#                     if question_id in ["binge", "sleep_hours"]:
#                         return [
#                             QuestionOption(value="yes", label="Yes"),
#                             QuestionOption(value="no", label="No"),
#                         ], "yes_no"
                
#                 # Hormones concern questions
#                 if concern_key == "hormones":
#                     if question_id == "cycle":
#                         return [
#                             QuestionOption(value="regular", label="Regular"),
#                             QuestionOption(value="irregular", label="Irregular"),
#                             QuestionOption(value="very irregular", label="Very irregular"),
#                         ], "options"
#                     if question_id == "physical_changes":
#                         return [
#                             QuestionOption(value="yes", label="Yes"),
#                             QuestionOption(value="no", label="No"),
#                         ], "yes_no"
#                     if question_id == "emotions":
#                         return [
#                             QuestionOption(value="moody", label="Moody"),
#                             QuestionOption(value="irritable", label="Irritable"),
#                             QuestionOption(value="sad", label="Sad"),
#                             QuestionOption(value="anxious", label="Anxious"),
#                             QuestionOption(value="fine", label="Fine"),
#                         ], "options"
                
#                 # Libido concern questions
#                 if concern_key == "libido":
#                     if question_id == "level":
#                         return [
#                             QuestionOption(value="low", label="Low"),
#                             QuestionOption(value="average", label="Average"),
#                             QuestionOption(value="high", label="High"),
#                         ], "options"
#                     if question_id == "sleep_quality":
#                         return [
#                             QuestionOption(value="excellent", label="Excellent"),
#                             QuestionOption(value="good", label="Good"),
#                             QuestionOption(value="fair", label="Fair"),
#                             QuestionOption(value="poor", label="Poor"),
#                         ], "options"
#                     if question_id == "pressure":
#                         return [
#                             QuestionOption(value="a lot", label="A lot"),
#                             QuestionOption(value="some", label="Some"),
#                             QuestionOption(value="little", label="Little"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
                
#                 # Brain concern questions
#                 if concern_key == "brain":
#                     if question_id == "symptoms":
#                         return [
#                             QuestionOption(value="difficulty focusing", label="Difficulty focusing"),
#                             QuestionOption(value="forgetfulness", label="Forgetfulness"),
#                             QuestionOption(value="trouble finding words", label="Trouble finding words"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
#                     if question_id == "mood":
#                         return [
#                             QuestionOption(value="yes", label="Yes"),
#                             QuestionOption(value="no", label="No"),
#                         ], "yes_no"
#                     if question_id == "improve":
#                         return [
#                             QuestionOption(value="focus", label="Focus"),
#                             QuestionOption(value="memory", label="Memory"),
#                             QuestionOption(value="mental fitness", label="Mental fitness"),
#                             QuestionOption(value="staying sharp", label="Staying sharp"),
#                         ], "options"
                
#                 # Hair & Nails concern questions
#                 if concern_key == "hair_nails":
#                     if question_id == "hair":
#                         return [
#                             QuestionOption(value="dry", label="Dry"),
#                             QuestionOption(value="thin", label="Thin"),
#                             QuestionOption(value="split ends", label="Split ends"),
#                             QuestionOption(value="won't grow long", label="Won't grow long"),
#                             QuestionOption(value="could be fuller", label="Could be fuller"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
#                     if question_id == "nails":
#                         return [
#                             QuestionOption(value="strength", label="Strength"),
#                             QuestionOption(value="length", label="Length"),
#                             QuestionOption(value="condition", label="Condition"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
                
#                 # Fitness concern questions
#                 if concern_key == "fitness":
#                     if question_id == "frequency":
#                         return [
#                             QuestionOption(value="daily", label="Daily"),
#                             QuestionOption(value="3-5 times a week", label="3-5 times a week"),
#                             QuestionOption(value="1-2 times a week", label="1-2 times a week"),
#                             QuestionOption(value="rarely", label="Rarely"),
#                             QuestionOption(value="never", label="Never"),
#                         ], "options"
#                     if question_id == "training":
#                         return [
#                             QuestionOption(value="strength", label="Strength"),
#                             QuestionOption(value="cardio", label="Cardio"),
#                             QuestionOption(value="hiit", label="HIIT"),
#                             QuestionOption(value="flexibility", label="Flexibility"),
#                             QuestionOption(value="none", label="None"),
#                         ], "options"
#                     if question_id == "priority":
#                         return [
#                             QuestionOption(value="performance", label="Performance"),
#                             QuestionOption(value="sweating", label="Sweating"),
#                             QuestionOption(value="muscle", label="Muscle"),
#                             QuestionOption(value="health", label="Health"),
#                         ], "options"
        
#         # Text input questions (name, email, age, etc.)
#         text_fields = {"name", "family_name", "relation", "age", "email"}
#         if field in text_fields:
#             return None, "text"
        
#         # Default: no options (free text)
#         return None, "text"
    
#     async def generate_session_name(self, concern: str, session_id: str | None = None, user_id: str | None = None) -> str:
#         """
#         Generate a creative session name based on the user's concern using OpenAI.
#         Returns a unique, creative name like "Stress concerns supplements" or similar.
        
#         Args:
#             concern: The user's health concern
#             session_id: Optional session ID to store token usage
#             user_id: Optional user ID to store token usage
#         """
#         try:
#             system_prompt = (
#                 "You are a helpful assistant that creates creative, concise session names for wellness conversations. "
#                 "Generate a short, descriptive session name (2-5 words) based on the user's health concern. "
#                 "Make it natural and conversational, like ChatGPT session names. "
#                 "Examples: 'Stress relief supplements', 'Sleep support journey', 'Energy boost plan', 'Gut health solutions'. "
#                 "Return ONLY the session name, nothing else. Keep it under 40 characters."
#             )
            
#             user_message = f"Create a creative session name for a user with this concern: {concern}"
            
#             reply_text, usage_info = await self.ai_service.generate_reply(
#                 system_prompt=system_prompt,
#                 history=[],
#                 user_message=user_message,
#                 context=None,
#                 products=None,
#             )
            
#             # Store token usage if session_id is provided
#             if session_id and usage_info and usage_info.get("input_tokens", 0) > 0:
#                 try:
#                     await self._update_session_token_usage(session_id, usage_info, user_id)
#                 except Exception as e:
#                     import logging
#                     logging.warning(f"Failed to store token usage for session name generation: {e}")
            
#             # Clean up the response - remove quotes, extra whitespace, etc.
#             session_name = reply_text.strip().strip('"').strip("'").strip()
            
#             # Fallback if OpenAI returns something too long or empty
#             if not session_name or len(session_name) > 50:
#                 # Use a simple fallback format
#                 concern_label = concern.replace("_", " ").title()
#                 session_name = f"{concern_label} Support"
            
#             return session_name
#         except Exception as e:
#             # Fallback to simple format if OpenAI fails
#             import logging
#             logging.warning(f"Failed to generate session name with OpenAI: {e}")
#             concern_label = concern.replace("_", " ").title()
#             return f"{concern_label} Support"
    
#     async def get_first_question(self, session_id: str) -> ChatResponse:
#         """
#         Get the first question from the bot without requiring a user message.
#         Initializes the onboarding flow and returns the first question.
        
#         This is useful when you want to display the first question immediately
#         after creating a session, without sending a trigger message.
#         """
#         # Try without user_id first (legacy), then with user_id if found
#         session = await self.session_repo.get(session_id)
#         if not session:
#             raise SessionNotFoundError(f"Session {session_id} not found.")
        
#         # If session found but no messages, try with user_id from metadata
#         user_id = self._get_user_id_from_session(session)
#         if user_id and not session.messages:
#             # Retry with user_id
#             session = await self.session_repo.get(session_id, user_id=user_id)
#             if not session:
#                 raise SessionNotFoundError(f"Session {session_id} not found.")
        
#         onboarding_state = self._get_onboarding_state(session)
        
#         # Check if onboarding is already complete
#         if onboarding_state.get("complete"):
#             # Return a message indicating onboarding is complete
#             return ChatResponse(
#                 session_id=session_id,
#                 reply=ChatMessage(
#                     role="assistant",
#                     content="You have already completed the onboarding. Your recommendations have been provided."
#                 ),
#                 options=None,
#                 question_type=None,
#                 isRegistered=self._get_is_registered_from_session(session),
#             )
        
#         # Check if first question was already asked (session has messages)
#         if len(session.messages) > 0:
#             # Get the current question instead
#             return await self._get_current_question_response(session_id, session, onboarding_state)
        
#         # Initialize onboarding and get first question
#         has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)
#         ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
        
#         if not ordered_steps:
#             raise ValueError("No onboarding steps available")
        
#         first_field = ordered_steps[0]
#         first_prompt = self._build_prompt(field=first_field, responses=onboarding_state["responses"])
        
#         # Build the first question with friendly greeting
#         question_content = self._friendly_question(
#             prompt=first_prompt,
#             step=0,
#             prev_answer=None,
#             prev_field=None,
#             responses=onboarding_state.get("responses", {}),
#         )
        
#         # Create the first question reply
#         first_reply = ChatMessage(role="assistant", content=question_content)
        
#         # Get options for the first question
#         options, question_type = self._get_question_options(first_field)
        
#         # Update onboarding state (mark as initialized and awaiting answer)
#         onboarding_state["step"] = 0
#         onboarding_state["awaiting_answer"] = True
#         onboarding_state["first_question_shown"] = True  # Mark that first question was shown via GET
        
#         # Save the first question to session
#         await self.session_repo.append_messages(
#             session_id=session.id, messages=[first_reply], user_id=user_id
#         )
#         await self.session_repo.update_metadata(
#             session_id=session.id,
#             metadata={**(session.metadata or {}), "onboarding": onboarding_state},
#             user_id=user_id,
#         )
        
#         return ChatResponse(
#             session_id=session_id,
#             reply=first_reply,
#             options=options,
#             question_type=question_type,
#             isRegistered=self._get_is_registered_from_session(session),
#         )
    
#     async def _get_current_question_response(self, session_id: str, session: Session, onboarding_state: dict) -> ChatResponse:
#         """Helper method to get current question as ChatResponse."""
#         has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)
#         ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
        
#         if onboarding_state["step"] < len(ordered_steps):
#             current_field = ordered_steps[onboarding_state["step"]]
#             question_text = self._build_prompt(field=current_field, responses=onboarding_state["responses"])
#             question_text = self._friendly_question(
#                 prompt=question_text,
#                 step=onboarding_state["step"],
#                 prev_answer=onboarding_state.get("last_answer"),
#                 prev_field=onboarding_state.get("last_field"),
#                 responses=onboarding_state.get("responses", {}),
#             )
            
#             options, question_type = self._get_question_options(current_field)
            
#             return ChatResponse(
#                 session_id=session_id,
#                 reply=ChatMessage(role="assistant", content=question_text),
#                 options=options,
#                 question_type=question_type,
#                 isRegistered=self._get_is_registered_from_session(session),
#             )
        
#         # Onboarding complete
#         return ChatResponse(
#             session_id=session_id,
#             reply=ChatMessage(
#                 role="assistant",
#                 content="Onboarding is complete. Your recommendations have been provided."
#             ),
#             options=None,
#             question_type=None,
#             isRegistered=self._get_is_registered_from_session(session),
#         )

#     async def get_current_question(self, session_id: str) -> QuestionStateResponse:
#         """
#         Get the current question state with available options.
#         Useful for frontend to display option buttons.
#         """
#         # Try without user_id first (legacy), then with user_id if found
#         session = await self.session_repo.get(session_id)
#         if not session:
#             raise SessionNotFoundError(f"Session {session_id} not found.")
        
#         # If session found but no messages, try with user_id from metadata
#         user_id = self._get_user_id_from_session(session)
#         if user_id and not session.messages:
#             # Retry with user_id
#             session = await self.session_repo.get(session_id, user_id=user_id)
#             if not session:
#                 raise SessionNotFoundError(f"Session {session_id} not found.")
        
#         onboarding_state = self._get_onboarding_state(session)
        
#         # Check if user has previous sessions (for returning users)
#         has_previous_sessions = (session.metadata or {}).get("has_previous_sessions", False)
        
#         ordered_steps = self._ordered_steps(onboarding_state["responses"], has_previous_sessions=has_previous_sessions)
        
#         if onboarding_state["complete"]:
#             return QuestionStateResponse(
#                 session_id=session_id,
#                 question=None,
#                 options=None,
#                 question_type=None,
#                 is_awaiting_answer=False,
#                 is_complete=True,
#             )
        
#         if onboarding_state["step"] < len(ordered_steps):
#             current_field = ordered_steps[onboarding_state["step"]]
#             question_text = self._build_prompt(field=current_field, responses=onboarding_state["responses"])
#             question_text = self._friendly_question(
#                 prompt=question_text,
#                 step=onboarding_state["step"],
#                 prev_answer=onboarding_state.get("last_answer"),
#                 prev_field=onboarding_state.get("last_field"),
#                 responses=onboarding_state.get("responses", {}),
#             )
            
#             options, question_type = self._get_question_options(current_field)
            
#             return QuestionStateResponse(
#                 session_id=session_id,
#                 question=question_text,
#                 options=options,
#                 question_type=question_type,
#                 is_awaiting_answer=onboarding_state["awaiting_answer"],
#                 is_complete=False,
#             )
        
#         # Onboarding complete
#         return QuestionStateResponse(
#             session_id=session_id,
#             question=None,
#             options=None,
#             question_type=None,
#             is_awaiting_answer=False,
#             is_complete=True,
#         )
