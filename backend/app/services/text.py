"""Text normalization used for duplicate detection and area matching."""

import re


def normalize_area(value: str) -> str:
    """Normalize a free-text location for comparison."""
    return " ".join(value.casefold().split())


def normalize_description(value: str) -> str:
    """Normalize free text for similarity comparison."""
    cleaned = re.sub(r"[^a-z0-9\s]", " ", value.casefold())
    return " ".join(cleaned.split())
