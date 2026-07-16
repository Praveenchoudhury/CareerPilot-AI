"""
Unit tests for the robust JSON parsing logic in gemini_service.py.

Tests all failure modes that Gemini produces in the wild:
  - Markdown code fences (```json ... ```)
  - Explanatory text before/after the JSON
  - Trailing commas
  - Missing optional fields (defaults applied)
  - Already-clean JSON (regression guard)
  - Escaped characters inside string values
"""
import json
import sys
import os

# Allow running from the careerpilot-ai/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.services.gemini_service import (
    _clean_json,
    _repair_json,
    _parse_json_robust,
    _apply_defaults,
    _ANALYSIS_DEFAULTS,
)

PASS = "✅"
FAIL = "❌"
results = []


def check(name: str, condition: bool, detail: str = ""):
    icon = PASS if condition else FAIL
    results.append((icon, name, detail))
    print(f"  {icon}  {name}" + (f" — {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# 1. _clean_json: markdown fences
# ---------------------------------------------------------------------------
print("\n── _clean_json: markdown fences ───────────────────────────────")

raw1 = '```json\n{"key": "value"}\n```'
got1 = _clean_json(raw1)
check("Strips ```json fence", got1 == '{"key": "value"}', repr(got1))

raw2 = '```\n{"key": "value"}\n```'
got2 = _clean_json(raw2)
check("Strips plain ``` fence", got2 == '{"key": "value"}', repr(got2))

raw3 = '```JSON\n{"key": "value"}\n```'
got3 = _clean_json(raw3)
check("Strips ```JSON (uppercase) fence", got3 == '{"key": "value"}', repr(got3))

# ---------------------------------------------------------------------------
# 2. _clean_json: surrounding prose
# ---------------------------------------------------------------------------
print("\n── _clean_json: surrounding prose ─────────────────────────────")

raw4 = 'Here is the JSON you requested:\n{"key": "value"}\nLet me know if you need anything else.'
got4 = _clean_json(raw4)
check("Strips prose before {", got4.startswith('{"key"'), repr(got4))
check("Strips prose after }", got4.endswith("}"), repr(got4))

raw5 = 'Sure! ```json\n{"nested": {"a": 1}}\n```\nHope this helps!'
got5 = _clean_json(raw5)
check("Prose + fence + nested JSON", json.loads(got5) == {"nested": {"a": 1}}, repr(got5))

# ---------------------------------------------------------------------------
# 3. _clean_json: already-clean JSON (regression guard)
# ---------------------------------------------------------------------------
print("\n── _clean_json: already-clean JSON ────────────────────────────")

raw6 = '{"ats_score": 82, "strengths": ["Python", "FastAPI"]}'
got6 = _clean_json(raw6)
check("Clean JSON unchanged", got6 == raw6, repr(got6))

# ---------------------------------------------------------------------------
# 4. _repair_json: trailing commas
# ---------------------------------------------------------------------------
print("\n── _repair_json: trailing commas ───────────────────────────────")

tc1 = '{"a": 1, "b": [1, 2,]}'
got_tc1 = _repair_json(tc1)
check("Trailing comma in array", json.loads(got_tc1) == {"a": 1, "b": [1, 2]})

tc2 = '{"a": 1, "b": 2,}'
got_tc2 = _repair_json(tc2)
check("Trailing comma in object", json.loads(got_tc2) == {"a": 1, "b": 2})

tc3 = '{"a": [{"x": 1,}],}'
got_tc3 = _repair_json(tc3)
check("Nested trailing commas", json.loads(got_tc3) == {"a": [{"x": 1}]})

# ---------------------------------------------------------------------------
# 5. _parse_json_robust: full pipeline
# ---------------------------------------------------------------------------
print("\n── _parse_json_robust: full pipeline ──────────────────────────")

# Clean JSON
clean = '{"ats_score": 77, "strengths": ["Teamwork"]}'
r = _parse_json_robust(clean, "test")
check("Clean JSON parses", r == {"ats_score": 77, "strengths": ["Teamwork"]})

# Fenced
fenced = '```json\n{"ats_score": 77, "strengths": ["Teamwork"]}\n```'
r2 = _parse_json_robust(fenced, "test")
check("Fenced JSON parses", r2 == {"ats_score": 77, "strengths": ["Teamwork"]})

# Prose + fence + trailing comma
messy = 'Here is the analysis:\n```json\n{"ats_score": 77, "strengths": ["Teamwork",],}\n```\nDone!'
r3 = _parse_json_robust(messy, "test")
check("Prose + fence + trailing comma parses", r3.get("ats_score") == 77)

# Embedded newlines in string values
embedded_nl = '{"summary": "Line one.\\nLine two.\\nLine three."}'
r4 = _parse_json_robust(embedded_nl, "test")
check("Embedded \\n in string values parses", "Line one." in r4.get("summary", ""))

# Unicode characters
unicode_val = '{"summary": "Résumé analysis for José García, PhD."}'
r5 = _parse_json_robust(unicode_val, "test")
check("Unicode characters parse", "José" in r5.get("summary", ""))

# Truly invalid JSON raises
import traceback
raised = False
try:
    _parse_json_robust("{not valid json at all %%%}", "test")
except json.JSONDecodeError:
    raised = True
check("Invalid JSON raises JSONDecodeError", raised)

# ---------------------------------------------------------------------------
# 6. _apply_defaults: missing fields filled in
# ---------------------------------------------------------------------------
print("\n── _apply_defaults: missing optional fields ────────────────────")

partial = {"ats_score": 82, "professional_summary": "Good engineer."}
filled = _apply_defaults(partial, _ANALYSIS_DEFAULTS)

check("ats_score preserved", filled["ats_score"] == 82)
check("professional_summary preserved", filled["professional_summary"] == "Good engineer.")
check("strengths defaulted to []", filled["strengths"] == [])
check("skill_roadmap defaulted", isinstance(filled["skill_roadmap"], dict))
check("interview_questions defaulted to []", filled["interview_questions"] == [])
check("career_path_recommendations defaulted", isinstance(filled["career_path_recommendations"], dict))

# Existing non-None field not overwritten
partial2 = {"strengths": ["Leadership"], "ats_score": 70}
filled2 = _apply_defaults(partial2, _ANALYSIS_DEFAULTS)
check("Existing field not overwritten", filled2["strengths"] == ["Leadership"])

# None field gets default
partial3 = {"ats_score": None, "strengths": None}
filled3 = _apply_defaults(partial3, _ANALYSIS_DEFAULTS)
check("None ats_score replaced by default", filled3["ats_score"] == 0)
check("None strengths replaced by []", filled3["strengths"] == [])

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print("\n" + "─" * 55)
passed = sum(1 for r in results if r[0] == PASS)
failed = sum(1 for r in results if r[0] == FAIL)
print(f"Results: {passed} passed, {failed} failed")
if failed:
    print("\nFailed tests:")
    for icon, name, detail in results:
        if icon == FAIL:
            print(f"  {FAIL}  {name}  {detail}")
    sys.exit(1)
else:
    print("All parser unit tests passed.")
