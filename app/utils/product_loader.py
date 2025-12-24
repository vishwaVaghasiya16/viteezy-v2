"""Utility to load products from products.json file."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Cache for loaded products
_products_cache: list[dict[str, Any]] | None = None


def load_products_from_json(json_path: str | Path | None = None) -> list[dict[str, Any]]:
    """
    Load products from products.json file.
    The file contains multiple JSON objects (not a JSON array).
    Returns a list of product dictionaries.
    """
    global _products_cache
    
    # Return cached products if available
    if _products_cache is not None:
        return _products_cache
    
    if json_path is None:
        # Default to products.json in project root
        json_path = Path(__file__).parent.parent.parent / "products.json"
    else:
        json_path = Path(json_path)
    
    if not json_path.exists():
        raise FileNotFoundError(f"Products file not found: {json_path}")
    
    products = []
    with open(json_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Parse multiple JSON objects from the file
    # Each object is separated by blank lines
    current_obj = ""
    depth = 0
    in_string = False
    escape_next = False
    
    for char in content:
        if escape_next:
            current_obj += char
            escape_next = False
            continue
        
        if char == "\\" and not escape_next:
            escape_next = True
            current_obj += char
            continue
        
        if char == '"' and not escape_next:
            in_string = not in_string
        
        if not in_string:
            if char == "{":
                if depth == 0:
                    current_obj = "{"
                else:
                    current_obj += char
                depth += 1
            elif char == "}":
                current_obj += char
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(current_obj)
                        products.append(obj)
                    except json.JSONDecodeError:
                        # Skip malformed JSON objects
                        pass
                    current_obj = ""
            else:
                if depth > 0:
                    current_obj += char
        else:
            if depth > 0:
                current_obj += char
        
        escape_next = False
    
    # Cache the results
    _products_cache = products
    return products


def clear_cache() -> None:
    """Clear the products cache (useful for testing or reloading)."""
    global _products_cache
    _products_cache = None

