"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, TrendingUp, FileText, Activity, Clock, CheckCircle2, XCircle, Loader2, MessageSquare, Eye, Sparkles } from "lucide-react";
import Link from "next/link";
import { OpenAISettingsCard } from "@/components/openai-settings-card";
import { TrackedSubredditsTable } from "@/components/tracked-subreddits-table";
import { PostsScraperStatus } from "@/components/posts-scraper-status";
import { CommentScraperStatus } from "@/components/comment-scraper-status";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface AdminStats {
  total_posts: number;
  total_comments: number;
  total_stocks: number;
  tracked_posts: number;
  tracked_subreddits_count: number;
  recent_posts_24h: number;
  recent_comments_24h: number;
  recent_comments_1h: number;
  posts_with_growth_1h: number;
  total_new_comments: number;
  posts_by_subreddit: { subreddit: string; count: number }[];
  top_stocks: { symbol: string; mentions: number }[];
}

interface ScraperHealth {
  status: string;
  status_message: string;
  last_run: {
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
    posts_collected: number;
    comments_collected: number;
    errors_count: number;
    status: string | null;
  };
  next_run: string;
  running_jobs: Array<{
    id: number;
    run_type: string;
    started_at: string;
    posts_collected: number;
    comments_collected: number;
  }>;
  current_post: {
    post_id: string;
    subreddit: string;
    title: string;
    existing_comments: number;
    new_comments: number;
    started_at: string;
  } | null;
  stats: {
    avg_duration_seconds: number;
    success_rate: number;
    total_runs: number;
  };
  recent_runs: Array<{
    started_at: string;
    status: string;
    duration_seconds: number;
    posts_collected: number;
    comments_collected: number;
  }>;
}

async function fetchAdminStats(): Promise<AdminStats> {
  const response = await fetch(`${API_URL}/api/admin/stats`);
  if (!response.ok) {
    throw new Error("Failed to fetch admin stats");
  }
  return response.json();
}

async function fetchScraperHealth(): Promise<ScraperHealth> {
  const response = await fetch(`${API_URL}/api/admin/scraper-health`);
  if (!response.ok) {
    throw new Error("Failed to fetch scraper health");
  }
  return response.json();
}


function formatTimeUntil(dateString: string): string {
  const date = new Date(dateString + (dateString.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const seconds = Math.floor((date.getTime() - now.getTime()) / 1000);

  if (seconds < 0) return "overdue";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

function formatLocalTime(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString + (dateString.endsWith('Z') ? '' : 'Z'));
  return date.toLocaleTimeString();
}

export function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [runStartTime, setRunStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);

    // Initialize Socket.IO connection
    const socketInstance = io(API_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("✅ Connected to WebSocket");
    });

    socketInstance.on("disconnect", () => {
      console.log("👋 Disconnected from WebSocket");
    });

    socketInstance.on("scraper_status", (data) => {
      console.log("📡 Received scraper status update:", data);

      // Track when run starts
      if (data.status === "running" && data.started_at) {
        const startDate = new Date(data.started_at + (data.started_at.endsWith('Z') ? '' : 'Z'));
        setRunStartTime(startDate);
      }

      // Clear timer when completed or failed
      if (data.status === "completed" || data.status === "failed") {
        setRunStartTime(null);
        setElapsedTime(0);
      }

      // Invalidate queries to refresh UI with new data
      queryClient.invalidateQueries({ queryKey: ["scraper-health"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });

      // Show toast notification
      if (data.status === "completed") {
        toast.success("Scraper Completed", {
          description: `Collected ${data.posts_collected} posts in ${data.duration_seconds.toFixed(1)}s`,
        });
      } else if (data.status === "failed") {
        toast.error("Scraper Failed", {
          description: data.message,
        });
      }
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [queryClient]);

  // Elapsed time counter
  useEffect(() => {
    if (!runStartTime) return;

    // Set initial elapsed time immediately
    const updateElapsedTime = () => {
      const elapsed = Math.floor((Date.now() - runStartTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    };

    // Update immediately
    updateElapsedTime();

    // Then update every second
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [runStartTime]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    // Remove refetchInterval - WebSocket will handle updates
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["scraper-health"],
    queryFn: fetchScraperHealth,
    refetchInterval: 2000, // Poll every 2 seconds to catch current_post updates
  });

  // Initialize elapsed time when health data loads with a running scraper
  useEffect(() => {
    if (health?.status === "running" && health?.last_run?.started_at && !runStartTime) {
      const startDate = new Date(health.last_run.started_at + (health.last_run.started_at.endsWith('Z') ? '' : 'Z'));
      setRunStartTime(startDate);
    }
  }, [health, runStartTime]);


  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <Activity className="h-4 w-4 text-green-500" />;
      case "running":
        return <Activity className="h-4 w-4 text-blue-500" />;
      case "pending":
        return <Activity className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <Activity className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500">Idle</Badge>;
      case "running":
        return <Badge className="bg-blue-500">Running</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Queued</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards - Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tracked Posts */}
        <Card className="border-primary/10 hover:border-primary/20 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Currently Tracking
                </p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold tracking-tight">
                      {stats?.tracked_posts.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      posts
                    </p>
                  </div>
                )}
                {!isLoading && (
                  <p className="text-xs text-muted-foreground">
                    of {stats?.total_posts.toLocaleString()} total
                  </p>
                )}
              </div>
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center ${
                stats?.tracked_posts
                  ? 'from-blue-500/20 to-blue-600/20 ring-1 ring-blue-500/30'
                  : 'from-muted/30 to-muted/20'
              }`}>
                <Eye className={`h-6 w-6 ${stats?.tracked_posts ? 'text-blue-500' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comment Activity */}
        <Card className="border-primary/10 hover:border-primary/20 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Last Hour
                </p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold tracking-tight">
                      {stats?.recent_comments_1h.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      comments
                    </p>
                  </div>
                )}
                {!isLoading && (
                  <p className="text-xs text-muted-foreground">
                    {stats?.total_comments.toLocaleString()} total comments
                  </p>
                )}
              </div>
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center ${
                stats?.recent_comments_1h && stats.recent_comments_1h > 0
                  ? 'from-green-500/20 to-green-600/20 ring-1 ring-green-500/30'
                  : 'from-muted/30 to-muted/20'
              }`}>
                <MessageSquare className={`h-6 w-6 ${
                  stats?.recent_comments_1h && stats.recent_comments_1h > 0
                    ? 'text-green-500'
                    : 'text-muted-foreground'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comment Growth */}
        <Card className="border-primary/10 hover:border-primary/20 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Growing
                </p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold tracking-tight">
                      {stats?.posts_with_growth_1h.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      posts
                    </p>
                  </div>
                )}
                {!isLoading && (
                  <p className="text-xs text-muted-foreground">
                    +{stats?.total_new_comments.toLocaleString()} new comments total
                  </p>
                )}
              </div>
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center ${
                stats?.posts_with_growth_1h && stats.posts_with_growth_1h > 0
                  ? 'from-green-500/20 to-green-600/20 ring-1 ring-green-500/30'
                  : 'from-muted/30 to-muted/20'
              }`}>
                <TrendingUp className={`h-6 w-6 ${
                  stats?.posts_with_growth_1h && stats.posts_with_growth_1h > 0
                    ? 'text-green-500 animate-pulse'
                    : 'text-muted-foreground'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unique Stocks */}
        <Card className="border-primary/10 hover:border-primary/20 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Stocks Tracked
                </p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold tracking-tight">
                      {stats?.total_stocks.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      symbols
                    </p>
                  </div>
                )}
                {!isLoading && (
                  <p className="text-xs text-muted-foreground">
                    from {stats?.tracked_subreddits_count} subreddits
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 ring-1 ring-orange-500/30 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: OpenAI Settings & Reddit Scraper */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OpenAISettingsCard />

        {/* Reddit Scraper */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Reddit Scraper
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {healthLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                {/* Posts Scraper Section */}
                <div>
                  <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Posts Scraper
                  </div>
                  {health ? (
                    <PostsScraperStatus
                      status={health.status as "idle" | "running" | "queued" | "error"}
                      nextRun={health.next_run}
                      lastRun={health.last_run ? {
                        completed_at: health.last_run.completed_at,
                        posts_collected: health.last_run.posts_collected,
                        comments_collected: health.last_run.comments_collected
                      } : undefined}
                    />
                  ) : (
                    <div className="text-muted-foreground text-center py-4">No data available</div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-primary/10" />

                {/* Comment Scraper Section */}
                <div>
                  <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-500" />
                    Comment Scraper
                  </div>
                  <CommentScraperStatus currentPost={health?.current_post} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tracked Subreddits Table */}
      <TrackedSubredditsTable />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Mentioned Stocks */}
        <Card>
          <CardHeader>
            <CardTitle>Top Mentioned Stocks</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stats?.top_stocks.map((stock, index) => (
                  <Link
                    key={stock.symbol}
                    href={`/admin/posts?stock=${stock.symbol}`}
                    className="flex items-center justify-between hover:bg-accent rounded-lg p-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <span className="font-mono font-semibold">
                        ${stock.symbol}
                      </span>
                    </div>
                    <Badge variant="secondary">{stock.mentions} mentions</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Posts by Subreddit */}
        <Card>
          <CardHeader>
            <CardTitle>Posts by Subreddit</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(7)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stats?.posts_by_subreddit
                  .sort((a, b) => b.count - a.count)
                  .map((sub) => (
                    <Link
                      key={sub.subreddit}
                      href={`/admin/posts?subreddit=${sub.subreddit}`}
                      className="flex items-center justify-between hover:bg-accent rounded-lg p-2 -mx-2 transition-colors"
                    >
                      <span className="text-sm">
                        r/{sub.subreddit}
                      </span>
                      <Badge variant="outline">{sub.count.toLocaleString()} posts</Badge>
                    </Link>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
