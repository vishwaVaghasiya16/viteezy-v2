from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config.logging import configure_logging
from app.config.settings import settings
from app.dependencies.db import close_client
from app.middleware.error_handler import exception_handler_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.log_level)
    yield
    await close_client()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add global exception handler middleware
app.middleware("http")(exception_handler_middleware)

app.include_router(router, prefix="/api/v1")
