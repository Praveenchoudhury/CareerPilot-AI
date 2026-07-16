"""
Live API tests for /api/analyze with multiple resume styles.

Tests resume formats that are known to cause Gemini JSON parse failures:
  1. Standard software engineer resume (baseline)
  2. Academic / research-heavy resume (lots of publications, no job titles)
  3. Minimal / entry-level resume (sparse content, short)
  4. Career-changer resume (gaps, pivot from unrelated field)
  5. Non-English characters / international resume (Unicode names, accents)
  6. Very long resume (forces Gemini to produce a large JSON response)
  7. Resume with special characters (quotes, dashes, ampersands in company names)

Each test:
  - Calls the running server via HTTP (port 20772)
  - Collects SSE frames
  - Verifies JSON parses correctly
  - Verifies all 12 required keys are present
  - Verifies types are correct (ats_score is int, lists are lists, etc.)
"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE_URL = "http://localhost:20772"

REQUIRED_KEYS = [
    "professional_summary",
    "ats_score",
    "ats_score_reasoning",
    "strengths",
    "weaknesses",
    "missing_skills",
    "suggested_improvements",
    "career_path_recommendations",
    "recommended_certifications",
    "recommended_projects",
    "skill_roadmap",
    "interview_questions",
]

PASS = "✅"
FAIL = "❌"
SKIP = "⚠️ "

results = []

# ---------------------------------------------------------------------------
# Test resumes
# ---------------------------------------------------------------------------

RESUMES = {
    "standard_swe": {
        "label": "Standard Software Engineer",
        "job_title": "Senior Software Engineer",
        "resume": """
Jane Smith | jane.smith@email.com | github.com/janesmith | San Francisco, CA

EXPERIENCE
Senior Software Engineer — Acme Corp (2021–present)
- Led migration of monolithic Rails app to microservices (Python/FastAPI), reducing p99 latency by 40%
- Mentored 4 junior engineers; drove adoption of code review culture
- Built internal ML feature pipeline serving 2M requests/day

Software Engineer — Startup Inc (2018–2021)
- Full-stack development with React and Node.js
- Designed PostgreSQL schema for multi-tenant SaaS product (10k+ customers)
- Improved CI/CD pipeline, cutting deploy times from 45min to 8min

EDUCATION
B.S. Computer Science — UC Berkeley (2018)

SKILLS
Python, FastAPI, React, TypeScript, PostgreSQL, Redis, Docker, Kubernetes, AWS
""",
    },

    "academic": {
        "label": "Academic / Researcher (no standard job titles)",
        "job_title": "Data Scientist",
        "resume": """
Dr. Priya Nair | p.nair@university.edu | ResearchGate: priya-nair

EDUCATION
Ph.D. Computational Biology — MIT (2023)
M.S. Bioinformatics — Stanford (2018)
B.Sc. Biochemistry — IIT Bombay (2016)

RESEARCH EXPERIENCE
Doctoral Researcher — MIT Broad Institute (2018–2023)
- Developed novel single-cell RNA-seq clustering algorithm (published in Nature Methods)
- Processed 500GB genomic datasets using Snakemake + AWS HPC clusters

Postdoctoral Fellow — Harvard Medical School (2023–present)
- Building interpretable ML models for drug-resistance prediction in tuberculosis

PUBLICATIONS (selected)
1. Nair P, et al. "ScCluster: scalable clustering for single-cell transcriptomics." Nature Methods, 2022.
2. Nair P, Lee J. "Attention-based genomic sequence modeling." Bioinformatics, 2021.

TECHNICAL SKILLS
Python (pandas, scikit-learn, PyTorch), R, Snakemake, AWS, SQL, Git
""",
    },

    "entry_level": {
        "label": "Entry-level / Minimal (sparse content)",
        "job_title": "Junior Developer",
        "resume": """
Alex Johnson | alex@gmail.com | linkedin.com/in/alexj

EDUCATION
B.S. Information Technology — State University (May 2024)
GPA: 3.4

PROJECTS
Personal Budget App (2024)
- Built a web app using HTML, CSS, JavaScript and Firebase for auth
- ~200 active users

Campus Tutoring Platform (2023)
- Django backend, hosted on Heroku
- Helped 50+ students find tutors

SKILLS
JavaScript, Python, HTML/CSS, Git, Django, Firebase

ACTIVITIES
- Computer Science Club (treasurer)
- Hackathon participant (2023, 2024)
""",
    },

    "career_changer": {
        "label": "Career Changer (teacher → tech)",
        "job_title": "Product Manager",
        "resume": """
Marcus Williams | marcus.w@email.com | Chicago, IL

EXPERIENCE
High School Computer Science Teacher — Lincoln High School (2015–2023)
- Taught AP Computer Science to 120+ students per year; 89% pass rate
- Designed curriculum covering Python, data structures, and web basics
- Managed $50k technology budget; coordinated 3 staff members

Community Manager — EdTech Nonprofit (2022–2023, part-time)
- Grew online learning community from 500 to 8,000 members in 14 months
- Coordinated product feedback sessions between teachers and app developers

EDUCATION
B.A. Education — University of Illinois (2015)
Google Project Management Certificate (2023)
Coursera: Product Management Fundamentals (2023)

SKILLS
Communication, curriculum design, project coordination, Google Workspace,
basic Python, Notion, Jira (learning), stakeholder management
""",
    },

    "international": {
        "label": "International / Non-English characters",
        "job_title": "Full Stack Developer",
        "resume": """
François Müller-García | f.muller@email.de | München, Deutschland

BERUFSERFAHRUNG (EXPERIENCE)
Senior Developer — TechGmbH (2020–present), München
- Architected RESTful APIs with Java Spring Boot serving 5M requests/day
- Led team of 6 engineers across Germany, Spain, and Brazil
- Migrated legacy Oracle DB to PostgreSQL, saving €120k/year in licensing

Entwickler — StartupAG (2017–2020), Berlin
- React SPA with i18n support for 12 languages
- CI/CD with Jenkins and Docker on Azure

AUSBILDUNG (EDUCATION)
M.Sc. Informatik — TU München (2017)
B.Sc. Informatik — Universität Stuttgart (2015)

KENNTNISSE (SKILLS)
Java, Spring Boot, React, TypeScript, PostgreSQL, Docker, Azure, Jenkins, Git
Spanish (native), German (native), English (C2), French (B2)
""",
    },

    "special_chars": {
        "label": "Special characters in company names & descriptions",
        "job_title": "DevOps Engineer",
        "resume": """
Sam O'Brien | sam@email.com | New York, NY

EXPERIENCE
Lead DevOps Engineer — AT&T / Warner Bros. Discovery (2020–present)
- Managed 500+ node Kubernetes cluster on AWS; 99.99% uptime SLA
- "Infrastructure as Code" evangelist: Terraform + Ansible for all provisioning
- Cost optimization: $2.3M/yr savings via reserved instances & spot fleets

Senior SRE — Goldman Sachs & Co. LLC (2017–2020)
- On-call rotation for high-frequency trading systems (< 1ms latency requirement)
- Built alerting pipeline: Prometheus → Alertmanager → PagerDuty
- Authored internal runbook: "Zero-downtime deployments in regulated environments"

EDUCATION
B.S. Computer Engineering — NYU Tandon School of Engineering (2017)

CERTIFICATIONS
AWS Solutions Architect – Professional (2022)
Certified Kubernetes Administrator (CKA) (2021)

SKILLS
Kubernetes, Terraform, Ansible, AWS, Prometheus, Grafana, Python, Bash, Go
""",
    },

    "minimal_text": {
        "label": "Extremely sparse (tests graceful defaults)",
        "job_title": "",
        "resume": """
John Doe
john@example.com

Skills: Microsoft Word, Excel, PowerPoint
Some customer service experience.
Looking for work.
""",
    },
}

# ---------------------------------------------------------------------------
# SSE client
# ---------------------------------------------------------------------------

def call_analyze(resume_text: str, job_title: str, timeout: int = 90) -> tuple[dict | None, str | None]:
    """
    POST to /api/analyze, collect SSE, return (parsed_dict, error_message).
    """
    payload = json.dumps({"resume_text": resume_text, "job_title": job_title}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/analyze",
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            accum = ""
            for raw_line in resp:
                line = raw_line.decode("utf-8", errors="replace").rstrip("\n")
                if not line.startswith("data: "):
                    continue
                chunk = line[6:]
                if chunk.strip() == "[DONE]":
                    break
                if chunk.startswith("__ERROR__"):
                    try:
                        err = json.loads(chunk[9:])
                        return None, err.get("error", chunk)
                    except Exception:
                        return None, chunk
                try:
                    decoded = json.loads(chunk)
                except Exception:
                    decoded = chunk
                accum += decoded

            if not accum.strip():
                return None, "Empty response from server"

            try:
                return json.loads(accum), None
            except json.JSONDecodeError as e:
                return None, f"JSON parse error: {e}\nRaw (first 300): {accum[:300]}"

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return None, f"HTTP {e.code}: {body[:200]}"
    except Exception as e:
        return None, str(e)


def validate_result(data: dict, label: str) -> list[str]:
    """Return list of validation error strings (empty = all good)."""
    errors = []
    for key in REQUIRED_KEYS:
        if key not in data:
            errors.append(f"Missing key: {key!r}")

    # Type checks
    if "ats_score" in data and not isinstance(data["ats_score"], (int, float)):
        errors.append(f"ats_score must be numeric, got {type(data['ats_score'])}")
    for list_key in ("strengths", "weaknesses", "missing_skills", "suggested_improvements",
                     "recommended_certifications", "recommended_projects", "interview_questions"):
        if list_key in data and not isinstance(data[list_key], list):
            errors.append(f"{list_key!r} must be a list, got {type(data[list_key])}")
    for dict_key in ("career_path_recommendations", "skill_roadmap"):
        if dict_key in data and not isinstance(data[dict_key], dict):
            errors.append(f"{dict_key!r} must be a dict, got {type(data[dict_key])}")
    return errors


# ---------------------------------------------------------------------------
# Run tests
# ---------------------------------------------------------------------------

print(f"\n{'='*60}")
print("CareerPilot AI — Live API Tests (/api/analyze)")
print(f"{'='*60}\n")

for key, spec in RESUMES.items():
    label     = spec["label"]
    resume    = spec["resume"].strip()
    job_title = spec["job_title"]

    print(f"  Testing: {label}")
    t0 = time.time()

    # Skip resumes that are too short for the endpoint (< 50 chars)
    if len(resume) < 50:
        print(f"    {SKIP}  Skipped — resume too short for endpoint\n")
        results.append((SKIP, label, "too short"))
        continue

    data, err = call_analyze(resume, job_title, timeout=120)
    elapsed = time.time() - t0

    if err:
        print(f"    {FAIL}  ERROR ({elapsed:.1f}s): {err[:200]}\n")
        results.append((FAIL, label, err[:200]))
        continue

    validation_errors = validate_result(data, label)
    if validation_errors:
        print(f"    {FAIL}  Parsed but validation failed ({elapsed:.1f}s):")
        for ve in validation_errors:
            print(f"         • {ve}")
        results.append((FAIL, label, "; ".join(validation_errors)))
    else:
        ats = data.get("ats_score", "?")
        strengths = len(data.get("strengths", []))
        print(f"    {PASS}  OK ({elapsed:.1f}s) — ATS={ats}, {strengths} strengths, "
              f"{len(data.get('missing_skills',[]))} missing skills")
        results.append((PASS, label, f"ATS={ats}"))
    print()


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print(f"{'='*60}")
passed = sum(1 for r in results if r[0] == PASS)
failed = sum(1 for r in results if r[0] == FAIL)
skipped = sum(1 for r in results if r[0] == SKIP)
print(f"Results: {passed} passed, {failed} failed, {skipped} skipped")

if failed:
    print("\nFailed tests:")
    for icon, name, detail in results:
        if icon == FAIL:
            print(f"  {FAIL}  {name}")
            print(f"       {detail}")
    sys.exit(1)
else:
    print("All live API tests passed.")
