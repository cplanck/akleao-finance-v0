"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Play, Loader2, Users, Clock, Plus, Trash2, Check, ChevronsUpDown, Settings, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface TrackedSubreddit {
  id: number;
  subreddit_name: string;
  subscriber_count: number | null;
  is_active: boolean;
  last_scraped_at: string | null;
  scrape_sort: string;
  scrape_time_filter: string | null;
  scrape_limit: number;
  scrape_lookback_days: number;
  stock_symbols: string[];
}

interface ScraperJob {
  job_id: number;
  job_type: string;
  status: string;
  subreddits: string[];
  priority: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  posts_collected: number;
  errors_count: number;
}

interface SubredditSearchResult {
  name: string;
  subscribers: number | null;
  description?: string | null;
  public_description?: string | null;
}

async function fetchTrackedSubreddits(): Promise<TrackedSubreddit[]> {
  const response = await fetch(`${API_URL}/api/reddit/all-tracked-subreddits`);
  if (!response.ok) {
    throw new Error("Failed to fetch tracked subreddits");
  }
  return response.json();
}

async function triggerSubredditScrape(subreddit: string): Promise<ScraperJob> {
  const response = await fetch(`${API_URL}/api/reddit/scrape/job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subreddits: [subreddit],
      job_type: "manual_scrape",
      priority: 2, // High priority but lower than full scrape
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to trigger scrape");
  }
  return response.json();
}

async function triggerFullScrape(): Promise<{ job_id: number; subreddit_count: number }> {
  const response = await fetch(`${API_URL}/api/reddit/scrape/trigger`, {
    method: "POST",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to trigger full scrape");
  }
  return response.json();
}

async function addSubreddit(subredditName: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/reddit/add-subreddit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subreddit_name: subredditName,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to add subreddit");
  }
  return response.json();
}

async function deleteSubreddit(subredditId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/reddit/subreddit/${subredditId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete subreddit");
  }
  return response.json();
}

async function searchSubreddits(query: string): Promise<SubredditSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }
  const response = await fetch(
    `${API_URL}/api/reddit/search-subreddits?query=${encodeURIComponent(query)}`
  );
  if (!response.ok) {
    throw new Error("Failed to search subreddits");
  }
  return response.json();
}

interface UpdateScrapeSettingsRequest {
  scrape_sort?: string;
  scrape_time_filter?: string | null;
  scrape_limit?: number;
  scrape_lookback_days?: number;
}

async function updateScrapeSettings(
  subredditId: number,
  settings: UpdateScrapeSettingsRequest
): Promise<void> {
  const response = await fetch(`${API_URL}/api/reddit/subreddit/${subredditId}/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update scrape settings");
  }
  return response.json();
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString + (dateString.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function TrackedSubredditsTable() {
  const [runningScrapes, setRunningScrapes] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSubredditName, setNewSubredditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SubredditSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: subreddits, isLoading } = useQuery({
    queryKey: ["tracked-subreddits"],
    queryFn: fetchTrackedSubreddits,
  });

  // Debounced search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchSubreddits(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error("Failed to search subreddits:", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const subredditMutation = useMutation({
    mutationFn: (subreddit: string) => triggerSubredditScrape(subreddit),
    onMutate: (subreddit) => {
      setRunningScrapes(new Set(runningScrapes).add(subreddit));
    },
    onSuccess: (data, subreddit) => {
      toast.success("Scrape Started", {
        description: `Started scraping r/${subreddit}`,
      });
      // Remove from running set after a short delay
      setTimeout(() => {
        setRunningScrapes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(subreddit);
          return newSet;
        });
      }, 2000);
    },
    onError: (error: Error, subreddit) => {
      toast.error("Failed to start scrape", {
        description: error.message,
      });
      setRunningScrapes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(subreddit);
        return newSet;
      });
    },
  });

  const fullScrapeMutation = useMutation({
    mutationFn: triggerFullScrape,
    onSuccess: (data) => {
      toast.success("Full Scrape Started", {
        description: `Queued scrape job for ${data.subreddit_count} subreddits`,
      });
      queryClient.invalidateQueries({ queryKey: ["scraper-health"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to start full scrape", {
        description: error.message,
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: addSubreddit,
    onSuccess: () => {
      toast.success("Subreddit Added", {
        description: `r/${newSubredditName} has been added to tracking`,
      });
      queryClient.invalidateQueries({ queryKey: ["tracked-subreddits"] });
      setIsAddDialogOpen(false);
      setNewSubredditName("");
      setSearchQuery("");
      setSearchResults([]);
    },
    onError: (error: Error) => {
      toast.error("Failed to add subreddit", {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubreddit,
    onSuccess: () => {
      toast.success("Subreddit Removed", {
        description: "Subreddit has been removed from tracking",
      });
      queryClient.invalidateQueries({ queryKey: ["tracked-subreddits"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to remove subreddit", {
        description: error.message,
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: ({ id, settings }: { id: number; settings: UpdateScrapeSettingsRequest }) =>
      updateScrapeSettings(id, settings),
    onSuccess: () => {
      toast.success("Settings Updated", {
        description: "Scrape settings have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["tracked-subreddits"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update settings", {
        description: error.message,
      });
    },
  });

  const handleAddSubreddit = () => {
    const cleanName = newSubredditName.trim().replace(/^r\//, "");
    if (!cleanName) {
      toast.error("Invalid subreddit name");
      return;
    }
    addMutation.mutate(cleanName);
  };

  const handleSelectSubreddit = (subredditName: string) => {
    setNewSubredditName(subredditName);
    setOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const activeSubreddits = subreddits?.filter((sub) => sub.is_active) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tracked Subreddits</CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="h-3 w-3" />
                  Add Subreddit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Subreddit to Track</DialogTitle>
                  <DialogDescription>
                    Search for a subreddit by name or enter it manually. Start typing to see suggestions.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal"
                      >
                        {newSubredditName ? (
                          <span className="font-mono">r/{newSubredditName}</span>
                        ) : (
                          <span className="text-muted-foreground">Search for a subreddit...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Type to search..."
                          value={searchQuery}
                          onValueChange={(value) => setSearchQuery(value.toLowerCase())}
                        />
                        <CommandList>
                          {isSearching ? (
                            <div className="py-6 text-center text-sm">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            </div>
                          ) : searchResults.length > 0 ? (
                            <CommandGroup>
                              {searchResults.map((result) => {
                                const isSelected = newSubredditName === result.name;
                                return (
                                  <CommandItem
                                    key={result.name}
                                    value={result.name}
                                    onSelect={() => handleSelectSubreddit(result.name)}
                                    className={cn(
                                      "group flex flex-col items-start py-3 aria-selected:bg-primary aria-selected:text-black",
                                      isSelected && "bg-primary text-black aria-selected:bg-primary/90 aria-selected:text-black"
                                    )}
                                  >
                                    <div className="flex items-start w-full gap-2">
                                      <Check
                                        className={cn(
                                          "h-4 w-4 mt-0.5 flex-shrink-0 group-aria-selected:text-black",
                                          isSelected ? "opacity-100 text-black" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-medium group-aria-selected:text-black">r/{result.name}</span>
                                          {result.subscribers && (
                                            <span className={cn(
                                              "text-xs flex items-center gap-1 group-aria-selected:text-black",
                                              isSelected ? "text-black/90" : "text-muted-foreground"
                                            )}>
                                              <Users className="h-3 w-3" />
                                              {result.subscribers.toLocaleString()}
                                            </span>
                                          )}
                                        </div>
                                        {(result.public_description || result.description) && (
                                          <p className={cn(
                                            "text-xs line-clamp-2 group-aria-selected:text-black",
                                            isSelected ? "text-black/90" : "text-muted-foreground"
                                          )}>
                                            {result.public_description || result.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          ) : searchQuery.length >= 2 ? (
                            <CommandEmpty>No subreddits found.</CommandEmpty>
                          ) : (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              Type at least 2 characters to search
                            </div>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setNewSubredditName("");
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddSubreddit}
                    disabled={addMutation.isPending || !newSubredditName.trim()}
                  >
                    {addMutation.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        Adding...
                      </>
                    ) : (
                      "Add Subreddit"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              onClick={() => fullScrapeMutation.mutate()}
              disabled={fullScrapeMutation.isPending || activeSubreddits.length === 0}
              className="gap-2"
            >
              {fullScrapeMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Run All ({activeSubreddits.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : activeSubreddits.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {activeSubreddits.map((subreddit) => {
              const isRunning = runningScrapes.has(subreddit.subreddit_name);
              return (
                <AccordionItem key={subreddit.id} value={`item-${subreddit.id}`} className="border-b">
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          r/{subreddit.subreddit_name}
                        </Badge>
                        {subreddit.subscriber_count && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {subreddit.subscriber_count.toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(subreddit.last_scraped_at)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    <div className="space-y-4">
                      {/* Scrape Settings */}
                      <div className="rounded-lg border p-4 space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Settings className="h-4 w-4" />
                          <h4 className="font-semibold text-sm">Scrape Settings</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`sort-${subreddit.id}`} className="text-xs">
                              Sort By
                            </Label>
                            <Select
                              value={subreddit.scrape_sort}
                              onValueChange={(value) =>
                                updateSettingsMutation.mutate({
                                  id: subreddit.id,
                                  settings: { scrape_sort: value },
                                })
                              }
                            >
                              <SelectTrigger id={`sort-${subreddit.id}`} className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hot">Hot</SelectItem>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="top">Top</SelectItem>
                                <SelectItem value="rising">Rising</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {(subreddit.scrape_sort === "top" || subreddit.scrape_sort === "controversial") && (
                            <div className="space-y-2">
                              <Label htmlFor={`timefilter-${subreddit.id}`} className="text-xs">
                                Time Filter
                              </Label>
                              <Select
                                value={subreddit.scrape_time_filter || "all"}
                                onValueChange={(value) =>
                                  updateSettingsMutation.mutate({
                                    id: subreddit.id,
                                    settings: { scrape_time_filter: value },
                                  })
                                }
                              >
                                <SelectTrigger id={`timefilter-${subreddit.id}`} className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hour">Past Hour</SelectItem>
                                  <SelectItem value="day">Past Day</SelectItem>
                                  <SelectItem value="week">Past Week</SelectItem>
                                  <SelectItem value="month">Past Month</SelectItem>
                                  <SelectItem value="year">Past Year</SelectItem>
                                  <SelectItem value="all">All Time</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor={`limit-${subreddit.id}`} className="text-xs">
                              Post Limit
                            </Label>
                            <Select
                              value={subreddit.scrape_limit.toString()}
                              onValueChange={(value) =>
                                updateSettingsMutation.mutate({
                                  id: subreddit.id,
                                  settings: { scrape_limit: parseInt(value) },
                                })
                              }
                            >
                              <SelectTrigger id={`limit-${subreddit.id}`} className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="25">25 posts</SelectItem>
                                <SelectItem value="50">50 posts</SelectItem>
                                <SelectItem value="100">100 posts</SelectItem>
                                <SelectItem value="250">250 posts</SelectItem>
                                <SelectItem value="500">500 posts</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`lookback-${subreddit.id}`} className="text-xs">
                              Lookback Period
                            </Label>
                            <Select
                              value={subreddit.scrape_lookback_days.toString()}
                              onValueChange={(value) =>
                                updateSettingsMutation.mutate({
                                  id: subreddit.id,
                                  settings: { scrape_lookback_days: parseInt(value) },
                                })
                              }
                            >
                              <SelectTrigger id={`lookback-${subreddit.id}`} className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 day</SelectItem>
                                <SelectItem value="3">3 days</SelectItem>
                                <SelectItem value="7">7 days</SelectItem>
                                <SelectItem value="14">14 days</SelectItem>
                                <SelectItem value="30">30 days</SelectItem>
                                <SelectItem value="90">90 days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => subredditMutation.mutate(subreddit.subreddit_name)}
                            disabled={isRunning}
                            className="gap-2"
                          >
                            {isRunning ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Running...
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3" />
                                Run Now
                              </>
                            )}
                          </Button>
                          {subreddit.stock_symbols.length > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              asChild
                              className="gap-2"
                            >
                              <Link href={`/admin/posts?stock=${subreddit.stock_symbols[0]}`}>
                                <ExternalLink className="h-3 w-3" />
                                View Posts
                              </Link>
                            </Button>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remove r/${subreddit.subreddit_name} from tracking?`)) {
                              deleteMutation.mutate(subreddit.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            No active tracked subreddits
          </div>
        )}
      </CardContent>
    </Card>
  );
}
