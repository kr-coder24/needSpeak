# NeedSpeak / Context-to-Cart Implementation Plan

## Price Guardian Notification Addition

For the Price Guardian watchlist feature, alert delivery is dual-channel: when a simulated price drop, competitor win, or neighbor resale match triggers, the backend attempts/simulates the email alert and the frontend also adds the same alert to the existing AppShell notification bell. This replaces the earlier watchlist-only notification assumption so mailing and the notification bar stay in sync for demos.

## Agent Handoff Prompt - Start Here

You are taking over the NeedSpeak / Context-to-Cart Amazon HackOn project in
`C:\needSpeak3`. Your job is to recover and improve the chat/search/
recommendation feature after a messy merge, without undoing unrelated teammate
work.

Read this prompt fully before editing code:

```text
You are a senior full-stack engineer and recommender/search systems engineer.
The user wants the product to feel credible, research-backed, scalable, and
customer-useful, not like "AI slop."

Repository:
- Workspace: C:\needSpeak3
- Current branch: main
- Current HEAD when this handoff was written: ad16340
- Last known good big feature merge: 6999e80
- There may be unrelated teammate changes. Do not revert them.
- There is/was an untracked file: backend/app/pipeline/bedrock_converse.py.
  Do not delete or overwrite it unless the user explicitly asks.

Primary recovery objective:
Make the chat -> extraction -> retrieval -> ranking -> cart path at least as
accurate as commit 6999e80, then improve it using the newer useful pieces.
The user specifically observed that YouTube/recipe extraction used to produce
mostly correct ingredients, but after later merges the cart now shows wrong
items. Investigate with that in mind.

Non-negotiable architecture rule:
The LLM extracts intent, quantities, constraints, and context. The LLM must not
directly choose SKUs. Product choice must be grounded in catalog retrieval,
ranking, inventory, and deterministic rules.

Research basis to preserve:
- BLaIR / Amazon Reviews 2023: language-to-product retrieval and product search.
- SASRec: recent behavior sequences for recommendation.
- DIEN: evolving user interest from behavior.
- BST: transformer-style ecommerce behavior sequences.
- Wide & Deep: combine memorized user/item interactions with generalized
  features.
- Two-tower retrieval: scalable candidate retrieval for large catalogs.
- Open-source references: Microsoft Recommenders, RecBole, LightFM, implicit.

Search/retrieval principle:
- Local demo should use reliable lexical BM25-style retrieval by default.
- Do not use fake/random/hash embeddings as "semantic search" for product
  selection.
- Real semantic search belongs behind OpenSearch/vector retrieval with real
  embeddings and lexical guardrails.
- Production target: DynamoDB remains source of truth; OpenSearch handles
  hybrid BM25 + vector candidate retrieval; ranker reranks top candidates only.

Gemini principle:
- The project uses Gemini 2.5 Flash by default.
- If Gemini rate limit or transient load happens, fallback to a smaller/alternate
  Gemini model is acceptable.
- Keep fallback bounded with sane retries and route-level timeouts. Do not let
  the API hang for 10 minutes, and do not fail immediately on one transient
  429/503.

Good newer work to keep:
- DynamoDB auth store and auth session persistence.
- V2 seed catalog and enriched product fields.
- Inventory reservation endpoints.
- Image/PDF/prescription ingestion endpoints. PDF upload is required and must
  stay working.
- Alternatives/substitution UI.
- Preference/event scaffolding.
- Occasion templates and deterministic quantity scaling, if they do not pollute
  normal chat results.
- Collaboration and checkout features unless they directly break this recovery.

Core files to inspect first:
- backend/app/main.py
- backend/app/models.py
- backend/app/pipeline/extractor.py
- backend/app/pipeline/resolver.py
- backend/app/search/local_retrieval.py
- backend/app/search/local_vector_retrieval.py
- backend/app/search/ranker.py
- backend/app/intelligence/preference_engine.py
- backend/app/db/dynamo.py
- frontend/src/routes/chat.tsx
- frontend/src/routes/preferences.tsx
- frontend/src/components/layout/AppShell.tsx
- frontend/src/lib/preferences.ts

Suggested first commands:
- git status --short
- git diff --stat
- git diff 6999e80..HEAD -- backend/app/main.py backend/app/pipeline/resolver.py backend/app/search/ranker.py frontend/src/routes/chat.tsx frontend/src/routes/preferences.tsx
- pytest backend/tests/test_25_edge_cases.py
- python backend/test_v2_pipeline.py

Expected implementation behavior:
- Text chat sends budget_mode, preferences, and user_id correctly.
- Pasted YouTube/URL input routes as input_type=url.
- YouTube transcript ingestion is used for YouTube URLs.
- PDF upload remains a first-class feature: upload PDF -> extract readable text
  -> run the normal cart pipeline -> render the returned cart.
- Resolver uses LocalRetriever by default, not LocalVectorRetriever.
- LocalVectorRetriever remains experimental only.
- Cart response includes selected product, top alternatives, reason codes,
  score breakdown, purchase_likelihood, and likely_rating.
- User profile/preferences are generalized beyond food.
- Logged-in user is shown in a modern ecommerce account dropdown.
- Preferences can still work from localStorage for demo, but DynamoDB-backed
  save/load should be wired for logged-in users when AWS is enabled.

AWS/DynamoDB note:
If MOCK_AWS=0, tell the user to create the tables in section 6 before expecting
real persistence. Required tables include users, email locks, auth sessions,
preferences, events, product catalog, cart sessions, and inventory/reservation
tables.
```

## Live Recovery Task List - 2026-06-14

This checklist is intentionally explicit so another agent can resume without
re-discovering the whole repo. Treat completed items as "edited in workspace,
still verify" until tests pass.

Progress count at this checkpoint:

- Done or mostly done in the current workspace: 43
- In progress / needs cleanup: 1
- Pending: 2

Completed or mostly completed:

- [x] Inspected the current repo state and confirmed the only dirty file at
  first check was untracked `backend/app/pipeline/bedrock_converse.py`.
- [x] Compared post-`6999e80` changes in the chat/search/recommendation area.
- [x] Identified the main retrieval regression: resolver default changed from
  `LocalRetriever` to `LocalVectorRetriever`, whose deterministic hash vectors
  can produce random-feeling matches.
- [x] Added this recovery/handoff material to `implementation_plan.md`.
- [x] Extended API/cart models with generalized preference fields plus
  `purchase_likelihood`, `likely_rating`, and score breakdown support.
- [x] Extended catalog query/ranked product models with generalized preference
  and likelihood fields.
- [x] Updated `LocalRetriever` to handle both legacy `dietary` and V2
  `dietary_tags`, plus preferred/avoided category hints.
- [x] Reweighted the ranker so retrieval relevance is the strongest signal and
  rating/price/preferences cannot overpower poor relevance.
- [x] Added deterministic `purchase_likelihood` / `likely_rating` scoring in
  the ranker.
- [x] Restored `LocalRetriever` as the default resolver provider.
- [x] Kept `LocalVectorRetriever` only behind explicit
  `SEARCH_PROVIDER=local_vector` or `SEARCH_PROVIDER=vector`.
- [x] Passed occasion/category/profile fields from resolver into
  `ProductQuery` / `RankingContext`.
- [x] Broadened `UserPreferences` to include preferred/avoided categories,
  quality preference, and pack-size preference.
- [x] Added simple implicit category preferences from user events, alongside
  implicit brand preferences.
- [x] Set the default Gemini model to `gemini-2.5-flash` and bounded extractor
  fallback retries.

In progress / cleanup needed:

- [x] Finish cleaning `backend/app/main.py` without removing PDF upload.
  Keep `/api/parse-pdf` and `/api/ingest/pdf` working. Only remove or refactor
  the duplicated, unreachable internal pipeline copy inside `parse_pdf` after
  the shared PDF upload path is verified.
- [x] Confirm every `resolve_cart(...)` caller uses `budget_mode`, not the
  invalid `budget_style` keyword.
- [x] Verify `OpenSearchRetriever` returns `ProductCandidate` objects, not
  `RankedProduct`, before enabling `SEARCH_PROVIDER=opensearch`.
- [x] Run backend tests after the current partial patches and fix import/type
  errors.

Pending backend work:

- [x] Add regression tests for biryani, burger, chips, broad party snacks,
  YouTube-transcript-like recipe text, and URL input.
- [x] Add a test proving `SEARCH_PROVIDER` default uses `LocalRetriever`.
- [x] Add a test proving `SEARCH_PROVIDER=local_vector` is opt-in only.
- [x] Add a test proving high rating cannot beat a weak lexical match.
- [x] Add a test for `purchase_likelihood` and `likely_rating` fields in cart
  output.
- [x] Finish applying generalized preferences from `/api/parse` to resolver in
  all code paths.
- [x] Make `/api/preferences/extract` return generalized preference fields.
- [x] Ensure logged-in `user_id` is stored on sessions/events/preferences where
  the backend receives it.
- [x] Confirm preference save/load and behavior event save/read contracts work
  in mock mode; real DynamoDB mode still requires the AWS tables listed below.
- [x] Add clear AWS table instructions for the user if tables are missing.
- [x] Keep Gemini fallback behavior: configured model first, fallback models
  next, bounded retries, useful 429/503 handling.
- [x] Keep route-level timeouts sane: normal parse about 120s, multimodal about
  180s, recompare about 20s.

Pending frontend work:

- [x] Fix `frontend/src/routes/chat.tsx` to send `budget_mode`, not
  `budget_style`, to `/api/parse`.
- [x] Send logged-in `user_id` from local auth to parse, upload, preferences,
  and events.
  - Text parse, image/PDF uploads, preference save/load, and checkout purchase
    events are wired.
- [x] Do not double-parse image/PDF uploads if upload endpoint already returns a
  full cart.
- [x] Render upload endpoint cart responses through the same normal cart
  normalization path.
- [x] Expand `frontend/src/lib/preferences.ts` beyond food-only preferences.
- [x] Redesign `frontend/src/routes/preferences.tsx` as a general ecommerce
  behavior profile: budget, quality, pack size, brands, avoided brands,
  categories, allergies/dietary where relevant.
- [x] Add a modern ecommerce user dropdown in `AppShell` with profile,
  preferences, cart history, and logout.
- [ ] Ensure long product names, alternatives, and likelihood labels do not
  overflow in chat/cart UI.

Pending verification:

- [x] Run backend unit/integration tests.
  - 2026-06-14: `PYTHONDONTWRITEBYTECODE=1 pytest tests/test_retrieval_recovery.py -q`
    passed 9/9. Pytest cache warnings were due to Windows permission limits.
  - The tests caught and fixed a real regression: `tomato ketchup` was resolving
    to unrelated products when ketchup was missing from the catalog. Multi-word
    queries now require real token overlap; category-only matches cannot win.
  - Added backend contract coverage for generalized preference persistence and
    behavior event logging in mock mode.
- [ ] Run frontend typecheck/build.
- [ ] Run a local smoke test for: text recipe, YouTube URL, broad chips query,
  PDF upload, image upload, and preference-aware query.
- [ ] Inspect outputs manually and verify items are close to `6999e80` quality
  or better.
- [ ] Update this checklist with exact pass/fail results before handing off.

This document is written for an AI coding agent that will continue the project.
Follow the steps in order. Do not jump directly to "AI recommendations" before
the retrieval, ranking, inventory, and data contracts are solid.

The goal is to turn the current hackathon prototype into a credible intent
commerce system: a user can describe a need in text, voice, URL, image, PDF, or
message form, and the system builds a reliable, explainable, scalable cart from
real catalog data.

## 0. Executive Direction

Current project name: `needSpeak` / `Context-to-Cart`.

Current working flow:

1. User sends text from the frontend chat.
2. Backend `/api/parse` calls Gemini or Bedrock to extract structured shopping
   intents.
3. Backend resolver does deterministic exact/keyword/category matching against a
   small in-memory product catalog.
4. Frontend displays a flattened cart.

Target working flow:

```text
Input Gateway
  -> Modality Extractor
  -> Intent JSON
  -> Candidate Retrieval
  -> Deterministic Filters
  -> Ranker / Preference Engine
  -> Inventory Promise
  -> Cart Reservation
  -> Explainable UI
```

Core principle:

```text
The LLM extracts intent and constraints.
The LLM must not be trusted as the final product selector.
Product selection must be based on catalog retrieval, ranking, inventory,
business rules, and validated schemas.
```

This is what prevents "AI slop." Gemini can understand messy inputs, but the
commerce decisions must be auditable and testable.

## 0.1 Recovery Addendum - 2026-06-14

This section reflects the post-merge state after commit `ad16340`, compared
against the last known good feature integration at `6999e80`.

User-facing goal:

- Make chat, YouTube, URL, image/PDF, recommendations, preferences, and
  alternatives at least as accurate as `6999e80`.
- Keep genuinely useful newer work.
- Do not touch unrelated collaboration, checkout, homepage, or styling changes
  unless they directly break this feature path.

Keep from the newer commits:

- Auth routes backed by DynamoDB stores.
- Product catalog V2 and seed expansion.
- Inventory reservation endpoints.
- Upload endpoints for image/PDF/prescription.
- Cart alternatives UI and substitution interaction.
- Event logging and preference storage scaffolding.
- Occasion templates and deterministic quantity scaling, after verifying they
  do not pollute normal chat results.

Fix or roll back inside the chat/search feature:

1. Restore deterministic local retrieval as the default.
   - `6999e80` used `LocalRetriever`, a BM25-style lexical retriever.
   - Current `LocalVectorRetriever` uses deterministic hash vectors, not real
     embeddings. That produces random semantic similarity and is a likely cause
     of wrong products.
   - Keep `LocalVectorRetriever` only behind an explicit experimental provider
     such as `SEARCH_PROVIDER=local_vector`.
   - Production semantic search should be OpenSearch/vector embeddings, not hash
     vectors.
2. Harden ranker scoring.
   - Keyword/product relevance must dominate candidate ordering.
   - Rating, price, and preference scores may break ties, but must not make a
     weak match beat a strong match.
   - Add a `purchase_likelihood` score derived from relevance, rating/review
     confidence, availability, price fit, explicit preferences, and implicit
     behavior signals.
3. Normalize frontend/backend request contracts.
   - Frontend must send `budget_mode`, not `budget_style`, to `/api/parse`.
   - Upload endpoints may accept `budget_style` for backward compatibility, but
     should convert it to `budget_mode` before calling the resolver.
   - Always send the logged-in user's `user_id` when available.
4. Fix multimodal pipeline bugs.
   - The `/api/parse-pdf` path currently references `req.user_id` even though
     no `req` object exists.
   - Image/PDF upload results should not call `/api/parse` a second time if the
     upload endpoint already returns a full cart.
   - Shared multimodal helper should accept preferences and user context.
5. Use sane latency limits.
   - Do not use 30 seconds for the full Gemini + retrieval path if YouTube/PDF
     can exceed it.
   - Do not use 600 seconds either; that hides failures and makes the demo feel
     frozen.
   - Suggested limits:
     - `/api/parse`: 120 seconds.
     - multimodal parse: 180 seconds.
     - `/api/recompare`: 20 seconds.
   - Gemini calls should use bounded retries with exponential backoff and a
     smaller fallback model, but they must not silently wait forever.
6. Generalize preferences beyond food.
   - Preferences should model shopping behavior:
     budget mode, preferred/avoided brands, dietary/allergy constraints,
     category affinities, disliked categories, pack-size preference, quality
     sensitivity, sustainability preference, and recent behavior.
   - Food-specific dietary controls can remain, but the preference page should
     feel like an ecommerce personalization profile, not a food-only form.
7. Clarify AWS setup.
   - If `MOCK_AWS=0`, create the DynamoDB tables listed in section 6.
   - Required now: users, email locks, auth sessions, preferences, events,
     product catalog, cart sessions.
   - Inventory reservation requires the inventory/reservations tables described
     in section 8.

Recovery implementation checklist for the next coding agent:

```text
[x] Update this plan first.
[x] Confirm current dirty files and do not overwrite unrelated work.
[x] Compare `ad16340` to `6999e80` only for chat/search/recommendation files.
[x] Switch default search back to LocalRetriever.
[x] Keep local vector code only as explicit experimental mode.
[x] Add retrieval/ranker regression tests for biryani, burger, chips, URL text,
    and one YouTube-transcript-like recipe.
[x] Fix frontend request body: `budget_mode`, `user_id`, and URL detection.
[x] Fix upload flow so image/PDF cart response is rendered directly.
[x] Fix `/api/parse-pdf` undefined `req` and resolver argument mismatch.
[x] Add purchase-likelihood fields/reasons to cart item alternatives.
[x] Generalize preference model and preference UI wording.
[x] Ensure preferences save/load to DynamoDB for the logged-in user when AWS is
    enabled, and localStorage remains a demo fallback.
[~] Run focused backend tests, frontend typecheck/build, and at least one manual
    parse smoke test.
```

Important rule for future work:

```text
Do not replace a correct lexical match with fake semantic search.
Semantic retrieval is only allowed when backed by real embeddings/vector search
or when it is combined with a lexical guardrail that prevents unrelated items.
```

## 1. Current Codebase Baseline

Important files already present:

- Backend entrypoint: `backend/app/main.py`
- API models: `backend/app/models.py`
- Gemini/Bedrock extraction: `backend/app/pipeline/extractor.py`
- SKU matching: `backend/app/pipeline/resolver.py`
- DynamoDB helper: `backend/app/db/dynamo.py`
- S3 helper: `backend/app/db/s3.py`
- CSV auth store: `backend/app/auth/csv_store.py`
- Auth routes: `backend/app/auth/auth_routes.py`
- Seed catalog: `backend/seed_catalog.py`
- Chat UI: `frontend/src/routes/chat.tsx`
- Cart UI: `frontend/src/routes/cart.$id.tsx`
- Voice hook: `frontend/src/hooks/use-voice-input.tsx`
- Preference engine stub: `backend/app/intelligence/preference_engine.py`
- Occasion templates: `backend/app/intelligence/occasion_templates.py`
- Collab models: `backend/app/collab/models.py`

Known current gaps:

- Chat page always sends `input_type: "text"` even when the content is a URL.
- YouTube transcript backend exists, but chat does not route pasted YouTube URLs
  to URL mode.
- Image, PDF, and WhatsApp chips exist in UI but do not call a backend ingestion
  flow.
- User data is stored in CSV and auth sessions are stored in a Python dict.
- Runtime SKU search loads/scans all products from cache. This is okay for 80
  SKUs, not okay for large catalog scale.
- Seed catalog has brand and rating fields, but not enough SKUs, variants,
  review previews, review counts, image URLs, stock-by-location, or synonym
  coverage.
- Preferences and occasion templates exist but are not fully integrated into the
  main parse/ranking flow.

## 2. Research Foundation

Use the following research and open-source systems as the basis for the engine.
Do not cite vague "AI personalization" claims in the product story. Tie each
feature to a known recommender/search pattern.

### 2.1 Language-to-Product Retrieval

Primary paper:

- BLaIR / Amazon Reviews 2023:
  https://arxiv.org/abs/2403.03952

Why it matters:

- The paper introduces a large-scale Amazon Reviews 2023 dataset and evaluates
  language models as semantic encoders for recommendation and product search.
- It directly fits this project because users will write complex language
  contexts like "hostel restock under 1500" or "birthday party snacks for 20
  kids", and the system must retrieve relevant products.

Implementation interpretation:

- Represent each product as rich text:
  title, brand, category, subcategory, keywords, reviews, occasion tags,
  dietary tags, pack size, and synonyms.
- Represent each extracted item/context as query text.
- Use hybrid retrieval:
  keyword search + semantic vector search + structured filters.

Open-source/data reference:

- AmazonReviews2023 repository:
  https://github.com/hyp1231/AmazonReviews2023

Important caution:

- Use this as a research and benchmark reference. Do not scrape or copy Amazon
  product pages. For hackathon seed data, generate realistic synthetic products
  or use explicitly licensed datasets.

### 2.2 User Preference From Behavior Sequences

Primary papers:

- SASRec, Self-Attentive Sequential Recommendation:
  https://arxiv.org/abs/1808.09781
- DIEN, Deep Interest Evolution Network:
  https://arxiv.org/abs/1809.03672
- BST, Behavior Sequence Transformer for E-commerce Recommendation:
  https://arxiv.org/abs/1905.06874

Why they matter:

- User preferences are not static. A user who bought stationery yesterday may be
  planning an exam; a user browsing snacks today may be hosting a party.
- SASRec models recent action sequences using self-attention.
- DIEN models evolving latent interests behind behavior.
- BST uses Transformer-style behavior sequence modeling in e-commerce.

Implementation interpretation:

- Do not start with a giant deep model. Start by collecting behavior events.
- Build a simple rule/feature-based preference score first.
- Later train a sequential ranker over events like:
  impression, click, add_to_cart, remove_from_cart, substitute_accept,
  purchase, dislike, search, image_search.
- Keep recent events more important than old events.

### 2.3 Memorization Plus Generalization

Primary paper:

- Wide & Deep Learning for Recommender Systems:
  https://arxiv.org/abs/1606.07792

Why it matters:

- Commerce recommendations need memorization and generalization.
- Memorization: user often buys Amul milk, so keep Amul high.
- Generalization: user likes high-protein foods, so new high-protein SKUs can be
  recommended even without prior purchase.

Implementation interpretation:

- V1 ranker should combine:
  exact known preferences + generalized semantic/category similarity.
- Later ML ranker can use wide sparse features plus dense embeddings.

### 2.4 Candidate Retrieval at Scale

Primary paper:

- Two-tower recommendations at Allegro:
  https://arxiv.org/abs/2508.03702

Why it matters:

- Two-tower retrieval is a common large-scale pattern: encode query/user and
  products separately, then retrieve nearest products using approximate nearest
  neighbor search.
- The Allegro paper shows a content-based two-tower approach for similarity,
  complementary recommendations, and inspirational discovery.

Implementation interpretation:

- For this project, use OpenSearch vector search first rather than training a
  two-tower model from scratch.
- Later, when event volume exists, replace generic embeddings with learned item
  and user/context embeddings.

### 2.5 Collaborative Filtering and Open-Source Baselines

Useful projects:

- Microsoft Recommenders:
  https://github.com/recommenders-team/recommenders
- RecBole:
  https://github.com/RUCAIBox/RecBole
- LightFM:
  https://github.com/lyst/lightfm
- implicit:
  https://github.com/benfred/implicit

How to use them:

- Do not add all of them to production.
- Use them for offline experiments once `UserEvents` exists.
- Recommended sequence:
  1. V0 heuristic ranker in pure Python.
  2. V1 LightFM for hybrid cold-start recommendation.
  3. V2 implicit ALS/BPR for interaction-based collaborative filtering.
  4. V3 RecBole/Microsoft Recommenders experiments for SASRec/NCF/Wide&Deep.

### 2.6 Search and Storage Platform References

AWS/OpenSearch references:

- DynamoDB partition key best practices:
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html
- DynamoDB condition expressions:
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html
- DynamoDB transactions:
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
- DynamoDB TTL:
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html
- OpenSearch Serverless vector search:
  https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-vector-search.html
- Amazon Personalize:
  https://docs.aws.amazon.com/personalize/latest/dg/what-is-personalize.html

Gemini references:

- Gemini image understanding:
  https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini document understanding:
  https://ai.google.dev/gemini-api/docs/document-processing
- Gemini structured outputs:
  https://ai.google.dev/gemini-api/docs/structured-output
- Gemini Files API:
  https://ai.google.dev/gemini-api/docs/files

## 3. Product Vision

The product should be pitched as:

```text
NeedSpeak is an intent commerce engine.
It converts messy human context into reliable, explainable, inventory-aware carts.
```

Supported inputs:

- Natural text.
- Hinglish / Hindi / Indian English.
- Voice.
- Recipe URL.
- YouTube recipe/video URL.
- WhatsApp message text.
- WhatsApp screenshot.
- Shopping list image.
- Handwritten list image.
- PDF or document.
- Prescription image/PDF, with safety guardrails.
- Product/fashion image search.

Supported outputs:

- Ranked cart.
- Alternatives per item.
- Why-this-product explanation.
- Budget versions:
  value, balanced, premium.
- Occasion-aware bundles.
- Dietary/allergy-safe substitutions.
- Inventory-aware add-to-cart.
- Collaborative cart.
- Export to WhatsApp/CSV.

## 4. Non-Negotiable Engineering Rules

The AI agent must follow these rules:

1. Validate every LLM output with Pydantic.
2. Never let the LLM directly decide final SKU without catalog validation.
3. Never show all matching products in the frontend.
4. Retrieval returns candidates; ranking returns top products; UI paginates.
5. Do not scan DynamoDB for runtime search at scale.
6. Use DynamoDB conditional writes for stock/reservation correctness.
7. Use TTL for temporary sessions, auth sessions, and cart reservations.
8. Keep raw uploads in S3 or Gemini Files API only as needed; avoid storing
   sensitive documents longer than needed.
9. Prescription input must extract and flag; it must not auto-substitute
   prescription medicines.
10. Add tests for every new backend contract.

## 5. Target Backend Module Layout

Add or evolve these modules:

```text
backend/app/
  auth/
    csv_store.py                  # legacy only
    dynamo_store.py               # new user/session auth store
    auth_routes.py

  catalog/
    models.py                     # Product, ReviewPreview, InventorySummary
    seed_v2.py                    # large synthetic seed data
    normalizer.py                 # synonyms, units, categories

  ingestion/
    text_input.py
    url_fetcher.py
    youtube_fetcher.py
    multimodal.py                 # image/pdf/whatsapp/prescription extraction

  pipeline/
    extractor.py
    resolver.py                   # keep old resolver as fallback
    summarizer.py
    gemini_client.py

  search/
    retrieval.py                  # interface
    local_retrieval.py            # BM25/keyword fallback for demo
    opensearch_retrieval.py       # production path
    ranker.py                     # deterministic ranker v1
    explanations.py               # match reasons

  inventory/
    reservations.py               # conditional reserve/release/commit
    models.py

  intelligence/
    preference_engine.py
    event_logger.py
    feature_store.py
    occasion_templates.py
```

## 6. DynamoDB Table Plan

Use multiple tables for clarity in hackathon/prototype. A single-table design
could be introduced later, but separate tables are easier for the current team.

### 6.1 Users

Table: `NeedSpeakUsers`

Primary key:

- `user_id` string

Attributes:

- `email_norm`
- `name`
- `password_hash`
- `provider`
- `avatar_url`
- `created_at`
- `updated_at`
- `status`

GSI:

- `EmailIndex`: partition key `email_norm`

Important:

- Prefer a separate `NeedSpeakEmailLocks` table for strict uniqueness during
  signup, because GSI uniqueness is not enforced.

### 6.2 Email Locks

Table: `NeedSpeakEmailLocks`

Primary key:

- `email_norm`

Attributes:

- `user_id`
- `created_at`

Signup must use `TransactWriteItems`:

- Put email lock with condition `attribute_not_exists(email_norm)`.
- Put user with condition `attribute_not_exists(user_id)`.

### 6.3 Auth Sessions

Table: `NeedSpeakAuthSessions`

Primary key:

- `token_hash`

Attributes:

- `user_id`
- `created_at`
- `expires_at`
- `ttl`
- `user_agent_hash`

Rules:

- Store only a hash of the token.
- Enable DynamoDB TTL on `ttl`.
- Replace `_sessions` dict in `auth_routes.py`.

### 6.4 Product Catalog

Table: `ProductCatalog`

Primary key:

- `sku`

Attributes:

- `sku`
- `title`
- `brand`
- `category`
- `subcategory`
- `price_inr`
- `mrp_inr`
- `discount_pct`
- `unit`
- `unit_quantity`
- `rating`
- `review_count`
- `review_preview`
- `keywords`
- `synonyms`
- `tags`
- `dietary_tags`
- `allergen_tags`
- `occasion_tags`
- `image_url`
- `search_text`
- `active`
- `created_at`
- `updated_at`

GSIs:

- `CategoryPriceIndex`: PK `category`, SK `price_inr`
- `BrandIndex`: PK `brand`, SK `rating`
- Optional `ActiveCategoryIndex`: PK `active_category`, SK `rating`

Important:

- DynamoDB is not the text search engine.
- OpenSearch is the search index.

### 6.5 Inventory

Table: `ProductInventory`

Primary key:

- `sku`

Sort key:

- `location_id`

Attributes:

- `available_qty`
- `reserved_qty`
- `safety_stock`
- `updated_at`
- `version`

Conditional reserve:

```text
SET available_qty = available_qty - :qty,
    reserved_qty = reserved_qty + :qty,
    version = version + :one
CONDITION available_qty >= :qty
```

### 6.6 Cart Reservations

Table: `CartReservations`

Primary key:

- `reservation_id`

Attributes:

- `session_id`
- `user_id`
- `sku`
- `qty`
- `location_id`
- `status`: reserved | released | committed | expired
- `created_at`
- `expires_at`
- `ttl`
- `idempotency_key`

Rules:

- Enable TTL.
- Reservation should expire automatically if checkout does not happen.
- Use idempotency key to avoid double-reserving on retries.

### 6.7 Cart Sessions

Existing table: `CartSessions`

Add:

- `user_id`
- `input_modalities`
- `input_refs`
- `retrieval_trace`
- `ranking_trace`
- `reservation_ids`
- `expires_at`
- `ttl`

### 6.8 User Preferences

Table: `UserPreferences`

Primary key:

- `user_id`

Attributes:

- `dietary`
- `allergies`
- `preferred_brands`
- `avoided_brands`
- `budget_mode`: value | balanced | premium
- `default_location_id`
- `last_updated_at`

### 6.9 User Events

Table: `UserEvents`

Primary key:

- `user_id`

Sort key:

- `event_ts_event_id`

Attributes:

- `event_type`
- `sku`
- `session_id`
- `intent_type`
- `query_text`
- `rank_position`
- `price_inr`
- `category`
- `context`
- `created_at`

Event types:

- `impression`
- `click`
- `add_to_cart`
- `remove_from_cart`
- `substitution_shown`
- `substitution_accept`
- `substitution_reject`
- `purchase`
- `search`
- `voice_input`
- `image_input`
- `pdf_input`
- `dislike`

This table is the foundation for the preference engine.

## 7. OpenSearch Index Plan

Index name:

```text
needspeak-products-v1
```

Document fields:

```json
{
  "sku": "SKU-SNK-002",
  "title": "lays classic salted chips",
  "brand": "Lays",
  "category": "snacks",
  "subcategory": "chips",
  "price_inr": 20,
  "rating": 4.2,
  "review_count": 1240,
  "in_stock": true,
  "dietary_tags": ["veg"],
  "allergen_tags": [],
  "occasion_tags": ["party", "movie_night"],
  "keywords": ["chips", "potato chips", "snacks", "wafers"],
  "synonyms": ["crisps", "namkeen", "chips packet"],
  "search_text": "lays classic salted chips Lays snacks chips potato chips party movie night",
  "embedding": [0.1, 0.2]
}
```

Retrieval query should combine:

- Full-text match over `search_text`, `title`, `keywords`, `synonyms`.
- Vector k-NN over `embedding`.
- Filters over category, dietary tags, allergy tags, price range, stock.
- Optional location filter.

Return top 50 candidates to ranker, not to frontend.

## 8. Ranking Engine V1

Create:

```text
backend/app/search/ranker.py
```

Function:

```python
def rank_candidates(
    extracted_item: ExtractedItem,
    candidates: list[ProductCandidate],
    user_preferences: UserPreferences | None,
    context: RankingContext,
) -> list[RankedProduct]:
    ...
```

V1 scoring:

```text
score =
  0.30 * semantic_score
+ 0.20 * keyword_score
+ 0.15 * availability_score
+ 0.10 * price_fit_score
+ 0.10 * rating_quality_score
+ 0.10 * user_preference_score
+ 0.05 * diversity_score
```

Feature definitions:

- `semantic_score`: normalized vector similarity from OpenSearch.
- `keyword_score`: normalized BM25/text score.
- `availability_score`: 1 if enough inventory, 0.5 if low stock, 0 if out.
- `price_fit_score`: high if price fits budget mode and remaining budget.
- `rating_quality_score`: combine rating and log(review_count).
- `user_preference_score`: brand/category/dietary/history signal.
- `diversity_score`: avoid returning 10 near-identical variants.

Output must include:

- `sku`
- `score`
- `score_breakdown`
- `reason_codes`
- `display_reason`

Example reason codes:

- `keyword_exact_match`
- `semantic_context_match`
- `preferred_brand`
- `budget_friendly`
- `high_rating`
- `in_stock_nearby`
- `occasion_match`
- `dietary_safe`

Frontend should show a simple natural explanation, not raw scores.

## 9. Preference Engine Roadmap

### V0: Explicit Preferences

Use existing `UserPreferences`:

- preferred brands
- avoided brands
- dietary
- allergies
- budget mode

Apply as filters and rank boosts.

Acceptance:

- If user avoids `Patanjali`, products with brand `Patanjali` should not rank.
- If user is Jain, onion/garlic/potato products should be filtered or flagged.
- If user is value mode, cheaper equivalent products rank higher.

### V1: Recent Behavior Heuristics

Use `UserEvents` from last 7/30/90 days.

Signals:

- Brand affinity:
  accepted/add/purchase count by brand.
- Category affinity:
  click/add/purchase count by category.
- Price comfort:
  median price by category.
- Substitution acceptance:
  whether user accepts cheaper/premium swaps.
- Negative feedback:
  remove/dislike/reject substitution.

Scoring:

```text
brand_affinity = normalized weighted event count
category_affinity = normalized weighted event count
price_comfort = closeness(product_price, user's median category price)
recency_weight = exp(-days_since_event / 21)
```

Event weights:

```text
impression: 0.1
click: 1
add_to_cart: 3
substitution_accept: 4
purchase: 5
remove_from_cart: -2
dislike: -5
substitution_reject: -3
```

### V2: Hybrid Matrix Factorization

Use LightFM because it supports user/item metadata and helps cold start.

Train offline using:

- user_id
- sku
- implicit event weight
- item features: brand, category, price bucket, dietary, occasion tags
- user features: budget mode, dietary, location, explicit preferences

Do not serve this directly until an evaluation notebook shows uplift over V1.

### V3: Sequential Recommendation

Use SASRec/DIEN/BST-inspired modeling after enough event data exists.

Why:

- Human intent changes across sessions.
- Recent context matters.
- A sequence like:
  `search: exam snacks -> click coffee -> add notebooks`
  should influence "exam prep" recommendations differently than old grocery
  purchases.

Training target:

- Predict next add-to-cart or purchase from prior event sequence.

Serving:

- Use model output as `sequential_interest_score` inside ranker.
- Do not replace deterministic filters.

## 10. Multimodal Ingestion Plan

Create:

```text
backend/app/ingestion/multimodal.py
```

Add API endpoints:

```text
POST /api/ingest/image
POST /api/ingest/pdf
POST /api/ingest/whatsapp
POST /api/ingest/prescription
```

Option A:

- Endpoint extracts text/intent and then calls existing parse pipeline.

Option B:

- Endpoint returns normalized text to frontend, frontend sends `/api/parse`.

Prefer Option A for user experience.

### Image / Handwritten List

Gemini prompt:

```text
You are extracting a shopping list from an image.
Return only JSON matching the ExtractionResult schema.
Preserve uncertain words with confidence low and notes.
Do not invent items.
```

Input:

- JPEG/PNG/WebP upload.

Output:

- `ExtractionResult`.

### PDF

Use Gemini document understanding for PDFs.

For PDFs under request size limits:

- Inline bytes are okay.

For large PDFs:

- Use Gemini Files API.

Output:

- Same `ExtractionResult`.

### WhatsApp

Support two modes:

1. Plain pasted chat text.
2. Screenshot upload.

Normalize:

- Remove timestamps and sender names where possible.
- Extract actual shopping/request content.
- Preserve speaker context if it affects quantities.

### Prescription

Safety rule:

- Extract medicine names, dosage, and doctor/patient metadata if visible.
- Do not recommend alternatives for prescription medicines.
- Mark prescription-only items as `requires_pharmacist_validation`.
- Show a disclaimer in UI.

Medical output item fields should include:

- `name`
- `strength`
- `dosage`
- `frequency`
- `duration`
- `confidence`
- `requires_validation`

For hackathon:

- Keep prescription flow as extraction and review only.
- Do not implement checkout for restricted drugs.

## 11. URL and YouTube Fix

Current backend supports URL and YouTube path, but chat sends all content as
text.

Modify:

```text
frontend/src/routes/chat.tsx
```

Add:

```typescript
function detectInputType(text: string): "text" | "url" {
  try {
    const url = new URL(text.trim());
    return ["http:", "https:"].includes(url.protocol) ? "url" : "text";
  } catch {
    return "text";
  }
}
```

Then:

```typescript
const body: any = {
  content: inputText,
  input_type: detectInputType(inputText),
};
```

Acceptance:

- Pasting a YouTube URL calls backend `InputType.URL`.
- Backend route enters `fetch_youtube_transcript`.
- Unsupported URLs show a helpful message.

## 12. Seed Catalog V2

Current `backend/seed_catalog.py` is useful but too small.

Create:

```text
backend/seed_catalog_v2.py
```

Target:

- 500 to 1000 SKUs for demo.
- Use synthetic but realistic Indian retail catalog.
- Include enough alternatives per category.

Categories:

- grains
- pulses
- oils
- dairy
- vegetables
- fruits
- spices
- snacks
- beverages
- bakery
- breakfast
- instant_food
- frozen
- cleaning
- hygiene
- personal_care
- baby
- pet
- stationery
- tools_hardware
- party_supplies
- festive
- medicines_otc
- fashion_men
- fashion_women
- fashion_kids
- footwear
- accessories

Required fields:

```python
{
    "sku": "SKU-SNK-002",
    "title": "lays classic salted chips",
    "brand": "Lays",
    "category": "snacks",
    "subcategory": "chips",
    "price_inr": Decimal("20"),
    "mrp_inr": Decimal("20"),
    "discount_pct": Decimal("0"),
    "unit": "g",
    "unit_quantity": Decimal("52"),
    "rating": Decimal("4.2"),
    "review_count": 1240,
    "review_preview": [
        "Crisp and fresh pack, good for parties.",
        "Classic salted taste, quantity is small but worth it."
    ],
    "in_stock": True,
    "keywords": {"chips", "potato chips", "wafers"},
    "synonyms": {"crisps", "namkeen packet", "party snack"},
    "tags": {"party", "movie_night"},
    "dietary_tags": {"veg"},
    "allergen_tags": set(),
    "occasion_tags": {"ipl_watch_party", "birthday", "picnic"},
    "image_url": "https://...",
    "search_text": "...",
}
```

Seed strategy:

- Build templates per category.
- Generate brand variants and pack-size variants.
- Generate price/rating/review_count deterministically.
- Include 2 to 5 review previews per SKU.
- Include Hinglish synonyms:
  chawal, atta, namak, tel, dahi, doodh, mirchi, chips, thanda, copy, pen.

Acceptance:

- At least 500 products seeded.
- At least 5 alternatives for common queries:
  chips, cold drink, rice, atta, milk, oil, notebook, pen, shampoo, detergent.
- No duplicate SKU.
- Product schema validates before writing to DynamoDB.
- Mock catalog and real seed catalog use compatible shape.

## 13. Retrieval and Resolver Refactor

Do not delete old resolver immediately.

Add interface:

```text
backend/app/search/retrieval.py
```

```python
class ProductRetriever(Protocol):
    def retrieve(
        self,
        query: ProductQuery,
        limit: int = 50,
    ) -> list[ProductCandidate]:
        ...
```

Implement:

1. `LocalRetriever`
   - Uses in-memory products.
   - Token/BM25-like scoring.
   - Good for local demo.

2. `OpenSearchRetriever`
   - Uses OpenSearch hybrid search.
   - Good for production.

Modify `resolve_cart`:

Current:

```text
ExtractedItem -> _match_product -> CartItem
```

Target:

```text
ExtractedItem
  -> ProductQuery
  -> Retriever top 50
  -> Filters
  -> Ranker top 5
  -> Best CartItem + Alternatives
```

Cart item model should include:

- selected product
- top alternatives
- reason codes
- ranking trace in debug mode

Do not send large ranking trace to frontend unless debug flag is enabled.

## 14. API Contract Changes

Update `backend/app/models.py`.

Add `InputType` values:

```python
IMAGE = "image"
PDF = "pdf"
WHATSAPP = "whatsapp"
PRESCRIPTION = "prescription"
```

Add request models:

```python
class UploadedParseResponse(BaseModel):
    session_id: str
    extracted_text: str | None
    confidence: str
    intents: list[IntentGroup]
    total_price_inr: float
    budget_exceeded: bool
    summary: str
```

Extend `CartItem`:

```python
alternatives: list[ProductAlternative] = Field(default_factory=list)
reason_codes: list[str] = Field(default_factory=list)
display_reason: str | None = None
stock_status: str = "available"
```

Add:

```python
class ProductAlternative(BaseModel):
    sku: str
    name: str
    brand: str
    price_per_unit_inr: float
    rating: float | None = None
    review_count: int | None = None
    reason: str
```

## 15. Frontend Plan

Modify:

- `frontend/src/routes/chat.tsx`
- `frontend/src/routes/cart.$id.tsx`
- maybe add `frontend/src/lib/api/needspeak.ts`

### Chat Input

Add:

- URL auto-detection.
- File picker for image/PDF.
- WhatsApp text mode.
- Upload progress.
- Clear error messages.

### Cart Panel

Show:

- selected item
- display reason
- stock status
- rating and review count
- review preview
- alternatives button
- apply substitution

Never show 100+ products.

Default display:

- 1 selected product.
- 3 alternatives hidden behind "More options".

### Preferences Page

Wire preferences to backend:

- dietary
- allergies
- preferred brands
- avoided brands
- budget mode

Store in `UserPreferences`, not local mock state.

## 16. Inventory and Concurrency Plan

This answers the "one item left and two users add it" question.

Add:

```text
POST /api/cart/{session_id}/reserve
POST /api/cart/{session_id}/release
POST /api/cart/{session_id}/commit
```

Reserve request:

```json
{
  "items": [
    {"sku": "SKU-SNK-002", "qty": 1, "location_id": "DELHI"}
  ],
  "idempotency_key": "uuid"
}
```

Reserve logic:

1. For each item, perform conditional update:
   `available_qty >= requested_qty`.
2. Create reservation item with TTL.
3. If any item fails:
   - do not silently succeed.
   - return failed SKU and alternatives.
4. Use DynamoDB transaction where possible.

Response for conflict:

```json
{
  "status": "partial_failed",
  "failed_items": [
    {
      "sku": "SKU-SNK-002",
      "reason": "out_of_stock",
      "message": "This item just went out of stock.",
      "alternatives": [...]
    }
  ]
}
```

Acceptance:

- Two concurrent reserve requests for the last unit: only one succeeds.
- Failed request gets alternatives.
- Retry with same idempotency key does not double reserve.

## 17. Observability and Evaluation

Add:

```text
backend/app/intelligence/event_logger.py
```

Log events for:

- impression
- click
- add_to_cart
- remove
- substitution accept/reject
- checkout/commit

Offline metrics:

- Precision@K
- Recall@K
- NDCG@K
- add-to-cart rate
- substitution acceptance rate
- cart completion rate
- latency p50/p95
- no-match rate
- out-of-stock conflict rate

Dashboards can be basic initially:

- Write query scripts or admin endpoint.
- Later export to S3/Athena/QuickSight.

## 18. Implementation Series

The AI agent must implement in this order.

### Phase 0: Repo Honesty and Small Fixes

Tasks:

1. Fix chat URL detection so URLs use `input_type: "url"`.
2. Include occasion routes in FastAPI if not already included.
3. Add tests for URL detection and backend URL parse contract.
4. Add clear error messages for unsupported URL and unavailable YouTube captions.

Files:

- `frontend/src/routes/chat.tsx`
- `backend/app/main.py`
- `backend/tests/`

Acceptance:

- Pasted YouTube URL reaches backend URL branch.
- Pasted normal text still uses text branch.
- Unsupported URL returns helpful message.

### Phase 1: DynamoDB Auth Migration

Tasks:

1. Add `backend/app/auth/dynamo_store.py`.
2. Add config variables:
   - `DYNAMODB_TABLE_USERS`
   - `DYNAMODB_TABLE_EMAIL_LOCKS`
   - `DYNAMODB_TABLE_AUTH_SESSIONS`
3. Replace CSV auth calls with store interface.
4. Store auth sessions in DynamoDB with TTL.
5. Add migration script:
   `backend/scripts/migrate_users_csv_to_dynamo.py`

Acceptance:

- Signup creates DynamoDB user.
- Duplicate email fails atomically.
- Login returns token.
- `/api/auth/me` works after server restart.
- Logout deletes session.

### Phase 2: Seed Catalog V2

Tasks:

1. Create product schema in `backend/app/catalog/models.py`.
2. Create `backend/seed_catalog_v2.py`.
3. Generate 500+ products.
4. Add review previews and synonyms.
5. Update mock catalog shape or adapter.

Acceptance:

- Seeder validates all products.
- Seeder is idempotent.
- Product count >= 500.
- Common queries have alternatives.

### Phase 3: Retrieval Abstraction

Tasks:

1. Create `backend/app/search/retrieval.py`.
2. Create `backend/app/search/local_retrieval.py`.
3. Create `backend/app/search/ranker.py`.
4. Modify resolver to use retriever + ranker.
5. Keep old keyword resolver as fallback.

Acceptance:

- `/api/parse` still works in mock mode.
- Cart item contains reason codes.
- Alternatives exist for common items.
- No UI freeze with broad requests like "chips".

### Phase 4: Multimodal Ingestion

Tasks:

1. Add upload endpoints:
   - `/api/ingest/image`
   - `/api/ingest/pdf`
   - `/api/ingest/whatsapp`
2. Use Gemini image/document understanding.
3. Validate output with `ExtractionResult`.
4. Wire frontend chips to real upload/input actions.

Acceptance:

- Image of shopping list creates cart.
- PDF list creates cart.
- WhatsApp text/screenshot creates cart.
- Low-confidence extraction asks clarification instead of hallucinating.

### Phase 5: Inventory Reservations

Tasks:

1. Add `backend/app/inventory/reservations.py`.
2. Add reservation endpoints.
3. Use DynamoDB conditional update.
4. Add TTL reservation records.
5. Update cart UI to reserve on "Review cart" or explicit "Reserve items".

Acceptance:

- Concurrent last-item test passes.
- Out-of-stock returns alternatives.
- Reservation expires.

### Phase 6: Preferences and Events

Tasks:

1. Persist preferences in DynamoDB.
2. Add event logging.
3. Add recent behavior heuristic scoring.
4. Add frontend calls for click/add/remove/substitute events.

Acceptance:

- Preferred brands rank higher.
- Avoided brands are filtered.
- Recent accepted substitutions influence future ranking.
- User events appear in DynamoDB.

### Phase 7: OpenSearch

Tasks:

1. Add `backend/app/search/opensearch_retrieval.py`.
2. Add index mapping script.
3. Add product indexing script.
4. Add environment toggle:
   - `SEARCH_PROVIDER=local|opensearch`
5. Add hybrid search query.

Acceptance:

- Local provider works without AWS OpenSearch.
- OpenSearch provider returns filtered top candidates.
- Ranker behavior remains stable across providers.

### Phase 8: Offline Recommendation Experiments

Tasks:

1. Export UserEvents to local CSV/S3.
2. Create notebook or script for LightFM baseline.
3. Evaluate against heuristic ranker.
4. Only integrate if metrics improve.

Acceptance:

- Report Precision@K/NDCG@K.
- Compare V1 heuristic vs LightFM.
- Do not deploy experimental model without fallback.

## 19. Test Plan

Backend tests:

- `test_text_parse.py`
- `test_url_parse.py`
- `test_multimodal_contract.py`
- `test_ranker.py`
- `test_inventory_reservations.py`
- `test_auth_dynamo_store.py`
- `test_seed_catalog_v2.py`

Critical test cases:

1. Hinglish party request:
   "bhai kal IPL party hai 10 logo ke liye chips cold drink under 2000"
2. Broad query:
   "chips"
   - Must not return all chips.
   - Must return top ranked chips + alternatives.
3. Budget:
   "birthday party for 20 under 3000"
4. Dietary:
   Jain preference + recipe containing onion/garlic.
5. YouTube:
   URL routes to YouTube branch.
6. Image:
   Handwritten-like list returns structured result.
7. PDF:
   PDF list returns structured result.
8. Inventory race:
   Two users reserve last unit; one wins.
9. Auth restart:
   Session still valid after server restart.

Frontend checks:

- Chat text works.
- URL works.
- Upload buttons work.
- Cart displays reason and alternatives.
- Long product names do not overflow.
- Mobile layout does not overlap.

## 20. Demo Story for Hackathon

Recommended demo sequence:

1. User logs in.
2. User sets preferences:
   vegetarian, value budget, prefers Amul/Haldiram.
3. User pastes:
   "IPL watch party for 12 people under 2000".
4. App creates cart with snacks, drinks, disposables.
5. User asks:
   "make it cheaper".
6. App shows substitutions with savings.
7. User uploads handwritten shopping list.
8. App merges it into cart.
9. User opens product alternatives for chips.
10. One product is low stock; reserve action shows inventory-aware behavior.

This story demonstrates:

- intent extraction
- Hinglish understanding
- occasion reasoning
- retrieval/ranking
- budget optimization
- multimodal input
- inventory correctness
- preference personalization

## 21. Answers to Expected Judge Questions

### How is search happening?

Current:

- Gemini extracts items.
- Python resolver scans cached products and matches keywords.

Target:

- Gemini extracts structured intent.
- OpenSearch retrieves candidates using hybrid text/vector search.
- Ranker picks top products using relevance, inventory, price, rating, and
  preferences.
- DynamoDB remains source of truth.

### How does this scale to millions of users?

- Stateless FastAPI workers behind load balancer.
- DynamoDB for user/session/cart/inventory with good partition keys.
- OpenSearch for product search; no runtime catalog scans.
- Async event logging.
- Caching for popular occasion templates and catalog docs.
- Ranking only on top candidate set, not full catalog.

### What if only one item is left?

- Suggestion does not reserve inventory.
- Add/reserve uses DynamoDB conditional update.
- First reservation wins.
- Second user gets an out-of-stock response plus alternatives.

### What if there are thousands of chips?

- Retrieval gets top 50.
- Ranker picks top 5.
- UI shows 1 selected + 3 alternatives.
- More options are paginated/lazy-loaded.

### How are product likelihood and alternatives decided?

V1:

- match score
- price fit
- stock
- rating/review count
- brand preference
- event context
- occasion tags

Later:

- LightFM/implicit collaborative filtering.
- SASRec/DIEN-style behavior sequence score.

### Why is this not AI slop?

- LLM output is schema-validated.
- Product choice is catalog-grounded.
- Ranking is explainable.
- Inventory is transactionally checked.
- Behavior engine is based on recommender-system research.
- Every important path has tests and metrics.

## 22. Agent Coding Guidelines

When implementing:

1. Prefer small PR-sized changes.
2. Preserve existing mock mode.
3. Keep Gemini optional via env vars.
4. Keep local demo path working without paid AWS services.
5. Add tests before touching broad flows.
6. Do not remove existing working endpoints unless replaced.
7. Update README after each major phase.
8. For every new endpoint, update API models and add a test.
9. For every new data shape, add validation.
10. For every ranker change, add deterministic test fixtures.

## 23. Suggested Immediate First Tasks

Start here:

```text
1. Fix URL auto-detection in chat.
2. Add DynamoDB auth store behind same auth routes.
3. Add Product schema and seed_catalog_v2.py.
4. Add LocalRetriever and Ranker V1.
5. Extend CartItem with alternatives and reasons.
6. Wire image/PDF uploads using Gemini.
7. Add inventory reservation conditional writes.
```

Do not start with:

- Training a deep recommendation model.
- Building a giant agentic shopping bot.
- Scraping live Amazon product pages.
- Letting Gemini directly output SKUs.

## 24. Definition of Done

The project is in a strong hackathon-ready state when:

- Text, URL, YouTube, image, PDF, WhatsApp inputs work.
- DynamoDB stores users and auth sessions.
- Catalog has 500+ realistic products with alternatives.
- Product matching uses retrieval + ranking, not only keyword scan.
- Cart items include explanations and alternatives.
- Inventory reservation handles race conditions.
- Preferences affect ranking.
- Events are logged for future recommendation training.
- README explains architecture and research foundation.
- Tests cover parse, rank, auth, seed, and inventory.

