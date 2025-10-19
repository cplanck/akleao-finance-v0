"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, TrendingUp, ExternalLink, Loader2, Settings } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResearchGenerator } from "@/components/research-generator";
import { SubredditManager } from "@/components/subreddit-manager";

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

interface RedditAndResearchProps {
  symbol: string;
}

export function RedditAndResearch({ symbol }: RedditAndResearchProps) {
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

    fetch(`/api/stock/reddit?symbol=${symbol}&limit=5`)
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
  }, [symbol]);

  const isPostNew = (createdAt: string) => {
    const postDate = new Date(createdAt);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return postDate > twoDaysAgo;
  };

  return (
    <Tabs defaultValue="reddit" className="w-full h-full flex flex-col">
      <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-2xl hover:shadow-primary/5 transition-all duration-500 flex flex-col h-full max-h-full">
        {/* Ambient gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

        <CardHeader className="pb-2 px-3 pt-3 relative z-10 shrink-0 min-h-[56px]">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center gap-2 min-h-[28px]">
              <CardTitle className="text-sm">Community & Research</CardTitle>
              {total > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {total}
                </Badge>
              )}
            </div>
            <TabsList className="h-7">
              <TabsTrigger value="reddit" className="text-xs gap-1.5 px-2">
                <MessageSquare className="h-3 w-3" />
                Reddit
              </TabsTrigger>
              <TabsTrigger value="research" className="text-xs gap-1.5 px-2">
                <FileText className="h-3 w-3" />
                AI Research
              </TabsTrigger>
              <TabsTrigger value="manage" className="text-xs gap-1.5 px-2">
                <Settings className="h-3 w-3" />
                Manage
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3 px-3 relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Reddit Tab */}
          <TabsContent value="reddit" className="mt-0 space-y-1 flex-1 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
            {isLoading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading discussions...
              </div>
            )}

            {!isLoading && error && (
              <div className="text-center py-8 text-muted-foreground">
                {error}
              </div>
            )}

            {!isLoading && !error && posts.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No Reddit discussions found for ${symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  Track subreddits in the <strong>Manage</strong> tab to start collecting posts
                </p>
              </div>
            )}

            {!isLoading && !error && posts.length > 0 && posts.map((post) => {
              const isNew = isPostNew(post.created_at);
              return (
                <div
                  key={post.id}
                  className="border border-border rounded-md p-1.5 hover:bg-accent/50 transition-colors"
                >
                  {/* Header with subreddit and metadata */}
                  <div className="flex items-center justify-between gap-2 mb-1">
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
                  <h4 className="font-semibold text-xs mb-1 line-clamp-2 leading-tight">
                    {post.title}
                  </h4>

                  {/* Content preview */}
                  {post.content && (
                    <div className="text-xs text-muted-foreground prose prose-sm dark:prose-invert max-w-none line-clamp-2 mb-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {post.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Mentioned stocks */}
                  {post.mentioned_stocks && Array.isArray(post.mentioned_stocks) && post.mentioned_stocks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
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
                  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/50">
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
          </TabsContent>

          {/* AI Research Tab */}
          <TabsContent value="research" className="mt-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <ResearchGenerator symbol={symbol} />
          </TabsContent>

          {/* Manage Subreddits Tab */}
          <TabsContent value="manage" className="mt-0 flex-1 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
            <SubredditManager symbol={symbol} companyName={symbol} />
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}
