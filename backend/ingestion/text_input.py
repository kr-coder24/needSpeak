"""
Plain text input passthrough.
Exists for interface consistency — all input types go through an ingestion module.
"""


def process_text_input(content: str) -> str:
    """
    Validate and return plain text input.
    Trivial but keeps the ingestion interface uniform.
    """
    if not content or not content.strip():
        raise ValueError("Empty input — please paste some text.")

    text = content.strip()

    # Basic sanity check — reject extremely short inputs
    if len(text) < 5:
        raise ValueError("Input is too short. Please paste a recipe, shopping list, or instructions.")

    return text
