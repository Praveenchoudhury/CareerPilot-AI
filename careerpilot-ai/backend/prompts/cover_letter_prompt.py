"""Cover letter generation prompt. Used by gemini_service.py in Phase 2."""

COVER_LETTER_PROMPT_TEMPLATE = """
You are an expert career coach. Write a compelling, professional cover letter.

Resume:
---
{resume_text}
---

Target Job Title: {job_title}

Job Description:
---
{job_description}
---

Instructions:
- 3-4 paragraphs, professional tone
- Open with a strong hook — not "I am applying for..."
- Highlight 2-3 specific achievements from the resume that match the job description
- Close with a confident call to action
- Do NOT use generic filler phrases
- Output plain text only (no markdown)
"""


def build_cover_letter_prompt(
    resume_text: str, job_title: str, job_description: str
) -> str:
    return COVER_LETTER_PROMPT_TEMPLATE.format(
        resume_text=resume_text,
        job_title=job_title,
        job_description=job_description,
    )
