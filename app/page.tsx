"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ArrowUp, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatTimeAgo, getHoursSince } from "@/lib/date-utils";
import { TickerBadge } from "@/components/ticker-badge";

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
  // Heat score data from API (for debugging/display)
  heat: number | null;
  recency_score: number | null;
  engagement_score: number | null;
  stock_bonus: number | null;
}

async function fetchRecentPosts(): Promise<RedditPost[]> {
  // Fetch posts sorted by heat score from the API
  // Algorithm: heat = 60% recency + 40% engagement + stock bonus
  // - Recency: Posts <4 hours old get max score (100), then decay exponentially
  // - Engagement: Capped at 100 points (prevents viral posts from dominating)
  // - Stock bonus: +5 for mentions, +5 for primary stock (max +10)
  // - Quality filter: Must have ≥2 upvotes OR ≥2 comments
  const res = await fetch(`${API_URL}/api/admin/reddit-posts?limit=50&offset=0&sort_by=heat`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  const data = await res.json();
  return data.posts;
}

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["recent-posts"],
    queryFn: fetchRecentPosts,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Restore scroll position when returning from post detail page
  useEffect(() => {
    const savedScrollPos = sessionStorage.getItem("homeScrollPos");
    if (savedScrollPos && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo(0, parseInt(savedScrollPos));
        sessionStorage.removeItem("homeScrollPos");
      }, 100);
    }
  }, []);

  // Save scroll position before navigating away
  const handlePostClick = () => {
    if (containerRef.current) {
      sessionStorage.setItem("homeScrollPos", containerRef.current.scrollTop.toString());
    }
  };

  // Posts are already sorted by heat score from the API
  // No need for client-side sorting anymore!

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div ref={containerRef} className="@container/main flex flex-1 flex-col gap-1.5 overflow-y-auto pb-20 md:pb-0">
            <div className="flex flex-col gap-2 py-2 md:gap-3 md:py-3">
              <div className="px-3 lg:px-4 space-y-4">
                {/* Posts Grid */}
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts?.map((post) => {
                      const mentionedStocks = Array.isArray(post.mentioned_stocks)
                        ? post.mentioned_stocks
                        : typeof post.mentioned_stocks === "string"
                        ? JSON.parse(post.mentioned_stocks)
                        : [];

                      return (
                        <Link
                          key={post.id}
                          href={`/posts/${post.id}`}
                          className="block group"
                          onClick={handlePostClick}
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
                                      <TickerBadge
                                        symbol={stock}
                                        className="cursor-pointer hover:bg-secondary/80 transition-colors"
                                      />
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
      <MobileNav />
    </SidebarProvider>
  );
}
