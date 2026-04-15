# User Acceptance Testing (UAT) Form

## Verdant Search — AI-Boosted Multimodal Search Engine

**Participant Role:** ☐ End User &nbsp;&nbsp; ☐ Admin / IT Staff &nbsp;&nbsp; ☐ Evaluator

**Date:** _____________________ &nbsp;&nbsp; **Session No.:** _____________________

---

## Section 1 — Feature Acceptance

Please tick (✓) one rating for each feature listed below.

| Feature                                                                                                  | Very Weak | Weak | Average | Good | Excellent |
| -------------------------------------------------------------------------------------------------------- |:---------:|:----:|:-------:|:----:|:---------:|
| **FR-1 — Authentication & User Management**                                                              |           |      |         |      |           |
| User can register a new account with email and password.                                                 |           |      |         |      |           |
| User can log in using email and password.                                                                |           |      |         |      |           |
| User can log out of the system.                                                                          |           |      |         |      |           |
| User can view their personal profile information.                                                        |           |      |         |      |           |
| User can update their profile preferences (language, result count, reranker toggle).                     |           |      |         |      |           |
| **FR-2 — Core Search Interface**                                                                         |           |      |         |      |           |
| User can submit a search query and receive ranked results.                                               |           |      |         |      |           |
| Search results are displayed with title, source URL, snippet, relevance score, and content type badge.   |           |      |         |      |           |
| User can apply metadata filters (date range, source type, content type) to narrow results.               |           |      |         |      |           |
| Relevance score is shown as a colour-coded progress bar on each result card.                             |           |      |         |      |           |
| User can click a result card to open a document detail drawer with full chunk content and metadata.      |           |      |         |      |           |
| User can view the indexed date of each result directly on the result card.                               |           |      |         |      |           |
| **FR-2.5 / FR-2.6 — Conversational Search & Follow-up Chips**                                            |           |      |         |      |           |
| User can submit follow-up questions within the same session without losing context.                      |           |      |         |      |           |
| The system displays exactly 3 suggested follow-up query chips after each AI response.                    |           |      |         |      |           |
| User can click a follow-up chip to submit it immediately as a new query.                                 |           |      |         |      |           |
| User can click a follow-up chip to edit it before submitting.                                            |           |      |         |      |           |
| **FR-2.8 — Research Workspace**                                                                          |           |      |         |      |           |
| User can pin result documents to a persistent Research Workspace panel for side-by-side comparison.      |           |      |         |      |           |
| User can remove pinned documents from the Research Workspace.                                            |           |      |         |      |           |
| **FR-2.10 — Reranker Toggle & Ranking Diff**                                                             |           |      |         |      |           |
| User can toggle the multimodal reranker on or off per query.                                             |           |      |         |      |           |
| Reranked result cards show a rank-delta badge (e.g. +3 / −2) indicating position change.                 |           |      |         |      |           |
| **FR-1.4 / FR-1.5 — Search History**                                                                     |           |      |         |      |           |
| User can view a list of past search sessions.                                                            |           |      |         |      |           |
| User can filter history by date range or keyword.                                                        |           |      |         |      |           |
| User can re-open a past session and continue the conversation.                                           |           |      |         |      |           |
| User can delete individual history entries.                                                              |           |      |         |      |           |
| **FR-5 — AI Summary & RAG Generation**                                                                   |           |      |         |      |           |
| The AI panel streams a grounded answer based strictly on retrieved document context.                     |           |      |         |      |           |
| Inline citations in the AI answer link to the corresponding result card in the document panel.           |           |      |         |      |           |
| The system acknowledges when the retrieved context is insufficient to answer the query.                  |           |      |         |      |           |
| A confidence indicator is shown alongside the AI-generated answer.                                       |           |      |         |      |           |
| Query rewriting correctly converts conversational follow-ups into standalone retrieval queries.          |           |      |         |      |           |
| **FR-6 — Crawler Management Panel (Admin)**                                                              |           |      |         |      |           |
| Admin can view the crawler fleet table with live status (ACTIVE / DEGRADED / DEAD / IDLE).               |           |      |         |      |           |
| Admin can view per-worker job counts, pages/min, uptime, and last heartbeat timestamp.                   |           |      |         |      |           |
| Admin can view the Redis job queue depth (pending, in-flight, acknowledged).                             |           |      |         |      |           |
| Admin can inject seed URLs into the crawl job queue directly from the panel.                             |           |      |         |      |           |
| Admin can create a new crawl job with seed URL, max depth, max pages, and content type options.          |           |      |         |      |           |
| Admin can pause, resume, or cancel an existing crawl job.                                                |           |      |         |      |           |
| **FR-7 — Index & Database Management Panel (Admin)**                                                     |           |      |         |      |           |
| Admin can view the index overview dashboard (total documents, chunks, index size, last build time).      |           |      |         |      |           |
| Admin can browse and search all indexed documents with filter by source, date, and content type.         |           |      |         |      |           |
| Admin can trigger a full re-index or incremental index update from the panel.                            |           |      |         |      |           |
| Admin can soft-delete a document from the index.                                                         |           |      |         |      |           |
| **FR-8 — Analytics Dashboard (Admin)**                                                                   |           |      |         |      |           |
| Admin can view query volume over time (hourly / daily / weekly).                                         |           |      |         |      |           |
| Admin can view the top queries by frequency and zero-result queries.                                     |           |      |         |      |           |
| Admin can view query latency distribution (P50 / P90 / P99).                                             |           |      |         |      |           |
| Admin can view crawler analytics (pages crawled, HTTP status distribution, content type distribution).   |           |      |         |      |           |
| Admin can view system health metrics (CPU, memory per service).                                          |           |      |         |      |           |
| **FR-10 — System Configuration Panel (Admin)**                                                           |           |      |         |      |           |
| Admin can adjust BM25, HNSW, and RRF retrieval parameters (k1, b, ef_search, k constant) from the panel. |           |      |         |      |           |
| Admin can update LLM configuration (model, temperature, max tokens, system prompt template).             |           |      |         |      |           |
| Admin can configure follow-up chip settings (enable/disable, number of chips, prompt template).          |           |      |         |      |           |

---

## Section 2 — Overall System Usability

Please tick (✓) one rating for each statement below.

| Statement                                                                               | Strongly Disagree | Disagree | Moderate | Agree | Strongly Agree |
| --------------------------------------------------------------------------------------- |:-----------------:|:--------:|:--------:|:-----:|:--------------:|
| Overall, I am satisfied with how easy it is to use this search system.                  |                   |          |          |       |                |
| It was simple to submit a query and obtain useful results.                              |                   |          |          |       |                |
| It was easy to learn how to use the system without prior training.                      |                   |          |          |       |                |
| The interface layout (document panel, AI panel, workspace) is clear and well-organised. |                   |          |          |       |                |
| The system workflow from query to AI answer is straightforward and intuitive.           |                   |          |          |       |                |
| It is easy to navigate between the search interface and the admin panel.                |                   |          |          |       |                |
| The follow-up chip suggestions are relevant and useful for continuing my search.        |                   |          |          |       |                |
| The AI-generated answers are grounded and trustworthy based on the cited sources.       |                   |          |          |       |                |
| The search results are relevant to my query.                                            |                   |          |          |       |                |
| The system responds within an acceptable time for an end-to-end search with AI summary. |                   |          |          |       |                |
| The admin panel provides sufficient visibility and control over the crawler and index.  |                   |          |          |       |                |
| The analytics dashboard gives me actionable insight into system usage and health.       |                   |          |          |       |                |
| I would use Verdant Search as my primary tool for internal knowledge retrieval.         |                   |          |          |       |                |

---

# 
