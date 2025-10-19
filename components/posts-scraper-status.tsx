"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, PlayCircle, AlertCircle, CheckCircle2 } from "lucide-react";

interface PostsScraperStatusProps {
  status: "idle" | "healthy" | "running" | "queued" | "error";
  nextRun?: string;
  lastRun?: {
    completed_at: string | null;
    posts_collected: number;
    comments_collected: number;
  };
  onTrigger?: () => void;
  isTriggeringManually?: boolean;
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
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Never";

  const utcDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  const date = new Date(utcDateString);

  if (isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < -5) return "Just now";
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function PostsScraperStatus({
  status,
  nextRun,
  lastRun,
  onTrigger,
  isTriggeringManually = false
}: PostsScraperStatusProps) {
  return (
    <div className="space-y-3">
      {/* Running State */}
      {status === "running" && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-blue-500 animate-ping" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Scraping Reddit posts...</div>
              <div className="text-xs text-muted-foreground mt-1">
                Scanning tracked subreddits for new posts
              </div>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Queued State */}
      {status === "queued" && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Queued for execution</div>
              <div className="text-xs text-muted-foreground mt-1">
                Waiting to start scraping...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Scraper encountered an error</div>
              <div className="text-xs text-muted-foreground mt-1">
                Check logs for details
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Idle/Healthy State - Default Card with Details */}
      {(status === "idle" || status === "healthy") && (
        <div className="p-4 rounded-lg bg-muted/30 border border-primary/5">
          <div className="space-y-3">
            {/* Next Run - Prominent Display */}
            {nextRun && (
              <div className="flex items-center justify-between pb-3 border-b border-primary/5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Next run in</div>
                    <div className="text-lg font-bold tabular-nums">
                      {formatTimeUntil(nextRun)}
                    </div>
                  </div>
                </div>
                {onTrigger && (
                  <Button
                    onClick={onTrigger}
                    disabled={isTriggeringManually}
                    size="sm"
                    variant="outline"
                    className="h-8"
                  >
                    {isTriggeringManually ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        Run now
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Last Run Info */}
            {lastRun && lastRun.completed_at && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Last run {formatTimeAgo(lastRun.completed_at)}
                  </span>
                </div>

                {/* Last Run Stats */}
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Posts:</span>
                    <span className="font-semibold">{lastRun.posts_collected.toLocaleString()}</span>
                  </div>
                  <div className="w-px h-3 bg-border" />
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Comments:</span>
                    <span className="font-semibold">{lastRun.comments_collected.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
