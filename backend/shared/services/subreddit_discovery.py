"""Subreddit discovery service using OpenAI."""

import json
import os
from typing import List, Optional
from openai import OpenAI
import praw


class SubredditDiscoveryResult:
    """Result from subreddit discovery."""

    def __init__(
        self,
        subreddit_name: str,
        relevance_score: float,
        reason: str,
        subscriber_count: Optional[int] = None,
        is_verified: bool = False
    ):
        self.subreddit_name = subreddit_name
        self.relevance_score = relevance_score
        self.reason = reason
        self.subscriber_count = subscriber_count
        self.is_verified = is_verified

    def to_dict(self):
        return {
            "subreddit_name": self.subreddit_name,
            "relevance_score": self.relevance_score,
            "reason": self.reason,
            "subscriber_count": self.subscriber_count,
            "is_verified": self.is_verified
        }


class SubredditDiscoveryService:
    """Service for discovering relevant subreddits for stocks using AI."""

    def __init__(self, openai_api_key: str, reddit_client_id: str, reddit_client_secret: str, reddit_user_agent: str):
        self.openai_client = OpenAI(api_key=openai_api_key)
        self.reddit = praw.Reddit(
            client_id=reddit_client_id,
            client_secret=reddit_client_secret,
            user_agent=reddit_user_agent
        )

    def discover_subreddits(self, stock_symbol: str, stock_name: Optional[str] = None) -> List[SubredditDiscoveryResult]:
        """Discover relevant subreddits for a stock using AI and direct verification.

        Args:
            stock_symbol: The stock ticker symbol (e.g., "AAPL")
            stock_name: Optional company name (e.g., "Apple Inc.")

        Returns:
            List of SubredditDiscoveryResult objects
        """
        verified_results = []

        # Step 1: Check if the ticker itself is a subreddit (e.g., r/AAPL)
        ticker_candidates = [
            stock_symbol.upper(),  # e.g., AAPL
            stock_symbol.lower(),  # e.g., aapl
        ]

        for candidate in ticker_candidates:
            try:
                subreddit = self.reddit.subreddit(candidate)
                subscriber_count = subreddit.subscribers
                # If we get here, the subreddit exists
                verified_results.append(SubredditDiscoveryResult(
                    subreddit_name=candidate,
                    relevance_score=1.0,  # Highest relevance - ticker-specific
                    reason=f"Dedicated subreddit for {stock_symbol} stock discussion",
                    subscriber_count=subscriber_count,
                    is_verified=True
                ))
                break  # Found it, no need to check other variations
            except Exception:
                # Subreddit doesn't exist, continue
                pass

        # Step 2: Use AI to find additional relevant subreddits
        prompt = self._build_discovery_prompt(stock_symbol, stock_name)

        # Call OpenAI API
        response = self.openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a Reddit expert who helps users find relevant subreddit communities for stocks and companies. Focus on industry-specific, product-related, and general investing subreddits. DO NOT suggest the ticker symbol itself as a subreddit unless you're certain it exists."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        # Parse response
        result_text = response.choices[0].message.content
        result_data = json.loads(result_text)

        # Verify AI-suggested subreddits exist on Reddit
        for suggestion in result_data.get("subreddits", []):
            subreddit_name = suggestion.get("name", "").strip()
            if not subreddit_name:
                continue

            # Skip if we already found this one (from ticker check)
            if any(r.subreddit_name.lower() == subreddit_name.lower() for r in verified_results):
                continue

            # Try to verify subreddit exists and get subscriber count
            try:
                subreddit = self.reddit.subreddit(subreddit_name)
                subscriber_count = subreddit.subscribers
                is_verified = True
            except Exception as e:
                # Subreddit doesn't exist or is private/banned
                subscriber_count = None
                is_verified = False
                print(f"Could not verify r/{subreddit_name}: {e}")

            verified_results.append(SubredditDiscoveryResult(
                subreddit_name=subreddit_name,
                relevance_score=suggestion.get("relevance_score", 0.5),
                reason=suggestion.get("reason", ""),
                subscriber_count=subscriber_count,
                is_verified=is_verified
            ))

        # Sort by relevance score (descending) and verified status
        verified_results.sort(key=lambda x: (x.is_verified, x.relevance_score), reverse=True)

        return verified_results

    def _build_discovery_prompt(self, stock_symbol: str, stock_name: Optional[str] = None) -> str:
        """Build the discovery prompt for OpenAI."""
        company_info = f"{stock_symbol}"
        if stock_name:
            company_info = f"{stock_name} ({stock_symbol})"

        return f"""Find relevant Reddit communities (subreddits) for investors and enthusiasts of {company_info}.

IMPORTANT: Do NOT suggest r/{stock_symbol} - we will check that separately. Focus on other relevant communities.

Consider:
1. Company-specific subreddits (e.g., r/Tesla for TSLA, but NOT the ticker itself)
2. Industry/sector subreddits (e.g., r/electric_vehicles for EV companies)
3. Investment strategy subreddits that frequently discuss this stock (e.g., r/wallstreetbets, r/investing, r/stocks)
4. Regional subreddits if the company has strong regional presence
5. Product/technology subreddits related to the company's offerings

Provide 3-7 subreddit suggestions (excluding r/{stock_symbol}).

For each subreddit, provide:
- name: The subreddit name WITHOUT the r/ prefix (e.g., "wallstreetbets" not "r/wallstreetbets")
- relevance_score: A float between 0 and 1 indicating how relevant this subreddit is (1 = highly specific to this stock, 0.5 = general investing community that discusses this stock)
- reason: A brief explanation of why this subreddit is relevant

Return ONLY valid JSON in this exact format:
{{
    "subreddits": [
        {{
            "name": "subreddit_name",
            "relevance_score": 0.95,
            "reason": "Official community for company discussion"
        }},
        {{
            "name": "another_subreddit",
            "relevance_score": 0.7,
            "reason": "Industry-focused community that frequently discusses this stock"
        }}
    ]
}}"""
