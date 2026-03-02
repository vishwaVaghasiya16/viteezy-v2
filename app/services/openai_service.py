from __future__ import annotations

import logging
from typing import Iterable

from openai import AsyncOpenAI

from app.config.settings import settings
from app.schemas.chat import ChatMessage
from app.utils.error_handler import handle_openai_errors, retry_async
from app.utils.openai_logger import log_openai_usage

logger = logging.getLogger(__name__)


class OpenAIChatService:
    def __init__(self, client: AsyncOpenAI):
        self.client = client

    @handle_openai_errors
    async def _create_completion(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
    ) -> tuple[str, dict]:
        """
        Internal method to create OpenAI completion with error handling.
        """
        selected_model = model or settings.openai_model
        response = await self.client.chat.completions.create(
            model=selected_model,
            messages=messages,
            temperature=settings.openai_temperature,
            max_tokens=settings.openai_max_tokens,
            timeout=30.0,  # 30 second timeout
        )

        # Extract usage information
        usage = response.usage
        usage_info = {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "cost": 0.0,
            "model": selected_model,
        }
        
        if usage:
            from app.utils.openai_logger import calculate_cost
            
            input_tokens = usage.prompt_tokens or 0
            output_tokens = usage.completion_tokens or 0
            total_tokens = usage.total_tokens or 0
            cost = calculate_cost(selected_model, input_tokens, output_tokens)
            
            usage_info = {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "cost": cost,
                "model": selected_model,
            }
            
            log_openai_usage(
                model=selected_model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                cost=cost,
            )

        reply_text = response.choices[0].message.content or "Sorry, I could not generate a response."
        return reply_text, usage_info

    async def generate_reply(
        self,
        system_prompt: str,
        history: Iterable[ChatMessage],
        user_message: str,
        context: dict | None = None,
        products: list[str] | None = None,
    ) -> tuple[str, dict]:
        """
        Generate a reply using OpenAI API with retry logic.
        Returns tuple of (reply_text, usage_info).
        usage_info contains: input_tokens, output_tokens, total_tokens, cost, model
        """
        try:
            messages = [{"role": "system", "content": system_prompt}]

            if context:
                messages.append(
                    {
                        "role": "system",
                        "content": f"Additional structured context from quiz/profile: {context}",
                    }
                )

            if products:
                product_context = "\n".join(products)
                messages.append(
                    {
                        "role": "system",
                        "content": (
                            "Relevant catalog products (use for suggestions when appropriate, "
                            "never hallucinate new products):\n" + product_context
                        ),
                    }
                )

            messages.extend([{"role": message.role, "content": message.content} for message in history])
            messages.append({"role": "user", "content": user_message})

            # Retry with exponential backoff for transient errors
            from openai import APIError, APIConnectionError, APITimeoutError, RateLimitError
            
            primary_model = settings.openai_model
            fallback_model = settings.openai_fallback_model

            try:
                reply_text, usage_info = await retry_async(
                    self._create_completion,
                    max_retries=3,
                    delay=1.0,
                    backoff=2.0,
                    exceptions=(
                        APIConnectionError,
                        APITimeoutError,
                        APIError,  # Retry on API errors (but not rate limits)
                    ),
                    messages=messages,
                    model=primary_model,
                )
                return reply_text, usage_info
            except Exception as primary_error:
                if fallback_model and fallback_model != primary_model:
                    logger.warning(
                        "Primary OpenAI model failed (%s). Trying fallback model: %s",
                        primary_model,
                        fallback_model,
                    )
                    try:
                        reply_text, usage_info = await retry_async(
                            self._create_completion,
                            max_retries=1,
                            delay=0.5,
                            backoff=2.0,
                            exceptions=(
                                APIConnectionError,
                                APITimeoutError,
                                APIError,
                            ),
                            messages=messages,
                            model=fallback_model,
                        )
                        return reply_text, usage_info
                    except Exception:
                        logger.error(
                            "Fallback OpenAI model also failed: %s",
                            fallback_model,
                            exc_info=True,
                        )
                raise primary_error
            
        except RateLimitError:
            # Don't retry on rate limits, let the error handler deal with it
            raise
        except Exception as e:
            logger.error(f"Unexpected error in generate_reply: {e}", exc_info=True)
            raise
