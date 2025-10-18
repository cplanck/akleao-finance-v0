"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, TrendingUp, ExternalLink, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content: string;
  author: string;
  url: string;
  score: number;
  num_comments: number;
  mentioned_stocks: string[];
  primary_stock: string;
  created_at: string;
}

interface RedditSentimentProps {
  symbol: string;
  limit?: number;
}

export function RedditSentiment({ symbol, limit = 5 }: RedditSentimentProps) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch(`/api/stock/reddit?symbol=${symbol}&limit=${limit}`)
      .then(res => res.json())
      .then(data => {
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      })
      .catch(err => {
        console.error("Error fetching Reddit data:", err);
        setError("Failed to load Reddit discussions");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [symbol, limit]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reddit Discussions
          </CardTitle>
          <CardDescription>Community sentiment from Reddit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading discussions...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reddit Discussions
          </CardTitle>
          <CardDescription>Community sentiment from Reddit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reddit Discussions
          </CardTitle>
          <CardDescription>Community sentiment from Reddit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No Reddit discussions found for ${symbol}
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPostNew = (createdAt: string) => {
    const postDate = new Date(createdAt);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return postDate > twoDaysAgo;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Reddit Discussions
          {total > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {posts.map((post) => {
          const isNew = isPostNew(post.created_at);
          return (
            <div
              key={post.id}
              className="border border-border rounded-md p-3 hover:bg-accent/50 transition-colors"
            >
              {/* Header with subreddit and metadata */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                    r/{post.subreddit}
                  </Badge>
                  {isNew && (
                    <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                      NEW
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground truncate">
                    u/{post.author}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    {post.score}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <MessageSquare className="h-3 w-3" />
                    {post.num_comments}
                  </div>
                </div>
              </div>

              {/* Title */}
              <h4 className="font-semibold text-xs mb-1.5 line-clamp-2 leading-tight">
                {post.title}
              </h4>

              {/* Content preview */}
              {post.content && (
                <div className="text-xs text-muted-foreground prose prose-sm dark:prose-invert max-w-none line-clamp-2 mb-1.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {post.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Mentioned stocks */}
              {post.mentioned_stocks && Array.isArray(post.mentioned_stocks) && post.mentioned_stocks.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {post.mentioned_stocks.slice(0, 5).map((stock) => (
                    <Badge
                      key={stock}
                      variant={stock === symbol ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      ${stock}
                    </Badge>
                  ))}
                  {post.mentioned_stocks.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{post.mentioned_stocks.length - 5} more
                    </span>
                  )}
                </div>
              )}

              {/* Footer with link */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  View
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
