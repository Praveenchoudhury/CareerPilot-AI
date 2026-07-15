from pydantic import BaseModel, Field
from typing import Optional


class AnalyzeRequest(BaseModel):
    resume_text: str = Field(
        ...,
        min_length=50,
        description="Full resume text content (plain text, extracted from PDF or pasted).",
    )
    job_title: Optional[str] = Field(
        None,
        max_length=200,
        description="Target job title — used to tailor the AI analysis.",
    )


class CoverLetterRequest(BaseModel):
    resume_text: str = Field(..., min_length=50)
    job_title: str = Field(..., min_length=2, max_length=200)
    job_description: str = Field(
        ...,
        min_length=50,
        description="Job description to tailor the cover letter against.",
    )


class LinkedInRequest(BaseModel):
    resume_text: str = Field(..., min_length=50)
    job_title: Optional[str] = Field(None, max_length=200)


class ExtractResponse(BaseModel):
    text: str
    char_count: int


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
