"""
Gemini AI Service — Phase 2 implementation.

Uses the google-genai SDK (v2+). Streams a single JSON object back
token-by-token so the frontend can show a progress indicator while the
full analysis is being generated.
"""
import os
from typing import AsyncIterator

from google import genai
from google.genai import types

from backend.prompts.analysis_prompt import (
    ANALYSIS_SYSTEM_PROMPT,
    build_analysis_prompt,
)
from backend.prompts.cover_letter_prompt import build_cover_letter_prompt
from backend.prompts.linkedin_prompt import build_linkedin_prompt

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client() -> genai.Client:
    """Return a configured Gemini client, raising clearly if key is missing."""
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to your Replit Secrets."
        )
    return genai.Client(api_key=key)


def _model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.5-flash")


# ---------------------------------------------------------------------------
# Public streaming generators
# ---------------------------------------------------------------------------

async def stream_analysis(
    resume_text: str,
    job_title: str = "",
) -> AsyncIterator[str]:
    """
    Stream a full 13-section career analysis from Gemini.
    Yields raw text chunks that together form a single JSON object.
    """
    client = _get_client()
    prompt = build_analysis_prompt(resume_text, job_title)

    async for chunk in await client.aio.models.generate_content_stream(
        model=_model(),
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=ANALYSIS_SYSTEM_PROMPT,
            temperature=0.4,
            response_mime_type="application/json",
        ),
    ):
        if chunk.text:
            yield chunk.text


async def stream_cover_letter(
    resume_text: str,
    job_title: str,
    job_description: str,
) -> AsyncIterator[str]:
    """Stream a tailored cover letter from Gemini."""
    client = _get_client()
    prompt = build_cover_letter_prompt(resume_text, job_title, job_description)

    async for chunk in await client.aio.models.generate_content_stream(
        model=_model(),
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
        ),
    ):
        if chunk.text:
            yield chunk.text


async def stream_linkedin(
    resume_text: str,
    job_title: str = "",
) -> AsyncIterator[str]:
    """Stream LinkedIn headline variants and About section from Gemini."""
    client = _get_client()
    prompt = build_linkedin_prompt(resume_text, job_title)

    async for chunk in await client.aio.models.generate_content_stream(
        model=_model(),
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.6,
            response_mime_type="application/json",
        ),
    ):
        if chunk.text:
            yield chunk.text
