"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ArrowUp, ExternalLink, TrendingUp, TrendingDown, Minus, Eye, Clock, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatTimeAgo } from "@/lib/date-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const res = await fetch(`${API_URL}/api/admin/posts/${postId}/analyses`);
  if (!res.ok) throw new Error("Failed to fetch analyses");
  return res.json();
}

function CommentTree({ comments, depth = 0 }: { comments: RedditComment[]; depth?: number }) {
  if (!comments || comments.length === 0) return null;

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-border/40 pl-4 mt-3" : "space-y-4"}>
      {comments.map((comment) => {
        // High quality comment if score >= 10
        const isHighQuality = comment.score >= 10;

        return (
          <div key={comment.id} className="space-y-2">
            <div
              className={`rounded-lg p-3 transition-all ${
                isHighQuality
                  ? "border-2 border-green-500/40 bg-green-500/5 shadow-sm"
                  : "border border-transparent"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">u/{comment.author}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(comment.created_at)}</span>
                  {comment.sentiment_label && (
                    <>
                      <span>•</span>
                      <Badge
                        variant={
                          comment.sentiment_label === "bullish"
                            ? "default"
                            : comment.sentiment_label === "bearish"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {comment.sentiment_label}
                      </Badge>
                    </>
                  )}
                </div>
                <div className="text-sm leading-relaxed font-mono break-words overflow-hidden">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {comment.content}
                  </ReactMarkdown>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" />
                    <span>{comment.score}</span>
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
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* Header with back button */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
          </div>

          {/* Post Header */}
          <div className="space-y-4">
            {/* Title and metadata */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                <Badge variant="outline" className="text-xs">r/{post.subreddit}</Badge>
                <span className="text-muted-foreground">
                  by u/{post.author}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {formatTimeAgo(post.posted_at)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{post.title}</h1>
              {mentionedStocks.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {mentionedStocks.map((stock: string) => (
                    <Link key={stock} href={`/research?symbol=${stock}`}>
                      <Badge
                        variant={stock === post.primary_stock ? "default" : "secondary"}
                        className="cursor-pointer hover:bg-primary/80 transition-colors text-xs"
                      >
                        ${stock}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs and action button - stacked on mobile, inline on desktop */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "comments" | "ai-analysis")} className="w-full sm:w-auto">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="comments" className="flex-1 sm:flex-none text-xs sm:text-sm">
                    Comments ({post.num_comments})
                  </TabsTrigger>
                  <TabsTrigger value="ai-analysis" className="flex-1 sm:flex-none text-xs sm:text-sm">
                    AI Analysis {analysesData?.analyses && analysesData.analyses.length > 0 && `(${analysesData.analyses.length})`}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <a href={post.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Reddit
                </a>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4" />
                <span className="font-mono">{post.score.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="font-mono">{post.num_comments.toLocaleString()}</span>
              </div>
            </div>

            {/* Content */}
            {post.content && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="text-sm leading-relaxed font-mono break-words overflow-hidden">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {post.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Content based on active tab */}
          {activeTab === "comments" ? (
            <div>
              {isLoadingComments ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : comments && comments.length > 0 ? (
                <CommentTree comments={comments} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No comments yet
                </div>
              )}
            </div>
          ) : (
            <div>
              {analysesData?.analyses && analysesData.analyses.length > 0 ? (
                <div className="space-y-6">
                  {analysesData.analyses.map((analysis) => (
                    <Card key={analysis.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Analysis Summary</span>
                          {analysis.stock_symbol && (
                            <Badge variant="default">${analysis.stock_symbol}</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Executive Summary */}
                        <div>
                          <h3 className="font-semibold mb-2">Executive Summary</h3>
                          <p className="text-sm text-muted-foreground">{analysis.executive_summary}</p>
                        </div>

                        {/* Sentiment Breakdown */}
                        <div>
                          <h3 className="font-semibold mb-2">Sentiment</h3>
                          <div className="flex gap-2">
                            <Badge variant="default" className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Bullish: {analysis.sentiment_breakdown.bullish}%
                            </Badge>
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              Bearish: {analysis.sentiment_breakdown.bearish}%
                            </Badge>
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Minus className="h-3 w-3" />
                              Neutral: {analysis.sentiment_breakdown.neutral}%
                            </Badge>
                          </div>
                        </div>

                        {/* Key Arguments */}
                        {analysis.key_arguments && analysis.key_arguments.length > 0 && (
                          <div>
                            <h3 className="font-semibold mb-2">Key Arguments</h3>
                            <div className="space-y-2">
                              {analysis.key_arguments.map((arg, idx) => (
                                <div key={idx} className="border-l-2 pl-3 py-1" style={{
                                  borderColor: arg.type === "bull" ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"
                                }}>
                                  <p className="text-sm font-medium">{arg.summary}</p>
                                  <p className="text-xs text-muted-foreground italic">&ldquo;{arg.quote}&rdquo;</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          <div className="flex gap-4">
                            <span>Quality Score: {analysis.thread_quality_score}/100</span>
                            <span>Comments: {analysis.comments_included}</span>
                            <span>Model: {analysis.model_used}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No AI analysis available yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
