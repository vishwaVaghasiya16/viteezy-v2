from openai import AsyncOpenAI

from app.config.settings import settings


async def get_openai_client() -> AsyncOpenAI:
    # Lazy instantiation keeps startup light and reuses the client per request scope
    return AsyncOpenAI(api_key=settings.openai_api_key)
