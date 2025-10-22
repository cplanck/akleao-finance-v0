"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ArrowUp, ExternalLink, TrendingUp, TrendingDown, Minus, Eye, Clock, Sparkles, Loader2, ArrowLeft, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatTimeAgo } from "@/lib/date-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TickerBadge } from "@/components/ticker-badge";
import { toast } from "sonner";

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
  mentioned_stocks: string | string[];
  primary_stock: string | null;
  posted_at: string;
  created_at: string;
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

async function fetchPost(postId: string): Promise<RedditPost> {
  const res = await fetch(`${API_URL}/api/admin/reddit-posts/${postId}`);
  if (!res.ok) throw new Error("Failed to fetch post");
  return res.json();
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

function CommentTree({ comments, depth = 0 }: { comments: RedditComment[]; depth?: number }) {
  if (!comments || comments.length === 0) return null;

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-primary/20 pl-4 mt-3" : "space-y-3"}>
      {comments.map((comment) => {
        // High quality comment if score >= 10
        const isHighQuality = comment.score >= 10;

        return (
          <div key={comment.id} className="space-y-2">
            <div
              className={`rounded-lg p-4 transition-all duration-300 ${
                isHighQuality
                  ? "border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-500/5 shadow-lg hover:shadow-green-500/10 hover:border-green-500/40"
                  : "border border-primary/10 bg-gradient-to-br from-card/50 to-card/30 hover:border-primary/20 hover:bg-card/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="font-semibold text-foreground">u/{comment.author}</span>
                  <span className="text-muted-foreground opacity-50">•</span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(comment.created_at)}
                  </span>
                  {comment.sentiment_label && (
                    <>
                      <span className="text-muted-foreground opacity-50">•</span>
                      <Badge
                        className={`text-xs px-2 py-0.5 ${
                          comment.sentiment_label === "bullish"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                            : comment.sentiment_label === "bearish"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                            : "bg-muted"
                        }`}
                      >
                        {comment.sentiment_label}
                      </Badge>
                    </>
                  )}
                </div>
                <div className="text-sm leading-relaxed break-words overflow-hidden prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {comment.content}
                  </ReactMarkdown>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors">
                    <ArrowUp className="h-3 w-3" />
                    <span className="font-mono font-semibold">{comment.score}</span>
                  </div>
                </div>
                </div>
              </div>
            </div>
            {comment.replies && comment.replies.length > 0 && (
              <CommentTree comments={comment.replies} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"comments" | "ai-analysis">("comments");

  const { data: post, isLoading: isLoadingPost } = useQuery({
    queryKey: ["post", id],
    queryFn: () => fetchPost(id),
    enabled: !!id,
  });

  const { data: comments, isLoading: isLoadingComments } = useQuery({
    queryKey: ["comments", id],
    queryFn: () => fetchComments(id),
    enabled: !!id,
  });

  const { data: analysesData } = useQuery({
    queryKey: ["analyses", id],
    queryFn: () => fetchAnalyses(id),
    enabled: !!id,
  });

  const analyzeMutation = useMutation({
    mutationFn: async (strategy: "direct" | "preprocessed" = "direct") => {
      const url = `/api/admin/reddit-posts/${id}/analyze?strategy=${strategy}`;
      console.log('Analyze mutation - id:', id, 'url:', url);
      const response = await fetch(url, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to analyze post");
      }
      return response.json();
    },
    onSuccess: (_, strategy) => {
      toast.success("Analysis Complete", {
        description: `Post analyzed using ${strategy} strategy`,
      });
      queryClient.invalidateQueries({ queryKey: ["analyses", id] });
    },
    onError: (error: Error) => {
      toast.error("Analysis Failed", {
        description: error.message,
      });
    },
  });

  const mentionedStocks = post
    ? Array.isArray(post.mentioned_stocks)
      ? post.mentioned_stocks
      : typeof post.mentioned_stocks === "string" && post.mentioned_stocks
      ? JSON.parse(post.mentioned_stocks)
      : []
    : [];

  if (isLoadingPost) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!post) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Post not found</p>
              <Button asChild className="mt-4">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
          {/* Header with back button */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          {/* Post Header Card */}
          <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-2xl hover:shadow-primary/5 transition-all duration-500">
            {/* Ambient gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

            <CardContent className="p-6 space-y-6 relative z-10">
              {/* Title and metadata */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                  <Badge variant="outline" className="text-xs bg-primary/10 border-primary/20 hover:bg-primary/20 transition-colors">
                    r/{post.subreddit}
                  </Badge>
                  <span className="text-muted-foreground">
                    by <span className="font-medium">u/{post.author}</span>
                  </span>
                  <span className="text-muted-foreground opacity-50">•</span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(post.posted_at)}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold leading-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
                  {post.title}
                </h1>

                {mentionedStocks.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {mentionedStocks.map((stock: string) => (
                      <Link key={stock} href={`/research?symbol=${stock}`}>
                        <TickerBadge
                          symbol={stock}
                          className="cursor-pointer hover:bg-secondary/80 transition-all hover:scale-105 duration-200"
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/15 transition-colors">
                  <ArrowUp className="h-4 w-4 text-primary" />
                  <span className="font-mono font-semibold">{post.score.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 hover:bg-accent/15 transition-colors">
                  <MessageSquare className="h-4 w-4 text-accent-foreground" />
                  <span className="font-mono font-semibold">{post.num_comments.toLocaleString()}</span>
                </div>
              </div>

              {/* Content */}
              {post.content && (
                <div className="rounded-lg p-4 bg-gradient-to-br from-muted/40 to-muted/20 border border-primary/5">
                  <div className="text-sm leading-relaxed break-words overflow-hidden prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {post.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Tabs and action button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-primary/10">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "comments" | "ai-analysis")} className="w-full sm:w-auto">
                  <TabsList className="w-full sm:w-auto bg-muted/50 backdrop-blur-sm border border-primary/5">
                    <TabsTrigger
                      value="comments"
                      className="flex-1 sm:flex-none text-xs sm:text-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
                    >
                      <MessageSquare className="h-3 w-3 mr-2" />
                      Comments ({post.num_comments})
                    </TabsTrigger>
                    <TabsTrigger
                      value="ai-analysis"
                      className="flex-1 sm:flex-none text-xs sm:text-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300"
                    >
                      <Sparkles className="h-3 w-3 mr-2" />
                      AI Analysis {analysesData?.analyses && analysesData.analyses.length > 0 && `(${analysesData.analyses.length})`}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button asChild variant="outline" size="sm" className="w-full sm:w-auto border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-all">
                  <a href={post.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Reddit
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Content based on active tab */}
          {activeTab === "comments" ? (
            <div className="space-y-4">
              {isLoadingComments ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : comments && comments.length > 0 ? (
                <CommentTree comments={comments} />
              ) : (
                <Card className="backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10">
                  <CardContent className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">No comments yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {analysesData?.analyses && analysesData.analyses.length > 0 ? (
                <div className="space-y-6">
                  {analysesData.analyses.map((analysis) => (
                    <Card key={analysis.id} className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-xl hover:shadow-primary/5 transition-all duration-500">
                      {/* Ambient gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />

                      <CardHeader className="relative z-10">
                        <CardTitle className="flex items-center justify-between text-xl">
                          <span className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Analysis Summary
                          </span>
                          {analysis.stock_symbol && (
                            <TickerBadge symbol={analysis.stock_symbol} />
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 relative z-10">
                        {/* Executive Summary */}
                        <div className="rounded-lg p-4 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
                          <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm uppercase tracking-wide text-primary">
                            <Eye className="h-4 w-4" />
                            Executive Summary
                          </h3>
                          <p className="text-sm leading-relaxed">{analysis.executive_summary}</p>
                        </div>

                        {/* Sentiment Breakdown */}
                        <div>
                          <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Sentiment Breakdown</h3>
                          <div className="flex gap-2 flex-wrap">
                            <Badge className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all">
                              <TrendingUp className="h-3.5 w-3.5" />
                              Bullish {analysis.sentiment_breakdown.bullish}%
                            </Badge>
                            <Badge className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all">
                              <TrendingDown className="h-3.5 w-3.5" />
                              Bearish {analysis.sentiment_breakdown.bearish}%
                            </Badge>
                            <Badge className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 transition-all">
                              <Minus className="h-3.5 w-3.5" />
                              Neutral {analysis.sentiment_breakdown.neutral}%
                            </Badge>
                          </div>
                        </div>

                        {/* Key Arguments */}
                        {analysis.key_arguments && analysis.key_arguments.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Key Arguments</h3>
                            <div className="space-y-3">
                              {analysis.key_arguments.map((arg, idx) => (
                                <div
                                  key={idx}
                                  className={`border-l-2 pl-4 py-2 rounded-r-lg transition-all hover:bg-muted/30 ${
                                    arg.type === "bull"
                                      ? "border-green-500 bg-green-500/5"
                                      : "border-red-500 bg-red-500/5"
                                  }`}
                                >
                                  <p className="text-sm font-medium mb-1">{arg.summary}</p>
                                  <p className="text-xs text-muted-foreground italic leading-relaxed">&ldquo;{arg.quote}&rdquo;</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="text-xs text-muted-foreground pt-4 border-t border-primary/10">
                          <div className="flex gap-6 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold">Quality Score:</span>
                              <span className="font-mono text-primary">{analysis.thread_quality_score}/100</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold">Comments:</span>
                              <span className="font-mono">{analysis.comments_included}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold">Model:</span>
                              <span className="font-mono">{analysis.model_used}</span>
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10">
                  <CardContent className="text-center py-12 space-y-6">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <div>
                      <p className="text-muted-foreground mb-2">No AI analysis available yet</p>
                      <p className="text-sm text-muted-foreground">Generate an AI-powered analysis of this post and its comments</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                      <Button
                        onClick={() => analyzeMutation.mutate("direct")}
                        disabled={analyzeMutation.isPending}
                        className="gap-2 min-w-[180px]"
                        variant="default"
                      >
                        {analyzeMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Direct Analysis
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => analyzeMutation.mutate("preprocessed")}
                        disabled={analyzeMutation.isPending}
                        className="gap-2 min-w-[180px]"
                        variant="outline"
                      >
                        {analyzeMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4" />
                            Preprocessed
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground max-w-md mx-auto">
                      <p><strong>Direct:</strong> Analyzes raw comments directly</p>
                      <p><strong>Preprocessed:</strong> Uses ML-enhanced sentiment data for faster analysis</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
