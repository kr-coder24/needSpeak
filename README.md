# 🛒 NeedSpeak | Context-to-Cart (Amazon Hackon 2026)

NeedSpeak / Context-to-Cart is a state-of-the-art **Intent-Commerce Engine**. It converts messy, unstructured human context (recipes, shopping lists, voice recordings, planning descriptions, or URLs) into reliable, inventory-aware, and explainable shopping carts matching real product catalogs.

---

## 🌟 Key Features

1. **Multi-Modality Input Gateway:**
   * **Text & Voice Input:** Paste a shopping list, describe an event, or record voice instructions.
   * **Recipe Ingestion:** Automatically parse recipes from AllRecipes, BBC Food, or YouTube transcripts.
   * **Hindi/Hinglish Support:** Native support for Indian language contexts and code-mixed inputs.
2. **"Magic Setup" Preference Engine:**
   * Extract dietary restrictions (`veg`, `vegan`, `jain`), brand affinity, and budget constraints directly from freeform user descriptions.
   * Real-time saving and loading of preferences, dynamically integrated into the search and ranking pipeline.
3. **Smart Alternatives & Instant Swapping:**
   * Every item in the resolved cart displays up to **3 intelligent alternatives** (cheaper options, higher ratings, etc.).
   * One-click swap functionality instantly updates cart states, budget bars, and savings metrics in real time.
4. **Fuzzy Quantity Engine:**
   * Normalizes 70+ units (g, ml, cups, packets, bunches) into standard metric formats.
   * Translates arbitrary quantities into exact catalog SKU quantities using unit normalization.
5. **GoalCart (Budget Optimization):**
   * Specify a strict budget constraint; if exceeded, the resolver dynamically swaps premium items with cheaper equivalents and flags them as "Substituted" in the UI.
6. **Collaborative Sharing & Analytics:**
   * Share cart links via WhatsApp or download them as CSV files.
   * Full client-side telemetry tracking user actions (`impression`, `click`, `add_to_cart`, `purchase`, `substitution_accept`, `substitution_reject`) to train offline recommender models.

---

## 🏗️ System Architecture

```text
       User Input (Text / URL / Voice)
                     │
                     ▼
             [Ingestion Layer]
    (url_fetcher / youtube_fetcher / voice)
                     │
                     ▼
       [Stage 1: Intent Extraction]
      (Gemini / Claude Pydantic JSON)
                     │
                     ▼
          [Stage 2: SKU Retrieval]
   (OpenSearch Hybrid / Local Vector BM25)
                     │
                     ▼
          [Stage 3: Hybrid Ranker]
(Relevance + Price Fit + Quality + Brand Boost)
                     │
                     ▼
       [Stage 4: Cart Optimization]
   (Quantity Translation & Budget Swapping)
                     │
                     ▼
          [Stage 5: Live Cart UI]
     (Alternative Swapping & Telemetry)
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
* **Python 3.11+** (with `pip`/`venv`)
* **Node.js 18+** (with `npm`)
* A Google Gemini API key or configured AWS CLI credentials (`aws configure`)

> [!NOTE]
> Setting `MOCK_AWS=1` runs the catalog and session database locally in-memory, requiring **no AWS configuration** whatsoever.

---

### 1. Configure the Environment

Create a `backend/.env` file in the root of the backend folder:

```env
# Active LLM Provider: "gemini" or "bedrock"
LLM_PROVIDER=gemini

# Google Gemini Configuration
# NOTE: Defaulting to gemini-flash-latest handles 1,500 daily requests. 
# gemini-2.5-flash is supported but limited to 20 daily requests on Google's Free Tier.
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL_ID=gemini-flash-latest

# AWS Configuration (Used if MOCK_AWS=0)
AWS_REGION=us-east-1
DYNAMODB_TABLE_PRODUCTS=ProductCatalog
DYNAMODB_TABLE_SESSIONS=CartSessions
S3_BUCKET=pulse-cart-sessions-shivam-2026

# Search Configuration: "local" (BM25) or "opensearch" (Hybrid vector + text)
SEARCH_PROVIDER=local
OPENSEARCH_HOST=your-opensearch-domain-endpoint.amazonaws.com

# Mock Settings
MOCK_AWS=1      # Set to 1 to skip DynamoDB/S3/Bedrock (runs in-memory mock catalog)
MOCK_MODE=0     # Set to 1 to bypass the LLM and return static mock extractions
```

---

### 2. Start the Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
* API runs at `http://localhost:8000`.
* OpenAPI interactive documentation is available at `http://localhost:8000/docs`.

---

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```
* UI is live at `http://localhost:5173`.
* Port-forwarding/proxy rules automatically route `/api/*` calls from frontend to backend.

---

## 🛡️ Gemini API Quota & Fallbacks
To ensure maximum reliability during long hackathon hacking sessions:
1. **Model Choices:** Google AI Studio restricts `gemini-2.5-flash` to a low daily limit of 20 requests on the free tier. We default to `gemini-flash-latest` (Gemini 1.5 Flash), which grants **1,500 requests per day**.
2. **Robust Fallbacks:** In `app/pipeline/extractor.py`, if the configured model hits a rate limit or error, the system automatically loops through reliable fallback models (`gemini-flash-latest` -> `gemini-2.5-flash-lite` -> `gemini-2.0-flash` -> `gemini-2.5-flash`) to ensure high availability.

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
| **Pillar 6: Collaborative Cart** | 6 / 6 | ✅ | `/collab/$id` UI, QR code, share link, **REAL-TIME WebSocket sync with live state**, budget auto-rebalancing, and invite button (email/SMS backend not wired). |
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

## 🔍 OpenSearch Hybrid Search (Phase 7)
OpenSearch can be enabled for hybrid BM25 text match + KNN vector search.
* **Setup Script:** `python scripts/setup_opensearch.py` initializes the `product-catalog` index with KNN vector dimensions.
* **Provider Resolver:** Activate by setting `SEARCH_PROVIDER=opensearch` and supplying `OPENSEARCH_HOST` in `.env`. Falls back to the local retriever if host is not configured.

---

## 📊 Offline Recommendation Engine (Phase 8)
* **Event Exporter:** Run `python scripts/export_events.py` to dump events from DynamoDB (or mock events if `MOCK_AWS=1`) to a local CSV (`data/exported_events.csv`).
* **Baseline Training:** Run `python scripts/train_lightfm_baseline.py` to train a hybrid collaborative filtering model using `lightfm` on positive interactions (purchases/add to carts). Includes a mock fallback for local environments without compiler setups.
