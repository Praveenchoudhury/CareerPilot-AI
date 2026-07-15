"""
Gemini AI Service — Phase 2 implementation.

Phase 1 stub: this module exists so imports don't break when Phase 2 wires
the Gemini client in. The environment variable GEMINI_MODEL is read at import
time so the configured value is always honoured without restarting.
"""
import os
from typing import AsyncIterator

# Model is configurable via environment variable; falls back to the latest
# free Gemini Flash tier model.
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-preview-05-20")


async def stream_analysis(
    resume_text: str,
    job_title: str = "",
) -> AsyncIterator[str]:
    """
    Stream a full 13-section career analysis from Gemini.
    Phase 2 will replace this stub with the real implementation.
    """
    raise NotImplementedError("Gemini integration will be added in Phase 2.")


async def stream_cover_letter(
    resume_text: str,
    job_title: str,
    job_description: str,
) -> AsyncIterator[str]:
    """Stream a tailored cover letter from Gemini. Phase 2."""
    raise NotImplementedError("Gemini integration will be added in Phase 2.")


async def stream_linkedin(
    resume_text: str,
    job_title: str = "",
) -> AsyncIterator[str]:
    """Stream LinkedIn headline variants and About section. Phase 2."""
    raise NotImplementedError("Gemini integration will be added in Phase 2.")
