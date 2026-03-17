# CLAUDE.md — Verdant Search
## AI-Boosted Sharded Distributed Search Engine

> Final Year Project | University of Malaya | Supervisor: CHIAM YIN KIA
> Student: CAI HONGYI S2175463

---

## Project Overview

Verdant Search is a full-stack multimodal search engine combining distributed web crawling,
hybrid retrieval (BM25 + HNSW), multimodal listwise reranking (LTR), and iterative
retrieval-augmented generation. The system is designed for enterprise-scale internal knowledge
search over text and image content.

The core research contribution is a multimodal Learning-to-Rank reranker that extends
setwise listwise prompting (RankZephyr-style) to vision-language models (BLIP-2 / CLIP),
enabling the first two-stage ranking system that considers both textual and visual evidence.

---

## Tech Stack

### Backend
- **Language:** Go (Golang) — high-performance concurrent processing, crawler orchestration, API layer
- **Database:** PostgreSQL — user data, document metadata, crawler registry, session history
- **Cache / Coordination:** Redis — crawler heartbeat, job queues, session store, query result cache
- **Search:** Pyserini (BM25 inverted index), FAISS + HNSW (vector ANN index)
- **Message passing:** Redis Streams (crawler job dispatch, NOT Kafka — already implemented)

### ML / AI
- **Framework:** PyTorch
- **LLM:** External API (Claude claude-sonnet-4-6 via Anthropic API)
- **Embedding:** Sentence-BERT (text), CLIP (image-text alignment)
- **Reranker:** BLIP-2 + custom multimodal listwise reranker

### Frontend
- **Framework:** React + TypeScript
- **Styling:** TailwindCSS + Shadcn/ui
- **State:** Zustand
- **Charts / Analytics:** Recharts + D3.js
- **Realtime:** WebSocket (crawler status, search streaming)
- **Landing / Docs:** Astro

---

## Current Implementation Status

| Module | Status | Notes |
|---|---|---|
| Distributed Crawler | Done | Workers push to Redis Streams; no Kafka needed |
| BM25 Inverted Index | Done | Pyserini-based |
| HNSW Vector Index | In progress | FAISS integration |
| Hybrid Retrieval + RRF | In progress | |
| Multimodal Reranker | Planned | Core research contribution |
| Follow-up / Query Rewriting | Done | Backend complete |
| Iterative RAG loop | Planned | |
| Frontend Search UI | In progress | |
| Admin Panel | Planned | See FR-6 through FR-10 below |
| Analytics Dashboard | Planned | See FR-8 |

---

## Architecture Notes

### Two-Stage Retrieval Pipeline
1. **Stage 1 — Fast Recall:** BM25 (inverted index) + HNSW (CLIP embeddings) run in parallel,
   fused with Reciprocal Rank Fusion (RRF), returns Top-1000 candidates in < 50ms
2. **Stage 2 — Multimodal Reranking:** Top-K (default 20) candidates passed to multimodal
   listwise reranker using BLIP-2; visual and textual evidence scored jointly; returns final Top-10

### Iterative RAG Loop
- User query → Stage 1+2 retrieval → Top-K injected into LLM prompt → LLM generates answer
  with inline citations
- LLM also generates 3 suggested follow-up queries (see FR-2.6)
- User selects or edits a follow-up → treated as new optimized search query → loop repeats
- Each iteration updates both the document panel and the AI response panel

### Crawler Architecture
- Each crawler worker registers itself with the backend via HTTP POST on startup
- Workers send periodic heartbeat PINGs to Redis (TTL-based liveness detection)
- Backend marks workers as DEAD if heartbeat expires; auto-deregisters after grace period
- Job dispatch via Redis Streams: backend pushes seed URLs, workers consume and push
  extracted documents back to an ingestion queue
- Workers report metadata per crawl: URL, crawl time, HTTP status, content type, image count,
  word count, depth reached

---

## Functional Requirements

### FR-1 — User Management
- FR-1.1: Email/password registration and login with JWT
- FR-1.2: SSO integration (LDAP / Active Directory / Okta)
- FR-1.3: User profile with configurable preferences (language, result count, reranker toggle)
- FR-1.4: Persistent conversation history per user stored in PostgreSQL
- FR-1.5: History panel: search, filter by date, delete, re-open past sessions
- FR-1.6: Session timeout with configurable TTL

---

### FR-2 — Core Search and Conversation UI
- FR-2.1: Dual-panel layout: left = ranked document list, right = AI conversation panel
- FR-2.2: On query submission, trigger hybrid retrieval Stage 1 + Stage 2 reranking
- FR-2.3: Document panel shows Top-K results with title, source, snippet, relevance badge,
  thumbnail (if image content), chunk ID, last modified date
- FR-2.4: AI panel streams LLM response with inline citations linking to document panel entries
- FR-2.5: Follow-up questions maintain conversation state; query rewriter converts them to
  standalone search queries before retrieval
- FR-2.6: After each LLM response, system generates and displays 3 suggested follow-up query
  chips below the response. User can: (a) click to immediately submit, (b) click to edit before
  submitting, (c) ignore and type manually. Chips are distinct in direction (e.g. one clarifying,
  one broadening, one deepening)
- FR-2.7: Document panel entries are clickable; opens a document detail drawer showing full
  chunk content, highlighted matched terms, document metadata, and page preview image
- FR-2.8: User can pin documents from the result list to a persistent "Research Workspace" panel
  for side-by-side comparison across multiple queries
- FR-2.9: Query history dropdown shows last 10 queries in current session for quick re-run
- FR-2.10: User can toggle reranker on/off per query and see ranking diff (original order vs
  reranked order) as an optional side-by-side view

---

### FR-3 — Data Ingestion and Indexing
- FR-3.1: Automated ingestion from Confluence, Google Drive, Git repos, local network shares
- FR-3.2: Document chunking by paragraph / heading / fixed token count (configurable)
- FR-3.3: Configurable index refresh: real-time incremental or scheduled batch
- FR-3.4: BM25 inverted index built over all text chunks via Pyserini
- FR-3.5: CLIP embeddings + HNSW index built for all chunks (text and image)
- FR-3.6: Duplicate detection using content hash before indexing
- FR-3.7: Admin can trigger full re-index or partial re-index on selected sources from UI

---

### FR-4 — Retrieval Module
- FR-4.1: BM25 keyword retrieval with configurable top-N
- FR-4.2: Dense vector retrieval (HNSW) with configurable top-N
- FR-4.3: RRF fusion of BM25 and vector scores
- FR-4.4: Retrieved chunks include metadata: source, page number, chunk ID, modified date,
  content type (text/image/table), relevance score
- FR-4.5: Metadata pre-filtering: date range, source type, domain, content type
- FR-4.6: Retrieval API exposes per-stage scores for debugging (visible in admin panel)

---

### FR-5 — Generation Module
- FR-5.1: Top-K chunks formatted and injected into LLM system prompt
- FR-5.2: Grounded generation only: LLM answers strictly from provided context
- FR-5.3: Inline citations in generated answer link to specific source chunks
- FR-5.4: Multi-turn conversation state maintained per session
- FR-5.5: Knowledge boundary acknowledgement: LLM states when context is insufficient
- FR-5.6: Query Rewriting module converts follow-ups to standalone queries
- FR-5.7: System generates exactly 3 suggested follow-up chips per response (FR-2.6 backend)
- FR-5.8: LLM response includes a structured confidence indicator derived from retrieval scores

---

### FR-5-LTR — Multimodal Learning-to-Rank Reranker (Core Research Component)

This describes the full design and prompt engineering for the multimodal listwise reranker
which is the primary research contribution of the project.

#### Overview
The reranker operates as Stage 2 after RRF fusion. It receives the Top-20 candidate chunks
from Stage 1 and produces a reordered list optimized for nDCG. Each chunk may contain text,
an image, or both. The reranker calls the LLM API with a carefully structured prompt that
includes both textual and visual evidence.

#### Text-Only Listwise Reranking Prompt (baseline, no images)
Used when all candidates are text-only chunks. Mirrors RankZephyr setwise approach.

```
System:
You are a search relevance expert. Your task is to rank passages by their relevance
to a user search query. You must consider semantic relevance, factual coverage, and
information density. Do not explain your reasoning. Output only the ranking.

User:
I will provide you with {N} passages. Each passage is identified by a number [1] to [{N}].
Rank all passages from most relevant to least relevant for the following search query.

Search Query: {query}

{for i, chunk in enumerate(candidates)}
[{i+1}] {chunk.text}
{end}

Output the ranking as a list of identifiers in descending order of relevance.
Format: [{best}] > [{second}] > ... > [{worst}]
Output only this line and nothing else.
```

#### Multimodal Listwise Reranking Prompt (text + image chunks)
Used when one or more candidates contain images (charts, figures, diagrams). The LLM API
call includes image content via base64 in the messages array alongside text.

```
System:
You are a multimodal search relevance expert. You will be given a search query and a set
of candidate document passages. Some passages are text only. Some include an image such as
a chart, figure, diagram, or table screenshot alongside descriptive text. Your task is to
rank all passages by how well they answer or relate to the query. Visual content in images
is equally valid evidence as text. Do not explain. Output only the ranking.

User:
Search Query: {query}

Rank the following {N} passages from most to least relevant. Each is labeled [1] to [{N}].
Text passages appear as plain text. Multimodal passages include an image followed by any
associated caption or surrounding text.

[1]
Type: text
Content: {chunk_1.text}

[2]
Type: multimodal
Image: <base64 image attached as vision input>
Caption: {chunk_2.caption}
Surrounding text: {chunk_2.context_text}

[3]
Type: text
Content: {chunk_3.text}

... (up to [{N}])

Output format: [{best}] > [{second}] > ... > [{worst}]
Output only this line and nothing else.
```

#### Sliding Window Strategy
Because the LLM context window limits how many candidates can be ranked at once, a sliding
window is used for lists longer than the window size W (default W=10):

1. Sort candidates by Stage 1 RRF score descending
2. Apply window from position N down to position 1 in steps of stride S (default S=5)
3. Within each window, run the listwise prompt and update positions
4. Continue until window reaches top of list
5. Final order is the result after all window passes

This mirrors the progressive reranking strategy from RankZephyr and keeps API call count bounded.

#### Follow-up Suggestion Prompt
Called after the LLM generates its main answer. Produces exactly 3 follow-up chips.

```
System:
You are a search assistant helping a user explore a topic. Based on the user query and
the answer just generated, produce exactly 3 follow-up search queries the user might want
to explore next. Each follow-up must serve a distinct purpose:
  - Query A: a clarifying or more specific version of the original query
  - Query B: a broader related topic the user might want to explore
  - Query C: a deeper technical or analytical angle on the topic

Rules:
  - Each query must be a standalone search query (no references to "above" or "this")
  - Each must be under 15 words
  - Output as JSON array only: ["query_a", "query_b", "query_c"]
  - No other text

User:
Original query: {original_query}
Generated answer summary: {answer_first_150_chars}
```

#### Query Rewriting Prompt
Called when user submits a follow-up in a multi-turn session. Converts conversational
follow-up into a standalone search query safe to send to the retriever.

```
System:
You are a query rewriting assistant. A user is in a multi-turn search session.
Given the conversation history and the user follow-up message, rewrite the follow-up
as a fully self-contained search query that can be understood without any prior context.
Preserve the user intent. Do not add assumptions. Output only the rewritten query as
plain text, nothing else.

User:
Conversation history:
{last_3_turns_summary}

User follow-up: {follow_up_text}

Rewritten query:
```

#### Relevance Score Extraction (Pointwise fallback)
When window size cannot accommodate listwise ranking (e.g. very large image chunks hitting
token limits), fall back to pointwise scoring per candidate:

```
System:
You are a search relevance judge. Given a query and a single passage (which may include
an image), output a relevance score from 0 to 3 where:
  0 = not relevant
  1 = marginally relevant
  2 = relevant
  3 = highly relevant and directly answers the query

Output only the integer score and nothing else.

User:
Query: {query}
Passage: {chunk text and/or image}
Score:
```

Scores from pointwise fallback are used to sort candidates when listwise prompt fails or
is truncated.

---

### FR-6 — Distributed Crawler Management Panel
This panel is accessible to admin users and provides full orchestration visibility and control
over the distributed crawler fleet.

- FR-6.1: Crawler Registration
  - Each crawler worker auto-registers with the backend on startup via HTTP POST /api/crawlers/register
  - Registration payload: worker ID, IP address, hostname, version, capabilities (JS rendering, proxy support etc)
  - Backend stores registration in PostgreSQL crawler_workers table
  - Registered workers appear in panel immediately via WebSocket push

- FR-6.2: Crawler Liveness and Heartbeat
  - Workers send heartbeat every 10s to Redis key crawler:heartbeat:{worker_id} with TTL 30s
  - Backend daemon monitors keys; marks worker DEGRADED at 20s, DEAD at 30s
  - Panel shows live status badge per worker: ACTIVE / DEGRADED / DEAD / IDLE
  - Dead workers can be auto-deregistered or kept for audit with configurable policy

- FR-6.3: Crawler Fleet Table
  - Table columns: Worker ID, Name (editable), IP Address, Status, Jobs Completed, Jobs Failed,
    Pages/min (live), Uptime, Last Heartbeat, Capabilities, Actions
  - Inline CRUD: rename worker, set tags, assign to crawler group, deregister
  - Bulk actions: pause all, resume all, drain queue for selected workers

- FR-6.4: Job Queue Visibility
  - Live view of Redis Stream: pending jobs count, in-flight count, acknowledged count
  - Per-worker queue depth shown as sparkline in fleet table
  - Admin can inject seed URLs directly from panel into the job queue
  - Admin can purge specific URLs or entire queue

- FR-6.5: Crawl Job CRUD
  - Create new crawl job: seed URL, max depth, max pages, allowed domains, crawl frequency,
    content types to extract (text/images/both), JS rendering toggle
  - Jobs stored in PostgreSQL crawl_jobs table with full config and status
  - Edit / pause / cancel / delete jobs from panel
  - Recurring jobs support cron expression scheduling

- FR-6.6: Per-Worker Crawl Metadata View
  - Clicking a worker opens a detail drawer showing:
    - Recent crawl log: URL, status code, latency, content type, word count, image count, depth
    - Error log: failed URLs with error reason
    - Resource usage: memory estimate, jobs/min over time (sparkline)
    - Extracted documents preview: last 10 documents ingested by this worker

- FR-6.7: Domain and URL Management
  - Allowlist / blocklist management for domains and URL patterns
  - Robots.txt override policy per domain (respect / ignore)
  - Per-domain crawl rate limiting (requests/sec) configured from panel
  - View all crawled domains with page count, last crawl time, status

- FR-6.8: Crawler Group Orchestration
  - Create named crawler groups (e.g. "internal-docs-group", "news-group")
  - Assign workers to groups; jobs targeted to groups
  - Group-level pause / resume / rate-limit controls

---

### FR-7 — Index and Database Management Panel
Direct visibility and control over the search index and underlying data stores.

- FR-7.1: Index Overview Dashboard
  - Total documents, total chunks, index size on disk, last full build time, last incremental
    update time, estimated staleness (hours since last update)
  - Per-source breakdown: document count, chunk count, last indexed time

- FR-7.2: Index Operations
  - Trigger full re-index (with confirmation modal showing estimated time and resource cost)
  - Trigger incremental index update for selected sources
  - Rebuild only BM25 index / only vector index / both
  - Schedule nightly index refresh via cron expression in UI

- FR-7.3: Document Browser
  - Searchable table of all indexed documents: title, source, URL, chunk count, index date,
    content type, file size
  - Filter by source, date range, content type
  - Click document: preview all chunks with embeddings, BM25 term stats, metadata
  - Admin can manually delete a document from index (soft delete with tombstone)
  - Admin can re-index a single document on demand

- FR-7.4: Chunk Inspector
  - Search chunks by keyword or embedding similarity (ANN query from admin panel)
  - View chunk raw text, token count, CLIP embedding norm, BM25 term frequency stats
  - Useful for debugging retrieval quality on specific queries

- FR-7.5: Vector Index Explorer
  - HNSW index stats: total vectors, dimension, ef_construction, M parameter, index version
  - Run ad-hoc ANN query from panel: enter query text, see nearest neighbors with distances
  - Compare BM25 result vs vector result for same query side by side

- FR-7.6: PostgreSQL Query Console (Admin only, read-only by default)
  - Safe read-only SQL query interface for admins to inspect metadata tables
  - Common preset queries: top crawled domains, most retrieved documents, index coverage gaps
  - Export query results as CSV
  - Write access gated behind separate permission flag

- FR-7.7: Redis Inspector
  - View crawler heartbeat keys and TTLs
  - View job queue stream lengths
  - View session cache hit/miss ratio
  - Flush specific cache namespaces (query cache, session cache) from panel

---

### FR-8 — Analytics and Observability Dashboard
System-wide analytics for search quality, usage patterns, and infrastructure health.

- FR-8.1: Search Query Analytics
  - Query volume over time (hourly / daily / weekly) as line chart
  - Top 20 queries by frequency — table with query text, count, avg result click rank
  - Zero-result queries list: queries that returned no relevant results, for index gap analysis
  - Query latency distribution: P50 / P90 / P99 as histogram and time-series
  - Stage breakdown latency: BM25 time vs vector time vs reranker time vs LLM time (stacked bar)

- FR-8.2: Retrieval Quality Metrics
  - Live nDCG@10 rolling average on labeled evaluation queries (if evaluation set loaded)
  - Click-through rate (CTR) per rank position (position bias curve)
  - Reranker delta: how many positions documents moved after reranking on average
  - BM25 vs vector contribution: pie chart of which first-stage source contributed the top result

- FR-8.3: RAG Generation Analytics
  - Answer generation rate: % of queries that produced a grounded answer vs knowledge-boundary
    acknowledgement
  - Citation accuracy proxy: % of cited chunks that were actually in the Top-K context window
  - Follow-up conversion rate: % of sessions where user selected a suggested follow-up chip
  - Session depth distribution: histogram of number of turns per session

- FR-8.4: Crawler Analytics
  - Total pages crawled over time (cumulative line chart)
  - Pages/hour per worker (grouped bar chart)
  - HTTP status code distribution: 200 / 301 / 403 / 404 / 5xx (donut chart)
  - Content type distribution: HTML / PDF / image / other
  - Domain coverage: treemap of pages per domain
  - Failed URL heatmap: error type vs domain

- FR-8.5: System Health Panel
  - CPU / memory usage per service (Go backend, Python ML serving, PostgreSQL, Redis)
  - GPU utilization (for CLIP encoder and LLM serving)
  - HNSW index query latency percentiles (live)
  - BM25 inverted index lookup latency percentiles (live)
  - Alert rules: configurable thresholds with in-panel notification badges

- FR-8.6: User Activity Analytics (privacy-preserving, aggregated)
  - Daily / monthly active users
  - Sessions per user distribution
  - Feature usage breakdown: hybrid search vs keyword only vs vector only usage ratio
  - Reranker toggle rate: % of queries run with reranker enabled

---

### FR-9 — Multimodal Reranker Management Panel
Visibility and control over the LTR reranker model.

- FR-9.1: Model Registry
  - List of loaded reranker model checkpoints: name, version, parameter count, load date, status
  - Activate / deactivate a model checkpoint
  - Upload new model checkpoint from UI (stored to model registry path)

- FR-9.2: Live Reranking Debugger
  - Enter a query and a set of document IDs from the index
  - Run reranker and see: input scores, output scores, delta, which visual features activated
  - Side-by-side comparison of text-only reranker vs multimodal reranker on same query

- FR-9.3: Reranker Evaluation Runner
  - Load evaluation dataset (TREC DL / MMDocIR format)
  - Run batch evaluation and display nDCG@10, MRR, Recall@K in results table
  - Compare results across multiple model checkpoints in the same run

- FR-9.4: Training Data Browser
  - View query-document relevance pairs used for training
  - Filter by relevance grade, domain, content type
  - Manually annotate new query-document pairs from UI (lightweight annotation tool)

---

### FR-10 — System Configuration Panel
- FR-10.1: Search configuration: BM25 k1/b parameters, HNSW ef_search, RRF k constant,
  Top-K for Stage 1, Top-K for Stage 2 reranker window — all editable from panel
- FR-10.2: LLM configuration: model selection, max tokens, temperature, system prompt template
  editor, context window size
- FR-10.3: Follow-up chip configuration: enable/disable chip generation, number of chips (1-5),
  chip generation prompt template editor
- FR-10.4: Index configuration: chunk size, chunk overlap, embedding model selection, HNSW
  M and ef_construction parameters
- FR-10.5: Crawler configuration: global crawl rate limit, default max depth, default max pages,
  heartbeat interval, dead worker grace period, job queue max size
- FR-10.6: All configuration changes are versioned and auditable: timestamp, changed by, before/after diff

---

## UI/UX Design Requirements

### Layout Principles
- Primary search view: 3-column layout on desktop
  - Column 1 (30%): Ranked document list with filter sidebar
  - Column 2 (45%): AI conversation panel with streaming response and follow-up chips
  - Column 3 (25%): Collapsible Research Workspace (pinned documents, notes)
- Admin panel: full-width with left sidebar navigation
- All panels support collapse/expand; layout state persisted per user
- Dark mode and light mode support

### Search UI Details
- Follow-up suggestion chips (FR-2.6):
  - Rendered as 3 rounded pill buttons below each AI response
  - Each chip has a distinct intent icon: magnifying glass (refine), expand arrows (broaden),
    depth arrow (explore deeper)
  - Hover shows full query text in tooltip if truncated
  - Clicking enters edit mode inline before submitting
  - Chips animate in with staggered fade after LLM response completes streaming

- Document result cards:
  - Show relevance score as colored progress bar (green > 0.8, yellow > 0.5, red < 0.5)
  - Show content type badge: TEXT / IMAGE / TABLE / MIXED
  - Show rerank delta badge if reranker is active (e.g. "+3" or "-2" showing position movement)
  - Thumbnail for image-containing documents (extracted first image)
  - Expandable snippet with matched terms highlighted

- Ranking diff view (FR-2.10):
  - Toggle button in document panel header activates split view
  - Left half shows pre-rerank order, right half shows post-rerank order
  - Documents connected by animated lines showing movement

### Admin Panel UI Details
- Crawler fleet table uses WebSocket for live status updates without page refresh
- Worker status badges pulse animation for ACTIVE, red flash for DEAD
- Job queue depth shown as mini sparkline in each worker row
- All CRUD modals use optimistic UI with rollback on failure
- Analytics charts use Recharts with brush/zoom for time-series
- SQL console uses CodeMirror with syntax highlighting and query history

---

## API Design Notes

### Crawler Registration Endpoint
```
POST /api/crawlers/register
Body: {
  worker_id: string,       // uuid generated by worker
  ip_address: string,
  hostname: string,
  version: string,
  capabilities: string[],  // ["js_render", "proxy", "image_extract"]
  group: string | null
}
Response: {
  registered: true,
  heartbeat_interval_sec: 10,
  job_stream_key: string   // Redis stream key to consume from
}
```

### Crawler Heartbeat
```
POST /api/crawlers/{worker_id}/heartbeat
Body: { jobs_completed: int, jobs_failed: int, pages_per_min: float }
Response: { status: "ok" | "drain" | "shutdown" }
```
Backend handler sets Redis key crawler:heartbeat:{worker_id} = timestamp with TTL 30s.
"drain" instructs worker to finish current job and stop accepting new ones.
"shutdown" instructs worker to stop immediately.

### Search API
```
POST /api/search
Body: {
  query: string,
  session_id: string | null,
  filters: { date_range?, source_type?, content_type? },
  options: { reranker_enabled: bool, top_k: int }
}
Response: {
  results: SearchResult[],
  answer: string (streaming via SSE),
  citations: Citation[],
  follow_up_suggestions: string[],  // always 3
  query_id: string,
  stage_timings: { bm25_ms, hnsw_ms, rrf_ms, reranker_ms, llm_ms }
}
```



---

## Non-Functional Requirements

| ID | Attribute | Requirement |
|---|---|---|
| NFR-1.1 | Security: Auth | SSO integration; JWT with refresh tokens |
| NFR-1.2 | Security: Confidentiality | File-level permission inheritance from source systems |
| NFR-1.3 | Security: Integrity | LLM called via API; all document data and index stay within private infrastructure |
| NFR-2.1 | Latency | P90 query-to-first-token < 4 seconds |
| NFR-2.2 | Scale | Index supports 10M+ documents |
| NFR-2.3 | Crawler | Fleet supports 50+ concurrent workers |
| NFR-3.1 | Availability | 99.5% uptime during business hours |
| NFR-4.1 | Modularity | Crawler / indexer / retriever / reranker / generator independently deployable |
| NFR-5.1 | Usability | New user productive within 5 minutes without training |
| NFR-6.1 | Observability | All service metrics exported to Prometheus; dashboards in Grafana |

---

## Evaluation Goals

### Retrieval
- nDCG@10 on TREC DL19/DL20 vs BM25 baseline and RankZephyr
- Recall@100 first-stage coverage
- Zero-shot generalization: nDCG@10 across BEIR 18 datasets

### Multimodal Reranking (Core Contribution)
- mAP@50, nDCG@50, MRR on MMDocIR benchmark
- Ablation: text-only reranker vs multimodal reranker (delta nDCG@10)
- Evidence type breakdown: Text / Table / Visual performance separately
- Query rephrasing robustness: nDCG@5 degradation across paraphrase Level 0-3

### RAG Generation
- Faithfulness: % of answer claims supported by retrieved context
- Citation precision and recall
- Iterative improvement: nDCG@10 round 1 vs round 2 after query rewriting
- Follow-up chip adoption rate: % of users selecting a suggested chip vs typing manually

### System Performance
- BM25 retrieval < 50ms P90
- HNSW retrieval < 50ms P90
- Reranker < 200ms P90 (Top-20 window)
- End-to-end < 4s P90

---

## Development Conventions

- All backend routes prefixed `/api/v1/`
- Frontend component files use PascalCase; utility functions use camelCase
- All database migrations tracked in `/migrations/` with timestamp prefix
- No external LLM API calls in production; local SGLang serving only
- Redis key naming convention: `{namespace}:{entity_type}:{id}` (e.g. `crawler:heartbeat:uuid`)
- All admin panel actions that mutate state require confirmation modal with action description
- WebSocket connections use `/ws/v1/{channel}` pattern
- Avoid breaking dashes in code identifiers; use underscores in DB, camelCase in Go/TS