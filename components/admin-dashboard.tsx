"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, TrendingUp, FileText, Activity, Clock, CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { OpenAISettingsCard } from "@/components/openai-settings-card";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface AdminStats {
  total_posts: number;
  total_stocks: number;
  recent_posts_24h: number;
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
    errors_count: number;
    status: string | null;
  };
  next_run: string;
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

async function triggerScrape(): Promise<{ message: string; status: string; timestamp: string }> {
  const response = await fetch(`${API_URL}/api/admin/trigger-scrape`, {
    method: "POST",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to trigger scraper");
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
    // Remove refetchInterval - WebSocket will handle updates
  });

  // Initialize elapsed time when health data loads with a running scraper
  useEffect(() => {
    if (health?.status === "running" && health?.last_run?.started_at && !runStartTime) {
      const startDate = new Date(health.last_run.started_at + (health.last_run.started_at.endsWith('Z') ? '' : 'Z'));
      setRunStartTime(startDate);
    }
  }, [health, runStartTime]);

  const triggerMutation = useMutation({
    mutationFn: triggerScrape,
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["scraper-health"] });

      // Snapshot the previous value
      const previousHealth = queryClient.getQueryData(["scraper-health"]);

      // Optimistically update to pending status
      queryClient.setQueryData(["scraper-health"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          status: "pending",
          status_message: "Manual scrape queued, waiting to start",
        };
      });

      // Return context with snapshot
      return { previousHealth };
    },
    onSuccess: (data) => {
      toast.success("Scraper Triggered", {
        description: "The Reddit scraper has been started manually.",
      });
      // Refetch health data to show updated status
      queryClient.invalidateQueries({ queryKey: ["scraper-health"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (error: Error, variables, context: any) => {
      // Rollback on error
      if (context?.previousHealth) {
        queryClient.setQueryData(["scraper-health"], context.previousHealth);
      }
      toast.error("Error", {
        description: error.message,
      });
    },
  });

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
      {/* Top Row: OpenAI Settings & Scraper Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OpenAISettingsCard />

        <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-primary/10 shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group">
          {/* Ambient gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  {health && getStatusIcon(health.status)}
                </div>
                Reddit Scraper
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending || (health?.status === "running") || (health?.status === "pending")}
                  className="gap-2 w-[100px]"
                >
                  {triggerMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      Run Now
                    </>
                  )}
                </Button>
                <div className="min-w-[80px] flex justify-center">
                  {health && getStatusBadge(health.status)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {healthLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : health ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300">
                    <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
                      {health.status === "running" ? "Elapsed Time" : "Last Run"}
                    </div>
                    <div className="text-sm font-bold">
                      {health.status === "running" && runStartTime
                        ? formatElapsedTime(elapsedTime)
                        : health.last_run?.completed_at
                        ? mounted ? formatLocalTime(health.last_run.completed_at) : "-"
                        : "Never"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300">
                    <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
                      {health.status === "running" || health.status === "pending" ? "Status" : "Next Run"}
                    </div>
                    <div className="text-sm font-bold">
                      {health.status === "running"
                        ? "Scraping..."
                        : health.status === "pending"
                        ? "Queued"
                        : mounted ? formatTimeUntil(health.next_run) : "-"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300">
                    <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">Success Rate</div>
                    <div className="text-sm font-bold">{health.stats.success_rate}%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 backdrop-blur-sm border border-primary/5 hover:border-primary/20 transition-all duration-300">
                    <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">Avg Duration</div>
                    <div className="text-sm font-bold">{health.stats.avg_duration_seconds.toFixed(1)}s</div>
                  </div>
                </div>

                {/* Recent Runs Table */}
                {health.recent_runs && health.recent_runs.length > 0 && (
                  <div className="pt-4 border-t border-primary/10">
                    <div className="text-sm font-semibold mb-3">Recent Runs</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-primary/10">
                            <th className="text-left py-2 text-xs text-muted-foreground font-semibold">Started</th>
                            <th className="text-left py-2 text-xs text-muted-foreground font-semibold">Status</th>
                            <th className="text-right py-2 text-xs text-muted-foreground font-semibold">Duration</th>
                            <th className="text-right py-2 text-xs text-muted-foreground font-semibold">Posts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {health.recent_runs.slice(0, 5).map((run, idx) => (
                            <tr key={idx} className="border-b border-primary/5 hover:bg-muted/30 transition-colors">
                              <td className="py-2 text-xs">{mounted ? formatLocalTime(run.started_at) : "-"}</td>
                              <td className="py-2">
                                {run.status === "completed" ? (
                                  <Badge className="bg-green-500 text-xs px-2 py-0">
                                    <CheckCircle2 className="h-2 w-2 mr-1" />
                                    Done
                                  </Badge>
                                ) : run.status === "running" ? (
                                  <Badge className="bg-blue-500 text-xs px-2 py-0">
                                    <Loader2 className="h-2 w-2 mr-1 animate-spin" />
                                    Running
                                  </Badge>
                                ) : run.status === "pending" ? (
                                  <Badge className="bg-yellow-500 text-xs px-2 py-0">
                                    <Clock className="h-2 w-2 mr-1" />
                                    Queued
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs px-2 py-0">
                                    <XCircle className="h-2 w-2 mr-1" />
                                    Failed
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2 text-right text-xs">{run.duration_seconds ? run.duration_seconds.toFixed(1) + 's' : '-'}</td>
                              <td className="py-2 text-right text-xs font-semibold">{run.posts_collected ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground text-center py-8">No scraper data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total_posts.toLocaleString()}</div>
            )}
            {isLoading ? (
              <Skeleton className="h-4 w-32 mt-1" />
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {`${stats?.recent_posts_24h} in last 24h`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Stocks</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total_stocks.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Tracked symbols</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subreddits</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.posts_by_subreddit.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Active sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.recent_posts_24h ? Math.round(stats.recent_posts_24h / 24) : 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Posts per hour</p>
          </CardContent>
        </Card>
      </div>

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
