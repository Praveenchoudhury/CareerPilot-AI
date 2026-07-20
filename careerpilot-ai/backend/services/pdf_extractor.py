import io
import os

import fitz # PyMuPDF
import pytesseract
from PIL import Image

import shutil

if os.name == "nt":
    # Windows
    pytesseract.pytesseract.tesseract_cmd = (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )
else:
    # Linux (Render)
    tesseract_path = shutil.which("tesseract")
    if tesseract_path:
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
        
def extract_pdf_text(pdf_bytes: bytes) -> str:
    """
    Extract clean plain text from a PDF file.

    Uses PyMuPDF with sort=True to preserve reading order across
    multi-column layouts. Strips excessive blank lines while keeping
    section separation intact.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Could not open PDF: {exc}") from exc

    pages: list[str] = []

    for page in doc:
     # Try normal text extraction first
     text = page.get_text("text", sort=True)

    if text.strip():
        pages.append(text.strip())
    else:
        # No embedded text found → use OCR
        matrix = fitz.Matrix(2, 2)   # Higher resolution
        pix = page.get_pixmap(matrix=matrix)

        image = Image.open(io.BytesIO(pix.tobytes("png")))

        # Convert to grayscale
        image = image.convert("L")

        ocr_text = pytesseract.image_to_string(image)

        if ocr_text.strip():
            pages.append(ocr_text.strip())

    doc.close()
                                               
    if not pages:
        return ""

    raw = "\n\n".join(pages)

    # Remove lines that are purely whitespace, collapse 3+ blank lines to 2
    lines = raw.splitlines()
    cleaned: list[str] = []
    blank_streak = 0

    for line in lines:
        stripped = line.strip()
        if stripped:
            blank_streak = 0
            cleaned.append(stripped)
        else:
            blank_streak += 1
            if blank_streak <= 2:
                cleaned.append("")

    return "\n".join(cleaned).strip()
