"""Shared database models for all services."""

from .user import User
from .stock import Stock
from .reddit_post import RedditPost, RedditComment
from .post_analysis import PostAnalysis
from .news_article import NewsArticle
from .sentiment import SentimentAnalysis
from .research import ResearchReport
from .insight import UserInsight
from .scraper_run import ScraperRun
from .scraper_job import ScraperJob
from .tracked_subreddit import TrackedSubreddit, StockSubredditMapping
from .position import Position
from .auth import (
    BetterAuthUser,
    BetterAuthSession,
    BetterAuthAccount,
    BetterAuthVerification,
    PinnedStock,
    UserApiKey,
    OpenAIUsage,
)

__all__ = [
    "User",
    "Stock",
    "RedditPost",
    "RedditComment",
    "PostAnalysis",
    "NewsArticle",
    "SentimentAnalysis",
    "ResearchReport",
    "UserInsight",
    "ScraperRun",
    "ScraperJob",
    "TrackedSubreddit",
    "StockSubredditMapping",
    "Position",
    # Better Auth tables
    "BetterAuthUser",
    "BetterAuthSession",
    "BetterAuthAccount",
    "BetterAuthVerification",
    "PinnedStock",
    "UserApiKey",
    "OpenAIUsage",
]
