"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ArrowUp, ExternalLink, TrendingUp, Eye, Clock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AIOverview } from "./ai-overview";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content: string | null;
  author: string;
  url: string;
  score: number;
  num_comments: number;
  initial_num_comments: number;
  mentioned_stocks: string | string[]; // Can be array or JSON string
  primary_stock: string | null;
  posted_at: string;  // When posted on Reddit
  created_at: string;  // When we first indexed it
  track_comments: boolean;
  track_until: string | null;
  last_comment_scrape_at: string | null;
  comment_scrape_count: number;
}

interface RedditComment {
  id: string;
  post_id: string;
  author: string;
  content: string;
  score: number;
  mentioned_stocks: string | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  created_at: string;
  parent_id: string | null;
  depth: number;
  replies: RedditComment[];
}

interface PostAnalysis {
  id: number;
  stock_symbol: string | null;
  strategy_used: "preprocessed" | "direct";
  comments_included: number;
  comments_preprocessed: number | null;
  executive_summary: string;
  sentiment_breakdown: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  key_arguments: Array<{
    type: "bull" | "bear";
    summary: string;
    quote: string;
  }>;
  thread_quality_score: number;
  notable_quotes: Array<{
    quote: string;
    author: string;
    comment_id: string;
  }>;
  model_used: string;
  tokens_used: number;
  processing_time_seconds: number;
  cost_estimate: number;
  created_at: string;
}

interface PostDetailsDialogProps {
  post: RedditPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchComments(postId: string): Promise<RedditComment[]> {
  const res = await fetch(`${API_URL}/api/admin/reddit-posts/${postId}/comments`);
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}

async function fetchAnalyses(postId: string): Promise<{ analyses: PostAnalysis[] }> {
  const res = await fetch(`${API_URL}/api/admin/reddit-posts/${postId}/analyses`);
  if (!res.ok) throw new Error("Failed to fetch analyses");
  return res.json();
}

async function generateAnalysis(
  postId: string,
  strategy: "preprocessed" | "direct"
): Promise<PostAnalysis> {
  // Call Next.js API route (handles auth and passes user_id)
  const res = await fetch(`/api/admin/reddit-posts/${postId}/analyze?strategy=${strategy}`, {
    method: "POST",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to generate analysis" }));
    throw new Error(error.error || error.detail || "Failed to generate analysis");
  }
  return res.json();
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Never";

  // Backend returns UTC timestamps without 'Z' suffix, so add it
  const utcDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  const date = new Date(utcDateString);

  // Check if date is valid
  if (isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Handle future dates (small tolerance for clock skew)
  if (seconds < -5) {
    return "Just now";
  }

  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function getSentimentColor(label: string | null): string {
  switch (label) {
    case "bullish":
    case "positive":
      return "text-green-600 bg-green-50 border-green-200";
    case "bearish":
    case "negative":
      return "text-red-600 bg-red-50 border-red-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

// Recursive comment component
function CommentThread({
  comment,
  index,
  totalTopLevel,
}: {
  comment: RedditComment;
  index?: number;
  totalTopLevel?: number;
}) {
  const commentStocks = comment.mentioned_stocks
    ? (Array.isArray(comment.mentioned_stocks)
      ? comment.mentioned_stocks
      : JSON.parse(comment.mentioned_stocks))
    : [];

  // Highlight top 3 top-level comments
  const isTopComment = index !== undefined && index < 3;
  const isHighScore = comment.score >= 10;
  const isNested = comment.depth > 0;

  return (
    <div className={isNested ? "" : ""}>
      <div
        className={`rounded-lg border p-4 transition-colors ${
          isTopComment
            ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
            : isNested
            ? 'bg-muted/20 border-muted hover:bg-muted/40'
            : 'bg-card hover:bg-muted/30'
        }`}
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {isTopComment && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              #{index + 1}
            </Badge>
          )}
          <span className="font-medium text-sm">
            u/{comment.author}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(comment.created_at)}
          </span>
          <div className={`flex items-center gap-1 text-xs ${isHighScore ? 'font-semibold' : ''}`}>
            <ArrowUp className={`h-3 w-3 ${isHighScore ? 'text-green-600' : 'text-green-500'}`} />
            <span>{comment.score.toLocaleString()}</span>
          </div>
          {comment.sentiment_label && (
            <Badge
              variant="outline"
              className={`text-xs ${getSentimentColor(comment.sentiment_label)}`}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {comment.sentiment_label}
            </Badge>
          )}
          {commentStocks.length > 0 && (
            <>
              {commentStocks.map((stock: string) => (
                <Link key={stock} href={`/research?symbol=${stock}`}>
                  <Badge
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                  >
                    ${stock}
                  </Badge>
                </Link>
              ))}
            </>
          )}
        </div>
        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {comment.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Render nested replies with indentation */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-6 mt-3 space-y-3 border-l-2 border-muted pl-4">
          {comment.replies.map((reply) => (
            <CommentThread key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PostDetailsDialog({ post, open, onOpenChange }: PostDetailsDialogProps) {
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analyses, setAnalyses] = useState<PostAnalysis[]>([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(false);
  const [isGenerating, setIsGenerating] = useState<"preprocessed" | "direct" | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<PostAnalysis | null>(null);

  useEffect(() => {
    if (post && open) {
      // Reset state when post changes
      setComments([]);
      setAnalyses([]);
      setSelectedAnalysis(null);
      setIsGenerating(null);

      setIsLoading(true);
      fetchComments(post.id)
        .then(setComments)
        .catch((error) => {
          console.error("Failed to load comments:", error);
          setComments([]);
        })
        .finally(() => setIsLoading(false));

      // Also fetch existing analyses
      setIsLoadingAnalyses(true);
      fetchAnalyses(post.id)
        .then((data) => {
          setAnalyses(data.analyses);
          if (data.analyses.length > 0) {
            setSelectedAnalysis(data.analyses[0]); // Select most recent
          }
        })
        .catch((error) => {
          console.error("Failed to load analyses:", error);
          setAnalyses([]);
        })
        .finally(() => setIsLoadingAnalyses(false));
    }
  }, [post?.id, open]);

  const handleGenerateAnalysis = async (strategy: "preprocessed" | "direct") => {
    if (!post) return;

    setIsGenerating(strategy);
    try {
      const newAnalysis = await generateAnalysis(post.id, strategy);
      setAnalyses((prev) => [newAnalysis, ...prev]);
      setSelectedAnalysis(newAnalysis);
    } catch (error) {
      console.error(`Failed to generate ${strategy} analysis:`, error);
      alert(`Failed to generate analysis: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsGenerating(null);
    }
  };

  if (!post) return null;

  const stocks = Array.isArray(post.mentioned_stocks)
    ? post.mentioned_stocks
    : (post.mentioned_stocks ? JSON.parse(post.mentioned_stocks as string) : []);

  const isTracking = post.track_comments && post.track_until && new Date(post.track_until) > new Date();
  const commentGrowth = post.num_comments - post.initial_num_comments;
  const hasNewComments = commentGrowth > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold pr-8">
            {post.title}
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">r/{post.subreddit}</Badge>
              <span className="text-xs text-muted-foreground">
                by u/{post.author} • {formatTimeAgo(post.posted_at)}
              </span>
              <div className="flex items-center gap-1 text-sm">
                <ArrowUp className="h-3 w-3 text-green-500" />
                <span>{post.score.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-sm">
                  <MessageSquare className="h-3 w-3" />
                  <span>{post.num_comments.toLocaleString()} on Reddit</span>
                </div>
                {comments.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    ({comments.length} crawled)
                  </div>
                )}
              </div>
              {isTracking && (
                <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                  <Eye className="h-3 w-3" />
                  Tracking Comments
                </Badge>
              )}
              {hasNewComments && (
                <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                  <TrendingUp className="h-3 w-3" />
                  +{commentGrowth} new comment{commentGrowth > 1 ? 's' : ''}
                </Badge>
              )}
              <Button variant="ghost" size="sm" asChild>
                <a href={post.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Reddit
                </a>
              </Button>
            </div>
            {isTracking && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {post.last_comment_scrape_at ? (
                  <>
                    <span>Last crawled {formatTimeAgo(post.last_comment_scrape_at)}</span>
                    {post.comment_scrape_count > 0 && (
                      <span className="ml-1">({post.comment_scrape_count} time{post.comment_scrape_count > 1 ? 's' : ''})</span>
                    )}
                  </>
                ) : (
                  <span>Awaiting first crawl • Tracking until {new Date(post.track_until!).toLocaleDateString()}</span>
                )}
              </div>
            )}
            {stocks.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">Stocks:</span>
                {post.primary_stock && (
                  <Link href={`/research?symbol=${post.primary_stock}`}>
                    <Badge variant="default" className="text-xs cursor-pointer hover:bg-primary/80 transition-colors">
                      ${post.primary_stock}
                    </Badge>
                  </Link>
                )}
                {stocks
                  .filter((s: string) => s !== post.primary_stock)
                  .map((stock: string) => (
                    <Link key={stock} href={`/research?symbol=${stock}`}>
                      <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors">
                        ${stock}
                      </Badge>
                    </Link>
                  ))}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="comments" className="mt-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="comments" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments
              {comments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                  {comments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ai-overview" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Overview
              {analyses.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                  {analyses.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="space-y-6 mt-4">
            {/* Post Content */}
            {post.content && (
              <div className="rounded-lg border p-4 bg-muted/30">
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Post Content
                </h4>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {post.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <h3 className="font-semibold">
                    Comments
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {comments.length > 0 && (
                    <>
                      <span>{comments.length} crawled</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{post.num_comments} on Reddit</span>
                  <span>•</span>
                  <span>Sorted by score</span>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ))}
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment, index) => (
                    <CommentThread
                      key={comment.id}
                      comment={comment}
                      index={index}
                      totalTopLevel={comments.length}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No comments available
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai-overview" className="mt-4">
            <AIOverview
              isLoadingAnalyses={isLoadingAnalyses}
              analyses={analyses}
              selectedAnalysis={selectedAnalysis}
              isGenerating={isGenerating}
              onGenerateAnalysis={handleGenerateAnalysis}
              onSelectAnalysis={setSelectedAnalysis}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
