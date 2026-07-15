"""LinkedIn assets generation prompt. Used by gemini_service.py in Phase 2."""

LINKEDIN_PROMPT_TEMPLATE = """
You are a LinkedIn optimization expert. Based on the resume below, generate:

Resume:
---
{resume_text}
---
{job_title_context}

Return a single valid JSON object:
{{
  "headlines": [
    {{"variant": 1, "text": "string (max 220 chars)", "tone": "Achievement-focused"}},
    {{"variant": 2, "text": "string (max 220 chars)", "tone": "Role + Value"}},
    {{"variant": 3, "text": "string (max 220 chars)", "tone": "Keyword-optimized"}}
  ],
  "about_section": "string — 3-4 paragraph About section (max 2000 chars). First person. Story-driven. End with a CTA."
}}
"""


def build_linkedin_prompt(resume_text: str, job_title: str = "") -> str:
    job_title_context = (
        f"Target Role: {job_title}" if job_title else "No specific target role provided."
    )
    return LINKEDIN_PROMPT_TEMPLATE.format(
        resume_text=resume_text,
        job_title_context=job_title_context,
    )
