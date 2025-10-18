"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, TrendingUp, FileText, Activity, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

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
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    refetchInterval: 60000,
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["scraper-health"],
    queryFn: fetchScraperHealth,
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500">Healthy</Badge>;
      case "running":
        return <Badge className="bg-blue-500">Running</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Scraper Health Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {health && getStatusIcon(health.status)}
              Reddit Scraper Health
            </CardTitle>
            {health && getStatusBadge(health.status)}
          </div>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : health ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="text-lg font-semibold">{health.status_message}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Next Run</div>
                  <div className="text-lg font-semibold">
                    {formatTimeUntil(health.next_run)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                  <div className="text-lg font-semibold">{health.stats.success_rate}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Avg Duration</div>
                  <div className="text-lg font-semibold">
                    {health.stats.avg_duration_seconds.toFixed(1)}s
                  </div>
                </div>
              </div>

              {health.last_run.started_at && (
                <div className="pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Last Run Details</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Started:</span>{" "}
                      {formatLocalTime(health.last_run.started_at)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{" "}
                      {health.last_run.duration_seconds?.toFixed(1)}s
                    </div>
                    <div>
                      <span className="text-muted-foreground">Posts:</span>{" "}
                      {health.last_run.posts_collected}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Errors:</span>{" "}
                      {health.last_run.errors_count}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground">No scraper data available</div>
          )}
        </CardContent>
      </Card>

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
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                `${stats?.recent_posts_24h} in last 24h`
              )}
            </p>
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
