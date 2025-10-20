"use client";

import { useQuery } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ArrowUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatTimeAgo, getHoursSince } from "@/lib/date-utils";

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
  mentioned_stocks: string | string[];
  primary_stock: string | null;
  posted_at: string;
  created_at: string;
  track_comments: boolean;
}

interface HeatScore {
  post: RedditPost;
  heat: number;
  recencyScore: number;
  engagementScore: number;
}

async function fetchRecentPosts(): Promise<RedditPost[]> {
  const res = await fetch(`${API_URL}/api/admin/reddit-posts?limit=200&offset=0`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  const data = await res.json();
  return data.posts;
}

function calculateHeatScore(post: RedditPost): HeatScore {
  // When the post was actually posted on Reddit (posted_at = actual Reddit post time)
  const hoursSincePosted = getHoursSince(post.posted_at);

  // Recency score: heavily favor recently posted content
  // Posts lose 50% of recency value every 6 hours (faster decay)
  const recencyScore = Math.exp(-hoursSincePosted / 6) * 100;

  // Engagement score: combination of score and comments
  // Normalize by typical values (score weight: 60%, comments: 40%)
  const normalizedScore = Math.min(post.score / 50, 10) * 6;
  const normalizedComments = Math.min(post.num_comments / 30, 10) * 4;
  const engagementScore = (normalizedScore + normalizedComments) * 10;

  // Combined heat: 70% recency of tracking, 30% engagement
  // This heavily favors new posts that we just started tracking with high engagement
  const heat = (recencyScore * 0.7) + (engagementScore * 0.3);

  return {
    post,
    heat,
    recencyScore,
    engagementScore
  };
}

export default function HomePage() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["recent-posts"],
    queryFn: fetchRecentPosts,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate heat scores and sort
  const rankedPosts = posts
    ? posts
        .map(calculateHeatScore)
        .sort((a, b) => b.heat - a.heat)
        .slice(0, 50) // Top 50 hottest posts
    : [];

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-1.5">
            <div className="flex flex-col gap-2 py-2 md:gap-3 md:py-3">
              <div className="px-3 lg:px-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
                      For You
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Curated discussions based on recent activity
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Personalized</span>
                  </div>
                </div>

                {/* Posts Grid */}
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rankedPosts.map(({ post, heat, recencyScore, engagementScore }) => {
                      const mentionedStocks = Array.isArray(post.mentioned_stocks)
                        ? post.mentioned_stocks
                        : typeof post.mentioned_stocks === "string"
                        ? JSON.parse(post.mentioned_stocks)
                        : [];

                      return (
                        <Link
                          key={post.id}
                          href={`/admin/posts?post=${post.id}`}
                          className="block group"
                        >
                          <Card className="p-4 hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer">
                            <div className="space-y-3">
                              {/* Header Row */}
                              <div className="flex items-start gap-3">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">
                                      r/{post.subreddit}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      by u/{post.author}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      •
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatTimeAgo(post.posted_at)}
                                    </span>
                                  </div>
                                  <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                    {post.title}
                                  </h3>
                                </div>
                              </div>

                              {/* Content Preview */}
                              {post.content && (
                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                  {post.content}
                                </p>
                              )}

                              {/* Footer Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <ArrowUp className="h-3 w-3" />
                                    <span className="font-mono">{post.score.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    <span className="font-mono">{post.num_comments.toLocaleString()}</span>
                                  </div>
                                </div>

                                {/* Stock Tags */}
                                <div className="flex items-center gap-1 flex-wrap">
                                  {mentionedStocks.slice(0, 3).map((stock: string) => (
                                    <Link
                                      key={stock}
                                      href={`/research?symbol=${stock}`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Badge
                                        variant={stock === post.primary_stock ? "default" : "secondary"}
                                        className="text-xs cursor-pointer hover:bg-primary/80 transition-colors"
                                      >
                                        ${stock}
                                      </Badge>
                                    </Link>
                                  ))}
                                  {mentionedStocks.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{mentionedStocks.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
