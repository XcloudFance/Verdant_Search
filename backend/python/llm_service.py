"""
LLM Service for AI summaries and chat
Supports both OpenAI and Anthropic APIs
"""
from openai import OpenAI
import anthropic
from typing import List, Dict, Optional
import json
from config import settings

class LLMService:
    """Service for LLM interactions with configurable provider"""
    
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        
        if self.provider == "openai":
            self.client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL
            )
            self.model = settings.OPENAI_MODEL
        elif self.provider == "anthropic":
            self.client = anthropic.Anthropic(
                api_key=settings.ANTHROPIC_API_KEY,
                base_url=settings.ANTHROPIC_BASE_URL
            )
            self.model = settings.ANTHROPIC_MODEL
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")
    
    def generate_search_summary(self, query: str, search_results: List[Dict]) -> str:
        """
        Generate a summary of search results
        
        Args:
            query: The search query
            search_results: List of search results with title, url, snippet
        
        Returns:
            AI-generated summary in English
        """
        # Prepare context from search results
        context = self._prepare_results_context(search_results)
        
        # Create prompt for summary with markdown output
        prompt = f"""Analyze the search results for "{query}" and provide a brief, well-structured overview in markdown format.

Search Results:
{context}

Requirements:
- Use markdown formatting (## headers, **bold**, bullet points)
- Keep it concise (2-3 short paragraphs max)
- Focus on key insights and main themes
- Use bullet points for lists
- Make it scannable and easy to read
- All content in English

Provide a clear overview:"""

        system_message = "You are a helpful search assistant. Provide brief, well-formatted overviews in markdown. Be concise and highlight key information."
        
        try:
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=400
                )
                return response.choices[0].message.content
            
            elif self.provider == "anthropic":
                response = self.client.messages.create(
                    model=self.model,
                    system=system_message,
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=400,
                    temperature=0.7
                )
                return response.content[0].text
        
        except Exception as e:
            print(f"LLM Summary Error ({self.provider}): {str(e)}")
            return f"Unable to generate summary at this time. Please try again later."
    
    def chat_with_context(
        self,
        user_message: str,
        search_results: List[Dict],
        query: str,
        chat_history: Optional[List[Dict]] = None
    ):
        """
        Chat with AI about search results (supports Multimodal/Images).

        On the first turn (no chat_history), the full context — text snippets
        and inline images labeled by result index — is injected directly into
        the user message.  Subsequent turns send only the user text; the model
        already has the context in its conversation history.

        Returns:
            Tuple[str, Optional[str]]: (response_text, built_prompt)
            built_prompt is a human-readable representation of what was sent,
            only populated on the first turn (for the frontend prompt viewer).
        """
        is_first = not chat_history

        # Minimal system prompt — context is NOT repeated here
        system_prompt = (
            "You are a helpful AI assistant embedded in the Verdant Search engine. "
            "Answer questions based on the search context provided in the conversation. "
            "Reference specific results when answering (e.g., \"According to Result 1...\"). "
            "Use markdown formatting. Be concise but informative. Always respond in English."
        )

        messages = list(chat_history) if chat_history else []
        built_prompt: Optional[str] = None

        if is_first and search_results:
            context = self._prepare_results_context(search_results)

            # Collect labeled images (max 4 total)
            labeled_images: List[Dict] = []  # {"result_idx": int, "title": str, "base64": str}
            for i, result in enumerate(search_results, 1):
                if len(labeled_images) >= 4:
                    break
                for img in (result.get("images") or []):
                    if img.get("base64_data") and len(labeled_images) < 4:
                        labeled_images.append({
                            "result_idx": i,
                            "title": result.get("title", "Untitled"),
                            "base64": img["base64_data"],
                        })

            if labeled_images:
                print(f"🖼️  Attaching {len(labeled_images)} labeled images to first user message")

            # ── Anthropic ──────────────────────────────────────────────────
            if self.provider == "anthropic":
                first_content: List[Dict] = []
                for limg in labeled_images:
                    first_content.append({
                        "type": "text",
                        "text": f"[Image from Result {limg['result_idx']}: {limg['title']}]",
                    })
                    first_content.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": limg["base64"],
                        },
                    })
                first_content.append({
                    "type": "text",
                    "text": (
                        f'Search Query: "{query}"\n\n'
                        f"Search Results:\n{context}\n\n"
                        f"Question: {user_message}"
                    ),
                })
                messages.append({"role": "user", "content": first_content})

            # ── OpenAI ─────────────────────────────────────────────────────
            elif self.provider == "openai":
                first_content = []
                for limg in labeled_images:
                    first_content.append({
                        "type": "text",
                        "text": f"[Image from Result {limg['result_idx']}: {limg['title']}]",
                    })
                    first_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{limg['base64']}",
                            "detail": "auto",
                        },
                    })
                first_content.append({
                    "type": "text",
                    "text": (
                        f'Search Query: "{query}"\n\n'
                        f"Search Results:\n{context}\n\n"
                        f"Question: {user_message}"
                    ),
                })
                messages.append({"role": "user", "content": first_content})

            # Build human-readable prompt for the frontend debug viewer
            img_note = ""
            if labeled_images:
                labels = ", ".join(
                    f"Result {li['result_idx']} ({li['title']})" for li in labeled_images
                )
                img_note = f"\n[{len(labeled_images)} image(s) attached inline: {labels}]\n"
            built_prompt = (
                f"[SYSTEM]\n{system_prompt}\n\n"
                f"[USER — Turn 1]{img_note}\n"
                f'Search Query: "{query}"\n\n'
                f"Search Results:\n{context}\n\n"
                f"Question: {user_message}"
            )

        else:
            # Subsequent turns: plain text only — context already in history
            messages.append({"role": "user", "content": user_message})

        try:
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "system", "content": system_prompt}] + messages,
                    temperature=0.7,
                    max_tokens=1000,
                )
                return response.choices[0].message.content, built_prompt

            elif self.provider == "anthropic":
                response = self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=messages,
                    max_tokens=1000,
                    temperature=0.7,
                )
                return response.content[0].text, built_prompt

        except Exception as e:
            print(f"LLM Chat Error ({self.provider}): {str(e)}")
            import traceback
            traceback.print_exc()
            return "I apologize, but I'm having trouble processing your request right now. Please try again.", None
    
    def generate_related_questions(self, query: str, search_results: List[Dict]) -> List[str]:
        """
        Generate related questions based on search query and results
        
        Args:
            query: The search query
            search_results: Search results for context
        
        Returns:
            List of 3-6 related questions
        """
        # Prepare context (use top 5 results)
        context = self._prepare_results_context(search_results[:5], max_results=5)
        
        prompt = f"""Based on the search query and results, generate 3-6 short, relevant follow-up questions that users might want to ask.

Search Query: "{query}"

Search Results:
{context}

Requirements:
- Generate 3-6 concise questions (one line each)
- Questions should be directly relevant to the search results
- Make them natural and conversational
- Cover different aspects of the topic
- Return ONLY the questions, one per line
- No numbering, bullets, or extra formatting
- Each question should be standalone and clear

Generate the questions:"""

        try:
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that generates relevant follow-up questions. Return only the questions, one per line, no numbering or formatting."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.8,
                    max_tokens=200
                )
                text = response.choices[0].message.content
            
            elif self.provider == "anthropic":
                response = self.client.messages.create(
                    model=self.model,
                    system="You are a helpful assistant that generates relevant follow-up questions. Return only the questions, one per line, no numbering or formatting.",
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=200,
                    temperature=0.8
                )
                text = response.content[0].text
            
            # Parse questions from response
            questions = [
                q.strip().lstrip('0123456789.-*•').strip()
                for q in text.strip().split('\n')
                if q.strip() and len(q.strip()) > 10
            ]
            
            # Return 3-6 questions
            return questions[:6] if len(questions) > 6 else questions
        
        except Exception as e:
            print(f"Question generation error ({self.provider}): {str(e)}")
            return []
    
    def refine_search_query(self, original_query: str, chat_history: List[Dict[str, str]]) -> str:
        """
        Analyze chat history and generate refined search query
        
        Args:
            original_query: The original search query
            chat_history: List of chat messages [{"role": "user/assistant", "content": "..."}]
        
        Returns:
            Refined search query keywords for search engine
        """
        # Prepare chat history context
        chat_text = "\n".join([
            f"{'User' if msg.get('role') == 'user' else 'Assistant'}: {msg.get('content', '')}"
            for msg in chat_history
        ])
        
        prompt = f"""Based on the conversation below, generate an optimized search query that captures what the user REALLY wants to find.

Original Search Query: "{original_query}"

Conversation:
{chat_text}

**Your Task:**
Analyze the conversation to understand the user's TRUE search intent. Then generate 2-5 search keywords that would help find what they're actually looking for.

**Requirements:**
- Output ONLY the search keywords (no explanation)
- Use simple, clear search terms
- Focus on the core concept the user is interested in
- Consider refinements or clarifications mentioned in the conversation
- Make it suitable for a search engine query

**Output Format:**
Just output the keywords separated by spaces, nothing else.

Refined Search Query:"""

        try:
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a search query optimizer. Analyze conversations and extract the core search intent as concise keywords. Output ONLY the keywords."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.5,
                    max_tokens=50
                )
                refined_query = response.choices[0].message.content.strip()
            
            elif self.provider == "anthropic":
                response = self.client.messages.create(
                    model=self.model,
                    system="You are a search query optimizer. Analyze conversations and extract the core search intent as concise keywords. Output ONLY the keywords.",
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=50,
                    temperature=0.5
                )
                refined_query = response.content[0].text.strip()
            
            # Clean up the response (remove quotes, extra text, etc.)
            refined_query = refined_query.strip('"\'').strip()
            
            # Fallback to original if response is empty or too long
            if not refined_query or len(refined_query) > 100:
                return original_query
            
            print(f"✓ Query refined: '{original_query}' -> '{refined_query}'")
            return refined_query
        
        except Exception as e:
            print(f"Query refinement error ({self.provider}): {str(e)}")
            return original_query
    
    def _prepare_results_context(self, search_results: List[Dict], max_results: int = 10) -> str:
        """Prepare search results as context string"""
        context_parts = []
        
        for i, result in enumerate(search_results[:max_results], 1):
            title = result.get('title', 'Untitled')
            url = result.get('url', 'No URL')
            snippet = result.get('snippet', 'No content available')
            
            context_parts.append(f"""
Result {i}:
Title: {title}
URL: {url}
Content: {snippet}
---""")
        
        return "\n".join(context_parts)


# Global LLM service instance
llm_service = None

def get_llm_service() -> LLMService:
    """Get or create LLM service singleton"""
    global llm_service
    if llm_service is None:
        llm_service = LLMService()
    return llm_service
