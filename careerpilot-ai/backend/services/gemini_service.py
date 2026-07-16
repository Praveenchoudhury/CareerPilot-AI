"""
Gemini AI Service — robust JSON parsing, timeout, and 503 retry.

For JSON endpoints (/analyze, /linkedin):
  1. Collect all Gemini chunks with a hard 55-second timeout.
  2. Retry up to 3 times on 503 UNAVAILABLE (backoff: 2s, 5s, 10s).
  3. Parse robustly: strip fences, repair trailing commas.
  4. If parsing fails, retry once with a strict JSON-only prompt.
  5. Apply safe defaults for any missing optional fields.
  6. Yield the validated JSON string as a single SSE chunk.

For the plain-text endpoint (/cover-letter):
  Chunks are streamed directly through the same timeout/retry wrapper.

Every significant stage is logged so hangs can be pinpointed from server logs.
"""
import asyncio
import json
import logging
import os
import re
from typing import AsyncIterator

from google import genai
from google.genai import errors as genai_errors
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
# Configuration constants
# ---------------------------------------------------------------------------

# Hard deadline per Gemini call (seconds). Leaves ~5s headroom before a
# typical 60-second frontend / proxy timeout.
_GEMINI_TIMEOUT_S: int = 55

# 503 retry schedule: [delay before attempt-2, delay before attempt-3, delay before attempt-4]
_RETRY_DELAYS: tuple[int, ...] = (2, 5, 10)


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
# Core: streaming collector with timeout and 503 retry
# ---------------------------------------------------------------------------

async def _collect_stream(
    client: genai.Client,
    model: str,
    contents,
    config: types.GenerateContentConfig,
    label: str,
) -> str:
    """
    Collect all chunks from a Gemini streaming call into a single string.

    Wraps the entire operation in asyncio.wait_for(_GEMINI_TIMEOUT_S) so that:
      - A hang before the first chunk times out cleanly.
      - A stall mid-stream (partial response) also times out cleanly.

    On 503 UNAVAILABLE, retries up to 3 times with exponential backoff.
    On timeout, raises asyncio.TimeoutError immediately (no retry — the caller
    surfaces a user-friendly error).
    """
    delays = _RETRY_DELAYS
    last_503: Exception | None = None

    for attempt in range(1, len(delays) + 2):  # attempts 1..4
        if attempt > 1:
            delay = delays[attempt - 2]
            logger.warning(
                "[%s] 503 retry %d/3 — waiting %ds before next attempt",
                label, attempt - 1, delay,
            )
            await asyncio.sleep(delay)

        logger.info("[%s] Gemini request started (attempt %d, model=%s)", label, attempt, model)

        try:
            raw = await asyncio.wait_for(
                _inner_collect(client, model, contents, config, label),
                timeout=_GEMINI_TIMEOUT_S,
            )
            logger.info("[%s] Stream finished — %d chars total", label, len(raw))
            return raw

        except asyncio.TimeoutError:
            logger.error(
                "[%s] Gemini call timed out after %ds (attempt %d)",
                label, _GEMINI_TIMEOUT_S, attempt,
            )
            raise RuntimeError(
                f"Gemini took too long to respond (>{_GEMINI_TIMEOUT_S}s). "
                "Please try again in a moment."
            )

        except genai_errors.ServerError as exc:
            msg = str(exc)
            if "503" in msg or "UNAVAILABLE" in msg.upper():
                logger.warning("[%s] 503 UNAVAILABLE on attempt %d: %s", label, attempt, exc)
                last_503 = exc
                if attempt <= len(delays):
                    continue  # will retry
                # All retries exhausted
                raise RuntimeError(
                    "Gemini is temporarily busy. Please try again in a few moments."
                ) from last_503
            # Non-503 server error — surface immediately
            logger.error("[%s] ServerError (non-503) on attempt %d: %s", label, attempt, exc)
            raise RuntimeError(f"Gemini error: {exc}") from exc

        except genai_errors.ClientError as exc:
            msg = str(exc)
            # 429 RESOURCE_EXHAUSTED can be a transient per-minute rate limit;
            # retry with the same backoff schedule before giving up.
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg.upper():
                logger.warning("[%s] 429 rate limit on attempt %d: %s", label, attempt, exc)
                last_503 = exc  # reuse the same "last transient error" slot
                if attempt <= len(delays):
                    continue  # will retry
                raise RuntimeError(
                    "Gemini is temporarily busy (rate limit). Please try again in a few moments."
                ) from exc
            logger.error("[%s] ClientError on attempt %d: %s", label, attempt, exc)
            raise RuntimeError(f"Gemini request error: {exc}") from exc

    # Should be unreachable, but belt-and-suspenders
    if last_503:
        raise RuntimeError(
            "Gemini is temporarily busy. Please try again in a few moments."
        ) from last_503
    raise RuntimeError("Gemini call failed after all retry attempts.")


async def _inner_collect(
    client: genai.Client,
    model: str,
    contents,
    config: types.GenerateContentConfig,
    label: str,
) -> str:
    """
    Inner async function that drives the Gemini streaming loop.
    Kept separate so asyncio.wait_for has a clean coroutine to cancel.
    """
    parts: list[str] = []
    first_chunk_logged = False

    async for chunk in await client.aio.models.generate_content_stream(
        model=model,
        contents=contents,
        config=config,
    ):
        if chunk.text:
            if not first_chunk_logged:
                logger.info("[%s] First chunk received", label)
                first_chunk_logged = True
            parts.append(chunk.text)

    if not first_chunk_logged:
        logger.warning("[%s] Stream ended with zero text chunks", label)

    return "".join(parts)


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
    """Remove trailing commas before } or ] (disallowed by JSON spec)."""
    return re.sub(r',\s*([}\]])', r'\1', text)


def _parse_json_robust(raw: str, label: str = "gemini") -> dict:
    """
    Parse a Gemini JSON response robustly, with structured logging at each step.

    Attempts:
      1. json.loads after stripping fences and extracting the object.
      2. json.loads after also applying heuristic repairs.

    Raises json.JSONDecodeError if both attempts fail so the caller can retry.
    """
    logger.info("[%s] Parsing response — %d chars", label, len(raw))
    logger.debug("[%s] Raw (first 600 chars): %r", label, raw[:600])

    cleaned = _clean_json(raw)
    logger.debug("[%s] After cleaning (first 600): %r", label, cleaned[:600])

    # Attempt 1: cleaned JSON as-is
    try:
        result = json.loads(cleaned)
        logger.info("[%s] JSON parsed successfully (attempt 1)", label)
        return result
    except json.JSONDecodeError as e1:
        logger.warning("[%s] Parse attempt 1 failed: %s", label, e1)

    # Attempt 2: heuristic repair (trailing commas, etc.)
    repaired = _repair_json(cleaned)
    try:
        result = json.loads(repaired)
        logger.info("[%s] JSON parsed successfully (attempt 2 — after repair)", label)
        return result
    except json.JSONDecodeError as e2:
        logger.error(
            "[%s] Parse attempt 2 (repaired) failed: %s\nFull cleaned text:\n%s",
            label, e2, cleaned,
        )
        raise


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
            logger.info("Filling missing field with default: %r", key)
            data[key] = default_val
    return data


# ---------------------------------------------------------------------------
# Public streaming generators
# ---------------------------------------------------------------------------

async def stream_analysis(
    resume_text: str,
    job_title: str = "",
    request_id: str = "",
) -> AsyncIterator[str]:
    """
    Yield a single validated JSON chunk with the 13-section career analysis.

    Flow:
      collect (with timeout+503 retry) → parse robustly → [retry with strict prompt]
      → apply defaults → yield validated JSON.
    """
    label  = f"analyze:{request_id}" if request_id else "analyze"
    client = _get_client()
    model  = _model()
    prompt = build_analysis_prompt(resume_text, job_title)

    primary_config = types.GenerateContentConfig(
        system_instruction=ANALYSIS_SYSTEM_PROMPT,
        temperature=0.4,
        response_mime_type="application/json",
    )

    logger.info("[%s] Starting primary Gemini call", label)
    raw = await _collect_stream(client, model, prompt, primary_config, label)

    try:
        data = _parse_json_robust(raw, label=label)
    except json.JSONDecodeError:
        logger.warning("[%s] Primary parse failed — retrying with strict JSON prompt", label)

        retry_config = types.GenerateContentConfig(
            system_instruction=STRICT_JSON_RETRY_SYSTEM_PROMPT,
            temperature=0.1,
            response_mime_type="application/json",
        )
        raw2 = await _collect_stream(client, model, prompt, retry_config, f"{label}-retry")

        try:
            data = _parse_json_robust(raw2, label=f"{label}-retry")
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "AI response could not be parsed after retry. "
                "Please try again or simplify your resume text. "
                f"(Detail: {exc})"
            ) from exc

    data = _apply_defaults(data, _ANALYSIS_DEFAULTS)
    logger.info("[%s] Response ready — yielding to frontend", label)
    yield json.dumps(data)


async def stream_cover_letter(
    resume_text: str,
    job_title: str,
    job_description: str,
    request_id: str = "",
) -> AsyncIterator[str]:
    """
    Stream a tailored cover letter from Gemini (plain text, no JSON parsing).

    Uses the same timeout/retry wrapper as JSON endpoints.
    """
    label  = f"cover-letter:{request_id}" if request_id else "cover-letter"
    client = _get_client()
    model  = _model()
    prompt = build_cover_letter_prompt(resume_text, job_title, job_description)

    config = types.GenerateContentConfig(temperature=0.7)

    logger.info("[%s] Starting Gemini call", label)
    raw = await _collect_stream(client, model, prompt, config, label)
    logger.info("[%s] Response ready — yielding to frontend", label)
    yield raw


async def stream_linkedin(
    resume_text: str,
    job_title: str = "",
    request_id: str = "",
) -> AsyncIterator[str]:
    """
    Yield a single validated JSON chunk with LinkedIn headlines and About section.

    Same timeout/retry/parse flow as stream_analysis.
    """
    label  = f"linkedin:{request_id}" if request_id else "linkedin"
    client = _get_client()
    model  = _model()
    prompt = build_linkedin_prompt(resume_text, job_title)

    primary_config = types.GenerateContentConfig(
        temperature=0.6,
        response_mime_type="application/json",
    )

    logger.info("[%s] Starting primary Gemini call", label)
    raw = await _collect_stream(client, model, prompt, primary_config, label)

    try:
        data = _parse_json_robust(raw, label=label)
    except json.JSONDecodeError:
        logger.warning("[%s] Primary parse failed — retrying with strict JSON prompt", label)

        retry_config = types.GenerateContentConfig(
            system_instruction=STRICT_JSON_RETRY_SYSTEM_PROMPT,
            temperature=0.1,
            response_mime_type="application/json",
        )
        raw2 = await _collect_stream(client, model, prompt, retry_config, f"{label}-retry")

        try:
            data = _parse_json_robust(raw2, label=f"{label}-retry")
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "LinkedIn AI response could not be parsed after retry. "
                f"(Detail: {exc})"
            ) from exc

    data = _apply_defaults(data, _LINKEDIN_DEFAULTS)
    logger.info("[%s] Response ready — yielding to frontend", label)
    yield json.dumps(data)
