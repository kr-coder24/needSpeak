# Context-to-Cart | Amazon Hackon 2026

> **Idea 1 Foundation** — Paste any recipe, shopping list, or URL. AI extracts what you need, maps to real products, builds your cart instantly.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+ (with pip/venv)
- Node.js 18+ (or Bun)
- A Google Gemini API key **or** AWS CLI configured with credentials (`aws configure`)

> [!NOTE]
> If using Gemini with `MOCK_AWS=1` you do **not** need any AWS account, DynamoDB tables, or S3 bucket.

### 1. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

> **DynamoDB seed (Full AWS only):** If running with `MOCK_AWS=0`, seed the product catalog:
> ```bash
> python seed_catalog.py
> ```
> This writes 80 realistic Indian product SKUs to DynamoDB. Safe to re-run.  
> With `MOCK_AWS=1` this step is unnecessary — the backend loads a built-in mock catalog automatically.

### 2. Configure Environment

Create `backend/.env`. The project supports two LLM providers and an independent AWS mock toggle so you can mix-and-match.

```env
# ─────────────────────────────────────────────────────────────────────────────
# LLM PROVIDER — Choose ONE: "gemini" or "bedrock"
# ─────────────────────────────────────────────────────────────────────────────
LLM_PROVIDER=gemini

# ─── Option A: Google Gemini (default, no AWS needed) ────────────────────────
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL_ID=gemini-2.5-flash          # primary model (fallbacks: 2.5-flash-lite, 2.0-flash, 1.5-flash)

# ─── Option B: Amazon Bedrock (requires AWS credentials + inference profile) ─
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-6   # or the full inference profile ARN

# ─────────────────────────────────────────────────────────────────────────────
# AWS SERVICES (DynamoDB, S3)
# ─────────────────────────────────────────────────────────────────────────────
AWS_REGION=us-east-1
DYNAMODB_TABLE_PRODUCTS=ProductCatalog
DYNAMODB_TABLE_SESSIONS=CartSessions
S3_BUCKET=pulse-cart-sessions-shivam-2026

# OpenSearch (Phase 7)
SEARCH_PROVIDER=local                   # "local" or "opensearch"
OPENSEARCH_HOST=your-opensearch-domain-endpoint.amazonaws.com

# MOCK_AWS — Set to 1 to skip all DynamoDB/S3/Bedrock calls.
# Uses an in-memory product catalog and session store instead.
# Auto-detected as 1 if no AWS credentials are found on the machine.
MOCK_AWS=1

# ─────────────────────────────────────────────────────────────────────────────
# MOCK_MODE — Set to 1 to bypass the LLM entirely (returns canned extractions)
# Useful for UI development or offline demos where you don't want any API calls.
# ─────────────────────────────────────────────────────────────────────────────
MOCK_MODE=0
```

#### Common team configurations

| Scenario | `LLM_PROVIDER` | `MOCK_AWS` | `MOCK_MODE` | Notes |
|----------|---------------|------------|-------------|-------|
| **Gemini + no AWS** (recommended) | `gemini` | `1` | `0` | Real AI extraction, mock product catalog. No AWS account needed. |
| **Full AWS** (production-like) | `bedrock` | `0` | `0` | Needs `aws configure`, DynamoDB tables, S3 bucket, Bedrock profile. |
| **Offline / UI dev only** | _(ignored)_ | `1` | `1` | Everything mocked, zero network calls. |
| **Bedrock + mock DB** | `bedrock` | `1` | `0` | Real Bedrock LLM calls, but mock catalog/sessions. |

### 3. Start the Backend
```bash
cd backend
pip install -r requirements.txt   # first time only
python -m uvicorn app.main:app --reload --port 8000
```
The API is live at `http://localhost:8000`. OpenAPI docs at `http://localhost:8000/docs`.

### 4. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
The UI is live at `http://localhost:5173`. API calls are proxied to the backend.

---

## 🏗️ Architecture

```
User Input (text/URL) 
    |
    v
[Ingestion Layer] -- text_input / url_fetcher / youtube_fetcher / voice_input
    |
    v
[Stage 1: AI Intent Extraction] -- Gemini 2.5 Flash / Claude Sonnet 4.6 -> structured JSON
    |
    v
[Stage 2: SKU Resolution] -- pure code, zero AI, keyword matching (with budget optimization)
    |
    v
[Stage 3: AI Cart Summary] -- Gemini 2.5 Flash / Claude Sonnet 4.6 -> plain English
    |
    v
Cart Response -> Frontend
```

---

## 📊 Feature Status (13 Pillars Matrix)

*Overall Project Completion: **~74% Done** (61/82 features completed), **~13% Partial** (11/82 features), and **~12% Not Started** (10/82 features) as cross-referenced in [f.md](file:///Users/amankashyap/Documents/needSpeak/f.md).*

| Pillar | Features Implemented | Status | Highlights / Implementation Notes |
|---|---|:---:|---|
| **Pillar 1: Intent Engine** | 9 / 11 | 🟡 | NLP parsing, URL ingestion (BBC/AllRecipes), YouTube transcripts, Hindi/Hinglish understanding, budget auto-extraction, servings override. OCR/WhatsApp/PDF are partially implemented. |
| **Pillar 2: OccasionCart** | 4 / 5 | ✅ | Homepage occasion tiles (9 cards), `/occasions` route, and occasion pre-fills via URL search params. |
| **Pillar 3: RecipeCart** | 4 / 4 | ✅ | Recipe URL parser, ingredient-to-SKU matching, servings scaling, and YouTube recipe transcription to cart. |
| **Pillar 4: Quantity Engine** | 4 / 5 | ✅ | Normalizes 70+ units (g, ml, cups, etc.), product units translation, UI quantity controls, and quantity deduplication. |
| **Pillar 5: Multi-Intent** | 4 / 4 | ✅ | Decomposes single inputs to multiple intent groups, creates separate carts per intent, and groups items with subtotals in Live Cart. |
| **Pillar 6: Collaborative Cart** | 1 / 6 | 🟡 | `/collab/$id` UI page shell is built. Sharing features and database socket sync are static/mocked. |
| **Pillar 7: GoalCart** | 5 / 5 | ✅ | Dynamic budget optimization, custom item-swapping suggestions UI (cheaper alternatives), budget progress bar, and over/under indicator. |
| **Pillar 8: CompareCart** | 1 / 5 | 🟡 | "What If" modal with budget slider exists in ReviewCart. Backed re-runs are cosmetic/mocked. |
| **Pillar 9: Preferences** | 5 / 5 | ✅ | Full CRUD user preferences API, integrated directly into the resolver pipeline (filtering dietary tags, brand affinity, and budget constraints). |
| **Pillar 10: Smart Alts** | 3 / 3 | ✅ | Alternate product suggestions with savings metrics (`pending_substitution` schema) and instant swap acceptance. |
| **Pillar 11: Explainability** | 3 / 3 | ✅ | High visibility for item-matching rules (`matched_from`), substitution reasons, and missing/unavailable item reasoning. |
| **Pillar 12: Confidence Layer** | 4 / 4 | ✅ | Evaluates input confidence (High/Med/Low), active clarification questions, and pauses cart generation until clarified. |
| **Pillar 13: ReviewCart** | 4 / 5 | ✅ | `/cart/$id` review page, AI occasion summary generator, and interactive budget widgets. |

---

## 🔌 API Endpoints

### Core Pipeline Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/parse` | Main pipeline: parses raw text or URL content and returns the resolved cart. |
| POST | `/api/transcribe` | Transcription endpoint: takes WebM/Opus audio recording and transcribes via Gemini. |
| GET | `/api/session/{session_id}` | Reloads/retrieves a previous session's details and resolved cart. |
| GET | `/api/health` | Diagnostic endpoint: verifies LLM (Gemini/Bedrock), S3, and DynamoDB health. |
| POST | `/api/preferences` | Saves user dietary preferences, brand affinity, and budget constraints. |
| GET | `/api/preferences/{user_id}` | Loads active preferences for a given user profile. |
| POST | `/api/events` | Logs telemetry events (add_to_cart, purchase, substitution_reject) for offline ML training. |

### Authentication Endpoints (CSV-backed)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Registers a new user account securely with bcrypt password hashing. |
| POST | `/api/auth/login` | Validates credentials and returns a session bearer token. |
| POST | `/api/auth/google` | Handshakes Google Identity services credentials to log in or register. |
| GET | `/api/auth/me` | Validates the authorization bearer token and returns current user context. |
| POST | `/api/auth/logout` | Revokes the active session token. |
| POST | `/api/auth/check-email` | Fast verification to check if an email already exists. |

---

## ⚙️ Mock Mode

There are two independent mock flags to ease local development and testing:

| Flag | What it skips | When to use |
|------|--------------|-------------|
| `MOCK_AWS=1` | DynamoDB, S3, Bedrock health checks | Useful if you don't have AWS configured. The backend defaults to a local mock catalog (~45 Indian grocery SKUs) and caches sessions in memory. |
| `MOCK_MODE=1` | All LLM calls (Gemini and Bedrock) | Ideal for offline work or debugging UI flows. Returns pre-determined canned responses instantly without hitches. |

Both options are independent. For example, you can write real Gemini queries while bypassing AWS database configurations.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI (Python 3.11) |
| **Frontend** | React 18 (Vite 6) |
| **Styling** | Tailwind CSS v4 (Vanilla CSS Customizations) |
| **Animations** | Framer Motion |
| **AI / LLMs** | Google Gemini 2.5 Flash (Default) / Amazon Bedrock (Claude Sonnet 4.6) |
| **Database** | Amazon DynamoDB (or local mock catalog) |
| **Storage** | Amazon S3 (or local memory session store) |
| **Auth** | Secure CSV-based storage using bcrypt password hashing |
| **Audio** | Hybrid Web Speech API (Client-side translation) + MediaRecorder fallback |
| **Export** | Custom `cart-export.ts` utility (supports formatting WhatsApp-friendly text or CSV download) |

---

## 🔍 OpenSearch Hybrid Search (Phase 7)
OpenSearch can be enabled for hybrid BM25 text match + KNN vector search.
* **Setup Script:** `python scripts/setup_opensearch.py` initializes the `product-catalog` index with KNN vector dimensions.
* **Provider Resolver:** Activate by setting `SEARCH_PROVIDER=opensearch` and supplying `OPENSEARCH_HOST` in `.env`. Falls back to the local retriever if host is not configured.

---

## 📊 Offline Recommendation Engine (Phase 8)
* **Event Exporter:** Run `python scripts/export_events.py` to dump events from DynamoDB (or mock events if `MOCK_AWS=1`) to a local CSV (`data/exported_events.csv`).
* **Baseline Training:** Run `python scripts/train_lightfm_baseline.py` to train a hybrid collaborative filtering model using `lightfm` on positive interactions (purchases/add to carts). Includes a mock fallback for local environments without compiler setups.

