"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ArrowUp, ExternalLink, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  mentioned_stocks: string | string[]; // Can be array or JSON string
  primary_stock: string | null;
  created_at: string;
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

export function PostDetailsDialog({ post, open, onOpenChange }: PostDetailsDialogProps) {
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (post && open) {
      setIsLoading(true);
      fetchComments(post.id)
        .then(setComments)
        .catch((error) => {
          console.error("Failed to load comments:", error);
          setComments([]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [post, open]);

  if (!post) return null;

  const stocks = Array.isArray(post.mentioned_stocks)
    ? post.mentioned_stocks
    : (post.mentioned_stocks ? JSON.parse(post.mentioned_stocks as string) : []);

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
                by u/{post.author} • {formatTimeAgo(post.created_at)}
              </span>
              <div className="flex items-center gap-1 text-sm">
                <ArrowUp className="h-3 w-3 text-green-500" />
                <span>{post.score.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <MessageSquare className="h-3 w-3" />
                <span>{post.num_comments.toLocaleString()}</span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href={post.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Reddit
                </a>
              </Button>
            </div>
            {stocks.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">Stocks:</span>
                {post.primary_stock && (
                  <Badge variant="default" className="text-xs">
                    ${post.primary_stock}
                  </Badge>
                )}
                {stocks
                  .filter((s: string) => s !== post.primary_stock)
                  .map((stock: string) => (
                    <Badge key={stock} variant="secondary" className="text-xs">
                      ${stock}
                    </Badge>
                  ))}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
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
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4" />
              <h3 className="font-semibold">
                Comments ({post.num_comments})
              </h3>
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
              <div className="space-y-4">
                {comments.map((comment) => {
                  const commentStocks = comment.mentioned_stocks
                    ? (Array.isArray(comment.mentioned_stocks)
                      ? comment.mentioned_stocks
                      : JSON.parse(comment.mentioned_stocks))
                    : [];
                  return (
                    <div
                      key={comment.id}
                      className="rounded-lg border p-4 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-medium text-sm">
                          u/{comment.author}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(comment.created_at)}
                        </span>
                        <div className="flex items-center gap-1 text-xs">
                          <ArrowUp className="h-3 w-3 text-green-500" />
                          <span>{comment.score}</span>
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
                              <Badge
                                key={stock}
                                variant="secondary"
                                className="text-xs"
                              >
                                ${stock}
                              </Badge>
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
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No comments available
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
