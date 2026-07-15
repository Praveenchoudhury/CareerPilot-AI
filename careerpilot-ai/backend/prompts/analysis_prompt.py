"""
Analysis prompt template for the 13-section career report.
Populated and used by gemini_service.py in Phase 2.
"""

ANALYSIS_SYSTEM_PROMPT = """You are CareerPilot AI, an expert career coach and resume analyst.
Analyze the provided resume and return a structured JSON response with exactly the following
13 sections. Be specific, actionable, and honest. Do not pad with generic advice.
"""

ANALYSIS_USER_PROMPT_TEMPLATE = """
Resume Text:
---
{resume_text}
---
{job_title_context}

Return a single valid JSON object with these exact keys:
{{
  "professional_summary": "string — 3-4 sentence narrative of the candidate",
  "strengths": ["string", ...],   // 5 specific strengths with brief context
  "weaknesses": ["string", ...],  // 5 specific weaknesses with impact context
  "ats_score": integer,           // 0-100 ATS compatibility score
  "ats_score_reasoning": "string",
  "missing_skills": ["string", ...],
  "suggested_improvements": ["string", ...],
  "career_path_recommendations": {{
    "short_term": "string",
    "mid_term": "string",
    "long_term": "string"
  }},
  "recommended_certifications": [
    {{"name": "string", "provider": "string", "priority": "High|Medium|Low", "reason": "string"}}
  ],
  "recommended_projects": [
    {{"title": "string", "description": "string", "skills_demonstrated": ["string"]}}
  ],
  "skill_roadmap": {{
    "days_30": ["string", ...],
    "days_60": ["string", ...],
    "days_90": ["string", ...]
  }},
  "interview_questions": [
    {{"question": "string", "model_answer": "string", "type": "Behavioral|Technical|Situational"}}
  ]
}}
"""


def build_analysis_prompt(resume_text: str, job_title: str = "") -> str:
    job_title_context = (
        f"Target Job Title: {job_title}" if job_title else "No specific job title provided."
    )
    return ANALYSIS_USER_PROMPT_TEMPLATE.format(
        resume_text=resume_text,
        job_title_context=job_title_context,
    )
