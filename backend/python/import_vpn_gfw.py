"""
Bulk importer for vpn_gfw_dataset_high_quality.csv → Verdant Search database

Uses batch CLIP embedding + bulk SQL inserts for BM25 posting lists.

Usage:
    python import_vpn_gfw.py                      # index up to 5000 docs
    python import_vpn_gfw.py --limit 0            # index all 254K docs (hours)
    python import_vpn_gfw.py --limit 1000         # index first 1000 docs
    python import_vpn_gfw.py --batch-size 200     # tune commit batch size
"""
import asyncio
import csv
import sys
import os
import argparse
import time
from typing import List, Dict

sys.path.insert(0, os.path.dirname(__file__))
csv.field_size_limit(10_000_000)

DEFAULT_CSV   = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../vpn_gfw_dataset_high_quality.csv"))
MIN_CONTENT   = 50
MAX_CONTENT   = 5000
MAX_TITLE     = 200
EMBED_BATCH   = 64
DEFAULT_LIMIT = 5000
DEFAULT_BATCH = 100


def parse_args():
    p = argparse.ArgumentParser(description="Import VPN/GFW CSV into Verdant Search")
    p.add_argument("--csv",           default=DEFAULT_CSV)
    p.add_argument("--limit",         type=int, default=DEFAULT_LIMIT,
                   help="Max docs to index (0 = all)")
    p.add_argument("--batch-size",    type=int, default=DEFAULT_BATCH)
    p.add_argument("--skip-existing", action="store_true",  default=True)
    p.add_argument("--no-skip-existing", dest="skip_existing", action="store_false")
    return p.parse_args()


def read_csv_rows(csv_path: str, limit: int) -> List[dict]:
    rows, seen = [], set()
    with open(csv_path, newline="", encoding="utf-8") as f:
        for raw in csv.DictReader(f):
            title   = (raw.get("title") or "").strip()[:MAX_TITLE]
            link    = (raw.get("link")  or "").strip()
            content = (raw.get("content") or "").strip()
            if len(content) < MIN_CONTENT:
                continue
            if link and link in seen:
                continue
            if link:
                seen.add(link)
            rows.append({"title": title or link, "url": link, "content": content[:MAX_CONTENT]})
            if limit and len(rows) >= limit:
                break
    return rows


async def bulk_import(args):
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import text
    from config import settings
    from embedding_service import get_embedding_service
    from tokenizer_service import get_tokenizer_service
    from models import Document, DocumentEmbedding

    print("=" * 60)
    print("  Verdant Search — VPN/GFW Dataset Importer")
    print("=" * 60)

    csv_path = os.path.abspath(args.csv)
    if not os.path.exists(csv_path):
        print(f"[ERROR] CSV not found: {csv_path}")
        sys.exit(1)

    print(f"Reading CSV: {csv_path}")
    rows = read_csv_rows(csv_path, args.limit)
    print(f"  Candidate rows: {len(rows):,}")

    print("Loading CLIP model...")
    emb_svc = get_embedding_service()
    tok_svc = get_tokenizer_service()
    print(f"  Embedding device: {emb_svc.device}")

    engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
    SessionFactory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    if args.skip_existing:
        async with SessionFactory() as session:
            res = await session.execute(text("SELECT url FROM documents WHERE url IS NOT NULL"))
            existing = {r[0] for r in res.fetchall()}
        before = len(rows)
        rows = [r for r in rows if r["url"] not in existing]
        print(f"  Skipping {before - len(rows):,} already-indexed  →  {len(rows):,} to index")

    if not rows:
        print("Nothing new to index.")
        await engine.dispose()
        return

    total, indexed, failed = len(rows), 0, 0
    t_start = time.time()
    batch_size = args.batch_size

    print(f"\nIndexing {total:,} docs  (commit_batch={batch_size}, embed_batch={EMBED_BATCH})")
    print("-" * 60)

    for b_start in range(0, total, batch_size):
        batch = rows[b_start : b_start + batch_size]

        async with SessionFactory() as session:
            try:
                # ── 1. Insert documents ──────────────────────────────
                doc_objs = []
                for r in batch:
                    doc = Document(
                        title        = r["title"],
                        content      = r["content"],
                        url          = r["url"] or None,
                        source_type  = "web",
                        doc_metadata = {"source_dataset": "vpn_gfw_high_quality"},
                    )
                    session.add(doc)
                    doc_objs.append(doc)
                await session.flush()   # get IDs

                # ── 2. Batch CLIP embeddings ──────────────────────────
                texts = [f"{r['title']}. {r['content']}" for r in batch]
                all_embs = []
                for es in range(0, len(texts), EMBED_BATCH):
                    all_embs.extend(emb_svc.encode_text(texts[es : es + EMBED_BATCH]))

                for doc, emb in zip(doc_objs, all_embs):
                    session.add(DocumentEmbedding(document_id=doc.id, embedding=emb.tolist()))

                # ── 3. BM25 posting lists (bulk) ──────────────────────
                # Collect per-document token stats
                batch_terms: Dict[str, None] = {}   # unique terms across batch
                doc_term_stats = []                  # [{doc_id, doc_length, term_tf: {term: tf}}]

                for doc, r in zip(doc_objs, batch):
                    tokens = tok_svc.tokenize(f"{r['title']} {r['content']}", mode="search")
                    if not tokens:
                        doc_term_stats.append(None)
                        continue
                    term_tf: Dict[str, int] = {}
                    for tok in tokens:
                        if len(tok) > 100:   # skip base64/binary noise tokens
                            continue
                        term_tf[tok] = term_tf.get(tok, 0) + 1
                        batch_terms[tok] = None
                    doc_term_stats.append({"doc_id": doc.id, "doc_length": len(tokens), "term_tf": term_tf})

                # Bulk upsert all unique terms, get their IDs
                if batch_terms:
                    term_list = list(batch_terms.keys())
                    # Bulk insert (ignore conflicts), then fetch IDs
                    for term in term_list:
                        await session.execute(
                            text("INSERT INTO terms (term, doc_frequency) VALUES (:t, 0) ON CONFLICT (term) DO NOTHING"),
                            {"t": term}
                        )
                    res = await session.execute(
                        text("SELECT term, id FROM terms WHERE term = ANY(:terms)"),
                        {"terms": term_list}
                    )
                    term_id_map: Dict[str, int] = {row[0]: row[1] for row in res.fetchall()}

                    # Bulk update doc_length
                    doc_length_params = [
                        {"dl": s["doc_length"], "id": s["doc_id"]}
                        for s in doc_term_stats if s is not None
                    ]
                    if doc_length_params:
                        await session.execute(
                            text("UPDATE documents SET doc_length = :dl WHERE id = :id"),
                            doc_length_params
                        )

                    # Collect all postings for the whole batch → one bulk insert
                    posting_params = []
                    for stats in doc_term_stats:
                        if stats is None:
                            continue
                        for term, tf in stats["term_tf"].items():
                            tid = term_id_map.get(term)
                            if tid is None:
                                continue
                            posting_params.append({"tid": tid, "did": stats["doc_id"], "tf": tf})

                    if posting_params:
                        await session.execute(
                            text("""
                                INSERT INTO postings (term_id, document_id, term_frequency, positions)
                                VALUES (:tid, :did, :tf, '{}')
                                ON CONFLICT (term_id, document_id) DO UPDATE
                                    SET term_frequency = EXCLUDED.term_frequency
                            """),
                            posting_params
                        )

                    # Bulk update doc_frequency for all affected terms
                    await session.execute(
                        text("""
                            UPDATE terms t
                            SET doc_frequency = sub.cnt
                            FROM (
                                SELECT term_id, COUNT(*) AS cnt
                                FROM postings
                                WHERE term_id = ANY(:tids)
                                GROUP BY term_id
                            ) sub
                            WHERE t.id = sub.term_id
                        """),
                        {"tids": list(term_id_map.values())}
                    )

                # ── 4. Update global doc_stats ─────────────────────────
                await session.execute(text("""
                    INSERT INTO doc_stats (id, total_docs, avg_doc_length)
                    VALUES (1,
                        (SELECT COUNT(*) FROM documents),
                        (SELECT COALESCE(AVG(doc_length),0) FROM documents WHERE doc_length > 0)
                    )
                    ON CONFLICT (id) DO UPDATE
                        SET total_docs = EXCLUDED.total_docs,
                            avg_doc_length = EXCLUDED.avg_doc_length
                """))

                await session.commit()
                indexed += len(batch)

            except Exception as e:
                await session.rollback()
                failed += len(batch)
                print(f"  [WARN] Batch {b_start//batch_size + 1} failed: {e}")
                continue

        elapsed = time.time() - t_start
        rate    = indexed / elapsed if elapsed > 0 else 1
        eta_m   = (total - indexed) / rate / 60
        print(
            f"  [{indexed:>6,}/{total:,}] {indexed/total*100:5.1f}%  "
            f"{rate:6.1f} docs/s  ETA {eta_m:.1f}m  (failed: {failed})"
        )

    elapsed = time.time() - t_start
    print("-" * 60)
    print(f"Completed in {elapsed:.1f}s")
    print(f"  Indexed : {indexed:,}  |  Failed : {failed:,}  |  Rate : {indexed/elapsed:.1f} docs/s")
    print("=" * 60)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(bulk_import(parse_args()))
