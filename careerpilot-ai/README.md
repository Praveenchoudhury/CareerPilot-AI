# ⚡ CareerPilot AI

> **Your AI-Powered Career Co-Pilot** — Upload your resume and get instant AI-driven career intelligence: ATS analysis, skill roadmaps, interview prep, cover letters, LinkedIn optimization, and more.

---

## ✨ Features

| Module | Description |
|---|---|
| 📊 **ATS Score** | 0–100 compatibility score with reasoning |
| 💪 **Strengths & Weaknesses** | Honest assessment of your resume |
| 🎯 **Missing Skills** | Gap analysis vs. market expectations |
| 🛤️ **Career Path** | Short, mid, and long-term trajectories |
| 📅 **Skill Roadmap** | 30 / 60 / 90-day structured learning plan |
| 🏆 **Certifications** | Priority-ranked, industry-relevant certs |
| 🔨 **Portfolio Projects** | Project ideas matched to your skill level |
| 🎤 **Interview Questions** | Role-specific Q&A with model answers |
| 📝 **Cover Letter** | AI-generated, tailored to a job description |
| 🔗 **LinkedIn Tools** | Headline variants + About section rewrite |
| 💡 **Suggested Improvements** | Concrete, actionable resume edits |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- A Google Gemini API key ([get one free](https://aistudio.google.com/app/apikey))

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/your-username/careerpilot-ai.git
cd careerpilot-ai

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 5. Run the server
uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload

# 6. Open in browser
open http://localhost:8080
```

### Docker (recommended for production)

```bash
# Build and run
docker compose up --build

# Open in browser
open http://localhost:8080
```

---

## 🌐 API Reference

Interactive API docs available at `/api/docs` when the server is running.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/extract-pdf` | Extract text from PDF upload |
| `POST` | `/api/analyze` | Stream full AI career analysis |
| `POST` | `/api/cover-letter` | Stream cover letter generation |
| `POST` | `/api/linkedin` | Stream LinkedIn assets |

---

## ☁️ AWS App Runner Deployment

1. **Push to GitHub** (ensure `.env` is git-ignored).
2. In the AWS Console → App Runner → Create Service:
   - Source: **Container registry** (use ECR image built from `Dockerfile`)
   - Or source: **Source code repository** (uses `apprunner.yaml`)
3. Add environment variables:
   - `GEMINI_API_KEY` → mark as **secret**
   - `GEMINI_MODEL` → `gemini-2.5-flash-preview-05-20`
   - `PORT` → `8080`
4. Health check path: `/api/health`
5. Deploy — App Runner handles scaling automatically.

---

## 🗂️ Project Structure

```
careerpilot-ai/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, static file serving
│   ├── routers/
│   │   ├── health.py           # GET /api/health
│   │   └── analyze.py          # POST /api/extract-pdf, /analyze, /cover-letter, /linkedin
│   ├── services/
│   │   ├── pdf_extractor.py    # PyMuPDF text extraction
│   │   └── gemini_service.py   # Gemini streaming client
│   ├── models/
│   │   └── schemas.py          # Pydantic request/response models
│   └── prompts/
│       ├── analysis_prompt.py  # 13-section analysis prompt
│       ├── cover_letter_prompt.py
│       └── linkedin_prompt.py
├── frontend/
│   ├── index.html              # Single-page app shell
│   ├── css/
│   │   ├── style.css           # Global tokens, dark theme, layout
│   │   ├── components.css      # Glass cards, buttons, inputs, modals
│   │   ├── dashboard.css       # Dashboard grid and result cards
│   │   └── animations.css      # Loading states, transitions
│   └── js/
│       ├── app.js              # Bootstrap, state, view transitions
│       ├── upload.js           # Drag-drop, tabs, form submission
│       ├── stream.js           # SSE client and token renderer
│       ├── dashboard.js        # Result card rendering
│       ├── ats_ring.js         # Animated SVG ATS score ring
│       ├── cover_letter.js     # Cover letter modal
│       └── linkedin.js         # LinkedIn tools modal
├── Dockerfile
├── docker-compose.yml
├── apprunner.yaml
├── requirements.txt
├── .env.example
└── README.md
```

---

## 🔒 Security Notes

- API keys are **never** sent to the frontend — all Gemini calls happen server-side.
- Uploaded PDFs are processed in-memory and never persisted to disk.
- The `.env` file is git-ignored. Use AWS Secrets Manager or App Runner secrets for production.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Backend | Python 3.12, FastAPI, Uvicorn |
| AI | Google Gemini 2.5 Flash via `google-generativeai` |
| PDF parsing | PyMuPDF (`fitz`) |
| Streaming | Server-Sent Events (SSE) |
| Container | Docker, Docker Compose |
| Cloud | AWS App Runner |

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
