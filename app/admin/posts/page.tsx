"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PostsDataTable } from "@/components/posts-data-table";
import { PostDetailsDialog } from "@/components/post-details-dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  mentioned_stocks: string | string[]; // Can be array or JSON string
  primary_stock: string | null;
  posted_at: string;  // When posted on Reddit
  created_at: string;  // When we first indexed it
  track_comments: boolean;
  track_until: string | null;
  last_comment_scrape_at: string | null;
  comment_scrape_count: number;
}

interface PostsResponse {
  posts: RedditPost[];
  total: number;
}

interface TrackedSubreddit {
  id: number;
  subreddit_name: string;
  subscriber_count: number | null;
  is_active: boolean;
}

async function fetchTrackedSubreddits(): Promise<TrackedSubreddit[]> {
  const res = await fetch(`${API_URL}/api/reddit/all-tracked-subreddits`);
  if (!res.ok) throw new Error("Failed to fetch tracked subreddits");
  return res.json();
}

async function fetchPosts(
  subreddit: string,
  stock: string,
  trackedOnly: boolean,
  offset: number,
  limit: number
): Promise<PostsResponse> {
  const params = new URLSearchParams();
  if (subreddit) params.append("subreddit", subreddit);
  if (stock) params.append("stock", stock);
  if (trackedOnly) params.append("tracked_only", "true");
  params.append("offset", offset.toString());
  params.append("limit", limit.toString());

  const res = await fetch(`${API_URL}/api/admin/reddit-posts?${params}`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

function PostsPageContent() {
  const searchParams = useSearchParams();
  const initialSubreddit = searchParams.get("subreddit") || "";
  const initialStock = searchParams.get("stock") || "";

  const [subredditFilter, setSubredditFilter] = useState(initialSubreddit);
  const [stockFilter, setStockFilter] = useState(initialStock);
  const [showTrackedOnly, setShowTrackedOnly] = useState(false);
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subredditOpen, setSubredditOpen] = useState(false);

  const { data: subredditsData } = useQuery({
    queryKey: ["tracked-subreddits"],
    queryFn: fetchTrackedSubreddits,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reddit-posts", subredditFilter, stockFilter, showTrackedOnly],
    queryFn: () => fetchPosts(subredditFilter, stockFilter, showTrackedOnly, 0, 10000), // Fetch all posts (max 10k)
  });

  const activeSubreddits = subredditsData?.filter(sub => sub.is_active) || [];

  const handleRowClick = (post: RedditPost) => {
    setSelectedPost(post);
    setDialogOpen(true);
  };

  // Check for post query parameter and open modal if present
  useEffect(() => {
    const postId = searchParams.get("post");
    if (postId && data?.posts) {
      const post = data.posts.find(p => p.id === postId);
      if (post) {
        setSelectedPost(post);
        setDialogOpen(true);
      } else {
        // Post not in current filtered results, fetch it directly
        fetch(`${API_URL}/api/admin/reddit-posts/${postId}`)
          .then(res => res.json())
          .then(post => {
            setSelectedPost(post);
            setDialogOpen(true);
          })
          .catch(err => console.error("Failed to fetch post:", err));
      }
    }
  }, [searchParams, data]);

  // Server-side filtering is now handling tracked posts
  const filteredPosts = data?.posts || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reddit Posts</h1>
        <div className="text-sm text-muted-foreground">
          {data && (
            showTrackedOnly
              ? `${filteredPosts.length.toLocaleString()} tracked posts`
              : `${data.total.toLocaleString()} total posts`
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="w-[250px]">
              <label className="text-sm font-medium mb-2 block">Subreddit</label>
              <Popover open={subredditOpen} onOpenChange={setSubredditOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={subredditOpen}
                    className="w-full justify-between"
                  >
                    {subredditFilter
                      ? `r/${subredditFilter}`
                      : "Select subreddit..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                      <CommandEmpty>No subreddit found.</CommandEmpty>
                      <CommandGroup>
                        {activeSubreddits.map((subreddit) => (
                          <CommandItem
                            key={subreddit.id}
                            value={subreddit.subreddit_name}
                            onSelect={(currentValue) => {
                              setSubredditFilter(currentValue === subredditFilter ? "" : currentValue);
                              setSubredditOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                subredditFilter === subreddit.subreddit_name
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            r/{subreddit.subreddit_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="w-[250px]">
              <label className="text-sm font-medium mb-2 block">Stock Symbol</label>
              <Input
                placeholder="e.g., AAPL"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value.toUpperCase())}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tracked-only"
                checked={showTrackedOnly}
                onCheckedChange={(checked) => setShowTrackedOnly(checked as boolean)}
              />
              <Label
                htmlFor="tracked-only"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Tracked only
              </Label>
            </div>
          </div>
          {(subredditFilter || stockFilter || showTrackedOnly) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSubredditFilter("");
                setStockFilter("");
                setShowTrackedOnly(false);
              }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPosts.length > 0 ? (
            <PostsDataTable data={filteredPosts} onRowClick={handleRowClick} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {showTrackedOnly
                ? "No tracked posts found"
                : "No posts found"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Details Dialog */}
      <PostDetailsDialog
        post={selectedPost}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export default function PostsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Suspense
            fallback={
              <div className="space-y-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            }
          >
            <PostsPageContent />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
