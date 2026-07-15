import fitz  # PyMuPDF


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
        text = page.get_text("text", sort=True)
        if text.strip():
            pages.append(text.strip())

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
