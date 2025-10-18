"use client";

import { useState, Suspense } from "react";
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
import { ExternalLink, ArrowLeft, ArrowUp } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  author: string;
  url: string;
  score: number;
  num_comments: number;
  mentioned_stocks: string;
  primary_stock: string | null;
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
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["reddit-posts", subredditFilter, stockFilter, offset],
    queryFn: () => fetchPosts(subredditFilter, stockFilter, offset, limit),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Reddit Posts</h1>
        </div>
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
                  const stocks = post.mentioned_stocks
                    ? JSON.parse(post.mentioned_stocks)
                    : [];

                  return (
                    <TableRow key={post.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          r/{post.subreddit}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate">{post.title}</div>
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
                        {post.num_comments.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimeAgo(post.created_at)}
                      </TableCell>
                      <TableCell>
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
