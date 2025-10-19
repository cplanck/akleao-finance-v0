"use client";

import React, { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, ArrowLeft, ArrowUp, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  mentioned_stocks: string;
  primary_stock: string | null;
  created_at: string;
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
}

interface PostsResponse {
  posts: RedditPost[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchPosts(
  subreddit?: string,
  stock?: string,
  offset = 0,
  limit = 50
): Promise<PostsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (subreddit) params.append("subreddit", subreddit);
  if (stock) params.append("stock", stock);

  const response = await fetch(`${API_URL}/api/admin/reddit-posts?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch posts");
  }
  return response.json();
}

async function fetchComments(postId: string): Promise<RedditComment[]> {
  const response = await fetch(`${API_URL}/api/admin/reddit-posts/${postId}/comments`);
  if (!response.ok) {
    console.error(`Failed to fetch comments for post ${postId}:`, response.status, response.statusText);
    throw new Error(`Failed to fetch comments: ${response.status}`);
  }
  const data = await response.json();
  console.log(`Fetched ${data.length || 0} comments for post ${postId}`);
  return Array.isArray(data) ? data : [];
}

function formatTimeAgo(dateString: string): string {
  // Parse the UTC timestamp and convert to local time
  const date = new Date(dateString + (dateString.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PostsPageContent() {
  const searchParams = useSearchParams();
  const initialSubreddit = searchParams.get("subreddit") || "";
  const initialStock = searchParams.get("stock") || "";

  const [subredditFilter, setSubredditFilter] = useState(initialSubreddit);
  const [stockFilter, setStockFilter] = useState(initialStock);
  const [offset, setOffset] = useState(0);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [commentsCache, setCommentsCache] = useState<Record<string, RedditComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["reddit-posts", subredditFilter, stockFilter, offset],
    queryFn: () => fetchPosts(subredditFilter, stockFilter, offset, limit),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const currentPage = Math.floor(offset / limit) + 1;

  const togglePost = async (postId: string) => {
    const newExpanded = new Set(expandedPosts);

    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
      setExpandedPosts(newExpanded);
    } else {
      newExpanded.add(postId);
      setExpandedPosts(newExpanded);

      // Load comments if not already cached
      if (!commentsCache[postId]) {
        const newLoading = new Set(loadingComments);
        newLoading.add(postId);
        setLoadingComments(newLoading);

        try {
          console.log(`Fetching comments for post ${postId}...`);
          const comments = await fetchComments(postId);
          console.log(`Received comments:`, comments);
          setCommentsCache({ ...commentsCache, [postId]: comments });
        } catch (error) {
          console.error("Failed to load comments:", error);
          // Set empty array on error to prevent retry
          setCommentsCache({ ...commentsCache, [postId]: [] });
        } finally {
          const finalLoading = new Set(loadingComments);
          finalLoading.delete(postId);
          setLoadingComments(finalLoading);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reddit Posts</h1>
        <div className="text-sm text-muted-foreground">
          {data && `${data.total.toLocaleString()} total posts`}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Subreddit</label>
              <Input
                placeholder="e.g., wallstreetbets"
                value={subredditFilter}
                onChange={(e) => {
                  setSubredditFilter(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Stock Symbol</label>
              <Input
                placeholder="e.g., AAPL"
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value.toUpperCase());
                  setOffset(0);
                }}
              />
            </div>
          </div>
          {(subredditFilter || stockFilter) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSubredditFilter("");
                setStockFilter("");
                setOffset(0);
              }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subreddit</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : data && data.posts.length > 0 ? (
                data.posts.map((post) => {
                  let stocks = [];
                  try {
                    stocks = post.mentioned_stocks && post.mentioned_stocks.trim()
                      ? JSON.parse(post.mentioned_stocks)
                      : [];
                  } catch (e) {
                    console.error("Failed to parse mentioned_stocks for post:", post.id, e);
                    stocks = [];
                  }
                  const isExpanded = expandedPosts.has(post.id);
                  const comments = commentsCache[post.id] || [];
                  const isLoadingComments = loadingComments.has(post.id);

                  return (
                    <React.Fragment key={post.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => togglePost(post.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Badge variant="outline" className="text-xs">
                              r/{post.subreddit}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate font-medium">{post.title}</div>
                          <div className="text-xs text-muted-foreground">
                            by u/{post.author}
                          </div>
                        </TableCell>
                        <TableCell>
                          {post.primary_stock && (
                            <Badge variant="secondary" className="font-mono">
                              ${post.primary_stock}
                            </Badge>
                          )}
                          {stocks.length > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              +{stocks.length - 1}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ArrowUp className="h-3 w-3 text-green-500" />
                            <span>{post.score.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            <span>{post.num_comments.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTimeAgo(post.created_at)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${post.id}-comments`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-0">
                            <div className="p-6 space-y-6">
                              {/* Post Content */}
                              {post.content && (
                                <div className="bg-card rounded-lg p-4 border border-primary/10">
                                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Post Content</h4>
                                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {post.content}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}

                              {/* Comments Section */}
                              <div>
                                <div className="flex items-center gap-2 mb-4">
                                  <MessageSquare className="h-4 w-4 text-primary" />
                                  <h3 className="font-semibold">
                                    Comments ({post.num_comments})
                                  </h3>
                                </div>
                                {isLoadingComments ? (
                                <div className="space-y-3 ml-6 pl-4 border-l-2 border-muted-foreground/25">
                                  {[...Array(3)].map((_, i) => (
                                    <div key={i} className="space-y-2">
                                      <Skeleton className="h-4 w-32" />
                                      <Skeleton className="h-12 w-full" />
                                    </div>
                                  ))}
                                </div>
                              ) : comments.length > 0 ? (
                                <div className="space-y-3 ml-6 pl-4 border-l-2 border-muted-foreground/25">
                                  {comments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="bg-muted rounded-md p-3 hover:bg-muted/70 transition-colors border border-border relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:-translate-x-[18px] before:w-3 before:h-px before:bg-muted-foreground/25 after:absolute after:left-0 after:top-1/2 after:-translate-y-1/2 after:-translate-x-[22px] after:w-2 after:h-2 after:rounded-full after:bg-muted-foreground after:z-10"
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium">
                                            u/{comment.author}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {formatTimeAgo(comment.created_at)}
                                          </span>
                                          {comment.sentiment_label && (
                                            <Badge
                                              variant={
                                                comment.sentiment_label === "positive"
                                                  ? "default"
                                                  : comment.sentiment_label === "negative"
                                                  ? "destructive"
                                                  : "outline"
                                              }
                                              className="text-xs"
                                            >
                                              {comment.sentiment_label}
                                              {comment.sentiment_score && (
                                                <span className="ml-1 opacity-70">
                                                  ({(comment.sentiment_score * 100).toFixed(0)}%)
                                                </span>
                                              )}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <ArrowUp className="h-3 w-3" />
                                          {comment.score}
                                        </div>
                                      </div>
                                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {comment.content}
                                        </ReactMarkdown>
                                      </div>
                                      {comment.mentioned_stocks && (() => {
                                        try {
                                          const commentStocks = comment.mentioned_stocks.trim()
                                            ? JSON.parse(comment.mentioned_stocks)
                                            : [];
                                          if (commentStocks.length > 0) {
                                            return (
                                              <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs text-muted-foreground">
                                                  Stocks:
                                                </span>
                                                {commentStocks.map(
                                                  (stock: string) => (
                                                    <Badge
                                                      key={stock}
                                                      variant="secondary"
                                                      className="text-xs font-mono"
                                                    >
                                                      ${stock}
                                                    </Badge>
                                                  )
                                                )}
                                              </div>
                                            );
                                          }
                                        } catch (e) {
                                          console.error("Failed to parse comment mentioned_stocks:", comment.id, e);
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center text-muted-foreground py-8">
                                  No comments found
                                </div>
                              )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No posts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= data.total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PostsPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <Suspense fallback={<div>Loading...</div>}>
                  <PostsPageContent />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
