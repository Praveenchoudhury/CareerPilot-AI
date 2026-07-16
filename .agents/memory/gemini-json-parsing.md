---
name: Gemini JSON parsing strategy
description: How CareerPilot AI robustly parses Gemini JSON responses for /analyze and /linkedin endpoints
---

# Gemini JSON parsing strategy

## The rule
For all JSON-returning endpoints, **buffer all Gemini chunks on the backend**, parse robustly, retry once if needed, apply field defaults, then yield the single validated JSON string. Do NOT stream raw chunks and let the frontend parse.

**Why:** Even with `response_mime_type="application/json"`, Gemini occasionally wraps responses in markdown fences (` ```json`), prepends explanatory prose, or produces trailing commas for complex/unusual resumes. Doing all parsing server-side means the frontend's `JSON.parse` always succeeds.

**How to apply:** Any new JSON-returning endpoint should use the same pattern as `stream_analysis` and `stream_linkedin` in `backend/services/gemini_service.py`:
1. `await _collect_stream(...)` — buffer all chunks
2. `_parse_json_robust(raw, label=...)` — strips fences, extracts `{...}`, repairs trailing commas
3. On `JSONDecodeError` → retry once with `STRICT_JSON_RETRY_SYSTEM_PROMPT` at temperature 0.1
4. `_apply_defaults(data, _DEFAULTS)` — fill missing optional fields
5. `yield json.dumps(data)` — emit as single SSE chunk

## Failure modes handled
- Markdown code fences: ` ```json ... ``` ` or ` ``` ... ``` `
- Explanatory prose before `{` or after `}`
- Trailing commas before `}` or `]`
- Missing optional fields (defaults applied)
- Unicode / non-ASCII characters in resume content
- Special characters: `&`, `'`, `"`, `$`, `%` in company names
- `None` field values replaced by type-safe defaults

## Model notes
- Working model: `gemini-3.5-flash` (set via `GEMINI_MODEL` env var)
- `response_mime_type="application/json"` helps but does NOT guarantee clean JSON
- Retry system prompt lives in `backend/prompts/analysis_prompt.py` as `STRICT_JSON_RETRY_SYSTEM_PROMPT`
