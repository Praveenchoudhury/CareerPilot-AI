from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.models.schemas import AnalyzeRequest, CoverLetterRequest, LinkedInRequest
from backend.services.pdf_extractor import extract_pdf_text

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


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


@router.post("/analyze", summary="Analyze resume with AI (Phase 2)")
async def analyze_resume(request: AnalyzeRequest):
    """
    Streams a full 13-section AI career analysis for the provided resume.
    Gemini integration will be added in Phase 2.
    """
    raise HTTPException(
        status_code=501,
        detail="Gemini AI integration is coming in Phase 2.",
    )


@router.post("/cover-letter", summary="Generate cover letter (Phase 2)")
async def generate_cover_letter(request: CoverLetterRequest):
    """Generates a tailored cover letter. Gemini integration in Phase 2."""
    raise HTTPException(status_code=501, detail="Coming in Phase 2.")


@router.post("/linkedin", summary="Generate LinkedIn assets (Phase 2)")
async def generate_linkedin(request: LinkedInRequest):
    """Generates LinkedIn headline variants and About section. Gemini integration in Phase 2."""
    raise HTTPException(status_code=501, detail="Coming in Phase 2.")
