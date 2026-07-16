"""
API router for /api/analyze, /api/cover-letter, /api/linkedin, /api/extract-pdf.

Every request is tagged with a short request_id so interleaved log lines
from concurrent requests can be distinguished.

Stage log sequence for /analyze:
  [rid] Request received — <N> resume chars
  [rid] Gemini request started (attempt N, model=...)   ← from gemini_service
  [rid] First chunk received                            ← from gemini_service
  [rid] Stream finished — <N> chars total               ← from gemini_service
  [rid] JSON parsed successfully                        ← from gemini_service
  [rid] Response ready — yielding to frontend           ← from gemini_service
  [rid] SSE [DONE] sent — request complete
"""
import asyncio
import json
import uuid

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from backend.models.schemas import AnalyzeRequest, CoverLetterRequest, LinkedInRequest
from backend.services.pdf_extractor import extract_pdf_text
from backend.services.gemini_service import (
    stream_analysis,
    stream_cover_letter,
    stream_linkedin,
)

import logging
logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _request_id() -> str:
    """Short 8-char ID to correlate log lines for a single request."""
    return uuid.uuid4().hex[:8]


async def _sse_generator(async_gen, rid: str):
    """
    Wrap an async generator that yields text chunks into SSE format.

    Protocol:
      Normal chunk:  data: <json-encoded string>\\n\\n
      End sentinel:  data: [DONE]\\n\\n
      Error frame:   data: __ERROR__{"error": "..."}\\n\\n

    Catches:
      RuntimeError  — surfaced as __ERROR__ (Gemini errors, parse failures)
      asyncio.TimeoutError — surfaced as __ERROR__ with a friendly message
      Exception     — generic catch-all, never leaves the frontend waiting
    """
    try:
        async for chunk in async_gen:
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"
        logger.info("[%s] SSE [DONE] sent — request complete", rid)

    except asyncio.TimeoutError:
        # Raised by asyncio.wait_for inside _collect_stream — the RuntimeError
        # wrapping should have caught this already, but guard here too.
        msg = "Gemini took too long to respond. Please try again in a moment."
        logger.error("[%s] TimeoutError reached SSE generator", rid)
        yield f"data: __ERROR__{json.dumps({'error': msg})}\n\n"

    except RuntimeError as exc:
        logger.error("[%s] RuntimeError in SSE generator: %s", rid, exc)
        yield f"data: __ERROR__{json.dumps({'error': str(exc)})}\n\n"

    except Exception as exc:
        msg = f"Unexpected error during analysis: {type(exc).__name__}: {exc}"
        logger.exception("[%s] Unexpected exception in SSE generator", rid)
        yield f"data: __ERROR__{json.dumps({'error': msg})}\n\n"


def _streaming_response(async_gen, rid: str) -> StreamingResponse:
    return StreamingResponse(
        _sse_generator(async_gen, rid),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/extract-pdf", summary="Extract text from PDF resume")
async def extract_pdf(file: UploadFile = File(...)):
    """
    Accepts a PDF resume upload and returns the extracted plain text.
    Used before calling /api/analyze when the user uploads a file.
    """
    rid = _request_id()
    logger.info("[%s] extract-pdf — file=%s", rid, file.filename)

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    try:
        text = extract_pdf_text(contents)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No readable text found in the PDF. Try copying your resume text manually.",
        )

    logger.info("[%s] extract-pdf — extracted %d chars", rid, len(text))
    return {"text": text, "char_count": len(text)}


@router.post("/analyze", summary="Analyze resume with Gemini AI")
async def analyze_resume(request: AnalyzeRequest):
    """
    Streams a full 13-section AI career analysis via Server-Sent Events.
    The client accumulates SSE chunks and parses the JSON on [DONE].
    """
    rid = _request_id()
    resume_chars = len((request.resume_text or "").strip())
    logger.info(
        "[%s] analyze — request received — %d resume chars, job_title=%r",
        rid, resume_chars, request.job_title or "",
    )

    if not request.resume_text or len(request.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text is too short to analyze.")

    return _streaming_response(
        stream_analysis(request.resume_text, request.job_title or "", request_id=rid),
        rid,
    )


@router.post("/cover-letter", summary="Generate cover letter")
async def generate_cover_letter(request: CoverLetterRequest):
    """Streams a tailored cover letter via Server-Sent Events."""
    rid = _request_id()
    logger.info("[%s] cover-letter — request received", rid)

    return _streaming_response(
        stream_cover_letter(
            request.resume_text,
            request.job_title or "",
            request.job_description or "",
            request_id=rid,
        ),
        rid,
    )


@router.post("/linkedin", summary="Generate LinkedIn assets")
async def generate_linkedin(request: LinkedInRequest):
    """Streams LinkedIn headline variants and About section via SSE."""
    rid = _request_id()
    logger.info("[%s] linkedin — request received", rid)

    return _streaming_response(
        stream_linkedin(request.resume_text, request.job_title or "", request_id=rid),
        rid,
    )
