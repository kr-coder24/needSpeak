# Context-to-Cart | Amazon Hackon 2026

> **Idea 1 Foundation** — Paste any recipe, shopping list, or URL. AI extracts what you need, maps to real products, builds your cart instantly.

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- AWS CLI configured with credentials (`aws configure`)
- DynamoDB tables `ProductCatalog` and `CartSessions` created in `us-east-1`
- S3 bucket `pulse-cart-sessions-shivam-2026` created in `us-east-1`

### 1. Seed the Product Catalog
```bash
cd backend
pip install -r requirements.txt
python seed_catalog.py
```
This writes 80 realistic Indian product SKUs to DynamoDB. Safe to re-run.

### 2. Configure Environment
Edit `backend/.env`:
```env
# CRITICAL: Set your Bedrock inference profile ID here
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-6

# For demo safety — set to 1 to bypass all AI calls
MOCK_MODE=0
```

### 3. Start the Backend
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```
The API is live at `http://localhost:8000`. OpenAPI docs at `http://localhost:8000/docs`.

### 4. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
The UI is live at `http://localhost:5173`. API calls are proxied to the backend.

## Architecture

```
User Input (text/URL) 
    |
    v
[Ingestion Layer] -- text_input / url_fetcher / youtube_fetcher
    |
    v
[Stage 1: Bedrock Extraction] -- Claude Sonnet 4.6 -> structured JSON
    |
    v
[Stage 2: SKU Resolution] -- pure code, zero AI, keyword matching
    |
    v
[Stage 3: Bedrock Summary] -- Claude Sonnet 4.6 -> plain English
    |
    v
Cart Response -> Frontend
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/parse` | Main pipeline: text/URL -> resolved cart |
| GET | `/api/session/{id}` | Reload a previous session |
| GET | `/api/health` | Check Bedrock + DynamoDB connectivity |

## Mock Mode

Set `MOCK_MODE=1` in `.env` or click the lightning bolt icon 5 times in the UI header to toggle mock mode. This bypasses all Bedrock calls and returns realistic dummy data — essential for demo resilience.

## Bedrock Inference Profile Setup

Claude Sonnet 4.6 requires an inference profile in AWS Bedrock:

1. Go to **AWS Console > Amazon Bedrock > Inference profiles**
2. Click **Create inference profile**
3. Select `anthropic.claude-sonnet-4-6` as the model
4. Name it (e.g., `context-to-cart-sonnet`)
5. Copy the **Inference Profile ARN**
6. Update `BEDROCK_MODEL_ID` in `backend/.env` with the ARN

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Python 3.11 |
| Frontend | React 18 + Vite 6 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| AI | Amazon Bedrock (Claude Sonnet 4.6) |
| Database | Amazon DynamoDB |
| Storage | Amazon S3 |
