"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, TrendingUp, ExternalLink, Loader2, Settings, Sparkles, Brain, Zap, TrendingDown, Minus, BarChart3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResearchGenerator } from "@/components/research-generator";
import { SubredditManager } from "@/components/subreddit-manager";
import { AggregatedSentiment } from "@/components/aggregated-sentiment";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

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
  posted_at: string;
  created_at: string;
}

interface AIAnalysis {
  id: number;
  post_id: string;
  post_title: string;
  subreddit: string;
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

interface RedditAndResearchProps {
  symbol: string;
}

export function RedditAndResearch({ symbol }: RedditAndResearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(false);

  const [aggregatedData, setAggregatedData] = useState<any>(null);
  const [isLoadingAggregated, setIsLoadingAggregated] = useState(false);

  // Get active tab from URL or determine default based on data availability
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "ai-summary");

  // Sync with URL changes
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Update default tab based on data availability (only if no explicit tab in URL)
  useEffect(() => {
    if (!tabFromUrl && !isLoadingAggregated) {
      // If no aggregated data (no AI summaries), default to Reddit tab
      if (!aggregatedData) {
        setActiveTab("reddit");
      } else {
        setActiveTab("ai-summary");
      }
    }
  }, [tabFromUrl, isLoadingAggregated, aggregatedData]);

  // Update URL when tab changes
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    const currentSymbol = searchParams.get("symbol");
    if (currentSymbol) {
      params.set("symbol", currentSymbol);
    }
    // Use window.location.pathname to stay on current page
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!symbol) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch(`/api/stock/reddit?symbol=${symbol}&limit=10`)
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

    // Fetch AI analyses for this stock
    setIsLoadingAnalyses(true);
    fetch(`${API_URL}/api/admin/analyses?stock=${symbol}&limit=20`)
      .then(res => res.json())
      .then(data => {
        setAnalyses(data.analyses || []);
        if (data.analyses && data.analyses.length > 0) {
          setSelectedAnalysis(data.analyses[0]);
        }
      })
      .catch(err => {
        console.error("Error fetching AI analyses:", err);
      })
      .finally(() => {
        setIsLoadingAnalyses(false);
      });

    // Fetch aggregated analysis for this stock (if analyses exist)
    setIsLoadingAggregated(true);
    fetch(`${API_URL}/api/admin/analyses/aggregate?stock=${symbol}&limit=20`)
      .then(res => {
        if (!res.ok) {
          // 404 means no analyses yet, which is fine
          if (res.status === 404) {
            setAggregatedData(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setAggregatedData(data);
        }
      })
      .catch(err => {
        console.error("Error fetching aggregated analysis:", err);
        setAggregatedData(null);
      })
      .finally(() => {
        setIsLoadingAggregated(false);
      });
  }, [symbol]);

  const isPostNew = (postedAt: string) => {
    const postDate = new Date(postedAt);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return postDate > twoDaysAgo;
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full h-full flex flex-col">
      <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-2xl hover:shadow-primary/5 transition-all duration-500 flex flex-col h-full max-h-full">
        {/* Ambient gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

        <CardHeader className="pb-2 px-3 pt-3 relative z-10 shrink-0 min-h-[56px]">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center gap-2 min-h-[28px]">
              <CardTitle className="text-sm">Community & Research</CardTitle>
              {total > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {total} posts
                </Badge>
              )}
              {analyses.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {analyses.length} analyses
                </Badge>
              )}
            </div>
            <TabsList className="h-7">
              <TabsTrigger value="ai-summary" className="text-xs gap-1.5 px-2">
                <BarChart3 className="h-3 w-3" />
                AI Summary
              </TabsTrigger>
              <TabsTrigger value="research" className="text-xs gap-1.5 px-2">
                <FileText className="h-3 w-3" />
                Deep Research
              </TabsTrigger>
              <TabsTrigger value="reddit" className="text-xs gap-1.5 px-2">
                <MessageSquare className="h-3 w-3" />
                Reddit
              </TabsTrigger>
              <TabsTrigger value="manage" className="text-xs gap-1.5 px-2">
                <Settings className="h-3 w-3" />
                Manage
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3 px-3 relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* AI Summary Tab - Aggregated view only */}
          <TabsContent value="ai-summary" className="mt-0 flex-1 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
            <AggregatedSentiment
              data={aggregatedData}
              isLoading={isLoadingAggregated}
              symbol={symbol}
            />
          </TabsContent>

          {/* Deep Research Tab - ResearchGenerator (formerly "Sentiment") */}
          <TabsContent value="research" className="mt-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <ResearchGenerator symbol={symbol} />
          </TabsContent>

          {/* Reddit Tab */}
          <TabsContent value="reddit" className="mt-0 space-y-3 flex-1 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
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
              const isNew = isPostNew(post.posted_at);
              return (
                <div
                  key={post.id}
                  onClick={() => router.push(`/admin/posts?post=${post.id}`)}
                  className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors space-y-2 cursor-pointer"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        r/{post.subreddit}
                      </Badge>
                      {isNew && (
                        <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                          NEW
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        u/{post.author}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {post.score}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {post.num_comments}
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="font-semibold text-sm leading-snug">
                    {post.title}
                  </h4>

                  {/* Content preview */}
                  {post.content && (
                    <div className="text-xs text-muted-foreground prose prose-sm dark:prose-invert max-w-none line-clamp-3">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {post.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Mentioned stocks (excluding current symbol) */}
                  {post.mentioned_stocks && Array.isArray(post.mentioned_stocks) && post.mentioned_stocks.length > 0 && (() => {
                    const otherStocks = post.mentioned_stocks.filter(stock => stock !== symbol);
                    return otherStocks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {otherStocks.slice(0, 5).map((stock) => (
                          <Badge
                            key={stock}
                            variant="secondary"
                            className="text-xs"
                          >
                            ${stock}
                          </Badge>
                        ))}
                        {otherStocks.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{otherStocks.length - 5} more
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.posted_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </span>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View on Reddit
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
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
