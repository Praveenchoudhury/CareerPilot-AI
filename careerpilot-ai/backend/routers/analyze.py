import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from backend.models.schemas import AnalyzeRequest, CoverLetterRequest, LinkedInRequest
from backend.services.pdf_extractor import extract_pdf_text
from backend.services.gemini_service import (
    stream_analysis,
    stream_cover_letter,
    stream_linkedin,
)

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _sse_generator(async_gen):
    """
    Wrap an async generator that yields text chunks into SSE format.

    Each text chunk is JSON-encoded (json.dumps) before sending so that ALL
    control characters — including newlines inside JSON string values — are
    properly escaped and survive the SSE transport without corruption.

      Normal chunk:  data: "escaped chunk text"\\n\\n
      End sentinel:  data: [DONE]\\n\\n
      Error frame:   data: __ERROR__{"error": "..."}\\n\\n
    """
    try:
        async for chunk in async_gen:
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"
    except RuntimeError as exc:
        error_payload = json.dumps({"error": str(exc)})
        yield f"data: __ERROR__{error_payload}\n\n"
    except Exception as exc:
        error_payload = json.dumps({"error": f"Gemini error: {str(exc)}"})
        yield f"data: __ERROR__{error_payload}\n\n"


def _streaming_response(async_gen) -> StreamingResponse:
    return StreamingResponse(
        _sse_generator(async_gen),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering if present
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

    return {"text": text, "char_count": len(text)}


@router.post("/analyze", summary="Analyze resume with Gemini AI")
async def analyze_resume(request: AnalyzeRequest):
    """
    Streams a full 13-section AI career analysis via Server-Sent Events.
    The client accumulates SSE chunks and parses the JSON on [DONE].
    """
    if not request.resume_text or len(request.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text is too short to analyze.")

    return _streaming_response(
        stream_analysis(request.resume_text, request.job_title or "")
    )


@router.post("/cover-letter", summary="Generate cover letter")
async def generate_cover_letter(request: CoverLetterRequest):
    """Streams a tailored cover letter via Server-Sent Events."""
    return _streaming_response(
        stream_cover_letter(
            request.resume_text,
            request.job_title or "",
            request.job_description or "",
        )
    )


@router.post("/linkedin", summary="Generate LinkedIn assets")
async def generate_linkedin(request: LinkedInRequest):
    """Streams LinkedIn headline variants and About section via SSE."""
    return _streaming_response(
        stream_linkedin(request.resume_text, request.job_title or "")
    )
