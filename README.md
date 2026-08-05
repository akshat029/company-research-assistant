# 🔍 AI-Powered Company Research Assistant

> Research any company instantly — by name or website URL — using a multi-tool AI agent powered by LangChain, GPT-4o/Groq, and Tavily Search.

![Tech Stack](https://img.shields.io/badge/FastAPI-0.115-green) ![LangChain](https://img.shields.io/badge/LangChain-0.3-blue) ![React](https://img.shields.io/badge/React-18-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🏢 **Company Overview** | Description, industry, founded, HQ, size, type, tagline |
| 📦 **Products & Services** | Full product/service catalog with categories |
| 👥 **Leadership Team** | CEO, CTO, founders with LinkedIn links |
| 📰 **Recent News** | Latest news with sentiment analysis |
| 💰 **Funding & Financials** | Total funding, valuation, funding rounds, investors |
| 🏆 **Competitors** | Market competitors with descriptions |
| 🛠️ **Tech Stack** | Technologies used by category |
| 📱 **Social Media** | LinkedIn, Twitter/X, GitHub, Facebook links |
| 🎯 **SWOT Analysis** | Strengths, Weaknesses, Opportunities, Threats |
| 🤖 **AI Executive Summary** | 3-4 sentence AI-generated executive summary |
| ⚡ **Smart Caching** | 1-hour LRU cache to avoid redundant searches |
| 🔌 **REST API** | Full OpenAPI docs at `/docs` |

---

## 🏗️ Architecture

```
company-research-assistant/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── config.py          # Pydantic settings
│   │   ├── models.py          # Request/Response schemas
│   │   ├── agent/
│   │   │   ├── research_agent.py  # LangGraph ReAct agent
│   │   │   ├── tools.py           # Web scraper + search helpers
│   │   │   └── prompts.py         # System prompts
│   │   ├── api/
│   │   │   └── routes.py      # REST endpoints
│   │   └── utils/
│   │       ├── url_resolver.py # URL/name detection
│   │       └── cache.py        # LRU cache with TTL
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                   # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── App.tsx            # Root component
│   │   ├── components/
│   │   │   ├── SearchBar.tsx      # Input + depth selector
│   │   │   ├── CompanyProfile.tsx # Full results display
│   │   │   ├── LoadingState.tsx   # Animated loading UI
│   │   │   └── ErrorState.tsx     # Error display
│   │   ├── hooks/
│   │   │   └── useResearch.ts # API call + progress hook
│   │   └── types/index.ts     # TypeScript interfaces
│   ├── Dockerfile             # Multi-stage nginx build
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

### Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | Groq Llama 3.3 (free, default) or OpenAI GPT-4o |
| **Agent Framework** | LangChain + LangGraph (ReAct agent) |
| **Web Search** | Tavily API (1000 searches/month free) |
| **Web Scraping** | requests + BeautifulSoup4 |
| **Backend API** | FastAPI + Uvicorn |
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS |
| **Containerization** | Docker + docker-compose |
| **Cache** | In-memory LRU with TTL |

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Notes |
|---|---|
| Python 3.10+ | `python --version` |
| Node.js 18+ | **Required** for the frontend — https://nodejs.org (LTS). Verify with `node --version` |
| API keys | See below — both providers have free tiers |

> ⚠️ `setup.sh` is a **bash** script (macOS/Linux/WSL/Git Bash only). On Windows CMD or
> PowerShell it will fail — follow the manual steps below instead.

### 1. Get API Keys (all have free tiers)

| Key | Where to Get | Cost |
|---|---|---|
| `GROQ_API_KEY` | https://console.groq.com | **FREE** ← recommended |
| `TAVILY_API_KEY` | https://app.tavily.com | **FREE** (1000/mo) |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | Pay per use (optional) |

> 💡 The default config uses **Groq**, so you only need `GROQ_API_KEY` +
> `TAVILY_API_KEY` for a completely free setup.

### 2. Backend Setup

**macOS / Linux**

```bash
cd backend

cp .env.example .env          # then edit .env with your keys

python -m venv venv
source venv/bin/activate

python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

**Windows (CMD / PowerShell)**

```bat
cd backend

REM 'cp' does not exist on Windows -- use copy.
REM Skip this if you already have a .env with real keys; it overwrites them.
copy .env.example .env
notepad .env

python -m venv venv
venv\Scripts\activate

REM Always use "python -m" so pip and uvicorn resolve inside the venv,
REM not against a different Python on your PATH.
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Sanity-check that you are inside the venv before installing:

```bat
python -c "import sys; print(sys.executable)"
REM should end in ...\backend\venv\Scripts\python.exe
```

Backend running at: http://localhost:8000  
API Docs: http://localhost:8000/docs

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend running at: http://localhost:5173

> The backend must be running first. The frontend calls
> `http://localhost:8000/api/v1` by default (override with `VITE_API_URL`).

---

## 🐳 Docker Deployment (One Command)

```bash
# Copy and fill in your API keys
cp backend/.env.example backend/.env    # Windows: copy backend\.env.example backend\.env
# Edit backend/.env

# Build and start everything
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 📡 API Reference

All routes are mounted under the `/api/v1` prefix.

### POST `/api/v1/research`

Research a company by name or URL.

**Request:**
```json
{
  "query": "OpenAI",
  "depth": "standard"
}
```

**Depth options:**
- `quick` — Fast overview (~30s, 5-6 searches)
- `standard` — Thorough research (~90s, 8-10 searches)
- `deep` — Exhaustive deep-dive (~3min, 12+ searches + website scraping)

**Response:**
```json
{
  "status": "completed",
  "query": "OpenAI",
  "cached": false,
  "duration_seconds": 45.2,
  "result": {
    "basic_info": { "name": "OpenAI", "industry": "Artificial Intelligence", ... },
    "products_and_services": [...],
    "leadership": [...],
    "recent_news": [...],
    "financial_info": { "total_funding": "$11.3B", ... },
    "competitors": [...],
    "tech_stack": [...],
    "social_media": {...},
    "swot_analysis": { "strengths": [...], "weaknesses": [...], ... },
    "ai_summary": "OpenAI is a leading AI research company...",
    "research_confidence": "high",
    "sources": ["https://...", ...]
  }
}
```

### GET `/api/v1/health`
Health check + configuration status.

### DELETE `/api/v1/cache`
Clear the research cache.

### GET `/api/v1/research/examples`
Get example queries to try.

---

## ⚙️ Configuration

All settings are in `backend/.env`:

```env
# LLM Provider: groq (free) or openai (paid)
LLM_PROVIDER=groq

# FREE - required when LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# Paid alternative - only when LLM_PROVIDER=openai.
# Leave commented out otherwise; a placeholder value causes a 401.
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o

# Max generated tokens. Counts against Groq's TPM quota - keep modest.
LLM_MAX_TOKENS=2048

# Search (free tier: 1000/month)
TAVILY_API_KEY=tvly-...

# Tune research
MAX_SEARCH_RESULTS=8
RESEARCH_TIMEOUT_SECONDS=120

# Cache settings
ENABLE_CACHE=true
CACHE_TTL_SECONDS=3600
```

**Restart the backend after editing `.env`.** Settings are cached with
`@lru_cache`, so `--reload` alone will not always pick up changes.

---

## 🧠 How It Works

```
User Input (name or URL)
        │
        ▼
   URL Resolver
  (detect URL vs name)
        │
        ▼
  LangGraph ReAct Agent
        │
    ┌───┴────────────────┐
    ▼                    ▼                    ▼
web_search()      search_news()          scrape_url()
(Tavily API)      (Tavily News)         (BeautifulSoup)
    └───┬────────────────┘
        │
        ▼
  LLM Extraction
  (Groq / GPT-4o)
        │
        ▼
  Structured JSON
  (Pydantic models)
        │
        ▼
   LRU Cache
        │
        ▼
   API Response
        │
        ▼
  React UI (Beautiful)
```

1. **Input resolution**: Detects if input is a company name or URL
2. **ReAct Agent**: LangGraph agent with 3 tools: `web_search`, `search_news`, `scrape_url`
3. **Multi-source research**: Searches Tavily (web + news) + optionally scrapes the company website
4. **LLM extraction**: Groq/GPT-4o extracts structured data into typed Pydantic models
5. **Caching**: Results cached for 1 hour to avoid redundant API calls
6. **Beautiful UI**: React frontend with animated loading, collapsible sections, SWOT cards

---

## 🧪 Testing

```bash
# Health check
curl http://localhost:8000/api/v1/health

# Test with curl
curl -X POST http://localhost:8000/api/v1/research \
  -H 'Content-Type: application/json' \
  -d '{"query": "Stripe", "depth": "standard"}'

# Test with URL input
curl -X POST http://localhost:8000/api/v1/research \
  -H 'Content-Type: application/json' \
  -d '{"query": "https://anthropic.com", "depth": "quick"}'
```

On Windows CMD, use double quotes and escape the inner ones:

```bat
curl -X POST http://localhost:8000/api/v1/research -H "Content-Type: application/json" -d "{\"query\":\"Stripe\",\"depth\":\"quick\"}"
```

---

## 📁 Project Checklist

- [x] Company name input
- [x] Website URL input with auto-detection
- [x] Quick / Standard / Deep research modes
- [x] Company overview (name, description, industry, HQ, size, founded)
- [x] Products & services catalog
- [x] Leadership team
- [x] Recent news with sentiment analysis
- [x] Funding & financial information
- [x] Competitors
- [x] Tech stack
- [x] Social media links
- [x] Culture & hiring status
- [x] SWOT analysis
- [x] AI executive summary
- [x] Research confidence scoring
- [x] Source citations
- [x] LRU caching with TTL
- [x] REST API with OpenAPI docs
- [x] Docker + docker-compose
- [x] Beautiful React UI
- [x] Error handling + retry
- [x] Loading animations with progress

---

## 🛠️ Troubleshooting

**`Node.js not found` when running `setup.sh`**
→ Install the Node.js LTS build from https://nodejs.org, then reopen your terminal
  so `PATH` refreshes. On Windows, run the manual steps above instead of `setup.sh`.

**`Incorrect API key provided: sk-your-***here` (HTTP 401)**
→ Your `.env` still has the placeholder from `.env.example`. Set `LLM_PROVIDER=groq`
  and a real `GROQ_API_KEY`, and comment out `OPENAI_API_KEY` entirely.
  Restart the backend afterwards.

**`No module named 'langchain_openai'` / `'langchain_groq'`**
→ Dependencies were not installed into the venv you are running from. Activate the
  venv, confirm `python -c "import sys; print(sys.executable)"` points inside
  `backend/venv`, then run `python -m pip install -r requirements.txt`.
  Start the server with `python -m uvicorn` (not bare `uvicorn`).

**`Client.__init__() got an unexpected keyword argument 'proxies'`**
→ httpx 0.28 removed the `proxies` argument that older OpenAI/Groq clients pass.
  `requirements.txt` pins `httpx==0.27.2`; reinstall it with
  `python -m pip install "httpx==0.27.2"`.

**`Request too large ... TPM: Limit 12000` (HTTP 413)**
→ You exceeded Groq's tokens-per-minute quota. Lower `LLM_MAX_TOKENS` (2048 or less),
  use `quick` depth, reduce `MAX_SEARCH_RESULTS`, and wait ~60s between retries.
  Note `llama-3.1-8b-instant` has a *lower* free-tier limit (6000 TPM) than
  `llama-3.3-70b-versatile` (12000 TPM), so switching to it makes this worse.

**`Cannot connect to the API server`**
→ The backend is not running. Start it with
  `python -m uvicorn app.main:app --reload --port 8000` from the `backend/` folder,
  and confirm http://localhost:8000/api/v1/health responds.
  Check for a stale process with `netstat -ano | findstr :8000` (Windows).

**`404 Not Found` when calling `/health` or `/research`**
→ Routes are mounted under `/api/v1`. Use `/api/v1/health` and `/api/v1/research`.

**Research returns empty/partial data**
→ Try `deep` depth for more thorough research.
→ Some private companies have limited public information.

**Slow research (>3 minutes)**
→ Switch to `quick` depth.
→ Groq is generally faster than OpenAI for this workload.

---

Made with ❤️ using LangChain + FastAPI + React
