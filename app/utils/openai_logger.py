"""Utility for logging OpenAI API usage including tokens and costs."""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

# OpenAI pricing per 1M tokens (as of 2024)
# Prices are in USD
MODEL_PRICING = {
    "gpt-4o-mini": {
        "input": 0.15 / 1_000_000,  # $0.15 per 1M tokens
        "output": 0.075 / 1_000_000,  # $0.075 per 1M tokens
    },
    "gpt-4o": {
        "input": 2.50 / 1_000_000,  # $2.50 per 1M tokens
        "output": 10.00 / 1_000_000,  # $10.00 per 1M tokens
    },
    "gpt-4-turbo": {
        "input": 10.00 / 1_000_000,  # $10.00 per 1M tokens
        "output": 30.00 / 1_000_000,  # $30.00 per 1M tokens
    },
    "gpt-3.5-turbo": {
        "input": 0.50 / 1_000_000,  # $0.50 per 1M tokens
        "output": 1.50 / 1_000_000,  # $1.50 per 1M tokens
    },
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """
    Calculate the cost of an OpenAI API call.
    
    Args:
        model: The model name (e.g., 'gpt-4o-mini')
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
    
    Returns:
        Total cost in USD
    """
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        # Default to gpt-4o-mini pricing if model not found
        pricing = MODEL_PRICING["gpt-4o-mini"]
    
    input_cost = input_tokens * pricing["input"]
    output_cost = output_tokens * pricing["output"]
    return input_cost + output_cost


def get_openai_logger() -> logging.Logger:
    """Get or create the OpenAI usage logger."""
    logger = logging.getLogger("openai_usage")
    
    if not logger.handlers:
        # Create logs directory if it doesn't exist
        log_dir = Path(__file__).parent.parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        
        # Log file for OpenAI usage
        log_file = log_dir / "openai_usage.log"
        
        # Create file handler with append mode (default, but explicit for clarity)
        file_handler = logging.FileHandler(log_file, mode="a", encoding="utf-8")
        file_handler.setLevel(logging.INFO)
        
        # Custom formatter
        formatter = logging.Formatter(
            "%(asctime)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False  # Don't propagate to root logger
    
    return logger


def log_openai_usage(
    model: str,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    cost: float | None = None,
) -> None:
    """
    Log OpenAI API usage including tokens and cost.
    
    Args:
        model: The model name used
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        total_tokens: Total tokens used
        cost: Optional cost (will be calculated if not provided)
    """
    if cost is None:
        cost = calculate_cost(model, input_tokens, output_tokens)
    
    logger = get_openai_logger()
    
    log_message = (
        f"Model: {model} | "
        f"Input Tokens: {input_tokens:,} | "
        f"Output Tokens: {output_tokens:,} | "
        f"Total Tokens: {total_tokens:,} | "
        f"Cost: ${cost:.6f}"
    )
    
    logger.info(log_message)

