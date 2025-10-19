"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RedditComment {
  id: string;
  post_id: string;
  post_title: string;
  subreddit: string;
  author: string;
  content: string;
  score: number;
  mentioned_stocks: string | string[] | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  created_at: string;
}

interface CommentDetailsDialogProps {
  comment: RedditComment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function CommentDetailsDialog({ comment, open, onOpenChange }: CommentDetailsDialogProps) {
  if (!comment) return null;

  // Handle mentioned_stocks which can be array, JSON string, or null
  let stocks: string[] = [];
  if (comment.mentioned_stocks) {
    if (Array.isArray(comment.mentioned_stocks)) {
      stocks = comment.mentioned_stocks;
    } else if (typeof comment.mentioned_stocks === 'string' && comment.mentioned_stocks.trim()) {
      try {
        stocks = JSON.parse(comment.mentioned_stocks);
      } catch (e) {
        stocks = [];
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold pr-8">
            Comment by u/{comment.author}
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">r/{comment.subreddit}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(comment.created_at)}
              </span>
              <div className="flex items-center gap-1 text-sm">
                <ArrowUp className="h-3 w-3 text-green-500" />
                <span>{comment.score.toLocaleString()}</span>
              </div>
            </div>
            {stocks.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">Stocks:</span>
                {stocks.map((stock: string) => (
                  <Badge key={stock} variant="secondary" className="text-xs font-mono">
                    ${stock}
                  </Badge>
                ))}
              </div>
            )}
            {comment.sentiment_label && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Sentiment:</span>
                <Badge
                  variant={
                    comment.sentiment_label === "positive"
                      ? "default"
                      : comment.sentiment_label === "negative"
                      ? "destructive"
                      : "outline"
                  }
                  className="text-xs"
                >
                  {comment.sentiment_label}
                  {comment.sentiment_score && (
                    <span className="ml-1 opacity-70">
                      ({(comment.sentiment_score * 100).toFixed(0)}%)
                    </span>
                  )}
                </Badge>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Comment Content */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {comment.content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Post Reference */}
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
              On Post:
            </h4>
            <div className="text-sm font-medium">{comment.post_title}</div>
            <div className="text-xs text-muted-foreground mt-1">
              r/{comment.subreddit}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
