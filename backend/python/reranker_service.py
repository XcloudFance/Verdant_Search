import anthropic
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import Document
from config import settings
import time


class RerankerService:
    """
    Stage 2 multimodal listwise LTR reranker.

    Implements the sliding-window listwise reranking strategy described in FR-5-LTR.
    Supports text-only and multimodal (text + image) candidate passages.
    Falls back to pointwise scoring when the listwise call fails.
    """

    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=settings.ANTHROPIC_API_KEY,
            base_url=settings.ANTHROPIC_BASE_URL,
        )
        self.model = "claude-haiku-4-5-20251001"
        self.window_size = 10
        self.stride = 5
        self.max_text_length = 500  # truncate each candidate for token efficiency

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def rerank(
        self,
        query: str,
        candidates: List[Dict],
        session: AsyncSession,
    ) -> List[Dict]:
        """
        Stage 2 reranking of candidates produced by Stage 1 RRF fusion.

        Args:
            query:      The user search query.
            candidates: List of dicts with at least ``document_id`` and ``score``.
            session:    Active async DB session for fetching document content.

        Returns:
            Reranked list of dicts, each augmented with ``pre_rank``,
            ``post_rank``, and ``rank_delta``.
        """
        if len(candidates) <= 1:
            return candidates

        # Fetch full document objects from the database
        doc_ids = [c["document_id"] for c in candidates]
        result = await session.execute(
            select(Document).where(Document.id.in_(doc_ids))
        )
        docs_map: Dict[int, Document] = {
            doc.id: doc for doc in result.scalars().all()
        }

        # Build enriched candidate list with document content
        enriched: List[Dict] = []
        for i, c in enumerate(candidates):
            doc = docs_map.get(c["document_id"])
            if doc:
                enriched.append(
                    {
                        "document_id": c["document_id"],
                        "rrf_score": c["score"],
                        "pre_rank": i,
                        "title": doc.title or "",
                        "content": (doc.content or "")[: self.max_text_length],
                        "images": doc.images or [],
                        "source_type": doc.source_type or "",
                    }
                )

        if not enriched:
            return candidates

        # Apply sliding window reranking
        reranked = await self._sliding_window_rerank(query, enriched)

        # Compute rank deltas and attach final positions
        for i, item in enumerate(reranked):
            item["post_rank"] = i
            item["rank_delta"] = item["pre_rank"] - i  # positive = moved up

        return reranked

    # ------------------------------------------------------------------
    # Sliding-window orchestration
    # ------------------------------------------------------------------

    async def _sliding_window_rerank(
        self,
        query: str,
        candidates: List[Dict],
    ) -> List[Dict]:
        """
        Apply the sliding-window listwise reranking strategy.

        Processes windows from the bottom of the ranked list to the top so
        that higher-quality candidates bubble upward across multiple passes,
        mirroring the RankZephyr progressive strategy.
        """
        n = len(candidates)

        if n <= self.window_size:
            # Single window — no sliding required
            try:
                ranked_indices = await self._listwise_rank_window(query, candidates)
                return [candidates[i] for i in ranked_indices]
            except Exception as e:
                print(f"Reranker single-window failed: {e}")
                return candidates

        # Multiple windows: slide from bottom to top
        result = candidates.copy()
        end = n
        while end > 0:
            start = max(0, end - self.window_size)
            window = result[start:end]
            try:
                ranked_indices = await self._listwise_rank_window(query, window)
                reranked_window = [window[i] for i in ranked_indices]
                result[start:end] = reranked_window
            except Exception as e:
                print(f"Reranker window [{start}:{end}] failed: {e}")
            end -= self.stride

        return result

    # ------------------------------------------------------------------
    # Window-level listwise ranking
    # ------------------------------------------------------------------

    async def _listwise_rank_window(
        self,
        query: str,
        window: List[Dict],
    ) -> List[int]:
        """
        Rank a window of candidates via a single LLM call.

        Returns a list of 0-indexed positions into ``window`` ordered from
        most to least relevant.  Falls back to pointwise scoring on failure.
        """
        n = len(window)
        has_images = any(c.get("images") for c in window)

        try:
            if has_images:
                messages = self._build_multimodal_messages(query, window)
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=200,
                    system=(
                        "You are a multimodal search relevance expert. You will be given a "
                        "search query and a set of candidate document passages. Some passages "
                        "are text only. Some include an image such as a chart, figure, diagram, "
                        "or table screenshot alongside descriptive text. Your task is to rank "
                        "all passages by how well they answer or relate to the query. Visual "
                        "content in images is equally valid evidence as text. Do not explain. "
                        "Output only the ranking."
                    ),
                    messages=messages,
                )
            else:
                prompt = self._build_text_prompt(query, window)
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=200,
                    system=(
                        "You are a search relevance expert. Your task is to rank passages by "
                        "their relevance to a user search query. You must consider semantic "
                        "relevance, factual coverage, and information density. Do not explain "
                        "your reasoning. Output only the ranking."
                    ),
                    messages=[{"role": "user", "content": prompt}],
                )

            output = response.content[0].text.strip()
            return self._parse_ranking_output(output, n)

        except Exception as e:
            print(f"Listwise ranking error: {e}")
            return await self._pointwise_fallback(query, window)

    # ------------------------------------------------------------------
    # Prompt builders
    # ------------------------------------------------------------------

    def _build_text_prompt(self, query: str, candidates: List[Dict]) -> str:
        """Build the text-only listwise ranking prompt."""
        n = len(candidates)
        passages = ""
        for i, c in enumerate(candidates):
            text = f"{c['title']}. {c['content']}"[: self.max_text_length]
            passages += f"\n[{i + 1}] {text}\n"

        return (
            f"I will provide you with {n} passages. "
            f"Each passage is identified by a number [1] to [{n}].\n"
            "Rank all passages from most relevant to least relevant for the "
            "following search query.\n\n"
            f"Search Query: {query}\n"
            f"{passages}\n"
            "Output the ranking as a list of identifiers in descending order of relevance.\n"
            "Format: [best] > [second] > ... > [worst]\n"
            "Output only this line and nothing else."
        )

    def _build_multimodal_messages(
        self, query: str, candidates: List[Dict]
    ) -> List[Dict]:
        """
        Build the Anthropic messages array for a multimodal ranking request.

        Each candidate is rendered either as a plain-text block or as an
        image + caption block depending on whether ``images`` is populated.
        """
        n = len(candidates)
        content: List[Dict] = []

        intro = (
            f"Search Query: {query}\n\n"
            f"Rank the following {n} passages from most to least relevant. "
            f"Each is labeled [1] to [{n}].\n"
            "Text passages appear as plain text. Multimodal passages include an image "
            "followed by associated text.\n\n"
        )
        content.append({"type": "text", "text": intro})

        for i, c in enumerate(candidates):
            passage_header = f"[{i + 1}]\n"
            images = c.get("images") or []

            if images:
                img = images[0]
                base64_data = img.get("base64_data") if isinstance(img, dict) else None
                if base64_data:
                    content.append(
                        {"type": "text", "text": f"{passage_header}Type: multimodal\n"}
                    )
                    content.append(
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": base64_data,
                            },
                        }
                    )
                    caption = img.get("alt_text", "") if isinstance(img, dict) else ""
                    text_part = f"{c['title']}. {c['content']}"[:300]
                    content.append(
                        {
                            "type": "text",
                            "text": (
                                f"Caption: {caption}\nText: {text_part}\n\n"
                            ),
                        }
                    )
                else:
                    # Image record exists but no base64 data — treat as text-only
                    text_part = f"{c['title']}. {c['content']}"[: self.max_text_length]
                    content.append(
                        {
                            "type": "text",
                            "text": (
                                f"{passage_header}Type: text\nContent: {text_part}\n\n"
                            ),
                        }
                    )
            else:
                text_part = f"{c['title']}. {c['content']}"[: self.max_text_length]
                content.append(
                    {
                        "type": "text",
                        "text": (
                            f"{passage_header}Type: text\nContent: {text_part}\n\n"
                        ),
                    }
                )

        content.append(
            {
                "type": "text",
                "text": (
                    "\nOutput format: [best] > [second] > ... > [worst]\n"
                    "Output only this line and nothing else."
                ),
            }
        )

        return [{"role": "user", "content": content}]

    # ------------------------------------------------------------------
    # Output parsing
    # ------------------------------------------------------------------

    def _parse_ranking_output(self, output: str, n: int) -> List[int]:
        """
        Parse LLM output of the form ``[1] > [3] > [2]`` into a list of
        0-indexed positions within the window.

        Handles malformed output gracefully by appending any unmentioned
        indices in their original order at the end of the result.
        """
        pattern = r"\[(\d+)\]"
        matches = re.findall(pattern, output)

        if not matches:
            return list(range(n))

        seen: set = set()
        result: List[int] = []
        for m in matches:
            idx = int(m) - 1  # convert 1-indexed label to 0-indexed position
            if 0 <= idx < n and idx not in seen:
                result.append(idx)
                seen.add(idx)

        # Append any indices that were not mentioned (preserve relative order)
        for i in range(n):
            if i not in seen:
                result.append(i)

        return result

    # ------------------------------------------------------------------
    # Pointwise fallback
    # ------------------------------------------------------------------

    async def _pointwise_fallback(
        self, query: str, window: List[Dict]
    ) -> List[int]:
        """
        Score each candidate individually and return indices sorted by score.

        Used when the listwise call fails (e.g. context-window overrun with
        large image chunks).
        """
        scores: List[tuple] = []
        for i, c in enumerate(window):
            try:
                score = await self._pointwise_score(query, c)
                scores.append((i, score))
            except Exception:
                scores.append((i, 0.0))

        scores.sort(key=lambda x: x[1], reverse=True)
        return [s[0] for s in scores]

    async def _pointwise_score(self, query: str, candidate: Dict) -> float:
        """
        Score a single candidate on a 0-3 relevance scale.

        Returns:
            Float in [0, 3]; defaults to 0.0 on parse failure.
        """
        text = f"{candidate['title']}. {candidate['content']}"[:300]
        response = self.client.messages.create(
            model=self.model,
            max_tokens=10,
            system=(
                "You are a search relevance judge. Given a query and a single passage "
                "(which may include an image), output a relevance score from 0 to 3 where: "
                "0=not relevant, 1=marginally relevant, 2=relevant, "
                "3=highly relevant and directly answers the query. "
                "Output only the integer score and nothing else."
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"Query: {query}\nPassage: {text}\nScore:",
                }
            ],
        )
        try:
            return float(response.content[0].text.strip())
        except Exception:
            return 0.0


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_reranker_service: Optional[RerankerService] = None


def get_reranker_service() -> RerankerService:
    """Return the module-level RerankerService singleton (lazy initialised)."""
    global _reranker_service
    if _reranker_service is None:
        _reranker_service = RerankerService()
    return _reranker_service
