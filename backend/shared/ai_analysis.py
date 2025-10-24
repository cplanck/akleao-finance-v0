"""AI-powered analysis functions for Reddit posts and comments."""

import os
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import text, select
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from jinja2 import Template
from .models.reddit_post import RedditPost, RedditComment
from .models.ai_prompt import AIPrompt

# Encryption configuration
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")


# GPT-4o-mini for comment quality scoring (~$0.0001/comment)
COMMENT_SCORING_MODEL = "gpt-4o-mini"

# GPT-4o for post analysis (~$0.05/post)
POST_ANALYSIS_MODEL = "gpt-4o"

# Cost estimates (per 1M tokens)
COSTS = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},  # Per 1M tokens
    "gpt-4o": {"input": 2.50, "output": 10.00},  # Per 1M tokens
}


def decrypt_api_key(encrypted_text: str) -> str:
    """Decrypt the user's API key using AES-256-CBC."""
    if not ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY not set in environment")

    # Parse the encrypted format: "iv:encrypted_data"
    parts = encrypted_text.split(":")
    if len(parts) != 2:
        raise ValueError("Invalid encrypted key format")

    iv = bytes.fromhex(parts[0])
    encrypted_data = bytes.fromhex(parts[1])

    # Get the encryption key (first 32 bytes of the hex string)
    key = bytes.fromhex(ENCRYPTION_KEY[:64])

    # Decrypt
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted = unpad(cipher.decrypt(encrypted_data), AES.block_size)

    return decrypted.decode("utf-8")


async def get_user_api_key(db, user_id: str) -> str:
    """Fetch and decrypt the user's OpenAI API key from the database."""
    result = await db.execute(
        text("SELECT encrypted_key FROM user_api_keys WHERE user_id = :user_id"),
        {"user_id": user_id}
    )
    row = result.fetchone()

    if not row:
        raise ValueError(f"No API key found for user {user_id}")

    encrypted_key = row[0]
    return decrypt_api_key(encrypted_key)


def get_openai_client(api_key: Optional[str] = None) -> OpenAI:
    """Get OpenAI client with API key from env or parameter."""
    return OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate cost for OpenAI API call."""
    if model not in COSTS:
        return 0.0

    input_cost = (input_tokens / 1_000_000) * COSTS[model]["input"]
    output_cost = (output_tokens / 1_000_000) * COSTS[model]["output"]
    return input_cost + output_cost


def get_active_prompt(db: Session, prompt_type: str) -> Optional[AIPrompt]:
    """Fetch the active prompt for a given type from the database.

    Args:
        db: Database session
        prompt_type: Type of prompt ("comment_scoring", "post_analysis", "cross_post_synthesis")

    Returns:
        AIPrompt instance or None if no active prompt found
    """
    result = db.execute(
        select(AIPrompt)
        .where(AIPrompt.prompt_type == prompt_type)
        .where(AIPrompt.is_active == True)
        .order_by(AIPrompt.version.desc())
        .limit(1)
    )
    return result.scalars().first()


def render_prompt_template(template_string: str, context: Dict[str, Any]) -> str:
    """Render a Jinja2 template with the given context.

    Args:
        template_string: Jinja2 template string
        context: Dictionary of variables to pass to the template

    Returns:
        Rendered string
    """
    template = Template(template_string)
    return template.render(**context)


def score_comment_quality(
    comment: RedditComment,
    post: RedditPost,
    client: Optional[OpenAI] = None
) -> Dict[str, any]:
    """
    Score a single comment for quality and extract insights using GPT-4o-mini.

    Returns:
        {
            "quality_score": 0.0-1.0,
            "insight_type": "analysis" | "data" | "experience" | "noise",
            "ai_summary": "1-2 sentence extraction",
            "tokens_used": int,
            "cost_estimate": float
        }
    """
    if client is None:
        client = get_openai_client()

    # Build the scoring prompt
    system_prompt = """You are an expert at analyzing financial discussion comments for quality and insights.

Your task is to score a Reddit comment for quality and categorize its insight type.

Respond ONLY with a JSON object in this exact format:
{
  "quality_score": 0.85,
  "insight_type": "analysis",
  "ai_summary": "User points out that the company's P/E ratio is historically low compared to competitors."
}

Scoring criteria:
- quality_score (0.0-1.0): Overall quality based on depth, specificity, and usefulness
  - 0.9-1.0: Exceptional insight with data, analysis, or unique perspective
  - 0.7-0.9: High quality with specific arguments or useful context
  - 0.5-0.7: Decent contribution, some value but less depth
  - 0.3-0.5: Basic opinion or generic statement
  - 0.0-0.3: Low value, noise, off-topic, or spam

- insight_type: Categorize the comment's primary value
  - "analysis": Analytical thinking, comparisons, evaluation
  - "data": Provides specific data, metrics, or facts
  - "experience": Personal experience or insider perspective
  - "noise": Low value, off-topic, spam, or generic opinion

- ai_summary: Extract the core insight in 1-2 sentences. Be specific about the argument or claim."""

    user_prompt = f"""Post Title: {post.title}

Post Content: {post.content or "(No content)"}

Primary Stock: ${post.primary_stock or "Unknown"}

---

Comment by u/{comment.author} (Score: {comment.score}):
{comment.content}

---

Score this comment's quality and extract its key insight."""

    # Call GPT-4o-mini
    response = client.chat.completions.create(
        model=COMMENT_SCORING_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1,  # Low temperature for consistent scoring
        response_format={"type": "json_object"}
    )

    # Parse response
    result = json.loads(response.choices[0].message.content)

    # Add metadata
    result["tokens_used"] = response.usage.total_tokens
    result["cost_estimate"] = estimate_cost(
        COMMENT_SCORING_MODEL,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
    )

    return result


def analyze_post_preprocessed(
    post: RedditPost,
    scored_comments: List[Dict],
    client: Optional[OpenAI] = None
) -> Dict[str, any]:
    """
    Strategy A: Generate post analysis using preprocessed, scored comments.

    Args:
        post: Reddit post to analyze
        scored_comments: List of dicts with {comment, quality_score, insight_type, ai_summary}
        client: OpenAI client (optional)

    Returns:
        {
            "executive_summary": str,
            "sentiment_breakdown": {"bullish": %, "bearish": %, "neutral": %},
            "key_arguments": [{type: "bull/bear", summary: "...", quote: "..."}],
            "thread_quality_score": 0-100,
            "notable_quotes": [{quote: "...", author: "...", comment_id: "..."}],
            "tokens_used": int,
            "cost_estimate": float
        }
    """
    if client is None:
        client = get_openai_client()

    # Build preprocessed comment list
    comment_list = []
    for item in scored_comments:
        comment = item["comment"]
        comment_list.append(
            f"""---
Comment ID: {comment.id}
Author: u/{comment.author}
Score: {comment.score} upvotes
Quality: {item['quality_score']:.2f} | Type: {item['insight_type']}
Summary: {item['ai_summary']}
Full Text: {comment.content[:500]}{"..." if len(comment.content) > 500 else ""}
"""
        )

    system_prompt = """You are an expert financial analyst synthesizing Reddit discussion threads.

Your task is to analyze a post and its preprocessed comments to extract actionable insights.

Respond ONLY with a JSON object in this exact format:
{
  "stock_symbol": "AAPL",
  "executive_summary": "2-3 sentence overview of the discussion's key themes and sentiment",
  "sentiment_breakdown": {
    "bullish": 45,
    "bearish": 30,
    "neutral": 25
  },
  "key_arguments": [
    {
      "type": "bull",
      "summary": "Main bullish argument in 1-2 sentences",
      "quote": "Direct quote supporting this argument"
    },
    {
      "type": "bear",
      "summary": "Main bearish argument in 1-2 sentences",
      "quote": "Direct quote supporting this argument"
    }
  ],
  "thread_quality_score": 75,
  "notable_quotes": [
    {
      "quote": "Insightful or notable quote from discussion",
      "author": "username",
      "comment_id": "abc123"
    }
  ]
}

Guidelines:
- stock_symbol: Primary stock ticker being discussed (e.g., "AAPL", "TSLA"). If multiple stocks, choose the main one. If unclear, use the post's primary_stock field.
- executive_summary: Capture the overall tone, main themes, and consensus (if any)
- sentiment_breakdown: Estimate % of discussion that's bullish, bearish, or neutral (must sum to 100)
- key_arguments: Extract 2-4 most compelling arguments (both sides if applicable)
- thread_quality_score: 0-100 rating of discussion quality (depth, evidence, civility)
- notable_quotes: 2-3 most insightful or representative quotes from the thread"""

    user_prompt = f"""Post: {post.title}
Subreddit: r/{post.subreddit}
Stock: ${post.primary_stock or "Unknown"}
Score: {post.score} upvotes | {post.num_comments} comments

Post Content:
{post.content or "(No content - link post)"}

---

Preprocessed Comments ({len(scored_comments)} total, sorted by quality):

{"".join(comment_list)}

---

Analyze this discussion and extract key insights."""

    # Call GPT-4o
    response = client.chat.completions.create(
        model=POST_ANALYSIS_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3,  # Slightly higher for more nuanced analysis
        response_format={"type": "json_object"}
    )

    # Parse response
    result = json.loads(response.choices[0].message.content)

    # Add metadata
    result["tokens_used"] = response.usage.total_tokens
    result["cost_estimate"] = estimate_cost(
        POST_ANALYSIS_MODEL,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
    )

    return result


def analyze_post_direct(
    post: RedditPost,
    comments: List[RedditComment],
    client: Optional[OpenAI] = None
) -> Dict[str, any]:
    """
    Strategy B: Generate post analysis by sending raw comments directly to GPT-4o.

    Args:
        post: Reddit post to analyze
        comments: List of RedditComment objects (sorted by score, filtered by quality if desired)
        client: OpenAI client (optional)

    Returns:
        {
            "executive_summary": str,
            "sentiment_breakdown": {"bullish": %, "bearish": %, "neutral": %},
            "key_arguments": [{type: "bull/bear", summary: "...", quote: "..."}],
            "thread_quality_score": 0-100,
            "notable_quotes": [{quote: "...", author: "...", comment_id: "..."}],
            "tokens_used": int,
            "cost_estimate": float
        }
    """
    if client is None:
        client = get_openai_client()

    # Build raw comment list
    comment_list = []
    for comment in comments:
        comment_list.append(
            f"""---
Comment by u/{comment.author} ({comment.score} upvotes):
{comment.content[:800]}{"..." if len(comment.content) > 800 else ""}
"""
        )

    system_prompt = """You are an expert financial analyst synthesizing Reddit discussion threads.

Your task is to analyze a post and its comments to extract actionable insights.

Respond ONLY with a JSON object in this exact format:
{
  "stock_symbol": "AAPL",
  "executive_summary": "2-3 sentence overview of the discussion's key themes and sentiment",
  "sentiment_breakdown": {
    "bullish": 45,
    "bearish": 30,
    "neutral": 25
  },
  "key_arguments": [
    {
      "type": "bull",
      "summary": "Main bullish argument in 1-2 sentences",
      "quote": "Direct quote supporting this argument"
    },
    {
      "type": "bear",
      "summary": "Main bearish argument in 1-2 sentences",
      "quote": "Direct quote supporting this argument"
    }
  ],
  "thread_quality_score": 75,
  "notable_quotes": [
    {
      "quote": "Insightful or notable quote from discussion",
      "author": "username",
      "comment_id": "comment_id_if_available"
    }
  ]
}

Guidelines:
- stock_symbol: Primary stock ticker being discussed (e.g., "AAPL", "TSLA"). If multiple stocks, choose the main one. If unclear, use the post's primary_stock field.
- executive_summary: Capture the overall tone, main themes, and consensus (if any)
- sentiment_breakdown: Estimate % of discussion that's bullish, bearish, or neutral (must sum to 100)
- key_arguments: Extract 2-4 most compelling arguments (both sides if applicable)
- thread_quality_score: 0-100 rating of discussion quality (depth, evidence, civility)
- notable_quotes: 2-3 most insightful or representative quotes from the thread"""

    user_prompt = f"""Post: {post.title}
Subreddit: r/{post.subreddit}
Stock: ${post.primary_stock or "Unknown"}
Score: {post.score} upvotes | {post.num_comments} comments

Post Content:
{post.content or "(No content - link post)"}

---

Top Comments ({len(comments)} shown, sorted by upvotes):

{"".join(comment_list)}

---

Analyze this discussion and extract key insights."""

    # Call GPT-4o
    response = client.chat.completions.create(
        model=POST_ANALYSIS_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3,  # Slightly higher for more nuanced analysis
        response_format={"type": "json_object"}
    )

    # Parse response
    result = json.loads(response.choices[0].message.content)

    # Add metadata
    result["tokens_used"] = response.usage.total_tokens
    result["cost_estimate"] = estimate_cost(
        POST_ANALYSIS_MODEL,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
    )

    return result


def aggregate_analyses(analyses: List[Dict[str, Any]], use_ai_synthesis: bool = False, client: Optional[OpenAI] = None) -> Dict[str, Any]:
    """
    Aggregate multiple post analyses into a single consolidated view.

    Args:
        analyses: List of analysis dictionaries from post_analyses table
        use_ai_synthesis: If True, use GPT-4o to synthesize insights (costs ~$0.01-0.03)
        client: OpenAI client (required if use_ai_synthesis=True)

    Returns:
        {
            "aggregated_sentiment": {"bullish": %, "bearish": %, "neutral": %},
            "confidence_score": 0-100,  # How much analyses agree
            "overall_take": "Single sentence recommendation",
            "key_themes": {
                "bullish": ["Theme 1", "Theme 2", "Theme 3"],
                "bearish": ["Theme 1", "Theme 2", "Theme 3"]
            },
            "coverage": {
                "total_analyses": int,
                "total_comments": int,
                "total_posts": int,
                "date_range": {"oldest": "ISO date", "newest": "ISO date"}
            },
            "tokens_used": int,  # Only if AI synthesis used
            "cost_estimate": float  # Only if AI synthesis used
        }
    """
    if not analyses:
        raise ValueError("No analyses provided")

    # Calculate weighted average sentiment
    total_weight = 0
    weighted_bullish = 0
    weighted_bearish = 0
    weighted_neutral = 0

    all_key_arguments = []
    total_comments = 0
    dates = []

    for analysis in analyses:
        # Weight by thread quality score
        weight = analysis.get("thread_quality_score", 50) / 100.0
        total_weight += weight

        sentiment = analysis.get("sentiment_breakdown", {})
        weighted_bullish += sentiment.get("bullish", 0) * weight
        weighted_bearish += sentiment.get("bearish", 0) * weight
        weighted_neutral += sentiment.get("neutral", 0) * weight

        # Collect key arguments
        key_args = analysis.get("key_arguments", [])
        all_key_arguments.extend(key_args)

        # Track coverage
        total_comments += analysis.get("comments_included", 0)
        if analysis.get("created_at"):
            dates.append(analysis["created_at"])

    # Normalize weighted averages
    if total_weight > 0:
        avg_bullish = round(weighted_bullish / total_weight)
        avg_bearish = round(weighted_bearish / total_weight)
        avg_neutral = round(weighted_neutral / total_weight)

        # Ensure they sum to 100
        total = avg_bullish + avg_bearish + avg_neutral
        if total != 100:
            diff = 100 - total
            # Add difference to largest value
            if avg_bullish >= avg_bearish and avg_bullish >= avg_neutral:
                avg_bullish += diff
            elif avg_bearish >= avg_neutral:
                avg_bearish += diff
            else:
                avg_neutral += diff
    else:
        avg_bullish = avg_bearish = avg_neutral = 33

    # Calculate confidence score (based on agreement between analyses)
    # Lower standard deviation = higher confidence
    if len(analyses) > 1:
        bullish_values = [a.get("sentiment_breakdown", {}).get("bullish", 0) for a in analyses]
        mean_bullish = sum(bullish_values) / len(bullish_values)
        variance = sum((x - mean_bullish) ** 2 for x in bullish_values) / len(bullish_values)
        std_dev = variance ** 0.5

        # Convert std dev to confidence (lower std = higher confidence)
        # std_dev of 0 = 100 confidence, std_dev of 50 = 0 confidence
        confidence_score = max(0, min(100, 100 - (std_dev * 2)))
    else:
        confidence_score = 50  # Single analysis, moderate confidence

    # Extract key themes from arguments (simple frequency-based approach)
    bullish_themes = [arg["summary"] for arg in all_key_arguments if arg.get("type") == "bull"]
    bearish_themes = [arg["summary"] for arg in all_key_arguments if arg.get("type") == "bear"]

    # Take top 3 of each (or all if less than 3)
    bullish_themes = bullish_themes[:3]
    bearish_themes = bearish_themes[:3]

    # Date range
    date_range = None
    if dates:
        parsed_dates = []
        for d in dates:
            if isinstance(d, str):
                # Remove 'Z' if present and parse
                d = d.rstrip('Z')
                try:
                    parsed_dates.append(datetime.fromisoformat(d))
                except:
                    pass
            elif isinstance(d, datetime):
                parsed_dates.append(d)

        if parsed_dates:
            date_range = {
                "oldest": min(parsed_dates).isoformat(),
                "newest": max(parsed_dates).isoformat()
            }

    # Generate simple overall take
    if avg_bullish > avg_bearish + 20:
        sentiment_label = "strongly bullish"
    elif avg_bullish > avg_bearish:
        sentiment_label = "moderately bullish"
    elif avg_bearish > avg_bullish + 20:
        sentiment_label = "strongly bearish"
    elif avg_bearish > avg_bullish:
        sentiment_label = "moderately bearish"
    else:
        sentiment_label = "mixed"

    confidence_label = "high" if confidence_score >= 70 else "moderate" if confidence_score >= 40 else "low"

    overall_take = f"Community sentiment is {sentiment_label} with {confidence_label} confidence across {len(analyses)} discussion{'s' if len(analyses) > 1 else ''}."

    result = {
        "aggregated_sentiment": {
            "bullish": avg_bullish,
            "bearish": avg_bearish,
            "neutral": avg_neutral
        },
        "confidence_score": round(confidence_score),
        "overall_take": overall_take,
        "key_themes": {
            "bullish": bullish_themes,
            "bearish": bearish_themes
        },
        "coverage": {
            "total_analyses": len(analyses),
            "total_comments": total_comments,
            "total_posts": len(analyses),
            "date_range": date_range
        }
    }

    # Optional: AI synthesis for deeper insights
    if use_ai_synthesis and client:
        # Build synthesis prompt
        analysis_summaries = []
        for i, analysis in enumerate(analyses, 1):
            summary = f"""Analysis {i} (Quality: {analysis.get('thread_quality_score', 'N/A')}/100):
- Post: {analysis.get('post_title', 'N/A')}
- Sentiment: {analysis.get('sentiment_breakdown', {})}
- Summary: {analysis.get('executive_summary', 'N/A')}
- Key Arguments: {json.dumps(analysis.get('key_arguments', [])[:2])}
"""
            analysis_summaries.append(summary)

        system_prompt = """You are an expert financial analyst synthesizing multiple Reddit discussion analyses about a stock.

Your task is to review multiple individual analyses and create a unified, actionable insight.

Respond ONLY with a JSON object in this exact format:
{
  "overall_take": "A single, clear sentence that captures the consensus view (if any) or notes key divisions",
  "conviction_rating": "high" | "medium" | "low",
  "key_themes": {
    "bullish": ["Theme 1", "Theme 2", "Theme 3"],
    "bearish": ["Theme 1", "Theme 2", "Theme 3"]
  },
  "notable_divergences": "Brief note if analyses significantly disagree, or null if generally aligned"
}

Guidelines:
- overall_take: Should be actionable and clear about the community's stance
- conviction_rating: Based on agreement between analyses and quality of arguments
- key_themes: Identify recurring themes across analyses (deduplicate similar arguments)
- notable_divergences: Only include if there are meaningful disagreements"""

        user_prompt = f"""Here are {len(analyses)} analyses to synthesize:

{"".join(analysis_summaries)}

---

Provide a unified synthesis of these analyses."""

        response = client.chat.completions.create(
            model=POST_ANALYSIS_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        ai_synthesis = json.loads(response.choices[0].message.content)

        # Merge AI synthesis into result
        result["overall_take"] = ai_synthesis.get("overall_take", result["overall_take"])
        result["conviction_rating"] = ai_synthesis.get("conviction_rating", "medium")
        result["key_themes"] = ai_synthesis.get("key_themes", result["key_themes"])
        result["notable_divergences"] = ai_synthesis.get("notable_divergences")

        # Add cost metadata
        result["tokens_used"] = response.usage.total_tokens
        result["cost_estimate"] = estimate_cost(
            POST_ANALYSIS_MODEL,
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        )

    return result
