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
import { ArrowUp } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface RedditComment {
  id: string;
  post_id: string;
  post_title: string;
  subreddit: string;
  author: string;
  content: string;
  score: number;
  mentioned_stocks: string | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  created_at: string;
}

interface CommentsResponse {
  comments: RedditComment[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchComments(
  stock?: string,
  sentiment?: string,
  offset = 0,
  limit = 50
): Promise<CommentsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (stock) params.append("stock", stock);
  if (sentiment) params.append("sentiment", sentiment);

  const response = await fetch(`${API_URL}/api/admin/comments?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch comments");
  }
  return response.json();
}

function formatTimeAgo(dateString: string): string {
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

function CommentsPageContent() {
  const searchParams = useSearchParams();
  const initialStock = searchParams.get("stock") || "";
  const initialSentiment = searchParams.get("sentiment") || "";

  const [stockFilter, setStockFilter] = useState(initialStock);
  const [sentimentFilter, setSentimentFilter] = useState(initialSentiment);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-comments", stockFilter, sentimentFilter, offset],
    queryFn: () => fetchComments(stockFilter, sentimentFilter, offset, limit),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reddit Comments</h1>
        <div className="text-sm text-muted-foreground">
          {data && `${data.total.toLocaleString()} total comments`}
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
            <div>
              <label className="text-sm font-medium mb-2 block">Sentiment</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={sentimentFilter}
                onChange={(e) => {
                  setSentimentFilter(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
          </div>
          {(stockFilter || sentimentFilter) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setStockFilter("");
                setSentimentFilter("");
                setOffset(0);
              }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Comments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Post</TableHead>
                <TableHead>Stocks</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : data && data.comments.length > 0 ? (
                data.comments.map((comment) => {
                  const stocks = comment.mentioned_stocks
                    ? JSON.parse(comment.mentioned_stocks)
                    : [];

                  return (
                    <TableRow key={comment.id}>
                      <TableCell className="font-medium">
                        u/{comment.author}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="line-clamp-2 text-sm">{comment.content}</div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm">{comment.post_title}</div>
                        <div className="text-xs text-muted-foreground">
                          r/{comment.subreddit}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {stocks.map((stock: string) => (
                            <Badge key={stock} variant="secondary" className="font-mono text-xs">
                              ${stock}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ArrowUp className="h-3 w-3 text-green-500" />
                          <span>{comment.score.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimeAgo(comment.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No comments found
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

export default function CommentsPage() {
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
                  <CommentsPageContent />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
