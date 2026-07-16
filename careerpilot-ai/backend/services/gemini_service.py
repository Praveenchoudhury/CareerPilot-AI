"""
Gemini AI Service — robust JSON parsing with retry.

For JSON endpoints (/analyze, /linkedin):
  1. Collect all Gemini chunks into a single buffer.
  2. Parse robustly: strip markdown fences, extract outermost {…}, repair
     trailing commas.
  3. If parsing still fails, retry ONCE with a stricter JSON-only system prompt
     and temperature 0.1.
  4. Apply safe defaults for any missing optional fields.
  5. Yield the validated JSON string as a single SSE chunk.

For the plain-text endpoint (/cover-letter):
  Chunks are streamed directly — no JSON parsing required.
"""
import json
import logging
import os
import re
from typing import AsyncIterator

from google import genai
from google.genai import types

from backend.prompts.analysis_prompt import (
    ANALYSIS_SYSTEM_PROMPT,
    STRICT_JSON_RETRY_SYSTEM_PROMPT,
    build_analysis_prompt,
)
from backend.prompts.cover_letter_prompt import build_cover_letter_prompt
from backend.prompts.linkedin_prompt import build_linkedin_prompt

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client / model helpers
# ---------------------------------------------------------------------------

def _get_client() -> genai.Client:
    """Return a configured Gemini client, raising clearly if the key is missing."""
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to your Replit Secrets."
        )
    return genai.Client(api_key=key)


def _model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.5-flash")


# ---------------------------------------------------------------------------
# JSON cleaning and robust parsing
# ---------------------------------------------------------------------------

def _clean_json(raw: str) -> str:
    """
    Strip markdown code fences and surrounding prose, then extract
    the outermost JSON object.

    Handles:
      - ```json ... ```
      - ``` ... ```
      - Explanatory text before the opening {
      - Trailing text after the closing }
    """
    text = raw.strip()

    # Remove opening fence (``` or ```json at the very start of any line)
    text = re.sub(r'^```(?:json|JSON)?\s*\n?', '', text, flags=re.MULTILINE)
    # Remove closing fence (``` on its own line or at the end)
    text = re.sub(r'\n?```\s*$', '', text, flags=re.MULTILINE)
    text = text.strip()

    # Extract from the first { to the last } to discard surrounding prose
    start = text.find('{')
    end   = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    return text


def _repair_json(text: str) -> str:
    """
    Apply light heuristic repairs for common Gemini JSON quirks:
      - Trailing commas before } or ]  (disallowed by JSON spec)
    """
    return re.sub(r',\s*([}\]])', r'\1', text)


def _parse_json_robust(raw: str, label: str = "gemini") -> dict:
    """
    Parse a Gemini JSON response robustly, with structured logging at each step.

    Attempts:
      1. json.loads after stripping fences and extracting the object.
      2. json.loads after also applying heuristic repairs.

    Raises json.JSONDecodeError if both attempts fail so the caller can retry.
    """
    logger.info("[%s] Raw response received — %d chars", label, len(raw))
    logger.debug("[%s] Raw (first 600 chars): %r", label, raw[:600])

    cleaned = _clean_json(raw)
    logger.debug("[%s] After cleaning (first 600): %r", label, cleaned[:600])

    # Attempt 1: cleaned JSON as-is
    try:
        result = json.loads(cleaned)
        logger.info("[%s] Parsed successfully on attempt 1", label)
        return result
    except json.JSONDecodeError as e1:
        logger.warning("[%s] Attempt 1 failed: %s", label, e1)

    # Attempt 2: heuristic repair (trailing commas, etc.)
    repaired = _repair_json(cleaned)
    try:
        result = json.loads(repaired)
        logger.info("[%s] Parsed successfully on attempt 2 (after repair)", label)
        return result
    except json.JSONDecodeError as e2:
        logger.error(
            "[%s] Attempt 2 (repaired) failed: %s\nFull cleaned text:\n%s",
            label, e2, cleaned,
        )
        raise  # Propagate so caller can trigger a retry


# ---------------------------------------------------------------------------
# Safe defaults for optional fields
# ---------------------------------------------------------------------------

_ANALYSIS_DEFAULTS: dict = {
    "professional_summary": "",
    "strengths": [],
    "weaknesses": [],
    "ats_score": 0,
    "ats_score_reasoning": "Score could not be determined.",
    "missing_skills": [],
    "suggested_improvements": [],
    "career_path_recommendations": {
        "short_term": "Not available.",
        "mid_term":   "Not available.",
        "long_term":  "Not available.",
    },
    "recommended_certifications": [],
    "recommended_projects": [],
    "skill_roadmap": {
        "days_30": [],
        "days_60": [],
        "days_90": [],
    },
    "interview_questions": [],
}

_LINKEDIN_DEFAULTS: dict = {
    "headlines":     [],
    "about_section": "",
}


def _apply_defaults(data: dict, defaults: dict) -> dict:
    """Fill in any missing or None fields with safe defaults (non-destructive)."""
    for key, default_val in defaults.items():
        if key not in data or data[key] is None:
            logger.info("Filling default for missing field: %r", key)
            data[key] = default_val
    return data


# ---------------------------------------------------------------------------
# Shared: collect all streaming chunks into one string
# ---------------------------------------------------------------------------

async def _collect_stream(
    client: genai.Client,
    model: str,
    contents,
    config: types.GenerateContentConfig,
) -> str:
    """Run a Gemini streaming call and return the full concatenated text."""
    parts: list[str] = []
    async for chunk in await client.aio.models.generate_content_stream(
        model=model,
        contents=contents,
        config=config,
    ):
        if chunk.text:
            parts.append(chunk.text)
    return "".join(parts)


# ---------------------------------------------------------------------------
# Public streaming generators
# ---------------------------------------------------------------------------

async def stream_analysis(
    resume_text: str,
    job_title: str = "",
) -> AsyncIterator[str]:
    """
    Yield a single validated JSON chunk with the 13-section career analysis.

    Parse → clean → repair → [retry with strict prompt] → apply defaults → yield.
    """
    client = _get_client()
    model  = _model()
    prompt = build_analysis_prompt(resume_text, job_title)

    primary_config = types.GenerateContentConfig(
        system_instruction=ANALYSIS_SYSTEM_PROMPT,
        temperature=0.4,
        response_mime_type="application/json",
    )

    raw = await _collect_stream(client, model, prompt, primary_config)

    try:
        data = _parse_json_robust(raw, label="analyze")
    except json.JSONDecodeError:
        logger.warning(
            "[analyze] Primary parse failed — retrying with strict JSON-only prompt"
        )
        retry_config = types.GenerateContentConfig(
            system_instruction=STRICT_JSON_RETRY_SYSTEM_PROMPT,
            temperature=0.1,
            response_mime_type="application/json",
        )
        raw2 = await _collect_stream(client, model, prompt, retry_config)
        logger.info("[analyze] Retry response — %d chars", len(raw2))

        try:
            data = _parse_json_robust(raw2, label="analyze-retry")
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "AI response could not be parsed after retry. "
                "Please try again or simplify your resume text. "
                f"(Detail: {exc})"
            ) from exc

    data = _apply_defaults(data, _ANALYSIS_DEFAULTS)
    yield json.dumps(data)


async def stream_cover_letter(
    resume_text: str,
    job_title: str,
    job_description: str,
) -> AsyncIterator[str]:
    """
    Stream a tailored cover letter from Gemini.
    Plain text — no JSON parsing required.
    """
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
    """
    Yield a single validated JSON chunk with LinkedIn headlines and About section.

    Same robust parse → retry → defaults flow as stream_analysis.
    """
    client = _get_client()
    model  = _model()
    prompt = build_linkedin_prompt(resume_text, job_title)

    primary_config = types.GenerateContentConfig(
        temperature=0.6,
        response_mime_type="application/json",
    )

    raw = await _collect_stream(client, model, prompt, primary_config)

    try:
        data = _parse_json_robust(raw, label="linkedin")
    except json.JSONDecodeError:
        logger.warning(
            "[linkedin] Primary parse failed — retrying with strict JSON-only prompt"
        )
        retry_config = types.GenerateContentConfig(
            system_instruction=STRICT_JSON_RETRY_SYSTEM_PROMPT,
            temperature=0.1,
            response_mime_type="application/json",
        )
        raw2 = await _collect_stream(client, model, prompt, retry_config)

        try:
            data = _parse_json_robust(raw2, label="linkedin-retry")
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "LinkedIn AI response could not be parsed after retry. "
                f"(Detail: {exc})"
            ) from exc

    data = _apply_defaults(data, _LINKEDIN_DEFAULTS)
    yield json.dumps(data)
