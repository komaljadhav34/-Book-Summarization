# <img src="assets/logo.png" width="48" align="center" /> SynopsAI — Intelligent Document Intelligence Platform

An AI-powered full-stack web application that transforms any document into a complete knowledge experience. Upload PDFs, DOCX, TXT files, paste text, or drop a YouTube URL — get summaries, chat with the document, generate quizzes, mind maps, and sentence-level explanations.

Powered by **Groq API (llama-3.3-70b-versatile)** — free tier, ~14,000 requests/day.

---

## Features

### Input Sources (all three support every feature below)
| Source | How |
|--------|-----|
| **File upload** | PDF, TXT, DOCX — up to 200 MB |
| **Paste text** | Direct text input up to 10,000 words |
| **YouTube URL** | Auto-extracts transcript from any captioned video |

### AI Summarization
- **Groq-powered** — `llama-3.3-70b-versatile` via free-tier API
- **3 formats** — Concise, Detailed, Bullet Points (proper newline-separated bullets)
- **10 role-based lenses** — General, Executive, Technical, Student, Researcher, Legal, Creative, Medical, Analyst, Educator
- **Smart chunking** — short texts use one API call; long docs chunk → summarise → merge
- **Topic extraction** — TF-IDF keyword tags shown per summary
- **Compression badge** — shows original vs summary word count + % reduction

### Ask AI (RAG Pipeline)
Chat with your document. Fully automated — no hardcoded synonyms.

**Pipeline:**
1. **Query expansion** — Groq rewrites your question into 12-15 search terms automatically (handles synonyms, abbreviations, domain-specific phrasing)
2. **BM25 retrieval** — scores all document chunks, picks top 6 most relevant
3. **Context assembly** — summary + retrieved passages sent to Groq
4. **Answer** — cited, grounded response with passage references

Works for any question on any topic. "Future scope", "methodology", "contributions", "conclusion" — all handled even when worded differently in the document.

### Key Insights
Click **Key Insights** above any summary to extract 3-5 concise numbered insights via Groq. Reveals the most important takeaways at a glance.

### Explain Mode
Hover any sentence in the summary → click **Explain**. A popup appears with 4 modes:
- **Explain** — clear accurate explanation
- **Simplify** — plain language, no jargon
- **Example** — concrete real-world example
- **ELI5** — explain like I'm 10

### Quiz
Auto-generate 10 multiple-choice questions (3 easy / 4 medium / 3 hard) with explanations. Score tracked in real time.

### Mind Map
Groq generates a Mermaid `flowchart LR` diagram of key concepts. Full-screen modal with drag-to-pan, scroll-to-zoom, fit-to-screen, and PNG export.

### Export
Download summaries as **TXT**, **DOCX** (styled), or **PDF** (styled).

### UI/UX
- Dark / light mode toggle (persists in localStorage)
- Animated processing screen — nerd character, progress bar, rotating AI facts
- **Did You Know?** sidebar panel with 12 sourced NLP/AI facts (2023–2025), rotating every 8 seconds
- Particle canvas background, floating blobs, glassmorphism
- Summary history — searchable, click any to reopen
- Feedback (thumbs up/down) per summary

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| **Database** | PostgreSQL |
| **AI / LLM** | Groq API — `llama-3.3-70b-versatile` (free tier) |
| **Summarization** | Groq — single-pass or chunk-merge pipeline |
| **Ask AI** | Groq query expansion + BM25 retrieval + Groq answer |
| **Quiz** | Groq — 10 validated MCQs with difficulty levels |
| **Mind Maps** | Groq → Mermaid `flowchart LR` + deterministic fallback |
| **Insights / Explain** | Groq — structured prompts per mode |
| **Topic Extraction** | TF-IDF (scikit-learn) — local, no GPU |
| **Document Parsing** | pdfplumber, python-docx |
| **YouTube** | youtube-transcript-api |
| **Export** | python-docx (DOCX), fpdf2 (PDF) |
| **Auth** | JWT (python-jose) + bcrypt (passlib) |
| **Frontend** | React 18, Vite 5, react-router-dom v6, lucide-react |
| **Diagrams** | Mermaid 10 (CDN), Outfit font (Google Fonts) |

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL running locally

---

### 1. Clone & configure

```bash
git clone <repo-url>
cd bookSummarizer
```

Create `bookSummarizer/.env`:
```env
DATABASE_URL=postgresql://<user>@localhost:5432/synopsai
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
GROQ_API_KEY=gsk_...   # free at console.groq.com
```

---

### 2. Backend

```bash
cd bookSummarizer

# Virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install groq

# Create database
createdb synopsai

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --reload --port 8000
```

---

### 3. Frontend

```bash
cd bookSummarizer/frontend

npm install
npm run dev        # runs at http://localhost:3000
```

The Vite dev server proxies `/api` → `localhost:8000` automatically.

---

## Project Structure

```
bookSummarizer/
├── .env
├── requirements.txt
├── alembic.ini
├── alembic/versions/
├── app/
│   ├── main.py                         # FastAPI app, CORS, router registration
│   ├── api/
│   │   ├── auth.py                     # Register, login, /me
│   │   ├── books.py                    # All book endpoints (upload, summarize, Q&A, export...)
│   │   ├── quizzes.py                  # Quiz generation and answer submission
│   │   ├── feedback.py                 # Thumbs-up / thumbs-down ratings
│   │   ├── admin.py                    # Admin: stats, user/book management
│   │   └── deps.py                     # DB session, current user helpers
│   ├── core/
│   │   ├── config.py                   # Settings (GROQ_API_KEY, DATABASE_URL, limits)
│   │   ├── database.py                 # SQLAlchemy engine + session
│   │   └── security.py                 # JWT + bcrypt
│   ├── models/
│   │   └── book.py                     # ORM: User, Book, Summary, Job, Feedback, Quiz, Question
│   └── services/
│       ├── summarizer.py               # Groq summarization pipeline
│       ├── ask_service.py              # RAG: query expansion → BM25 → Groq answer
│       ├── explain_service.py          # Explain/Simplify/Example/ELI5 via Groq
│       ├── insights_service.py         # Key insights extraction via Groq
│       ├── quiz_generator.py           # MCQ generation via Groq
│       ├── mindmap_service.py          # Mermaid flowchart via Groq + fallback parser
│       ├── chunking.py                 # Heading-aware paragraph splitting
│       ├── extractive.py               # TF-IDF topic extraction
│       ├── preprocessing.py            # PDF / DOCX / TXT text extraction + cleaning
│       ├── role_prompts.py             # 10 role-specific prompt prefixes
│       ├── export_service.py           # TXT / DOCX / PDF export
│       ├── youtube_service.py          # YouTube transcript extraction
│       └── worker.py                   # Background job processor
└── frontend/
    ├── index.html                      # Entry point — favicon references
    ├── vite.config.js                  # Vite + React, /api proxy to :8000
    ├── package.json
    └── src/
        ├── App.jsx                     # Routes, particle canvas, providers
        ├── index.css                   # Global styles, dark/light vars, animations
        ├── main.jsx
        ├── context/
        │   ├── AuthContext.jsx         # JWT token + user state
        │   ├── ThemeContext.jsx        # Dark/light mode (localStorage)
        │   └── SummaryOptionsContext.jsx  # Shared format + role state
        ├── api/
        │   └── client.js              # All fetch wrappers for every endpoint
        ├── components/
        │   ├── Sidebar.jsx            # Nav, format/role pickers, nerd facts panel
        │   ├── Ui.jsx                 # Btn, Spinner, Badge, ErrorBox, etc.
        │   └── MindMapModal.jsx       # Full-screen Mermaid viewer
        └── pages/
            ├── AuthPage.jsx           # Landing page + login/register
            ├── UploadPage.jsx         # New summary: format/role/input tabs
            ├── ProcessingPage.jsx     # Animated processing screen
            ├── SummaryPage.jsx        # Result: Summary, Ask AI, Quiz, Mind Map tabs
            ├── HistoryPage.jsx        # Searchable summary history
            └── AdminPage.jsx          # Admin dashboard
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register |
| `POST` | `/api/auth/token` | Login → JWT |
| `GET`  | `/api/auth/me` | Current user |

### Books & Summarization
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/books/upload` | Upload files |
| `POST` | `/api/books/text` | Paste text |
| `POST` | `/api/books/youtube` | YouTube URL |
| `GET`  | `/api/books/status/{job_id}` | Poll job |
| `GET`  | `/api/books/summary/{book_id}` | Get summary |
| `GET`  | `/api/books/mindmap/{book_id}` | Mermaid flowchart |
| `GET`  | `/api/books/export/{book_id}?format=txt\|docx\|pdf` | Download |
| `GET`  | `/api/books/` | List all user books |
| `DELETE` | `/api/books/{book_id}` | Delete |

### AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/books/{book_id}/ask` | RAG document Q&A |
| `POST` | `/api/books/{book_id}/explain` | Explain a passage (4 modes) |
| `GET`  | `/api/books/{book_id}/insights` | Key insights |

### Quiz & Feedback
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/quizzes/books/{book_id}/generate` | Generate quiz |
| `GET`  | `/api/quizzes/{quiz_id}` | Fetch quiz |
| `POST` | `/api/quizzes/question/{question_id}/attempt` | Submit answer |
| `POST` | `/api/feedback/` | Thumbs up/down |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/admin/stats` | Platform stats |
| `GET`  | `/api/admin/users` | All users |
| `DELETE` | `/api/admin/users/{user_id}` | Delete user |
| `PATCH` | `/api/admin/users/{user_id}/role` | Change role |
| `GET`  | `/api/admin/books` | All books |
| `GET`  | `/api/admin/jobs` | All jobs |

---

## Known Limitations

| Limitation | Detail |
|------------|--------|
| **YouTube captions required** | Only videos with auto-generated or manual subtitles work. Use "Paste Text" to paste the transcript manually. |
| **Groq rate limits** | ~14,000 req/day, ~30 req/min on free tier. Long documents with many chunks may hit limits briefly. |
| **Mind map on unstructured text** | Very short or purely prose documents fall back to the deterministic parser instead of Groq. |
| **Ask AI context window** | Retrieves top-6 chunks (~3,000 words). Very long documents may miss some passages if they score below the top-6. |

---

## Future Scope

- [ ] Streaming summarization (server-sent events)
- [ ] Multi-document comparison
- [ ] Saved quiz history + leaderboard
- [ ] Shareable summary links
- [ ] Vector embeddings (pgvector) for Ask AI — higher recall than BM25

---

## License

Educational and personal use.