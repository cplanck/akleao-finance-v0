"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, Trash2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface TrackedSubreddit {
  id: number;
  subreddit_name: string;
  subscriber_count: number | null;
  is_active: boolean;
  last_scraped_at: string | null;
  relevance_score: number | null;
  is_primary: boolean;
}

interface DiscoveryResult {
  subreddit_name: string;
  relevance_score: number;
  reason: string;
  subscriber_count: number | null;
  is_verified: boolean;
  already_tracked: boolean;
}

interface SubredditManagerProps {
  symbol: string;
  companyName?: string;
}

export function SubredditManager({ symbol, companyName }: SubredditManagerProps) {
  const [trackedSubreddits, setTrackedSubreddits] = useState<TrackedSubreddit[]>([]);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [isLoadingTracked, setIsLoadingTracked] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isTracking, setIsTracking] = useState<string | null>(null);
  const [isUntracking, setIsUntracking] = useState<string | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tracked subreddits
  const loadTrackedSubreddits = async () => {
    try {
      setIsLoadingTracked(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/reddit/tracked/${symbol}`);
      if (!response.ok) throw new Error("Failed to load tracked subreddits");
      const data = await response.json();
      setTrackedSubreddits(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingTracked(false);
    }
  };

  // Discover subreddits using AI
  const discoverSubreddits = async () => {
    try {
      setIsDiscovering(true);
      setError(null);
      // Call Next.js API route which handles auth and forwards to backend
      const response = await fetch(`/api/reddit/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_symbol: symbol,
          stock_name: companyName,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.error || "Failed to discover subreddits");
      }
      const data = await response.json();
      setDiscoveryResults(data);
      setShowDiscovery(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Track a subreddit
  const trackSubreddit = async (subredditName: string, relevanceScore?: number) => {
    try {
      setIsTracking(subredditName);
      setError(null);
      // Call Next.js API route which forwards to backend
      const response = await fetch(`/api/reddit/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_symbol: symbol,
          subreddit_name: subredditName,
          relevance_score: relevanceScore,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.error || "Failed to track subreddit");
      }

      // Refresh tracked list
      await loadTrackedSubreddits();

      // Update discovery results
      setDiscoveryResults(prev =>
        prev.map(r =>
          r.subreddit_name === subredditName ? { ...r, already_tracked: true } : r
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsTracking(null);
    }
  };

  // Untrack a subreddit
  const untrackSubreddit = async (subredditName: string) => {
    try {
      setIsUntracking(subredditName);
      setError(null);
      const response = await fetch(`${API_URL}/api/reddit/track/${symbol}/${subredditName}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to untrack subreddit");

      // Refresh tracked list
      await loadTrackedSubreddits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUntracking(null);
    }
  };

  // Trigger immediate scrape
  const triggerScrape = async () => {
    try {
      setIsScraping(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/reddit/scrape/trigger`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to trigger scrape");
      // Show success message
      alert("Scrape triggered! Posts will appear in 1-2 minutes.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tracked Subreddits</h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={loadTrackedSubreddits}
            variant="outline"
            size="sm"
            disabled={isLoadingTracked}
            className="text-xs h-7"
          >
            {isLoadingTracked ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
          <Dialog open={showDiscovery} onOpenChange={setShowDiscovery}>
            <DialogTrigger asChild>
              <Button
                onClick={discoverSubreddits}
                variant="default"
                size="sm"
                disabled={isDiscovering}
                className="text-xs h-7"
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <Search className="h-3 w-3 mr-1.5" />
                    Discover
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Discover Subreddits for {symbol}</DialogTitle>
                <DialogDescription>
                  AI-powered discovery of relevant Reddit communities
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 mt-4">
                {discoveryResults.map((result) => (
                  <div
                    key={result.subreddit_name}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            r/{result.subreddit_name}
                          </span>
                          {result.is_verified ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-yellow-500" />
                          )}
                          {result.subscriber_count && (
                            <Badge variant="outline" className="text-[10px]">
                              {(result.subscriber_count / 1000).toFixed(0)}k members
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {(result.relevance_score * 100).toFixed(0)}% relevant
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {result.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          onClick={() =>
                            window.open(`https://reddit.com/r/${result.subreddit_name}`, "_blank")
                          }
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        {result.already_tracked ? (
                          <Badge variant="default" className="text-[10px]">
                            Tracked
                          </Badge>
                        ) : (
                          <Button
                            onClick={() =>
                              trackSubreddit(result.subreddit_name, result.relevance_score)
                            }
                            variant="default"
                            size="sm"
                            disabled={isTracking === result.subreddit_name}
                            className="h-7 px-2 text-xs"
                          >
                            {isTracking === result.subreddit_name ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Track
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
          {error}
        </div>
      )}

      {/* Tracked Subreddits Table */}
      {isLoadingTracked ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : trackedSubreddits.length === 0 ? (
        <div className="text-center py-8 space-y-3 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">
            No subreddits tracked for {symbol}
          </p>
          <Button
            onClick={discoverSubreddits}
            variant="outline"
            size="sm"
            disabled={isDiscovering}
          >
            {isDiscovering ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Discovering...
              </>
            ) : (
              <>
                <Search className="h-3 w-3 mr-2" />
                Discover Subreddits
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs h-8">Subreddit</TableHead>
                  <TableHead className="text-xs h-8">Members</TableHead>
                  <TableHead className="text-xs h-8">Relevance</TableHead>
                  <TableHead className="text-xs h-8">Last Scraped</TableHead>
                  <TableHead className="text-xs h-8 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackedSubreddits.map((sub) => (
                  <TableRow key={sub.id} className="hover:bg-muted/50">
                    <TableCell className="text-xs py-2">
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://reddit.com/r/${sub.subreddit_name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          r/{sub.subreddit_name}
                        </a>
                        {sub.is_primary && (
                          <Badge variant="default" className="text-[9px] h-4">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      {sub.subscriber_count
                        ? `${(sub.subscriber_count / 1000).toFixed(0)}k`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      {sub.relevance_score
                        ? `${(sub.relevance_score * 100).toFixed(0)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      {sub.last_scraped_at
                        ? new Date(sub.last_scraped_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Button
                        onClick={() => untrackSubreddit(sub.subreddit_name)}
                        variant="ghost"
                        size="sm"
                        disabled={isUntracking === sub.subreddit_name}
                        className="h-6 px-2"
                      >
                        {isUntracking === sub.subreddit_name ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3 text-destructive" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Trigger Scrape Button */}
          <Button
            onClick={triggerScrape}
            variant="outline"
            size="sm"
            disabled={isScraping}
            className="w-full text-xs"
          >
            {isScraping ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Triggering scrape...
              </>
            ) : (
              "Scrape Now (1-2 min)"
            )}
          </Button>
        </>
      )}
    </div>
  );
}
