"""
Targeted 2-resume test — run after rate limit window clears.

Resume A: Standard SWE (previously worked)
Resume B: Academic/sparse with Unicode (previously failed)

Verifies:
  - Both complete within 60s or return a friendly error
  - JSON parses correctly on success
  - Stage logs are visible in server output
  - Error frame reaches frontend (never hangs)
"""
import json, sys, time, urllib.request, urllib.error

BASE_URL = "http://localhost:20772"

REQUIRED_KEYS = [
    "professional_summary", "ats_score", "ats_score_reasoning",
    "strengths", "weaknesses", "missing_skills", "suggested_improvements",
    "career_path_recommendations", "recommended_certifications",
    "recommended_projects", "skill_roadmap", "interview_questions",
]

RESUME_A = {
    "label": "Standard SWE (previously worked)",
    "job_title": "Senior Software Engineer",
    "resume": """
Jane Smith | jane.smith@email.com | github.com/janesmith

EXPERIENCE
Senior Software Engineer — Acme Corp (2021–present)
- Led migration of monolithic Rails app to microservices (Python/FastAPI), reducing p99 latency by 40%
- Mentored 4 junior engineers and drove adoption of code review culture
- Built internal ML feature pipeline serving 2M requests/day

Software Engineer — Startup Inc (2018–2021)
- Full-stack development with React and Node.js
- Designed PostgreSQL schema for multi-tenant SaaS (10k+ customers)
- Cut CI/CD deploy times from 45min to 8min

EDUCATION
B.S. Computer Science — UC Berkeley (2018)

SKILLS
Python, FastAPI, React, TypeScript, PostgreSQL, Redis, Docker, Kubernetes, AWS
""".strip(),
}

RESUME_B = {
    "label": "Academic/Unicode résumé (previously failed)",
    "job_title": "Data Scientist",
    "resume": """
Dr. François Müller-García | f.muller@university.edu

EDUCATION
Ph.D. Computational Biology — MIT (2023) — GPA 4.0
M.S. Bioinformatics — Stanford (2018)
B.Sc. Biochemistry — IIT Bombay (2016)

RESEARCH
Doctoral Researcher — MIT Broad Institute (2018–2023)
- Developed novel single-cell RNA-seq clustering algorithm (Nature Methods, 2022)
- Processed 500 GB genomic datasets on AWS HPC clusters using Snakemake

Postdoctoral Fellow — Harvard Medical School (2023–present)
- Building interpretable ML models for drug-resistance prediction in TB

PUBLICATIONS
1. Müller-García F, et al. "ScCluster: scalable clustering for scRNA-seq." Nature Methods 2022.
2. Müller-García F, Lee J. "Attention-based genomic sequence modeling." Bioinformatics 2021.

SKILLS
Python (pandas, scikit-learn, PyTorch), R, Snakemake, AWS, SQL, Git
Spanish (native), German (native), English (C2)
""".strip(),
}


def call_analyze(resume_text, job_title, timeout=65):
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
                return None, "Empty response"
            try:
                return json.loads(accum), None
            except json.JSONDecodeError as e:
                return None, f"JSON parse error: {e}\nRaw (first 300): {accum[:300]}"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return None, f"HTTP {e.code}: {body[:300]}"
    except Exception as e:
        return None, str(e)


PASS, FAIL = "✅", "❌"
all_passed = True

print(f"\n{'='*62}")
print("CareerPilot AI — Targeted 2-Resume Test")
print(f"{'='*62}\n")

for spec in [RESUME_A, RESUME_B]:
    print(f"  Resume: {spec['label']}")
    t0 = time.time()
    data, err = call_analyze(spec["resume"], spec["job_title"])
    elapsed = time.time() - t0

    if err:
        # A friendly error returned within the timeout is still a pass for
        # reliability (never hangs), but we note it.
        if elapsed < 62:
            print(f"    {FAIL}  Error after {elapsed:.1f}s (but within timeout): {err[:200]}")
            all_passed = False
        else:
            print(f"    {FAIL}  HUNG for {elapsed:.1f}s — timeout NOT working!")
            all_passed = False
        print()
        continue

    missing = [k for k in REQUIRED_KEYS if k not in data]
    ats = data.get("ats_score", "?")
    strengths = len(data.get("strengths", []))

    if missing:
        print(f"    {FAIL}  Parsed but missing keys ({elapsed:.1f}s): {missing}")
        all_passed = False
    else:
        print(f"    {PASS}  OK ({elapsed:.1f}s) — ATS={ats}, {strengths} strengths")
    print()

print(f"{'='*62}")
print("All tests passed." if all_passed else "Some tests FAILED — see above.")
sys.exit(0 if all_passed else 1)
